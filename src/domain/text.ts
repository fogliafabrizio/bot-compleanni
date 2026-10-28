// Pulizia e limiti dei testi inseriti (FR-010a) e chiave di confronto (BR-14, BR-17).

export type CleanResult = { ok: true; value: string } | { ok: false; reason: "empty" | "too_long"; max: number };

export function cleanText(input: string, max: number): CleanResult {
  const value = input.trim();
  if (value.length === 0) return { ok: false, reason: "empty", max };
  // Lunghezza in code point: un'emoji vale 1.
  if ([...value].length > max) return { ok: false, reason: "too_long", max };
  return { ok: true, value };
}

// Ordine alfabetico dei nomi di gruppo, condiviso da scheda e promemoria. Un solo Collator per
// modulo: crearlo per ogni persona costerebbe CPU (research R-09).
const COLLATOR = new Intl.Collator("it-IT", { sensitivity: "base" });

export function sortNames(names: readonly string[]): string[] {
  return [...names].sort(COLLATOR.compare);
}

// Ordine per nome delle liste (research R-03 di 003), con lo stesso Collator.
export function compareNames(a: string, b: string): number {
  return COLLATOR.compare(a, b);
}

// Chiave di /cerca senza maiuscole né accenti: "Nicolò" = "NICOLO" (research R-09 di 003).
export function searchKey(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
}

// Calcolata in TypeScript: lower() di SQLite gestisce solo ASCII.
export function normKey(s: string): string {
  return s.trim().toLocaleLowerCase("it-IT");
}
