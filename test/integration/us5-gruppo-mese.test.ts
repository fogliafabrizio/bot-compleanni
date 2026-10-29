import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { addToGroup, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { buttons, commandParts, labels, monoParts } from "../helpers/fake-telegram";
import { say } from "../helpers/send";
import { T } from "../../src/texts";

// Oggi = mercoledì 28/10/2026.

describe("US5: /gruppo (alias di /gruppi, v1.1 RF-19, BR-26)", () => {
  it("RF-19: /gruppo lavoro apre la scheda gruppo, per prossimo compleanno, con Rinomina ed Elimina", async () => {
    const lavoro = await insertGroup("Lavoro");
    const a = await insertPerson({ fullName: "Anna", day: 1, month: 9, year: 1990 });
    const b = await insertPerson({ fullName: "Bruno", day: 30, month: 10 });
    await insertPerson({ fullName: "Fuori", day: 29, month: 10 });
    await addToGroup(a, lavoro);
    await addToGroup(b, lavoro);
    const deps = makeDeps();
    await say(deps, "/gruppo lavoro");
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n").slice(0, 2)).toEqual(["👥 Lavoro · 2 persone", ""]);
    expect(commandParts(msg)).toEqual([`/p_${b}`, `/p_${a}`]);
    expect(monoParts(msg).map((s) => s.trimEnd())).toEqual(["Ven 30/10  Bruno", "Mer 01/09  Anna (37)"]);
    expect(buttons(msg.keyboard)).toEqual([
      ["✏️ Rinomina", `g2:r:${lavoro}:${nameHash("Lavoro")}`],
      ["🗑 Elimina", `g2:x:${lavoro}:${nameHash("Lavoro")}`],
    ]);
    await say(deps, "/gruppo LAVORO");
    expect(deps.tg.lastText()).toBe(msg.text);
  });

  it("FR-007: gruppo inesistente → avviso + elenco a pulsanti; senza nome → elenco", async () => {
    await insertGroup("Lavoro");
    await insertGroup("Famiglia");
    const deps = makeDeps();
    await say(deps, "/gruppo calcetto");
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("calcetto")}\n\n${T.groupsTitle}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Famiglia (0)", "Lavoro (0)", "➕ Nuovo gruppo"]);
    await say(deps, "/gruppo");
    expect(deps.tg.lastText()).toBe("👥 I tuoi gruppi");
  });

  it("FR-003: senza gruppi /gruppo indica che non ce ne sono", async () => {
    const deps = makeDeps();
    await say(deps, "/gruppo");
    expect(deps.tg.lastText()).toBe(T.noGroups);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["➕ Nuovo gruppo"]);
  });

  it("FR-008: gruppo vuoto → scheda con 0 persone", async () => {
    await insertGroup("Lavoro");
    const deps = makeDeps();
    await say(deps, "/gruppo lavoro");
    expect(deps.tg.lastText()).toBe(`${T.groupCardTitle("Lavoro", 0)}\n\n${T.groupCardEmpty}`);
  });
});

describe("US5: /mese", () => {
  it("RF-20, FR-015: /mese marzo, /mese Marzo e /mese 3 identici, anno di riferimento 2027, per giorno", async () => {
    const z = await insertPerson({ fullName: "Zeno", day: 2, month: 3, year: 1990 });
    const a = await insertPerson({ fullName: "Anna", day: 14, month: 3 });
    await insertPerson({ fullName: "Aprile", day: 1, month: 4 });
    const deps = makeDeps();
    await say(deps, "/mese marzo");
    const first = deps.tg.lastText()!;
    expect(first.split("\n")).toEqual([T.monthHeader("marzo", 2027), "", `Mar 02/03  Zeno (37)  /p_${z}`, `Dom 14/03  Anna       /p_${a}`]);
    await say(deps, "/mese Marzo");
    expect(deps.tg.lastText()).toBe(first);
    await say(deps, "/mese 3");
    expect(deps.tg.lastText()).toBe(first);
  });

  it("RF-20: /mese senza argomento → mese corrente; chiarimento Sara 05/10/1990 → Lun 05/10  Sara (36)", async () => {
    await insertPerson({ fullName: "Sara", day: 5, month: 10, year: 1990 });
    await insertPerson({ fullName: "Ugo", day: 30, month: 10, year: 1990 });
    const deps = makeDeps();
    await say(deps, "/mese");
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n")[0]).toBe(T.monthHeader("ottobre", 2026));
    expect(monoParts(msg).map((s) => s.trimEnd())).toEqual(["Lun 05/10  Sara (36)", "Ven 30/10  Ugo (36)"]);
  });

  it.each(["marzzo", "13", "0"])("FR-015: /mese %s → mese non riconosciuto", async (m) => {
    const deps = makeDeps();
    await say(deps, `/mese ${m}`);
    expect(deps.tg.lastText()).toBe(T.monthInvalid);
  });

  it("BR-04: /mese febbraio con un nato il 29/02 → 29/02 con il giorno della settimana del 28/02/2027", async () => {
    await insertPerson({ fullName: "Leo", day: 29, month: 2, year: 2004 });
    const deps = makeDeps();
    await say(deps, "/mese febbraio");
    expect(monoParts(deps.tg.messages()[0]!).map((s) => s.trimEnd())).toEqual(["Dom 29/02  Leo (23)"]);
  });

  it("RF-20: mese senza compleanni", async () => {
    await insertPerson({ fullName: "Anna", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/mese giugno");
    expect(deps.tg.lastText()).toBe(T.monthNone("giugno"));
  });
});
