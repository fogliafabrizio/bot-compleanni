import { MIN_BIRTH_YEAR } from "../config";
import { MONTHS_IT } from "../texts";
import { daysBetween, isLeapYear, type LocalDate } from "../time";

// Data di nascita (RF-02, BR-01, BR-02, BR-04, research R-08).

export interface BirthDate {
  day: number;
  month: number;
  year: number | null;
}

const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;

function daysInMonth(month: number, year: number | null): number {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseBirthDate(input: string, today: LocalDate): ({ ok: true } & BirthDate) | { ok: false } {
  const m = DATE_RE.exec(input.trim());
  if (!m) return { ok: false };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3] !== undefined ? Number(m[3]) : null;
  if (month < 1 || month > 12) return { ok: false };
  if (day < 1 || day > daysInMonth(month, year)) return { ok: false };
  if (year !== null && (year < MIN_BIRTH_YEAR || year > today.year)) return { ok: false };
  return { ok: true, day, month, year };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatLong(d: BirthDate): string {
  const base = `${d.day} ${MONTHS_IT[d.month - 1]}`;
  return d.year === null ? base : `${base} ${d.year}`;
}

export function formatShort(d: BirthDate): string {
  const base = `${pad(d.day)}/${pad(d.month)}`;
  return d.year === null ? base : `${base}/${d.year}`;
}

// BR-04: negli anni non bisestili il 29/02 si festeggia il 28/02.
export function effectiveDate(day: number, month: number, year: number): LocalDate {
  if (day === 29 && month === 2 && !isLeapYear(year)) return { year, month: 2, day: 28 };
  return { year, month, day };
}

export function nextBirthday(day: number, month: number, today: LocalDate): { year: number; date: LocalDate; daysUntil: number } {
  let date = effectiveDate(day, month, today.year);
  let daysUntil = daysBetween(today, date);
  if (daysUntil < 0) {
    date = effectiveDate(day, month, today.year + 1);
    daysUntil = daysBetween(today, date);
  }
  return { year: date.year, date, daysUntil };
}
