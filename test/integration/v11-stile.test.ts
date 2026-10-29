import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { runAt } from "../helpers/cron";
import { csvOf } from "../helpers/csv-fixtures";
import { addToGroup, insertGroup, insertOccurrence, insertPerson } from "../helpers/db";
import { makeCronDeps, makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

// Mockup di AFU §5 e criteri di RNF-19 (SC-002): qui, e solo qui, gli attesi sono letterali.
// Oggi = mercoledì 28/10/2026, 11:00 a Roma.

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));
const rows = (deps: TestDeps) => deps.tg.lastKeyboard()?.inline_keyboard.map((r) => r.map((b) => b.text));
const openGroup = (id: number, name: string) => `g2:o:${id}:${nameHash(name)}`;

describe("§5.2: inserimento guidato", () => {
  it("criterio 1 di RNF-19: domande con l'icona del campo, ⏭ Salta, riepilogo 📋, conferma 🎉 nello stesso messaggio della scheda", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(deps.tg.lastText()).toBe("👤 Come si chiama? Nome e cognome");
    await say(deps, "Marco Rossi");
    expect(deps.tg.lastText()).toBe("💬 Come lo chiami nei messaggi? (nickname)");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["⏭ Salta"]);
    await say(deps, "Marchino");
    expect(deps.tg.lastText()).toBe("🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno");
    await say(deps, "14/03/1994");
    expect(deps.tg.lastText()).toBe("14 marzo 1994, giusto?");
    await tap(deps, "Sì");
    expect(deps.tg.lastText()).toBe("📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎");
    await tap(deps, "⏭ Salta");
    expect(deps.tg.lastText()).toBe("📸 Username Instagram?");
    await tap(deps, "⏭ Salta");
    expect(deps.tg.lastText()).toBe("✈️ Username Telegram?");
    await tap(deps, "⏭ Salta");
    expect(deps.tg.lastText()).toBe("👥 Gruppi?");
    await tap(deps, "Fine");
    expect(deps.tg.lastText()).toBe("⭐ Priorità?");
    await tap(deps, "Media ✓");
    expect(deps.tg.lastText()).toBe("✍️ Messaggio di auguri personalizzato? Se salti uso quello standard.");
    await tap(deps, "⏭ Salta");
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("📋 Riepilogo:");
    const salva = cbOf(deps.tg.lastKeyboard(), "Salva");
    deps.tg.reset();
    await press(deps, salva);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toBe(
      [
        "🎉 Fatto! Marchino è in rubrica.",
        "",
        '👤 Marco Rossi — "Marchino"',
        "🎂 14/03/1994 · compie 33 anni tra 137 giorni",
        "Priorità: media",
        "Messaggio: standard",
      ].join("\n"),
    );
  });

  it("FR-006: un messaggio personalizzato con emoji è mostrato identico nella scheda e in /messaggio", async () => {
    const id = await insertPerson({ fullName: "Anna", day: 30, month: 10, customMessage: "Auguri 🎈 {nome}!" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(deps.tg.lastText()).toContain('Messaggio: "Auguri 🎈 {nome}!"');
    await say(deps, "/messaggio");
    await say(deps, "Buon compleanno {nome} 🥳");
    expect(deps.tg.lastText()).toBe("✍️ Anteprima: «Buon compleanno Marco 🥳»\nConfermi?");
    await tap(deps, "Conferma");
    expect(deps.tg.lastText()).toBe("✅ Ho aggiornato il messaggio di auguri.");
    await say(deps, "/messaggio");
    expect(deps.tg.lastText()).toBe(
      "✍️ Messaggio attuale: «Buon compleanno {nome} 🥳»\nScrivi il nuovo messaggio di auguri. Usa {nome} per il nome.",
    );
  });
});

describe("§5.3-§5.5: promemoria", () => {
  const marco = { id: 1, fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, year: 1995, priority: "alta" as const };

  it("§5.3: reminder con 🎂 e \"!\", 📱, L'anno scorso: fatto ✅, pulsanti di contatto senza icona", async () => {
    await insertPerson({ ...marco, phone: "+393331234567", instagram: "marco.rossi", telegram: "mrossi" });
    await addToGroup(1, await insertGroup("Famiglia"));
    await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "fatto" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    expect(deps.tg.lastText()).toBe(
      [
        "🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni!",
        "Gruppi: Famiglia",
        "📱 +393331234567",
        "L'anno scorso: fatto ✅",
      ].join("\n"),
    );
    expect(labels(deps.tg.lastKeyboard())).toEqual(["WhatsApp", "Instagram", "Telegram", "Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
  });

  it("§5.4 📅 pre-reminder e §5.5 ⏰ recupero", async () => {
    await insertPerson({ ...marco, id: 2, nickname: null, fullName: "Domani", day: 15 });
    await insertPerson({ ...marco, id: 3, nickname: null, fullName: "Ieri", day: 13 });
    await insertOccurrence({ personId: 3, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    expect(deps.tg.messages().map((m) => m.text.split("\n")[0])).toEqual([
      "⏰ Ieri era il compleanno di Ieri. Hai fatto gli auguri?",
      "📅 Tra 1 giorno: compleanno di Domani (32 anni) — 15/03",
    ]);
  });
});

describe("§5.6: scheda persona", () => {
  it("titolo 👤, riga 🎂, priorità e gruppi senza emoji, pulsanti ✏️ Modifica e 🗑 Elimina", async () => {
    const id = await insertPerson({
      fullName: "Marco Rossi",
      nickname: "Marchino",
      day: 14,
      month: 3,
      year: 1994,
      phone: "+39 333 1234567",
      instagram: "marco.rossi",
      priority: "alta",
    });
    await addToGroup(id, await insertGroup("Famiglia"));
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(deps.tg.lastText()).toBe(
      [
        '👤 Marco Rossi — "Marchino"',
        "🎂 14/03/1994 · compie 33 anni tra 137 giorni",
        "Priorità: alta · Gruppi: Famiglia",
        "📱 +39 333 1234567",
        "Messaggio: standard",
      ].join("\n"),
    );
    expect(rows(deps)).toEqual([["WhatsApp", "Instagram"], ["✏️ Modifica", "🗑 Elimina"]]);
  });

  it("senza nickname il titolo è 👤 e il nome", async () => {
    const id = await insertPerson({ fullName: "Anna Bianchi", day: 30, month: 10 });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(deps.tg.lastText()?.split("\n").slice(0, 2)).toEqual(["👤 Anna Bianchi", "🎂 30/10 · compleanno tra 2 giorni"]);
  });

  it("eliminazione: richiesta ⚠️ e conferma ✅ con il nome", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    await tap(deps, "🗑 Elimina");
    expect(deps.tg.lastText()).toBe("⚠️ Vuoi eliminare Marco Rossi? Perderai anche il suo storico.");
    await tap(deps, "Sì");
    expect(deps.tg.lastText()).toBe("✅ Ho eliminato Marco Rossi.");
  });
});

describe("§5.7: liste", () => {
  it("criterio 2 di RNF-19: 📆 Prossimi 30 giorni (Famiglia) e righe allineate senza emoji", async () => {
    const gid = await insertGroup("Famiglia");
    const a = await insertPerson({ fullName: "Anna", day: 30, month: 10, year: 1998 });
    const b = await insertPerson({ fullName: "Bruno", day: 31, month: 10 });
    await addToGroup(a, gid);
    await addToGroup(b, gid);
    const deps = makeDeps();
    await say(deps, "/prossimi 30 famiglia");
    expect(deps.tg.lastText()).toBe(
      ["📆 Prossimi 30 giorni (Famiglia)", "", `Ven 30/10  Anna (28)  /p_${a}`, `Sab 31/10  Bruno      /p_${b}`].join("\n"),
    );
  });

  it("003 FR-005: lista divisa in più messaggi, emoji solo nell'intestazione del primo", async () => {
    for (let i = 0; i < 60; i++) await insertPerson({ fullName: `Persona ${String(i).padStart(2, "0")}`, day: 1 + (i % 28), month: 11 });
    const deps = makeDeps();
    await say(deps, "/prossimi 60");
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs[0]!.text.split("\n")[0]).toBe("📆 Prossimi 60 giorni");
    const righe = msgs.flatMap((m, i) => m.text.split("\n").slice(i === 0 ? 1 : 0));
    expect(righe.filter((r) => /\p{Extended_Pictographic}/u.test(r))).toEqual([]);
  });

  it("FR-021: un nome con emoji compare identico nella riga", async () => {
    const id = await insertPerson({ fullName: "🏖 Gino", day: 30, month: 10 });
    const deps = makeDeps();
    await say(deps, "/prossimi 7");
    expect(deps.tg.lastText()).toBe(["📆 Prossimi 7 giorni", "", `Ven 30/10  🏖 Gino  /p_${id}`].join("\n"));
  });

  it("viste vuote con l'emoji della vista", async () => {
    const deps = makeDeps();
    await say(deps, "/oggi");
    expect(deps.tg.lastText()).toBe("🎂 Oggi non ci sono compleanni e la rubrica è ancora vuota.");
    await say(deps, "/prossimi 7");
    expect(deps.tg.lastText()).toBe("📆 Nessun compleanno nei prossimi 7 giorni");
    await say(deps, "/mese giugno");
    expect(deps.tg.lastText()).toBe("🗓 Nessun compleanno a giugno");
    await say(deps, "/cerca zzz");
    expect(deps.tg.lastText()).toBe("🔍 Nessun risultato per «zzz»");
    await say(deps, "/scaduti");
    expect(deps.tg.lastText()).toBe("⏳ Nessun compleanno in sospeso negli ultimi 7 giorni");
  });
});

describe("§5.8: import", () => {
  const riga = (nome: string, data: string, gruppi = "") => [nome, "", data, "", "", "", gruppi, "", ""];

  it("anteprima 📥, errori ⚠️ con righe senza emoji, conferma 🎉", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([riga("Anna", "01/02", "Calcetto"), riga("Bruno", "03/04"), riga("Errata", "31/04/1990")]));
    expect(deps.tg.lastText()).toBe(
      ["📥 Anteprima import", "2 persone nuove", "⚠️ 1 errore:", '• riga 4: data "31/04/1990" non valida', "Gruppi da creare: Calcetto"].join("\n"),
    );
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Importa", "Annulla"]);
    await tap(deps, "Importa");
    expect(deps.tg.lastText()).toBe("🎉 Importate 2 persone, creato 1 gruppo.");
  });

  it("004 FR-016: export 📤 reimportato senza differenze", async () => {
    await insertPerson({ fullName: "Anna Bianchi", nickname: "Annina", day: 30, month: 10, year: 1990 });
    const deps = makeDeps();
    await say(deps, "/export");
    const doc = deps.tg.documents()[0]!;
    expect(doc.caption).toBe("📤 Ecco l'export: 1 persona.");
    await env.DB.prepare("DELETE FROM persons").run();
    await sendFile(deps, doc.name, doc.text);
    expect(deps.tg.lastText()).toBe("📥 Anteprima import\n1 persona nuova");
    await tap(deps, "Importa");
    expect(deps.tg.lastText()).toBe("🎉 Importate 1 persona, creati 0 gruppi.");
    await say(deps, "/cerca annina");
    expect(deps.tg.lastText()?.split("\n").slice(0, 2)).toEqual(['👤 Anna Bianchi — "Annina"', "🎂 30/10/1990 · compie 36 anni tra 2 giorni"]);
  });
});

describe("§5.9: gruppi", () => {
  it("elenco 👥 I tuoi gruppi e scheda 👥 <nome> · N persone", async () => {
    const gid = await insertGroup("Famiglia");
    await addToGroup(await insertPerson({ fullName: "Anna", day: 30, month: 10, year: 1990 }), gid);
    await addToGroup(await insertPerson({ fullName: "Bruno", day: 1, month: 12 }), gid);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.lastText()).toBe("👥 I tuoi gruppi");
    expect(rows(deps)).toEqual([["Famiglia (2)"], ["➕ Nuovo gruppo"]]);
    await tap(deps, "Famiglia (2)");
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 Famiglia · 2 persone");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["✏️ Rinomina", "🗑 Elimina"]);
  });

  it("ricerca: più candidati con 🔍, nessuna corrispondenza con 🔍", async () => {
    await insertGroup("Famiglia");
    await insertGroup("Famiglia Rossi");
    const deps = makeDeps();
    await say(deps, "/gruppi fam");
    expect(deps.tg.lastText()).toBe("🔍 Più gruppi corrispondono a «fam»:");
    await say(deps, "/gruppi xyz");
    expect(deps.tg.lastText()).toBe("🔍 Nessun gruppo corrisponde a «xyz».\n\n👥 I tuoi gruppi");
  });

  it("creazione ✅, eliminazione ⚠️ poi ✅, nessun gruppo 👥", async () => {
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.lastText()).toBe("👥 Non hai ancora nessun gruppo.");
    await tap(deps, "➕ Nuovo gruppo");
    await say(deps, "Amici");
    expect(deps.tg.lastText()).toBe("✅ Ho creato il gruppo Amici.\n\n👥 I tuoi gruppi");
    await tap(deps, "Amici (0)");
    await tap(deps, "🗑 Elimina");
    expect(deps.tg.lastText()).toBe("⚠️ Vuoi eliminare il gruppo Amici? Nessuna persona ha questa etichetta");
    await tap(deps, "Sì");
    expect(deps.tg.lastText()).toBe("✅ Ho eliminato il gruppo Amici.\n\n👥 Non hai ancora nessun gruppo.");
  });

  it("FR-021: un gruppo con emoji nel nome compare identico", async () => {
    const gid = await insertGroup("🏖 Mare");
    await addToGroup(await insertPerson({ fullName: "Anna", day: 30, month: 10 }), gid);
    const deps = makeDeps();
    await press(deps, openGroup(gid, "🏖 Mare"));
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 🏖 Mare · 1 persona");
  });
});

describe("RNF-19: criteri", () => {
  it("US3 scenario 5: /start contiene 👋, /aiuto inizia con 📖", async () => {
    const deps = makeDeps();
    await say(deps, "/start");
    expect(deps.tg.lastText()?.startsWith("👋 Ciao! Sono il tuo bot dei compleanni:")).toBe(true);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Aggiungi persona", "Comandi"]);
    await say(deps, "/aiuto");
    expect(deps.tg.lastText()?.split("\n").slice(0, 2)).toEqual(["📖 Ecco cosa posso fare:", "/nuovo — aggiungi una persona, un campo alla volta"]);
  });

  it("US3: successo ✅, avviso ⚠️ (possibile duplicato), errore ❌ (comando non capito, data non valida)", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
    const deps = makeDeps();
    await say(deps, "/pippo");
    expect(deps.tg.lastText()).toBe("❌ Non ho capito. Scrivi /aiuto per vedere cosa so fare.");

    await say(deps, "/nuovo");
    await say(deps, "marco rossi");
    await tap(deps, "⏭ Salta");
    await say(deps, "31/04/1994");
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("❌ Data non valida. Usa gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994).");
    await say(deps, "14/03/1994");
    await tap(deps, "Sì");
    for (let i = 0; i < 3; i++) await tap(deps, "⏭ Salta");
    await tap(deps, "Fine");
    await tap(deps, "Media ✓");
    await tap(deps, "⏭ Salta");
    await tap(deps, "Salva");
    expect(deps.tg.lastText()).toBe("⚠️ Hai già Marco Rossi con data 14/03/1994: potrebbe essere un duplicato. Vuoi salvarlo comunque?");
    await tap(deps, "Annulla");
    expect(deps.tg.lastText()).toBe("Ok, ho annullato.");

    await say(deps, `/p_${id}`);
    await tap(deps, "✏️ Modifica");
    expect(deps.tg.lastText()).toBe("✏️ Quale campo vuoi modificare?");
    await tap(deps, "Instagram");
    expect(deps.tg.lastText()).toBe("📸 Nuovo username Instagram?");
    await say(deps, "marco.rossi");
    expect(deps.tg.lastText()?.split("\n").slice(0, 3)).toEqual(["✅ Ho aggiornato Marco Rossi.", "", "👤 Marco Rossi"]);

    await say(deps, "/annulla");
    expect(deps.tg.lastText()).toBe("Non c'è nessuna operazione da annullare.");
  });
});
