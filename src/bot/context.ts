import type { Deps } from "../deps";
import type { InlineKeyboardMarkup } from "../telegram/types";

// Contesto di un update del proprietario in chat privata.
export interface Ctx {
  deps: Deps;
  chatId: number;
  fromId: number;
  // Presente solo per i callback: answerCallbackQuery va chiamato una sola volta.
  callback?: { id: string; messageId?: number; answered: boolean };
}

export async function reply(ctx: Ctx, text: string, keyboard?: InlineKeyboardMarkup): Promise<void> {
  await ctx.deps.tg.sendMessage(ctx.chatId, text, keyboard);
}

export async function answerCallback(ctx: Ctx, text?: string): Promise<void> {
  if (!ctx.callback || ctx.callback.answered) return;
  ctx.callback.answered = true;
  await ctx.deps.tg.answerCallbackQuery(ctx.callback.id, text);
}
