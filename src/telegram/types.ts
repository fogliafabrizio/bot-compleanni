// Sottoinsieme dei tipi della Bot API usato dal bot (https://core.telegram.org/bots/api).

export interface User {
  id: number;
  username?: string;
}

export interface Chat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface Message {
  message_id: number;
  from?: User;
  chat: Chat;
  text?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface CallbackQuery {
  id: string;
  from: User;
  message?: Message;
  data?: string;
}

export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
}

// Pulsante con callback, link https:// o copia nativa negli appunti (research R-10, V-04).
export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; copy_text: { text: string } };

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// Entità di formattazione passate con `entities`, senza parse_mode (contracts/liste.md). Offset e
// lunghezze in unità UTF-16, cioè String.length.
export interface MessageEntity {
  type: "code" | "bot_command";
  offset: number;
  length: number;
}
