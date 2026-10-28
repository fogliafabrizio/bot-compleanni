import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { count, insertOccurrence, insertPerson } from "../helpers/db";
import { runAt, runScheduledAt } from "../helpers/cron";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";

// Scenari di research R-09 con ~200 persone (RNF-16). Oggi = 14/03/2027.
const PEOPLE = 200;

// Riempie fino a 200 persone con compleanni a luglio, lontani dalle date di interesse.
async function fill(already: number): Promise<void> {
  for (let i = already + 1; i <= PEOPLE; i++) {
    await insertPerson({ id: i, fullName: `Riempitivo ${i}`, day: (i % 28) + 1, month: 7, priority: "alta" });
  }
}

// Subrequest di un'esecuzione: chiamate D1 (statement e batch) + chiamate Telegram.
async function measure(deps: TestCronDeps, hour: number): Promise<number> {
  deps.counter.count = 0;
  deps.counter.batches = [];
  deps.tg.reset();
  await runAt(deps, 2027, 3, 14, hour);
  return deps.counter.count + deps.tg.calls.length;
}

function expectParamsWithinLimit(deps: TestCronDeps): void {
  for (const batch of deps.counter.batches) for (const params of batch) expect(params).toBeLessThanOrEqual(100);
}

describe("principio II, RNF-17: subrequest del ciclo orario", () => {
  it("RNF-17: ora senza invii (alle 10) = 2", async () => {
    await fill(0);
    const deps = makeCronDeps();
    expect(await measure(deps, 10)).toBe(2);
  });

  it("RNF-17: giorno tipico, 1 compleanno alle 9 = 4", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    await fill(1);
    const deps = makeCronDeps();
    expect(await measure(deps, 9)).toBe(4);
  });

  it.each([
    [5, 28],
    [8, 43],
  ])("RNF-17: alle 13, %i persone Alta per ciascuna delle date T+7, T+2, T+1, T, T−1 = %i", async (perDate, expected) => {
    const days = [21, 16, 15, 14, 13];
    let id = 0;
    for (const day of days) {
      for (let k = 0; k < perDate; k++) {
        id++;
        await insertPerson({ id, fullName: `Persona ${id}`, day, month: 3, priority: "alta" });
        if (day === 13) await insertOccurrence({ personId: id, year: 2027, effectiveDate: "2027-03-13" });
      }
    }
    await fill(id);
    const deps = makeCronDeps();
    const total = await measure(deps, 13);
    expect(total).toBe(expected);
    expect(total).toBeLessThanOrEqual(50);
    expect(deps.tg.messages()).toHaveLength(perDate * 5);
    expectParamsWithinLimit(deps);
  });

  it("RNF-17, R-05: 200 compleanni Alta alle 9 = 43, 160 in coda; reclamo ≤ 30 statement, ≤ 100 parametri", async () => {
    for (let i = 1; i <= PEOPLE; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    expect(await measure(deps, 9)).toBe(43);
    expect(await count("deliveries", "status = 'fallito' AND attempts = 0")).toBe(160);
    expect(await count("deliveries", "status = 'inviato'")).toBe(40);
    // Batch: lettura, reclamo, esito.
    expect(deps.counter.batches).toHaveLength(3);
    expect(deps.counter.batches[1]!.length).toBeLessThanOrEqual(30);
    expectParamsWithinLimit(deps);
  });
});

// Research R-12 di 004: handler scheduled completo (ciclo orario + backup mensile) il 1/03/2027.
async function measureScheduled(deps: TestCronDeps, day: number, hour: number): Promise<number> {
  deps.counter.count = 0;
  deps.counter.batches = [];
  deps.tg.reset();
  await runScheduledAt(deps, 2027, 3, day, hour);
  return deps.counter.count + deps.tg.calls.length;
}

describe("principio II, RNF-17: subrequest del cron con il backup mensile (004)", () => {
  it("R-12: 1° del mese alle 9:00, 40 promemoria + backup dovuto = 47", async () => {
    for (let i = 1; i <= PEOPLE; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: 1, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    const total = await measureScheduled(deps, 1, 9);
    expect(total).toBe(47);
    expect(total).toBeLessThanOrEqual(50);
    expect(deps.tg.documents()).toHaveLength(1);
    expectParamsWithinLimit(deps);
  });

  it("R-12: backup già inviato nel mese = 43 + 1 reclamo a vuoto = 44", async () => {
    for (let i = 1; i <= PEOPLE; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: 1, month: 3, priority: "alta" });
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2027-03:inviato', '2027-03-01T00:00:00.000Z')").run();
    const deps = makeCronDeps();
    expect(await measureScheduled(deps, 1, 9)).toBe(44);
    expect(deps.tg.documents()).toEqual([]);
  });

  it("R-12: 1° del mese prima delle 9:00 → nessuna query in più (ora senza invii = 2)", async () => {
    await fill(0);
    const deps = makeCronDeps();
    expect(await measureScheduled(deps, 1, 8)).toBe(2);
  });
});
