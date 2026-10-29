import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { MAX_SENDS_PER_RUN } from "../../src/config";
import { OWNER_ID } from "../helpers/constants";
import { localInstant, runAt, runScheduledAt } from "../helpers/cron";
import { insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";

// I test di N-06 controllano da sé l'ora registrata (nessun cron regolare simulato).
const MANUAL = { regular: false };

const ALERT_START = "⚠️ Il controllo orario non è girato";
const ALERT_TAIL = ":\nalcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.";
const isAlert = (text: string) => text.startsWith(ALERT_START);

// Ultima esecuzione registrata all'ora locale indicata (ISO UTC dell'ora piena, N-06).
async function lastRunAt(y: number, m: number, d: number, h: number): Promise<void> {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', ?, ?)")
    .bind(localInstant(y, m, d, h).toISOString(), localInstant(y, m, d, h).toISOString())
    .run();
}

const lastRun = async () => (await rows<{ value: string }>("SELECT value FROM settings WHERE key = 'cron_last_run'"))[0]?.value;

const alerts = (deps: TestCronDeps) => deps.tg.messages().filter((m) => isAlert(m.text));

function captureLogs(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  return lines;
}

describe("N-06: avviso di buco", () => {
  afterEach(() => vi.restoreAllMocks());

  it("N-06, US2-1: ultima esecuzione alle 14:00, esecuzione alle 19:00 → un avviso al proprietario", async () => {
    await lastRunAt(2026, 10, 29, 14);
    const deps = makeCronDeps();
    const r = await runAt(deps, 2026, 10, 29, 19, MANUAL);
    expect(r.gapAlert).toBe("sent");
    expect(deps.tg.messages()).toEqual([
      { method: "sendMessage", chatId: OWNER_ID, text: `${ALERT_START} dalle 14:00 alle 19:00 di oggi${ALERT_TAIL}` },
    ]);
    expect(await lastRun()).toBe(localInstant(2026, 10, 29, 19).toISOString());
  });

  it("N-06, US2-2: esecuzioni orarie consecutive → nessun avviso", async () => {
    const deps = makeCronDeps();
    for (const h of [14, 15, 16, 17]) expect((await runAt(deps, 2026, 10, 29, h, MANUAL)).gapAlert).toBe("none");
    expect(alerts(deps)).toEqual([]);
  });

  it("N-06, US2-3, FR-020: nessuna ora registrata (prima esecuzione dopo il deploy) → nessun avviso, riga creata", async () => {
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    expect(deps.tg.calls).toEqual([]);
    expect(await lastRun()).toBe(localInstant(2026, 10, 29, 19).toISOString());
  });

  it("N-06, US2-4: avviso alle 19:00, esecuzione alle 20:00 → nessun secondo avviso", async () => {
    await lastRunAt(2026, 10, 29, 14);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    await runAt(deps, 2026, 10, 29, 20, MANUAL);
    expect(alerts(deps)).toHaveLength(1);
  });

  it("N-06, US2-5, N-04, FR-007: buco 14→19 → slot delle 18 non recuperato; partono i retry della giornata", async () => {
    await insertPerson({ id: 1, fullName: "Slot Perso", day: 29, month: 10, priority: "bassa", createdAt: "2026-01-01T00:00:00.000Z" });
    await insertPerson({ id: 2, fullName: "Da Ritentare", day: 29, month: 10, priority: "bassa", createdAt: "2026-01-01T00:00:00.000Z" });
    const occ = await insertOccurrence({ personId: 2, year: 2026, effectiveDate: "2026-10-29" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "fallito", localDate: "2026-10-29" });
    await lastRunAt(2026, 10, 29, 14);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    const texts = deps.tg.messages().map((m) => m.text);
    expect(texts).toHaveLength(2);
    expect(isAlert(texts[0]!)).toBe(true);
    expect(texts[1]).toContain("Da Ritentare");
    expect(texts.some((t) => t.includes("Slot Perso"))).toBe(false);
  });

  it("N-06, US2-5, N-04: buco fino al 1° del mese alle 9:00 → avviso, invii dell'ora corrente e backup mensile dovuto", async () => {
    await insertPerson({ id: 1, fullName: "Compleanno Uno", day: 1, month: 11, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    await lastRunAt(2026, 11, 1, 3);
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2026, 11, 1, 9, MANUAL);
    const texts = deps.tg.messages().map((m) => m.text);
    expect(texts[0]).toBe(`${ALERT_START} dalle 3:00 alle 9:00 di oggi${ALERT_TAIL}`);
    expect(texts.slice(1)).toHaveLength(1);
    expect(texts[1]).toContain("Compleanno Uno");
    expect(deps.tg.documents()).toHaveLength(1);
  });

  it("N-06: esattamente 2 ore (17:00 → 19:00) → nessun avviso", async () => {
    await lastRunAt(2026, 10, 29, 17);
    const deps = makeCronDeps();
    expect((await runAt(deps, 2026, 10, 29, 19, MANUAL)).gapAlert).toBe("none");
    expect(deps.tg.calls).toEqual([]);
  });

  it("N-06, FR-006: buco a cavallo della mezzanotte → testo con le date", async () => {
    await lastRunAt(2026, 10, 28, 23);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 3, MANUAL);
    expect(deps.tg.lastText()).toBe(`${ALERT_START} dalle 23:00 del 28/10 alle 3:00 del 29/10${ALERT_TAIL}`);
  });

  it("N-06, FR-006: buco di più giorni → testo con le date", async () => {
    await lastRunAt(2026, 10, 26, 10);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 8, MANUAL);
    expect(deps.tg.lastText()).toBe(`${ALERT_START} dalle 10:00 del 26/10 alle 8:00 del 29/10${ALERT_TAIL}`);
  });

  it.each([
    ["passaggio all'ora legale (1:00 CET → 3:00 CEST)", "2026-03-29T00:00:00.000Z", "2026-03-29T01:00:00.000Z"],
    ["ritorno all'ora solare (2:00 CEST → 2:00 CET)", "2026-10-25T00:00:00.000Z", "2026-10-25T01:00:00.000Z"],
  ])("N-06, principio VI: %s → nessun avviso", async (_l, last, current) => {
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', ?, ?)").bind(last, last).run();
    const deps = makeCronDeps();
    const at = new Date(current);
    deps.setNow(at);
    expect((await runHourly(deps, at)).gapAlert).toBe("none");
    expect(deps.tg.calls).toEqual([]);
  });

  it("N-06, FR-005, FR-007: avviso prima dei promemoria e fuori dal tetto (40 invii reclamabili → claimed 40)", async () => {
    for (let i = 1; i <= MAX_SENDS_PER_RUN + 5; i++) {
      await insertPerson({ id: i, fullName: `Persona ${i}`, day: 29, month: 10, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    }
    await lastRunAt(2026, 10, 28, 20);
    const deps = makeCronDeps();
    const r = await runAt(deps, 2026, 10, 29, 9, MANUAL);
    expect(r).toMatchObject({ claimed: MAX_SENDS_PER_RUN, sent: MAX_SENDS_PER_RUN, queued: 5, gapAlert: "sent" });
    const texts = deps.tg.messages().map((m) => m.text);
    expect(texts).toHaveLength(MAX_SENDS_PER_RUN + 1);
    expect(isAlert(texts[0]!)).toBe(true);
    expect(texts.slice(1).filter(isAlert)).toEqual([]);
  });

  it("N-06, FR-007: TelegramError sull'avviso → promemoria inviati, ora aggiornata, log senza retry, nessun avviso all'ora dopo", async () => {
    const lines = captureLogs();
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 29, month: 10, priority: "bassa", createdAt: "2026-01-01T00:00:00.000Z" });
    await lastRunAt(2026, 10, 29, 3);
    const deps = makeCronDeps();
    deps.tg.failWhen(isAlert, 429);
    const r = await runAt(deps, 2026, 10, 29, 9, MANUAL);
    expect(r).toMatchObject({ gapAlert: "failed", sent: 1 });
    expect(deps.tg.messages().map((m) => m.text.split(",")[0])).toEqual(["🎂 Oggi è il compleanno di Marco Rossi"]);
    expect(await lastRun()).toBe(localInstant(2026, 10, 29, 9).toISOString());
    expect(lines.map((l) => JSON.parse(l) as { code: string }).filter((l) => l.code === "gap_alert")).toEqual([
      { code: "gap_alert", sent: false, error_code: 429 },
    ]);
    await runAt(deps, 2026, 10, 29, 10, MANUAL);
    expect(alerts(deps)).toEqual([]);
  });

  it("N-06: log gap_alert inviato con le ore del buco, senza testi", async () => {
    const lines = captureLogs();
    await lastRunAt(2026, 10, 29, 14);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    expect(lines.map((l) => JSON.parse(l) as { code: string }).filter((l) => l.code === "gap_alert")).toEqual([
      { code: "gap_alert", sent: true, hours: 5 },
    ]);
  });

  it("N-06, R-02: riesecuzione della stessa ora → nessun avviso", async () => {
    await lastRunAt(2026, 10, 29, 14);
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    await runAt(deps, 2026, 10, 29, 19, MANUAL);
    expect(alerts(deps)).toHaveLength(1);
  });

  it("N-06, FR-004: guasto durante gli invii → all'ora dopo nessun avviso", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 29, month: 10, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    const deps = makeCronDeps();
    const original = deps.tg.sendMessage.bind(deps.tg);
    deps.tg.sendMessage = async () => {
      throw new Error("rete");
    };
    await runAt(deps, 2026, 10, 29, 9, MANUAL);
    deps.tg.sendMessage = original;
    await runAt(deps, 2026, 10, 29, 10, MANUAL);
    expect(alerts(deps)).toEqual([]);
  });
});
