import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers/deps";
import { buttons } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

describe("US7: benvenuto e aiuto", () => {
  it("RF-28, FR-024: /start con Aggiungi persona e Comandi, niente modello CSV", async () => {
    const deps = makeDeps();
    await say(deps, "/start");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([
      [T.btnAddPerson, "s:n"],
      [T.btnCommands, "s:h"],
    ]);
    expect(deps.tg.lastText()).toBe(T.welcome);
    expect(deps.tg.lastText()).not.toMatch(/CSV/i);
  });

  it("RF-28: Aggiungi persona avvia /nuovo; Comandi mostra l'aiuto", async () => {
    const deps = makeDeps();
    await press(deps, "s:n");
    expect(deps.tg.lastText()).toBe(T.askFullName);
    await press(deps, "s:h");
    expect(deps.tg.lastText()).toBe(T.help);
  });

  it("RF-28, FR-025: /aiuto elenca i comandi, uno per riga con descrizione", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    const lines = deps.tg.lastText()!.split("\n");
    for (const c of ["/nuovo", "/gruppi", "/annulla", "/id", "/aiuto", "/start", "/p_<id>"]) {
      const line = lines.find((l) => l.startsWith(`${c} `));
      expect(line, c).toBeDefined();
      expect(line!.length).toBeGreaterThan(c.length + 5);
    }
    // AFU §5.1: comandi delle viste (feature 003), prima di /annulla.
    const viste = ["/oggi", "/prossimi", "/cerca", "/mese", "/scaduti", "/anno"];
    for (const c of viste) expect(lines.find((l) => l.startsWith(`${c} `)), c).toBeDefined();
    const annulla = lines.findIndex((l) => l.startsWith("/annulla "));
    for (const c of viste) expect(lines.findIndex((l) => l.startsWith(`${c} `))).toBeLessThan(annulla);
    // Feature 004 (contracts/comandi.md, /aiuto): comandi dei file prima di /annulla e nota sull'import.
    for (const c of ["/modello", "/export", "/backup", "/ripristina"]) {
      const i = lines.findIndex((l) => l.startsWith(`${c} `));
      expect(i, c).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(annulla);
    }
    expect(lines).toContain("Per importare persone inviami un file CSV.");
  });

  it("RF-19, AFU §5.1 (#7): /aiuto mostra /gruppi [nome] e non /gruppo", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    const lines = deps.tg.lastText()!.split("\n");
    expect(lines).toContain("/gruppi [nome] — elenco gruppi a pulsanti; con un nome cerca il gruppo e apre la scheda");
    expect(lines.some((l) => l.startsWith("/gruppo "))).toBe(false);
  });

  it.each(["ciao", "/pippo"])("RF-28, RNF-13, FR-025a: %s fuori flusso → Non ho capito", async (text) => {
    const deps = makeDeps();
    await say(deps, text);
    expect(deps.tg.lastText()).toBe(T.notUnderstood);
  });

  it("§5.1, FR-016: /aiuto elenca /statistiche e /stato subito dopo /anno", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    const lines = deps.tg.lastText()!.split("\n");
    const i = lines.indexOf("/anno [anno] — riepilogo dell'anno");
    expect(i).toBeGreaterThan(0);
    expect(lines.slice(i + 1, i + 3)).toEqual([
      "/statistiche — statistiche della rubrica e andamento",
      "/stato — salute di cron, invii, backup e webhook",
    ]);
  });
});
