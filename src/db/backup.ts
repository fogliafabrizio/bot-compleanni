import type { BackupData, BackupGroup, BackupOccurrence, BackupPerson, BackupPersonGroup, NormalizedBackup } from "../domain/backup";
import type { ExportPerson } from "../domain/import";
import type { Counts } from "../texts";
import { consumeStatement, flowGuardSql } from "./conversation";
import { DEFAULT_MESSAGE_KEY, defaultMessageStatement } from "./settings";

// Lettura completa, conteggi, ripristino ed export (contracts/backup-json.md, research R-08…R-10).

const PERSON_COLUMNS = `id, full_name, nickname, birth_day, birth_month, birth_year, phone, instagram, telegram, priority,
  custom_message, created_at, updated_at`;

// Batch di lettura: [persone, gruppi, appartenenze, occorrenze, messaggio di default].
export function backupReadStatements(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare(`SELECT ${PERSON_COLUMNS} FROM persons ORDER BY id`),
    db.prepare("SELECT id, name FROM groups ORDER BY id"),
    db.prepare("SELECT person_id, group_id FROM person_groups ORDER BY person_id, group_id"),
    db.prepare("SELECT id, person_id, year, effective_date, status, outcome_at, created_at FROM occurrences ORDER BY id"),
    defaultMessageStatement(db),
  ];
}

export function backupDataFromResults(results: readonly D1Result[]): BackupData {
  const [persons, groups, personGroups, occurrences, def] = results;
  return {
    persons: (persons?.results ?? []) as BackupPerson[],
    groups: (groups?.results ?? []) as BackupGroup[],
    person_groups: (personGroups?.results ?? []) as BackupPersonGroup[],
    occurrences: (occurrences?.results ?? []) as BackupOccurrence[],
    default_message: (def?.results[0] as { value: string } | undefined)?.value ?? null,
  };
}

// FR-019: dati attuali che verranno sostituiti, in una query.
export async function currentCounts(db: D1Database): Promise<Counts> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM persons) AS persons, (SELECT COUNT(*) FROM groups) AS groups,
         (SELECT COUNT(*) FROM occurrences) AS occurrences`,
    )
    .first<Counts>();
  return row ?? { persons: 0, groups: 0, occurrences: 0 };
}

const field = (f: string) => `json_extract(value, '$.${f}')`;
const fields = (names: readonly string[]) => names.map(field).join(", ");

// FR-020, FR-020a: una D1.batch (transazione) con la guardia del flusso su ogni statement. La
// cascata svuota appartenenze, occorrenze e invii; gli id del backup sono mantenuti (RNF-11) e
// sqlite_sequence non si azzera; la chiave auto_backup non è toccata.
export function restoreGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  b: NormalizedBackup,
  nowIso: string,
  // Ultima data effettiva con D+1 concluso (oggi − 2).
  closeBefore: string,
): D1PreparedStatement[] {
  const guard = [chatId, flowId] as const;
  const insert = (table: string, columns: readonly string[], keys: readonly string[], items: unknown[]) =>
    db
      .prepare(`INSERT INTO ${table} (${columns.join(", ")}) SELECT ${fields(keys)} FROM json_each(?) WHERE ${flowGuardSql}`)
      .bind(JSON.stringify(items), ...guard);
  const personColumns = [
    "id",
    "full_name",
    "full_name_norm",
    "nickname",
    "birth_day",
    "birth_month",
    "birth_year",
    "phone",
    "instagram",
    "telegram",
    "priority",
    "custom_message",
    "created_at",
    "updated_at",
  ];
  const occurrenceColumns = ["id", "person_id", "year", "effective_date", "status", "outcome_at", "created_at"];
  return [
    db.prepare(`DELETE FROM persons WHERE ${flowGuardSql}`).bind(...guard),
    db.prepare(`DELETE FROM groups WHERE ${flowGuardSql}`).bind(...guard),
    db.prepare(`DELETE FROM settings WHERE key = ? AND ${flowGuardSql}`).bind(DEFAULT_MESSAGE_KEY, ...guard),
    insert("groups", ["id", "name", "name_norm"], ["id", "name", "name_norm"], b.groups),
    insert("persons", personColumns, personColumns, b.persons),
    insert("person_groups", ["person_id", "group_id"], ["person_id", "group_id"], b.person_groups),
    insert("occurrences", occurrenceColumns, occurrenceColumns, b.occurrences),
    db
      .prepare(`INSERT INTO settings (key, value, updated_at) SELECT ?, ?, ? WHERE ? IS NOT NULL AND ${flowGuardSql}`)
      .bind(DEFAULT_MESSAGE_KEY, b.settings.default_message, nowIso, b.settings.default_message, ...guard),
    // Stessa regola del ciclo orario: nessun messaggio per le occorrenze chiuse.
    db
      .prepare(
        `UPDATE occurrences SET status = 'non_confermato', outcome_at = ?
         WHERE status = 'aperta' AND effective_date <= ? AND ${flowGuardSql}`,
      )
      .bind(nowIso, closeBefore, ...guard),
    consumeStatement(db, chatId, flowId),
  ];
}

// --- Export (RF-25) ---

// Batch di lettura: [persone in ordine di id, nomi dei gruppi per persona].
export function exportReadStatements(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare(`SELECT ${PERSON_COLUMNS} FROM persons ORDER BY id`),
    db.prepare("SELECT pg.person_id, g.name FROM person_groups pg JOIN groups g ON g.id = pg.group_id"),
  ];
}

export function exportFromResults(results: readonly D1Result[]): { person: ExportPerson; groups: string[] }[] {
  const [persons, memberships] = results;
  const byPerson = new Map<number, string[]>();
  for (const m of (memberships?.results ?? []) as { person_id: number; name: string }[]) {
    const list = byPerson.get(m.person_id) ?? [];
    list.push(m.name);
    byPerson.set(m.person_id, list);
  }
  return ((persons?.results ?? []) as BackupPerson[]).map((p) => ({
    person: {
      fullName: p.full_name,
      nickname: p.nickname,
      birthDay: p.birth_day,
      birthMonth: p.birth_month,
      birthYear: p.birth_year,
      phone: p.phone,
      instagram: p.instagram,
      telegram: p.telegram,
      priority: p.priority,
      customMessage: p.custom_message,
    },
    groups: byPerson.get(p.id) ?? [],
  }));
}
