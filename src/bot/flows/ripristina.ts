import { currentCounts, restoreGuardedStatements } from "../../db/backup";
import type { ConversationState } from "../../db/conversation";
import { parseBackup, type NormalizedBackup } from "../../domain/backup";
import { formatShort } from "../../domain/date";
import { keyboard } from "../../telegram/keyboard";
import { T, type Counts } from "../../texts";
import { addDays, toDateString, toIso, toLocal } from "../../time";
import { answerCallback, reply, type Ctx } from "../context";
import { cancelButton, flowButton, goTo, registerFlow, repeatStep, startFlow } from "./engine";

// Flusso `ripristina` (RF-26, RNF-05, FR-018…FR-021, contracts/flussi.md): file → conferma1 →
// conferma2. Il backup validato resta nello stato fino alla seconda conferma (research R-09).

interface RipristinaData {
  backup?: NormalizedBackup;
  // Dati attuali al momento della validazione (FR-019).
  counts?: Counts;
}

const data = (state: ConversationState) => state.data as RipristinaData;

const backupCounts = (b: NormalizedBackup): Counts => ({
  persons: b.persons.length,
  groups: b.groups.length,
  occurrences: b.occurrences.length,
});

export async function startRestore(ctx: Ctx): Promise<void> {
  await startFlow(ctx, "ripristina", "file", {} satisfies RipristinaData);
}

// Chiamata da handleDocument per un .json allo step `file`, dopo il download riuscito.
export async function handleBackupFile(ctx: Ctx, bytes: Uint8Array, state: ConversationState): Promise<void> {
  const parsed = parseBackup(bytes, toLocal(ctx.deps.now()));
  // SC-006: motivo del rifiuto, si resta in `file` e si può inviare un altro file.
  if (!parsed.ok) {
    await repeatStep(ctx, state, parsed.reason);
    return;
  }
  const counts = await currentCounts(ctx.deps.db);
  await goTo(ctx, state, "conferma1", { backup: parsed.backup, counts } satisfies RipristinaData);
}

async function removeKeyboard(ctx: Ctx): Promise<void> {
  if (ctx.callback?.messageId !== undefined) {
    await ctx.deps.tg.editMessageReplyMarkup(ctx.chatId, ctx.callback.messageId, { inline_keyboard: [] });
  }
}

registerFlow({
  name: "ripristina",
  steps: {
    file: {
      kind: "text",
      actions: [],
      async prompt(state) {
        return { text: T.restoreAsk, keyboard: keyboard([[cancelButton(state)]]) };
      },
      async onText(_text, state, ctx) {
        await repeatStep(ctx, state, T.waitingBackupFile);
      },
    },
    conferma1: {
      kind: "buttons",
      actions: ["c"],
      async prompt(state) {
        const { backup, counts } = data(state);
        if (!backup || !counts) return { text: T.actionUnavailable };
        return {
          text: T.restoreConfirm1(formatShort(toLocal(new Date(backup.created_at))), backupCounts(backup), counts),
          keyboard: keyboard([[flowButton(state, T.btnContinue, "c"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        await removeKeyboard(ctx);
        await goTo(ctx, state, "conferma2");
      },
    },
    conferma2: {
      kind: "buttons",
      actions: ["r"],
      async prompt(state) {
        return {
          text: T.restoreConfirm2,
          keyboard: keyboard([[flowButton(state, T.btnRestore, "r"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const { backup } = data(state);
        if (!backup) return;
        const { db } = ctx.deps;
        const now = ctx.deps.now();
        // FR-020a: chiuse senza messaggi le occorrenze aperte con D+1 concluso (D ≤ oggi − 2).
        const closeBefore = toDateString(addDays(toLocal(now), -2));
        // FR-020: un errore della batch si propaga all'avviso generico; dati e stato invariati.
        const results = await db.batch(restoreGuardedStatements(db, ctx.chatId, state.flowId, backup, toIso(now), closeBefore));
        if ((results.at(-1)?.meta.changes ?? 0) === 0) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await removeKeyboard(ctx);
        await reply(ctx, T.restoreDone(backupCounts(backup), backup.settings.default_message !== null));
      },
    },
  },
});
