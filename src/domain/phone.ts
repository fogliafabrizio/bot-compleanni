import { PHONE_DEFAULT_PREFIX } from "../config";

// BR-15: forma E.164 salvata, unica regola di validità per numeri scritti e da contatto.
const E164_RE = /^\+\d{8,15}$/;

// BR-15, FR-009: salvato in E.164; senza prefisso si assume quello di default.
export function normalizePhone(input: string): { ok: true; value: string } | { ok: false } {
  let s = input.replace(/[\s.-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  else if (!s.startsWith("+")) s = `${PHONE_DEFAULT_PREFIX}${s}`;
  return E164_RE.test(s) ? { ok: true, value: s } : { ok: false };
}

// BR-25 (FR-009 di 006): numero di un contatto condiviso, poi validato con BR-15. Solo per i
// contatti: i numeri scritti a mano e importati restano su normalizePhone (FR-014).
export function normalizeContactPhone(
  raw: string | undefined,
): { ok: true; value: string } | { ok: false; reason: "missing" | "invalid" } {
  if (raw === undefined || raw.trim() === "") return { ok: false, reason: "missing" };
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  let s: string;
  if (plus) s = `+${digits}`;
  else if (digits.startsWith("00")) s = `+${digits.slice(2)}`;
  else if (digits.length === 9 || digits.length === 10) s = `${PHONE_DEFAULT_PREFIX}${digits}`;
  else if (digits.length >= 11) s = `+${digits}`;
  else return { ok: false, reason: "invalid" };
  return E164_RE.test(s) ? { ok: true, value: s } : { ok: false, reason: "invalid" };
}
