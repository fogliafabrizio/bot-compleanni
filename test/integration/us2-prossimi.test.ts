import { describe, expect, it } from "vitest";
import { addToGroup, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { commandParts, monoParts } from "../helpers/fake-telegram";
import { say } from "../helpers/send";

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
    expect(lines(deps)).toEqual(["Prossimi 30 giorni", "", `Mer 28/10  Anna (36)  /p_${oggi}`, `Gio 26/11  Bruno      /p_${fine}`]);
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
    expect(lines(deps)).toEqual(["Prossimi 7 giorni (Famiglia)", "", `Ven 30/10  Anna   /p_${a}`, `Sab 31/10  Bruno  /p_${b}`]);
    const first = deps.tg.lastText();
    await say(deps, "/prossimi 7 FAMIGLIA");
    expect(deps.tg.lastText()).toBe(first);
    await say(deps, "/prossimi famiglia");
    expect(lines(deps)[0]).toBe("Prossimi 30 giorni (Famiglia)");
    expect(lines(deps)).toHaveLength(4);
  });

  it("FR-010: gruppo inesistente → messaggio ed elenco dei gruppi; senza gruppi testo dedicato", async () => {
    const deps = makeDeps();
    await say(deps, "/prossimi 7 inesistente");
    expect(deps.tg.lastText()).toBe("Il gruppo «inesistente» non esiste.\nNon hai ancora nessun gruppo.");
    await insertGroup("Lavoro");
    await insertGroup("famiglia");
    await say(deps, "/prossimi 7 inesistente");
    expect(deps.tg.lastText()).toBe("Il gruppo «inesistente» non esiste.\nGruppi esistenti: famiglia, Lavoro");
  });

  it.each(["0", "-3", "400"])("FR-011: /prossimi %s → intervallo ammesso e nessuna lista", async (n) => {
    await insertPerson({ fullName: "Anna", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, `/prossimi ${n}`);
    expect(deps.tg.messages().map((m) => m.text)).toEqual(["Il numero di giorni deve essere tra 1 e 366"]);
  });

  it("RF-17: /prossimi 1 → Prossimo giorno (solo oggi)", async () => {
    const a = await insertPerson({ fullName: "Anna", day: 28, month: 10 });
    await insertPerson({ fullName: "Bruno", day: 29, month: 10 });
    const deps = makeDeps();
    await say(deps, "/prossimi 1");
    expect(lines(deps)).toEqual(["Prossimo giorno", "", `Mer 28/10  Anna  /p_${a}`]);
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
    expect(deps.tg.lastText()).toBe("Nessun compleanno nei prossimi 7 giorni");
    await say(deps, "/prossimi 7 famiglia");
    expect(deps.tg.lastText()).toBe("Nessun compleanno nei prossimi 7 giorni (Famiglia)");
    expect(fam).toBeGreaterThan(0);
  });

  it("R-04: cavallo d'anno, oggi 20/12/2026 → il 05/01/2027 con l'età del 2027", async () => {
    const id = await insertPerson({ fullName: "Gino", day: 5, month: 1, year: 2000 });
    const deps = makeDeps({ now: new Date("2026-12-20T10:00:00.000Z") });
    await say(deps, "/prossimi 30");
    expect(lines(deps)).toEqual(["Prossimi 30 giorni", "", `Mar 05/01  Gino (27)  /p_${id}`]);
  });
});
