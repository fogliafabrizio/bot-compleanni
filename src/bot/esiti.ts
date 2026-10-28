import { OUTCOME_CORRECTION_DAYS } from "../config";
import { applyOutcomeBatch } from "../db/outcomes";
import { T } from "../texts";
import { addDays, toDateString, toIso, toLocal } from "../time";
import { answerCallback, type Ctx } from "./context";
import { buildReminderData, renderAfterByKind } from "./promemoria";

// Pulsanti Fatto / Salta dei promemoria (contracts/promemoria.md, "Risposte ai tocchi").
// Budget: 1 batch D1 + editMessageText + answerCallbackQuery = 3 subrequest.
export async function handleOutcomeCallback(ctx: Ctx, action: "f" | "s", deliveryId: number): Promise<void> {
  const now = ctx.deps.now();
  const { changed, data } = await applyOutcomeBatch(ctx.deps.db, {
    deliveryId,
    action,
    // A-05: la correzione vale fino al giorno D+7 compreso.
    minCorrectionDate: toDateString(addDays(toLocal(now), -OUTCOME_CORRECTION_DAYS)),
    nowIso: toIso(now),
  });
  // Invio cancellato in cascata con la persona (FR-018c di 001).
  if (!data) {
    await answerCallback(ctx, T.personNotFound);
    return;
  }
  if (!changed) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  // R-11: si aggiorna solo il messaggio premuto, ricomposto dal database.
  const rd = buildReminderData(data, {
    actionTarget: { scope: "o", id: deliveryId },
    year: data.year,
    lastYear: data.last_year_status,
    defaultMessage: data.default_message,
  });
  const { text, keyboard } = renderAfterByKind(data.kind, data.ref, rd, action === "f" ? "fatto" : "saltato");
  const messageId = ctx.callback?.messageId;
  if (messageId !== undefined) await ctx.deps.tg.editMessageText(ctx.chatId, messageId, text, keyboard);
  await answerCallback(ctx);
}
