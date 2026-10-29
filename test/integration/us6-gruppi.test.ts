import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameHash } from "../../src/domain/text";
import { addToGroup, count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

async function groupWithMembers(name: string, n: number): Promise<number> {
  const gid = await insertGroup(name);
  for (let i = 0; i < n; i++) {
    const pid = await insertPerson({ fullName: `${name} ${i}`, day: 1 + (i % 28), month: 1 + (i % 12) });
    await addToGroup(pid, gid);
  }
  return gid;
}

const open = (id: number, name: string) => `g2:o:${id}:${nameHash(name)}`;
const rename = (id: number, name: string) => `g2:r:${id}:${nameHash(name)}`;
const remove = (id: number, name: string) => `g2:x:${id}:${nameHash(name)}`;

// Stato di un flusso `gruppi` salvato con gli step di prima del rilascio (FR-017).
async function oldState(step: string, data: unknown): Promise<string> {
  const flowId = "abc123";
  await env.DB.prepare(
    `INSERT INTO conversation_state (chat_id, flow, step, flow_id, data, expires_at, updated_at)
     VALUES (1001, 'gruppi', ?, ?, ?, '2099-01-01T00:00:00.000Z', '2026-10-28T10:00:00.000Z')`,
  )
    .bind(step, flowId, JSON.stringify(data))
    .run();
  return flowId;
}

async function groupNames(): Promise<string[]> {
  return (await rows<{ name: string }>("SELECT name FROM groups ORDER BY id")).map((r) => r.name);
}

describe("v1.1 RF-07, RF-19 — elenco e scheda gruppo", () => {
  it("RF-07, FR-001 (#8): /gruppi → titolo e pulsanti su due colonne, poi ➕ Nuovo gruppo", async () => {
    const lavoro = await groupWithMembers("Lavoro", 5);
    const famiglia = await groupWithMembers("Famiglia", 8);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toBe("👥 I tuoi gruppi");
    expect(deps.tg.lastKeyboard()?.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([
      ["Famiglia (8)", "Lavoro (5)"],
      ["➕ Nuovo gruppo"],
    ]);
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["Famiglia (8)", open(famiglia, "Famiglia")],
      ["Lavoro (5)", open(lavoro, "Lavoro")],
      ["➕ Nuovo gruppo", "g2:n"],
    ]);
  });

  it("RF-19, FR-002 (#9, #10): il tocco apre la scheda in un nuovo messaggio, per prossimo compleanno", async () => {
    const gid = await insertGroup("Famiglia");
    const later = await insertPerson({ fullName: "Bruno", day: 1, month: 12 });
    const soon = await insertPerson({ fullName: "Anna", day: 30, month: 10, year: 1990 });
    await addToGroup(later, gid);
    await addToGroup(soon, gid);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Famiglia (2)");
    deps.tg.reset();
    await press(deps, data);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.edits()).toHaveLength(0);
    expect(deps.tg.textEdits()).toHaveLength(0);
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n").slice(0, 2)).toEqual(["👥 Famiglia · 2 persone", ""]);
    expect(commandParts(msg)).toEqual([`/p_${soon}`, `/p_${later}`]);
    expect(msg.text).toContain("Anna (36)");
    expect(buttons(msg.keyboard)).toEqual([
      ["✏️ Rinomina", rename(gid, "Famiglia")],
      ["🗑 Elimina", remove(gid, "Famiglia")],
    ]);
  });

  it("FR-012: 1 persona al singolare", async () => {
    const gid = await groupWithMembers("Lavoro", 1);
    const deps = makeDeps();
    await press(deps, open(gid, "Lavoro"));
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 Lavoro · 1 persona");
  });

  it("FR-008: gruppo vuoto → 0 persone, avviso e tastiera", async () => {
    const gid = await insertGroup("Amici");
    const deps = makeDeps();
    await press(deps, open(gid, "Amici"));
    expect(deps.tg.lastText()).toBe("👥 Amici · 0 persone\n\nNel gruppo non ci sono persone.");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["✏️ Rinomina", "🗑 Elimina"]);
  });

  it("FR-008: scheda di 200 persone divisa in più messaggi, tastiera solo sull'ultimo", async () => {
    const gid = await groupWithMembers("Tutti", 200);
    const deps = makeDeps();
    await press(deps, open(gid, "Tutti"));
    const msgs = deps.tg.messages();
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.slice(0, -1).every((m) => m.keyboard === undefined)).toBe(true);
    expect(labels(msgs.at(-1)!.keyboard)).toEqual(["✏️ Rinomina", "🗑 Elimina"]);
    expect(msgs.flatMap(commandParts)).toHaveLength(200);
  });

  it.each([
    ["eliminato", (id: number) => env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(id).run()],
    ["rinominato", (id: number) => env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = ?").bind(id).run()],
    ["rinominato nelle sole maiuscole", (id: number) => env.DB.prepare("UPDATE groups SET name = 'FAMIGLIA' WHERE id = ?").bind(id).run()],
  ])("FR-005 (#13): tocco su un gruppo %s → non esiste più + elenco, DB invariato", async (_label, change) => {
    const gid = await insertGroup("Famiglia");
    await insertGroup("Lavoro");
    const deps = makeDeps();
    await say(deps, "/gruppi");
    const data = cbOf(deps.tg.lastKeyboard(), "Famiglia (0)");
    await change(gid);
    const before = await groupNames();
    await press(deps, data);
    expect(deps.tg.lastText()).toBe("Il gruppo non esiste più.\n\n👥 I tuoi gruppi");
    expect(labels(deps.tg.lastKeyboard())).toContain("➕ Nuovo gruppo");
    expect(await groupNames()).toEqual(before);
  });

  it("FR-003 (#14): nessun gruppo → avviso e solo ➕ Nuovo gruppo", async () => {
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.lastText()).toBe("Non hai ancora nessun gruppo.");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["➕ Nuovo gruppo", "g2:n"]]);
  });

  it("V-09, FR-013, SC-005 (#15): 60 gruppi → pulsanti; 61 → elenco testuale con invito", async () => {
    for (let i = 1; i <= 60; i++) await insertGroup(`Gruppo ${String(i).padStart(2, "0")}`);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(labels(deps.tg.lastKeyboard())).toHaveLength(61);
    expect(deps.tg.lastKeyboard()!.inline_keyboard).toHaveLength(31);

    await insertGroup("Gruppo 61");
    deps.tg.reset();
    await say(deps, "/gruppi");
    const text = deps.tg.messages().map((m) => m.text).join("\n");
    const lines = text.split("\n");
    expect(lines.slice(0, 3)).toEqual(["👥 I tuoi gruppi", "", "Gruppo 01 (0)"]);
    expect(lines.at(-1)).toBe("Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam");
    expect(lines.at(-2)).toBe("");
    expect(lines).toContain("Gruppo 61 (0)");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["➕ Nuovo gruppo", "g2:n"]]);
  });

  it("FR-016: un gruppo esistente con chiave vuota (🏖) è nell'elenco e si apre", async () => {
    const gid = await insertGroup("🏖");
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(cbOf(deps.tg.lastKeyboard(), "🏖 (0)")).toBe(open(gid, "🏖"));
    await tap(deps, "🏖 (0)");
    expect(deps.tg.lastText()?.split("\n")[0]).toBe("👥 🏖 · 0 persone");
  });

  it("RF-06: /gruppi a metà di /nuovo annulla l'inserimento e mostra l'elenco", async () => {
    await insertGroup("Famiglia");
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await say(deps, "/gruppi");
    expect(await count("persons")).toBe(0);
    expect(await count("conversation_state", "flow = 'nuovo'")).toBe(0);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Famiglia (0)", "➕ Nuovo gruppo"]);
  });
});

describe("v1.1 RF-07, FR-006a, FR-017 — Nuovo, Rinomina, Elimina", () => {
  describe("RF-07, BR-17, FR-006a: creazione da ➕ Nuovo gruppo", () => {
    it("RF-07: famiglia rifiutato se esiste Famiglia; Amici creato ed elenco rimostrato", async () => {
      await insertGroup("Famiglia");
      const deps = makeDeps();
      await press(deps, "g2:n");
      expect(deps.tg.lastText()).toBe("Nome del nuovo gruppo?");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);
      await say(deps, "famiglia");
      expect(deps.tg.lastText()).toBe("Esiste già un gruppo con questo nome\n\nNome del nuovo gruppo?");
      expect(await count("groups")).toBe(1);
      await say(deps, "Amici");
      expect(await count("groups")).toBe(2);
      expect(deps.tg.lastText()).toBe("Gruppo Amici creato\n\n👥 I tuoi gruppi");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Amici (0)", "Famiglia (0)", "➕ Nuovo gruppo"]);
    });

    it("FR-010a: nome di 31 caratteri rifiutato con il massimo 30", async () => {
      const deps = makeDeps();
      await press(deps, "g2:n");
      await say(deps, "a".repeat(31));
      expect(deps.tg.lastText()).toContain("massimo 30");
      expect(await count("groups")).toBe(0);
    });

    it.each(["🏖", "★★", "🏖 X"])("FR-006a: %j rifiutato con la stessa domanda", async (name) => {
      const deps = makeDeps();
      await press(deps, "g2:n");
      await say(deps, name);
      expect(deps.tg.lastText()).toBe("Il nome del gruppo deve contenere almeno 2 lettere o cifre\n\nNome del nuovo gruppo?");
      expect(await count("groups")).toBe(0);
    });

    it.each(["U2", "★ Bar"])("FR-006a: %j creato", async (name) => {
      const deps = makeDeps();
      await press(deps, "g2:n");
      await say(deps, name);
      expect(await groupNames()).toEqual([name]);
    });
  });

  describe("FR-009 (#11): Rinomina dalla scheda", () => {
    it("FR-009: chiede il nuovo nome senza «Quale gruppo?» e mostra la scheda aggiornata in un nuovo messaggio", async () => {
      const gid = await groupWithMembers("Lavoro", 2);
      const deps = makeDeps();
      await press(deps, open(gid, "Lavoro"));
      const cardCount = deps.tg.messages().length;
      await tap(deps, "✏️ Rinomina");
      expect(deps.tg.lastText()).toBe("Nuovo nome per il gruppo Lavoro?");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);
      await say(deps, "Ufficio");
      expect(await groupNames()).toEqual(["Ufficio"]);
      expect(deps.tg.lastText()?.split("\n").slice(0, 3)).toEqual(["Gruppo rinominato in Ufficio", "", "👥 Ufficio · 2 persone"]);
      expect(buttons(deps.tg.lastKeyboard())).toEqual([
        ["✏️ Rinomina", rename(gid, "Ufficio")],
        ["🗑 Elimina", remove(gid, "Ufficio")],
      ]);
      expect(deps.tg.messages().length).toBe(cardCount + 2);
      expect(deps.tg.textEdits()).toHaveLength(0);
      expect(await count("conversation_state")).toBe(0);
    });

    it("RF-07: il nuovo nome si riflette sulle persone", async () => {
      const gid = await insertGroup("Lavoro");
      const pid = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
      await addToGroup(pid, gid);
      const deps = makeDeps();
      await press(deps, rename(gid, "Lavoro"));
      await say(deps, "Ufficio");
      await say(deps, `/p_${pid}`);
      expect(deps.tg.lastText()).toContain("Gruppi: Ufficio");
    });

    it("BR-17: nome di un altro gruppo rifiutato; solo maiuscole consentito", async () => {
      await insertGroup("Famiglia");
      const gid = await insertGroup("lavoro");
      const deps = makeDeps();
      await press(deps, rename(gid, "lavoro"));
      await say(deps, "FAMIGLIA");
      expect(deps.tg.lastText()).toBe("Esiste già un gruppo con questo nome\n\nNuovo nome per il gruppo lavoro?");
      await say(deps, "Lavoro");
      expect(await groupNames()).toEqual(["Famiglia", "Lavoro"]);
    });

    it.each([
      ["🏖 X", "Il nome del gruppo deve contenere almeno 2 lettere o cifre"],
      ["x".repeat(31), "Testo troppo lungo: massimo 30 caratteri"],
    ])("FR-006a, FR-010a: %j rifiutato con la stessa domanda", async (name, error) => {
      const gid = await insertGroup("Lavoro");
      const deps = makeDeps();
      await press(deps, rename(gid, "Lavoro"));
      await say(deps, name);
      expect(deps.tg.lastText()).toBe(`${error}\n\nNuovo nome per il gruppo Lavoro?`);
      expect(await groupNames()).toEqual(["Lavoro"]);
    });

    it("FR-016: un gruppo esistente 🏖 si rinomina solo con un nome conforme", async () => {
      const gid = await insertGroup("🏖");
      const deps = makeDeps();
      await press(deps, rename(gid, "🏖"));
      await say(deps, "🏖🏖");
      expect(deps.tg.lastText()).toContain("Il nome del gruppo deve contenere almeno 2 lettere o cifre");
      await say(deps, "🏖 Mare");
      expect(await groupNames()).toEqual(["🏖 Mare"]);
    });

    it("FR-005: gruppo rinominato da altri tra domanda e risposta → non esiste più, flusso chiuso, DB invariato", async () => {
      const gid = await insertGroup("Lavoro");
      const deps = makeDeps();
      await press(deps, rename(gid, "Lavoro"));
      await env.DB.prepare("UPDATE groups SET name = 'Ufficio', name_norm = 'ufficio' WHERE id = ?").bind(gid).run();
      await say(deps, "Azienda");
      expect(deps.tg.lastText()).toBe("Il gruppo non esiste più.\n\n👥 I tuoi gruppi");
      expect(await groupNames()).toEqual(["Ufficio"]);
      expect(await count("conversation_state")).toBe(0);
    });

    it("FR-005: Rinomina con hash vecchio → non esiste più, nessun flusso", async () => {
      const gid = await insertGroup("Lavoro");
      const deps = makeDeps();
      await press(deps, rename(gid, "Vecchio"));
      expect(deps.tg.lastText()).toBe("Il gruppo non esiste più.\n\n👥 I tuoi gruppi");
      expect(await count("conversation_state")).toBe(0);
    });

    it("RF-07: Annulla non cambia nulla", async () => {
      const gid = await insertGroup("Lavoro");
      const deps = makeDeps();
      await press(deps, rename(gid, "Lavoro"));
      await tap(deps, "Annulla");
      expect(deps.tg.lastText()).toBe("Operazione annullata");
      expect(await groupNames()).toEqual(["Lavoro"]);
    });
  });

  describe("FR-010, FR-022, RNF-05 (#12): Elimina dalla scheda", () => {
    it("FR-010: gruppo con 8 persone → conferma; Sì elimina il gruppo, le persone restano, elenco aggiornato", async () => {
      const gid = await groupWithMembers("Famiglia", 8);
      await insertGroup("Lavoro");
      const deps = makeDeps();
      await press(deps, open(gid, "Famiglia"));
      await tap(deps, "🗑 Elimina");
      expect(deps.tg.lastText()).toBe("Eliminare il gruppo Famiglia? 8 persone perderanno questa etichetta");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Sì", "Annulla"]);
      await tap(deps, "Sì");
      expect(await groupNames()).toEqual(["Lavoro"]);
      expect(await count("persons")).toBe(8);
      expect(await count("person_groups")).toBe(0);
      expect(deps.tg.lastText()).toBe("Gruppo Famiglia eliminato\n\n👥 I tuoi gruppi");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Lavoro (0)", "➕ Nuovo gruppo"]);
    });

    it("FR-022: una sola persona → testo al singolare", async () => {
      const gid = await groupWithMembers("Famiglia", 1);
      const deps = makeDeps();
      await press(deps, remove(gid, "Famiglia"));
      expect(deps.tg.lastText()).toContain("1 persona perderà questa etichetta");
    });

    it("RF-07: Annulla non cambia nulla", async () => {
      const gid = await groupWithMembers("Famiglia", 3);
      const deps = makeDeps();
      await press(deps, remove(gid, "Famiglia"));
      await tap(deps, "Annulla");
      expect(await count("groups")).toBe(1);
      expect(await count("person_groups")).toBe(3);
    });

    it("FR-005: Elimina con hash vecchio → non esiste più, DB invariato", async () => {
      const gid = await insertGroup("Famiglia");
      const deps = makeDeps();
      await press(deps, remove(gid, "famiglia"));
      expect(deps.tg.lastText()).toBe("Il gruppo non esiste più.\n\n👥 I tuoi gruppi");
      expect(await count("groups")).toBe(1);
    });

    it("FR-005: gruppo rinominato tra conferma e Sì → non esiste più, gruppo non eliminato", async () => {
      const gid = await insertGroup("Famiglia");
      const deps = makeDeps();
      await press(deps, remove(gid, "Famiglia"));
      await env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = ?").bind(gid).run();
      await tap(deps, "Sì");
      expect(deps.tg.lastText()).toBe("Il gruppo non esiste più.\n\n👥 I tuoi gruppi");
      expect(await groupNames()).toEqual(["Parenti"]);
      expect(await count("conversation_state")).toBe(0);
    });
  });

  describe("FR-017: pulsanti e stati di prima del rilascio", () => {
    it.each(["g:n", "g:r", "g:x"])("FR-017: %s → non più disponibile, DB invariato", async (data) => {
      await insertGroup("Famiglia");
      const deps = makeDeps();
      await press(deps, data);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
      expect(deps.tg.messages()).toHaveLength(0);
      expect(await groupNames()).toEqual(["Famiglia"]);
    });

    it("FR-017: f:<flowId>:sg:<id> su uno stato «scelta» salvato → non più disponibile", async () => {
      const gid = await insertGroup("Famiglia");
      const flowId = await oldState("scelta", { action: "rinomina" });
      const deps = makeDeps();
      await press(deps, `f:${flowId}:sg:${gid}`);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
      expect(await groupNames()).toEqual(["Famiglia"]);
    });

    it("FR-017: f:<flowId>:y su uno stato «conferma» salvato → non più disponibile, gruppo non eliminato", async () => {
      const gid = await insertGroup("Famiglia");
      const flowId = await oldState("conferma", { action: "elimina", groupId: gid, groupName: "Famiglia" });
      const deps = makeDeps();
      await press(deps, `f:${flowId}:y`);
      expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
      expect(await count("groups")).toBe(1);
    });

    it("FR-017: testo su uno stato «nome» salvato → non ho capito e stato cancellato", async () => {
      await oldState("nome", { action: "nuovo" });
      const deps = makeDeps();
      await say(deps, "Amici");
      expect(deps.tg.lastText()).toBe("Non ho capito. Scrivi /aiuto per l'elenco dei comandi");
      expect(await count("groups")).toBe(0);
      expect(await count("conversation_state")).toBe(0);
    });
  });
});
