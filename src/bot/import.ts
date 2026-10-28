import { IMPORT_MAX_ROWS, PREVIEW_MAX_MESSAGES } from "../config";
import { clear, start, type ConversationState } from "../db/conversation";
import { importContextFromResults, importContextStatements, importGuardedStatements } from "../db/import";
import { decodeUtf8, parseCsv } from "../domain/csv";
import { buildPreview, importState, mapHeader, previewText, recheck, shortSummary, type ImportState } from "../domain/import";
import { keyboard } from "../telegram/keyboard";
import type { InlineKeyboardMarkup } from "../telegram/types";
import { T } from "../texts";
import { toIso, toLocal } from "../time";
import { answerCallback, reply, type Ctx } from "./context";
import { cancelButton, flowButton, registerFlow } from "./flows/engine";
import { plainLine, splitMessage } from "./liste";

// Import CSV con anteprima (RF-24, contracts/flussi.md, research R-06, R-07, R-13).

const data = (state: ConversationState) => state.data as ImportState;

const importKeyboard = (state: ConversationState): InlineKeyboardMarkup =>
  keyboard([[flowButton(state, T.btnImport, "i"), cancelButton(state)]]);

// Al massimo PREVIEW_MAX_MESSAGES messaggi da ≤ 4096 caratteri: se non bastano si tengono le prime
// righe che ci stanno e l'ultimo messaggio dice quante ne mancano (chiarimento 2026-10-29).
export function previewMessages(lines: readonly string[]): string[] {
  const split = (ls: readonly string[]) => splitMessage(ls.map(plainLine)).map((m) => m.text);
  const all = split(lines);
  if (all.length <= PREVIEW_MAX_MESSAGES) return all;
  const withTail = (k: number) => split([...lines.slice(0, k), T.previewTruncated(lines.length - k)]);
  // Ricerca binaria del massimo numero di righe che sta nel tetto (monotono in k).
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (withTail(mid).length <= PREVIEW_MAX_MESSAGES) lo = mid;
    else hi = mid - 1;
  }
  return withTail(lo);
}

async function sendMessages(ctx: Ctx, texts: readonly string[], kb?: InlineKeyboardMarkup): Promise<void> {
  for (const [i, text] of texts.entries()) await reply(ctx, text, i === texts.length - 1 ? kb : undefined);
}

// Chiamata da handleDocument solo dopo il download riuscito.
export async function handleCsv(ctx: Ctx, bytes: Uint8Array, state: ConversationState | null): Promise<void> {
  const { db } = ctx.deps;
  // R-13: come un comando, un CSV annulla in silenzio il flusso in corso, anche se poi è rifiutato.
  if (state) await clear(db, ctx.chatId);

  const decoded = decodeUtf8(bytes);
  if (!decoded.ok) return reply(ctx, T.csvNotUtf8);
  const parsed = parseCsv(decoded.text, IMPORT_MAX_ROWS);
  if ("tooManyRows" in parsed) return reply(ctx, T.csvTooManyRows);
  const headerIndex = parsed.records.findIndex((r) => !r.empty);
  const header = parsed.records[headerIndex];
  if (!header) return reply(ctx, T.csvEmpty);
  const mapped = mapHeader(header.cells);
  if (!mapped.ok) return reply(ctx, T.csvInvalidHeader);
  const records = parsed.records.slice(headerIndex + 1);
  if (!records.some((r) => !r.empty)) return reply(ctx, T.csvEmpty);

  const context = importContextFromResults(await db.batch(importContextStatements(db)));
  const preview = buildPreview(records, mapped.map, context.keys, context.groups, toLocal(ctx.deps.now()));
  const texts = previewMessages(previewText(preview));
  // FR-015: nessuna riga importabile → anteprima senza pulsanti e nessuno stato.
  if (preview.rows.length === 0) return sendMessages(ctx, texts);
  const next = await start(db, ctx.chatId, "import", "anteprima", importState(preview), ctx.deps.now());
  await sendMessages(ctx, texts, importKeyboard(next));
}

async function importa(state: ConversationState, ctx: Ctx): Promise<void> {
  const { db } = ctx.deps;
  const saved = data(state);
  // R-06: duplicati e gruppi ricalcolati sui dati attuali (es. persona aggiunta dopo l'anteprima).
  const context = importContextFromResults(await db.batch(importContextStatements(db)));
  const r = recheck(saved.rows, context.keys, context.groups);
  const { statements, groupsIndex, personsIndex } = importGuardedStatements(
    db,
    ctx.chatId,
    state.flowId,
    r.rows,
    r.groupsToCreate,
    toIso(ctx.deps.now()),
  );
  const results = await db.batch(statements);
  // R-11 di 001: un secondo Importa trova lo stato già consumato e non scrive nulla.
  if ((results.at(-1)?.meta.changes ?? 0) === 0) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  if (ctx.callback?.messageId !== undefined) {
    await ctx.deps.tg.editMessageReplyMarkup(ctx.chatId, ctx.callback.messageId, { inline_keyboard: [] });
  }
  const persons = results[personsIndex]?.meta.changes ?? 0;
  const groups = results[groupsIndex]?.meta.changes ?? 0;
  if (persons === 0) {
    await reply(ctx, T.nothingImported);
    return;
  }
  const done = T.imported(persons, groups);
  await reply(ctx, r.skipped > 0 ? `${T.becameDuplicates(r.skipped)}\n${done}` : done);
}

registerFlow({
  name: "import",
  steps: {
    anteprima: {
      kind: "buttons",
      actions: ["i"],
      async prompt(state) {
        return { text: shortSummary(data(state).preview), keyboard: importKeyboard(state) };
      },
      async onCallback(_action, _arg, state, ctx) {
        await importa(state, ctx);
      },
    },
  },
});
