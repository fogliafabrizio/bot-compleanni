import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers/deps";
import { buttons } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

describe("US7: benvenuto e aiuto", () => {
  it("RF-28, FR-024: /start con Aggiungi persona e Comandi, niente modello CSV", async () => {
    const deps = makeDeps();
    await say(deps, "/start");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      ["Aggiungi persona", "s:n"],
      ["Comandi", "s:h"],
    ]);
    expect(deps.tg.lastText()).not.toMatch(/CSV/i);
  });

  it("RF-28: Aggiungi persona avvia /nuovo; Comandi mostra l'aiuto", async () => {
    const deps = makeDeps();
    await press(deps, "s:n");
    expect(deps.tg.lastText()).toBe("Nome completo?");
    await press(deps, "s:h");
    expect(deps.tg.lastText()).toContain("/nuovo");
  });

  it("RF-28, FR-025: /aiuto elenca i comandi della feature, uno per riga con descrizione", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    const lines = deps.tg.lastText()!.split("\n");
    for (const c of ["/nuovo", "/gruppi", "/annulla", "/id", "/aiuto", "/start", "/p_<id>"]) {
      const line = lines.find((l) => l.startsWith(`${c} `));
      expect(line, c).toBeDefined();
      expect(line!.length).toBeGreaterThan(c.length + 5);
    }
    expect(deps.tg.lastText()).not.toContain("/prossimi");
    expect(deps.tg.lastText()).not.toContain("/modello");
  });

  it.each(["ciao", "/pippo"])("RF-28, RNF-13, FR-025a: %s fuori flusso → Non ho capito", async (text) => {
    const deps = makeDeps();
    await say(deps, text);
    expect(deps.tg.lastText()).toBe("Non ho capito. Scrivi /aiuto per l'elenco dei comandi");
  });
});
