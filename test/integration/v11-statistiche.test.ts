import { describe, expect, it } from "vitest";
import { STRANGER_ID } from "../helpers/constants";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { say, send } from "../helpers/send";
import { textUpdate } from "../helpers/updates";

async function statistiche(deps: TestDeps): Promise<string[]> {
  deps.tg.reset();
  await say(deps, "/statistiche");
  const msgs = deps.tg.messages();
  expect(msgs).toHaveLength(1);
  return msgs[0]!.text.split("\n");
}

// Riga dell'istogramma del mese: "<Mmm> <barra> <n>" → n.
const monthCount = (lines: string[], mmm: string) => Number(lines.find((l) => l.startsWith(`${mmm} `))!.trim().split(/\s+/).at(-1));

describe("RF-32: /statistiche", () => {
  it("RF-32, US3-1, SC-004: ogni cifra coincide con il conteggio a mano", async () => {
    const fam = await insertGroup("Famiglia");
    const lav = await insertGroup("Lavoro");
    await insertGroup("Beach tennis");
    // 6 persone: priorità 2 alta, 3 media, 1 bassa; 2 senza anno; 3 senza contatti; 2 senza gruppo.
    const a = await insertPerson({ fullName: "Anna", day: 10, month: 1, year: 1990, priority: "alta", phone: "+393331111111" });
    const b = await insertPerson({ fullName: "Bruno", day: 11, month: 1, year: 1985, priority: "alta", instagram: "bruno" });
    const c = await insertPerson({ fullName: "Carla", day: 5, month: 2, priority: "media", telegram: "carla" });
    const d = await insertPerson({ fullName: "Dario", day: 6, month: 2, year: 1970, priority: "media" });
    await insertPerson({ fullName: "Elena", day: 7, month: 12, priority: "media" });
    await insertPerson({ fullName: "Fabio", day: 8, month: 12, year: 2000, priority: "bassa" });
    for (const p of [a, b, c]) await addToGroup(p, fam);
    for (const p of [a, d]) await addToGroup(p, lav);
    // Andamento: 2026 → 2 fatto su 3 chiuse (67%); 2025 → 1 su 2 (50%); aperte non contate.
    await insertOccurrence({ personId: a, year: 2026, effectiveDate: "2026-01-10", status: "fatto" });
    await insertOccurrence({ personId: b, year: 2026, effectiveDate: "2026-01-11", status: "fatto" });
    await insertOccurrence({ personId: c, year: 2026, effectiveDate: "2026-02-05", status: "saltato" });
    await insertOccurrence({ personId: d, year: 2026, effectiveDate: "2026-02-06", status: "aperta" });
    await insertOccurrence({ personId: a, year: 2025, effectiveDate: "2025-01-10", status: "fatto" });
    await insertOccurrence({ personId: b, year: 2025, effectiveDate: "2025-01-11", status: "non_confermato" });

    const lines = await statistiche(makeDeps());
    expect(lines.slice(0, 6)).toEqual([
      "📊 Statistiche",
      "6 persone · Alta 2 · Media 3 · Bassa 1",
      "Gruppi: Beach tennis 0 · Famiglia 3 · Lavoro 2 · Senza gruppo 2",
      "Senza anno di nascita: 2 · Senza contatti: 3",
      "",
      "🎂 Compleanni per mese",
    ]);
    expect(monthCount(lines, "Gen")).toBe(2);
    expect(monthCount(lines, "Feb")).toBe(2);
    expect(monthCount(lines, "Dic")).toBe(2);
    expect(monthCount(lines, "Giu")).toBe(0);
    expect(lines.at(-1)).toBe("✅ Auguri fatti: 2026 67% · 2025 50%");
    expect(lines).toHaveLength(6 + 12 + 1);
  });

  it("RF-32, US3-2, FR-014: nessuna occorrenza chiusa → frase senza anni", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 10, month: 1 });
    await insertOccurrence({ personId: p, year: 2026, effectiveDate: "2026-01-10", status: "aperta" });
    expect((await statistiche(makeDeps())).at(-1)).toBe("✅ Auguri fatti: non ci sono ancora anni con esiti");
  });

  it("RF-32, US3-3: persona in Famiglia e Lavoro contata in entrambi e una volta nel totale", async () => {
    const fam = await insertGroup("Famiglia");
    const lav = await insertGroup("Lavoro");
    const p = await insertPerson({ fullName: "Anna", day: 10, month: 1 });
    await addToGroup(p, fam);
    await addToGroup(p, lav);
    const lines = await statistiche(makeDeps());
    expect(lines[1]).toBe("1 persona · Alta 0 · Media 1 · Bassa 0");
    expect(lines[2]).toBe("Gruppi: Famiglia 1 · Lavoro 1");
  });

  it("RF-32, US3-4: nessun compleanno a marzo → riga Mar a 0", async () => {
    await insertPerson({ fullName: "Anna", day: 10, month: 1 });
    expect(monthCount(await statistiche(makeDeps()), "Mar")).toBe(0);
  });

  it("RF-32: rubrica vuota → 0 persone, nessun gruppo, 12 righe a zero", async () => {
    const lines = await statistiche(makeDeps());
    expect(lines.slice(1, 4)).toEqual(["0 persone · Alta 0 · Media 0 · Bassa 0", "Gruppi: nessun gruppo", "Senza anno di nascita: 0 · Senza contatti: 0"]);
    for (const m of ["Gen", "Giu", "Dic"]) expect(monthCount(lines, m)).toBe(0);
  });

  it("RF-32, BR-04: persona nata il 29/02 contata in febbraio", async () => {
    await insertPerson({ fullName: "Bisestile", day: 29, month: 2 });
    expect(monthCount(await statistiche(makeDeps()), "Feb")).toBe(1);
  });

  it("RF-32: anno con sole occorrenze aperte assente dall'andamento", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 10, month: 1 });
    await insertOccurrence({ personId: p, year: 2026, effectiveDate: "2026-01-10", status: "aperta" });
    await insertOccurrence({ personId: p, year: 2025, effectiveDate: "2025-01-10", status: "saltato" });
    expect((await statistiche(makeDeps())).at(-1)).toBe("✅ Auguri fatti: 2025 0%");
  });

  it("RF-32, FR-015: nessun elenco di persone nella risposta", async () => {
    await insertPerson({ fullName: "Nome Riservato", nickname: "Soprannome", day: 10, month: 1 });
    const deps = makeDeps();
    const text = (await statistiche(deps)).join("\n");
    expect(text).not.toContain("Nome Riservato");
    expect(text).not.toContain("Soprannome");
    expect(text).not.toContain("/p_");
  });

  it("001 FR-018: /statistiche durante /nuovo interrompe il flusso", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(await count("conversation_state", "flow = 'nuovo'")).toBe(1);
    expect((await statistiche(deps))[0]).toBe("📊 Statistiche");
    expect(await count("conversation_state")).toBe(0);
  });

  it("001 FR-027: /statistiche da un estraneo → nessuna risposta", async () => {
    const deps = makeDeps();
    await send(deps, textUpdate(STRANGER_ID, "/statistiche"));
    expect(deps.tg.calls).toEqual([]);
  });
});
