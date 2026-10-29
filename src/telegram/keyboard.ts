import { UPCOMING_MAX_DAYS } from "../config";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "./types";

// Formato dei callback_data: contracts/callback-data.md (research R-10); ambito "t" dei messaggi
// di /oggi in specs/003-viste-ricerche/contracts/callback-data.md; ambito versionato "g2" dei gruppi
// in specs/005-revisioni-v1-1-gruppi/contracts/callback-data.md.

export type Callback =
  | { kind: "static"; scope: "s" | "p" | "o" | "t"; action: string; id?: number }
  | { kind: "flow"; flowId: string; action: string; arg?: string }
  | { kind: "group"; action: GroupAction; groupId?: number; nameHash?: string; days?: number };

// FR-005: n = Nuovo; o, r, x = apri, rinomina, elimina (id + hash del nome); p = /prossimi (+ giorni).
export type GroupAction = "n" | "o" | "r" | "x" | "p";

const MAX_BYTES = 64;
const FLOW_ID_RE = /^[0-9a-z]{6}$/;
const ACTION_RE = /^[a-z]{1,4}$/;
const ARG_RE = /^[0-9a-z]{1,20}$/;
const ID_RE = /^\d{1,15}$/;
const HASH_RE = /^[0-9a-z]{1,7}$/;
const DAYS_RE = /^\d{1,3}$/;
// Il prefisso è la versione: i pulsanti "g" di prima del rilascio non sono più riconosciuti (FR-017).
const GROUP_SCOPE = "g2";

function encodeGroup(cb: Extract<Callback, { kind: "group" }>): string {
  const fields: string[] = [GROUP_SCOPE, cb.action];
  if (cb.groupId !== undefined) fields.push(String(cb.groupId), cb.nameHash ?? "");
  if (cb.days !== undefined) fields.push(String(cb.days));
  return fields.join(":");
}

export function encodeCallback(cb: Callback): string {
  const s =
    cb.kind === "static"
      ? [cb.scope, cb.action, ...(cb.id !== undefined ? [String(cb.id)] : [])].join(":")
      : cb.kind === "group"
        ? encodeGroup(cb)
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
  if (head === GROUP_SCOPE) return decodeGroup(parts.slice(1));
  // FR-017: lo scope "g" di 001 non esiste più → null → "Questa azione non è più disponibile".
  if (head === "s" || head === "p" || head === "o" || head === "t") {
    if (parts.length < 2 || parts.length > 3) return null;
    if (!second || !ACTION_RE.test(second)) return null;
    if (third === undefined) return { kind: "static", scope: head, action: second };
    if (!ID_RE.test(third)) return null;
    return { kind: "static", scope: head, action: second, id: Number(third) };
  }
  return null;
}

// Forme ammesse: n senza campi, o|r|x con id e hash, p con id, hash e giorni; il resto → null.
function decodeGroup(fields: readonly string[]): Callback | null {
  const [action, id, hash, days] = fields;
  if (action === "n") return fields.length === 1 ? { kind: "group", action } : null;
  if (action !== "o" && action !== "r" && action !== "x" && action !== "p") return null;
  if (fields.length !== (action === "p" ? 4 : 3)) return null;
  if (!id || !ID_RE.test(id) || !hash || !HASH_RE.test(hash)) return null;
  if (action !== "p") return { kind: "group", action, groupId: Number(id), nameHash: hash };
  if (!days || !DAYS_RE.test(days)) return null;
  const n = Number(days);
  if (n < 1 || n > UPCOMING_MAX_DAYS) return null;
  return { kind: "group", action, groupId: Number(id), nameHash: hash, days: n };
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
