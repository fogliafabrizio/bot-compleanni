import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { InlineKeyboardMarkup } from "../../src/telegram/types";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { buttons, cbOf, urlOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

describe("US3: scheda persona", () => {
  it("RF-03: /p_12 mostra la scheda con Modifica ed Elimina", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, year: 1994, priority: "alta" });
    await addToGroup(12, await insertGroup("Lavoro"));
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).toBe(
      [T.schedaTitle("Marco Rossi", "Marchino"), T.schedaDate("14/03/1994", "compie 33 anni tra 137 giorni"), "Priorità: alta · Gruppi: Lavoro", "Messaggio: standard"].join(
        "\n",
      ),
    );
    // RNF-14: solo i pulsanti di azione.
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      [T.btnEdit, "p:m:12"],
      [T.btnDelete, "p:x:12"],
    ]);
  });

  it("RF-03, FR-012: senza anno l'età non compare", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()!.split("\n")[1]).toBe(T.schedaDate("14/03", "compleanno tra 137 giorni"));
  });

  it("RF-03, FR-013: riga Storico solo con almeno un esito", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).not.toContain("Storico");
    await env.DB.prepare(
      "INSERT INTO occurrences (person_id, year, effective_date, status, created_at) VALUES (12, 2025, '2025-03-14', 'fatto', 'x')",
    ).run();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()!.split("\n").at(-1)).toBe("Storico: 2025 fatto");
  });

  it("FR-012a: id inesistente o persona eliminata → Persona non trovata", async () => {
    const deps = makeDeps();
    await say(deps, "/p_999");
    expect(deps.tg.lastText()).toBe(T.personNotFound);
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3 });
    await env.DB.prepare("DELETE FROM persons WHERE id = 12").run();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).toBe(T.personNotFound);
  });

  it("FR-018c: Modifica ed Elimina di una persona inesistente → Persona non trovata", async () => {
    const deps = makeDeps();
    await press(deps, "p:m:999");
    expect(deps.tg.lastAnswer()).toBe(T.personNotFound);
    await press(deps, "p:x:999");
    expect(deps.tg.lastAnswer()).toBe(T.personNotFound);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("conversation_state")).toBe(0);
  });

  it("principio II, research R-08 di 003: /p_<id> fa una sola batch oltre a getActive", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
    const deps = makeDeps();
    deps.counter.count = 0;
    await say(deps, "/p_12");
    expect(deps.counter.count).toBe(2);
    expect(deps.counter.batches).toHaveLength(1);
  });
});

describe("RF-03, RF-11: tastiera della scheda v1.1", () => {
  const rowsOf = (kb: InlineKeyboardMarkup | undefined) => (kb?.inline_keyboard ?? []).map((r) => r.map((b) => b.text));
  const full = { fullName: "Marco Rossi", day: 25, month: 10, year: 1994, phone: "+393331234567", instagram: "marco.rossi", telegram: "mrossi" };

  it("RF-03: US1-1 telefono + Instagram → WhatsApp e Instagram sopra Modifica/Elimina", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, year: 1994, phone: "+393331234567", instagram: "marco.rossi" });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["WhatsApp", "https://wa.me/393331234567"],
      ["Instagram", "https://ig.me/m/marco.rossi"],
      [T.btnEdit, "p:m:12"],
      [T.btnDelete, "p:x:12"],
    ]);
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([["WhatsApp", "Instagram"], [T.btnEdit, T.btnDelete]]);
  });

  it("RF-11, D-27: US1-2 con occorrenza aperta WhatsApp della scheda senza ?text=", async () => {
    const id = await insertPerson({ ...full, day: 27 });
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-27", status: "aperta" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(urlOf(deps.tg.lastKeyboard(), "WhatsApp")).toBe("https://wa.me/393331234567");
  });

  it("RF-03: US1-3 nessun contatto → prima riga Modifica/Elimina", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([[T.btnEdit, T.btnDelete]]);
  });

  it("FR-002: US1-4 saltato di 3 giorni fa + tutti i contatti → contatti, Segna fatto, Modifica/Elimina", async () => {
    const id = await insertPerson(full);
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([["WhatsApp", "Instagram", "Telegram"], ["Segna fatto"], [T.btnEdit, T.btnDelete]]);
  });

  it("FR-005: US1-5 nessun Copia messaggio nella scheda", async () => {
    const id = await insertPerson(full);
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(deps.tg.lastKeyboard()!.inline_keyboard.flat().some((b) => "copy_text" in b)).toBe(false);
  });

  it("FR-003: US1-6 dopo Segna fatto e dopo Modifica → Instagram → Svuota la riga contatti è aggiornata", async () => {
    const id = await insertPerson(full);
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await press(deps, `p:f:${id}`, 321);
    expect(rowsOf(deps.tg.textEdits()[0]!.keyboard)).toEqual([["WhatsApp", "Instagram", "Telegram"], [T.btnEdit, T.btnDelete]]);

    await press(deps, `p:m:${id}`);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Instagram"));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Svuota"));
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([["WhatsApp", "Telegram"], [T.btnEdit, T.btnDelete]]);
  });

  it("FR-003: /cerca con un solo risultato e Salva in /nuovo mostrano la stessa tastiera", async () => {
    const id = await insertPerson({ ...full, fullName: "Marco Rossi" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    const expected = deps.tg.lastKeyboard();
    await say(deps, "/cerca marco");
    expect(deps.tg.lastKeyboard()).toEqual(expected);

    await say(deps, "/nuovo");
    await say(deps, "Anna Bianchi");
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnSkip));
    await say(deps, "01/02/1990");
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Sì"));
    await say(deps, "+39 333 7654321");
    await say(deps, "@anna.b");
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnSkip));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fine"));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Media ✓"));
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnSkip));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Salva"));
    expect(buttons(deps.tg.lastKeyboard()).slice(0, 2)).toEqual([
      ["WhatsApp", "https://wa.me/393337654321"],
      ["Instagram", "https://ig.me/m/anna.b"],
    ]);
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([["WhatsApp", "Instagram"], [T.btnEdit, T.btnDelete]]);
  });

  it("FR-015: p:m, p:x e p:f di una scheda inviata senza riga contatti funzionano", async () => {
    const id = await insertPerson(full);
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await press(deps, `p:m:${id}`);
    expect(deps.tg.lastText()).toBe(T.editWhichField);
    await press(deps, `p:x:${id}`);
    expect(deps.tg.lastText()).toBe(T.confirmDeletePerson("Marco Rossi"));
    await press(deps, `p:f:${id}`, 321);
    expect(deps.tg.textEdits()).toHaveLength(1);
    expect(await count("occurrences", "status = 'fatto'")).toBe(1);
  });

  it("FR-002, Q5: username Instagram non valido → pulsante assente; dopo la correzione presente", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, instagram: "marco rossi" });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([[T.btnEdit, T.btnDelete]]);
    await press(deps, "p:m:12");
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Instagram"));
    await say(deps, "marco.rossi");
    expect(rowsOf(deps.tg.lastKeyboard())).toEqual([["Instagram"], [T.btnEdit, T.btnDelete]]);
    expect(urlOf(deps.tg.lastKeyboard(), "Instagram")).toBe("https://ig.me/m/marco.rossi");
  });
});

describe("RF-03, FR-001: testo della scheda senza username", () => {
  it("RF-03, FR-001: US1-1 telefono + Instagram → nel testo solo il telefono", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, year: 1994, phone: "+393331234567", instagram: "marco.rossi" });
    const deps = makeDeps();
    await say(deps, "/p_12");
    const text = deps.tg.lastText()!;
    expect(text).toContain("📱 +393331234567");
    expect(text).not.toMatch(/IG @|TG @|marco\.rossi/);
  });

  it("FR-001: persona con soli username → nessuna riga contatti, pulsanti presenti", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3, year: 1994, instagram: "marco.rossi", telegram: "mrossi" });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).toBe(
      [T.schedaTitle("Marco Rossi", null), T.schedaDate("14/03/1994", "compie 33 anni tra 137 giorni"), "Priorità: media", "Messaggio: standard"].join("\n"),
    );
    expect(buttons(deps.tg.lastKeyboard()).map(([t]) => t)).toEqual(["Instagram", "Telegram", T.btnEdit, T.btnDelete]);
  });
});
