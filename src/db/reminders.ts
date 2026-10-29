import type { Priority } from "../config";
import type { Kind, OccurrenceStatus } from "../domain/schedule";
import { cronLastRunStatements, defaultMessageStatement } from "./settings";

// Statement del ciclo orario: una batch di lettura, una di reclamo, una di esito
// (contracts/ciclo-orario.md, research R-07, R-08). Gli statement multi-riga restano entro
// 100 parametri (limite D1) e non falliscono riga per riga (OR IGNORE, EXISTS).

const MAX_PARAMS = 100;

export interface CandidateRow {
  id: number;
  full_name: string;
  nickname: string | null;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  priority: Priority;
  custom_message: string | null;
  created_at: string;
  // Nomi dei gruppi separati da char(31) (GROUP_SEPARATOR), riordinati in TypeScript.
  group_names: string | null;
}

export interface OccurrenceRow {
  id: number;
  person_id: number;
  year: number;
  effective_date: string;
  status: OccurrenceStatus;
  has_day_send: number;
}

export interface RetryRow {
  id: number;
  occurrence_id: number;
  kind: Kind;
  ref: number;
  attempts: number;
  person_id: number;
  year: number;
  occ_status: OccurrenceStatus;
}

// Riga reclamata: viene inviata solo se in stato in_invio.
export interface ClaimedRow {
  id: number;
  occurrence_id: number;
  kind: Kind;
  ref: number;
  status: string;
  person_id: number;
  year: number;
}

export interface SendRef {
  personId: number;
  year: number;
  kind: Kind;
  ref: number;
}


export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const GROUP_NAMES_SQL = `(SELECT group_concat(g.name, char(31)) FROM person_groups pg JOIN groups g ON g.id = pg.group_id
  WHERE pg.person_id = p.id) AS group_names`;

const RETRY_PERSONS_SQL = `SELECT o.person_id FROM deliveries d JOIN occurrences o ON o.id = d.occurrence_id
  WHERE d.local_date = ? AND d.status = 'fallito'`;

// Persone con la data di nascita tra le coppie del piano o con un retry di oggi.
function candidateCondition(pairs: readonly [number, number][], today: string): { sql: string; params: unknown[] } {
  const sql = [`p.id IN (${RETRY_PERSONS_SQL})`, ...pairs.map(() => "(p.birth_month = ? AND p.birth_day = ?)")].join(" OR ");
  return { sql, params: [today, ...pairs.flat()] };
}

// Batch di lettura: [cron_last_run precedente, registrazione dell'ora corrente (N-06, research R-02
// di 007), messaggio di default, candidati, occorrenze dei candidati, retry di oggi].
export function readStatements(
  db: D1Database,
  q: {
    pairs: readonly [number, number][];
    years: readonly [number, number];
    today: string;
    currentRunIso: string;
    nowIso: string;
  },
): D1PreparedStatement[] {
  const cond = candidateCondition(q.pairs, q.today);
  return [
    ...cronLastRunStatements(db, q.currentRunIso, q.nowIso),
    defaultMessageStatement(db),
    db
      .prepare(
        `SELECT p.id, p.full_name, p.nickname, p.birth_day, p.birth_month, p.birth_year, p.phone, p.instagram, p.telegram,
           p.priority, p.custom_message, p.created_at, ${GROUP_NAMES_SQL}
         FROM persons p WHERE ${cond.sql}`,
      )
      .bind(...cond.params),
    db
      .prepare(
        `SELECT o.id, o.person_id, o.year, o.effective_date, o.status,
           EXISTS (SELECT 1 FROM deliveries d WHERE d.occurrence_id = o.id AND d.kind = 'giorno'
             AND d.status IN ('inviato', 'in_invio')) AS has_day_send
         FROM occurrences o
         WHERE o.year BETWEEN ? AND ? AND o.person_id IN (SELECT p.id FROM persons p WHERE ${cond.sql})`,
      )
      .bind(q.years[0], q.years[1], ...cond.params),
    // Usa idx_deliveries_retry (migration 0002).
    db
      .prepare(
        `SELECT d.id, d.occurrence_id, d.kind, d.ref, d.attempts, o.person_id, o.year, o.status AS occ_status
         FROM deliveries d JOIN occurrences o ON o.id = d.occurrence_id
         WHERE d.local_date = ? AND d.status = 'fallito' ORDER BY d.id`,
      )
      .bind(q.today),
  ];
}

const RETURNING_SQL = `RETURNING id, occurrence_id, kind, ref, status,
  (SELECT o.person_id FROM occurrences o WHERE o.id = deliveries.occurrence_id) AS person_id,
  (SELECT o.year FROM occurrences o WHERE o.id = deliveries.occurrence_id) AS year`;

// Nuovi invii per (persona, anno) solo se l'occorrenza è aperta; l'indice unico scarta i doppi (N-02).
// Le righe in_invio hanno sent_at = istante del reclamo (research R-04 di 007), quelle in coda NULL.
function insertDeliveries(
  db: D1Database,
  items: readonly SendRef[],
  status: "in_invio" | "fallito",
  attempts: number,
  today: string,
  nowIso: string,
): D1PreparedStatement[] {
  // VALUES multi-riga: D1 limita i termini di un UNION ALL, non le righe di VALUES.
  return chunk(items, Math.floor((MAX_PARAMS - 2) / 4)).map((part) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO deliveries (occurrence_id, kind, ref, status, attempts, local_date, sent_at)
         SELECT o.id, v.column1, v.column2, '${status}', ${attempts}, ?, ?
         FROM (VALUES ${part.map(() => "(?, ?, ?, ?)").join(", ")}) v
         JOIN occurrences o ON o.person_id = v.column3 AND o.year = v.column4 AND o.status = 'aperta'
         WHERE true
         ${status === "in_invio" ? RETURNING_SQL : ""}`,
      )
      .bind(today, status === "in_invio" ? nowIso : null, ...part.flatMap((s) => [s.kind, s.ref, s.personId, s.year])),
  );
}

export interface ClaimInput {
  today: string;
  // Occorrenze aperte con data effettiva ≤ questa data → non_confermato (RF-13).
  minOpenDate: string;
  nowIso: string;
  newOccurrences: readonly { personId: number; year: number; effectiveDate: string }[];
  claims: readonly SendRef[];
  queued: readonly SendRef[];
  retryIds: readonly number[];
}

// Posizioni degli statement nella batch, per leggerne i risultati.
export interface ClaimIndex {
  closed: number;
  abandoned: number[];
  claimed: number[];
  queued: number[];
  retried: number[];
}

export function claimStatements(db: D1Database, c: ClaimInput): { statements: D1PreparedStatement[]; index: ClaimIndex } {
  const statements: D1PreparedStatement[] = [
    db
      .prepare("UPDATE occurrences SET status = 'non_confermato', outcome_at = ? WHERE status = 'aperta' AND effective_date <= ?")
      .bind(c.nowIso, c.minOpenDate),
    // N-03: i fallimenti dei giorni precedenti non si ritentano più.
    db.prepare("UPDATE deliveries SET status = 'abbandonato' WHERE status = 'fallito' AND local_date < ?").bind(c.today),
    // R-08: retry di oggi la cui occorrenza nel frattempo è stata chiusa.
    db
      .prepare(
        `UPDATE deliveries SET status = 'abbandonato' WHERE status = 'fallito' AND local_date = ?
           AND occurrence_id IN (SELECT id FROM occurrences WHERE status <> 'aperta')`,
      )
      .bind(c.today),
  ];
  const index: ClaimIndex = { closed: 0, abandoned: [1, 2], claimed: [], queued: [], retried: [] };

  // R-04: l'occorrenza nasce con il primo invio, solo se la persona esiste ancora.
  for (const part of chunk(c.newOccurrences, Math.floor((MAX_PARAMS - 1) / 3))) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO occurrences (person_id, year, effective_date, status, created_at)
           SELECT v.column1, v.column2, v.column3, 'aperta', ?
           FROM (VALUES ${part.map(() => "(?, ?, ?)").join(", ")}) v
           WHERE EXISTS (SELECT 1 FROM persons WHERE id = v.column1)`,
        )
        .bind(c.nowIso, ...part.flatMap((o) => [o.personId, o.year, o.effectiveDate])),
    );
  }

  for (const s of insertDeliveries(db, c.claims, "in_invio", 1, c.today, c.nowIso)) index.claimed.push(statements.push(s) - 1);
  // R-05: oltre il tetto, registrati in coda come fallito con attempts = 0.
  for (const s of insertDeliveries(db, c.queued, "fallito", 0, c.today, c.nowIso)) index.queued.push(statements.push(s) - 1);

  for (const part of chunk(c.retryIds, MAX_PARAMS - 2)) {
    index.retried.push(
      statements.push(
        db
          .prepare(
            `UPDATE deliveries SET status = 'in_invio', attempts = attempts + 1, sent_at = ?
             WHERE id IN (${part.map(() => "?").join(", ")}) AND status = 'fallito' AND local_date = ?
               AND EXISTS (SELECT 1 FROM occurrences o WHERE o.id = deliveries.occurrence_id AND o.status = 'aperta')
             ${RETURNING_SQL}`,
          )
          .bind(c.nowIso, ...part, c.today),
      ) - 1,
    );
  }
  return { statements, index };
}

export type SendResult =
  | { id: number; ok: true; messageId: number; sentAt: string }
  // Codice di Telegram, 0 per errori interni (principio V: mai il contenuto).
  | { id: number; ok: false; code: number };

// Errore → sent_at azzerato: finché la riga era in_invio valeva come istante del reclamo (R-04 di 007).
export function resultStatements(db: D1Database, results: readonly SendResult[]): D1PreparedStatement[] {
  return results.map((r) =>
    r.ok
      ? db
          .prepare("UPDATE deliveries SET status = 'inviato', sent_at = ?, telegram_message_id = ? WHERE id = ?")
          .bind(r.sentAt, r.messageId, r.id)
      : db.prepare("UPDATE deliveries SET status = 'fallito', last_error_code = ?, sent_at = NULL WHERE id = ?").bind(r.code, r.id),
  );
}
