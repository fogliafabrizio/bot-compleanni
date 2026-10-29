import { describe, expect, it } from "vitest";
import { detectGap, formatStato, parseAutoBackupLast, type StatoData } from "../../src/domain/stato";
import { T } from "../../src/texts";
import { toLocalClock } from "../../src/time";

const Z = (s: string) => `2026-${s}:00:00.000Z`;

describe("N-06, FR-005: detectGap", () => {
  it.each([
    ["nessuna ora registrata", null, Z("10-29T13"), null],
    ["valore non valido", "ieri", Z("10-29T13"), null],
    ["14:00 → 15:00", Z("10-29T13"), Z("10-29T14"), null],
    ["14:00 → 16:00 (esattamente 2 h)", Z("10-29T13"), Z("10-29T15"), null],
    ["14:00 → 17:00", Z("10-29T13"), Z("10-29T16"), { from: Z("10-29T13"), to: Z("10-29T16") }],
    ["14:00 → 19:00", Z("10-29T13"), Z("10-29T18"), { from: Z("10-29T13"), to: Z("10-29T18") }],
    ["stessa ora (riesecuzione)", Z("10-29T18"), Z("10-29T18"), null],
    ["20:00 → 19:00 (esecuzione tardiva)", Z("10-29T19"), Z("10-29T18"), null],
    ["23:00 del 28/10 → 3:00 del 29/10", Z("10-28T22"), Z("10-29T02"), { from: Z("10-28T22"), to: Z("10-29T02") }],
    ["passaggio all'ora legale 1:00 CET → 3:00 CEST", Z("03-29T00"), Z("03-29T01"), null],
    ["ritorno all'ora solare 2:00 CEST → 2:00 CET", Z("10-25T00"), Z("10-25T01"), null],
  ])("N-06, FR-005: %s", (_l, last, current, expected) => {
    const gap = detectGap(last, current);
    expect(gap && { from: gap.from.toISOString(), to: gap.to.toISOString() }).toEqual(expected);
  });
});

describe("N-06, FR-006, AFU §5.12: T.gapAlert", () => {
  const today = { year: 2026, month: 10, day: 29 };
  const clock = (iso: string) => toLocalClock(new Date(iso));

  it("FR-006: stesso giorno di oggi → «dalle 14:00 alle 19:00 di oggi»", () => {
    expect(T.gapAlert(clock(Z("10-29T13")), clock(Z("10-29T18")), today)).toBe(
      "⚠️ Il controllo orario non è girato dalle 14:00 alle 19:00 di oggi:\n" +
        "alcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.",
    );
  });

  it("FR-006: giorni diversi → date GG/MM, ore senza zero iniziale", () => {
    expect(T.gapAlert(clock(Z("10-28T22")), clock(Z("10-29T02")), today)).toBe(
      "⚠️ Il controllo orario non è girato dalle 23:00 del 28/10 alle 3:00 del 29/10:\n" +
        "alcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.",
    );
  });

  it("FR-006: più giorni, ora del mattino", () => {
    expect(T.gapAlert(clock(Z("10-26T08")), clock(Z("10-29T08")), today)).toContain("dalle 9:00 del 26/10 alle 9:00 del 29/10:");
  });
});

describe("RF-31, FR-009, FR-011: formatStato", () => {
  // Adesso: 29/10/2026 alle 15:20 a Roma.
  const NOW = new Date("2026-10-29T14:20:00.000Z");
  const zero = { inviati: 0, falliti: 0, abbandonati: 0 };
  const base: StatoData = {
    cronLastRun: "2026-10-29T14:00:00.000Z",
    autoBackupLast: { at: "2026-10-01T07:00:02.114Z", esito: "riuscito" },
    today: { inviati: 3, falliti: 0, abbandonati: 0 },
    week: { inviati: 21, falliti: 0, abbandonati: 1 },
    abbandonati: [{ name: "Luca", kind: "giorno", ref: 18, localDate: "2026-10-25" }],
    webhook: { pendingUpdateCount: 0 },
  };
  const text = (d: Partial<StatoData>) => formatStato({ ...base, ...d }, NOW).map((l) => l.text);

  it("RF-31, AFU §5.10: layout completo del mockup", () => {
    expect(text({})).toEqual([
      "🩺 Stato del bot",
      "⏱ Ultimo controllo orario: oggi alle 15:00",
      "📨 Oggi: 3 inviati, 0 falliti, 0 abbandonati",
      "📨 Ultimi 7 giorni: 21 inviati, 0 falliti, 1 abbandonato",
      "   – Luca, reminder delle 18:00 del 25/10",
      "💾 Ultimo backup mensile: 01/10 alle 9:00 ✅",
      "🔗 Webhook: nessun errore, 0 update in coda",
    ]);
    for (const l of formatStato(base, NOW)) expect(l.entities).toEqual([]);
  });

  it("RF-31: controllo orario non di oggi → data; assente o non valido → mai registrato", () => {
    expect(text({ cronLastRun: "2026-10-28T22:00:00.000Z" })[1]).toBe("⏱ Ultimo controllo orario: 28/10 alle 23:00");
    expect(text({ cronLastRun: null })[1]).toBe("⏱ Ultimo controllo orario: mai registrato");
    expect(text({ cronLastRun: "rotto" })[1]).toBe("⏱ Ultimo controllo orario: mai registrato");
  });

  it("RF-31, FR-009: singolari nei conteggi; la riga dei 7 giorni ha sempre i tre conteggi", () => {
    const lines = text({ today: { inviati: 1, falliti: 1, abbandonati: 1 }, week: { inviati: 1, falliti: 1, abbandonati: 0 }, abbandonati: [] });
    expect(lines[2]).toBe("📨 Oggi: 1 inviato, 1 fallito, 1 abbandonato");
    expect(lines[3]).toBe("📨 Ultimi 7 giorni: 1 inviato, 1 fallito, 0 abbandonati");
    expect(lines[4]).toBe("💾 Ultimo backup mensile: 01/10 alle 9:00 ✅");
  });

  it("FR-009: dettaglio degli abbandonati con i tre tipi, nessuna riga se 0", () => {
    const lines = text({
      today: zero,
      week: { inviati: 0, falliti: 0, abbandonati: 3 },
      abbandonati: [
        { name: "Anna", kind: "pre", ref: 7, localDate: "2026-10-23" },
        { name: "Bruno", kind: "pre", ref: 1, localDate: "2026-10-24" },
        { name: "Carla Neri", kind: "recupero", ref: 0, localDate: "2026-10-26" },
      ],
    });
    expect(lines.slice(4, 7)).toEqual([
      "   – Anna, pre-reminder a 7 giorni del 23/10",
      "   – Bruno, pre-reminder a 1 giorno del 24/10",
      "   – Carla Neri, recupero del 26/10",
    ]);
    expect(text({ week: zero, abbandonati: [] }).some((l) => l.startsWith("   –"))).toBe(false);
  });

  it.each([
    ["riuscito", "💾 Ultimo backup mensile: 01/10 alle 9:00 ✅"],
    ["non_riuscito", "💾 Ultimo backup mensile: 01/10 alle 9:00 ❌ non riuscito"],
    ["in_invio", "💾 Ultimo backup mensile: 01/10 alle 9:00 ⚠️ esito sconosciuto"],
  ] as const)("RF-31, FR-008: backup con esito %s", (esito, line) => {
    expect(text({ autoBackupLast: { at: "2026-10-01T07:00:02.114Z", esito } })).toContain(line);
  });

  it("FR-011: backup mai registrato; parseAutoBackupLast con valori non validi → null", () => {
    expect(text({ autoBackupLast: null })).toContain("💾 Ultimo backup mensile: mai registrato");
    expect(parseAutoBackupLast(null)).toBeNull();
    expect(parseAutoBackupLast("{rotto")).toBeNull();
    expect(parseAutoBackupLast('{"at":"2026-10-01T07:00:00.000Z","esito":"boh"}')).toBeNull();
    expect(parseAutoBackupLast('{"at":"ieri","esito":"riuscito"}')).toBeNull();
    expect(parseAutoBackupLast('{"at":"2026-10-01T07:00:00.000Z","esito":"in_invio"}')).toEqual({
      at: "2026-10-01T07:00:00.000Z",
      esito: "in_invio",
    });
  });

  it("RF-31, FR-012: webhook con errore, senza errore e non disponibile", () => {
    const err = { pendingUpdateCount: 2, lastErrorDate: new Date("2026-10-29T14:00:00Z"), lastErrorMessage: "Connection timed out" };
    expect(text({ webhook: err }).at(-1)).toBe('🔗 Webhook: ultimo errore 29/10 alle 15:00: "Connection timed out", 2 update in coda');
    expect(text({ webhook: { pendingUpdateCount: 0 } }).at(-1)).toBe("🔗 Webhook: nessun errore, 0 update in coda");
    expect(text({ webhook: "non_disponibile" }).at(-1)).toBe("🔗 Webhook: non disponibile");
  });
});
