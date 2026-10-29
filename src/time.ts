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

// Ora locale con i minuti, per gli orari mostrati da /stato e dall'avviso di buco (RF-31, N-06,
// research R-09 di 007). toLocal resta senza minuti.
export interface LocalClock extends LocalDateTime {
  minute: number;
}

const CLOCK_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

export function toLocalClock(d: Date): LocalClock {
  const parts: Record<string, number> = {};
  for (const p of CLOCK_FORMATTER.formatToParts(d)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
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

const HOUR_MS = 3_600_000;

// Somma di giorni di calendario, indipendente dal fuso.
export function addDays(d: LocalDate, n: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toDateString(d: LocalDate): string {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

// Europe/Rome ha offset a ore intere: l'inizio dell'ora locale coincide con quello UTC (R-02).
export function floorToHour(d: Date): Date {
  return new Date(Math.floor(d.getTime() / HOUR_MS) * HOUR_MS);
}

// Istante UTC della mezzanotte locale del giorno indicato (research R-04). Si parte da UTC+1 e
// si corregge di un'ora alla volta, così anche i giorni del cambio d'ora sono esatti.
export function localDayStartUtc(d: LocalDate): Date {
  let t = Date.UTC(d.year, d.month - 1, d.day) - HOUR_MS;
  for (let i = 0; i < 3; i++) {
    const l = toLocal(new Date(t));
    const diff = daysBetween(d, l);
    if (diff === 0 && l.hour === 0) break;
    t += diff < 0 ? HOUR_MS : -HOUR_MS;
  }
  return new Date(t);
}
