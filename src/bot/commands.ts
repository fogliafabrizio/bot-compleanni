import { clear, getActive } from "../db/conversation";
import { T } from "../texts";
import { reply, type Ctx } from "./context";
import { button, keyboard } from "../telegram/keyboard";
import { showGroups } from "./flows/gruppi";
import { startMessaggio } from "./flows/messaggio";
import { startNuovo } from "./flows/nuovo";
import { showScheda } from "./scheda";

// Comandi (contracts/comandi.md).

export interface ParsedCommand {
  name: string;
  personId?: number;
}

const PERSON_RE = /^p_(\d+)$/;

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/")) return null;
  const token = trimmed.slice(1).split(/\s+/, 1)[0] ?? "";
  const name = (token.split("@", 1)[0] ?? "").toLowerCase();
  const m = PERSON_RE.exec(name);
  if (m) return { name: "p", personId: Number(m[1]) };
  return { name };
}

export type CommandHandler = (ctx: Ctx, cmd: ParsedCommand) => Promise<void>;

export async function sendWelcome(ctx: Ctx): Promise<void> {
  // RF-28: niente "Scarica modello CSV" finché manca RF-23.
  await reply(
    ctx,
    T.welcome,
    keyboard([
      [
        button(T.btnAddPerson, { kind: "static", scope: "s", action: "n" }),
        button(T.btnCommands, { kind: "static", scope: "s", action: "h" }),
      ],
    ]),
  );
}

export const COMMANDS: Record<string, CommandHandler> = {
  start: (ctx) => sendWelcome(ctx),
  aiuto: (ctx) => reply(ctx, T.help),
  nuovo: (ctx) => startNuovo(ctx),
  // RF-03
  p: (ctx, cmd) => showScheda(ctx, cmd.personId ?? 0),
  gruppi: (ctx) => showGroups(ctx),
  // RF-15
  messaggio: (ctx) => startMessaggio(ctx),
  // RF-06
  annulla: async (ctx) => {
    const state = await getActive(ctx.deps.db, ctx.chatId, ctx.deps.now());
    if (!state) {
      await reply(ctx, T.nothingToCancel);
      return;
    }
    await clear(ctx.deps.db, ctx.chatId);
    await reply(ctx, T.cancelled);
  },
};
