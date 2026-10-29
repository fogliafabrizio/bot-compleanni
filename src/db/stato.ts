import type { Kind } from "../domain/schedule";
import { AUTO_BACKUP_LAST_KEY, CRON_LAST_RUN_KEY } from "./settings";

// Letture di /stato (RF-31, contracts/stato.md, research R-07 di 007): una batch di 3 statement
// [chiavi tecniche, conteggi degli invii, dettaglio degli abbandonati]. Le query su deliveries
// filtrano su local_date (idx_deliveries_retry di 0002): nessun indice nuovo.

export interface StatoCountRow {
  is_today: number;
  bucket: "inviato" | "fallito" | "abbandonato";
  n: number;
}

export interface AbbandonatoDbRow {
  nickname: string | null;
  full_name: string;
  kind: Kind;
  ref: number;
  local_date: string;
}

// Abbandonati (data-model.md di 007): abbandonato; fallito di un giorno concluso (N-03); in_invio
// non reclamato nell'ora in corso, sent_at nullo compreso (righe anteriori al deploy, R-04).
const ABANDONED_SQL = `(d.status = 'abbandonato' OR (d.status = 'fallito' AND d.local_date < ?)
  OR (d.status = 'in_invio' AND (d.sent_at IS NULL OR d.sent_at < ?)))`;

export function statoReadStatements(db: D1Database, q: { today: string; from: string; hourStartIso: string }): D1PreparedStatement[] {
  return [
    db.prepare("SELECT key, value FROM settings WHERE key IN (?, ?)").bind(CRON_LAST_RUN_KEY, AUTO_BACKUP_LAST_KEY),
    // Gli in_invio dell'esecuzione corrente (reclamati nell'ora in corso) non sono contati.
    db
      .prepare(
        `SELECT d.local_date = ? AS is_today,
           CASE WHEN d.status = 'inviato' THEN 'inviato'
                WHEN d.status = 'fallito' AND d.local_date = ? THEN 'fallito'
                ELSE 'abbandonato' END AS bucket,
           COUNT(*) AS n
         FROM deliveries d
         WHERE d.local_date BETWEEN ? AND ? AND (d.status <> 'in_invio' OR d.sent_at IS NULL OR d.sent_at < ?)
         GROUP BY is_today, bucket`,
      )
      .bind(q.today, q.today, q.from, q.today, q.hourStartIso),
    db
      .prepare(
        `SELECT p.nickname, p.full_name, d.kind, d.ref, d.local_date
         FROM deliveries d JOIN occurrences o ON o.id = d.occurrence_id JOIN persons p ON p.id = o.person_id
         WHERE d.local_date BETWEEN ? AND ? AND ${ABANDONED_SQL}
         ORDER BY d.local_date, d.id`,
      )
      .bind(q.from, q.today, q.today, q.hourStartIso),
  ];
}
