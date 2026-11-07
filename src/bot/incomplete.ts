import {
  incompleteCountsStatement,
  incompletePersonsStatement,
  rowToIncompleteCounts,
  rowToIncompletePerson,
  type IncompleteCountsRow,
  type IncompletePersonRow,
} from "../db/incomplete";
import { filterByCode, INCOMPLETE_FILTERS, incompleteRows, parseIncompleteArg, type IncompleteFilter } from "../domain/incomplete";
import { button, keyboard } from "../telegram/keyboard";
import type { InlineKeyboardButton } from "../telegram/types";
import { INCOMPLETE_LABELS, T } from "../texts";
import { toLocal } from "../time";
import { answerCallback, reply, type Ctx } from "./context";
import { formatRows, sendList } from "./liste";

// /incomplete e pulsanti s:i[:<1…5>] (RF-50, RNF-14, AFU §5.13, contracts/viste-v13.md di 010).
// Ogni risposta è un messaggio nuovo: il messaggio con i pulsanti non si modifica (FR-010, FR-016).

// Menu: titolo, domanda e 5 pulsanti con i conteggi al momento, due per riga (FR-009).
export async function sendIncompleteMenu(ctx: Ctx): Promise<void> {
  const counts = rowToIncompleteCounts(await incompleteCountsStatement(ctx.deps.db).first<IncompleteCountsRow>());
  const buttons = INCOMPLETE_FILTERS.map((f) =>
    button(T.btnIncompleteFilter(INCOMPLETE_LABELS[f.key], counts[f.key]), { kind: "static", scope: "s", action: "i", id: f.code }),
  );
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  await reply(ctx, `${T.incompleteTitle}\n${T.incompleteQuestion}`, keyboard(rows));
}

// Lista di chi non ha il dato del filtro, senza tastiera (FR-012, FR-013, FR-015).
export async function sendIncompleteList(ctx: Ctx, filter: IncompleteFilter): Promise<void> {
  const { results } = await incompletePersonsStatement(ctx.deps.db).all<IncompletePersonRow>();
  if (results.length === 0) {
    await reply(ctx, T.incompleteNoPersons);
    return;
  }
  const rows = incompleteRows(results.map(rowToIncompletePerson), filter, toLocal(ctx.deps.now()));
  if (rows.length === 0) {
    await reply(ctx, T.incompleteAllHave(filter.key));
    return;
  }
  await sendList(ctx, T.incompleteListHeader(filter.key, rows.length), formatRows(rows));
}

// Tocco di s:i (menu) o s:i:<codice> (lista); codici fuori da 1…5 → pulsante non più valido.
export async function showIncompleteFromButton(ctx: Ctx, id: number | undefined): Promise<void> {
  if (id === undefined) {
    await sendIncompleteMenu(ctx);
    return;
  }
  const filter = filterByCode(id);
  if (filter) await sendIncompleteList(ctx, filter);
  else await answerCallback(ctx, T.actionUnavailable);
}

// /incomplete [campo] (FR-011): argomento sconosciuto → errore e poi il menu (research R-08).
export async function handleIncomplete(ctx: Ctx, args: string): Promise<void> {
  const parsed = parseIncompleteArg(args);
  if (parsed.kind === "filter") {
    await sendIncompleteList(ctx, parsed.filter);
    return;
  }
  if (parsed.kind === "unknown") await reply(ctx, T.incompleteUnknown);
  await sendIncompleteMenu(ctx);
}
