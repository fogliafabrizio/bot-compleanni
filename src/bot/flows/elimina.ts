import type { ConversationState } from "../../db/conversation";
import { deleteGuardedStatements, getById } from "../../db/persons";
import { keyboard } from "../../telegram/keyboard";
import { T } from "../../texts";
import { answerCallback, reply, type Ctx } from "../context";
import { abortFlow, cancelButton, flowButton, registerFlow, startFlow } from "./engine";

// Flusso `elimina` (RF-05, RNF-05): conferma esplicita prima di cancellare.

interface EliminaData {
  personId: number;
  name: string;
}

const data = (state: ConversationState) => state.data as EliminaData;

export async function startElimina(ctx: Ctx, personId: number, name: string): Promise<void> {
  const initial: EliminaData = { personId, name };
  await startFlow(ctx, "elimina", "conferma", initial);
}

registerFlow({
  name: "elimina",
  steps: {
    conferma: {
      kind: "buttons",
      actions: ["y"],
      async prompt(state) {
        return {
          text: T.confirmDeletePerson(data(state).name),
          keyboard: keyboard([[flowButton(state, T.btnYes, "y"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const { personId } = data(state);
        if (!(await getById(ctx.deps.db, personId))) {
          await abortFlow(ctx, T.personNotFound);
          return;
        }
        const results = await ctx.deps.db.batch(deleteGuardedStatements(ctx.deps.db, ctx.chatId, state.flowId, personId));
        if ((results[0]?.meta.changes ?? 0) === 0) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await reply(ctx, T.personDeleted(data(state).name));
      },
    },
  },
});
