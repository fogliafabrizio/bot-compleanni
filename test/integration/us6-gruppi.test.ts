import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addToGroup, count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { buttons, cbOf, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

async function groupWithMembers(name: string, n: number): Promise<number> {
  const gid = await insertGroup(name);
  for (let i = 0; i < n; i++) {
    const pid = await insertPerson({ fullName: `${name} ${i}`, day: 1 + i, month: 1 });
    await addToGroup(pid, gid);
  }
  return gid;
}

describe("US6: gestione gruppi", () => {
  it("FR-019: elenco alfabetico con i conteggi e i tre pulsanti", async () => {
    await groupWithMembers("Famiglia", 3);
    await groupWithMembers("Beach tennis", 5);
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(deps.tg.lastText()).toBe("Gruppi:\n• Beach tennis (5)\n• Famiglia (3)");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["➕ Nuovo gruppo", "g:n"],
      ["✏️ Rinomina", "g:r"],
      ["🗑 Elimina", "g:x"],
    ]);
  });

  it("FR-019: senza gruppi solo ➕ Nuovo gruppo", async () => {
    const deps = makeDeps();
    await say(deps, "/gruppi");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["➕ Nuovo gruppo"]);
  });

  describe("RF-07, BR-17: creazione", () => {
    it("RF-07: famiglia rifiutato se esiste Famiglia; Amici creato ed elenco rimostrato", async () => {
      await insertGroup("Famiglia");
      const deps = makeDeps();
      await press(deps, "g:n");
      expect(deps.tg.lastText()).toBe("Nome del nuovo gruppo?");
      await say(deps, "famiglia");
      expect(deps.tg.lastText()).toContain("Esiste già un gruppo con questo nome");
      expect(await count("groups")).toBe(1);
      await say(deps, "Amici");
      expect(await count("groups")).toBe(2);
      expect(deps.tg.lastText()).toContain("• Amici (0)");
      expect(deps.tg.lastText()).toContain("• Famiglia (0)");
    });

    it("FR-010a: nome di 31 caratteri rifiutato con il massimo 30", async () => {
      const deps = makeDeps();
      await press(deps, "g:n");
      await say(deps, "a".repeat(31));
      expect(deps.tg.lastText()).toContain("massimo 30");
      expect(await count("groups")).toBe(0);
    });
  });

  describe("RF-07, FR-021: rinomina", () => {
    it("RF-07: Lavoro → Ufficio si riflette sulle persone", async () => {
      const gid = await insertGroup("Lavoro");
      const pid = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
      await addToGroup(pid, gid);
      const deps = makeDeps();
      await press(deps, "g:r");
      expect(deps.tg.lastText()).toBe("Quale gruppo vuoi rinominare?");
      await tap(deps, "Lavoro");
      expect(deps.tg.lastText()).toBe("Nuovo nome per il gruppo Lavoro?");
      await say(deps, "Ufficio");
      expect(deps.tg.lastText()).toContain("• Ufficio (1)");
      await say(deps, `/p_${pid}`);
      expect(deps.tg.lastText()).toContain("Gruppi: Ufficio");
    });

    it("BR-17: rinomina nel nome di un altro gruppo rifiutata; solo maiuscole consentita", async () => {
      await insertGroup("Famiglia");
      await insertGroup("lavoro");
      const deps = makeDeps();
      await press(deps, "g:r");
      await tap(deps, "lavoro");
      await say(deps, "FAMIGLIA");
      expect(deps.tg.lastText()).toContain("Esiste già un gruppo con questo nome");
      await say(deps, "Lavoro");
      const names = await rows<{ name: string }>("SELECT name FROM groups ORDER BY name");
      expect(names.map((n) => n.name)).toEqual(["Famiglia", "Lavoro"]);
    });
  });

  describe("RF-07, FR-022, RNF-05: eliminazione", () => {
    it("RF-07: gruppo con 8 persone → conferma; Sì elimina il gruppo, le persone restano", async () => {
      await groupWithMembers("Beach tennis", 8);
      const deps = makeDeps();
      await press(deps, "g:x");
      expect(deps.tg.lastText()).toBe("Quale gruppo vuoi eliminare?");
      await tap(deps, "Beach tennis");
      expect(deps.tg.lastText()).toContain("8 persone perderanno questa etichetta");
      expect(labels(deps.tg.lastKeyboard())).toEqual(["Sì", "Annulla"]);
      await tap(deps, "Sì");
      expect(await count("groups")).toBe(0);
      expect(await count("persons")).toBe(8);
      expect(await count("person_groups")).toBe(0);
    });

    it("FR-022: una sola persona → testo al singolare", async () => {
      await groupWithMembers("Famiglia", 1);
      const deps = makeDeps();
      await press(deps, "g:x");
      await tap(deps, "Famiglia");
      expect(deps.tg.lastText()).toContain("1 persona perderà questa etichetta");
    });

    it("RF-07: Annulla non cambia nulla", async () => {
      await groupWithMembers("Famiglia", 3);
      const deps = makeDeps();
      await press(deps, "g:x");
      await tap(deps, "Famiglia");
      await tap(deps, "Annulla");
      expect(await count("groups")).toBe(1);
      expect(await count("person_groups")).toBe(3);
    });
  });

  it("RF-06: /gruppi a metà di /nuovo annulla l'inserimento e mostra l'elenco", async () => {
    await insertGroup("Famiglia");
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await say(deps, "/gruppi");
    expect(await count("persons")).toBe(0);
    expect(await count("conversation_state", "flow = 'nuovo'")).toBe(0);
    expect(deps.tg.lastText()).toContain("• Famiglia (0)");
  });

  it("FR-018c: scelta di un gruppo eliminato nel frattempo → non più disponibile", async () => {
    const gid = await insertGroup("Famiglia");
    const deps = makeDeps();
    await press(deps, "g:r");
    const choose = cbOf(deps.tg.lastKeyboard(), "Famiglia");
    await env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(gid).run();
    await press(deps, choose);
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    expect(await count("conversation_state")).toBe(0);
  });
});
