import type { TelegramApi } from "../../src/telegram/client";
import type { InlineKeyboardMarkup } from "../../src/telegram/types";

export type SendCall = { method: "sendMessage"; chatId: number; text: string; keyboard?: InlineKeyboardMarkup };
export type EditCall = { method: "editMessageReplyMarkup"; chatId: number; messageId: number; keyboard: InlineKeyboardMarkup };
export type AnswerCall = { method: "answerCallbackQuery"; id: string; text?: string };
export type TgCall = SendCall | EditCall | AnswerCall;

// Telegram simulato: registra ogni chiamata, nessuna rete (principio X).
export class FakeTelegram implements TelegramApi {
  calls: TgCall[] = [];
  private nextMessageId = 100;

  async sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardMarkup) {
    this.calls.push(keyboard ? { method: "sendMessage", chatId, text, keyboard } : { method: "sendMessage", chatId, text });
    return { message_id: this.nextMessageId++ };
  }

  async editMessageReplyMarkup(chatId: number, messageId: number, keyboard: InlineKeyboardMarkup) {
    this.calls.push({ method: "editMessageReplyMarkup", chatId, messageId, keyboard });
  }

  async answerCallbackQuery(id: string, text?: string) {
    this.calls.push(text === undefined ? { method: "answerCallbackQuery", id } : { method: "answerCallbackQuery", id, text });
  }

  messages(): SendCall[] {
    return this.calls.filter((c): c is SendCall => c.method === "sendMessage");
  }

  lastText(): string | undefined {
    return this.messages().at(-1)?.text;
  }

  lastKeyboard(): InlineKeyboardMarkup | undefined {
    return this.messages().at(-1)?.keyboard;
  }

  edits(): EditCall[] {
    return this.calls.filter((c): c is EditCall => c.method === "editMessageReplyMarkup");
  }

  callbackAnswers(): AnswerCall[] {
    return this.calls.filter((c): c is AnswerCall => c.method === "answerCallbackQuery");
  }

  lastAnswer(): string | undefined {
    return this.callbackAnswers().at(-1)?.text;
  }

  allKeyboards(): InlineKeyboardMarkup[] {
    return this.calls.flatMap((c) => (c.method !== "answerCallbackQuery" && c.keyboard ? [c.keyboard] : []));
  }

  reset(): void {
    this.calls = [];
  }
}

// Bottoni di una tastiera come coppie [testo, callback_data].
export function buttons(kb: InlineKeyboardMarkup | undefined): [string, string][] {
  return (kb?.inline_keyboard ?? []).flat().map((b): [string, string] => [b.text, b.callback_data]);
}

export function labels(kb: InlineKeyboardMarkup | undefined): string[] {
  return buttons(kb).map(([t]) => t);
}

// callback_data del bottone con il testo indicato.
export function cbOf(kb: InlineKeyboardMarkup | undefined, text: string): string {
  const found = buttons(kb).find(([t]) => t === text);
  if (!found) throw new Error(`bottone non trovato: ${text} in ${JSON.stringify(buttons(kb))}`);
  return found[1];
}
