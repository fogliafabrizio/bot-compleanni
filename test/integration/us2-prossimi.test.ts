import { describe, expect, it } from "vitest";
import { addToGroup, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { env } from "cloudflare:test";
import { nameHash } from "../../src/domain/text";
import { buttons, cbOf, commandParts, labels, monoParts } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

// Oggi = mercoledì 28/10/2026.

const lines = (deps: TestDeps) => deps.tg.lastText()!.split("\n");

describe("US2: /prossimi", () => {
  it("RF-17, FR-009: default 30 giorni, oggi compreso, fino al 26/11 compreso", async () => {
    const oggi = await insertPerson({ fullName: "Anna", day: 28, month: 10, year: 1990 });
    const fine = await insertPerson({ fullName: "Bruno", day: 26, month: 11 });
    await insertPerson({ fullName: "Fuori", day: 27, month: 11 });
    await insertPerson({ fullName: "Passato", day: 27, month: 10 });
    const deps = makeDeps();
    await say(deps, "/prossimi");
    expect(lines(deps)).toEqual([T.upcomingHeader(30, null), "", `Mer 28/10  Anna (36)  /p_${oggi}`, `Gio 26/11  Bruno      /p_${fine}`]);
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-17, FR-010: /prossimi 7 famiglia filtra per gruppo (nome come salvato), anche in maiuscolo", async () => {
    const fam = await insertGroup("Famiglia");
    const a = await insertPerson({ fullName: "Anna", day: 30, month: 10 });
    const b = await insertPerson({ fullName: "Bruno", day: 31, month: 10 });
    await insertPerson({ fullName: "Carla", day: 1, month: 11 });
    await addToGroup(a, fam);
    await addToGroup(b, fam);
    const deps = makeDeps();
    await say(deps, "/prossimi 7 famiglia");
    expect(lines(deps)).toEqual([T.upcomingHeader(7, "Famiglia"), "", `Ven 30/10  Anna   /p_${a}`, `Sab 31/10  Bruno  /p_${b}`]);
    const first = deps.tg.lastText();
    await say(deps, "/prossimi 7 FAMIGLIA");
    expect(deps.tg.lastText()).toBe(first);
    await say(deps, "/prossimi famiglia");
    expect(lines(deps)[0]).toBe(T.upcomingHeader(30, "Famiglia"));
    expect(lines(deps)).toHaveLength(4);
  });

  it("FR-010, RF-17 v1.1: gruppo inesistente → avviso ed elenco a pulsanti; senza gruppi testo dedicato", async () => {
    const deps = makeDeps();
    await say(deps, "/prossimi 7 inesistente");
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("inesistente")}\n\n${T.noGroups}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["➕ Nuovo gruppo"]);
    await insertGroup("Lavoro");
    await insertGroup("famiglia");
    await say(deps, "/prossimi 7 inesistente");
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("inesistente")}\n\n${T.groupsTitle}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["famiglia (0)", "Lavoro (0)", "➕ Nuovo gruppo"]);
  });

  it.each(["0", "-3", "400"])("FR-011: /prossimi %s → intervallo ammesso e nessuna lista", async (n) => {
    await insertPerson({ fullName: "Anna", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, `/prossimi ${n}`);
    expect(deps.tg.messages().map((m) => m.text)).toEqual([T.upcomingDaysRange(366)]);
  });

  it("RF-17: /prossimi 1 → Prossimo giorno (solo oggi)", async () => {
    const a = await insertPerson({ fullName: "Anna", day: 28, month: 10 });
    await insertPerson({ fullName: "Bruno", day: 29, month: 10 });
    const deps = makeDeps();
    await say(deps, "/prossimi 1");
    expect(lines(deps)).toEqual([T.upcomingHeader(1, null), "", `Mer 28/10  Anna  /p_${a}`]);
  });

  it("chiarimento: Anna oggi e Luca il 04/11 → /prossimi 7 con Anna in cima e Luca assente", async () => {
    await insertPerson({ fullName: "Luca", day: 4, month: 11 });
    await insertPerson({ fullName: "Zoe", day: 3, month: 11 });
    await insertPerson({ fullName: "Anna", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, "/prossimi 7");
    expect(monoParts(deps.tg.messages()[0]!).map((s) => s.trimEnd())).toEqual(["Mer 28/10  Anna", "Mar 03/11  Zoe"]);
  });

  it("§5.7, FR-001a: senza anno nessuna età; parte sinistra in monospazio allineata, /p_<id> fuori", async () => {
    const a = await insertPerson({ fullName: "Anna Bianchi", nickname: "Anna", day: 30, month: 10, year: 1998 });
    const l = await insertPerson({ fullName: "Luca", day: 2, month: 11, year: 1991 });
    const g = await insertPerson({ fullName: "Giulia", day: 12, month: 11 });
    const deps = makeDeps();
    await say(deps, "/prossimi");
    const msg = deps.tg.messages()[0]!;
    const mono = monoParts(msg);
    expect(mono).toEqual(["Ven 30/10  Anna (28)", "Lun 02/11  Luca (35)", "Gio 12/11  Giulia   "]);
    expect(new Set(mono.map((s) => s.length)).size).toBe(1);
    expect(commandParts(msg)).toEqual([`/p_${a}`, `/p_${l}`, `/p_${g}`]);
    for (const m of mono) expect(m).not.toContain("/p_");
    expect(msg.keyboard).toBeUndefined();
  });

  it("FR-009: nessun compleanno nel periodo", async () => {
    await insertPerson({ fullName: "Anna", day: 1, month: 1 });
    const fam = await insertGroup("Famiglia");
    const deps = makeDeps();
    await say(deps, "/prossimi 7");
    expect(deps.tg.lastText()).toBe(T.upcomingNone(7, null));
    await say(deps, "/prossimi 7 famiglia");
    expect(deps.tg.lastText()).toBe(T.upcomingNone(7, "Famiglia"));
    expect(fam).toBeGreaterThan(0);
  });

  it("R-04: cavallo d'anno, oggi 20/12/2026 → il 05/01/2027 con l'età del 2027", async () => {
    const id = await insertPerson({ fullName: "Gino", day: 5, month: 1, year: 2000 });
    const deps = makeDeps({ now: new Date("2026-12-20T10:00:00.000Z") });
    await say(deps, "/prossimi 30");
    expect(lines(deps)).toEqual([T.upcomingHeader(30, null), "", `Mar 05/01  Gino (27)  /p_${id}`]);
  });
});

describe("v1.1 RF-17, BR-26 — filtro gruppo", () => {
  // Anna (30/10) in "👨‍👩‍👧 Famiglia", Bruno (31/10) in "Famiglia Rossi", Carla (20/11) in entrambi.
  async function seedFamiglie(withRossi = true) {
    const casa = await insertGroup("👨‍👩‍👧 Famiglia");
    const rossi = withRossi ? await insertGroup("Famiglia Rossi") : null;
    const a = await insertPerson({ fullName: "Anna", day: 30, month: 10 });
    const b = await insertPerson({ fullName: "Bruno", day: 31, month: 10 });
    const c = await insertPerson({ fullName: "Carla", day: 20, month: 11 });
    await addToGroup(a, casa);
    await addToGroup(c, casa);
    if (rossi !== null) {
      await addToGroup(b, rossi);
      await addToGroup(c, rossi);
    }
    return { casa, rossi, a, b, c };
  }

  it("RF-17, BR-26 (#16): /prossimi 7 fam con un solo gruppo → lista filtrata con il nome salvato", async () => {
    const { a } = await seedFamiglie(false);
    const deps = makeDeps();
    await say(deps, "/prossimi 7 fam");
    expect(lines(deps)).toEqual([T.upcomingHeader(7, "👨‍👩‍👧 Famiglia"), "", `Ven 30/10  Anna  /p_${a}`]);
  });

  it("RF-17, RNF-14 (#17): più gruppi → scelta g2:p che conserva i giorni; il tocco dà la lista filtrata", async () => {
    const { casa, rossi, b } = await seedFamiglie();
    const deps = makeDeps();
    await say(deps, "/prossimi 7 fam");
    expect(deps.tg.lastText()).toBe("🔍 Più gruppi corrispondono a «fam»:");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["👨‍👩‍👧 Famiglia (2)", `g2:p:${casa}:${nameHash("👨‍👩‍👧 Famiglia")}:7`],
      ["Famiglia Rossi (2)", `g2:p:${rossi}:${nameHash("Famiglia Rossi")}:7`],
    ]);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Famiglia Rossi (2)"));
    expect(lines(deps)).toEqual([T.upcomingHeader(7, "Famiglia Rossi"), "", `Sab 31/10  Bruno  /p_${b}`]);
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-17 (#18): /prossimi 7 xyz → avviso + elenco a pulsanti g2:o", async () => {
    const { casa } = await seedFamiglie(false);
    const deps = makeDeps();
    await say(deps, "/prossimi 7 xyz");
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("xyz")}\n\n${T.groupsTitle}`);
    expect(cbOf(deps.tg.lastKeyboard(), "👨‍👩‍👧 Famiglia (2)")).toBe(`g2:o:${casa}:${nameHash("👨‍👩‍👧 Famiglia")}`);
  });

  it("FR-011 (#19): /prossimi fam → 30 giorni filtrati", async () => {
    const { a, c } = await seedFamiglie(false);
    const deps = makeDeps();
    await say(deps, "/prossimi fam");
    expect(lines(deps)[0]).toBe(T.upcomingHeader(30, "👨‍👩‍👧 Famiglia"));
    expect(commandParts(deps.tg.messages().at(-1)!)).toEqual([`/p_${a}`, `/p_${c}`]);
  });

  it("FR-011a (#20): /prossimi 2024 calcetto → errore dei giorni; /prossimi 30 2024 calcetto → lista filtrata", async () => {
    const g = await insertGroup("2024 Calcetto");
    const p = await insertPerson({ fullName: "Dario", day: 2, month: 11 });
    await addToGroup(p, g);
    const deps = makeDeps();
    await say(deps, "/prossimi 2024 calcetto");
    expect(deps.tg.lastText()).toBe(T.upcomingDaysRange(366));
    await say(deps, "/prossimi 30 2024 calcetto");
    expect(lines(deps)).toEqual([T.upcomingHeader(30, "2024 Calcetto"), "", `Lun 02/11  Dario  /p_${p}`]);
  });

  it("FR-006: /prossimi 7 🏖 (chiave vuota) → lista senza filtro", async () => {
    await seedFamiglie();
    const deps = makeDeps();
    await say(deps, "/prossimi 7 🏖");
    expect(lines(deps)[0]).toBe(T.upcomingHeader(7, null));
    expect(lines(deps)).toHaveLength(4);
  });

  it("FR-005: tocco g2:p su un gruppo rinominato → non esiste più + elenco", async () => {
    const { rossi } = await seedFamiglie();
    const deps = makeDeps();
    await say(deps, "/prossimi 7 fam");
    const data = cbOf(deps.tg.lastKeyboard(), "Famiglia Rossi (2)");
    await env.DB.prepare("UPDATE groups SET name = 'Rossi', name_norm = 'rossi' WHERE id = ?").bind(rossi).run();
    await press(deps, data);
    expect(deps.tg.lastText()).toBe(`${T.groupGone}\n\n${T.groupsTitle}`);
  });
});
