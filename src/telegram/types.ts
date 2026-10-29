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
  // Documento ricevuto (contracts/telegram-file.md di 004); caption e photo non decidono il tipo (R-13).
  document?: Document;
  caption?: string;
  photo?: { file_id: string }[];
}

export interface Document {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  // Non usato per decidere il tipo del file (research R-01 di 004).
  mime_type?: string;
  file_size?: number;
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
// Voce del menu dei comandi (setMyCommands, FR-014 di 005).
export interface BotCommand {
  command: string;
  description: string;
}

export interface MessageEntity {
  type: "code" | "bot_command";
  offset: number;
  length: number;
}
