import { TEXT_LIMITS } from "../../config";
import type { ConversationState } from "../../db/conversation";
import {
  countMembers,
  createGuardedStatements,
  deleteGuardedStatements,
  existsNorm,
  getById,
  listAll,
  listWithCounts,
  renameGuardedStatements,
} from "../../db/groups";
import { normKey } from "../../domain/text";
import { button, keyboard } from "../../telegram/keyboard";
import { T } from "../../texts";
import { answerCallback, reply, type Ctx } from "../context";
import { abortFlow, cancelButton, flowButton, goTo, registerFlow, repeatStep, startFlow } from "./engine";
import { validateText } from "./steps";

// `/gruppi` e flusso `gruppi` (RF-07, FR-019…FR-022).

type GroupAction = "nuovo" | "rinomina" | "elimina";

interface GruppiData {
  action: GroupAction;
  groupId?: number;
  groupName?: string;
}

const data = (state: ConversationState) => state.data as GruppiData;

export async function showGroups(ctx: Ctx, prefix?: string): Promise<void> {
  const groups = await listWithCounts(ctx.deps.db);
  const body = groups.length > 0 ? [T.groupsTitle, ...groups.map((g) => T.groupLine(g.name, g.members))].join("\n") : T.noGroups;
  const row = [button(T.btnNewGroup, { kind: "static", scope: "g", action: "n" })];
  if (groups.length > 0) {
    row.push(
      button(T.btnRename, { kind: "static", scope: "g", action: "r" }),
      button(T.btnDeleteGroup, { kind: "static", scope: "g", action: "x" }),
    );
  }
  await reply(ctx, prefix ? `${prefix}\n\n${body}` : body, keyboard([row]));
}

export async function startGruppi(ctx: Ctx, action: GroupAction): Promise<void> {
  if (action === "nuovo") {
    await startFlow(ctx, "gruppi", "nome", { action } satisfies GruppiData);
    return;
  }
  if ((await listAll(ctx.deps.db)).length === 0) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  await startFlow(ctx, "gruppi", "scelta", { action } satisfies GruppiData);
}

registerFlow({
  name: "gruppi",
  steps: {
    nome: {
      kind: "text",
      actions: [],
      async prompt(state) {
        const d = data(state);
        const text = d.action === "rinomina" ? T.askRenameTo(d.groupName ?? "") : T.askNewGroupName;
        return { text, keyboard: keyboard([[cancelButton(state)]]) };
      },
      async onText(text, state, ctx) {
        const d = data(state);
        const r = validateText(text, TEXT_LIMITS.groupName);
        if (!r.ok) {
          await repeatStep(ctx, state, r.error);
          return;
        }
        const nameNorm = normKey(r.value);
        const { db } = ctx.deps;
        if (d.action === "rinomina") {
          if (d.groupId === undefined || !(await getById(db, d.groupId))) {
            await abortFlow(ctx, T.actionUnavailable);
            return;
          }
          // BR-17, escludendo il gruppo stesso: il solo cambio di maiuscole è consentito.
          if (await existsNorm(db, nameNorm, d.groupId)) {
            await repeatStep(ctx, state, T.groupExists);
            return;
          }
          const results = await db.batch(renameGuardedStatements(db, ctx.chatId, state.flowId, d.groupId, r.value, nameNorm));
          if ((results[0]?.meta.changes ?? 0) === 0) return;
          await showGroups(ctx, T.groupRenamed(r.value));
          return;
        }
        if (await existsNorm(db, nameNorm)) {
          await repeatStep(ctx, state, T.groupExists);
          return;
        }
        const results = await db.batch(createGuardedStatements(db, ctx.chatId, state.flowId, r.value, nameNorm));
        if ((results[0]?.meta.changes ?? 0) === 0) return;
        await showGroups(ctx, T.groupCreated(r.value));
      },
    },
    scelta: {
      kind: "buttons",
      actions: ["sg"],
      async prompt(state, ctx) {
        const groups = await listAll(ctx.deps.db);
        const rows = groups.map((g) => [flowButton(state, g.name, "sg", String(g.id))]);
        rows.push([cancelButton(state)]);
        const text = data(state).action === "rinomina" ? T.askGroupToRename : T.askGroupToDelete;
        return { text, keyboard: keyboard(rows) };
      },
      async onCallback(_action, arg, state, ctx) {
        const group = arg !== undefined && /^\d+$/.test(arg) ? await getById(ctx.deps.db, Number(arg)) : null;
        if (!group) {
          await abortFlow(ctx, T.actionUnavailable);
          return;
        }
        const next = { ...data(state), groupId: group.id, groupName: group.name };
        await goTo(ctx, state, data(state).action === "rinomina" ? "nome" : "conferma", next);
      },
    },
    conferma: {
      kind: "buttons",
      actions: ["y"],
      async prompt(state, ctx) {
        const d = data(state);
        const members = d.groupId !== undefined ? await countMembers(ctx.deps.db, d.groupId) : 0;
        return {
          text: T.confirmDeleteGroup(d.groupName ?? "", members),
          keyboard: keyboard([[flowButton(state, T.btnYes, "y"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const d = data(state);
        const { db } = ctx.deps;
        if (d.groupId === undefined || !(await getById(db, d.groupId))) {
          await abortFlow(ctx, T.actionUnavailable);
          return;
        }
        const results = await db.batch(deleteGuardedStatements(db, ctx.chatId, state.flowId, d.groupId));
        if ((results[0]?.meta.changes ?? 0) === 0) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await showGroups(ctx, T.groupDeleted(d.groupName ?? ""));
      },
    },
  },
});
