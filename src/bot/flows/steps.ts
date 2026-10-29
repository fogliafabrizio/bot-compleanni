import { TEXT_LIMITS, type Priority } from "../../config";
import type { ConversationState } from "../../db/conversation";
import { existsNorm, listAll } from "../../db/groups";
import type { Person } from "../../db/persons";
import { formatLong, formatShort, parseBirthDate, type BirthDate } from "../../domain/date";
import { validateGreeting } from "../../domain/greeting";
import { normalizeContactPhone, normalizePhone } from "../../domain/phone";
import { cleanText, hasValidGroupKey, normKey } from "../../domain/text";
import { normalizeUsername } from "../../domain/username";
import { keyboard } from "../../telegram/keyboard";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "../../telegram/types";
import { T } from "../../texts";
import { toLocal } from "../../time";
import { answerCallback, type Ctx } from "../context";
import { cancelButton, flowButton, goTo, repeatStep, saveData, type Step } from "./engine";

// Step riusabili dai flussi `nuovo` e `modifica` (contracts/flussi.md, FR-016).

export type Validation<V> = { ok: true; value: V } | { ok: false; error: string };

export function validateText(input: string, max: number): Validation<string> {
  const r = cleanText(input, max);
  if (r.ok) return r;
  return { ok: false, error: r.reason === "empty" ? T.emptyValue : T.tooLong(r.max) };
}

// Nome di un gruppo nuovo o rinominato: vuoto, lunghezza (001 FR-010a) e chiave BR-26 (FR-006a, R-05).
export function validateGroupName(input: string, max: number = TEXT_LIMITS.groupName): Validation<string> {
  const r = validateText(input, max);
  if (!r.ok || hasValidGroupKey(r.value)) return r;
  return { ok: false, error: T.groupKeyTooShort };
}

// FR-035: messaggio di auguri (personalizzato o default), {nome} contato 60 caratteri.
export function validateGreetingText(input: string): Validation<string> {
  const r = validateGreeting(input);
  if (r.ok) return r;
  return {
    ok: false,
    error: r.error === "empty" ? T.emptyValue : T.greetingTooLong(TEXT_LIMITS.customMessage, TEXT_LIMITS.greetingNamePlaceholder),
  };
}

export function validatePhone(input: string): Validation<string> {
  const r = normalizePhone(input);
  return r.ok ? r : { ok: false, error: T.invalidPhone };
}

export function validateUsername(input: string): Validation<string> {
  const r = normalizeUsername(input);
  return r.ok ? r : { ok: false, error: T.emptyValue };
}

export function validateDate(input: string, ctx: Ctx): Validation<BirthDate> {
  const r = parseBirthDate(input, toLocal(ctx.deps.now()));
  if (!r.ok) return { ok: false, error: T.invalidDate };
  return { ok: true, value: { day: r.day, month: r.month, year: r.year } };
}

// Step a testo: input non valido → errore + ripetizione della domanda.
export function textStep<V>(opts: {
  question: (state: ConversationState) => string;
  buttons?: (state: ConversationState) => InlineKeyboardButton[];
  actions?: readonly string[];
  validate: (text: string, ctx: Ctx, state: ConversationState) => Validation<V>;
  onValue: (value: V, state: ConversationState, ctx: Ctx) => Promise<void>;
  onCallback?: Step["onCallback"];
}): Step {
  return {
    kind: "text",
    actions: opts.actions ?? [],
    async prompt(state) {
      const row = opts.buttons?.(state) ?? [];
      return row.length > 0 ? { text: opts.question(state), keyboard: keyboard([row]) } : { text: opts.question(state) };
    },
    async onText(text, state, ctx) {
      const r = opts.validate(text, ctx, state);
      if (!r.ok) {
        await repeatStep(ctx, state, r.error);
        return;
      }
      await opts.onValue(r.value, state, ctx);
    },
    ...(opts.onCallback ? { onCallback: opts.onCallback } : {}),
  };
}

// --- Conferma della data (RF-02, FR-008) ---

export interface WithPendingDate {
  pendingDate?: BirthDate;
}

export function dateConfirmStep(opts: {
  correctStep: string;
  onConfirm: (date: BirthDate, state: ConversationState, ctx: Ctx) => Promise<void>;
}): Step {
  return {
    kind: "buttons",
    actions: ["y", "c"],
    async prompt(state) {
      const d = (state.data as WithPendingDate).pendingDate;
      return {
        text: T.confirmDate(d ? formatLong(d) : ""),
        keyboard: keyboard([[flowButton(state, T.btnYes, "y"), flowButton(state, T.btnFix, "c")]]),
      };
    },
    async onCallback(action, _arg, state, ctx) {
      const d = (state.data as WithPendingDate).pendingDate;
      if (action === "c" || !d) {
        await goTo(ctx, state, opts.correctStep);
        return;
      }
      await opts.onConfirm(d, state, ctx);
    },
  };
}

// --- Telefono da contatto condiviso (RF-01, RF-04, BR-25, D-24; research R-04 di 006) ---

export interface WithPendingPhone {
  pendingPhone?: string;
}

function withoutPendingPhone(data: unknown): unknown {
  const { pendingPhone: _, ...rest } = data as WithPendingPhone & Record<string, unknown>;
  return rest;
}

// Conferma del numero proposto: nessun Annulla, come la conferma della data (FR-010).
export function phoneConfirmStep(opts: {
  correctStep: string;
  onConfirm: (phone: string, state: ConversationState, ctx: Ctx) => Promise<void>;
}): Step {
  return {
    kind: "buttons",
    actions: ["y", "c"],
    async prompt(state) {
      return {
        text: T.confirmPhone((state.data as WithPendingPhone).pendingPhone ?? ""),
        keyboard: keyboard([[flowButton(state, T.btnYes, "y"), flowButton(state, T.btnFix, "c")]]),
      };
    },
    async onCallback(action, _arg, state, ctx) {
      const phone = (state.data as WithPendingPhone).pendingPhone;
      if (action === "c" || !phone) {
        await goTo(ctx, state, opts.correctStep, withoutPendingPhone(state.data));
        return;
      }
      await opts.onConfirm(phone, state, ctx);
    },
  };
}

// Contatto allo step del telefono: si legge solo phone_number (FR-008, V-08), mai nei log.
export function phoneContactHandler(confirmStep: string): NonNullable<Step["onContact"]> {
  return async (contact, state, ctx) => {
    const r = normalizeContactPhone(contact.phone_number);
    if (!r.ok) {
      await repeatStep(ctx, state, r.reason === "missing" ? T.contactWithoutPhone : T.invalidPhone);
      return;
    }
    await goTo(ctx, state, confirmStep, { ...(state.data as object), pendingPhone: r.value });
  };
}

// --- Gruppi (RF-08, FR-023, research R-12) ---

export interface PendingGroup {
  name: string;
  nameNorm: string;
  selected: boolean;
}

export interface GroupSelection {
  ids: number[];
  pending: PendingGroup[];
}

export interface WithGroups {
  groups: GroupSelection;
}

async function groupsKeyboard(ctx: Ctx, state: ConversationState): Promise<InlineKeyboardMarkup> {
  const sel = (state.data as WithGroups).groups;
  const all = await listAll(ctx.deps.db);
  const toggles = [
    ...all.map((g) => flowButton(state, T.groupToggle(g.name, sel.ids.includes(g.id)), "t", String(g.id))),
    ...sel.pending.map((p, i) => flowButton(state, T.groupToggle(p.name, p.selected), "t", `n${i}`)),
  ];
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < toggles.length; i += 2) rows.push(toggles.slice(i, i + 2));
  rows.push([flowButton(state, T.btnNewGroup, "ng"), flowButton(state, T.btnDone, "d")]);
  return keyboard(rows);
}

export function groupsStep(opts: {
  newGroupStep: string;
  onDone: (state: ConversationState, ctx: Ctx) => Promise<void>;
}): Step {
  return {
    kind: "buttons",
    actions: ["t", "ng", "d"],
    async prompt(state, ctx) {
      return { text: T.askGroups, keyboard: await groupsKeyboard(ctx, state) };
    },
    async onCallback(action, arg, state, ctx) {
      if (action === "ng") {
        await goTo(ctx, state, opts.newGroupStep);
        return;
      }
      if (action === "d") {
        await opts.onDone(state, ctx);
        return;
      }
      const data = state.data as WithGroups;
      const sel: GroupSelection = { ids: [...data.groups.ids], pending: data.groups.pending.map((p) => ({ ...p })) };
      if (arg?.startsWith("n")) {
        const p = sel.pending[Number(arg.slice(1))];
        if (!p) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        p.selected = !p.selected;
      } else {
        const id = Number(arg);
        const all = await listAll(ctx.deps.db);
        if (!Number.isInteger(id) || !all.some((g) => g.id === id)) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        sel.ids = sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id];
      }
      const next = await saveData(ctx, state, { ...data, groups: sel });
      const kb = await groupsKeyboard(ctx, next);
      const messageId = ctx.callback?.messageId;
      if (messageId !== undefined) await ctx.deps.tg.editMessageReplyMarkup(ctx.chatId, messageId, kb);
      else await ctx.deps.tg.sendMessage(ctx.chatId, T.askGroups, kb);
    },
  };
}

// Sotto-step "Nuovo gruppo": il gruppo resta in attesa fino al salvataggio finale.
export function newGroupStep(opts: { backStep: string; maxLength: number }): Step {
  return {
    kind: "text",
    actions: [],
    async prompt(state) {
      return { text: T.askNewGroupName, keyboard: keyboard([[cancelButton(state)]]) };
    },
    async onText(text, state, ctx) {
      const r = validateGroupName(text, opts.maxLength);
      if (!r.ok) {
        await repeatStep(ctx, state, r.error);
        return;
      }
      const data = state.data as WithGroups;
      const nameNorm = normKey(r.value);
      if (data.groups.pending.some((p) => p.nameNorm === nameNorm) || (await existsNorm(ctx.deps.db, nameNorm))) {
        await repeatStep(ctx, state, T.groupExists);
        return;
      }
      const groups: GroupSelection = {
        ids: data.groups.ids,
        pending: [...data.groups.pending, { name: r.value, nameNorm, selected: true }],
      };
      await goTo(ctx, state, opts.backStep, { ...data, groups });
    },
  };
}

// --- Priorità ---

const PRIORITY_CODES: Record<string, Priority> = { a: "alta", m: "media", b: "bassa" };

export function priorityStep(opts: {
  current: (state: ConversationState) => Priority;
  onChoose: (p: Priority, state: ConversationState, ctx: Ctx) => Promise<void>;
}): Step {
  return {
    kind: "buttons",
    actions: ["pr"],
    async prompt(state) {
      const cur = opts.current(state);
      const btn = (label: string, code: string) =>
        flowButton(state, PRIORITY_CODES[code] === cur ? T.selected(label) : label, "pr", code);
      return {
        text: T.askPriority,
        keyboard: keyboard([[btn(T.btnHigh, "a"), btn(T.btnMedium, "m"), btn(T.btnLow, "b")]]),
      };
    },
    async onCallback(_action, arg, state, ctx) {
      const p = arg !== undefined ? PRIORITY_CODES[arg] : undefined;
      if (!p) {
        await answerCallback(ctx, T.actionUnavailable);
        return;
      }
      await opts.onChoose(p, state, ctx);
    },
  };
}

// --- Possibile duplicato (BR-14, FR-016a) ---

export interface WithDuplicate {
  duplicate?: { name: string; date: string };
}

export function duplicateInfo(p: Person): { name: string; date: string } {
  return { name: p.fullName, date: formatShort({ day: p.birthDay, month: p.birthMonth, year: p.birthYear }) };
}

export function duplicateStep(opts: { onConfirm: (state: ConversationState, ctx: Ctx) => Promise<void> }): Step {
  return {
    kind: "buttons",
    actions: ["sd"],
    async prompt(state) {
      const dup = (state.data as WithDuplicate).duplicate;
      return {
        text: T.possibleDuplicate(dup?.name ?? "", dup?.date ?? ""),
        keyboard: keyboard([[flowButton(state, T.btnSaveAnyway, "sd"), cancelButton(state)]]),
      };
    },
    async onCallback(_action, _arg, state, ctx) {
      await opts.onConfirm(state, ctx);
    },
  };
}

// Nomi dei gruppi selezionati (esistenti e in attesa), per il riepilogo.
export async function selectedGroupNames(ctx: Ctx, sel: GroupSelection): Promise<string[]> {
  const all = await listAll(ctx.deps.db);
  return [
    ...all.filter((g) => sel.ids.includes(g.id)).map((g) => g.name),
    ...sel.pending.filter((p) => p.selected).map((p) => p.name),
  ];
}
