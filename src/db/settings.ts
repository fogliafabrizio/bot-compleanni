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
