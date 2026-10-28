import { describe, expect, it } from "vitest";
import { addHours } from "../../src/time";
import { NOW } from "../helpers/constants";
import { count, insertPerson, rows } from "../helpers/db";
import { runAt } from "../helpers/cron";
import { makeCronDeps, makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, copyOf, labels, urlOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

const settings = () => rows<{ key: string; value: string }>("SELECT key, value FROM settings");

async function measure(deps: TestDeps, run: () => Promise<unknown>): Promise<number> {
  deps.counter.count = 0;
  deps.tg.reset();
  await run();
  return deps.counter.count + deps.tg.calls.length;
}

describe("US4: messaggio di auguri", () => {
  it("RF-15: default con nickname → WhatsApp con Tanti auguri Marchino! 🎉", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, phone: "+393331234567" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    expect(decodeURIComponent(urlOf(deps.tg.lastKeyboard(), "WhatsApp").split("text=")[1]!)).toBe("Tanti auguri Marchino! 🎉");
  });

  it("RF-15: messaggio personalizzato prevale sul default", async () => {
    await insertPerson({ id: 1, fullName: "Anna Bianchi", day: 14, month: 3, phone: "+393331234567", customMessage: "Auguri {nome} 🌸" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    expect(copyOf(deps.tg.lastKeyboard(), "Copia messaggio")).toBe("Auguri Anna Bianchi 🌸");
  });

  it("RF-15, FR-032: /messaggio → domanda con il messaggio attuale → anteprima → Conferma salva", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    expect(deps.tg.lastText()).toBe(
      "Messaggio attuale: «Tanti auguri {nome}! 🎉»\nScrivi il nuovo messaggio di auguri. Usa {nome} per il nome.",
    );
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);
    await say(deps, "  Buon compleanno {nome}!  ");
    expect(deps.tg.lastText()).toBe("Anteprima: «Buon compleanno Marco!»\nConfermi?");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Conferma", "Annulla"]);
    expect(await settings()).toEqual([]);
    await tap(deps, "Conferma");
    expect(deps.tg.lastText()).toBe("Messaggio di auguri aggiornato");
    expect(await settings()).toEqual([{ key: "default_message", value: "Buon compleanno {nome}!" }]);
    expect(await count("conversation_state")).toBe(0);
    // Il nuovo default compare nella domanda successiva e nei reminder.
    await say(deps, "/messaggio");
    expect(deps.tg.lastText()).toContain("«Buon compleanno {nome}!»");
  });

  it("FR-032: Annulla → nessuna riga in settings", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    await say(deps, "Ciao {nome}");
    await tap(deps, "Annulla");
    expect(deps.tg.lastText()).toBe("Operazione annullata");
    expect(await settings()).toEqual([]);
  });

  it("RF-15: dopo la conferma il reminder usa il nuovo default; senza nickname {nome} = nome completo", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, phone: "+393331234567" });
    const deps = makeCronDeps();
    await say(deps, "/messaggio");
    await say(deps, "Felice compleanno {nome}!");
    await tap(deps, "Conferma");
    await runAt(deps, 2027, 3, 14, 9);
    expect(copyOf(deps.tg.lastKeyboard(), "Copia messaggio")).toBe("Felice compleanno Marco Rossi!");
  });

  it("FR-035: oltre il limite errore con 256 e domanda ripetuta; vuoto → domanda ripetuta", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    await say(deps, `{nome}${"x".repeat(197)}`);
    expect(deps.tg.lastText()).toMatch(/^Il messaggio può avere al massimo 256 caratteri \(ogni \{nome\} conta 60\)\.\n\nMessaggio attuale/);
    await say(deps, "   ");
    expect(deps.tg.lastText()).toMatch(/^Il valore non può essere vuoto\n\nMessaggio attuale/);
    const [state] = await rows<{ step: string }>("SELECT step FROM conversation_state");
    expect(state?.step).toBe("testo");
  });

  it("FR-032: nello step conferma un testo ripete la domanda di conferma senza salvare", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    await say(deps, "Ciao {nome}");
    await say(deps, "Sì");
    expect(deps.tg.lastText()).toBe("Anteprima: «Ciao Marco»\nConfermi?");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Conferma", "Annulla"]);
    expect(await settings()).toEqual([]);
  });

  it("FR-032: /annulla, altro comando e scadenza 24 h come i flussi 001", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    await say(deps, "/annulla");
    expect(deps.tg.lastText()).toBe("Operazione annullata");
    await say(deps, "/messaggio");
    await say(deps, "/aiuto");
    expect(await count("conversation_state")).toBe(0);
    await say(deps, "/messaggio");
    await say(deps, "Ciao {nome}");
    const confirm = cbOf(deps.tg.lastKeyboard(), "Conferma");
    deps.setNow(addHours(NOW, 25));
    await press(deps, confirm);
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    expect(await settings()).toEqual([]);
  });

  it("FR-032: doppio tocco su Conferma → una sola scrittura", async () => {
    const deps = makeDeps();
    await say(deps, "/messaggio");
    await say(deps, "Ciao {nome}");
    const confirm = cbOf(deps.tg.lastKeyboard(), "Conferma");
    await Promise.all([press(deps, confirm), press(deps, confirm)]);
    expect(deps.tg.messages().filter((m) => m.text === "Messaggio di auguri aggiornato")).toHaveLength(1);
    expect(await settings()).toHaveLength(1);
  });

  it("RF-15: /aiuto elenca /messaggio", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    expect(deps.tg.lastText()).toContain("/messaggio — modifica il messaggio di auguri");
  });

  it("principio II: ≤ 4 subrequest per update del flusso", async () => {
    const deps = makeDeps();
    expect(await measure(deps, () => say(deps, "/messaggio"))).toBeLessThanOrEqual(4);
    expect(await measure(deps, () => say(deps, "Ciao {nome}"))).toBeLessThanOrEqual(4);
    const confirm = cbOf(deps.tg.lastKeyboard(), "Conferma");
    expect(await measure(deps, () => press(deps, confirm))).toBeLessThanOrEqual(4);
  });
});
