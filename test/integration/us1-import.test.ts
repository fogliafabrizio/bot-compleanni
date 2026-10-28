import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_LENGTH, PREVIEW_MAX_MESSAGES } from "../../src/config";
import { CSV_EXAMPLE_ROW, T } from "../../src/texts";
import { addHours } from "../../src/time";
import { NOW, OWNER_ID } from "../helpers/constants";
import { runAt } from "../helpers/cron";
import { csvOf, syntheticRows } from "../helpers/csv-fixtures";
import { count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeCronDeps, makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

const MSG_ID = 555;

// Riga completa con nome, data e gli altri campi indicati per posizione di CSV_COLUMNS.
const r = (nome: string, data: string, rest: Partial<Record<number, string>> = {}) => {
  const cells = [nome, "", data, "", "", "", "", "", ""];
  for (const [i, v] of Object.entries(rest)) cells[Number(i)] = v!;
  return cells;
};
const GRUPPI = 6;
const PRIORITA = 7;

async function importPress(deps: TestDeps): Promise<void> {
  await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnImport), MSG_ID);
}

// 112 righe: 104 nuove, 3 date non valide (righe 12, 40, 51), 5 duplicati (3 di persone
// esistenti, 2 interni). Gruppi: famiglia esistente, Calcetto e Università da creare.
async function scenario112(): Promise<{ data: string[][]; lines: { errors: number[]; duplicates: number[] } }> {
  await insertGroup("Famiglia");
  for (let i = 1; i <= 3; i++) await insertPerson({ fullName: `Esistente ${i}`, day: i, month: 12, year: 1980 });
  const valid = syntheticRows(104);
  valid[0]![GRUPPI] = "Calcetto|Università";
  valid[1]![GRUPPI] = "famiglia";
  valid[2]![GRUPPI] = "università|Famiglia";
  const data = [...valid];
  // Indici 0-based nell'elenco delle righe di dati: riga del foglio = indice + 2.
  data.splice(10, 0, r("Errata Uno", "31/04/1990"));
  data.splice(38, 0, r("Errata Due", "30/02"));
  data.splice(49, 0, r("Errata Tre", "1/13/2000"));
  data.push(r("ESISTENTE 1", "01/12/1980"), r("esistente 2", "02/12"), r("Esistente 3", "03/12/1980"));
  data.push([...valid[3]!], [...valid[4]!]);
  return { data, lines: { errors: [12, 40, 51], duplicates: [109, 110, 111, 112, 113] } };
}

describe("US1: import CSV con anteprima (RF-24, §5.8)", () => {
  it("RF-24, §5.8: 112 righe con 3 date non valide e 5 duplicati → anteprima, tabelle invariate", async () => {
    const { data, lines } = await scenario112();
    const deps = makeDeps();
    await sendFile(deps, "agenda.csv", csvOf(data));
    const text = deps.tg.messages().map((m) => m.text).join("\n");
    expect(text).toContain("Anteprima import\n104 persone nuove");
    expect(text).toContain("5 duplicati (saltati):");
    for (const l of lines.duplicates) expect(text).toContain(`• riga ${l}: `);
    expect(text).toContain("• riga 109: ESISTENTE 1 01/12/1980");
    expect(text).toContain("3 errori:");
    expect(text).toContain('• riga 12: data "31/04/1990" non valida');
    expect(text).toContain('• riga 40: data "30/02" non valida');
    expect(text).toContain('• riga 51: data "1/13/2000" non valida');
    expect(text).toContain("Gruppi da creare: Calcetto, Università");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Importa", "Annulla"]);
    expect(await count("persons")).toBe(3);
    expect(await count("groups")).toBe(1);
    expect(await count("person_groups")).toBe(0);
  });

  it("RF-24, BR-23, FR-013: Importa salva 104 persone come il guidato e crea 2 gruppi", async () => {
    const { data } = await scenario112();
    const deps = makeDeps();
    await sendFile(deps, "agenda.csv", csvOf(data));
    await importPress(deps);
    expect(deps.tg.lastText()).toBe("Importate 104 persone, creati 2 gruppi.");
    expect(deps.tg.edits().at(-1)).toMatchObject({ chatId: OWNER_ID, messageId: MSG_ID, keyboard: { inline_keyboard: [] } });
    expect(await count("persons")).toBe(107);
    expect(await count("groups")).toBe(3);
    expect(await count("conversation_state")).toBe(0);
    const [p1] = await rows<Record<string, unknown>>("SELECT * FROM persons WHERE full_name = 'Persona 001'");
    expect(p1).toMatchObject({
      full_name_norm: "persona 001",
      birth_day: 1,
      birth_month: 1,
      birth_year: 1950,
      nickname: null,
      phone: null,
      priority: "media",
      custom_message: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    const groupsOf = (name: string) =>
      rows<{ name: string }>(
        `SELECT g.name FROM groups g JOIN person_groups pg ON pg.group_id = g.id JOIN persons p ON p.id = pg.person_id
         WHERE p.full_name = ? ORDER BY g.name`,
        name,
      );
    expect((await groupsOf("Persona 001")).map((g) => g.name)).toEqual(["Calcetto", "Università"]);
    expect((await groupsOf("Persona 002")).map((g) => g.name)).toEqual(["Famiglia"]);
    expect((await groupsOf("Persona 003")).map((g) => g.name)).toEqual(["Famiglia", "Università"]);
    expect(await count("person_groups")).toBe(5);
    expect(await count("occurrences")).toBe(0);
  });

  it("FR-014: Annulla → Operazione annullata e nulla salvato", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(syntheticRows(3)));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Annulla"));
    expect(deps.tg.lastText()).toBe(T.cancelled);
    expect(await count("persons")).toBe(0);
    expect(await count("conversation_state")).toBe(0);
  });

  it("FR-018c di 001: Importa ripremuto e Importa dopo 24 ore → azione non più disponibile", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(syntheticRows(3)));
    const cb = cbOf(deps.tg.lastKeyboard(), T.btnImport);
    await press(deps, cb);
    await press(deps, cb);
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(await count("persons")).toBe(3);

    const late = makeDeps();
    await sendFile(late, "b.csv", csvOf(syntheticRows(2, 10)));
    late.setNow(addHours(NOW, 24));
    await importPress(late);
    expect(late.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(await count("persons")).toBe(3);
  });

  it("BR-19: stesso file con ',' e con ';' → stessa anteprima", async () => {
    const data = [...syntheticRows(5), r("Rossi, Marco", "14/03", { [GRUPPI]: "Amici; veri" })];
    const a = makeDeps();
    await sendFile(a, "a.csv", csvOf(data, ";"));
    const b = makeDeps();
    await sendFile(b, "b.csv", csvOf(data, ","));
    expect(b.tg.messages().map((m) => m.text)).toEqual(a.tg.messages().map((m) => m.text));
    expect(a.tg.lastText()).toContain("6 persone nuove");
  });

  it("BR-22: file con BOM e accenti letto correttamente", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Nicolò D'Amico", "05/06/1990", { [GRUPPI]: "Università" })]));
    await importPress(deps);
    const [p] = await rows<{ full_name: string }>("SELECT full_name FROM persons");
    expect(p?.full_name).toBe("Nicolò D'Amico");
    expect((await rows<{ name: string }>("SELECT name FROM groups"))[0]?.name).toBe("Università");
  });

  it("FR-007a: riga d'esempio lasciata nel file → non importata, Riga d'esempio ignorata", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([[...CSV_EXAMPLE_ROW], r("Anna", "01/02")]));
    expect(deps.tg.lastText()).toContain("1 persona nuova\nRiga d'esempio ignorata");
    await importPress(deps);
    expect(deps.tg.lastText()).toBe("Importate 1 persona, creati 0 gruppi.");
    expect(await count("persons")).toBe(1);
    expect(await count("groups")).toBe(0);
  });

  it("FR-015: nessuna riga importabile → anteprima senza pulsanti e nessuno stato", async () => {
    await insertPerson({ fullName: "Anna", day: 1, month: 2 });
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Anna", "01/02/1990"), r("", "01/01")]));
    expect(deps.tg.lastText()).toBe(
      ["Anteprima import", "0 persone nuove", "1 duplicato (saltato):", "• riga 2: Anna 01/02/1990", "1 errore:", "• riga 3: nome mancante"].join("\n"),
    );
    expect(deps.tg.lastKeyboard()).toBeUndefined();
    expect(await count("conversation_state")).toBe(0);
  });

  it("BR-14, R-06: persona aggiunta dopo l'anteprima → riga saltata, numeri effettivi", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Anna", "01/02", { [GRUPPI]: "Solo Anna" }), r("Bruno", "03/04", { [GRUPPI]: "Comune" })]));
    await insertPerson({ fullName: "anna", day: 1, month: 2, year: 1990 });
    await importPress(deps);
    expect(deps.tg.lastText()).toBe("1 riga è diventata un duplicato ed è stata saltata.\nImportate 1 persona, creato 1 gruppo.");
    expect((await rows<{ name: string }>("SELECT name FROM groups")).map((g) => g.name)).toEqual(["Comune"]);
  });

  it("BR-14: tutte le righe diventate duplicati → nessuna persona importata, stato consumato", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Anna", "01/02")]));
    await insertPerson({ fullName: "Anna", day: 1, month: 2 });
    await importPress(deps);
    expect(deps.tg.lastText()).toBe(T.nothingImported);
    expect(await count("persons")).toBe(1);
    expect(await count("conversation_state")).toBe(0);
  });

  it("FR-013: errore forzato nella batch → nessuna persona né gruppo salvato, stato invariato", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Anna", "01/02", { [GRUPPI]: "Nuovo" }), r("Bruno", "03/04")]));
    const [before] = await rows<{ data: string; flow_id: string }>("SELECT data, flow_id FROM conversation_state");
    const state = JSON.parse(before!.data) as { rows: { birthDay: number }[] };
    state.rows[1]!.birthDay = 40; // viola il CHECK di persons.birth_day
    await env.DB.prepare("UPDATE conversation_state SET data = ?").bind(JSON.stringify(state)).run();
    await importPress(deps);
    expect(deps.tg.lastText()).toBe(T.genericError);
    expect(await count("persons")).toBe(0);
    expect(await count("groups")).toBe(0);
    const [after] = await rows<{ flow_id: string }>("SELECT flow_id FROM conversation_state");
    expect(after?.flow_id).toBe(before!.flow_id);
  });

  it("FR-005 di 003: anteprima di 500 righe con molti errori divisa su più messaggi, pulsanti solo nell'ultimo", async () => {
    const data = syntheticRows(500).map((row, i) => (i % 2 === 0 ? row : r(row[0]!, "99/99/1999", { [PRIORITA]: "altissima" })));
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(data));
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs) expect(m.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    for (const m of msgs.slice(0, -1)) expect(m.keyboard).toBeUndefined();
    expect(labels(msgs.at(-1)!.keyboard)).toEqual(["Importa", "Annulla"]);
    expect(msgs[0]!.text).toContain("250 persone nuove");
    expect(msgs.map((m) => m.text).join("\n")).toContain("• riga 501: ");
  });

  it("chiarimento 2026-10-29: 500 righe con celle lunghe e 2000 gruppi nuovi → ≤ PREVIEW_MAX_MESSAGES messaggi, troncati", async () => {
    const long = (c: string) => c.repeat(400);
    // Nomi di gruppo di 30 caratteri: righe di gruppi lunghe quanto ammesso.
    const data = Array.from({ length: 500 }, (_, i) => {
      if (i % 2 === 1) return [long("n"), long("k"), long("9"), long("t"), "", "", long("g"), long("p"), long("m")];
      const groups = Array.from({ length: 8 }, (_, j) => `Gruppo con nome lungo n. ${String(i * 8 + j).padStart(5, "0")}`);
      return r(`Persona ${i}`, `${(i % 28) + 1}/${(Math.floor(i / 28) % 12) + 1}/1990`, { [GRUPPI]: groups.join("|") });
    });
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(data));
    const msgs = deps.tg.messages();
    expect(msgs.length).toBe(PREVIEW_MAX_MESSAGES);
    for (const m of msgs) expect(m.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    expect(msgs[0]!.text.startsWith("Anteprima import\n250 persone nuove\n250 errori:")).toBe(true);
    expect(msgs.at(-1)!.text).toMatch(/…e altre \d+ righe non mostrate \(correggi il file e rimandalo\)\.$/);
    expect(labels(msgs.at(-1)!.keyboard)).toEqual(["Importa", "Annulla"]);
  });

  it("FR-018b di 001: testo libero durante l'attesa → riepilogo breve con i pulsanti", async () => {
    await insertGroup("Amici");
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf([r("Anna", "01/02", { [GRUPPI]: "Calcetto|amici|Università" }), r("", "x")]));
    deps.tg.reset();
    await say(deps, "ciao");
    expect(deps.tg.lastText()).toBe("Anteprima in attesa: 1 nuove, 0 duplicati, 1 errori. Gruppi da creare: Calcetto, Università.");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Importa", "Annulla"]);
  });

  it("002 FR-017/018: import il giorno del compleanno → nessun invio retroattivo, solo gli slot futuri", async () => {
    const deps = makeCronDeps();
    await sendFile(deps, "a.csv", csvOf([r("Festeggiata Oggi", "28/10/1990", { [PRIORITA]: "alta" })]));
    await importPress(deps);
    deps.tg.reset();
    await runAt(deps, 2026, 10, 28, 9);
    expect(deps.tg.messages()).toEqual([]);
    await runAt(deps, 2026, 10, 28, 13);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("Festeggiata Oggi");
  });
});
