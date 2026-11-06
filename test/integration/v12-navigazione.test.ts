import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { T } from "../../src/texts";
import { STRANGER_ID } from "../helpers/constants";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, labels } from "../helpers/fake-telegram";
import { press, say, send } from "../helpers/send";
import { callbackUpdate } from "../helpers/updates";

// Revisioni v1.2, pulsanti di passo successivo (feature 009, US4, US5, US6, RNF-14; REV-011).
// Oggi = mercoledì 28/10/2026, salvo dove indicato.

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));
const header = (deps: TestDeps) => deps.tg.lastText()?.split("\n")[0];
const at = (iso: string) => new Date(iso);

// Il tocco manda un messaggio nuovo e non modifica quelli già inviati (FR-017).
async function tapNew(deps: TestDeps, data: string): Promise<void> {
  const before = deps.tg.messages().length;
  await press(deps, data);
  expect(deps.tg.messages().length).toBeGreaterThan(before);
  expect(deps.tg.edits()).toHaveLength(0);
  expect(deps.tg.textEdits()).toHaveLength(0);
}

// Pulsante non valido: solo la risposta al tocco, nessun messaggio.
async function expectUnavailable(deps: TestDeps, data: string): Promise<void> {
  deps.tg.reset();
  await press(deps, data);
  expect(deps.tg.messages()).toHaveLength(0);
  expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
}

describe("009 US4 — RF-20: scorrere i mesi", () => {
  it("RF-20, FR-019 (US4-1): /mese marzo → [◀️ Febbraio] [Aprile ▶️]; il tocco apre aprile in un nuovo messaggio", async () => {
    await insertPerson({ fullName: "Anna", day: 14, month: 3 });
    const bea = await insertPerson({ fullName: "Bea", day: 2, month: 4 });
    const deps = makeDeps();
    await say(deps, "/mese marzo");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["◀️ Febbraio", "s:m:2"],
      ["Aprile ▶️", "s:m:4"],
    ]);
    expect(deps.tg.lastKeyboard()!.inline_keyboard).toHaveLength(1);
    const marzo = deps.tg.messages()[0]!.text;
    await tapNew(deps, "s:m:4");
    expect(header(deps)).toBe(T.monthHeader("aprile", 2027));
    expect(commandParts(deps.tg.messages().at(-1)!)).toEqual([`/p_${bea}`]);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["◀️ Marzo", "Maggio ▶️"]);
    expect(deps.tg.messages()[0]!.text).toBe(marzo);
  });

  it.each([
    ["dicembre", ["◀️ Novembre", "Gennaio ▶️"]],
    ["gennaio", ["◀️ Dicembre", "Febbraio ▶️"]],
  ])("RF-20, SC-004 (US4-2, US4-3): /mese %s è circolare", async (mese, attesi) => {
    const deps = makeDeps();
    await say(deps, `/mese ${mese}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(attesi);
  });

  it("RF-20, R-04 di 003 (US4-4): al 29/10/2026 [◀️ Settembre] apre settembre 2027", async () => {
    const deps = makeDeps({ now: at("2026-10-29T10:00:00.000Z") });
    await say(deps, "/mese");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["◀️ Settembre", "Novembre ▶️"]);
    await tap(deps, "◀️ Settembre");
    expect(header(deps)).toBe(T.monthNone("settembre"));
    await insertPerson({ fullName: "Sara", day: 5, month: 9 });
    await press(deps, "s:m:9");
    expect(header(deps)).toBe(T.monthHeader("settembre", 2027));
  });

  it("RF-20: mese vuoto → «🗓 Nessun compleanno a …» con i pulsanti", async () => {
    const deps = makeDeps();
    await say(deps, "/mese giugno");
    expect(deps.tg.lastText()).toBe(T.monthNone("giugno"));
    expect(labels(deps.tg.lastKeyboard())).toEqual(["◀️ Maggio", "Luglio ▶️"]);
  });

  it("RF-20: mese non valido → errore senza pulsanti", async () => {
    const deps = makeDeps();
    await say(deps, "/mese marzzo");
    expect(deps.tg.lastText()).toBe(T.monthInvalid);
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-20, FR-019: anno di riferimento ricalcolato al tocco, a cavallo di capodanno", async () => {
    await insertPerson({ fullName: "Dario", day: 10, month: 12 });
    const deps = makeDeps({ now: at("2026-12-31T10:00:00.000Z") });
    await say(deps, "/mese novembre");
    const data = cbOf(deps.tg.lastKeyboard(), "Dicembre ▶️");
    deps.setNow(at("2027-01-01T10:00:00.000Z"));
    await press(deps, data);
    expect(header(deps)).toBe(T.monthHeader("dicembre", 2027));
  });

  it.each(["s:m", "s:m:0", "s:m:13"])("RNF-14, R-01: %s → azione non disponibile", async (data) => {
    await expectUnavailable(makeDeps(), data);
  });
});

describe("009 US4 — RF-22: scorrere gli anni", () => {
  it("RF-22, FR-020 (US4-5): /anno con storico 2025 → solo [◀️ 2025]", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 1, month: 3 });
    await insertOccurrence({ personId: p, year: 2025, effectiveDate: "2025-03-01", status: "fatto" });
    const deps = makeDeps();
    await say(deps, "/anno");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["◀️ 2025", "s:y:2025"]]);
  });

  it("RF-22, FR-020 (US4-6): tocco s:y:2025 senza storico 2024 → solo [2026 ▶️], nuovo messaggio", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 1, month: 3 });
    await insertOccurrence({ personId: p, year: 2025, effectiveDate: "2025-03-01", status: "saltato" });
    const deps = makeDeps();
    await say(deps, "/anno");
    const first = deps.tg.messages()[0]!.text;
    await tapNew(deps, "s:y:2025");
    expect(header(deps)).toBe(T.yearHeader(2025));
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["2026 ▶️", "s:y:2026"]]);
    expect(deps.tg.messages()[0]!.text).toBe(first);
  });

  it("RF-22 (US4-7): primo anno d'uso → nessun pulsante", async () => {
    const deps = makeDeps();
    await say(deps, "/anno");
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-22 (US4-8): /anno 2023 senza storico 2022 → solo [2024 ▶️]", async () => {
    const deps = makeDeps();
    await say(deps, "/anno 2023");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["2024 ▶️", "s:y:2024"]]);
  });

  it("RF-22: anno passato con storico nell'anno prima → entrambi i pulsanti", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 1, month: 3 });
    await insertOccurrence({ personId: p, year: 2023, effectiveDate: "2023-03-01", status: "non_confermato" });
    const deps = makeDeps();
    await say(deps, "/anno 2024");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["◀️ 2023", "2025 ▶️"]);
  });

  it("RF-22, research R-06: solo occorrenze aperte nell'anno prima → nessun ◀️", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 1, month: 3 });
    await insertOccurrence({ personId: p, year: 2025, effectiveDate: "2025-03-01", status: "aperta" });
    const deps = makeDeps();
    await say(deps, "/anno");
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-22: anno non valido o futuro → errore senza pulsanti", async () => {
    const deps = makeDeps();
    await say(deps, "/anno 2027");
    expect(deps.tg.lastText()).toBe(T.yearInvalid(1900, 2026));
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-22, FR-020: anno corrente cambiato al tocco → pulsanti calcolati al tocco", async () => {
    const deps = makeDeps({ now: at("2026-12-31T10:00:00.000Z") });
    await say(deps, "/anno 2025");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["2026 ▶️"]);
    deps.setNow(at("2027-01-01T10:00:00.000Z"));
    await tap(deps, "2026 ▶️");
    expect(header(deps)).toBe(T.yearHeader(2026));
    expect(labels(deps.tg.lastKeyboard())).toEqual(["2027 ▶️"]);
  });

  it.each(["s:y", "s:y:12", "s:y:2027", "s:y:1899"])("RNF-14, R-01: %s → azione non disponibile", async (data) => {
    await expectUnavailable(makeDeps(), data);
  });
});

describe("009 US5 — RF-17: allargare /prossimi a 90 giorni", () => {
  it("RF-17, FR-018 (US5-1): /prossimi → [Prossimi 90 giorni]; il tocco s:u dà i prossimi 90 giorni di tutti", async () => {
    await insertPerson({ fullName: "Vicina", day: 1, month: 11 });
    const lontana = await insertPerson({ fullName: "Lontana", day: 20, month: 1 });
    const deps = makeDeps();
    await say(deps, "/prossimi");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["Prossimi 90 giorni", "s:u"]]);
    await tapNew(deps, "s:u");
    expect(header(deps)).toBe(T.upcomingHeader(90, null));
    expect(commandParts(deps.tg.messages().at(-1)!)).toContain(`/p_${lontana}`);
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RF-17, FR-018 (US5-2): /prossimi 7 famiglia → g2:p:<id>:<h>:90; il tocco filtra il gruppo", async () => {
    const fam = await insertGroup("Famiglia");
    const a = await insertPerson({ fullName: "Anna", day: 20, month: 12 });
    await insertPerson({ fullName: "Fuori", day: 21, month: 12 });
    await addToGroup(a, fam);
    const deps = makeDeps();
    await say(deps, "/prossimi 7 famiglia");
    expect(deps.tg.lastText()).toBe(T.upcomingNone(7, "Famiglia"));
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["Prossimi 90 giorni", `g2:p:${fam}:${nameHash("Famiglia")}:90`]]);
    await tap(deps, "Prossimi 90 giorni");
    expect(header(deps)).toBe(T.upcomingHeader(90, "Famiglia"));
    expect(commandParts(deps.tg.messages().at(-1)!)).toEqual([`/p_${a}`]);
  });

  it("RF-17 (US5-3): /prossimi 120 → nessun pulsante", async () => {
    await insertPerson({ fullName: "Anna", day: 1, month: 11 });
    const deps = makeDeps();
    await say(deps, "/prossimi 120");
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it.each([
    ["eliminato", (id: number) => env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(id).run()],
    ["rinominato", (id: number) => env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = ?").bind(id).run()],
  ])("RF-17, 005 FR-005 (US5-4): gruppo %s prima del tocco → «Questo gruppo non esiste più» + elenco", async (_l, change) => {
    const fam = await insertGroup("Famiglia");
    const deps = makeDeps();
    await say(deps, "/prossimi famiglia");
    await change(fam);
    await tap(deps, "Prossimi 90 giorni");
    expect(deps.tg.lastText()?.startsWith(`${T.groupGone}\n\n`)).toBe(true);
  });

  it("RF-17 (US5-5): lista vuota con il pulsante", async () => {
    const deps = makeDeps();
    await say(deps, "/prossimi");
    expect(deps.tg.lastText()).toBe(T.upcomingNone(30, null));
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Prossimi 90 giorni"]);
  });

  it("RF-17: gruppo scelto tra più candidati → il pulsante conserva il gruppo", async () => {
    await insertGroup("Famiglia");
    const rossi = await insertGroup("Famiglia Rossi");
    const deps = makeDeps();
    await say(deps, "/prossimi 7 fam");
    expect(deps.tg.lastText()).toBe(T.groupsMany("fam"));
    await tap(deps, "Famiglia Rossi (0)");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["Prossimi 90 giorni", `g2:p:${rossi}:${nameHash("Famiglia Rossi")}:90`]]);
  });

  it.each(["/prossimi 0", "/prossimi 400", "/prossimi xyz", "/prossimi 7 fam"])("RF-17: %s → nessun pulsante di passo successivo", async (cmd) => {
    await insertGroup("Famiglia");
    await insertGroup("Famiglia Rossi");
    const deps = makeDeps();
    await say(deps, cmd);
    expect(labels(deps.tg.lastKeyboard())).not.toContain("Prossimi 90 giorni");
  });

  it("RNF-14, R-01: s:u:5 → azione non disponibile", async () => {
    await expectUnavailable(makeDeps(), "s:u:5");
  });
});

// /nuovo fino alla conferma, con data 14/03/1994 e soli campi obbligatori.
async function nuovo(deps: TestDeps, fullName: string, nickname: string): Promise<void> {
  await say(deps, "/nuovo");
  await say(deps, fullName);
  await say(deps, nickname);
  await say(deps, "14/03/1994");
  await tap(deps, "Sì");
  for (let i = 0; i < 3; i++) await tap(deps, T.btnSkip);
  await tap(deps, "Fine");
  await tap(deps, "Media ✓");
  await tap(deps, T.btnSkip);
  await tap(deps, "Salva");
}

describe("009 US6 — RF-01: [➕ Aggiungi un'altra persona]", () => {
  it("RF-01, FR-021 (US6-1): conferma con il pulsante su una riga a sé in fondo", async () => {
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    expect(deps.tg.lastText()?.startsWith("🎉 Fatto! Marchino è in rubrica.\n\n")).toBe(true);
    expect(deps.tg.lastKeyboard()!.inline_keyboard.at(-1)).toEqual([{ text: "➕ Aggiungi un'altra persona", callback_data: "s:n" }]);
  });

  it("RF-01, FR-022 (US6-2): il tocco chiede il nome in un nuovo messaggio", async () => {
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    await tapNew(deps, "s:n");
    expect(deps.tg.lastText()).toBe(T.askFullName);
    expect(await count("conversation_state", "flow = 'nuovo'")).toBe(1);
  });

  it("RF-01, FR-021 (US6-3): /p_<id> e ridisegno dopo una modifica senza il pulsante", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3, instagram: "marco" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    expect(labels(deps.tg.lastKeyboard())).not.toContain(T.btnAddAnother);
    await press(deps, `p:m:${id}`);
    await tap(deps, "Instagram");
    await tap(deps, "Svuota");
    expect(labels(deps.tg.lastKeyboard())).toEqual([T.btnEdit, T.btnDelete]);
  });

  it("RF-01, 001 FR-018 (US6-4): tocco durante un altro flusso → flusso interrotto senza salvare", async () => {
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    const confirm = deps.tg.lastKeyboard();
    await say(deps, "/nuovo");
    await say(deps, "Lucia Verdi");
    await press(deps, cbOf(confirm, T.btnAddAnother));
    expect(deps.tg.lastText()).toBe(T.askFullName);
    expect(await count("persons")).toBe(1);
    expect(await count("conversation_state", "flow = 'nuovo' AND step = 'nome'")).toBe(1);
  });

  it("RF-01 (US6-5): tocco ripetuto dopo aver risposto al nome → ricomincia dal nome", async () => {
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    const confirm = deps.tg.lastKeyboard();
    await press(deps, cbOf(confirm, T.btnAddAnother));
    await say(deps, "Lucia Verdi");
    expect(deps.tg.lastText()).toBe(T.askNickname);
    await press(deps, cbOf(confirm, T.btnAddAnother));
    expect(deps.tg.lastText()).toBe(T.askFullName);
  });

  it("RF-01: dopo «Salva comunque» la conferma ha il pulsante", async () => {
    await insertPerson({ fullName: "marco rossi", day: 14, month: 3, year: 1994 });
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    expect(deps.tg.lastText()).toBe(T.possibleDuplicate("marco rossi", "14/03/1994"));
    await tap(deps, "Salva comunque");
    expect(labels(deps.tg.lastKeyboard()).at(-1)).toBe(T.btnAddAnother);
  });

  it("RF-01, FR-022: persona eliminata nel frattempo → il pulsante funziona", async () => {
    const deps = makeDeps();
    await nuovo(deps, "Marco Rossi", "Marchino");
    const confirm = deps.tg.lastKeyboard();
    await env.DB.prepare("DELETE FROM persons").run();
    await press(deps, cbOf(confirm, T.btnAddAnother));
    expect(deps.tg.lastText()).toBe(T.askFullName);
  });

  it("RF-01, FR-021: /cerca con un risultato e Segna fatto senza il pulsante", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 25, month: 10 });
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await say(deps, "/cerca marco");
    expect(labels(deps.tg.lastKeyboard())).not.toContain(T.btnAddAnother);
    await press(deps, `p:f:${id}`, 321);
    expect(labels(deps.tg.textEdits()[0]!.keyboard)).not.toContain(T.btnAddAnother);
  });
});

describe("009 RNF-14: regole comuni dei pulsanti di passo successivo", () => {
  it("RNF-14: al più 2 pulsanti di passo successivo per vista", async () => {
    const p = await insertPerson({ fullName: "Anna", day: 1, month: 11 });
    await insertOccurrence({ personId: p, year: 2023, effectiveDate: "2023-11-01", status: "fatto" });
    const deps = makeDeps();
    for (const cmd of ["/prossimi", "/mese", "/anno 2024"]) {
      await say(deps, cmd);
      expect(labels(deps.tg.lastKeyboard()).length).toBeLessThanOrEqual(2);
    }
  });

  it("RNF-14, FR-016: vista spezzata → tastiera solo sull'ultimo messaggio, nessun pulsante sulle righe", async () => {
    await env.DB.batch(
      Array.from({ length: 120 }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO persons (full_name, full_name_norm, birth_day, birth_month, priority, created_at, updated_at)
           VALUES (?, ?, ?, 3, 'media', 'x', 'x')`,
        ).bind(`Persona ${i}`, `persona ${i}`, (i % 28) + 1),
      ),
    );
    const deps = makeDeps();
    await say(deps, "/mese marzo");
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.slice(0, -1).every((m) => m.keyboard === undefined)).toBe(true);
    expect(labels(msgs.at(-1)!.keyboard)).toEqual(["◀️ Febbraio", "Aprile ▶️"]);
    expect(msgs.flatMap(commandParts)).toHaveLength(120);
  });

  it("RNF-14, FR-016: /cerca con più risultati senza pulsanti", async () => {
    await insertPerson({ fullName: "Marco Rossi", day: 1, month: 1 });
    await insertPerson({ fullName: "Marco Bianchi", day: 2, month: 1 });
    const deps = makeDeps();
    await say(deps, "/cerca marco");
    expect(deps.tg.lastKeyboard()).toBeUndefined();
  });

  it("RNF-14, 001 FR-018: un pulsante premuto durante un flusso guidato lo sostituisce", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    expect(await count("conversation_state")).toBe(1);
    await press(deps, "s:m:3");
    expect(header(deps)).toBe(T.monthNone("marzo"));
    expect(await count("conversation_state")).toBe(0);
    expect(await count("persons")).toBe(0);
  });

  it.each(["g2:l", "g2:s", "s:u", "s:m:3", "s:y:2025"])("RF-30: %s da un estraneo → nessuna risposta", async (data) => {
    const deps = makeDeps();
    await send(deps, callbackUpdate(STRANGER_ID, data));
    expect(deps.tg.calls).toEqual([]);
  });

  it("FR-029, FR-030: un g2:o di un elenco già in chat apre una scheda con [⬅️ Tutti i gruppi]", async () => {
    const gid = await insertGroup("Famiglia");
    const deps = makeDeps();
    await press(deps, `g2:o:${gid}:${nameHash("Famiglia")}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["✏️ Rinomina", "🗑 Elimina", "⬅️ Tutti i gruppi"]);
  });
});
