import { describe, expect, it } from "vitest";
import { renderScheda, schedaKeyboard } from "../../src/bot/scheda";
import { buttons } from "../helpers/fake-telegram";
import type { PersonFields } from "../../src/db/persons";

const today = { year: 2026, month: 10, day: 28 };

const marco: PersonFields = {
  fullName: "Marco Rossi",
  nickname: "Marchino",
  birthDay: 14,
  birthMonth: 3,
  birthYear: 1994,
  phone: "+393331234567",
  instagram: "marco.rossi",
  telegram: "mrossi",
  priority: "alta",
  customMessage: null,
};

const bare: PersonFields = { ...marco, nickname: null, phone: null, instagram: null, telegram: null, priority: "media" };

describe("RF-03: scheda persona (AFU §5.6)", () => {
  it("RF-03: persona completa, nessuna riga Storico", () => {
    expect(renderScheda(marco, ["Lavoro", "Beach tennis"], [], today).split("\n")).toEqual([
      'Marco Rossi — "Marchino"',
      "14/03/1994 · compie 33 anni tra 137 giorni",
      "Priorità: alta · Gruppi: Beach tennis, Lavoro",
      "📱 +393331234567 · IG @marco.rossi · TG @mrossi",
      "Messaggio: standard",
    ]);
  });

  it("FR-012: senza anno l'età non compare", () => {
    const lines = renderScheda({ ...marco, birthYear: null }, [], [], today).split("\n");
    expect(lines[1]).toBe("14/03 · compleanno tra 137 giorni");
  });

  it("RF-03: compleanno oggi e domani", () => {
    expect(renderScheda({ ...marco, birthDay: 28, birthMonth: 10 }, [], [], today).split("\n")[1]).toBe(
      "28/10/1994 · compie 32 anni oggi",
    );
    expect(renderScheda({ ...marco, birthDay: 29, birthMonth: 10 }, [], [], today).split("\n")[1]).toBe(
      "29/10/1994 · compie 32 anni domani",
    );
  });

  it("RF-03: senza nickname, gruppi e contatti le parti sono omesse", () => {
    expect(renderScheda(bare, [], [], today).split("\n")).toEqual([
      "Marco Rossi",
      "14/03/1994 · compie 33 anni tra 137 giorni",
      "Priorità: media",
      "Messaggio: standard",
    ]);
  });

  it("RF-03: messaggio personalizzato tra virgolette", () => {
    expect(renderScheda({ ...bare, customMessage: "Auguri vecchio!" }, [], [], today)).toContain('Messaggio: "Auguri vecchio!"');
  });

  it("FR-013: con esiti compare la riga Storico", () => {
    const text = renderScheda(
      marco,
      [],
      [
        { year: 2025, status: "fatto" },
        { year: 2024, status: "saltato" },
      ],
      today,
    );
    expect(text.split("\n").at(-1)).toBe("Storico: 2025 fatto · 2024 saltato");
  });

  it("FR-017, BR-08: Segna fatto sopra Modifica/Elimina solo con un'occorrenza in sospeso", () => {
    expect(schedaKeyboard(12).inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([["Modifica", "Elimina"]]);
    const kb = schedaKeyboard(12, true);
    expect(kb.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([["Segna fatto"], ["Modifica", "Elimina"]]);
    expect(buttons(kb)[0]).toEqual(["Segna fatto", "p:f:12"]);
  });
});
