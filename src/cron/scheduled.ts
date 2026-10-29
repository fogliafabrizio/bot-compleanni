import type { CronDeps } from "../deps";
import { log } from "../log";
import { runMonthlyBackup } from "./backup-mensile";
import { syncBotCommands } from "./comandi";
import { runHourly, type RunReport } from "./hourly";

const errorCode = (err: unknown) =>
  typeof (err as { errorCode?: unknown }).errorCode === "number" ? { error_code: (err as { errorCode: number }).errorCode } : undefined;

// Esecuzione del Cron Trigger orario (contracts/backup-mensile.md): ciclo dei promemoria, backup
// mensile e menu dei comandi (FR-014 di 005), ciascuno isolato così il guasto dell'uno non blocca
// gli altri (RNF-12, principio VII). Il menu si salta se il ciclo ha reclamato invii o il backup ha
// inviato (o se uno dei due è fallito): non si somma mai al caso peggiore di subrequest (principio II).
export async function runScheduled(deps: CronDeps, scheduledAt: Date): Promise<void> {
  let report: RunReport | null = null;
  try {
    report = await runHourly(deps, scheduledAt);
  } catch (err) {
    log("cron_error", errorCode(err));
  }
  let backup: { sent: boolean } | null | undefined;
  try {
    backup = await runMonthlyBackup(deps, scheduledAt);
  } catch (err) {
    log("auto_backup_error", errorCode(err));
  }
  if (report === null || report.claimed > 0 || backup === undefined || backup?.sent) return;
  try {
    await syncBotCommands(deps);
  } catch (err) {
    log("bot_commands_error", errorCode(err));
  }
}
