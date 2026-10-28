import type { InlineKeyboardMarkup } from "./types";

// Client minimale della Bot API su fetch (research R-05). Testo semplice: nessun parse_mode.

export interface TelegramApi {
  sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardMarkup): Promise<{ message_id: number }>;
  editMessageReplyMarkup(chatId: number, messageId: number, keyboard: InlineKeyboardMarkup): Promise<void>;
  answerCallbackQuery(id: string, text?: string): Promise<void>;
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
  async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
    async sendMessage(chatId, text, keyboard) {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (keyboard) body.reply_markup = keyboard;
      const msg = await call<{ message_id: number }>("sendMessage", body);
      return { message_id: msg.message_id };
    },
    async editMessageReplyMarkup(chatId, messageId, keyboard) {
      await call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
    },
    async answerCallbackQuery(id, text) {
      const body: Record<string, unknown> = { callback_query_id: id };
      if (text !== undefined) body.text = text;
      await call("answerCallbackQuery", body);
    },
  };
}
