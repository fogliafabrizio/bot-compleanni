import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { T } from "../../src/texts";
import { addToGroup, count, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

// Revisioni v1.2, gruppi (feature 009, US1 e US2; REV-008, REV-009). Oggi = mercoledì 28/10/2026.

const open = (id: number, name: string) => `g2:o:${id}:${nameHash(name)}`;
const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));
const rowsOf = (deps: TestDeps) => deps.tg.lastKeyboard()?.inline_keyboard.map((r) => r.map((b) => b.text));

async function groupWithMembers(name: string, n: number): Promise<number> {
  const gid = await insertGroup(name);
  for (let i = 0; i < n; i++) {
    const pid = await insertPerson({ fullName: `${name} ${i}`, day: 1 + (i % 28), month: 1 + (i % 12) });
    await addToGroup(pid, gid);
  }
  return gid;
}

async function ungroupedPeople(n: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push(await insertPerson({ fullName: `Sola ${i}`, day: 1 + (i % 28), month: 1 + (i % 12) }));
  return ids;
}

describe("009 US1 — RF-19, D-30: [⬅️ Tutti i gruppi] sulla scheda gruppo", () => {
  it("RF-19, FR-001, FR-002 (US1-1): nuovo messaggio con l'elenco, scheda di partenza invariata", async () => {
    const fam = await groupWithMembers("Famiglia", 2);
    await groupWithMembers("Lavoro", 1);
    const deps = makeDeps();
    await press(deps, open(fam, "Famiglia"));
    expect(rowsOf(deps)).toEqual([["✏️ Rinomina", "🗑 Elimina"], ["⬅️ Tutti i gruppi"]]);
    expect(cbOf(deps.tg.lastKeyboard(), "⬅️ Tutti i gruppi")).toBe("g2:l");
    const before = deps.tg.messages().length;
    await tap(deps, "⬅️ Tutti i gruppi");
    expect(deps.tg.messages()).toHaveLength(before + 1);
    expect(deps.tg.edits()).toHaveLength(0);
    expect(deps.tg.textEdits()).toHaveLength(0);
    expect(deps.tg.lastText()).toBe(T.groupsTitle);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Famiglia (2)", "Lavoro (1)", "➕ Nuovo gruppo"]);
  });

  it("RF-19, FR-008 di 005 (US1-2): scheda spezzata → le due righe di pulsanti solo sull'ultimo messaggio", async () => {
    const gid = await groupWithMembers("Tutti", 200);
    const deps = makeDeps();
    await press(deps, open(gid, "Tutti"));
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.slice(0, -1).every((m) => m.keyboard === undefined)).toBe(true);
    expect(msgs.at(-1)!.keyboard!.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([
      ["✏️ Rinomina", "🗑 Elimina"],
      ["⬅️ Tutti i gruppi"],
    ]);
  });

  it("RF-19, V-09 (US1-3): oltre 60 gruppi il tocco dà l'elenco testuale con l'invito", async () => {
    const first = await insertGroup("Gruppo 00");
    for (let i = 1; i <= 60; i++) await insertGroup(`Gruppo ${String(i).padStart(2, "0")}`);
    const deps = makeDeps();
    await press(deps, open(first, "Gruppo 00"));
    await tap(deps, "⬅️ Tutti i gruppi");
    const text = deps.tg.messages().slice(-2).map((m) => m.text).join("\n");
    expect(text).toContain("Gruppo 60 (0)");
    expect(text).toContain(T.groupsTypeName);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["➕ Nuovo gruppo"]);
  });

  it("RF-19, FR-008 di 005 (US1-4): gruppo vuoto → «0 persone», avviso e [⬅️ Tutti i gruppi]", async () => {
    const gid = await insertGroup("Amici");
    const deps = makeDeps();
    await press(deps, open(gid, "Amici"));
    expect(deps.tg.lastText()).toBe(`${T.groupCardTitle("Amici", 0)}\n\n${T.groupCardEmpty}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["✏️ Rinomina", "🗑 Elimina", "⬅️ Tutti i gruppi"]);
  });

  it("RF-19, FR-001: dopo la rinomina la scheda ha [⬅️ Tutti i gruppi]", async () => {
    const gid = await groupWithMembers("Lavoro", 1);
    const deps = makeDeps();
    await press(deps, open(gid, "Lavoro"));
    await tap(deps, "✏️ Rinomina");
    await say(deps, "Ufficio");
    expect(deps.tg.lastText()?.startsWith(T.groupRenamed("Ufficio"))).toBe(true);
    expect(rowsOf(deps)).toEqual([["✏️ Rinomina", "🗑 Elimina"], ["⬅️ Tutti i gruppi"]]);
  });

  it("RF-19, FR-001: /gruppi <nome> con un trovato apre la scheda con [⬅️ Tutti i gruppi]", async () => {
    await groupWithMembers("Famiglia", 1);
    const deps = makeDeps();
    await say(deps, "/gruppi fam");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["✏️ Rinomina", "🗑 Elimina", "⬅️ Tutti i gruppi"]);
  });

  it.each([
    ["eliminato", (id: number) => env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(id).run()],
    ["rinominato", (id: number) => env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = ?").bind(id).run()],
  ])("RF-19, FR-002: gruppo %s prima del tocco g2:l → elenco attuale senza avvisi", async (_l, change) => {
    const gid = await groupWithMembers("Famiglia", 1);
    await insertGroup("Lavoro");
    const deps = makeDeps();
    await press(deps, open(gid, "Famiglia"));
    await change(gid);
    await tap(deps, "⬅️ Tutti i gruppi");
    expect(deps.tg.lastText()).toBe(T.groupsTitle);
    expect(deps.tg.lastText()).not.toContain(T.groupGone);
  });

  it("RF-19: nessun gruppo rimasto → «Non hai ancora nessun gruppo» e ➕", async () => {
    const gid = await insertGroup("Amici");
    const deps = makeDeps();
    await press(deps, open(gid, "Amici"));
    await env.DB.prepare("DELETE FROM groups").run();
    await tap(deps, "⬅️ Tutti i gruppi");
    expect(deps.tg.lastText()).toBe(T.noGroups);
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["➕ Nuovo gruppo", "g2:n"]]);
  });
});

describe("009 US2 — RF-07, RF-19, V-09, D-31: voce e scheda «Senza gruppo»", () => {
  it("RF-07 (US2-1): [Senza gruppo (N)] su una riga a sé sopra ➕", async () => {
    await groupWithMembers("Famiglia", 2);
    await groupWithMembers("Lavoro", 1);
    await ungroupedPeople(12);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(rowsOf(deps)).toEqual([["Famiglia (2)", "Lavoro (1)"], ["Senza gruppo (12)"], ["➕ Nuovo gruppo"]]);
    expect(cbOf(deps.tg.lastKeyboard(), "Senza gruppo (12)")).toBe("g2:s");
  });

  it("RF-07 (US2-2): tutti classificati → nessuna voce", async () => {
    await groupWithMembers("Famiglia", 2);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(rowsOf(deps)).toEqual([["Famiglia (2)"], ["➕ Nuovo gruppo"]]);
  });

  it("RF-07 (US2-3): 0 gruppi e 30 persone → avviso, [Senza gruppo (30)] e ➕", async () => {
    await ungroupedPeople(30);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.lastText()).toBe(T.noGroups);
    expect(rowsOf(deps)).toEqual([["Senza gruppo (30)"], ["➕ Nuovo gruppo"]]);
  });

  it("RF-07, V-09 (US2-4): più di 60 gruppi e 5 senza gruppo → testo, voce e ➕", async () => {
    for (let i = 1; i <= 61; i++) await insertGroup(`Gruppo ${String(i).padStart(2, "0")}`);
    await ungroupedPeople(5);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.messages().map((m) => m.text).join("\n")).toContain(T.groupsTypeName);
    expect(rowsOf(deps)).toEqual([["Senza gruppo (5)"], ["➕ Nuovo gruppo"]]);
  });

  it("RF-07, FR-005, FR-027 (US2-5): un gruppo reale «Senza gruppo» è distinto dalla voce", async () => {
    const real = await groupWithMembers("Senza gruppo", 2);
    await ungroupedPeople(3);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["Senza gruppo (2)", open(real, "Senza gruppo")],
      ["Senza gruppo (3)", "g2:s"],
      ["➕ Nuovo gruppo", "g2:n"],
    ]);
  });

  it("RF-19, FR-007 (US2-6): la scheda «👥 Senza gruppo · 12 persone» con /p_<id> e solo [⬅️ Tutti i gruppi]", async () => {
    await groupWithMembers("Famiglia", 1);
    const ids = await ungroupedPeople(12);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Senza gruppo (12)");
    deps.tg.reset();
    await press(deps, data);
    expect(deps.tg.messages()).toHaveLength(1);
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n").slice(0, 2)).toEqual(["👥 Senza gruppo · 12 persone", ""]);
    expect(new Set(commandParts(msg))).toEqual(new Set(ids.map((id) => `/p_${id}`)));
    expect(buttons(msg.keyboard)).toEqual([["⬅️ Tutti i gruppi", "g2:l"]]);
  });

  it("RF-19, FR-008 (US2-7): N attuale 0 al tocco → «Ora tutte le persone hanno un gruppo.» + elenco aggiornato", async () => {
    const fam = await insertGroup("Famiglia");
    const [solo] = await ungroupedPeople(1);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Senza gruppo (1)");
    await addToGroup(solo!, fam);
    deps.counter.batches = [];
    await press(deps, data);
    expect(deps.tg.lastText()).toBe(`${T.allGrouped}\n\n${T.groupsTitle}`);
    expect(rowsOf(deps)).toEqual([["Famiglia (1)"], ["➕ Nuovo gruppo"]]);
    // Una sola batch: nessuna seconda lettura (research R-03).
    expect(deps.counter.batches).toHaveLength(1);
  });

  it("RF-19, FR-008: rubrica svuotata prima del tocco → avviso e «Non hai ancora nessun gruppo»", async () => {
    await ungroupedPeople(2);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Senza gruppo (2)");
    await env.DB.prepare("DELETE FROM persons").run();
    await press(deps, data);
    expect(deps.tg.lastText()).toBe(`${T.allGrouped}\n\n${T.noGroups}`);
    expect(rowsOf(deps)).toEqual([["➕ Nuovo gruppo"]]);
  });

  it("RF-19, BR-26 (US2-8): /gruppi senza non apre la scheda virtuale", async () => {
    await groupWithMembers("Famiglia", 1);
    await ungroupedPeople(2);
    const deps = makeDeps();
    await say(deps, "/gruppi senza");
    expect(deps.tg.lastText()).toBe(`${T.groupNoMatch("senza")}\n\n${T.groupsTitle}`);
    expect(labels(deps.tg.lastKeyboard())).toContain("Senza gruppo (2)");
  });

  it("RF-19, FR-008: N cambiato ma > 0 → la scheda mostra il numero attuale", async () => {
    await ungroupedPeople(2);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Senza gruppo (2)");
    await ungroupedPeople(3);
    await press(deps, data);
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 Senza gruppo · 5 persone");
  });

  it("RF-19: scheda «Senza gruppo» di 200 persone spezzata → [⬅️ Tutti i gruppi] solo sull'ultimo messaggio", async () => {
    await env.DB.batch(
      Array.from({ length: 200 }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO persons (full_name, full_name_norm, birth_day, birth_month, priority, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'media', 'x', 'x')`,
        ).bind(`Persona ${i}`, `persona ${i}`, (i % 28) + 1, (i % 12) + 1),
      ),
    );
    const deps = makeDeps();
    await press(deps, "g2:s");
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.slice(0, -1).every((m) => m.keyboard === undefined)).toBe(true);
    expect(buttons(msgs.at(-1)!.keyboard)).toEqual([["⬅️ Tutti i gruppi", "g2:l"]]);
    expect(msgs.flatMap(commandParts)).toHaveLength(200);
  });

  it("RF-19: 1 persona al singolare; ⬅️ dalla scheda virtuale torna all'elenco", async () => {
    await ungroupedPeople(1);
    const deps = makeDeps();
    await press(deps, "g2:s");
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 Senza gruppo · 1 persona");
    await tap(deps, "⬅️ Tutti i gruppi");
    expect(deps.tg.lastText()).toBe(T.noGroups);
    expect(rowsOf(deps)).toEqual([["Senza gruppo (1)"], ["➕ Nuovo gruppo"]]);
  });

  it.each(["Senza gruppo", "senza gruppo"])("D-31, BR-17, FR-005: si può creare un gruppo reale «%s»", async (name) => {
    const deps = makeDeps();
    await press(deps, "g2:n");
    await say(deps, name);
    expect(await count("groups", "name = ?", name)).toBe(1);
    expect(deps.tg.lastText()).toBe(`${T.groupCreated(name)}\n\n${T.groupsTitle}`);
  });

  it("D-31, FR-005: si può rinominare un gruppo in «Senza gruppo»", async () => {
    const gid = await insertGroup("Amici");
    const deps = makeDeps();
    await press(deps, `g2:r:${gid}:${nameHash("Amici")}`);
    await say(deps, "Senza gruppo");
    expect(await count("groups", "name = 'Senza gruppo'")).toBe(1);
    expect(deps.tg.lastText()?.startsWith(T.groupRenamed("Senza gruppo"))).toBe(true);
  });
});
