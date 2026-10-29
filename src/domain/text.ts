import { GROUP_KEY_MIN_LENGTH } from "../config";

// Pulizia e limiti dei testi inseriti (FR-010a) e chiave di confronto (BR-14, BR-17).

export type CleanResult = { ok: true; value: string } | { ok: false; reason: "empty" | "too_long"; max: number };

export function cleanText(input: string, max: number): CleanResult {
  const value = input.trim();
  if (value.length === 0) return { ok: false, reason: "empty", max };
  // Lunghezza in code point: un'emoji vale 1. Un code point occupa 1 o 2 unità UTF-16, quindi si
  // contano solo le stringhe tra max e 2·max unità (valori lunghi dei CSV: research R-12 di 004).
  if (value.length > max && (value.length > 2 * max || [...value].length > max)) return { ok: false, reason: "too_long", max };
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

// Calcolata in TypeScript: lower() di SQLite gestisce solo ASCII. L'italiano non ha regole proprie
// di minuscolo (a differenza di turco, azero, lituano): toLowerCase() dà lo stesso risultato di
// toLocaleLowerCase("it-IT") ma senza il costo del locale, che pesa con i 2000 gruppi di un import
// (research R-12 di 004).
export function normKey(s: string): string {
  return s.trim().toLowerCase();
}

// BR-26: chiave di ricerca dei gruppi, costruita sopra searchKey (che resta quella di /cerca,
// RF-18): emoji, simboli, punteggiatura e trattini diventano spazi, restano lettere e cifre. Le
// sequenze keycap ("1️⃣") si tolgono prima: U+20E3 è un segno e sparirebbe con gli accenti,
// lasciando la cifra (research R-02). Calcolata al momento, mai salvata (FR-015).
export function groupKey(s: string): string {
  return searchKey(s.replace(/[0-9#*]\u{FE0F}?\u{20E3}/gu, " "))
    .replace(/[^\p{L}\p{Nd}]+/gu, " ")
    .trim();
}

// FR-006a: un gruppo nuovo o rinominato deve avere almeno GROUP_KEY_MIN_LENGTH lettere o cifre.
export function hasValidGroupKey(name: string): boolean {
  return groupKey(name).length >= GROUP_KEY_MIN_LENGTH;
}

// FR-005: FNV-1a a 32 bit sulle unità UTF-16, in base 36 (1–7 caratteri). Lega i pulsanti g2 al
// nome esatto mostrato: una rinomina, anche solo nelle maiuscole, li rende inerti.
export function nameHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
