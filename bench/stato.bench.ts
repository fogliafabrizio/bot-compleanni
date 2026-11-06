import { bench, describe } from "vitest";
import { splitMessage } from "../src/bot/liste";
import { ageSectionLines, currentAge, formatStatistiche, type StatisticheData } from "../src/domain/statistiche";
import { formatStato, parseAutoBackupLast, type AbbandonatoRow, type StatoData } from "../src/domain/stato";

// Parti pure di /stato e /statistiche (RNF-17, FR-017, research R-07, R-08 di 007): ~250 invii
// nella finestra (già aggregati da D1) con 20 abbandonati; 200 persone, 20 gruppi, 12 mesi, 5 anni.
// Attesi: /stato < 1 ms, /statistiche ≈ 0,1–0,3 ms, comunque ≤ 10 ms. Sezione Età di 009 (research
// R-07): 200 date di nascita, < 0,1 ms. Solo dati sintetici.

const NOW = new Date("2026-10-29T14:20:00.000Z");
const KINDS = ["pre", "giorno", "recupero"] as const;

const abbandonati: AbbandonatoRow[] = Array.from({ length: 20 }, (_, i) => ({
  name: i % 2 === 0 ? `Nick sintetico ${i}` : `Persona Sintetica ${i}`,
  kind: KINDS[i % 3]!,
  ref: i % 3 === 0 ? 7 : 18,
  localDate: `2026-10-${String(23 + (i % 7)).padStart(2, "0")}`,
}));

const stato: StatoData = {
  cronLastRun: "2026-10-29T14:00:00.000Z",
  autoBackupLast: null,
  today: { inviati: 30, falliti: 2, abbandonati: 1 },
  week: { inviati: 228, falliti: 2, abbandonati: 20 },
  abbandonati,
  webhook: { pendingUpdateCount: 2, lastErrorDate: new Date("2026-10-29T13:00:00Z"), lastErrorMessage: "Connection timed out" },
};

const TODAY = { year: 2026, month: 10, day: 29 };
const births = Array.from({ length: 200 }, (_, i) => ({ birth_day: (i % 28) + 1, birth_month: (i % 12) + 1, birth_year: 1940 + (i % 85) }));

const statistiche: StatisticheData = {
  persons: { total: 200, alta: 40, media: 120, bassa: 40, senzaAnno: 50, senzaContatti: 30, senzaGruppo: 25 },
  groups: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Gruppo sintetico ${20 - i}`, n: (i * 7) % 40 })),
  months: [20, 15, 18, 12, 22, 16, 19, 14, 17, 21, 13, 13],
  years: [2026, 2025, 2024, 2023, 2022].map((year, i) => ({ year, fatto: 150 - i * 10, chiuse: 190 })),
  births,
  today: TODAY,
};

describe("research R-07, R-08 di 007: /stato e /statistiche", () => {
  bench("/stato: formattazione e divisione", () => {
    const backup = parseAutoBackupLast('{"at":"2026-10-01T07:00:02.114Z","esito":"riuscito"}');
    const messages = splitMessage(formatStato({ ...stato, autoBackupLast: backup }, NOW));
    if (messages.length !== 1) throw new Error("scenario non valido");
  });

  bench("sezione Età, 200 persone", () => {
    const ages = births.map((b) => currentAge(b.birth_day, b.birth_month, b.birth_year, TODAY));
    if (ageSectionLines(ages, 0).length !== 3) throw new Error("scenario non valido");
  });

  bench("/statistiche: gruppi, istogrammi e percentuali", () => {
    const messages = splitMessage(formatStatistiche(statistiche));
    if (messages.length !== 1) throw new Error("scenario non valido");
  });
});
