import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { addToGroup, count, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

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
    await tap(deps, T.btnSkip);
    await say(deps, "14/03/1994");
    await tap(deps, "Sì");
    await tap(deps, T.btnSkip);
    await tap(deps, T.btnSkip);
    await tap(deps, T.btnSkip);
    await tap(deps, "☐ Famiglia");
    await press(deps, cbOf(deps.tg.edits().at(-1)!.keyboard, "☐ Lavoro"));
    await press(deps, cbOf(deps.tg.edits().at(-1)!.keyboard, "➕ Nuovo gruppo"));
    await say(deps, "Beach tennis");
    await tap(deps, "➕ Nuovo gruppo");
    await say(deps, "Calcetto");
    await tap(deps, "Fine");
    await tap(deps, "Media ✓");
    await tap(deps, T.btnSkip);
    const save = cbOf(deps.tg.lastKeyboard(), "Salva");
    const m = await measure(deps, () => press(deps, save));
    expect(await count("persons")).toBe(2);
    expect(m.d1 + m.tg).toBeLessThanOrEqual(15);
  });

  it("RNF-17, RF-07 (005): /gruppi con 20 gruppi = 2 D1 + 1 Telegram", async () => {
    for (let i = 0; i < 20; i++) await insertGroup(`Gruppo ${i}`);
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/gruppi"));
    expect(m).toEqual({ d1: 2, tg: 1 });
  });
});

describe("principio II, research R-07 (005): budget dei gruppi con 200 persone", () => {
  // Gruppo "Tutti" con 200 persone: la scheda occupa 5 messaggi.
  async function bigGroup(): Promise<number> {
    const gid = await insertGroup("Tutti");
    await insertGroup("Lavoro");
    for (let i = 0; i < 200; i++) {
      const pid = await insertPerson({ fullName: `Persona ${i}`, day: (i % 28) + 1, month: (i % 12) + 1 });
      await addToGroup(pid, gid);
    }
    return gid;
  }

  it("RF-19: /gruppi <testo> con esito one = 2 D1 (una batch) + 5 Telegram", async () => {
    await bigGroup();
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/gruppi tutti"));
    expect(m).toEqual({ d1: 2, tg: 5 });
  });

  it("FR-002: tocco g2:o = 2 D1 + 5 messaggi + 1 answer ≤ 9", async () => {
    const gid = await bigGroup();
    const deps = makeDeps();
    const m = await measure(deps, () => press(deps, `g2:o:${gid}:${nameHash("Tutti")}`));
    expect(m).toEqual({ d1: 2, tg: 6 });
  });

  it("FR-009: Rinomina, risposta valida con scheda di 200 persone = 3 D1 + 5 Telegram ≤ 8", async () => {
    const gid = await bigGroup();
    const deps = makeDeps();
    await press(deps, `g2:r:${gid}:${nameHash("Tutti")}`);
    const m = await measure(deps, () => say(deps, "Tutti quanti"));
    expect(m).toEqual({ d1: 3, tg: 5 });
  });

  it("FR-010: Elimina, Sì = 2 D1 + 1 messaggio + 1 answer ≤ 4", async () => {
    const gid = await bigGroup();
    const deps = makeDeps();
    await press(deps, `g2:x:${gid}:${nameHash("Tutti")}`);
    const yes = cbOf(deps.tg.lastKeyboard(), "Sì");
    const m = await measure(deps, () => press(deps, yes));
    expect(await count("groups")).toBe(1);
    expect(m).toEqual({ d1: 2, tg: 2 });
  });
});
