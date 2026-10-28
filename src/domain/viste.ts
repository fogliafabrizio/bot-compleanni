import { MIN_BIRTH_YEAR, OUTCOME_CORRECTION_DAYS, UPCOMING_DEFAULT_DAYS, UPCOMING_MAX_DAYS } from "../config";
import { MONTHS_IT } from "../texts";
import { addDays, toDateString, type LocalDate } from "../time";
import { effectiveDate, nextBirthday } from "./date";
import { compareNames, normKey, searchKey } from "./text";

// Selezione, ordinamento e argomenti delle viste (feature 003, research R-03, R-04, R-09, R-10).
// Puro: nessun import di cloudflare:*, così il benchmark gira in Node.

export interface ListPerson {
  id: number;
  fullName: string;
  nickname: string | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
}

// Riga di una lista: data effettiva mostrata ed età (research R-04).
export interface ListRow {
  person: ListPerson;
  date: LocalDate;
  age: number | null;
}

export interface BirthdayRow extends ListRow {
  daysUntil: number;
}

export const displayName = (p: ListPerson) => p.nickname ?? p.fullName;

const byName = (a: ListRow, b: ListRow) => compareNames(displayName(a.person), displayName(b.person)) || a.person.id - b.person.id;

// Prossimo compleanno (oggi compreso) ed età che compirà.
export function nextBirthdayRow(p: ListPerson, today: LocalDate): BirthdayRow {
  const next = nextBirthday(p.birthDay, p.birthMonth, today);
  return { person: p, date: next.date, age: p.birthYear !== null ? next.year - p.birthYear : null, daysUntil: next.daysUntil };
}

// FR-002: per prossimo compleanno, poi nome visualizzato, poi id.
export function sortByNextBirthday(people: readonly ListPerson[], today: LocalDate): BirthdayRow[] {
  return people.map((p) => nextBirthdayRow(p, today)).sort((a, b) => a.daysUntil - b.daysUntil || byName(a, b));
}

// Viste storiche (/scaduti, /anno): per data effettiva, poi nome (research R-03).
export function sortByDate<R extends ListRow>(rows: readonly R[]): R[] {
  return [...rows].sort(
    (a, b) => Date.UTC(a.date.year, a.date.month - 1, a.date.day) - Date.UTC(b.date.year, b.date.month - 1, b.date.day) || byName(a, b),
  );
}

// --- /scaduti e "Segna fatto" (RF-21, BR-08) ---

// Date effettive da oggi − OUTCOME_CORRECTION_DAYS a ieri; oggi resta di /oggi.
export function pendingWindow(today: LocalDate): { from: string; to: string } {
  return { from: toDateString(addDays(today, -OUTCOME_CORRECTION_DAYS)), to: toDateString(addDays(today, -1)) };
}

export function parseDateString(s: string): LocalDate {
  const [year = 0, month = 0, day = 0] = s.split("-").map(Number);
  return { year, month, day };
}

// --- /prossimi (RF-17, FR-009…FR-011) ---

export type UpcomingArgs = { ok: true; days: number; group: string | null } | { ok: false };

// Primo token intero = giorni (1…UPCOMING_MAX_DAYS), il resto è il gruppo; altrimenti tutto è il gruppo.
export function parseUpcomingArgs(args: string): UpcomingArgs {
  const text = args.trim();
  if (text === "") return { ok: true, days: UPCOMING_DEFAULT_DAYS, group: null };
  const [first = "", ...rest] = text.split(/\s+/);
  if (!/^-?\d+$/.test(first)) return { ok: true, days: UPCOMING_DEFAULT_DAYS, group: text };
  const days = Number(first);
  if (days < 1 || days > UPCOMING_MAX_DAYS) return { ok: false };
  return { ok: true, days, group: rest.length > 0 ? rest.join(" ") : null };
}

// Compleanni da oggi a oggi + days − 1 compresi.
export function upcoming(people: readonly ListPerson[], today: LocalDate, days: number): BirthdayRow[] {
  return sortByNextBirthday(people, today).filter((r) => r.daysUntil <= days - 1);
}

// --- /cerca (RF-18, FR-012) ---

export function matchSearch(people: readonly ListPerson[], query: string): ListPerson[] {
  const key = searchKey(query.trim());
  return people.filter((p) => searchKey(p.fullName).includes(key) || (p.nickname !== null && searchKey(p.nickname).includes(key)));
}

// --- /mese (RF-20, FR-015) ---

export function parseMonth(args: string, today: LocalDate): { ok: true; month: number } | { ok: false } {
  const text = args.trim();
  if (text === "") return { ok: true, month: today.month };
  if (/^\d+$/.test(text)) {
    const month = Number(text);
    return month >= 1 && month <= 12 ? { ok: true, month } : { ok: false };
  }
  const index = (MONTHS_IT as readonly string[]).indexOf(normKey(text));
  return index >= 0 ? { ok: true, month: index + 1 } : { ok: false };
}

// Research R-04: anno corrente per il mese corrente e i successivi, altrimenti l'anno prossimo.
export function referenceYear(month: number, today: LocalDate): number {
  return month >= today.month ? today.year : today.year + 1;
}

// Persone nate nel mese, per giorno di nascita e poi nome; età nell'anno di riferimento.
export function monthRows(people: readonly ListPerson[], month: number, today: LocalDate): ListRow[] {
  const year = referenceYear(month, today);
  return people
    .filter((p) => p.birthMonth === month)
    .map((p) => ({
      person: p,
      date: effectiveDate(p.birthDay, month, year),
      age: p.birthYear !== null ? year - p.birthYear : null,
    }))
    .sort((a, b) => a.person.birthDay - b.person.birthDay || byName(a, b));
}

// --- /anno (RF-22, FR-019) ---

export function parseYear(args: string, today: LocalDate): { ok: true; year: number } | { ok: false } {
  const text = args.trim();
  if (text === "") return { ok: true, year: today.year };
  if (!/^\d{4}$/.test(text)) return { ok: false };
  const year = Number(text);
  return year >= MIN_BIRTH_YEAR && year <= today.year ? { ok: true, year } : { ok: false };
}
