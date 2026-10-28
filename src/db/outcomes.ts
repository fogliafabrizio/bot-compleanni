import type { Kind, OccurrenceStatus } from "../domain/schedule";
import type { PersonRowLike } from "../bot/promemoria";
import { GROUP_NAMES_SQL } from "./reminders";
import { DEFAULT_MESSAGE_KEY } from "./settings";

// Esito da pulsante (RF-12, BR-07, BR-08, research R-11): una sola batch con l'UPDATE
// condizionato e la lettura dei dati per ricomporre il messaggio premuto.

export interface OutcomeRow extends PersonRowLike {
  kind: Kind;
  ref: number;
  year: number;
  last_year_status: OccurrenceStatus | null;
  default_message: string | null;
}

export async function applyOutcomeBatch(
  db: D1Database,
  q: { deliveryId: number; action: "f" | "s"; minCorrectionDate: string; nowIso: string },
): Promise<{ changed: boolean; data: OutcomeRow | null }> {
  const kindOf = "(SELECT kind FROM deliveries WHERE id = ?)";
  const [upd, sel] = await db.batch([
    // Il tipo di messaggio è controllato nella query: Fatto su un pre-reminder non cambia
    // l'esito; la correzione in fatto (BR-08) è ammessa solo dal recupero, entro D+7.
    db
      .prepare(
        `UPDATE occurrences SET status = ?, outcome_at = ?
         WHERE id = (SELECT occurrence_id FROM deliveries WHERE id = ?)
           AND ((status = 'aperta' AND (? = 's' OR ${kindOf} <> 'pre'))
             OR (? = 'f' AND ${kindOf} = 'recupero' AND status IN ('saltato', 'non_confermato') AND effective_date >= ?))`,
      )
      .bind(
        q.action === "f" ? "fatto" : "saltato",
        q.nowIso,
        q.deliveryId,
        q.action,
        q.deliveryId,
        q.action,
        q.deliveryId,
        q.minCorrectionDate,
      ),
    db
      .prepare(
        `SELECT d.kind, d.ref, o.year, p.full_name, p.nickname, p.birth_day, p.birth_month, p.birth_year, p.phone,
           p.instagram, p.telegram, p.custom_message, ${GROUP_NAMES_SQL},
           (SELECT prev.status FROM occurrences prev WHERE prev.person_id = p.id AND prev.year = o.year - 1) AS last_year_status,
           (SELECT value FROM settings WHERE key = ?) AS default_message
         FROM deliveries d JOIN occurrences o ON o.id = d.occurrence_id JOIN persons p ON p.id = o.person_id
         WHERE d.id = ?`,
      )
      .bind(DEFAULT_MESSAGE_KEY, q.deliveryId),
  ]);
  const data = (sel?.results[0] as OutcomeRow | undefined) ?? null;
  return { changed: (upd?.meta.changes ?? 0) > 0, data };
}
