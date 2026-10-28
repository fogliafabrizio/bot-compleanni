import { TODAY_MAX_MESSAGES } from "../config";
import { applyTodayOutcome } from "../db/oggi";
import { listPersonsStatement, rowToListPerson, todayStatements, type ListPersonRow, type TodayRow } from "../db/viste";
import { birthPairsFor } from "../domain/schedule";
import { compareNames } from "../domain/text";
import { sortByNextBirthday, type ListRow } from "../domain/viste";
import { T } from "../texts";
import { toDateString, toIso, toLocal } from "../time";
import { answerCallback, reply, type Ctx } from "./context";
import { formatRows, sendList } from "./liste";
import { buildReminderData, renderGiorno, renderGiornoAfter, type Rendered } from "./promemoria";

// /oggi (RF-16, FR-006…FR-008, research R-06 di 003): il reminder del giorno per ogni compleanno
// di oggi, con pulsanti legati all'occorrenza (t:) e nessuna riga in deliveries.

function render(row: TodayRow): Rendered {
  const data = buildReminderData(row, {
    actionTarget: { scope: "t", id: row.occurrence_id },
    year: row.year,
    lastYear: row.last_year_status,
    defaultMessage: row.default_message,
  });
  // Un'occorrenza di oggi può essere solo aperta, fatta o saltata (non_confermato arriva a D+2).
  if (row.status === "aperta") return renderGiorno(data);
  return renderGiornoAfter(data, row.status === "fatto" ? "fatto" : "saltato");
}

const nameOf = (r: TodayRow) => r.nickname ?? r.full_name;

export async function showOggi(ctx: Ctx): Promise<void> {
  const { db } = ctx.deps;
  const now = ctx.deps.now();
  const today = toLocal(now);
  const [, sel] = await db.batch(
    todayStatements(db, { pairs: birthPairsFor(today), year: today.year, effectiveDate: toDateString(today), nowIso: toIso(now) }),
  );
  const rows = ((sel?.results ?? []) as TodayRow[]).sort((a, b) => compareNames(nameOf(a), nameOf(b)) || a.id - b.id);

  if (rows.length === 0) {
    // FR-008: tutte le persone del prossimo giorno con compleanni.
    const { results } = await listPersonsStatement(db).all<ListPersonRow>();
    const sorted = sortByNextBirthday(results.map(rowToListPerson), today);
    const first = sorted[0];
    if (!first) await reply(ctx, T.todayNoPersons);
    else await sendList(ctx, T.todayNone, formatRows(sorted.filter((r) => r.daysUntil === first.daysUntil)));
    return;
  }

  for (const row of rows.slice(0, TODAY_MAX_MESSAGES)) {
    const { text, keyboard } = render(row);
    await reply(ctx, text, keyboard);
  }
  // FR-007a: oltre il tetto, le persone restanti in un messaggio lista senza pulsanti.
  const others: ListRow[] = rows.slice(TODAY_MAX_MESSAGES).map((r) => {
    const person = rowToListPerson(r);
    return { person, date: today, age: person.birthYear !== null ? r.year - person.birthYear : null };
  });
  if (others.length > 0) await sendList(ctx, T.todayOthers, formatRows(others));
}

// Pulsanti t:f / t:s: 1 batch D1 + editMessageText + answerCallbackQuery.
export async function handleTodayCallback(ctx: Ctx, action: "f" | "s", occurrenceId: number): Promise<void> {
  const { changed, data } = await applyTodayOutcome(ctx.deps.db, { occurrenceId, action, nowIso: toIso(ctx.deps.now()) });
  // Occorrenza cancellata in cascata con la persona (FR-018c di 001).
  if (!data) {
    await answerCallback(ctx, T.personNotFound);
    return;
  }
  if (!changed) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  const { text, keyboard } = render(data);
  const messageId = ctx.callback?.messageId;
  if (messageId !== undefined) await ctx.deps.tg.editMessageText(ctx.chatId, messageId, text, keyboard);
  await answerCallback(ctx);
}
