import { describe, expect, it } from "vitest";
import { count, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

// Subrequest per un singolo update: esecuzioni D1 (statement + batch) + chiamate Telegram.
async function measure(deps: TestDeps, run: () => Promise<unknown>): Promise<{ d1: number; tg: number }> {
  deps.counter.count = 0;
  deps.tg.reset();
  await run();
  return { d1: deps.counter.count, tg: deps.tg.calls.length };
}

describe("principio II, RNF-17: budget per update", () => {
  // Valori misurati (ottobre 2026): Salva con 2 gruppi in attesa + 2 selezionati + duplicato
  // controllato = 6 D1 + 2 Telegram; /gruppi con 20 gruppi = 2 D1 + 1 Telegram.
  it("RNF-17: Salva di /nuovo nel caso peggiore ≤ 15 subrequest", async () => {
    await insertPerson({ fullName: "Altro", day: 1, month: 1 });
    await insertGroup("Famiglia");
    await insertGroup("Lavoro");
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await tap(deps, "Salta");
    await say(deps, "14/03/1994");
    await tap(deps, "Sì");
    await tap(deps, "Salta");
    await tap(deps, "Salta");
    await tap(deps, "Salta");
    await tap(deps, "☐ Famiglia");
    await press(deps, cbOf(deps.tg.edits().at(-1)!.keyboard, "☐ Lavoro"));
    await press(deps, cbOf(deps.tg.edits().at(-1)!.keyboard, "➕ Nuovo gruppo"));
    await say(deps, "Beach tennis");
    await tap(deps, "➕ Nuovo gruppo");
    await say(deps, "Calcetto");
    await tap(deps, "Fine");
    await tap(deps, "Media ✓");
    await tap(deps, "Salta");
    const save = cbOf(deps.tg.lastKeyboard(), "Salva");
    const m = await measure(deps, () => press(deps, save));
    expect(await count("persons")).toBe(2);
    expect(m.d1 + m.tg).toBeLessThanOrEqual(15);
  });

  it("RNF-17: /gruppi con 20 gruppi ≤ 15 subrequest", async () => {
    for (let i = 0; i < 20; i++) await insertGroup(`Gruppo ${i}`);
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/gruppi"));
    expect(m.d1 + m.tg).toBeLessThanOrEqual(15);
  });
});
