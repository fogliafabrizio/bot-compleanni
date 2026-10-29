import { clear, type ConversationState } from "../../db/conversation";
import {
  countMembers,
  createGuardedStatements,
  deleteGuardedStatements,
  existsNorm,
  getById,
  groupByIdStatement,
  listWithCountsStatement,
  renameGuardedStatements,
  type Group,
  type GroupWithCount,
} from "../../db/groups";
import { groupCardStatements } from "../../db/viste";
import { nameHash, normKey } from "../../domain/text";
import { keyboard, type Callback } from "../../telegram/keyboard";
import { T } from "../../texts";
import { answerCallback, type Ctx } from "../context";
import { cardFromBatch, openGroupCard, replyGroupGone, showGroupCard, showGroups } from "../gruppi";
import { showProssimiForGroup } from "../viste";
import { cancelButton, flowButton, registerFlow, repeatStep, startFlow } from "./engine";
import { validateGroupName } from "./steps";

// Flusso `gruppi` v1.1 (RF-07, FR-006a, FR-009, FR-010, FR-017, research R-05): step `crea`,
// `rinomina`, `elimina`, avviati dall'elenco e dalla scheda con id e nome già noti. Gli step di
// prima del rilascio (`nome`, `scelta`, `conferma`) non esistono più: i loro pulsanti rispondono
// "Questa azione non è più disponibile".

interface TargetData {
  groupId: number;
  groupName: string;
}

const target = (state: ConversationState) => state.data as TargetData;

export async function startCrea(ctx: Ctx): Promise<void> {
  await startFlow(ctx, "gruppi", "crea", {});
}

export async function startRinomina(ctx: Ctx, groupId: number, groupName: string): Promise<void> {
  await startFlow(ctx, "gruppi", "rinomina", { groupId, groupName } satisfies TargetData);
}

export async function startEliminaGruppo(ctx: Ctx, groupId: number, groupName: string): Promise<void> {
  await startFlow(ctx, "gruppi", "elimina", { groupId, groupName } satisfies TargetData);
}

// Tocchi g2:* (FR-002, FR-005, contracts/callback-data.md "Validazione al tocco").
export async function handleGroupCallback(ctx: Ctx, cb: Extract<Callback, { kind: "group" }>): Promise<void> {
  if (cb.action === "n") {
    await startCrea(ctx);
    return;
  }
  const { groupId, nameHash: hash } = cb;
  if (groupId === undefined || hash === undefined) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  if (cb.action === "o") {
    await openGroupCard(ctx, groupId, hash);
    return;
  }
  if (cb.action === "p") {
    if (cb.days === undefined) await answerCallback(ctx, T.actionUnavailable);
    else await showProssimiForGroup(ctx, groupId, hash, cb.days);
    return;
  }
  const group = await getById(ctx.deps.db, groupId);
  if (!group || nameHash(group.name) !== hash) {
    await replyGroupGone(ctx);
    return;
  }
  if (cb.action === "r") await startRinomina(ctx, group.id, group.name);
  else await startEliminaGruppo(ctx, group.id, group.name);
}

// Scrittura a 0 righe: gruppo cambiato (→ non esiste più, flusso chiuso) o flusso già consumato da
// un doppio invio (→ nessuna risposta). `current` è il gruppo riletto nella stessa batch.
async function closeIfChanged(ctx: Ctx, current: Group | undefined, expected: string, groups?: readonly GroupWithCount[]): Promise<boolean> {
  if (current && current.name === expected) return false;
  await clear(ctx.deps.db, ctx.chatId);
  await replyGroupGone(ctx, groups);
  return true;
}

registerFlow({
  name: "gruppi",
  steps: {
    crea: {
      kind: "text",
      actions: [],
      async prompt(state) {
        return { text: T.askNewGroupName, keyboard: keyboard([[cancelButton(state)]]) };
      },
      async onText(text, state, ctx) {
        const r = validateGroupName(text);
        if (!r.ok) {
          await repeatStep(ctx, state, r.error);
          return;
        }
        const { db } = ctx.deps;
        const nameNorm = normKey(r.value);
        if (await existsNorm(db, nameNorm)) {
          await repeatStep(ctx, state, T.groupExists);
          return;
        }
        const results = await db.batch(createGuardedStatements(db, ctx.chatId, state.flowId, r.value, nameNorm));
        if ((results[0]?.meta.changes ?? 0) === 0) return;
        await showGroups(ctx, T.groupCreated(r.value));
      },
    },
    rinomina: {
      kind: "text",
      actions: [],
      async prompt(state) {
        return { text: T.askRenameTo(target(state).groupName), keyboard: keyboard([[cancelButton(state)]]) };
      },
      async onText(text, state, ctx) {
        const r = validateGroupName(text);
        if (!r.ok) {
          await repeatStep(ctx, state, r.error);
          return;
        }
        const { groupId, groupName } = target(state);
        const { db } = ctx.deps;
        const nameNorm = normKey(r.value);
        // BR-17, escludendo il gruppo stesso: il solo cambio di maiuscole è consentito.
        if (await existsNorm(db, nameNorm, groupId)) {
          await repeatStep(ctx, state, T.groupExists);
          return;
        }
        const results = await db.batch([
          ...renameGuardedStatements(db, ctx.chatId, state.flowId, groupId, groupName, r.value, nameNorm),
          ...groupCardStatements(db, groupId),
        ]);
        const card = cardFromBatch(results, 2);
        if ((results[0]?.meta.changes ?? 0) === 0) {
          // Doppio invio: il primo ha già rinominato con lo stesso nome.
          if (card?.group.name === r.value) return;
          await closeIfChanged(ctx, card?.group, groupName);
          return;
        }
        if (!card) return;
        await showGroupCard(ctx, card.group, card.people, T.groupRenamed(r.value));
      },
    },
    elimina: {
      kind: "buttons",
      actions: ["y"],
      async prompt(state, ctx) {
        const { groupId, groupName } = target(state);
        return {
          text: T.confirmDeleteGroup(groupName, await countMembers(ctx.deps.db, groupId)),
          keyboard: keyboard([[flowButton(state, T.btnYes, "y"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const { groupId, groupName } = target(state);
        const { db } = ctx.deps;
        const results = await db.batch([
          ...deleteGuardedStatements(db, ctx.chatId, state.flowId, groupId, groupName),
          groupByIdStatement(db, groupId),
          listWithCountsStatement(db),
        ]);
        const groups = (results[3]?.results ?? []) as GroupWithCount[];
        if ((results[0]?.meta.changes ?? 0) === 0) {
          const current = results[2]?.results[0] as Group | undefined;
          if (!(await closeIfChanged(ctx, current, groupName, groups))) await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await showGroups(ctx, T.groupDeleted(groupName), groups);
      },
    },
  },
});
