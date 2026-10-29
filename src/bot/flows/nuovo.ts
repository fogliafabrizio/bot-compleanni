import { DEFAULT_PRIORITY, TEXT_LIMITS, type Priority } from "../../config";
import type { ConversationState } from "../../db/conversation";
import { findDuplicate, insertGuardedStatements, type PersonFields } from "../../db/persons";
import type { BirthDate } from "../../domain/date";
import { normKey } from "../../domain/text";
import { keyboard } from "../../telegram/keyboard";
import { T } from "../../texts";
import { toIso, toLocal } from "../../time";
import { answerCallback, type Ctx } from "../context";
import { renderRiepilogo, showScheda } from "../scheda";
import { cancelButton, flowButton, goTo, registerFlow, startFlow } from "./engine";
import {
  dateConfirmStep,
  duplicateInfo,
  duplicateStep,
  groupsStep,
  newGroupStep,
  phoneConfirmStep,
  phoneContactHandler,
  priorityStep,
  selectedGroupNames,
  textStep,
  validateDate,
  validatePhone,
  validateGreetingText,
  validateText,
  validateUsername,
  type GroupSelection,
} from "./steps";

// Flusso `nuovo` (RF-01, AFU §5.2, contracts/flussi.md).

interface NuovoData {
  fullName: string;
  nickname: string | null;
  birth: BirthDate | null;
  pendingDate?: BirthDate;
  phone: string | null;
  pendingPhone?: string;
  instagram: string | null;
  telegram: string | null;
  groups: GroupSelection;
  priority: Priority;
  customMessage: string | null;
}

const data = (state: ConversationState) => state.data as NuovoData;

function toFields(d: NuovoData): PersonFields {
  const birth = d.birth ?? { day: 1, month: 1, year: null };
  return {
    fullName: d.fullName,
    nickname: d.nickname,
    birthDay: birth.day,
    birthMonth: birth.month,
    birthYear: birth.year,
    phone: d.phone,
    instagram: d.instagram,
    telegram: d.telegram,
    priority: d.priority,
    customMessage: d.customMessage,
  };
}

export async function startNuovo(ctx: Ctx): Promise<void> {
  const initial: NuovoData = {
    fullName: "",
    nickname: null,
    birth: null,
    phone: null,
    instagram: null,
    telegram: null,
    groups: { ids: [], pending: [] },
    priority: DEFAULT_PRIORITY,
    customMessage: null,
  };
  await startFlow(ctx, "nuovo", "nome", initial);
}

const skip = (state: ConversationState) => [flowButton(state, T.btnSkip, "k")];

// Campo opzionale: valore valido o Salta (k) portano allo step successivo.
function optionalField<V>(
  question: string,
  validate: (text: string, ctx: Ctx) => { ok: true; value: V } | { ok: false; error: string },
  set: (d: NuovoData, v: V | null) => NuovoData,
  next: string,
) {
  return textStep<V>({
    question: () => question,
    buttons: skip,
    actions: ["k"],
    validate,
    onValue: async (v, state, ctx) => {
      await goTo(ctx, state, next, set(data(state), v));
    },
    onCallback: async (_a, _arg, state, ctx) => {
      await goTo(ctx, state, next, set(data(state), null));
    },
  });
}

async function save(ctx: Ctx, state: ConversationState): Promise<void> {
  const d = data(state);
  const { db } = ctx.deps;
  const { statements, personIndex } = insertGuardedStatements(
    db,
    ctx.chatId,
    state.flowId,
    { ...toFields(d), fullNameNorm: normKey(d.fullName) },
    d.groups.pending,
    d.groups.ids,
    toIso(ctx.deps.now()),
  );
  const results = await db.batch(statements);
  const inserted = results[personIndex]?.meta;
  // R-11: un secondo "Salva" concorrente trova lo stato già consumato.
  if (!inserted || inserted.changes === 0) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  await showScheda(ctx, inserted.last_row_id);
}

registerFlow({
  name: "nuovo",
  steps: {
    nome: textStep({
      question: () => T.askFullName,
      buttons: (state) => [cancelButton(state)],
      validate: (text) => validateText(text, TEXT_LIMITS.fullName),
      onValue: async (v, state, ctx) => {
        await goTo(ctx, state, "nickname", { ...data(state), fullName: v });
      },
    }),
    nickname: optionalField(T.askNickname, (t) => validateText(t, TEXT_LIMITS.nickname), (d, v) => ({ ...d, nickname: v }), "data"),
    data: textStep({
      question: () => T.askBirthDate,
      validate: validateDate,
      onValue: async (v, state, ctx) => {
        await goTo(ctx, state, "data_conferma", { ...data(state), pendingDate: v });
      },
    }),
    data_conferma: dateConfirmStep({
      correctStep: "data",
      onConfirm: async (date, state, ctx) => {
        const { pendingDate: _, ...rest } = data(state);
        await goTo(ctx, state, "telefono", { ...rest, birth: date });
      },
    }),
    // FR-007: Salta invariato; il contatto condiviso passa dalla conferma (RF-01, BR-25).
    telefono: {
      ...optionalField(T.askPhone, validatePhone, (d, v) => ({ ...d, phone: v }), "instagram"),
      onContact: phoneContactHandler("telefono_conferma"),
    },
    telefono_conferma: phoneConfirmStep({
      correctStep: "telefono",
      onConfirm: async (phone, state, ctx) => {
        const { pendingPhone: _, ...rest } = data(state);
        await goTo(ctx, state, "instagram", { ...rest, phone });
      },
    }),
    instagram: optionalField(T.askInstagram, validateUsername, (d, v) => ({ ...d, instagram: v }), "telegram"),
    telegram: optionalField(T.askTelegram, validateUsername, (d, v) => ({ ...d, telegram: v }), "gruppi"),
    gruppi: groupsStep({
      newGroupStep: "gruppo_nuovo",
      onDone: async (state, ctx) => {
        await goTo(ctx, state, "priorita");
      },
    }),
    gruppo_nuovo: newGroupStep({ backStep: "gruppi", maxLength: TEXT_LIMITS.groupName }),
    priorita: priorityStep({
      current: (state) => data(state).priority,
      onChoose: async (p, state, ctx) => {
        await goTo(ctx, state, "messaggio", { ...data(state), priority: p });
      },
    }),
    messaggio: optionalField(
      T.askMessage,
      validateGreetingText,
      (d, v) => ({ ...d, customMessage: v }),
      "riepilogo",
    ),
    riepilogo: {
      kind: "buttons",
      actions: ["s"],
      async prompt(state, ctx) {
        const d = data(state);
        const names = await selectedGroupNames(ctx, d.groups);
        return {
          text: renderRiepilogo(toFields(d), names, toLocal(ctx.deps.now())),
          keyboard: keyboard([[flowButton(state, T.btnSave, "s"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const d = data(state);
        const birth = d.birth;
        if (!birth) return;
        // BR-14: avviso di possibile duplicato prima di salvare.
        const dup = await findDuplicate(ctx.deps.db, {
          fullNameNorm: normKey(d.fullName),
          day: birth.day,
          month: birth.month,
          year: birth.year,
        });
        if (dup) {
          await goTo(ctx, state, "duplicato", { ...d, duplicate: duplicateInfo(dup) });
          return;
        }
        await save(ctx, state);
      },
    },
    duplicato: duplicateStep({ onConfirm: (state, ctx) => save(ctx, state) }),
  },
});
