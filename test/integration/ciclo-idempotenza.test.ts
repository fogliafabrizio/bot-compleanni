import { describe, expect, it, vi } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { count, insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { localInstant, runAt } from "../helpers/cron";
import { makeCronDeps } from "../helpers/deps";

describe("N-02, RNF-10, SC-002: idempotenza del ciclo orario", () => {
  it("N-02: stessa ora eseguita due volte, un solo messaggio e una sola riga deliveries", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    await runAt(deps, 2027, 3, 14, 9);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(await count("deliveries")).toBe(1);
    expect(await count("deliveries", "status = 'inviato' AND telegram_message_id = 100")).toBe(1);
  });

  it("N-02: due esecuzioni sovrapposte con lo stesso scheduledAt → un solo messaggio", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    const at = localInstant(2027, 3, 14, 9);
    deps.setNow(at);
    await Promise.all([runHourly(deps, at), runHourly(deps, at)]);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(await count("deliveries")).toBe(1);
  });

  it("R-08: una riga in_invio lasciata da un'esecuzione interrotta non viene mai rinviata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "in_invio", localDate: "2027-03-14" });
    const deps = makeCronDeps();
    for (const h of [9, 10, 11, 12]) await runAt(deps, 2027, 3, 14, h);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("deliveries", "status = 'in_invio'")).toBe(1);
  });
});

describe("N-06, FR-004, FR-020: registrazione di cron_last_run", () => {
  const lastRun = async () => (await rows<{ value: string }>("SELECT value FROM settings WHERE key = 'cron_last_run'"))[0]?.value;

  it("FR-020: senza riga, l'esecuzione con scheduledAt 13:03:12Z registra l'ora piena 13:00Z", async () => {
    const deps = makeCronDeps();
    const at = new Date("2026-10-29T13:03:12.000Z");
    deps.setNow(at);
    await runHourly(deps, at);
    expect(await lastRun()).toBe("2026-10-29T13:00:00.000Z");
  });

  it("FR-004: l'esecuzione dell'ora dopo aggiorna il valore; la riesecuzione della stessa ora lo lascia uguale", async () => {
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 14, { regular: false });
    expect(await lastRun()).toBe("2026-10-29T13:00:00.000Z");
    await runAt(deps, 2026, 10, 29, 15, { regular: false });
    expect(await lastRun()).toBe("2026-10-29T14:00:00.000Z");
    await runAt(deps, 2026, 10, 29, 15, { regular: false });
    expect(await lastRun()).toBe("2026-10-29T14:00:00.000Z");
  });

  it("FR-004: un'esecuzione tardiva di un'ora precedente (20:00 poi 19:00) non riporta indietro il valore", async () => {
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 20, { regular: false });
    await runAt(deps, 2026, 10, 29, 19, { regular: false });
    expect(await lastRun()).toBe("2026-10-29T19:00:00.000Z");
  });

  it("FR-004: un guasto durante gli invii lascia l'ora registrata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    deps.tg.sendMessage = async () => {
      throw new Error("rete");
    };
    const r = await runAt(deps, 2027, 3, 14, 9, { regular: false });
    expect(r).toMatchObject({ claimed: 1, failed: 1 });
    expect(await lastRun()).toBe("2027-03-14T08:00:00.000Z");
  });

  it("FR-004: un guasto della batch di lettura non registra nulla (cron_error come prima)", async () => {
    const deps = makeCronDeps();
    deps.counter.failing = true;
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    try {
      await runAt(deps, 2026, 10, 29, 14, { regular: false });
    } finally {
      spy.mockRestore();
    }
    expect(lines.map((l) => JSON.parse(l) as unknown)).toEqual([{ code: "cron_error", hour: 14 }]);
    expect(await lastRun()).toBeUndefined();
  });

  it("principio II, R-02: la registrazione viaggia nella batch di lettura (una sola chiamata D1)", async () => {
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 14, { regular: false });
    // Lettura e reclamo: due chiamate D1 come prima della feature.
    expect(deps.counter.count).toBe(2);
    expect(deps.counter.batches[0]).toHaveLength(6);
  });
});
