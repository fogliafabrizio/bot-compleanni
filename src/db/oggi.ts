import { DEFAULT_MESSAGE_KEY } from "./settings";
import { TODAY_COLUMNS, type TodayRow } from "./viste";

// Pulsanti Fatto / Salta dei messaggi di /oggi (FR-007, BR-07, contracts/callback-data.md di 003):
// una batch con l'UPDATE condizionato sull'occorrenza e la lettura per ricomporre il messaggio.
export async function applyTodayOutcome(
  db: D1Database,
  q: { occurrenceId: number; action: "f" | "s"; nowIso: string },
): Promise<{ changed: boolean; data: TodayRow | null }> {
  const [upd, sel] = await db.batch([
    db
      .prepare("UPDATE occurrences SET status = ?, outcome_at = ? WHERE id = ? AND status = 'aperta'")
      .bind(q.action === "f" ? "fatto" : "saltato", q.nowIso, q.occurrenceId),
    db
      .prepare(`SELECT ${TODAY_COLUMNS} FROM occurrences o JOIN persons p ON p.id = o.person_id WHERE o.id = ?`)
      .bind(DEFAULT_MESSAGE_KEY, q.occurrenceId),
  ]);
  const data = (sel?.results[0] as TodayRow | undefined) ?? null;
  return { changed: (upd?.meta.changes ?? 0) > 0, data };
}
