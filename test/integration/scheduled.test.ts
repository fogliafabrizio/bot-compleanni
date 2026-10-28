import { createExecutionContext, createScheduledController, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import worker from "../../src/index";
import { insertOccurrence, insertPerson, rows } from "../helpers/db";

describe("N-01: Cron Trigger orario", () => {
  it("N-01, RF-13: l'handler scheduled esegue il ciclo con l'ora di scheduledTime", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 12, month: 3 });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-12" });
    // 14/03/2027 alle 10 locali: nessuno slot, quindi nessun invio a Telegram (niente rete reale).
    const controller = createScheduledController({ cron: "0 * * * *", scheduledTime: Date.UTC(2027, 2, 14, 9) });
    const handler = worker as ExportedHandler<Env>;
    await handler.scheduled!(controller, env as unknown as Env, createExecutionContext());
    const [occ] = await rows<{ status: string; outcome_at: string | null }>("SELECT status, outcome_at FROM occurrences");
    expect(occ?.status).toBe("non_confermato");
    expect(occ?.outcome_at).not.toBeNull();
  });
});
