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

// Backup mensile (RF-27, contracts/backup-mensile.md): valore "AAAA-MM:<stato>".
export const AUTO_BACKUP_KEY = "auto_backup";

// FR-023: un solo statement reclama il mese; solo chi ottiene la riga invia (principio VII).
export async function claimAutoBackup(db: D1Database, month: string, nowIso: string): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ? || ':in_invio', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
         WHERE settings.value NOT IN (? || ':in_invio', ? || ':inviato')
       RETURNING value`,
    )
    .bind(AUTO_BACKUP_KEY, month, nowIso, month, month)
    .first();
  return row !== null;
}

export async function setAutoBackupResult(db: D1Database, month: string, result: "inviato" | "fallito", nowIso: string): Promise<void> {
  await db
    .prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = ?")
    .bind(`${month}:${result}`, nowIso, AUTO_BACKUP_KEY)
    .run();
}
