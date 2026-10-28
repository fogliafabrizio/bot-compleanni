import { handleRequest } from "./bot/webhook";
import type { Deps } from "./deps";
import type { Env } from "./env";
import { createTelegramApi } from "./telegram/client";

function makeDeps(env: Env): Deps {
  return {
    db: env.DB,
    tg: createTelegramApi(env.TELEGRAM_BOT_TOKEN ?? ""),
    // Unico punto del codice che legge l'orologio (principio VI).
    now: () => new Date(),
    // Secret mancante: nessun mittente coincide e il token del webhook fallisce (401).
    ownerId: (env.OWNER_TELEGRAM_ID ?? "").trim(),
  };
}

export default {
  fetch(request, env) {
    return handleRequest(request, makeDeps(env), env.WEBHOOK_SECRET ?? "");
  },
  async scheduled() {
    // Vuoto: verrà riempito dalla feature promemoria.
  },
} satisfies ExportedHandler<Env>;
