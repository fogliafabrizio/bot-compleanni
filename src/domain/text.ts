// Pulizia e limiti dei testi inseriti (FR-010a) e chiave di confronto (BR-14, BR-17).

export type CleanResult = { ok: true; value: string } | { ok: false; reason: "empty" | "too_long"; max: number };

export function cleanText(input: string, max: number): CleanResult {
  const value = input.trim();
  if (value.length === 0) return { ok: false, reason: "empty", max };
  // Lunghezza in code point: un'emoji vale 1.
  if ([...value].length > max) return { ok: false, reason: "too_long", max };
  return { ok: true, value };
}

// Calcolata in TypeScript: lower() di SQLite gestisce solo ASCII.
export function normKey(s: string): string {
  return s.trim().toLocaleLowerCase("it-IT");
}
