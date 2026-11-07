import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { STATS_BAR_WIDTH } from "../../src/config";
import {
  ageBuckets,
  ageSectionLines,
  averageAge,
  barLines,
  currentAge,
  formatStatistiche,
  histogramLines,
  isValidBirthYear,
  type StatisticheData,
} from "../../src/domain/statistiche";
import { MISSING } from "../../src/db/incomplete";
import { statisticheReadStatements } from "../../src/db/statistiche";
import { MONTHS_SHORT } from "../../src/texts";
import type { LocalDate } from "../../src/time";

const B = "█";
const months = (m: Record<number, number>) => Array.from({ length: 12 }, (_, i) => m[i + 1] ?? 0);
const TODAY: LocalDate = { year: 2026, month: 10, day: 29 };
// Nato il 01/01 dell'anno indicato: con 2018, 1992, 1989, 1974 → 8, 34, 37, 52 anni al 29/10/2026.
const born = (year: number) => ({ birth_day: 1, birth_month: 1, birth_year: year });

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
  births: [born(2018), born(1992), born(1989), born(1974)],
  today: TODAY,
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
      "",
      "🧑 Età",
      ageSectionLines([8, 34, 37, 52], 108)[1]!.text,
      "Età media: 33 anni · senza anno di nascita: 108",
      "✅ Auguri fatti: 2026 87% · 2025 81%",
    ]);
    // Istogrammi per mese e per età: ciascuno in un'entità pre.
    for (const i of [6, 9]) {
      const hist = lines[i]!;
      expect(hist.entities).toEqual([{ type: "pre", offset: 0, length: hist.text.length }]);
    }
    for (const [i, l] of lines.entries()) if (i !== 6 && i !== 9) expect(l.entities).toEqual([]);
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

  it("RF-32, FR-010: sezione Età dopo «🎂 Compleanni per mese» e prima di «✅ Auguri fatti»", () => {
    const lines = texts({});
    const mesi = lines.indexOf("🎂 Compleanni per mese");
    const eta = lines.indexOf("🧑 Età");
    const fatti = lines.findIndex((l) => l.startsWith("✅ Auguri fatti"));
    expect(mesi).toBeGreaterThanOrEqual(0);
    expect(eta).toBe(mesi + 3);
    expect(fatti).toBeGreaterThan(eta);
  });

  it("RF-32, FR-026a: anni fuori da BR-02 contati come senza anno", () => {
    const lines = texts({ persons: { ...base.persons, total: 3 }, births: [born(1899), born(2027), born(1992)] });
    expect(lines).toContain("Età media: 34 anni · senza anno di nascita: 2");
  });

  it("RF-32, FR-014: nessun anno valido → età non disponibile", () => {
    expect(texts({ births: [] })).toContain("Età non disponibile: nessuna persona ha l'anno di nascita.");
  });
});

describe("RF-32: barLines generalizza histogramLines", () => {
  it("RF-32: istogramma per mese invariato", () => {
    const counts = months({ 1: 11, 2: 7, 4: 1 });
    expect(histogramLines(counts)).toEqual(barLines(MONTHS_SHORT, counts));
  });
});

describe("RF-32, BR-03, BR-04: currentAge e isValidBirthYear", () => {
  it.each([
    [14, 3, 1994, { year: 2026, month: 10, day: 29 }, 32],
    [14, 3, 1994, { year: 2026, month: 3, day: 10 }, 31],
    [14, 3, 1994, { year: 2026, month: 3, day: 14 }, 32],
    [29, 2, 2000, { year: 2026, month: 2, day: 28 }, 26],
    [29, 2, 2000, { year: 2026, month: 2, day: 27 }, 25],
    [30, 12, 2026, { year: 2026, month: 10, day: 29 }, 0],
  ])("BR-03, BR-04: nato il %i/%i/%i, oggi %o → %i anni", (d, m, y, today, age) => {
    expect(currentAge(d, m, y, today)).toBe(age);
  });

  it.each([
    [1899, false],
    [1900, true],
    [2026, true],
    [2027, false],
  ])("BR-02: anno %i valido = %s", (year, ok) => {
    expect(isValidBirthYear(year, TODAY)).toBe(ok);
  });
});

describe("RF-32, FR-012, FR-013: ageBuckets e averageAge", () => {
  it("FR-012: dalla fascia minima alla massima, intermedie a 0", () => {
    expect(ageBuckets([8, 34, 37, 52])).toEqual([1, 0, 0, 2, 0, 1]);
  });

  it("FR-012, FR-026a: 80+ comprende le età ≥ 80, anche ≥ 120", () => {
    expect(ageBuckets([83, 91])).toEqual([2]);
    expect(ageBuckets([126])).toEqual([1]);
    expect(ageSectionLines([83, 91], 0)[1]!.text.startsWith("80+   ")).toBe(true);
  });

  it("FR-012: nessuna età → nessuna fascia", () => {
    expect(ageBuckets([])).toEqual([]);
  });

  it.each([
    [[8, 34, 37, 52], 33],
    [[32, 33], 33],
    [[30, 34], 32],
  ])("FR-013: media di %o → %i (0,5 per eccesso)", (ages, avg) => {
    expect(averageAge(ages)).toBe(avg);
  });
});

describe("RF-32, FR-013, FR-014: ageSectionLines", () => {
  it("FR-014: senza età → titolo e «non disponibile»", () => {
    expect(ageSectionLines([], 5).map((l) => l.text)).toEqual(["🧑 Età", "Età non disponibile: nessuna persona ha l'anno di nascita."]);
  });

  it("RF-32, AFU §5.11: fasce 0-9…50-59 e sola età media con withoutYear = 0", () => {
    const lines = ageSectionLines([8, 34, 37, 52], 0);
    expect(lines.map((l) => l.text)).toEqual([
      "🧑 Età",
      [
        `0-9   ${B.repeat(5).padEnd(STATS_BAR_WIDTH)} 1`,
        `10-19 ${" ".repeat(STATS_BAR_WIDTH)} 0`,
        `20-29 ${" ".repeat(STATS_BAR_WIDTH)} 0`,
        `30-39 ${B.repeat(STATS_BAR_WIDTH)} 2`,
        `40-49 ${" ".repeat(STATS_BAR_WIDTH)} 0`,
        `50-59 ${B.repeat(5).padEnd(STATS_BAR_WIDTH)} 1`,
      ].join("\n"),
      "Età media: 33 anni",
    ]);
    expect(lines[1]!.entities).toEqual([{ type: "pre", offset: 0, length: lines[1]!.text.length }]);
    expect(lines[2]!.entities).toEqual([]);
  });

  it("FR-013: withoutYear = 23 → richiamo", () => {
    expect(ageSectionLines([32], 23).at(-1)!.text).toBe("Età media: 32 anni · senza anno di nascita: 23");
  });
});

describe("RF-32, FR-017 (v1.3): «Senza anno» e «Senza contatti» contano anche vuoti e spazi", () => {
  const ins = (id: number, year: number | string | null, ig: string | null, tg: string | null, phone: string | null = null) =>
    env.DB.prepare(
      `INSERT INTO persons (id, full_name, full_name_norm, birth_day, birth_month, birth_year, phone, instagram, telegram,
         priority, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, 'media', ?, ?)`,
    )
      .bind(id, `P${id}`, `p${id}`, year, phone, ig, tg, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")
      .run();

  it("FR-017: senza_anno e senza_contatti con NULL, '' e spazi; formato della riga invariato", async () => {
    await ins(1, null, null, null); // senza anno, senza contatti
    await ins(2, "", "  ", ""); // anno '' e contatti vuoti
    await ins(3, "  ", "marco", null); // anno di spazi, un contatto
    await ins(4, 1990, null, null, "+393331234567"); // tutto presente salvo i social
    const [first] = statisticheReadStatements(env.DB);
    const r = await first!.first<{ senza_anno: number; senza_contatti: number }>();
    expect(r).toMatchObject({ senza_anno: 3, senza_contatti: 2 });
    expect(texts({ persons: { ...base.persons, senzaAnno: r!.senza_anno, senzaContatti: r!.senza_contatti } })[3]).toBe(
      "Senza anno di nascita: 3 · Senza contatti: 2",
    );
  });

  it("FR-017: stesse condizioni di /incomplete (MISSING)", () => {
    const [first] = statisticheReadStatements(env.DB);
    expect(MISSING.anno).toBe("NULLIF(TRIM(birth_year), '') IS NULL");
    expect(first).toBeDefined();
  });
});
