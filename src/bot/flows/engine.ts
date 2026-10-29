import { clear, getActive, start, update, type ConversationState, type FlowName } from "../../db/conversation";
import { T } from "../../texts";
import { button } from "../../telegram/keyboard";
import type { Contact, InlineKeyboardButton, InlineKeyboardMarkup } from "../../telegram/types";
import { answerCallback, reply, type Ctx } from "../context";

// Motore dei flussi guidati (contracts/flussi.md, regole comuni).

export interface Prompt {
  text: string;
  keyboard?: InlineKeyboardMarkup;
}

export interface Step {
  kind: "text" | "buttons";
  // Azioni di pulsante valide in questo step, oltre ad "a" (Annulla) sempre ammessa.
  actions: readonly string[];
  prompt(state: ConversationState, ctx: Ctx): Promise<Prompt>;
  onText?(text: string, state: ConversationState, ctx: Ctx): Promise<void>;
  onCallback?(action: string, arg: string | undefined, state: ConversationState, ctx: Ctx): Promise<void>;
  // Contatto condiviso (FR-011 di 006): solo gli step del telefono lo gestiscono.
  onContact?(contact: Contact, state: ConversationState, ctx: Ctx): Promise<void>;
}

export interface FlowDef {
  name: FlowName;
  steps: Record<string, Step>;
}

const FLOWS = new Map<FlowName, FlowDef>();

export function registerFlow(def: FlowDef): void {
  FLOWS.set(def.name, def);
}

function stepOf(state: ConversationState): Step | undefined {
  return FLOWS.get(state.flow)?.steps[state.step];
}

// Pulsante legato al flusso: invalido appena il flusso termina o viene sostituito.
export function flowButton(state: ConversationState, text: string, action: string, arg?: string): InlineKeyboardButton {
  return button(text, arg === undefined
    ? { kind: "flow", flowId: state.flowId, action }
    : { kind: "flow", flowId: state.flowId, action, arg });
}

export function cancelButton(state: ConversationState): InlineKeyboardButton {
  return flowButton(state, T.btnCancel, "a");
}

export async function sendPrompt(ctx: Ctx, state: ConversationState, prefix?: string): Promise<void> {
  const step = stepOf(state);
  if (!step) return;
  const p = await step.prompt(state, ctx);
  await reply(ctx, prefix ? `${prefix}\n\n${p.text}` : p.text, p.keyboard);
}

// Sostituisce qualunque flusso attivo nella chat.
export async function startFlow(ctx: Ctx, flow: FlowName, step: string, data: unknown): Promise<ConversationState> {
  const state = await start(ctx.deps.db, ctx.chatId, flow, step, data, ctx.deps.now());
  await sendPrompt(ctx, state);
  return state;
}

export async function goTo(ctx: Ctx, state: ConversationState, step: string, data: unknown = state.data): Promise<ConversationState> {
  const next = await update(ctx.deps.db, { ...state, step, data }, ctx.deps.now());
  await sendPrompt(ctx, next);
  return next;
}

// Aggiorna i dati senza cambiare step né inviare messaggi.
export async function saveData(ctx: Ctx, state: ConversationState, data: unknown): Promise<ConversationState> {
  return update(ctx.deps.db, { ...state, data }, ctx.deps.now());
}

// Ripete la domanda dello step, eventualmente preceduta da un messaggio di errore.
export async function repeatStep(ctx: Ctx, state: ConversationState, prefix?: string): Promise<void> {
  const next = await update(ctx.deps.db, state, ctx.deps.now());
  await sendPrompt(ctx, next, prefix);
}

export async function handleFlowText(ctx: Ctx, state: ConversationState, text: string | undefined): Promise<void> {
  const step = stepOf(state);
  if (!step) {
    await clear(ctx.deps.db, ctx.chatId);
    await reply(ctx, T.notUnderstood);
    return;
  }
  // FR-018b: negli step a pulsanti il testo libero ripete la domanda; un messaggio senza
  // testo vale come testo non valido.
  if (step.kind === "buttons" || text === undefined || !step.onText) {
    await repeatStep(ctx, state);
    return;
  }
  await step.onText(text, state, ctx);
}

// FR-011 di 006: negli step senza onContact il contatto ripete la domanda (come FR-018b).
export async function handleFlowContact(ctx: Ctx, state: ConversationState, contact: Contact): Promise<void> {
  const step = stepOf(state);
  if (!step) {
    await clear(ctx.deps.db, ctx.chatId);
    await reply(ctx, T.notUnderstood);
    return;
  }
  if (step.onContact) await step.onContact(contact, state, ctx);
  else await repeatStep(ctx, state);
}

export async function handleFlowCallback(ctx: Ctx, flowId: string, action: string, arg: string | undefined): Promise<void> {
  const state = await getActive(ctx.deps.db, ctx.chatId, ctx.deps.now());
  const step = state && state.flowId === flowId ? stepOf(state) : undefined;
  if (!state || !step) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  if (action === "a") {
    await answerCallback(ctx);
    await clear(ctx.deps.db, ctx.chatId);
    await reply(ctx, T.cancelled);
    return;
  }
  if (!step.actions.includes(action) || !step.onCallback) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  await step.onCallback(action, arg, state, ctx);
}

// Chiude il flusso dopo un errore di dati (es. persona o gruppo non più esistenti).
export async function abortFlow(ctx: Ctx, message: string): Promise<void> {
  await clear(ctx.deps.db, ctx.chatId);
  if (ctx.callback) await answerCallback(ctx, message);
  else await reply(ctx, message);
}
