import { STATUS_WINDOW_DAYS } from "../config";
import { AUTO_BACKUP_LAST_KEY, CRON_LAST_RUN_KEY } from "../db/settings";
import { statoReadStatements, type AbbandonatoDbRow, type StatoCountRow } from "../db/stato";
import { formatStato, parseAutoBackupLast } from "../domain/stato";
import { log } from "../log";
import { TelegramError, type WebhookStatus } from "../telegram/client";
import type { DeliveryCounts } from "../texts";
import { addDays, floorToHour, toDateString, toIso, toLocal } from "../time";
import type { Ctx } from "./context";
import { sendLines } from "./liste";

// /stato (RF-31, contracts/stato.md): una batch D1 in parallelo a getWebhookInfo. Se la lettura
// del webhook non riesce cambia solo la sua riga (FR-012); un guasto D1 si propaga al router.
export async function showStato(ctx: Ctx): Promise<void> {
  const { db, tg } = ctx.deps;
  const now = ctx.deps.now();
  const local = toLocal(now);
  const today = toDateString(local);
  const from = toDateString(addDays(local, -(STATUS_WINDOW_DAYS - 1)));
  const [d1, wh] = await Promise.allSettled([
    db.batch(statoReadStatements(db, { today, from, hourStartIso: toIso(floorToHour(now)) })),
    tg.getWebhookInfo(),
  ]);
  if (d1.status === "rejected") throw d1.reason;

  let webhook: WebhookStatus | "non_disponibile";
  if (wh.status === "fulfilled") {
    webhook = wh.value;
  } else {
    webhook = "non_disponibile";
    // Mai il testo dell'errore nei log (principio V).
    log("webhook_info_error", { error_code: wh.reason instanceof TelegramError ? wh.reason.errorCode : 0 });
  }

  const [settingsRes, countsRes, abandonedRes] = d1.value;
  const settings = new Map(((settingsRes?.results ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const todayCounts: DeliveryCounts = { inviati: 0, falliti: 0, abbandonati: 0 };
  const week: DeliveryCounts = { inviati: 0, falliti: 0, abbandonati: 0 };
  const field = { inviato: "inviati", fallito: "falliti", abbandonato: "abbandonati" } as const;
  for (const r of (countsRes?.results ?? []) as StatoCountRow[]) {
    week[field[r.bucket]] += r.n;
    if (r.is_today === 1) todayCounts[field[r.bucket]] += r.n;
  }

  await sendLines(
    ctx,
    formatStato(
      {
        cronLastRun: settings.get(CRON_LAST_RUN_KEY) ?? null,
        autoBackupLast: parseAutoBackupLast(settings.get(AUTO_BACKUP_LAST_KEY) ?? null),
        today: todayCounts,
        week,
        abbandonati: ((abandonedRes?.results ?? []) as AbbandonatoDbRow[]).map((r) => ({
          name: r.nickname ?? r.full_name,
          kind: r.kind,
          ref: r.ref,
          localDate: r.local_date,
        })),
        webhook,
      },
      now,
    ),
  );
}
