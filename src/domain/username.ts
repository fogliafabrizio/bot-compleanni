// BR-16: username salvato senza "@" iniziale.
export function normalizeUsername(input: string): { ok: true; value: string } | { ok: false } {
  const trimmed = input.trim();
  const value = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  return value.length > 0 ? { ok: true, value } : { ok: false };
}
