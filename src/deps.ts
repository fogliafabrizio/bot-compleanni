import type { TelegramApi } from "./telegram/client";

// Dipendenze iniettate: D1, Telegram e orologio (research R-06).
export interface Deps {
  db: D1Database;
  tg: TelegramApi;
  now: () => Date;
  ownerId: string;
}

// Dipendenze del ciclo orario: pausa tra gli invii (research R-06), no-op nei test.
export interface CronDeps extends Deps {
  sleep(ms: number): Promise<void>;
}
