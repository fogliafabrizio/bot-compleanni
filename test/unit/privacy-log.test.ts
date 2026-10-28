import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertPerson } from "../helpers/db";
import { runAt } from "../helpers/cron";
import { makeCronDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press } from "../helpers/send";

// Principio V, RNF-08: i log contengono solo codici e numeri.
const SECRETS = ["Marco", "Rossi", "Marchino", "393331234567", "marco.ig", "marco_tg", "auguri", "Anna", "Bianchi", "1995", "14/03", "03-14"];

describe("principio V, RNF-08: nessun dato personale nei log", () => {
  let lines: string[] = [];
  beforeEach(() => {
    lines = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("principio V: runHourly con invii riusciti e falliti e un tocco Fatto", async () => {
    await insertPerson({
      id: 1,
      fullName: "Marco Rossi",
      nickname: "Marchino",
      day: 14,
      month: 3,
      year: 1995,
      phone: "+393331234567",
      instagram: "marco.ig",
      telegram: "marco_tg",
      priority: "alta",
      customMessage: "Tanti auguri {nome}",
    });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.includes("Anna"), 400);
    await runAt(deps, 2027, 3, 14, 9);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fatto ✅"), 100);
    expect(lines.some((l) => l.includes("cron_run"))).toBe(true);
    for (const l of lines) for (const s of SECRETS) expect(l).not.toContain(s);
  });
});
