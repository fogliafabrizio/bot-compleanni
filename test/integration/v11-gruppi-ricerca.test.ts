import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { addToGroup, count, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

// Ricerca morbida dei gruppi (feature 005, US1; quickstart §3 #1–#6). Oggi = mercoledì 28/10/2026.

async function groupWith(name: string, people: number): Promise<number> {
  const gid = await insertGroup(name);
  for (let i = 0; i < people; i++) {
    const pid = await insertPerson({ fullName: `${name} ${i}`, day: 1 + i, month: 11 });
    await addToGroup(pid, gid);
  }
  return gid;
}

const firstLine = (text: string | undefined) => text?.split("\n")[0];

describe("RF-19, BR-26, RNF-14: /gruppi <testo>", () => {
  it("RF-19, BR-26 (#1): /gruppi fam con un solo gruppo che contiene «fam» apre la scheda", async () => {
    const gid = await groupWith("👨‍👩‍👧 Famiglia", 2);
    await groupWith("Lavoro", 1);
    const deps = makeDeps();
    await say(deps, "/gruppi fam");
    expect(deps.tg.messages()).toHaveLength(1);
    expect(firstLine(deps.tg.lastText())).toBe("👥 👨‍👩‍👧 Famiglia · 2 persone");
    expect(commandParts(deps.tg.messages()[0]!)).toHaveLength(2);
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["✏️ Rinomina", `g2:r:${gid}:${nameHash("👨‍👩‍👧 Famiglia")}`],
      ["🗑 Elimina", `g2:x:${gid}:${nameHash("👨‍👩‍👧 Famiglia")}`],
    ]);
  });

  it("RF-19, BR-26 (#2): la corrispondenza esatta vince: /gruppi famiglia apre «👨‍👩‍👧 Famiglia», non «Famiglia Rossi»", async () => {
    await groupWith("👨‍👩‍👧 Famiglia", 1);
    await groupWith("Famiglia Rossi", 3);
    const deps = makeDeps();
    await say(deps, "/gruppi famiglia");
    expect(firstLine(deps.tg.lastText())).toBe("👥 👨‍👩‍👧 Famiglia · 1 persona");
  });

  it("RF-19, RNF-14 (#3): più candidati → scelta a pulsanti senza ➕ Nuovo gruppo; il tocco apre la scheda", async () => {
    const fam = await groupWith("Famiglia", 2);
    const rossi = await groupWith("Famiglia Rossi", 1);
    await groupWith("Lavoro", 1);
    const deps = makeDeps();
    await say(deps, "/gruppi fam");
    expect(deps.tg.lastText()).toBe("🔍 Più gruppi corrispondono a «fam»:");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["Famiglia (2)", `g2:o:${fam}:${nameHash("Famiglia")}`],
      ["Famiglia Rossi (1)", `g2:o:${rossi}:${nameHash("Famiglia Rossi")}`],
    ]);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Famiglia Rossi (1)"));
    expect(firstLine(deps.tg.lastText())).toBe("👥 Famiglia Rossi · 1 persona");
  });

  it("BR-26 (#4): /gruppi UNIVERSITA apre «Università» (maiuscole e accenti ignorati)", async () => {
    await groupWith("Università", 1);
    const deps = makeDeps();
    await say(deps, "/gruppi UNIVERSITA");
    expect(firstLine(deps.tg.lastText())).toBe("👥 Università · 1 persona");
  });

  it("FR-007 (#5): nessuna corrispondenza → avviso con il testo scritto + elenco a pulsanti", async () => {
    await groupWith("Famiglia", 1);
    await groupWith("Lavoro", 0);
    const deps = makeDeps();
    await say(deps, "/gruppi xyz");
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("xyz")}\n\n${T.groupsTitle}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Famiglia (1)", "Lavoro (0)", "➕ Nuovo gruppo"]);
  });

  it("FR-014 (#6): /gruppo lavoro e /gruppi lavoro danno messaggi identici", async () => {
    await groupWith("Lavoro", 3);
    const deps = makeDeps();
    await say(deps, "/gruppo lavoro");
    const a = deps.tg.messages().at(-1)!;
    await say(deps, "/gruppi lavoro");
    const b = deps.tg.messages().at(-1)!;
    expect(b).toEqual(a);
    expect(firstLine(a.text)).toBe("👥 Lavoro · 3 persone");
  });

  it("FR-007: «Famiglia» e «👨‍👩‍👧 Famiglia» (due esatte) → scelta tra i due", async () => {
    await groupWith("Famiglia", 0);
    await groupWith("👨‍👩‍👧 Famiglia", 0);
    await groupWith("Famiglia Rossi", 0);
    const deps = makeDeps();
    await say(deps, "/gruppi famiglia");
    expect(deps.tg.lastText()).toBe("🔍 Più gruppi corrispondono a «famiglia»:");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["👨‍👩‍👧 Famiglia (0)", "Famiglia (0)"]);
  });

  it.each(["/gruppi 🏖", "/gruppo", "/gruppi ★★"])("FR-006: %s (chiave vuota o nessun testo) → elenco gruppi", async (text) => {
    await insertGroup("🏖");
    await insertGroup("Lavoro");
    const deps = makeDeps();
    await say(deps, text);
    expect(deps.tg.lastText()).toBe("👥 I tuoi gruppi");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["🏖 (0)", "Lavoro (0)", "➕ Nuovo gruppo"]);
  });

  it("V-09, FR-013: 61 candidati → titolo, righe di testo e invito, senza pulsanti", async () => {
    for (let i = 1; i <= 61; i++) await insertGroup(`Squadra ${String(i).padStart(2, "0")}`);
    const deps = makeDeps();
    await say(deps, "/gruppi squadra");
    const lines = deps.tg.messages().map((m) => m.text).join("\n").split("\n");
    expect(lines.slice(0, 3)).toEqual(["🔍 Più gruppi corrispondono a «squadra»:", "", "Squadra 01 (0)"]);
    expect(lines.at(-1)).toBe("Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam");
    expect(deps.tg.messages().every((m) => (m.keyboard?.inline_keyboard.flat().length ?? 0) === 0)).toBe(true);
  });

  it("RF-06: /gruppi <testo> interrompe un /nuovo in corso", async () => {
    await groupWith("Lavoro", 1);
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await say(deps, "/gruppi lav");
    expect(await count("conversation_state")).toBe(0);
    expect(firstLine(deps.tg.lastText())).toBe("👥 Lavoro · 1 persona");
  });

  it("principio II, R-07: /gruppi <testo> con esito one fa una sola batch D1 di lettura", async () => {
    await groupWith("Lavoro", 3);
    await groupWith("Famiglia", 2);
    const deps = makeDeps();
    deps.counter.count = 0;
    await say(deps, "/gruppi lavoro");
    expect(deps.counter.count).toBe(2);
    expect(deps.counter.batches).toHaveLength(1);
  });
});
