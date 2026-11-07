import { createExecutionContext, createScheduledController, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import worker from "../../src/index";
import { BOT_COMMANDS } from "../../src/texts";
import { runScheduledAt } from "../helpers/cron";
import { insertOccurrence, insertPerson, rows } from "../helpers/db";
import { makeCronDeps } from "../helpers/deps";

describe("N-01: Cron Trigger orario", () => {
  it("N-01, RF-13: l'handler scheduled esegue il ciclo con l'ora di scheduledTime", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 12, month: 3 });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-12" });
    // Backup mensile già inviato: l'handler non chiama Telegram (feature 004).
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2027-03:inviato', '2027-03-01T08:00:00.000Z')").run();
    // 14/03/2027 alle 10 locali: nessuno slot, quindi nessun invio a Telegram (niente rete reale).
    const controller = createScheduledController({ cron: "0 * * * *", scheduledTime: Date.UTC(2027, 2, 14, 9) });
    const handler = worker as ExportedHandler<Env>;
    await handler.scheduled!(controller, env as unknown as Env, createExecutionContext());
    const [occ] = await rows<{ status: string; outcome_at: string | null }>("SELECT status, outcome_at FROM occurrences");
    expect(occ?.status).toBe("non_confermato");
    expect(occ?.outcome_at).not.toBeNull();
  });
});

describe("RF-10, RF-28 (v1.3): esecuzioni delle 00:00 e menu dei comandi", () => {
  it("RF-10: esecuzione alle 00:00 locali con invii → reminder delle 00:00 per Alta, menu non sincronizzato nella stessa ora", async () => {
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2027-03:inviato', '2027-03-01T08:00:00.000Z')").run();
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta", createdAt: "2027-01-01T00:00:00.000Z" });
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2027, 3, 14, 0);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.commandsSet()).toEqual([]);
    expect(await rows("SELECT kind, ref, status FROM deliveries")).toEqual([{ kind: "giorno", ref: 0, status: "inviato" }]);
  });

  it("RF-28: ora senza invii → menu dei comandi registrato con incomplete", async () => {
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2027-03:inviato', '2027-03-01T08:00:00.000Z')").run();
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2027, 3, 14, 1);
    expect(deps.tg.commandsSet()).toEqual([{ method: "setMyCommands", commands: [...BOT_COMMANDS] }]);
    expect(BOT_COMMANDS.some((c) => c.command === "incomplete")).toBe(true);
  });
});
