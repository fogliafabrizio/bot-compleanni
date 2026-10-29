import { sendBackup } from "../bot/backup";
import { AUTO_BACKUP_DAY, AUTO_BACKUP_HOUR } from "../config";
import { claimAutoBackup, setAutoBackupResult } from "../db/settings";
import type { CronDeps } from "../deps";
import { log } from "../log";
import { TelegramError } from "../telegram/client";
import { toIso, toLocal } from "../time";

// Backup automatico mensile (RF-27, contracts/backup-mensile.md): dovuto dal giorno
// AUTO_BACKUP_DAY alle AUTO_BACKUP_HOUR locali fino a fine mese, al massimo una volta per mese
// (reclamo in D1, principio VII); su errore Telegram ritentato alle ore successive (FR-023a).
// Ogni tentativo registra istante del reclamo ed esito in auto_backup_last per /stato (RF-31,
// FR-008 di 007, contracts/ciclo-orario-v11.md). null = nulla da fare (non ancora dovuto o già reclamato).
export async function runMonthlyBackup(deps: CronDeps, scheduledAt: Date): Promise<{ sent: boolean } | null> {
  // R-02 di 002: ora locale da scheduledTime.
  const L = toLocal(scheduledAt);
  if (L.day < AUTO_BACKUP_DAY || (L.day === AUTO_BACKUP_DAY && L.hour < AUTO_BACKUP_HOUR)) return null;
  const month = `${L.year}-${String(L.month).padStart(2, "0")}`;
  const attempt = await claimAutoBackup(deps.db, month, toIso(deps.now()));
  if (!attempt) return null;
  try {
    await sendBackup(deps, Number(deps.ownerId));
  } catch (err) {
    // TelegramError → fallito, ritentato; ogni altro errore → errore, non ritentato nel mese (N-02)
    // e non propagato. In entrambi i casi l'esito è ❌ (chiarimento 4 di 007).
    const telegram = err instanceof TelegramError;
    await setAutoBackupResult(deps.db, month, telegram ? "fallito" : "errore", attempt.attemptIso, "non_riuscito", toIso(deps.now()));
    log("auto_backup", { sent: false, error_code: telegram ? err.errorCode : 0 });
    return { sent: false };
  }
  await setAutoBackupResult(deps.db, month, "inviato", attempt.attemptIso, "riuscito", toIso(deps.now()));
  log("auto_backup", { sent: true });
  return { sent: true };
}
