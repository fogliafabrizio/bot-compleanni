import { TIMEZONE } from "./config";

// Unico punto di conversione del fuso orario (principio VI, research R-07).

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export interface LocalDateTime extends LocalDate {
  hour: number;
}

const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
});

export function toLocal(now: Date): LocalDateTime {
  const parts: Record<string, number> = {};
  for (const p of FORMATTER.formatToParts(now)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
  };
}

const DAY_MS = 86_400_000;

// Differenza su date di calendario: il cambio d'ora non sposta il conteggio.
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function addHours(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 3_600_000);
}

export function toIso(now: Date): string {
  return now.toISOString();
}
