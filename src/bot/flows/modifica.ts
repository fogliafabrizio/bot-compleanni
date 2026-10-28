import { TEXT_LIMITS, type Priority } from "../../config";
import type { ConversationState } from "../../db/conversation";
import {
  cancelOpenOccurrencesGuardedStatement,
  findDuplicate,
  getById,
  getGroupIds,
  replaceGroupsGuardedStatements,
  updateFieldGuardedStatements,
  type Person,
  type PersonFields,
} from "../../db/persons";
import type { BirthDate } from "../../domain/date";
import { normKey } from "../../domain/text";
import { keyboard } from "../../telegram/keyboard";
import type { InlineKeyboardButton } from "../../telegram/types";
import { T } from "../../texts";
import { toIso } from "../../time";
import { answerCallback, type Ctx } from "../context";
import { showScheda } from "../scheda";
import { abortFlow, cancelButton, flowButton, goTo, registerFlow, startFlow } from "./engine";
import {
  dateConfirmStep,
  duplicateInfo,
  duplicateStep,
  groupsStep,
  newGroupStep,
  priorityStep,
  textStep,
  validateDate,
  validatePhone,
  validateGreetingText,
  validateText,
  validateUsername,
  type GroupSelection,
  type Validation,
} from "./steps";

// Flusso `modifica` (RF-04, contracts/flussi.md).

type FieldCode = keyof typeof T.fieldLabels;
type TextField = keyof typeof T.editAsk;

const FIELD_ORDER: FieldCode[] = ["n", "k", "d", "p", "i", "t", "g", "r", "m"];
// FR-015: campi opzionali che offrono "Svuota".
const CLEARABLE: Partial<Record<FieldCode, keyof PersonFields>> = {
  k: "nickname",
  p: "phone",
  i: "instagram",
  t: "telegram",
  m: "customMessage",
};

interface ModificaData {
  personId: number;
  field?: TextField;
  pendingDate?: BirthDate;
  pendingPatch?: Partial<PersonFields>;
  duplicate?: { name: string; date: string };
  groups: GroupSelection;
  priority?: Priority;
}

const data = (state: ConversationState) => state.data as ModificaData;

export async function startModifica(ctx: Ctx, personId: number): Promise<void> {
  const initial: ModificaData = { personId, groups: { ids: [], pending: [] } };
  await startFlow(ctx, "modifica", "menu", initial);
}

// Prima di ogni scrittura la persona deve esistere ancora.
async function personOrAbort(ctx: Ctx, state: ConversationState): Promise<Person | null> {
  const person = await getById(ctx.deps.db, data(state).personId);
  if (!person) await abortFlow(ctx, T.personNotFound);
  return person;
}

async function savePatch(ctx: Ctx, state: ConversationState, patch: Partial<PersonFields>): Promise<void> {
  const { personId } = data(state);
  const person = await personOrAbort(ctx, state);
  if (!person) return;
  const { db } = ctx.deps;
  const statements = updateFieldGuardedStatements(db, ctx.chatId, state.flowId, personId, patch, toIso(ctx.deps.now()));
  // BR-13: solo se cambiano giorno o mese, non per il solo anno.
  const dayChanged = patch.birthDay !== undefined && patch.birthDay !== person.birthDay;
  const monthChanged = patch.birthMonth !== undefined && patch.birthMonth !== person.birthMonth;
  if (dayChanged || monthChanged) {
    statements.splice(statements.length - 1, 0, cancelOpenOccurrencesGuardedStatement(db, ctx.chatId, state.flowId, personId));
  }
  const results = await db.batch(statements);
  if ((results[0]?.meta.changes ?? 0) === 0) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  await showScheda(ctx, personId);
}

// FR-016a: nome o data che rendono la persona un duplicato di un'altra.
async function saveWithDuplicateCheck(
  ctx: Ctx,
  state: ConversationState,
  person: Person,
  patch: Partial<PersonFields>,
): Promise<void> {
  const merged = { ...person, ...patch };
  const dup = await findDuplicate(
    ctx.deps.db,
    { fullNameNorm: normKey(merged.fullName), day: merged.birthDay, month: merged.birthMonth, year: merged.birthYear },
    person.id,
  );
  if (dup) {
    await goTo(ctx, state, "duplicato", { ...data(state), pendingPatch: patch, duplicate: duplicateInfo(dup) });
    return;
  }
  await savePatch(ctx, state, patch);
}

function validateField(field: TextField, text: string, ctx: Ctx): Validation<string | BirthDate> {
  switch (field) {
    case "n":
      return validateText(text, TEXT_LIMITS.fullName);
    case "k":
      return validateText(text, TEXT_LIMITS.nickname);
    case "m":
      return validateGreetingText(text);
    case "d":
      return validateDate(text, ctx);
    case "p":
      return validatePhone(text);
    case "i":
    case "t":
      return validateUsername(text);
  }
}

const TEXT_PATCH: Record<Exclude<TextField, "d" | "n">, keyof PersonFields> = {
  k: "nickname",
  p: "phone",
  i: "instagram",
  t: "telegram",
  m: "customMessage",
};

registerFlow({
  name: "modifica",
  steps: {
    menu: {
      kind: "buttons",
      actions: ["e"],
      async prompt(state) {
        const btns = FIELD_ORDER.map((f) => flowButton(state, T.fieldLabels[f], "e", f));
        const rows: InlineKeyboardButton[][] = [];
        for (let i = 0; i < btns.length; i += 3) rows.push(btns.slice(i, i + 3));
        rows.push([cancelButton(state)]);
        return { text: T.editWhichField, keyboard: keyboard(rows) };
      },
      async onCallback(_action, arg, state, ctx) {
        const field = FIELD_ORDER.find((f) => f === arg);
        if (!field) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        const person = await personOrAbort(ctx, state);
        if (!person) return;
        if (field === "g") {
          const ids = await getGroupIds(ctx.deps.db, person.id);
          await goTo(ctx, state, "gruppi", { ...data(state), groups: { ids, pending: [] } });
        } else if (field === "r") {
          await goTo(ctx, state, "priorita", { ...data(state), priority: person.priority });
        } else {
          await goTo(ctx, state, "valore", { ...data(state), field });
        }
      },
    },
    valore: textStep<string | BirthDate>({
      question: (state) => T.editAsk[data(state).field ?? "n"],
      buttons: (state) => {
        const field = data(state).field;
        return [...(field && CLEARABLE[field] ? [flowButton(state, T.btnClear, "z")] : []), cancelButton(state)];
      },
      actions: ["z"],
      validate: (text, ctx, state) => validateField(data(state).field ?? "n", text, ctx),
      onValue: async (value, state, ctx) => {
        const field = data(state).field ?? "n";
        if (field === "d") {
          await goTo(ctx, state, "data_conferma", { ...data(state), pendingDate: value as BirthDate });
          return;
        }
        if (field === "n") {
          const person = await personOrAbort(ctx, state);
          if (person) await saveWithDuplicateCheck(ctx, state, person, { fullName: value as string });
          return;
        }
        await savePatch(ctx, state, { [TEXT_PATCH[field]]: value as string });
      },
      onCallback: async (_action, _arg, state, ctx) => {
        const field = data(state).field;
        const column = field ? CLEARABLE[field] : undefined;
        if (!column) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await savePatch(ctx, state, { [column]: null });
      },
    }),
    data_conferma: dateConfirmStep({
      correctStep: "valore",
      onConfirm: async (date, state, ctx) => {
        const person = await personOrAbort(ctx, state);
        if (!person) return;
        await saveWithDuplicateCheck(ctx, state, person, {
          birthDay: date.day,
          birthMonth: date.month,
          birthYear: date.year,
        });
      },
    }),
    duplicato: duplicateStep({
      onConfirm: async (state, ctx) => {
        await savePatch(ctx, state, data(state).pendingPatch ?? {});
      },
    }),
    gruppi: groupsStep({
      newGroupStep: "gruppo_nuovo",
      onDone: async (state, ctx) => {
        const d = data(state);
        if (!(await personOrAbort(ctx, state))) return;
        const results = await ctx.deps.db.batch(
          replaceGroupsGuardedStatements(
            ctx.deps.db,
            ctx.chatId,
            state.flowId,
            d.personId,
            d.groups.ids,
            d.groups.pending,
            toIso(ctx.deps.now()),
          ),
        );
        if ((results[0]?.meta.changes ?? 0) === 0) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await showScheda(ctx, d.personId);
      },
    }),
    gruppo_nuovo: newGroupStep({ backStep: "gruppi", maxLength: TEXT_LIMITS.groupName }),
    priorita: priorityStep({
      current: (state) => data(state).priority ?? "media",
      onChoose: async (p, state, ctx) => {
        await savePatch(ctx, state, { priority: p });
      },
    }),
  },
});
