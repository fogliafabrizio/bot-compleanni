import { clear, getActive } from "../db/conversation";
import { T } from "../texts";
import { reply, type Ctx } from "./context";
import { button, keyboard } from "../telegram/keyboard";
import { handleBackup } from "./backup";
import { handleExport, handleTemplate } from "./export";
import { startRestore } from "./flows/ripristina";
import { startMessaggio } from "./flows/messaggio";
import { startNuovo } from "./flows/nuovo";
import { handleGruppiCommand } from "./gruppi";
import { showOggi } from "./oggi";
import { showScheda } from "./scheda";
import { showAnno, showCerca, showMese, showProssimi, showScaduti } from "./viste";

// Comandi (contracts/comandi.md).

export interface ParsedCommand {
  name: string;
  personId?: number;
  // Testo dopo il comando, senza spazi ai bordi (research R-10 di 003).
  args: string;
}

const PERSON_RE = /^p_(\d+)$/;

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/")) return null;
  const token = trimmed.slice(1).split(/\s+/, 1)[0] ?? "";
  const name = (token.split("@", 1)[0] ?? "").toLowerCase();
  const args = trimmed.slice(1 + token.length).trim();
  const m = PERSON_RE.exec(name);
  if (m) return { name: "p", personId: Number(m[1]), args };
  return { name, args };
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

// RF-19: /gruppi [nome] e l'alias /gruppo sono lo stesso handler.
const gruppi: CommandHandler = (ctx, cmd) => handleGruppiCommand(ctx, cmd.args);

export const COMMANDS: Record<string, CommandHandler> = {
  start: (ctx) => sendWelcome(ctx),
  aiuto: (ctx) => reply(ctx, T.help),
  nuovo: (ctx) => startNuovo(ctx),
  // RF-03
  p: (ctx, cmd) => showScheda(ctx, cmd.personId ?? 0),
  gruppi,
  // RF-15
  messaggio: (ctx) => startMessaggio(ctx),
  // RF-16
  oggi: (ctx) => showOggi(ctx),
  // RF-17
  prossimi: (ctx, cmd) => showProssimi(ctx, cmd.args),
  // RF-18
  cerca: (ctx, cmd) => showCerca(ctx, cmd.args),
  // RF-19
  gruppo: gruppi,
  // RF-20
  mese: (ctx, cmd) => showMese(ctx, cmd.args),
  // RF-21
  scaduti: (ctx) => showScaduti(ctx),
  // RF-22
  anno: (ctx, cmd) => showAnno(ctx, cmd.args),
  // RF-23
  modello: (ctx) => handleTemplate(ctx),
  // RF-25
  export: (ctx) => handleExport(ctx),
  // RF-26
  backup: (ctx) => handleBackup(ctx),
  ripristina: (ctx) => startRestore(ctx),
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
