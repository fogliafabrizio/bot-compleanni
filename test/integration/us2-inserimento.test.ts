import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addHours } from "../../src/time";
import { NOW } from "../helpers/constants";
import { count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const kb = (deps: TestDeps) => deps.tg.lastKeyboard();
const tap = (deps: TestDeps, label: string) => press(deps, cbOf(kb(deps), label));

// Porta il flusso fino allo step Gruppi (nome, nickname saltato o dato, data confermata, contatti saltati).
async function toGroups(deps: TestDeps, name = "Marco Rossi", date = "14/03/1994", nickname?: string) {
  await say(deps, "/nuovo");
  await say(deps, name);
  if (nickname) await say(deps, nickname);
  else await tap(deps, "Salta");
  await say(deps, date);
  await tap(deps, "Sì");
  await tap(deps, "Salta"); // telefono
  await tap(deps, "Salta"); // instagram
  await tap(deps, "Salta"); // telegram
}

// Dallo step Gruppi fino al riepilogo con i valori di default.
async function groupsToSummary(deps: TestDeps) {
  await tap(deps, "Fine");
  await tap(deps, "Media ✓");
  await tap(deps, "Salta"); // messaggio
}

async function stateRow() {
  return env.DB.prepare("SELECT flow, step, flow_id FROM conversation_state").first<{ flow: string; step: string; flow_id: string }>();
}

describe("US2: inserimento guidato", () => {
  it("RF-01, AFU §5.2: flusso completo fino alla scheda", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(deps.tg.lastText()).toBe("Nome completo?");
    expect(labels(kb(deps))).toEqual(["Annulla"]);

    await say(deps, "Marco Rossi");
    expect(deps.tg.lastText()).toBe("Nickname? (come lo chiami nei messaggi)");
    expect(labels(kb(deps))).toEqual(["Salta"]);

    await say(deps, "Marchino");
    expect(deps.tg.lastText()).toBe("Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno");

    await say(deps, "14/03/1994");
    expect(deps.tg.lastText()).toBe("14 marzo 1994, giusto?");
    expect(labels(kb(deps))).toEqual(["Sì", "Correggi"]);

    await tap(deps, "Sì");
    expect(deps.tg.lastText()).toBe("Telefono? (con prefisso, es. +39 333 1234567)");
    expect(labels(kb(deps))).toEqual(["Salta"]);
    await tap(deps, "Salta");
    expect(deps.tg.lastText()).toBe("Username Instagram?");
    await tap(deps, "Salta");
    expect(deps.tg.lastText()).toBe("Username Telegram?");
    await tap(deps, "Salta");
    expect(deps.tg.lastText()).toBe("Gruppi?");
    expect(labels(kb(deps))).toEqual(["➕ Nuovo gruppo", "Fine"]);

    await tap(deps, "Fine");
    expect(deps.tg.lastText()).toBe("Priorità?");
    expect(labels(kb(deps))).toEqual(["Alta", "Media ✓", "Bassa"]);

    await tap(deps, "Media ✓");
    expect(deps.tg.lastText()).toBe("Messaggio di auguri personalizzato? Se salti uso quello standard.");
    await tap(deps, "Salta");
    expect(deps.tg.lastText()).toContain("Riepilogo:");
    expect(deps.tg.lastText()).toContain('Marco Rossi — "Marchino"');
    expect(labels(kb(deps))).toEqual(["Salva", "Annulla"]);

    await tap(deps, "Salva");
    const [p] = await rows("SELECT * FROM persons");
    expect(p).toMatchObject({
      full_name: "Marco Rossi",
      full_name_norm: "marco rossi",
      nickname: "Marchino",
      birth_day: 14,
      birth_month: 3,
      birth_year: 1994,
      priority: "media",
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    // FR-003: dopo il salvataggio la scheda con Modifica ed Elimina.
    expect(deps.tg.lastText()).toContain("14/03/1994 · compie 33 anni tra 137 giorni");
    expect(buttons(kb(deps))).toEqual([
      ["Modifica", `p:m:${p!.id}`],
      ["Elimina", `p:x:${p!.id}`],
    ]);
    expect(await count("conversation_state")).toBe(0);
  });

  it("RF-01, FR-002: solo campi obbligatori → priorità media; Priorità senza Salta", async () => {
    const deps = makeDeps();
    await toGroups(deps);
    await tap(deps, "Fine");
    expect(labels(kb(deps))).not.toContain("Salta");
    await tap(deps, "Media ✓");
    await tap(deps, "Salta");
    await tap(deps, "Salva");
    const [p] = await rows("SELECT * FROM persons");
    expect(p).toMatchObject({ priority: "media", nickname: null, phone: null, instagram: null, telegram: null, custom_message: null });
  });

  it("FR-002: il DEFAULT dello schema per la priorità è media", async () => {
    await env.DB.prepare(
      "INSERT INTO persons (full_name, full_name_norm, birth_day, birth_month, created_at, updated_at) VALUES ('A', 'a', 1, 1, 'x', 'x')",
    ).run();
    const [p] = await rows<{ priority: string }>("SELECT priority FROM persons");
    expect(p!.priority).toBe("media");
  });

  it("RF-01: scelta di una priorità diversa e dei campi opzionali", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await tap(deps, "Salta");
    await say(deps, "14/03");
    await tap(deps, "Sì");
    await say(deps, "333 1234567");
    await say(deps, "@marco.rossi");
    await say(deps, "@mrossi");
    await tap(deps, "Fine");
    await tap(deps, "Alta");
    await say(deps, "Auguri!");
    await tap(deps, "Salva");
    const [p] = await rows("SELECT * FROM persons");
    expect(p).toMatchObject({
      birth_year: null,
      phone: "+393331234567",
      instagram: "marco.rossi",
      telegram: "mrossi",
      priority: "alta",
      custom_message: "Auguri!",
    });
  });

  describe("RF-02, BR-01, BR-02: data", () => {
    it.each(["31/04", "14-3-94", "29/02/1995", "01/01/1899", "01/01/2027"])("RF-02: %j rifiutata, step invariato", async (d) => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await tap(deps, "Salta");
      await say(deps, d);
      expect(deps.tg.lastText()).toContain("Data non valida");
      expect(deps.tg.lastText()).toContain("gg/mm/aaaa");
      expect((await stateRow())?.step).toBe("data");
    });

    it("RF-02: 29/02 senza anno accettata", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await tap(deps, "Salta");
      await say(deps, "29/02");
      expect(deps.tg.lastText()).toBe("29 febbraio, giusto?");
    });

    it("FR-008: Correggi richiede di nuovo la data", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await tap(deps, "Salta");
      await say(deps, "14/03/1994");
      await tap(deps, "Correggi");
      expect(deps.tg.lastText()).toBe("Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno");
      await say(deps, "15/03/1994");
      expect(deps.tg.lastText()).toBe("15 marzo 1994, giusto?");
    });
  });

  describe("BR-15, BR-16: contatti", () => {
    it("BR-15: telefono non valido → errore con l'esempio, domanda ripetuta", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await tap(deps, "Salta");
      await say(deps, "14/03/1994");
      await tap(deps, "Sì");
      await say(deps, "abc");
      expect(deps.tg.lastText()).toContain("+39 333 1234567");
      expect(deps.tg.lastText()).toContain("Telefono?");
      expect((await stateRow())?.step).toBe("telefono");
    });
  });

  describe("FR-010a: limiti dei testi", () => {
    it("FR-010a: nome di soli spazi rifiutato", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "   ");
      expect(deps.tg.lastText()).toContain("Il valore non può essere vuoto");
      expect(deps.tg.lastText()).toContain("Nome completo?");
    });

    it("FR-010a: nome di 61 caratteri → massimo 60", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "a".repeat(61));
      expect(deps.tg.lastText()).toContain("massimo 60");
      expect((await stateRow())?.step).toBe("nome");
    });

    // FR-035 (feature 002) sostituisce il limite di 500 di FR-010a.
    it("FR-035: messaggio di 257 caratteri rifiutato, massimo 256", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "Fine");
      await tap(deps, "Media ✓");
      await say(deps, "x".repeat(257));
      expect(deps.tg.lastText()).toContain("massimo 256");
      expect((await stateRow())?.step).toBe("messaggio");
    });

    it("FR-035: {nome} + 197 caratteri rifiutato, {nome} + 196 accettato", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "Fine");
      await tap(deps, "Media ✓");
      await say(deps, `{nome}${"x".repeat(197)}`);
      expect(deps.tg.lastText()).toContain("ogni {nome} conta 60");
      expect((await stateRow())?.step).toBe("messaggio");
      await say(deps, `{nome}${"x".repeat(196)}`);
      expect((await stateRow())?.step).toBe("riepilogo");
    });
  });

  describe("RF-08, FR-023: step Gruppi", () => {
    it("RF-08: toggle, nuovo gruppo selezionato, scritto solo al salvataggio", async () => {
      await insertGroup("Famiglia");
      const lavoro = await insertGroup("Lavoro");
      const deps = makeDeps();
      await toGroups(deps);
      expect(labels(kb(deps))).toEqual(["☐ Famiglia", "☐ Lavoro", "➕ Nuovo gruppo", "Fine"]);
      const groupsKb = kb(deps);

      await press(deps, cbOf(groupsKb, "☐ Lavoro"), 555);
      const edit = deps.tg.edits().at(-1)!;
      expect(edit.messageId).toBe(555);
      expect(labels(edit.keyboard)).toContain("☑ Lavoro");

      await press(deps, cbOf(edit.keyboard, "➕ Nuovo gruppo"));
      expect(deps.tg.lastText()).toBe("Nome del nuovo gruppo?");
      await say(deps, "Beach tennis");
      expect(labels(kb(deps))).toEqual(["☐ Famiglia", "☑ Lavoro", "☑ Beach tennis", "➕ Nuovo gruppo", "Fine"]);
      expect(await count("groups")).toBe(2);

      await groupsToSummary(deps);
      expect(deps.tg.lastText()).toContain("Gruppi: Beach tennis, Lavoro");
      await tap(deps, "Salva");
      expect(await count("groups")).toBe(3);
      const names = await rows<{ name: string }>(
        "SELECT g.name FROM person_groups pg JOIN groups g ON g.id = pg.group_id ORDER BY g.name",
      );
      expect(names.map((n) => n.name)).toEqual(["Beach tennis", "Lavoro"]);
      expect(lavoro).toBeGreaterThan(0);
    });

    it("BR-17: nuovo gruppo con nome esistente (maiuscole ignorate) rifiutato", async () => {
      await insertGroup("Famiglia");
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "famiglia");
      expect(deps.tg.lastText()).toContain("Esiste già un gruppo con questo nome");
      expect((await stateRow())?.step).toBe("gruppo_nuovo");
    });

    it("BR-17: lo stesso gruppo in attesa due volte nello stesso flusso è rifiutato", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Beach tennis");
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "BEACH TENNIS");
      expect(deps.tg.lastText()).toContain("Esiste già un gruppo con questo nome");
    });

    it("RF-08: un gruppo in attesa si può deselezionare", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Beach tennis");
      await tap(deps, "☑ Beach tennis");
      expect(labels(deps.tg.edits().at(-1)!.keyboard)).toContain("☐ Beach tennis");
    });

    it("FR-023: gruppo creato nel flusso e poi abbandonato per scadenza → nessun gruppo", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Beach tennis");
      deps.setNow(addHours(NOW, 24));
      await say(deps, "ciao");
      expect(await count("groups")).toBe(0);
      expect(await count("conversation_state")).toBe(0);
    });
  });

  describe("BR-14: possibile duplicato", () => {
    it("BR-14: stesso nome e data → avviso, Salva comunque salva", async () => {
      await insertPerson({ fullName: "marco rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      expect(deps.tg.lastText()).toContain("possibile duplicato");
      expect(labels(kb(deps))).toEqual(["Salva comunque", "Annulla"]);
      expect(await count("persons")).toBe(1);
      await tap(deps, "Salva comunque");
      expect(await count("persons")).toBe(2);
    });

    it("BR-14: Annulla sull'avviso non salva", async () => {
      await insertPerson({ fullName: "marco rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      await tap(deps, "Annulla");
      expect(await count("persons")).toBe(1);
    });

    it("BR-14: data senza anno coincide con la stessa data con anno", async () => {
      await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await toGroups(deps, "Marco Rossi", "14/03");
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      expect(deps.tg.lastText()).toContain("possibile duplicato");
    });

    it("BR-14: esistente senza anno, nuovo con anno → avviso", async () => {
      await insertPerson({ fullName: "Anna Verdi", day: 14, month: 3 });
      const deps = makeDeps();
      await toGroups(deps, "anna verdi", "14/03/1990");
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      expect(deps.tg.lastText()).toContain("possibile duplicato");
    });

    it("BR-14: anni diversi → nessun avviso", async () => {
      await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
      const deps = makeDeps();
      await toGroups(deps, "Marco Rossi", "14/03/1995");
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      expect(await count("persons")).toBe(2);
    });
  });

  describe("RF-06: annullamento", () => {
    it("RF-06: /annulla a metà → nulla salvato", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await say(deps, "/annulla");
      expect(deps.tg.lastText()).toBe("Operazione annullata");
      expect(await count("persons")).toBe(0);
      expect(await count("conversation_state")).toBe(0);
    });

    it("RF-06: Annulla sul riepilogo → nulla salvato", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      await tap(deps, "Annulla");
      expect(deps.tg.lastText()).toBe("Operazione annullata");
      expect(await count("persons")).toBe(0);
      expect(await count("conversation_state")).toBe(0);
    });

    it("R-12: Annulla dopo aver creato un gruppo nel flusso → nessun gruppo", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Beach tennis");
      await groupsToSummary(deps);
      await tap(deps, "Annulla");
      expect(await count("groups")).toBe(0);
    });

    it("RF-06: /annulla senza flusso", async () => {
      const deps = makeDeps();
      await say(deps, "/annulla");
      expect(deps.tg.lastText()).toBe("Nessuna operazione da annullare");
    });
  });

  describe("FR-018: comandi durante il flusso", () => {
    it("FR-018: /id a metà annulla il flusso senza salvare", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "/id");
      expect(deps.tg.lastText()).toContain("1001");
      expect(await count("conversation_state")).toBe(0);
      await say(deps, "Marco");
      expect(deps.tg.lastText()).toBe("Non ho capito. Scrivi /aiuto per l'elenco dei comandi");
      expect(await count("persons")).toBe(0);
    });

    it("FR-018: comando inesistente non interrompe il flusso", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      const before = await stateRow();
      await say(deps, "/annula");
      expect(deps.tg.lastText()).toContain("Non ho capito. Scrivi /aiuto per l'elenco dei comandi");
      expect(deps.tg.lastText()).toContain("Nickname?");
      expect(await stateRow()).toEqual(before);
      await say(deps, "Marchino");
      expect(deps.tg.lastText()).toContain("Data di nascita?");
    });

    it("FR-018b: testo in uno step a pulsanti ripete la domanda", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "Fine");
      await say(deps, "alta");
      expect(deps.tg.lastText()).toBe("Priorità?");
      expect(labels(kb(deps))).toEqual(["Alta", "Media ✓", "Bassa"]);
      expect((await stateRow())?.step).toBe("priorita");
    });
  });

  describe("A-04, FR-018a: scadenza", () => {
    it("A-04: dopo 24 h il flusso è scaduto in silenzio", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      deps.setNow(addHours(NOW, 24));
      deps.tg.reset();
      await say(deps, "14/03/1994");
      expect(deps.tg.messages().map((m) => m.text)).toEqual(["Non ho capito. Scrivi /aiuto per l'elenco dei comandi"]);
      expect(await count("conversation_state")).toBe(0);
    });

    it("A-04: a 23 h 59 m il flusso prosegue", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      deps.setNow(new Date(addHours(NOW, 24).getTime() - 60_000));
      await say(deps, "Marchino");
      expect(deps.tg.lastText()).toContain("Data di nascita?");
    });
  });

  describe("FR-018c, R-11: pulsanti non più validi", () => {
    it("FR-018c: Salva dopo Annulla → non più disponibile", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      const saveCb = cbOf(kb(deps), "Salva");
      await tap(deps, "Annulla");
      await press(deps, saveCb);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
      expect(await count("persons")).toBe(0);
    });

    it("FR-018c: pulsante di uno step precedente → non più disponibile", async () => {
      const deps = makeDeps();
      await say(deps, "/nuovo");
      await say(deps, "Marco Rossi");
      await tap(deps, "Salta");
      await say(deps, "14/03/1994");
      const yes = cbOf(kb(deps), "Sì");
      await press(deps, yes);
      expect(deps.tg.lastText()).toContain("Telefono?");
      await press(deps, yes);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
      expect((await stateRow())?.step).toBe("telefono");
    });

    it("R-11: due Salva consecutivi → una sola persona", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      const saveCb = cbOf(kb(deps), "Salva");
      await press(deps, saveCb);
      await press(deps, saveCb);
      expect(await count("persons")).toBe(1);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    });

    it("R-11: due Salva concorrenti → una sola persona", async () => {
      const deps = makeDeps();
      await toGroups(deps);
      await groupsToSummary(deps);
      const saveCb = cbOf(kb(deps), "Salva");
      await Promise.all([press(deps, saveCb), press(deps, saveCb)]);
      expect(await count("persons")).toBe(1);
      expect(deps.tg.callbackAnswers().filter((a) => a.text === "Questa azione non è più disponibile")).toHaveLength(1);
    });

    it("R-10: ogni callback_data generato è ≤ 64 byte", async () => {
      for (let i = 0; i < 5; i++) await insertGroup(`Gruppo con un nome lungo ${i}`);
      const deps = makeDeps();
      await toGroups(deps);
      await tap(deps, "➕ Nuovo gruppo");
      await say(deps, "Beach tennis");
      await groupsToSummary(deps);
      await tap(deps, "Salva");
      const all = deps.tg.allKeyboards().flatMap((k) => k.inline_keyboard.flat());
      expect(all.length).toBeGreaterThan(10);
      // I pulsanti url e copy_text non hanno callback_data (feature 002).
      for (const b of all) {
        if ("callback_data" in b) expect(new TextEncoder().encode(b.callback_data).length).toBeLessThanOrEqual(64);
      }
    });
  });
});

describe("FR-006a: creazione al volo di un gruppo nello step Gruppi di /nuovo", () => {
  it.each(["🏖", "🏖 X"])("FR-006a: %j rifiutato con la stessa domanda", async (name) => {
    const deps = makeDeps();
    await toGroups(deps);
    await tap(deps, "➕ Nuovo gruppo");
    await say(deps, name);
    expect(deps.tg.lastText()).toBe("Il nome del gruppo deve contenere almeno 2 lettere o cifre\n\nNome del nuovo gruppo?");
    expect((await stateRow())?.step).toBe("gruppo_nuovo");
  });

  it("FR-006a: ★ Bar accettato e selezionato", async () => {
    const deps = makeDeps();
    await toGroups(deps);
    await tap(deps, "➕ Nuovo gruppo");
    await say(deps, "★ Bar");
    expect(labels(kb(deps))).toEqual(["☑ ★ Bar", "➕ Nuovo gruppo", "Fine"]);
  });
});
