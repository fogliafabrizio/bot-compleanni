import { describe, expect, it } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { count, insertDelivery, insertOccurrence, insertPerson } from "../helpers/db";
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
