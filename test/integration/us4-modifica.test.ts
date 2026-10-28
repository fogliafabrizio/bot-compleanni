import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addHours } from "../../src/time";
import { NOW } from "../helpers/constants";
import { addToGroup, count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const LATER = addHours(NOW, 2);
const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

async function person(id: number) {
  const [p] = await rows("SELECT * FROM persons WHERE id = ?", id);
  return p!;
}

async function openEdit(deps: TestDeps, id: number, field: string) {
  await press(deps, `p:m:${id}`);
  await tap(deps, field);
}

describe("US4: modifica per campo", () => {
  it("FR-014: Modifica apre il menù dei 9 campi più Annulla", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
    const deps = makeDeps();
    await press(deps, "p:m:1");
    expect(deps.tg.lastText()).toBe("Quale campo vuoi modificare?");
    expect(labels(deps.tg.lastKeyboard())).toEqual([
      "Nome",
      "Nickname",
      "Data",
      "Telefono",
      "Instagram",
      "Telegram",
      "Gruppi",
      "Priorità",
      "Messaggio",
      "Annulla",
    ]);
  });

  it("RF-04: Instagram → cambia solo quel campo, updated_at aggiornato, scheda rimostrata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994, telegram: "mrossi" });
    const before = await person(1);
    const deps = makeDeps({ now: LATER });
    await openEdit(deps, 1, "Instagram");
    await say(deps, "@nuovo.user");
    const after = await person(1);
    expect(after).toEqual({ ...before, instagram: "nuovo.user", updated_at: LATER.toISOString() });
    expect(deps.tg.lastText()).toContain("IG @nuovo.user");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Modifica", "Elimina"]);
  });

  it("RF-04, FR-015, SC-005: Telefono → Svuota in 3 interazioni", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, phone: "+393331234567" });
    const deps = makeDeps();
    await press(deps, "p:m:1");
    await tap(deps, "Telefono");
    await tap(deps, "Svuota");
    expect((await person(1)).phone).toBeNull();
    expect(deps.tg.lastText()).not.toContain("📱");
  });

  it("FR-015: Nome e Data non offrono Svuota", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await openEdit(deps, 1, "Nome");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);
    await openEdit(deps, 1, "Data");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);
    await openEdit(deps, 1, "Nickname");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Svuota", "Annulla"]);
  });

  describe("FR-016: stesse validazioni dell'inserimento", () => {
    it("FR-016: telefono non valido rifiutato con l'esempio", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
      const deps = makeDeps();
      await openEdit(deps, 1, "Telefono");
      await say(deps, "abc");
      expect(deps.tg.lastText()).toContain("+39 333 1234567");
      expect((await person(1)).phone).toBeNull();
    });

    it("FR-016, RF-02: data 31/04 rifiutata; 15/03/1994 confermata e salvata", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await openEdit(deps, 1, "Data");
      await say(deps, "31/04");
      expect(deps.tg.lastText()).toContain("Data non valida");
      await say(deps, "15/03/1994");
      expect(deps.tg.lastText()).toBe("15 marzo 1994, giusto?");
      await tap(deps, "Sì");
      expect(await person(1)).toMatchObject({ birth_day: 15, birth_month: 3, birth_year: 1994 });
    });

    it("FR-016, FR-010a: nome di 61 caratteri rifiutato", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
      const deps = makeDeps();
      await openEdit(deps, 1, "Nome");
      await say(deps, "a".repeat(61));
      expect(deps.tg.lastText()).toContain("massimo 60");
      expect((await person(1)).full_name).toBe("Marco Rossi");
    });
  });

  describe("FR-016a, BR-14: duplicato in modifica", () => {
    it("RF-04: rinomina in un nome esistente con la stessa data → avviso e conferma", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      await insertPerson({ id: 2, fullName: "Luca Bianchi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await openEdit(deps, 2, "Nome");
      await say(deps, "marco rossi");
      expect(deps.tg.lastText()).toContain("possibile duplicato");
      expect((await person(2)).full_name).toBe("Luca Bianchi");
      await tap(deps, "Salva comunque");
      expect(await person(2)).toMatchObject({ full_name: "marco rossi", full_name_norm: "marco rossi" });
    });

    it("FR-016a: il proprio nome in maiuscolo non è un duplicato", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await openEdit(deps, 1, "Nome");
      await say(deps, "MARCO ROSSI");
      expect(deps.tg.lastText()).not.toContain("possibile duplicato");
      expect((await person(1)).full_name).toBe("MARCO ROSSI");
    });

    it("FR-016a: cambio di data verso un duplicato senza anno → avviso", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      await insertPerson({ id: 2, fullName: "Marco Rossi", day: 20, month: 5, year: 1994 });
      const deps = makeDeps();
      await openEdit(deps, 2, "Data");
      await say(deps, "14/03");
      await tap(deps, "Sì");
      expect(deps.tg.lastText()).toContain("possibile duplicato");
      expect((await person(2)).birth_day).toBe(20);
    });
  });

  describe("RF-04, RF-08: Gruppi", () => {
    it("RF-08: selezione iniziale = gruppi attuali; toggle + nuovo gruppo + Fine", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
      const famiglia = await insertGroup("Famiglia");
      await insertGroup("Lavoro");
      await addToGroup(1, famiglia);
      const deps = makeDeps();
      await openEdit(deps, 1, "Gruppi");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["☑ Famiglia", "☐ Lavoro", "➕ Nuovo gruppo", "Fine"]);
      await tap(deps, "☐ Lavoro");
      const kb = deps.tg.edits().at(-1)!.keyboard;
      await press(deps, cbOf(kb, "☑ Famiglia"));
      await press(deps, cbOf(deps.tg.edits().at(-1)!.keyboard, "➕ Nuovo gruppo"));
      await say(deps, "Amici");
      await tap(deps, "Fine");
      const names = await rows<{ name: string }>(
        "SELECT g.name FROM person_groups pg JOIN groups g ON g.id = pg.group_id WHERE pg.person_id = 1 ORDER BY g.name",
      );
      expect(names.map((n) => n.name)).toEqual(["Amici", "Lavoro"]);
      expect(deps.tg.lastText()).toContain("Gruppi: Amici, Lavoro");
    });

    it("RF-06: Annulla nello step Gruppi non cambia nulla", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
      const famiglia = await insertGroup("Famiglia");
      await addToGroup(1, famiglia);
      const deps = makeDeps();
      await openEdit(deps, 1, "Gruppi");
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Amici");
      await tap(deps, "☑ Famiglia");
      await say(deps, "/annulla");
      expect(await count("groups")).toBe(1);
      expect(await count("person_groups", "person_id = 1")).toBe(1);
    });

    it("FR-023: gruppo creato in modifica e abbandonato per scadenza → nessun gruppo", async () => {
      await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
      const deps = makeDeps();
      await openEdit(deps, 1, "Gruppi");
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Amici");
      deps.setNow(addHours(NOW, 24));
      await say(deps, "ciao");
      expect(await count("groups")).toBe(0);
    });
  });

  it("RF-04: Priorità Bassa salvata subito, scheda rimostrata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await openEdit(deps, 1, "Priorità");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Alta", "Media ✓", "Bassa"]);
    await tap(deps, "Bassa");
    expect((await person(1)).priority).toBe("bassa");
    expect(deps.tg.lastText()).toContain("Priorità: bassa");
  });

  it("RF-04: Messaggio personalizzato e Svuota", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await openEdit(deps, 1, "Messaggio");
    await say(deps, "Auguroni!");
    expect((await person(1)).custom_message).toBe("Auguroni!");
    await openEdit(deps, 1, "Messaggio");
    await tap(deps, "Svuota");
    expect((await person(1)).custom_message).toBeNull();
  });

  it("FR-035: Messaggio oltre 256 caratteri ({nome} = 60) rifiutato con la domanda ripetuta", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await openEdit(deps, 1, "Messaggio");
    await say(deps, "x".repeat(257));
    expect(deps.tg.lastText()).toContain("massimo 256");
    await say(deps, `{nome}${"x".repeat(197)}`);
    expect(deps.tg.lastText()).toContain("ogni {nome} conta 60");
    expect((await person(1)).custom_message).toBeNull();
    await say(deps, `{nome}${"x".repeat(196)}`);
    expect((await person(1)).custom_message).toBe(`{nome}${"x".repeat(196)}`);
  });

  it("FR-018c: persona eliminata durante la modifica → Persona non trovata, flusso chiuso", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await openEdit(deps, 1, "Instagram");
    await env.DB.prepare("DELETE FROM persons WHERE id = 1").run();
    await say(deps, "nuovo");
    expect(deps.tg.lastText()).toBe("Persona non trovata");
    expect(await count("conversation_state")).toBe(0);
  });

  it("FR-018c: dopo il salvataggio il pulsante del menù precedente non è più disponibile", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await press(deps, "p:m:1");
    const menu = deps.tg.lastKeyboard();
    await press(deps, cbOf(menu, "Priorità"));
    await tap(deps, "Alta");
    await press(deps, cbOf(menu, "Nome"));
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
  });
});
