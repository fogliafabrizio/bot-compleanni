import { describe, expect, it } from "vitest";
import { STATS_BAR_WIDTH } from "../../src/config";
import { formatStatistiche, histogramLines, type StatisticheData } from "../../src/domain/statistiche";
import { MONTHS_SHORT } from "../../src/texts";

const B = "█";
const months = (m: Record<number, number>) => Array.from({ length: 12 }, (_, i) => m[i + 1] ?? 0);

const base: StatisticheData = {
  persons: { total: 112, alta: 18, media: 70, bassa: 24, senzaAnno: 23, senzaContatti: 41, senzaGruppo: 4 },
  groups: [
    { id: 2, name: "Lavoro", n: 5 },
    { id: 1, name: "Famiglia", n: 8 },
    { id: 3, name: "Beach tennis", n: 6 },
  ],
  months: months({ 1: 11, 2: 7 }),
  years: [
    { year: 2026, fatto: 87, chiuse: 100 },
    { year: 2025, fatto: 81, chiuse: 100 },
  ],
};

const texts = (d: Partial<StatisticheData>) => formatStatistiche({ ...base, ...d }).map((l) => l.text);

describe("RF-32, FR-013: histogramLines", () => {
  it("RF-32: 12 righe Gen…Dic, larghezza STATS_BAR_WIDTH al mese massimo, conteggio allineato a destra", () => {
    const lines = histogramLines(months({ 1: 11, 2: 7, 4: 1 }));
    expect(lines).toHaveLength(12);
    expect(lines.map((l) => l.slice(0, 3))).toEqual([...MONTHS_SHORT]);
    expect(lines[0]).toBe(`Gen ${B.repeat(STATS_BAR_WIDTH)} 11`);
    expect(lines[1]).toBe(`Feb ${B.repeat(6).padEnd(STATS_BAR_WIDTH)}  7`);
    expect(lines[2]).toBe(`Mar ${" ".repeat(STATS_BAR_WIDTH)}  0`);
    // Almeno un blocco per n ≥ 1: round(1 × 10 / 11) = 1.
    expect(lines[3]).toBe(`Apr ${B.padEnd(STATS_BAR_WIDTH)}  1`);
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("RF-32: almeno un blocco anche quando l'arrotondamento darebbe 0", () => {
    const lines = histogramLines(months({ 1: 100, 2: 1 }));
    expect(lines[1]).toBe(`Feb ${B.padEnd(STATS_BAR_WIDTH)}   1`);
  });

  it("RF-32: rubrica vuota → 12 righe a zero, barre vuote", () => {
    const lines = histogramLines(months({}));
    expect(lines).toHaveLength(12);
    for (const l of lines) expect(l.endsWith(`${" ".repeat(STATS_BAR_WIDTH)} 0`)).toBe(true);
  });
});

describe("RF-32, FR-013, FR-014: formatStatistiche", () => {
  it("RF-32, AFU §5.11: layout completo, istogramma in un'unica entità pre", () => {
    const lines = formatStatistiche(base);
    expect(lines.map((l) => l.text)).toEqual([
      "📊 Statistiche",
      "112 persone · Alta 18 · Media 70 · Bassa 24",
      "Gruppi: Beach tennis 6 · Famiglia 8 · Lavoro 5 · Senza gruppo 4",
      "Senza anno di nascita: 23 · Senza contatti: 41",
      "",
      "🎂 Compleanni per mese",
      histogramLines(base.months).join("\n"),
      "✅ Auguri fatti: 2026 87% · 2025 81%",
    ]);
    const hist = lines[6]!;
    expect(hist.entities).toEqual([{ type: "pre", offset: 0, length: hist.text.length }]);
    for (const [i, l] of lines.entries()) if (i !== 6) expect(l.entities).toEqual([]);
  });

  it("RF-32: 1 persona al singolare, priorità a 0 sempre presenti", () => {
    expect(texts({ persons: { ...base.persons, total: 1, alta: 0, media: 1, bassa: 0 } })[1]).toBe("1 persona · Alta 0 · Media 1 · Bassa 0");
  });

  it("RF-32: gruppi a 0 presenti; Senza gruppo solo se > 0", () => {
    const lines = texts({ groups: [{ id: 1, name: "Vuoto", n: 0 }], persons: { ...base.persons, senzaGruppo: 0 } });
    expect(lines[2]).toBe("Gruppi: Vuoto 0");
  });

  it("RF-32: nessun gruppo → «nessun gruppo» senza Senza gruppo", () => {
    expect(texts({ groups: [] })[2]).toBe("Gruppi: nessun gruppo");
  });

  it("RF-32: percentuali con Math.round, anno a 0 fatti → 0%", () => {
    const lines = texts({
      years: [
        { year: 2026, fatto: 2, chiuse: 3 },
        { year: 2025, fatto: 0, chiuse: 4 },
      ],
    });
    expect(lines.at(-1)).toBe("✅ Auguri fatti: 2026 67% · 2025 0%");
  });

  it("FR-014: senza anni con esiti → frase dedicata", () => {
    expect(texts({ years: [] }).at(-1)).toBe("✅ Auguri fatti: non ci sono ancora anni con esiti");
  });

  it("RF-32: rubrica vuota → 0 persone e 12 righe a zero", () => {
    const lines = texts({
      persons: { total: 0, alta: 0, media: 0, bassa: 0, senzaAnno: 0, senzaContatti: 0, senzaGruppo: 0 },
      groups: [],
      months: months({}),
      years: [],
    });
    expect(lines[1]).toBe("0 persone · Alta 0 · Media 0 · Bassa 0");
    expect(lines[3]).toBe("Senza anno di nascita: 0 · Senza contatti: 0");
    expect(lines[6]!.split("\n")).toHaveLength(12);
  });
});
