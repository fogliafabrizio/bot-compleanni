import { TelegramError, type TelegramApi } from "../../src/telegram/client";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "../../src/telegram/types";

export type SendCall = { method: "sendMessage"; chatId: number; text: string; keyboard?: InlineKeyboardMarkup };
export type EditCall = { method: "editMessageReplyMarkup"; chatId: number; messageId: number; keyboard: InlineKeyboardMarkup };
export type TextEditCall = {
  method: "editMessageText";
  chatId: number;
  messageId: number;
  text: string;
  keyboard?: InlineKeyboardMarkup;
};
export type AnswerCall = { method: "answerCallbackQuery"; id: string; text?: string };
export type TgCall = SendCall | EditCall | TextEditCall | AnswerCall;

// Telegram simulato: registra ogni chiamata, nessuna rete (principio X).
export class FakeTelegram implements TelegramApi {
  calls: TgCall[] = [];
  private nextMessageId = 100;
  private failures: number[] = [];
  private failRules: { predicate: (text: string) => boolean; code: number }[] = [];

  // Le prossime `times` sendMessage lanciano TelegramError(code).
  failNext(code: number, times = 1): void {
    for (let i = 0; i < times; i++) this.failures.push(code);
  }

  // Ogni sendMessage il cui testo soddisfa il predicato lancia TelegramError(code) (RNF-12).
  failWhen(predicate: (text: string) => boolean, code: number): void {
    this.failRules.push({ predicate, code });
  }

  async sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardMarkup) {
    const queued = this.failures.shift();
    if (queued !== undefined) throw new TelegramError(queued);
    const rule = this.failRules.find((r) => r.predicate(text));
    if (rule) throw new TelegramError(rule.code);
    this.calls.push(keyboard ? { method: "sendMessage", chatId, text, keyboard } : { method: "sendMessage", chatId, text });
    return { message_id: this.nextMessageId++ };
  }

  async editMessageReplyMarkup(chatId: number, messageId: number, keyboard: InlineKeyboardMarkup) {
    this.calls.push({ method: "editMessageReplyMarkup", chatId, messageId, keyboard });
  }

  async editMessageText(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboardMarkup) {
    this.calls.push(
      keyboard
        ? { method: "editMessageText", chatId, messageId, text, keyboard }
        : { method: "editMessageText", chatId, messageId, text },
    );
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

  textEdits(): TextEditCall[] {
    return this.calls.filter((c): c is TextEditCall => c.method === "editMessageText");
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

// Valore di un pulsante: callback_data, url o testo copiato.
function valueOf(b: InlineKeyboardButton): string {
  if ("callback_data" in b) return b.callback_data;
  if ("url" in b) return b.url;
  return b.copy_text.text;
}

// Bottoni di una tastiera come coppie [testo, valore].
export function buttons(kb: InlineKeyboardMarkup | undefined): [string, string][] {
  return (kb?.inline_keyboard ?? []).flat().map((b): [string, string] => [b.text, valueOf(b)]);
}

export function labels(kb: InlineKeyboardMarkup | undefined): string[] {
  return buttons(kb).map(([t]) => t);
}

function find(kb: InlineKeyboardMarkup | undefined, text: string): InlineKeyboardButton {
  const found = (kb?.inline_keyboard ?? []).flat().find((b) => b.text === text);
  if (!found) throw new Error(`bottone non trovato: ${text} in ${JSON.stringify(buttons(kb))}`);
  return found;
}

// callback_data del bottone con il testo indicato.
export function cbOf(kb: InlineKeyboardMarkup | undefined, text: string): string {
  const b = find(kb, text);
  if (!("callback_data" in b)) throw new Error(`il bottone ${text} non ha callback_data`);
  return b.callback_data;
}

export function urlOf(kb: InlineKeyboardMarkup | undefined, text: string): string {
  const b = find(kb, text);
  if (!("url" in b)) throw new Error(`il bottone ${text} non è un link`);
  return b.url;
}

export function copyOf(kb: InlineKeyboardMarkup | undefined, text: string): string {
  const b = find(kb, text);
  if (!("copy_text" in b)) throw new Error(`il bottone ${text} non è un pulsante di copia`);
  return b.copy_text.text;
}
