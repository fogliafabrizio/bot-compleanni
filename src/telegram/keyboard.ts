import type { InlineKeyboardButton, InlineKeyboardMarkup } from "./types";

// Formato dei callback_data: contracts/callback-data.md (research R-10); ambito "t" dei messaggi
// di /oggi in specs/003-viste-ricerche/contracts/callback-data.md.

export type Callback =
  | { kind: "static"; scope: "s" | "p" | "g" | "o" | "t"; action: string; id?: number }
  | { kind: "flow"; flowId: string; action: string; arg?: string };

const MAX_BYTES = 64;
const FLOW_ID_RE = /^[0-9a-z]{6}$/;
const ACTION_RE = /^[a-z]{1,4}$/;
const ARG_RE = /^[0-9a-z]{1,20}$/;
const ID_RE = /^\d{1,15}$/;

export function encodeCallback(cb: Callback): string {
  const s =
    cb.kind === "static"
      ? [cb.scope, cb.action, ...(cb.id !== undefined ? [String(cb.id)] : [])].join(":")
      : ["f", cb.flowId, cb.action, ...(cb.arg !== undefined ? [cb.arg] : [])].join(":");
  if (new TextEncoder().encode(s).length > MAX_BYTES) throw new Error("callback_data_too_long");
  return s;
}

export function decodeCallback(data: string): Callback | null {
  const parts = data.split(":");
  const [head, second, third, fourth] = parts;
  if (head === "f") {
    if (parts.length < 3 || parts.length > 4) return null;
    if (!second || !FLOW_ID_RE.test(second) || !third || !ACTION_RE.test(third)) return null;
    if (fourth !== undefined && !ARG_RE.test(fourth)) return null;
    return fourth !== undefined
      ? { kind: "flow", flowId: second, action: third, arg: fourth }
      : { kind: "flow", flowId: second, action: third };
  }
  if (head === "s" || head === "p" || head === "g" || head === "o" || head === "t") {
    if (parts.length < 2 || parts.length > 3) return null;
    if (!second || !ACTION_RE.test(second)) return null;
    if (third === undefined) return { kind: "static", scope: head, action: second };
    if (!ID_RE.test(third)) return null;
    return { kind: "static", scope: head, action: second, id: Number(third) };
  }
  return null;
}

export function button(text: string, cb: Callback): InlineKeyboardButton {
  return { text, callback_data: encodeCallback(cb) };
}

// Solo link https:// (V-04): nessun pulsante tel: o sms:.
export function urlButton(text: string, url: string): InlineKeyboardButton {
  return { text, url };
}

// Pulsante nativo che copia un testo negli appunti (RF-11, FR-029).
export function copyButton(text: string, copied: string): InlineKeyboardButton {
  return { text, copy_text: { text: copied } };
}

export function keyboard(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup {
  return { inline_keyboard: rows.filter((r) => r.length > 0) };
}
