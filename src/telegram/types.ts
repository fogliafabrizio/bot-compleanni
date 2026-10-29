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
  // Contatto condiviso dalla rubrica (RF-01, RF-04, research R-01 di 006).
  contact?: Contact;
}

// Solo phone_number decide qualcosa (V-08); gli altri campi sono ignorati (FR-008 di 006).
export interface Contact {
  // Obbligatorio nella Bot API; opzionale qui per il contatto senza numero (FR-009 di 006).
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
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

// Risposta grezza di getWebhookInfo (RF-31 di 007): solo i campi usati da /stato.
export interface WebhookInfo {
  pending_update_count: number;
  // Secondi Unix.
  last_error_date?: number;
  last_error_message?: string;
}

// Entità di formattazione passate con `entities`, senza parse_mode (contracts/liste.md). Offset e
// lunghezze in unità UTF-16, cioè String.length.
// Voce del menu dei comandi (setMyCommands, FR-014 di 005).
export interface BotCommand {
  command: string;
  description: string;
}

export interface MessageEntity {
  // pre: blocco monospazio dell'istogramma di /statistiche (RF-32 di 007).
  type: "code" | "bot_command" | "pre";
  offset: number;
  length: number;
}
