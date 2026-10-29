import type { BotCommand, InlineKeyboardMarkup, MessageEntity } from "./types";

// Client minimale della Bot API su fetch (research R-05). Testo semplice: nessun parse_mode; il
// monospazio delle liste passa solo per `entities` (contracts/liste.md di 003).

export interface TelegramApi {
  sendMessage(
    chatId: number,
    text: string,
    keyboard?: InlineKeyboardMarkup,
    entities?: readonly MessageEntity[],
  ): Promise<{ message_id: number }>;
  editMessageReplyMarkup(chatId: number, messageId: number, keyboard: InlineKeyboardMarkup): Promise<void>;
  // Una tastiera vuota ({ inline_keyboard: [] }) rimuove i pulsanti.
  editMessageText(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboardMarkup): Promise<void>;
  answerCallbackQuery(id: string, text?: string): Promise<void>;
  // Menu dei comandi (FR-014 di 005).
  setMyCommands(commands: readonly BotCommand[]): Promise<void>;
  // File in uscita e in ingresso (contracts/telegram-file.md di 004).
  sendDocument(
    chatId: number,
    file: { name: string; content: Uint8Array; mimeType: string },
    caption?: string,
  ): Promise<{ message_id: number }>;
  getFile(fileId: string): Promise<{ file_path: string; file_size?: number }>;
  // Il token compare solo nell'URL interno, mai negli errori (principi IV, V).
  downloadFile(filePath: string): Promise<Uint8Array>;
}

// Espone solo il codice di errore di Telegram, mai il contenuto del messaggio (principio V).
export class TelegramError extends Error {
  constructor(readonly errorCode: number) {
    super(`telegram_error_${errorCode}`);
  }
}

interface ApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
}

export function createTelegramApi(token: string, fetchFn: typeof fetch = fetch): TelegramApi {
  async function call<T>(method: string, body: Record<string, unknown> | FormData): Promise<T> {
    // Con FormData il Content-Type multipart (e il boundary) lo imposta fetch.
    const res = await fetchFn(
      `https://api.telegram.org/bot${token}/${method}`,
      body instanceof FormData
        ? { method: "POST", body }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    let data: ApiResponse<T> | undefined;
    try {
      data = (await res.json()) as ApiResponse<T>;
    } catch {
      data = undefined;
    }
    if (!res.ok || !data?.ok) throw new TelegramError(data?.error_code ?? res.status);
    return data.result as T;
  }

  return {
    async sendMessage(chatId, text, keyboard, entities) {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (keyboard) body.reply_markup = keyboard;
      if (entities && entities.length > 0) body.entities = entities;
      const msg = await call<{ message_id: number }>("sendMessage", body);
      return { message_id: msg.message_id };
    },
    async editMessageReplyMarkup(chatId, messageId, keyboard) {
      await call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
    },
    async editMessageText(chatId, messageId, text, keyboard) {
      const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
      if (keyboard) body.reply_markup = keyboard;
      await call("editMessageText", body);
    },
    async answerCallbackQuery(id, text) {
      const body: Record<string, unknown> = { callback_query_id: id };
      if (text !== undefined) body.text = text;
      await call("answerCallbackQuery", body);
    },
    async setMyCommands(commands) {
      await call("setMyCommands", { commands });
    },
    async sendDocument(chatId, file, caption) {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("document", new Blob([file.content], { type: file.mimeType }), file.name);
      if (caption !== undefined) form.append("caption", caption);
      const msg = await call<{ message_id: number }>("sendDocument", form);
      return { message_id: msg.message_id };
    },
    async getFile(fileId) {
      const f = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
      if (f.file_path === undefined) throw new TelegramError(0);
      return f.file_size !== undefined ? { file_path: f.file_path, file_size: f.file_size } : { file_path: f.file_path };
    },
    async downloadFile(filePath) {
      const res = await fetchFn(`https://api.telegram.org/file/bot${token}/${filePath}`, { method: "GET" });
      if (!res.ok) throw new TelegramError(res.status);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
