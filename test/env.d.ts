import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
      OWNER_TELEGRAM_ID: string;
      WEBHOOK_SECRET: string;
      TELEGRAM_BOT_TOKEN: string;
    }
  }
}
