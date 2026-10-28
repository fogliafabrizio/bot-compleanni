import type { TelegramApi } from "./telegram/client";

// Dipendenze iniettate: D1, Telegram e orologio (research R-06).
export interface Deps {
  db: D1Database;
  tg: TelegramApi;
  now: () => Date;
  ownerId: string;
}
