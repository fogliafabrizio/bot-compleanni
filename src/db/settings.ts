import type { AutoBackupLast } from "../domain/stato";
import { flowGuardSql } from "./conversation";

// Tabella settings (data-model.md). Riga assente → il default resta in config.ts (principio VIII).

export const DEFAULT_MESSAGE_KEY = "default_message";

// Da usare dentro le batch di lettura.
export function defaultMessageStatement(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT value FROM settings WHERE key = ?").bind(DEFAULT_MESSAGE_KEY);
}

export async function getDefaultMessage(db: D1Database): Promise<string | null> {
  const row = await defaultMessageStatement(db).first<{ value: string }>();
  return row?.value ?? null;
}

// Salvataggio di /messaggio, protetto dalla guardia di flusso (contracts/messaggio.md).
export function saveDefaultMessageGuardedStatement(
  db: D1Database,
  chatId: number,
  flowId: string,
  value: string,
  nowIso: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) SELECT ?, ?, ? WHERE ${flowGuardSql}
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(DEFAULT_MESSAGE_KEY, value, nowIso, chatId, flowId);
}

// Menu dei comandi (FR-014, research R-10): hash del BOT_COMMANDS registrato con setMyCommands.
export const BOT_COMMANDS_KEY = "bot_commands";

export async function getBotCommandsHash(db: D1Database): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(BOT_COMMANDS_KEY).first<{ value: string }>();
  return row?.value ?? null;
}

export async function saveBotCommandsHash(db: D1Database, hash: string, nowIso: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(BOT_COMMANDS_KEY, hash, nowIso)
    .run();
}

// Backup mensile (RF-27, contracts/backup-mensile.md): valore "AAAA-MM:<stato>", stato ∈ in_invio,
// inviato, fallito, errore (errore = guasto non Telegram, non ritentato nel mese; 007 FR-008).
export const AUTO_BACKUP_KEY = "auto_backup";

// Dati tecnici v1.1 (AFU §8, research R-01 di 007): riga assente = "mai registrato".
// cron_last_run = ISO UTC dell'ora piena prevista dell'ultima esecuzione oraria (N-06, RF-31).
export const CRON_LAST_RUN_KEY = "cron_last_run";
// auto_backup_last = JSON { at: ISO del reclamo, esito } dell'ultimo tentativo di backup mensile (RF-31).
export const AUTO_BACKUP_LAST_KEY = "auto_backup_last";

// Tipi definiti nel dominio (puro), che /stato usa senza importare src/db.
export type { AutoBackupEsito, AutoBackupLast } from "../domain/stato";

// Chiavi tecniche: non entrano nel backup e il ripristino non le modifica (FR-001…FR-003 di 007).
export const TECHNICAL_KEYS = [BOT_COMMANDS_KEY, AUTO_BACKUP_KEY, CRON_LAST_RUN_KEY, AUTO_BACKUP_LAST_KEY] as const;

// N-06, FR-004, research R-02 di 007: in testa alla batch di lettura del ciclo orario, così lettura
// del valore precedente e scrittura del nuovo sono atomiche. Il valore non torna mai indietro.
export function cronLastRunStatements(
  db: D1Database,
  currentIso: string,
  nowIso: string,
): [D1PreparedStatement, D1PreparedStatement] {
  return [
    db.prepare("SELECT value FROM settings WHERE key = ?").bind(CRON_LAST_RUN_KEY),
    db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
           WHERE excluded.value > settings.value`,
      )
      .bind(CRON_LAST_RUN_KEY, currentIso, nowIso),
  ];
}

const autoBackupLastStatement = (db: D1Database, last: AutoBackupLast, nowIso: string, condition = "true", ...params: unknown[]) =>
  db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) SELECT ?, ?, ? WHERE ${condition}
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(AUTO_BACKUP_LAST_KEY, JSON.stringify(last), nowIso, ...params);

// FR-023: il primo statement reclama il mese; solo chi ottiene la riga invia (principio VII). Il
// secondo registra il tentativo (esito in_invio) solo se il reclamo è riuscito in questa batch
// (007 FR-008, research R-05). Restituisce l'istante del reclamo, o null se non c'è da inviare.
export async function claimAutoBackup(db: D1Database, month: string, nowIso: string): Promise<{ attemptIso: string } | null> {
  const [claim] = await db.batch([
    db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ? || ':in_invio', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
           WHERE settings.value NOT IN (? || ':in_invio', ? || ':inviato', ? || ':errore')
         RETURNING value`,
      )
      .bind(AUTO_BACKUP_KEY, month, nowIso, month, month, month),
    autoBackupLastStatement(
      db,
      { at: nowIso, esito: "in_invio" },
      nowIso,
      "EXISTS (SELECT 1 FROM settings WHERE key = ? AND value = ? || ':in_invio' AND updated_at = ?)",
      AUTO_BACKUP_KEY,
      month,
      nowIso,
    ),
  ]);
  return (claim?.results.length ?? 0) > 0 ? { attemptIso: nowIso } : null;
}

// Esito del tentativo: stato del mese e auto_backup_last con l'istante del reclamo (FR-008).
export async function setAutoBackupResult(
  db: D1Database,
  month: string,
  stato: "inviato" | "fallito" | "errore",
  attemptIso: string,
  esito: "riuscito" | "non_riuscito",
  nowIso: string,
): Promise<void> {
  await db.batch([
    db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = ?").bind(`${month}:${stato}`, nowIso, AUTO_BACKUP_KEY),
    autoBackupLastStatement(db, { at: attemptIso, esito }, nowIso),
  ]);
}
