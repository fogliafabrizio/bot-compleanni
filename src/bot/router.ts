import { clear, getActive } from "../db/conversation";
import type { Deps } from "../deps";
import { decodeCallback } from "../telegram/keyboard";
import type { CallbackQuery, Message, Update } from "../telegram/types";
import { T } from "../texts";
import { COMMANDS, parseCommand } from "./commands";
import { answerCallback, reply, type Ctx } from "./context";
import { awaitsBackupFile, handleDocument } from "./file";
import { handleOutcomeCallback } from "./esiti";
import { getById } from "../db/persons";
import { handleFlowCallback, handleFlowText, repeatStep } from "./flows/engine";
import { startElimina } from "./flows/elimina";
import { handleGroupCallback } from "./flows/gruppi";
import { startModifica } from "./flows/modifica";
import { startNuovo } from "./flows/nuovo";
import { handleTodayCallback } from "./oggi";
import { markDone } from "./scheda";

// Callback senza stato (contracts/callback-data.md), chiave "<scope>:<action>".
export type StaticCallbackHandler = (ctx: Ctx, id: number | undefined) => Promise<void>;

export const STATIC_CALLBACKS: Record<string, StaticCallbackHandler> = {
  "s:n": (ctx) => startNuovo(ctx),
  "s:h": (ctx) => reply(ctx, T.help),
  "p:m": (ctx, id) => startModifica(ctx, id ?? 0),
  // FR-017, BR-08
  "p:f": (ctx, id) => markDone(ctx, id ?? 0),
  "p:x": async (ctx, id) => {
    const person = await getById(ctx.deps.db, id ?? 0);
    if (person) await startElimina(ctx, person.id, person.fullName);
  },
};

export async function route(update: Update, deps: Deps): Promise<void> {
  if (update.message) await routeMessage(update.message, deps);
  else if (update.callback_query) await routeCallback(update.callback_query, deps);
}

function isOwner(deps: Deps, fromId: number): boolean {
  return String(fromId) === deps.ownerId;
}

async function routeMessage(msg: Message, deps: Deps): Promise<void> {
  if (!msg.from) return;
  const ctx: Ctx = { deps, chatId: msg.chat.id, fromId: msg.from.id };
  const cmd = msg.text !== undefined ? parseCommand(msg.text) : null;
  const owner = isOwner(deps, msg.from.id);

  // RF-29: /id per chiunque, in qualsiasi chat.
  if (cmd?.name === "id") {
    // FR-018: per il proprietario anche /id annulla in silenzio il flusso in corso.
    if (owner && msg.chat.type === "private") await clear(deps.db, ctx.chatId);
    await reply(ctx, T.yourId(msg.from.id));
    return;
  }
  // RF-30, RNF-02: estranei ignorati senza alcuna chiamata; R-04: solo chat privata.
  if (!owner || msg.chat.type !== "private") return;

  const state = await getActive(deps.db, ctx.chatId, deps.now());

  // R-13 di 004: i documenti prima dei comandi e del testo dei flussi.
  if (msg.document) {
    await handleDocument(ctx, msg.document, state);
    return;
  }
  // Immagine inviata come foto: non si scarica, il flusso resta invariato.
  if (msg.photo) {
    await reply(ctx, awaitsBackupFile(state) ? T.waitingBackupFile : T.sendCsv);
    return;
  }

  if (cmd) {
    const handler = COMMANDS[cmd.name];
    if (handler) {
      // FR-018: un comando esistente annulla in silenzio il flusso in corso (tranne /annulla).
      if (state && cmd.name !== "annulla") await clear(deps.db, ctx.chatId);
      await handler(ctx, cmd);
      return;
    }
    // Comando inesistente: il flusso non viene interrotto.
    if (state) await repeatStep(ctx, state, T.notUnderstood);
    else await reply(ctx, T.notUnderstood);
    return;
  }

  if (state) await handleFlowText(ctx, state, msg.text);
  else await reply(ctx, T.notUnderstood);
}

async function routeCallback(cq: CallbackQuery, deps: Deps): Promise<void> {
  if (!isOwner(deps, cq.from.id)) return;
  if (cq.message && cq.message.chat.type !== "private") return;
  const chatId = cq.message?.chat.id ?? cq.from.id;
  const ctx: Ctx = {
    deps,
    chatId,
    fromId: cq.from.id,
    callback: { id: cq.id, messageId: cq.message?.message_id, answered: false },
  };
  const cb = cq.data !== undefined ? decodeCallback(cq.data) : null;

  if (!cb) {
    await answerCallback(ctx, T.actionUnavailable);
  } else if (cb.kind === "flow") {
    await handleFlowCallback(ctx, cb.flowId, cb.action, cb.arg);
  } else if (cb.kind === "group") {
    // FR-005: come gli altri pulsanti senza stato, il tocco sostituisce il flusso in corso.
    await clear(deps.db, ctx.chatId);
    await handleGroupCallback(ctx, cb);
  } else if (cb.scope === "o" || cb.scope === "t") {
    // R-11: gli esiti dei promemoria (o:) e di /oggi (t:) non interrompono il flusso guidato in corso.
    if ((cb.action === "f" || cb.action === "s") && cb.id !== undefined) {
      if (cb.scope === "o") await handleOutcomeCallback(ctx, cb.action, cb.id);
      else await handleTodayCallback(ctx, cb.action, cb.id);
    } else await answerCallback(ctx, T.actionUnavailable);
  } else {
    await routeStatic(ctx, cb.scope, cb.action, cb.id);
  }
  await answerCallback(ctx);
}

async function routeStatic(ctx: Ctx, scope: string, action: string, id: number | undefined): Promise<void> {
  // FR-018c: pulsanti della scheda di una persona che non esiste più.
  if (scope === "p" && (id === undefined || !(await getById(ctx.deps.db, id)))) {
    await answerCallback(ctx, T.personNotFound);
    return;
  }
  const handler = STATIC_CALLBACKS[`${scope}:${action}`];
  if (!handler) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  // Come un comando, un pulsante senza stato sostituisce il flusso in corso.
  await clear(ctx.deps.db, ctx.chatId);
  await handler(ctx, id);
}
