import type { ListLine } from "../bot/liste";
import { STATS_BAR_WIDTH } from "../config";
import { MONTHS_SHORT, T } from "../texts";
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
}

const BLOCK = "█";

// 12 righe "<Mmm> <barra> <n>": il mese massimo ha STATS_BAR_WIDTH blocchi, n ≥ 1 almeno uno,
// 0 nessuno; conteggi allineati a destra.
export function histogramLines(counts: readonly number[]): string[] {
  const max = Math.max(0, ...counts);
  const width = String(max).length;
  return MONTHS_SHORT.map((mmm, i) => {
    const n = counts[i] ?? 0;
    const blocks = n === 0 ? 0 : Math.max(1, Math.round((n * STATS_BAR_WIDTH) / max));
    return `${mmm} ${BLOCK.repeat(blocks).padEnd(STATS_BAR_WIDTH)} ${String(n).padStart(width)}`;
  });
}

const line = (text: string): ListLine => ({ text, entities: [] });

// RF-32, FR-013…FR-015: solo cifre, nessun elenco di persone. L'istogramma è una riga sola con
// un'entità pre (monospazio, come le liste di 003).
export function formatStatistiche(data: StatisticheData): ListLine[] {
  const p = data.persons;
  const groups = sortGroups(data.groups).map((g) => T.statsGroup(g.name, g.n));
  if (groups.length > 0 && p.senzaGruppo > 0) groups.push(T.statsNoGroup(p.senzaGruppo));
  const histogram = histogramLines(data.months).join("\n");
  return [
    line(T.statsTitle),
    line(T.statsPersons(p.total, p.alta, p.media, p.bassa)),
    line(T.statsGroups(groups)),
    line(T.statsMissing(p.senzaAnno, p.senzaContatti)),
    line(""),
    line(T.statsMonthsTitle),
    { text: histogram, entities: [{ type: "pre", offset: 0, length: histogram.length }] },
    line(T.statsDone(data.years.map((y) => T.statsYear(y.year, Math.round((y.fatto * 100) / y.chiuse))))),
  ];
}
