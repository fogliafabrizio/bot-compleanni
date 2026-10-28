import { PRE_REMINDER_HOUR, PRIORITY_PROFILES, RECOVERY_HOUR, SLOT_HOURS, type Priority } from "../config";
import { addDays, isLeapYear, toDateString, type LocalDate } from "../time";

// Pianificazione del ciclo orario (contracts/ciclo-orario.md, research R-03, R-04, R-05). Puro.

export type Kind = "pre" | "giorno" | "recupero";
export type OccurrenceStatus = "aperta" | "fatto" | "saltato" | "non_confermato";

// Un invio previsto per l'ora (T, H) su una data effettiva.
export interface Target {
  kind: Kind;
  // pre: giorni prima; giorno: ora dello slot; recupero: RECOVERY_HOUR.
  ref: number;
  date: LocalDate;
  // Anno dell'occorrenza = anno della data effettiva (BR-05).
  year: number;
  effectiveDate: string;
  // Coppie (mese, giorno) di nascita la cui data effettiva è `date` (BR-04).
  pairs: [number, number][];
}

export interface Candidate {
  id: number;
  priority: Priority;
  birthDay: number;
  birthMonth: number;
  createdAt: string;
}

export interface OccurrenceInfo {
  personId: number;
  year: number;
  status: OccurrenceStatus;
  // Esiste un invio "giorno" inviato o in_invio (BR-11).
  hasDaySend: boolean;
}

export interface NewSend {
  personId: number;
  kind: Kind;
  ref: number;
  year: number;
  effectiveDate: string;
}

// Istanti ISO che delimitano lo slot e le giornate di ieri e di oggi.
export interface SelectWindow {
  slotInstantIso: string;
  dayStartPrevIso: string;
  dayStartTodayIso: string;
}

const KIND_ORDER: Record<Kind, number> = { giorno: 0, recupero: 1, pre: 2 };

// Giorni dei pre-reminder presenti in almeno un profilo.
const PRE_DAYS = [...new Set(Object.values(PRIORITY_PROFILES).flatMap((p) => p.preReminderDays))].sort((a, b) => b - a);

// BR-04: negli anni non bisestili il 28/02 è anche il compleanno dei nati il 29/02.
export function birthPairsFor(date: LocalDate): [number, number][] {
  const pairs: [number, number][] = [[date.month, date.day]];
  if (date.month === 2 && date.day === 28 && !isLeapYear(date.year)) pairs.push([2, 29]);
  return pairs;
}

function target(kind: Kind, ref: number, date: LocalDate): Target {
  return { kind, ref, date, year: date.year, effectiveDate: toDateString(date), pairs: birthPairsFor(date) };
}

// R-03: solo gli invii previsti esattamente per l'ora H del giorno T.
export function planTargets(T: LocalDate, H: number): Target[] {
  const targets: Target[] = [];
  if ((SLOT_HOURS as readonly number[]).includes(H)) targets.push(target("giorno", H, T));
  if (H === RECOVERY_HOUR) targets.push(target("recupero", RECOVERY_HOUR, addDays(T, -1)));
  if (H === PRE_REMINDER_HOUR) for (const n of PRE_DAYS) targets.push(target("pre", n, addDays(T, n)));
  return targets;
}

function admitted(c: Candidate, t: Target, occ: OccurrenceInfo | undefined, w: SelectWindow): boolean {
  if (occ && occ.status !== "aperta") return false;
  const profile = PRIORITY_PROFILES[c.priority];
  switch (t.kind) {
    case "giorno":
      return profile.slots.includes(t.ref) && c.createdAt <= w.slotInstantIso;
    case "pre":
      return profile.preReminderDays.includes(t.ref) && c.createdAt <= w.slotInstantIso;
    case "recupero":
      // BR-11 (research R-04): prima di D sempre; durante D solo se un reminder è partito.
      if (c.createdAt < w.dayStartPrevIso) return true;
      return c.createdAt < w.dayStartTodayIso && occ?.hasDaySend === true;
  }
}

export function selectNew(
  candidates: readonly Candidate[],
  occurrences: readonly OccurrenceInfo[],
  targets: readonly Target[],
  w: SelectWindow,
): NewSend[] {
  const occByKey = new Map(occurrences.map((o) => [`${o.personId}:${o.year}`, o]));
  const out: NewSend[] = [];
  for (const t of targets) {
    for (const c of candidates) {
      if (!t.pairs.some(([m, d]) => m === c.birthMonth && d === c.birthDay)) continue;
      if (!admitted(c, t, occByKey.get(`${c.id}:${t.year}`), w)) continue;
      out.push({ personId: c.id, kind: t.kind, ref: t.ref, year: t.year, effectiveDate: t.effectiveDate });
    }
  }
  return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.personId - b.personId);
}

// R-05: i primi `cap` nuovi si inviano, gli altri vanno in coda; i retry usano i posti rimasti.
export function splitByCap<T, R>(items: readonly T[], cap: number, retries: readonly R[]): { claim: T[]; queue: T[]; retryClaim: R[] } {
  const claim = items.slice(0, cap);
  return { claim, queue: items.slice(cap), retryClaim: retries.slice(0, Math.max(0, cap - claim.length)) };
}
