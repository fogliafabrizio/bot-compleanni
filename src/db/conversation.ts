import { CONVERSATION_TTL_HOURS, FLOW_ID_LENGTH } from "../config";
import { addHours, toIso } from "../time";

// Stato dei flussi guidati in D1, una riga per chat (research R-09, A-04).

export const FLOW_NAMES = ["nuovo", "modifica", "elimina", "gruppi", "messaggio"] as const;
export type FlowName = (typeof FLOW_NAMES)[number];

export interface ConversationState {
  chatId: number;
  flow: FlowName;
  step: string;
  flowId: string;
  data: unknown;
  expiresAt: string;
}

interface Row {
  chat_id: number;
  flow: string;
  step: string;
  flow_id: string;
  data: string;
  expires_at: string;
}

function isFlowName(s: string): s is FlowName {
  return (FLOW_NAMES as readonly string[]).includes(s);
}

function newFlowId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FLOW_ID_LENGTH));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

function expiry(now: Date): string {
  return toIso(addHours(now, CONVERSATION_TTL_HOURS));
}

// Uno stato scaduto o con un flusso sconosciuto è trattato come assente e cancellato.
export async function getActive(db: D1Database, chatId: number, now: Date): Promise<ConversationState | null> {
  const row = await db.prepare("SELECT * FROM conversation_state WHERE chat_id = ?").bind(chatId).first<Row>();
  if (!row) return null;
  if (row.expires_at <= toIso(now) || !isFlowName(row.flow)) {
    await clear(db, chatId);
    return null;
  }
  return {
    chatId: row.chat_id,
    flow: row.flow,
    step: row.step,
    flowId: row.flow_id,
    data: JSON.parse(row.data) as unknown,
    expiresAt: row.expires_at,
  };
}

export async function start(
  db: D1Database,
  chatId: number,
  flow: FlowName,
  step: string,
  data: unknown,
  now: Date,
): Promise<ConversationState> {
  const state: ConversationState = { chatId, flow, step, flowId: newFlowId(), data, expiresAt: expiry(now) };
  await db
    .prepare(
      `INSERT INTO conversation_state (chat_id, flow, step, flow_id, data, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET flow = excluded.flow, step = excluded.step, flow_id = excluded.flow_id,
         data = excluded.data, expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    )
    .bind(chatId, flow, step, state.flowId, JSON.stringify(data), state.expiresAt, toIso(now))
    .run();
  return state;
}

// Salva step e dati e rinnova la scadenza.
export async function update(db: D1Database, state: ConversationState, now: Date): Promise<ConversationState> {
  const next = { ...state, expiresAt: expiry(now) };
  await db
    .prepare(
      "UPDATE conversation_state SET step = ?, data = ?, expires_at = ?, updated_at = ? WHERE chat_id = ? AND flow_id = ?",
    )
    .bind(next.step, JSON.stringify(next.data), next.expiresAt, toIso(now), next.chatId, next.flowId)
    .run();
  return next;
}

export async function clear(db: D1Database, chatId: number): Promise<void> {
  await db.prepare("DELETE FROM conversation_state WHERE chat_id = ?").bind(chatId).run();
}

// Da usare come ultimo statement di una D1.batch di salvataggio (research R-11).
export function consumeStatement(db: D1Database, chatId: number, flowId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM conversation_state WHERE chat_id = ? AND flow_id = ?").bind(chatId, flowId);
}

// Condizione per le scritture di dominio: richiede i parametri (chatId, flowId).
export const flowGuardSql = "EXISTS (SELECT 1 FROM conversation_state WHERE chat_id = ? AND flow_id = ?)";
