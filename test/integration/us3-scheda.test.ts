import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addToGroup, count, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { buttons } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

describe("US3: scheda persona", () => {
  it("RF-03: /p_12 mostra la scheda con Modifica ed Elimina", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, year: 1994, priority: "alta" });
    await addToGroup(12, await insertGroup("Lavoro"));
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).toBe(
      ['Marco Rossi — "Marchino"', "14/03/1994 · compie 33 anni tra 137 giorni", "Priorità: alta · Gruppi: Lavoro", "Messaggio: standard"].join(
        "\n",
      ),
    );
    // RNF-14: solo i pulsanti di azione.
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["Modifica", "p:m:12"],
      ["Elimina", "p:x:12"],
    ]);
  });

  it("RF-03, FR-012: senza anno l'età non compare", async () => {
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeDeps();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()!.split("\n")[1]).toBe("14/03 · compleanno tra 137 giorni");
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
    expect(deps.tg.lastText()).toBe("Persona non trovata");
    await insertPerson({ id: 12, fullName: "Marco Rossi", day: 14, month: 3 });
    await env.DB.prepare("DELETE FROM persons WHERE id = 12").run();
    await say(deps, "/p_12");
    expect(deps.tg.lastText()).toBe("Persona non trovata");
  });

  it("FR-018c: Modifica ed Elimina di una persona inesistente → Persona non trovata", async () => {
    const deps = makeDeps();
    await press(deps, "p:m:999");
    expect(deps.tg.lastAnswer()).toBe("Persona non trovata");
    await press(deps, "p:x:999");
    expect(deps.tg.lastAnswer()).toBe("Persona non trovata");
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("conversation_state")).toBe(0);
  });
});
