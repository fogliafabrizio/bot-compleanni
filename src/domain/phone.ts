import { PHONE_DEFAULT_PREFIX } from "../config";

// BR-15, FR-009: salvato in E.164; senza prefisso si assume quello di default.
export function normalizePhone(input: string): { ok: true; value: string } | { ok: false } {
  let s = input.replace(/[\s.-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  else if (!s.startsWith("+")) s = `${PHONE_DEFAULT_PREFIX}${s}`;
  return /^\+\d{8,15}$/.test(s) ? { ok: true, value: s } : { ok: false };
}
