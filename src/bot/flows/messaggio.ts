import { DEFAULT_BIRTHDAY_MESSAGE } from "../../config";
import { consumeStatement, type ConversationState } from "../../db/conversation";
import { getDefaultMessage, saveDefaultMessageGuardedStatement } from "../../db/settings";
import { composeGreeting } from "../../domain/greeting";
import { keyboard } from "../../telegram/keyboard";
import { T } from "../../texts";
import { toIso } from "../../time";
import { answerCallback, reply, type Ctx } from "../context";
import { cancelButton, flowButton, goTo, registerFlow, repeatStep, startFlow } from "./engine";
import { validateGreetingText } from "./steps";

// Flusso `messaggio` (RF-15, FR-032, contracts/messaggio.md): testo → anteprima → conferma.

interface MessaggioData {
  text?: string;
}

const data = (state: ConversationState) => state.data as MessaggioData;

export async function startMessaggio(ctx: Ctx): Promise<void> {
  await startFlow(ctx, "messaggio", "testo", {} satisfies MessaggioData);
}

registerFlow({
  name: "messaggio",
  steps: {
    testo: {
      kind: "text",
      actions: [],
      async prompt(state, ctx) {
        const current = (await getDefaultMessage(ctx.deps.db)) ?? DEFAULT_BIRTHDAY_MESSAGE;
        return { text: T.greetingAsk(current), keyboard: keyboard([[cancelButton(state)]]) };
      },
      async onText(text, state, ctx) {
        const r = validateGreetingText(text);
        if (!r.ok) {
          await repeatStep(ctx, state, r.error);
          return;
        }
        await goTo(ctx, state, "conferma", { text: r.value } satisfies MessaggioData);
      },
    },
    conferma: {
      kind: "buttons",
      actions: ["y"],
      async prompt(state) {
        const preview = composeGreeting({ nickname: null, fullName: T.sampleName, customMessage: null }, data(state).text ?? null);
        return {
          text: T.greetingPreview(preview),
          keyboard: keyboard([[flowButton(state, T.btnConfirm, "y"), cancelButton(state)]]),
        };
      },
      async onCallback(_action, _arg, state, ctx) {
        const { db } = ctx.deps;
        const text = data(state).text;
        if (text === undefined) return;
        const results = await db.batch([
          saveDefaultMessageGuardedStatement(db, ctx.chatId, state.flowId, text, toIso(ctx.deps.now())),
          consumeStatement(db, ctx.chatId, state.flowId),
        ]);
        // R-11 di 001: un secondo Conferma concorrente trova lo stato già consumato.
        if ((results[0]?.meta.changes ?? 0) === 0) {
          await answerCallback(ctx, T.actionUnavailable);
          return;
        }
        await reply(ctx, T.greetingSaved);
      },
    },
  },
});
