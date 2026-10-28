import { describe, expect, it } from "vitest";
import { insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { commandParts } from "../helpers/fake-telegram";
import { say } from "../helpers/send";

// Oggi = mercoledì 28/10/2026.

describe("US3: /cerca", () => {
  it("RF-18, FR-013: un solo risultato → la scheda, identica a /p_<id>", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, year: 1994 });
    await insertPerson({ fullName: "Anna Bianchi", day: 1, month: 1 });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    const scheda = deps.tg.messages()[0]!;
    deps.tg.reset();
    await say(deps, "/cerca marc");
    expect(deps.tg.messages()).toEqual([scheda]);
  });

  it("RF-18: più risultati → lista ordinata per prossimo compleanno, senza tastiera", async () => {
    const a = await insertPerson({ fullName: "Anna", day: 5, month: 11 });
    const b = await insertPerson({ fullName: "Barbara", day: 30, month: 10 });
    await insertPerson({ fullName: "Ugo", day: 31, month: 10 });
    const deps = makeDeps();
    await say(deps, "/cerca a");
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n").slice(0, 2)).toEqual(["Risultati per «a»", ""]);
    expect(commandParts(msg)).toEqual([`/p_${b}`, `/p_${a}`]);
    expect(msg.keyboard).toBeUndefined();
  });

  it("FR-012: nickname, senza maiuscole e senza accenti, su nome completo e nickname", async () => {
    const marco = await insertPerson({ fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3 });
    const nicolo = await insertPerson({ fullName: "Nicolò Verdi", day: 1, month: 2 });
    const nicolo2 = await insertPerson({ fullName: "Nicolo Neri", day: 2, month: 2 });
    const deps = makeDeps();
    await say(deps, "/cerca MARCHINO");
    expect(deps.tg.lastText()!.split("\n")[0]).toBe('Marco Rossi — "Marchino"');
    await say(deps, "/cerca rossi");
    expect(deps.tg.lastText()!.split("\n")[0]).toBe('Marco Rossi — "Marchino"');
    await say(deps, "/cerca nicolo");
    expect(commandParts(deps.tg.messages().at(-1)!)).toEqual([`/p_${nicolo}`, `/p_${nicolo2}`]);
    await say(deps, "/cerca NICOLÒ");
    expect(commandParts(deps.tg.messages().at(-1)!)).toEqual([`/p_${nicolo}`, `/p_${nicolo2}`]);
    await say(deps, "/cerca verdi");
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("Nicolò Verdi");
    expect(marco).toBeGreaterThan(0);
  });

  it("RF-18: nessun risultato; senza testo → sintassi", async () => {
    await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/cerca zzz");
    expect(deps.tg.lastText()).toBe("Nessun risultato per «zzz»");
    await say(deps, "/cerca");
    expect(deps.tg.lastText()).toBe("Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco");
    await say(deps, "/cerca    ");
    expect(deps.tg.lastText()).toBe("Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco");
  });

  it("principio II, research R-08: la ricerca usa una sola chiamata D1 oltre a getActive (+1 batch della scheda)", async () => {
    await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    await insertPerson({ fullName: "Anna Bianchi", day: 1, month: 1 });
    const deps = makeDeps();
    deps.counter.count = 0;
    await say(deps, "/cerca i");
    expect(deps.counter.count).toBe(2);
    deps.counter.count = 0;
    await say(deps, "/cerca marco");
    expect(deps.counter.count).toBe(3);
  });
});
