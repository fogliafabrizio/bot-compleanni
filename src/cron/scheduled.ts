import type { CronDeps } from "../deps";
import { log } from "../log";
import { runMonthlyBackup } from "./backup-mensile";
import { runHourly } from "./hourly";

const errorCode = (err: unknown) =>
  typeof (err as { errorCode?: unknown }).errorCode === "number" ? { error_code: (err as { errorCode: number }).errorCode } : undefined;

// Esecuzione del Cron Trigger orario (contracts/backup-mensile.md): ciclo dei promemoria, poi
// backup mensile, ciascuno isolato così il guasto dell'uno non blocca l'altro (RNF-12, principio VII).
export async function runScheduled(deps: CronDeps, scheduledAt: Date): Promise<void> {
  try {
    await runHourly(deps, scheduledAt);
  } catch (err) {
    log("cron_error", errorCode(err));
  }
  try {
    await runMonthlyBackup(deps, scheduledAt);
  } catch (err) {
    log("auto_backup_error", errorCode(err));
  }
}
