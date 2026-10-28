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

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}
