import { TelegramError, type TelegramApi } from "../../src/telegram/client";
import type { BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, MessageEntity } from "../../src/telegram/types";

export type SendCall = {
  method: "sendMessage";
  chatId: number;
  text: string;
  keyboard?: InlineKeyboardMarkup;
  entities?: MessageEntity[];
};
export type EditCall = { method: "editMessageReplyMarkup"; chatId: number; messageId: number; keyboard: InlineKeyboardMarkup };
export type TextEditCall = {
  method: "editMessageText";
  chatId: number;
  messageId: number;
  text: string;
  keyboard?: InlineKeyboardMarkup;
};
export type AnswerCall = { method: "answerCallbackQuery"; id: string; text?: string };
// Contenuto del documento decodificato in UTF-8 con il BOM (contracts/telegram-file.md di 004).
export type DocumentCall = { method: "sendDocument"; chatId: number; name: string; mimeType: string; text: string; caption?: string };
export type GetFileCall = { method: "getFile"; fileId: string };
export type DownloadCall = { method: "downloadFile"; filePath: string };
// Menu dei comandi (FR-014 di 005).
export type CommandsCall = { method: "setMyCommands"; commands: BotCommand[] };
export type TgCall = SendCall | EditCall | TextEditCall | AnswerCall | DocumentCall | GetFileCall | DownloadCall | CommandsCall;

type FileMethod = "sendDocument" | "getFile" | "downloadFile" | "setMyCommands";

// Telegram simulato: registra ogni chiamata, nessuna rete (principio X).
export class FakeTelegram implements TelegramApi {
  calls: TgCall[] = [];
  private nextMessageId = 100;
  private failures: number[] = [];
  private failRules: { predicate: (text: string) => boolean; code: number }[] = [];
  private fileFailures: Record<FileMethod, number[]> = { sendDocument: [], getFile: [], downloadFile: [], setMyCommands: [] };
  private files = new Map<string, { filePath: string; content: Uint8Array }>();

  // Le prossime `times` chiamate del metodo indicato lanciano TelegramError(code).
  failNextOn(method: FileMethod, code: number, times = 1): void {
    for (let i = 0; i < times; i++) this.fileFailures[method].push(code);
  }

  private maybeFail(method: FileMethod): void {
    const code = this.fileFailures[method].shift();
    if (code !== undefined) throw new TelegramError(code);
  }

  // File scaricabile con getFile + downloadFile.
  addFile(fileId: string, content: string | Uint8Array, filePath = `documents/${fileId}`): void {
    this.files.set(fileId, { filePath, content: typeof content === "string" ? new TextEncoder().encode(content) : content });
  }

  // Le prossime `times` sendMessage lanciano TelegramError(code).
  failNext(code: number, times = 1): void {
    for (let i = 0; i < times; i++) this.failures.push(code);
  }

  // Ogni sendMessage il cui testo soddisfa il predicato lancia TelegramError(code) (RNF-12).
  failWhen(predicate: (text: string) => boolean, code: number): void {
    this.failRules.push({ predicate, code });
  }

  async sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardMarkup, entities?: readonly MessageEntity[]) {
    const queued = this.failures.shift();
    if (queued !== undefined) throw new TelegramError(queued);
    const rule = this.failRules.find((r) => r.predicate(text));
    if (rule) throw new TelegramError(rule.code);
    const call: SendCall = { method: "sendMessage", chatId, text };
    if (keyboard) call.keyboard = keyboard;
    if (entities && entities.length > 0) call.entities = [...entities];
    this.calls.push(call);
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

  async sendDocument(chatId: number, file: { name: string; content: Uint8Array; mimeType: string }, caption?: string) {
    this.maybeFail("sendDocument");
    const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(file.content);
    const call: DocumentCall = { method: "sendDocument", chatId, name: file.name, mimeType: file.mimeType, text };
    if (caption !== undefined) call.caption = caption;
    this.calls.push(call);
    return { message_id: this.nextMessageId++ };
  }

  async getFile(fileId: string) {
    this.maybeFail("getFile");
    this.calls.push({ method: "getFile", fileId });
    const f = this.files.get(fileId);
    if (!f) throw new TelegramError(400);
    return { file_path: f.filePath, file_size: f.content.byteLength };
  }

  async downloadFile(filePath: string) {
    this.maybeFail("downloadFile");
    this.calls.push({ method: "downloadFile", filePath });
    for (const f of this.files.values()) if (f.filePath === filePath) return f.content;
    throw new TelegramError(404);
  }

  async setMyCommands(commands: readonly BotCommand[]) {
    this.maybeFail("setMyCommands");
    this.calls.push({ method: "setMyCommands", commands: [...commands] });
  }

  commandsSet(): CommandsCall[] {
    return this.calls.filter((c): c is CommandsCall => c.method === "setMyCommands");
  }

  documents(): DocumentCall[] {
    return this.calls.filter((c): c is DocumentCall => c.method === "sendDocument");
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
    return this.calls.flatMap((c) => ("keyboard" in c && c.keyboard ? [c.keyboard] : []));
  }

  reset(): void {
    this.calls = [];
  }
}

function covered(call: SendCall, type: MessageEntity["type"]): string[] {
  return (call.entities ?? []).filter((e) => e.type === type).map((e) => call.text.slice(e.offset, e.offset + e.length));
}

// Sottostringhe in monospazio (entità code) di un messaggio di lista.
export function monoParts(call: SendCall): string[] {
  return covered(call, "code");
}

// Sottostringhe coperte dalle entità bot_command (i /p_<id> toccabili).
export function commandParts(call: SendCall): string[] {
  return covered(call, "bot_command");
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
