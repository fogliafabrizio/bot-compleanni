import { handleRequest } from "./bot/webhook";
import { runScheduled } from "./cron/scheduled";
import type { CronDeps, Deps } from "./deps";
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

function makeCronDeps(env: Env): CronDeps {
  // La pausa tra gli invii non consuma CPU (research R-06).
  return { ...makeDeps(env), sleep: (ms) => scheduler.wait(ms) };
}

export default {
  fetch(request, env) {
    return handleRequest(request, makeDeps(env), env.WEBHOOK_SECRET ?? "");
  },
  async scheduled(controller, env) {
    await runScheduled(makeCronDeps(env), new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
