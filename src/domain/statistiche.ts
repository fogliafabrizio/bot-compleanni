import type { ListLine } from "../bot/liste";
import { MIN_BIRTH_YEAR, STATS_BAR_WIDTH } from "../config";
import type { StatsBirthRow } from "../db/statistiche";
import { AGE_BUCKET_LABELS, MONTHS_SHORT, T } from "../texts";
import { daysBetween, type LocalDate } from "../time";
import { effectiveDate } from "./date";
import { sortGroups } from "./viste";

// /statistiche (RF-32, contracts/statistiche.md, research R-08 di 007): gli aggregati arrivano da
// D1, qui solo formattazione. Puro: gira nel benchmark in Node.

export interface StatisticheData {
  persons: {
    total: number;
    alta: number;
    media: number;
    bassa: number;
    senzaAnno: number;
    senzaContatti: number;
    senzaGruppo: number;
  };
  // Una persona in più gruppi conta in ciascuno.
  groups: readonly { id: number; name: string; n: number }[];
  // 12 conteggi, gennaio…dicembre.
  months: readonly number[];
  // Anni con almeno un'occorrenza chiusa, dal più recente.
  years: readonly { year: number; fatto: number; chiuse: number }[];
  // Sezione Età (RF-32 v1.2): persone con anno di nascita e data di oggi.
  births: readonly StatsBirthRow[];
  today: LocalDate;
}

const BLOCK = "█";

type BarRow = (label: string, bar: string, n: number, width: number) => string;

const defaultRow: BarRow = (label, bar, n, width) => `${label} ${bar.padEnd(STATS_BAR_WIDTH)} ${String(n).padStart(width)}`;

// Una riga "<etichetta> <barra> <n>" per conteggio: il massimo ha STATS_BAR_WIDTH blocchi, n ≥ 1
// almeno uno, 0 nessuno; conteggi allineati a destra.
export function barLines(labels: readonly string[], counts: readonly number[], row: BarRow = defaultRow): string[] {
  const max = Math.max(0, ...counts);
  const width = String(max).length;
  return labels.map((label, i) => {
    const n = counts[i] ?? 0;
    const blocks = n === 0 ? 0 : Math.max(1, Math.round((n * STATS_BAR_WIDTH) / max));
    return row(label, BLOCK.repeat(blocks), n, width);
  });
}

// 12 righe "<Mmm> <barra> <n>".
export function histogramLines(counts: readonly number[]): string[] {
  return barLines(MONTHS_SHORT, counts);
}

// --- Sezione Età (RF-32, BR-03 per /statistiche, BR-04, FR-010…FR-015, research R-07 di 009) ---

// BR-02, FR-026a: un anno fuori intervallo conta come "senza anno", senza toccare il dato.
export function isValidBirthYear(year: number, today: LocalDate): boolean {
  return year >= MIN_BIRTH_YEAR && year <= today.year;
}

// Età compiuta oggi; il 29/02 si compie il 28/02 negli anni non bisestili (BR-04). Minimo 0.
export function currentAge(day: number, month: number, year: number, today: LocalDate): number {
  const notYet = daysBetween(today, effectiveDate(day, month, today.year)) > 0 ? 1 : 0;
  return Math.max(0, today.year - year - notYet);
}

const AGE_BUCKETS = AGE_BUCKET_LABELS.length;

// Fascia di un'età: 0-9 … 70-79, poi 80+ (anche ≥ 120).
const bucketIndex = (age: number) => Math.min(Math.floor(age / 10), AGE_BUCKETS - 1);

// FR-012: conteggi dalla fascia minima alla massima non vuota, intermedie a 0; [] senza età.
export function ageBuckets(ages: readonly number[]): number[] {
  if (ages.length === 0) return [];
  const counts = Array.from({ length: AGE_BUCKETS }, () => 0);
  for (const a of ages) counts[bucketIndex(a)]!++;
  return counts.slice(bucketIndex(Math.min(...ages)), bucketIndex(Math.max(...ages)) + 1);
}

// FR-013: le età sono ≥ 0, quindi Math.round porta 0,5 per eccesso.
export function averageAge(ages: readonly number[]): number {
  return Math.round(ages.reduce((s, a) => s + a, 0) / ages.length);
}

// Titolo, istogramma in un'entità pre e riga dell'età media fuori dal blocco; nessun nome.
export function ageSectionLines(ages: readonly number[], withoutYear: number): ListLine[] {
  if (ages.length === 0) return [line(T.statsAgeTitle), line(T.statsAgeUnavailable)];
  const counts = ageBuckets(ages);
  const first = bucketIndex(Math.min(...ages));
  const histogram = barLines(AGE_BUCKET_LABELS.slice(first, first + counts.length), counts, T.statsAgeRow).join("\n");
  return [line(T.statsAgeTitle), preLine(histogram), line(T.statsAgeAverage(averageAge(ages), withoutYear))];
}

const line = (text: string): ListLine => ({ text, entities: [] });
const preLine = (text: string): ListLine => ({ text, entities: [{ type: "pre", offset: 0, length: text.length }] });

// RF-32, FR-013…FR-015: solo cifre, nessun elenco di persone. Gli istogrammi sono righe sole con
// un'entità pre (monospazio, come le liste di 003).
export function formatStatistiche(data: StatisticheData): ListLine[] {
  const p = data.persons;
  const groups = sortGroups(data.groups).map((g) => T.statsGroup(g.name, g.n));
  if (groups.length > 0 && p.senzaGruppo > 0) groups.push(T.statsNoGroup(p.senzaGruppo));
  const ages = data.births
    .filter((b) => isValidBirthYear(b.birth_year, data.today))
    .map((b) => currentAge(b.birth_day, b.birth_month, b.birth_year, data.today));
  return [
    line(T.statsTitle),
    line(T.statsPersons(p.total, p.alta, p.media, p.bassa)),
    line(T.statsGroups(groups)),
    line(T.statsMissing(p.senzaAnno, p.senzaContatti)),
    line(""),
    line(T.statsMonthsTitle),
    preLine(histogramLines(data.months).join("\n")),
    line(""),
    // FR-026, FR-026a: senza anno = NULL e anni fuori da BR-02.
    ...ageSectionLines(ages, p.total - ages.length),
    line(T.statsDone(data.years.map((y) => T.statsYear(y.year, Math.round((y.fatto * 100) / y.chiuse))))),
  ];
}
