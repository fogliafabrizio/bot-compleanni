import { describe, expect, it } from "vitest";
import { count, insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { localInstant, runAt } from "../helpers/cron";
import { makeCronDeps } from "../helpers/deps";
import { runHourly } from "../../src/cron/hourly";
import { localDayStartUtc } from "../../src/time";

interface DeliveryRow {
  status: string;
  attempts: number;
  last_error_code: number | null;
}

const delivery = async (where = "1 = 1") =>
  (await rows<DeliveryRow>(`SELECT status, attempts, last_error_code FROM deliveries WHERE ${where} ORDER BY id`))[0];

describe("N-03, N-04, RNF-10, RNF-12: retry e isolamento degli errori", () => {
  it("N-03: errore Telegram alle 9 → fallito; alle 10 reinviato", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    deps.tg.failNext(500);
    const r9 = await runAt(deps, 2027, 3, 14, 9);
    expect(r9).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
    expect(await delivery()).toEqual({ status: "fallito", attempts: 1, last_error_code: 500 });
    await runAt(deps, 2027, 3, 14, 10);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("Oggi è il compleanno di Marco Rossi");
    expect(await delivery()).toMatchObject({ status: "inviato", attempts: 2 });
  });

  it("N-03: fallisce per tutto il giorno → il giorno dopo abbandonato, mai inviato", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "bassa" });
    const deps = makeCronDeps();
    deps.tg.failWhen(() => true, 502);
    for (let h = 9; h < 24; h++) await runAt(deps, 2027, 3, 14, h);
    expect(await delivery("kind = 'giorno' AND ref = 9")).toMatchObject({ status: "fallito", attempts: 15 });
    const r0 = await runAt(deps, 2027, 3, 15, 0);
    expect(r0.abandoned).toBe(2);
    expect(await count("deliveries", "status = 'abbandonato'")).toBe(2);
    for (let h = 1; h < 13; h++) await runAt(deps, 2027, 3, 15, h);
    expect(await count("deliveries", "kind = 'giorno' AND status <> 'abbandonato'")).toBe(0);
  });

  it("N-04, FR-007: nessuna esecuzione alle 9 → alle 13 lo slot delle 9 non parte (Bassa)", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "bassa" });
    const deps = makeCronDeps();
    for (const h of [10, 11, 12, 13]) await runAt(deps, 2027, 3, 14, h);
    expect(deps.tg.messages()).toHaveLength(0);
    await runAt(deps, 2027, 3, 14, 18);
    expect(deps.tg.messages()).toHaveLength(1);
  });

  it("RNF-12, SC-006: errore su una persona → le altre ricevono il messaggio nella stessa esecuzione", async () => {
    await insertPerson({ id: 1, fullName: "Anna Bianchi", day: 14, month: 3, priority: "alta" });
    await insertPerson({ id: 2, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    await insertPerson({ id: 3, fullName: "Luca Verdi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.includes("Marco Rossi"), 400);
    const r = await runAt(deps, 2027, 3, 14, 9);
    expect(r).toMatchObject({ claimed: 3, sent: 2, failed: 1 });
    expect(deps.tg.messages().map((m) => m.text.split(",")[0])).toEqual([
      "🎂 Oggi è il compleanno di Anna Bianchi",
      "🎂 Oggi è il compleanno di Luca Verdi",
    ]);
  });

  it("R-08: retry di un'occorrenza chiusa nel frattempo → abbandonato, nessun invio", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14", status: "fatto" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "fallito", localDate: "2027-03-14" });
    const deps = makeCronDeps();
    const r = await runAt(deps, 2027, 3, 14, 10);
    expect(r.abandoned).toBe(1);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await delivery()).toMatchObject({ status: "abbandonato" });
  });

  it("R-05: 45 compleanni Alta alle 9 → 40 inviati, 5 in coda (attempts 0); alle 10 partono i 5", async () => {
    for (let i = 1; i <= 45; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    const r9 = await runAt(deps, 2027, 3, 14, 9);
    expect(r9).toMatchObject({ claimed: 40, sent: 40, queued: 5 });
    expect(deps.sleeps).toBe(39);
    expect(await count("deliveries", "status = 'fallito' AND attempts = 0 AND last_error_code IS NULL")).toBe(5);
    deps.tg.reset();
    const r10 = await runAt(deps, 2027, 3, 14, 10);
    expect(r10).toMatchObject({ claimed: 5, sent: 5 });
    expect(deps.tg.messages().map((m) => m.text)).toEqual(
      [41, 42, 43, 44, 45].map((i) => `🎂 Oggi è il compleanno di Persona ${i}`),
    );
    expect(await count("deliveries", "status = 'inviato'")).toBe(45);
  });

  it.each([
    [28, "2027-03-28T07:00:00.000Z", "2027-03-28T11:00:00.000Z"],
    [31, "2027-10-31T08:00:00.000Z", "2027-10-31T12:00:00.000Z"],
  ])("BR-24, SC-008: giorno del cambio d'ora (%i) → slot all'istante UTC corretto", async (day, at9, at13) => {
    const month = day === 28 ? 3 : 10;
    await insertPerson({ id: 1, fullName: "Marco Rossi", day, month, priority: "alta" });
    expect(localInstant(2027, month, day, 9).toISOString()).toBe(at9);
    expect(localInstant(2027, month, day, 13).toISOString()).toBe(at13);
    const deps = makeCronDeps();
    // Ogni esecuzione UTC della giornata locale (23 o 25 ore nei giorni del cambio).
    const start = localDayStartUtc({ year: 2027, month, day });
    const end = localDayStartUtc({ year: 2027, month, day: day + 1 });
    for (let t = start.getTime(); t < end.getTime(); t += 3_600_000) {
      deps.setNow(new Date(t));
      await runHourly(deps, new Date(t));
    }
    expect(deps.tg.messages()).toHaveLength(4);
    const sent = await rows<{ ref: number; sent_at: string }>("SELECT ref, sent_at FROM deliveries ORDER BY ref");
    expect(sent.find((s) => s.ref === 9)?.sent_at).toBe(at9);
    expect(sent.find((s) => s.ref === 13)?.sent_at).toBe(at13);
  });
});
