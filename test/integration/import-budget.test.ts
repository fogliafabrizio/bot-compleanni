import { describe, expect, it } from "vitest";
import { T } from "../../src/texts";
import { csvOf, syntheticBackup, syntheticRows } from "../helpers/csv-fixtures";
import { insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

// Research R-12 di 004: subrequest per invocazione = chiamate D1 (statement e batch) + Telegram.
async function measure(deps: TestDeps, action: () => Promise<unknown>): Promise<number> {
  deps.counter.count = 0;
  deps.counter.batches = [];
  deps.tg.reset();
  await action();
  const total = deps.counter.count + deps.tg.calls.length;
  expect(total).toBeLessThanOrEqual(50);
  for (const batch of deps.counter.batches) for (const params of batch) expect(params).toBeLessThanOrEqual(100);
  return total;
}

// 500 righe: metà con celle lunghe (errori), metà valide con 8 gruppi nuovi di 30 caratteri.
function worstCsv(): string {
  const long = (c: string) => c.repeat(400);
  const data = Array.from({ length: 500 }, (_, i) => {
    if (i % 2 === 1) return [long("n"), long("k"), long("9"), long("t"), "", "", long("g"), long("p"), long("m")];
    const groups = Array.from({ length: 8 }, (_, j) => `Gruppo con nome lungo n. ${String(i * 8 + j).padStart(5, "0")}`);
    return [`Persona ${i}`, "", `${(i % 28) + 1}/${(Math.floor(i / 28) % 12) + 1}/1990`, "", "", "", groups.join("|"), "", ""];
  });
  return csvOf(data);
}

describe("principio II, RNF-17: subrequest di import, export e backup", () => {
  it("R-12: invio CSV di 500 righe con flusso precedente e anteprima al tetto = 36; Importa = 6", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(await measure(deps, () => sendFile(deps, "a.csv", worstCsv()))).toBe(36);
    {
      const cb = cbOf(deps.tg.lastKeyboard(), T.btnImport);
      expect(await measure(deps, () => press(deps, cb))).toBe(6);
    }
  });

  it("R-12: Annulla dell'anteprima = 4", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(syntheticRows(3)));
    {
      const cb = cbOf(deps.tg.lastKeyboard(), "Annulla");
      expect(await measure(deps, () => press(deps, cb))).toBe(4);
    }
  });

  it("R-12: /modello ≤ 3, /export ≤ 4, /backup ≤ 4 (con un flusso precedente)", async () => {
    for (let i = 1; i <= 200; i++) await insertPerson({ fullName: `Persona ${i}`, day: (i % 28) + 1, month: 5 });
    const deps = makeDeps();
    for (const [cmd, max] of [
      ["/modello", 3],
      ["/export", 4],
      ["/backup", 4],
    ] as const) {
      await say(deps, "/nuovo");
      expect(await measure(deps, () => say(deps, cmd))).toBeLessThanOrEqual(max);
    }
  });

  it("R-12: /ripristina = 4, invio del JSON = 6, Continua = 5, Sì, ripristina = 5", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(await measure(deps, () => say(deps, "/ripristina"))).toBe(4);
    const file = JSON.stringify(syntheticBackup({ persons: 200, occurrencesPerPerson: 10 }));
    expect(await measure(deps, () => sendFile(deps, "backup.json", file))).toBe(6);
    {
      const cb = cbOf(deps.tg.lastKeyboard(), T.btnContinue);
      expect(await measure(deps, () => press(deps, cb))).toBe(5);
    }
    {
      const cb = cbOf(deps.tg.lastKeyboard(), T.btnRestore);
      expect(await measure(deps, () => press(deps, cb))).toBe(5);
    }
  });
});
