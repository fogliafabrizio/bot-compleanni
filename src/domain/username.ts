// BR-16: username salvato senza "@" iniziale.
export function normalizeUsername(input: string): { ok: true; value: string } | { ok: false } {
  const trimmed = input.trim();
  const value = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  return value.length > 0 ? { ok: true, value } : { ok: false };
}

// FR-002 di 006: username utilizzabili nei link ig.me / t.me; gli altri restano salvati ma senza
// pulsante (research R-07).
export function isInstagramLinkable(u: string): boolean {
  return /^[A-Za-z0-9._]{1,30}$/.test(u);
}

export function isTelegramLinkable(u: string): boolean {
  return /^[A-Za-z0-9_]{5,32}$/.test(u);
}
