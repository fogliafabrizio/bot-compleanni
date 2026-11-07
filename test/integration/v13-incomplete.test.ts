import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { T } from "../../src/texts";
import { STRANGER_ID } from "../helpers/constants";
import { addToGroup, count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, monoParts, type SendCall } from "../helpers/fake-telegram";
import { press, say, send, shareContact } from "../helpers/send";
import { callbackUpdate } from "../helpers/updates";

// Profili incompleti (REV-013: RF-50, RF-32, RF-28, RNF-14, FR-008…FR-020). Oggi = mercoledì
// 28/10/2026 (NOW dei test).

const MENU_TEXT = `${T.incompleteTitle}\n${T.incompleteQuestion}`;

// Tastiera del menu come righe di [etichetta, callback_data].
const menuRows = (m: SendCall) => (m.keyboard?.inline_keyboard ?? []).map((r) => r.map((b) => [b.text, "callback_data" in b ? b.callback_data : ""]));

const expectedMenu = (c: { telefono: number; instagram: number; telegram: number; anno: number; contatti: number }) => [
  [
    [`Telefono (${c.telefono})`, "s:i:1"],
    [`Instagram (${c.instagram})`, "s:i:2"],
  ],
  [
    [`Telegram (${c.telegram})`, "s:i:3"],
    [`Anno di nascita (${c.anno})`, "s:i:4"],
  ],
  [[`Nessun contatto (${c.contatti})`, "s:i:5"]],
];

// Nessun messaggio modificato e nessuna tastiera sui messaggi delle liste.
function expectPlainLists(deps: TestDeps): void {
  expect(deps.tg.edits()).toHaveLength(0);
  expect(deps.tg.textEdits()).toHaveLength(0);
  for (const m of deps.tg.messages()) expect(m.keyboard).toBeUndefined();
}

async function expectUnavailable(deps: TestDeps, data: string): Promise<void> {
  deps.tg.reset();
  await press(deps, data);
  expect(deps.tg.messages()).toHaveLength(0);
  expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
}

// Valori grezzi che il bot non scrive ma che possono esistere in produzione (FR-024).
const setRaw = (id: number, col: "instagram" | "telegram" | "birth_year", v: string) =>
  env.DB.prepare(`UPDATE persons SET ${col} = ? WHERE id = ?`).bind(v, id).run();

// 41 senza telefono (con Instagram, senza Telegram), 3 con telefono e Telegram ma senza Instagram né anno.
async function seedRubrica(): Promise<void> {
  for (let i = 1; i <= 41; i++) {
    await insertPerson({ id: i, fullName: `Persona ${String(i).padStart(2, "0")}`, day: ((i - 1) % 28) + 1, month: 11, year: 1990, instagram: `ig${i}` });
  }
  for (let i = 42; i <= 44; i++) {
    await insertPerson({ id: i, fullName: `Contatto ${i}`, day: 1, month: 12, year: null, phone: `+3933300000${i}`, telegram: `tg${i}` });
  }
}
const SEED_COUNTS = { telefono: 41, instagram: 3, telegram: 41, anno: 3, contatti: 0 };

describe("RF-50 (v1.3): /incomplete", () => {
  it("US2-1, FR-009: /incomplete → titolo, domanda e 5 pulsanti con i conteggi, due per riga", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/incomplete");
    const msgs = deps.tg.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("📝 Profili incompleti\nQuale dato manca?");
    expect(menuRows(msgs[0]!)).toEqual(expectedMenu(SEED_COUNTS));
  });

  it("US2-2, FR-010, FR-012: tocco s:i:1 → nuovo messaggio «Senza telefono · 41 persone», righe /p_<id>, nessuna tastiera, menu non modificato", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/incomplete");
    const data = cbOf(deps.tg.lastKeyboard(), "Telefono (41)");
    expect(data).toBe("s:i:1");
    deps.tg.reset();
    await press(deps, data);
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]!.text.split("\n")[0]).toBe("📝 Senza telefono · 41 persone");
    expect(msgs[0]!.text.split("\n")[1]).toBe("");
    const ids = msgs.flatMap(commandParts);
    expect(ids).toHaveLength(41);
    // Prossimo compleanno: dal 01/11 in poi (oggi 28/10), giorno crescente.
    expect(ids.slice(0, 3)).toEqual(["/p_1", "/p_29", "/p_2"]);
    expectPlainLists(deps);
  });

  it("US2-3: /incomplete instagram → lista diretta", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/incomplete instagram");
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("📝 Senza Instagram · 3 persone");
    expect(commandParts(deps.tg.messages()[0]!)).toEqual(["/p_42", "/p_43", "/p_44"]);
    expectPlainLists(deps);
  });

  it("US2-4, FR-011: /incomplete Anno → lista senza anno di nascita", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/incomplete Anno");
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("📝 Senza anno di nascita · 3 persone");
  });

  it("US2-5, FR-011: /incomplete email → errore ❌ e poi il menu", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/incomplete email");
    const msgs = deps.tg.messages();
    expect(msgs.map((m) => m.text)).toEqual([T.incompleteUnknown, MENU_TEXT]);
    expect(msgs[0]!.keyboard).toBeUndefined();
    expect(menuRows(msgs[1]!)).toEqual(expectedMenu(SEED_COUNTS));
  });

  it("US2-6: Marco con solo Instagram → in Telefono e Telegram, non in Nessun contatto", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, instagram: "marco" });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 15, month: 3 });
    const deps = makeDeps();
    const list = async (arg: string) => {
      deps.tg.reset();
      await say(deps, `/incomplete ${arg}`);
      return deps.tg.messages().flatMap(commandParts);
    };
    expect(await list("telefono")).toEqual(["/p_1", "/p_2"]);
    expect(await list("telegram")).toEqual(["/p_1", "/p_2"]);
    expect(await list("instagram")).toEqual(["/p_2"]);
    expect(await list("contatti")).toEqual(["/p_2"]);
  });

  it("US2-7, FR-013: tutti con il telefono → [Telefono (0)] e «Tutte le persone hanno il telefono.»", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1990, phone: "+393331234567", instagram: "m", telegram: "m" });
    const deps = makeDeps();
    await say(deps, "/incomplete");
    expect(menuRows(deps.tg.messages()[0]!)).toEqual(expectedMenu({ telefono: 0, instagram: 0, telegram: 0, anno: 0, contatti: 0 }));
    deps.tg.reset();
    await press(deps, "s:i:1");
    expect(deps.tg.messages().map((m) => m.text)).toEqual(["✅ Tutte le persone hanno il telefono."]);
  });

  it("US2-8: aggiunta del telefono con Modifica → /incomplete telefono non elenca più la persona", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 15, month: 3 });
    const deps = makeDeps();
    await press(deps, "p:m:1");
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Telefono"));
    await shareContact(deps, "393331234567");
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Sì"));
    expect((await rows<{ phone: string }>("SELECT phone FROM persons WHERE id = 1"))[0]!.phone).toBe("+393331234567");
    deps.tg.reset();
    await say(deps, "/incomplete telefono");
    expect(deps.tg.messages().flatMap(commandParts)).toEqual(["/p_2"]);
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("📝 Senza telefono · 1 persona");
  });

  it("US2-9, FR-012: lista lunga → più messaggi, intestazione solo sul primo, righe intere, nessun pulsante", async () => {
    for (let i = 1; i <= 120; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: ((i - 1) % 28) + 1, month: ((i - 1) % 12) + 1 });
    const deps = makeDeps();
    await say(deps, "/incomplete telefono");
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs[0]!.text.startsWith("📝 Senza telefono · 120 persone")).toBe(true);
    for (const m of msgs.slice(1)) expect(m.text.includes("📝")).toBe(false);
    for (const m of msgs) for (const line of m.text.split("\n").slice(m === msgs[0] ? 2 : 0)) expect(line).toMatch(/\/p_\d+$/);
    expect(msgs.flatMap(commandParts)).toHaveLength(120);
    expectPlainLists(deps);
  });
});

describe("RF-50, FR-008…FR-015 (v1.3): casi limite di /incomplete", () => {
  it.each(["telefoni", "ig", "contatto", "telefono famiglia"])("FR-011: /incomplete %s → errore e menu", async (arg) => {
    const deps = makeDeps();
    await say(deps, `/incomplete ${arg}`);
    expect(deps.tg.messages().map((m) => m.text)).toEqual([T.incompleteUnknown, MENU_TEXT]);
  });

  it.each(["/incomplete  TELEFONO ", "/incomplete@nomebot telefono"])("FR-011: «%s» → lista del telefono", async (cmd) => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, cmd);
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("📝 Senza telefono · 1 persona");
  });

  it("FR-008, FR-024: valori '' e di soli spazi contano come mancanti e non vengono modificati", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1990 });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 15, month: 3, year: 1990 });
    await setRaw(1, "instagram", "  ");
    await setRaw(1, "telegram", "");
    await setRaw(2, "birth_year", "   ");
    const before = await rows("SELECT id, phone, instagram, telegram, birth_year FROM persons ORDER BY id");
    const deps = makeDeps();
    await say(deps, "/incomplete");
    expect(menuRows(deps.tg.messages()[0]!)).toEqual(expectedMenu({ telefono: 2, instagram: 2, telegram: 2, anno: 1, contatti: 2 }));
    deps.tg.reset();
    await say(deps, "/incomplete anno");
    expect(deps.tg.messages().flatMap(commandParts)).toEqual(["/p_2"]);
    expect(await rows("SELECT id, phone, instagram, telegram, birth_year FROM persons ORDER BY id")).toEqual(before);
  });

  it("FR-009, FR-013: rubrica vuota → 5 pulsanti a 0 e «La rubrica è vuota» per ogni filtro", async () => {
    const deps = makeDeps();
    await say(deps, "/incomplete");
    expect(menuRows(deps.tg.messages()[0]!)).toEqual(expectedMenu({ telefono: 0, instagram: 0, telegram: 0, anno: 0, contatti: 0 }));
    for (const code of [1, 2, 3, 4, 5]) {
      deps.tg.reset();
      await press(deps, `s:i:${code}`);
      expect(deps.tg.messages().map((m) => m.text)).toEqual(["📝 La rubrica è vuota: non ci sono persone."]);
    }
  });

  it("RF-50: tocco su un menu vecchio → dati attuali", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/incomplete");
    expect(buttons(deps.tg.lastKeyboard())[0]).toEqual(["Telefono (1)", "s:i:1"]);
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 15, month: 3 });
    deps.tg.reset();
    await press(deps, "s:i:1");
    expect(deps.tg.lastText()!.split("\n")[0]).toBe("📝 Senza telefono · 2 persone");
  });

  it("§5.7, FR-012: persona senza anno (NULL, '' o spazi) → riga senza età, in /incomplete anno e negli altri filtri", async () => {
    await insertPerson({ id: 1, fullName: "Anna", day: 30, month: 10, year: null });
    await insertPerson({ id: 2, fullName: "Bea", day: 31, month: 10, year: 1990 });
    await insertPerson({ id: 3, fullName: "Carla", day: 1, month: 11, year: 1990 });
    await setRaw(2, "birth_year", "");
    await setRaw(3, "birth_year", "   ");
    const deps = makeDeps();
    for (const arg of ["anno", "telefono"]) {
      deps.tg.reset();
      await say(deps, `/incomplete ${arg}`);
      const m = deps.tg.messages()[0]!;
      expect(commandParts(m)).toEqual(["/p_1", "/p_2", "/p_3"]);
      for (const part of monoParts(m)) expect(part).not.toMatch(/\(/);
    }
  });

  it("001 FR-012a: persona eliminata dopo la lista → la lista resta com'era e /p_<id> risponde come oggi", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/incomplete telefono");
    await env.DB.prepare("DELETE FROM persons WHERE id = 1").run();
    deps.tg.reset();
    await say(deps, "/p_1");
    expect(deps.tg.lastText()).toBe(T.personNotFound);
    expect(deps.tg.edits()).toHaveLength(0);
    expect(deps.tg.textEdits()).toHaveLength(0);
  });

  it("FR-012: persona senza gruppi presente come le altre; nessun gruppo nelle righe", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 15, month: 3 });
    await addToGroup(2, await insertGroup("Famiglia"));
    const deps = makeDeps();
    await say(deps, "/incomplete telefono");
    expect(commandParts(deps.tg.messages()[0]!)).toEqual(["/p_1", "/p_2"]);
    expect(deps.tg.lastText()).not.toContain("Famiglia");
  });

  it.each([
    ["comando", (deps: TestDeps) => say(deps, "/incomplete")],
    ["tocco s:i:1", (deps: TestDeps) => press(deps, "s:i:1")],
  ])("001 FR-018: %s durante un flusso guidato → flusso interrotto senza salvare", async (_label, act) => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    expect(await count("conversation_state")).toBe(1);
    await act(deps);
    expect(await count("conversation_state")).toBe(0);
    expect(await count("persons")).toBe(0);
  });

  it.each(["s:i", "s:i:1"])("RF-30: %s da un estraneo → nessuna risposta", async (data) => {
    const deps = makeDeps();
    await send(deps, callbackUpdate(STRANGER_ID, data));
    expect(deps.tg.calls).toEqual([]);
  });

  it.each(["s:i:0", "s:i:6", "s:i:1:2", "s:i:x", "s:i:999999999999999"])("FR-010: %s → «Questa azione non è più disponibile», nessun messaggio", async (data) => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await expectUnavailable(makeDeps(), data);
  });

  it("SC-005: «Nessun contatto» = «Senza contatti» e «Anno di nascita» = «Senza anno di nascita» di /statistiche; conteggi = liste", async () => {
    await seedRubrica();
    await insertPerson({ id: 45, fullName: "Zeta", day: 2, month: 2 });
    await setRaw(45, "instagram", " ");
    await insertPerson({ id: 46, fullName: "Ypsilon", day: 3, month: 2, year: 1980 });
    await setRaw(46, "birth_year", "");
    const deps = makeDeps();
    await say(deps, "/incomplete");
    const menu = buttons(deps.tg.lastKeyboard()).map(([label]) => Number(label.match(/\((\d+)\)$/)![1]));
    deps.tg.reset();
    await say(deps, "/statistiche");
    const stats = deps.tg.messages().map((m) => m.text).join("\n");
    const [, senzaAnno, senzaContatti] = stats.match(/Senza anno di nascita: (\d+) · Senza contatti: (\d+)/)!.map(Number);
    expect(menu[3]).toBe(senzaAnno);
    expect(menu[4]).toBe(senzaContatti);
    expect(menu).toEqual([43, 5, 43, 5, 2]);
    for (const [i, n] of menu.entries()) {
      deps.tg.reset();
      await press(deps, `s:i:${i + 1}`);
      expect(deps.tg.messages().flatMap(commandParts)).toHaveLength(n);
    }
  });
});

describe("RF-32, RF-28 (v1.3): da /statistiche ai profili incompleti", () => {
  it("US3-1, FR-016: /statistiche → [📝 Profili incompleti] in fondo; il tocco s:i manda il menu di /incomplete, /statistiche non modificata", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/statistiche");
    const stats = deps.tg.messages();
    expect(buttons(stats.at(-1)!.keyboard)).toEqual([["📝 Profili incompleti", "s:i"]]);
    deps.tg.reset();
    await press(deps, "s:i");
    const fromButton = deps.tg.messages();
    deps.tg.reset();
    await say(deps, "/incomplete");
    expect(fromButton).toEqual(deps.tg.messages());
    expect(fromButton[0]!.text).toBe(MENU_TEXT);
    expect(deps.tg.edits()).toHaveLength(0);
    expect(deps.tg.textEdits()).toHaveLength(0);
  });

  it("US3-2: rubrica vuota → pulsante presente, filtri a 0", async () => {
    const deps = makeDeps();
    await say(deps, "/statistiche");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["📝 Profili incompleti", "s:i"]]);
    deps.tg.reset();
    await press(deps, "s:i");
    expect(menuRows(deps.tg.messages()[0]!)).toEqual(expectedMenu({ telefono: 0, instagram: 0, telegram: 0, anno: 0, contatti: 0 }));
  });

  it("US3-3, FR-017: «Senza anno di nascita» e «Senza contatti» restano testo, un solo pulsante nella vista", async () => {
    await seedRubrica();
    const deps = makeDeps();
    await say(deps, "/statistiche");
    const all = deps.tg.messages().flatMap((m) => buttons(m.keyboard));
    expect(all).toEqual([["📝 Profili incompleti", "s:i"]]);
    expect(deps.tg.messages().map((m) => m.text).join("\n")).toContain("Senza anno di nascita: 3 · Senza contatti: 0");
  });

  it("US3-4, RF-28: /aiuto contiene la riga di /incomplete [campo]; /start invariato", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    expect(deps.tg.lastText()).toContain(
      "/incomplete [campo] — profili incompleti: pulsanti dei filtri con i conteggi; con un campo (telefono, instagram, telegram, anno, contatti) la lista",
    );
    deps.tg.reset();
    await say(deps, "/start");
    expect(deps.tg.lastText()).toBe(T.welcome);
  });

  it("RNF-14: /statistiche spezzata → pulsante solo sull'ultimo messaggio", async () => {
    for (let i = 1; i <= 130; i++) await insertGroup(`Gruppo con nome lungo ${String(i).padStart(4, "0")}`);
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/statistiche");
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs.slice(0, -1)) expect(m.keyboard).toBeUndefined();
    expect(buttons(msgs.at(-1)!.keyboard)).toEqual([["📝 Profili incompleti", "s:i"]]);
  });

  it("001 FR-018: tocco s:i durante un flusso guidato → flusso interrotto", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    expect(await count("conversation_state")).toBe(1);
    await press(deps, "s:i");
    expect(deps.tg.lastText()).toBe(MENU_TEXT);
    expect(await count("conversation_state")).toBe(0);
  });
});
