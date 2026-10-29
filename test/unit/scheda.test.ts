import { describe, expect, it } from "vitest";
import { renderRiepilogo, renderScheda, schedaKeyboard } from "../../src/bot/scheda";
import { buttons } from "../helpers/fake-telegram";
import type { PersonFields } from "../../src/db/persons";
import { T } from "../../src/texts";

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
      T.schedaTitle("Marco Rossi", "Marchino"),
      T.schedaDate("14/03/1994", "compie 33 anni tra 137 giorni"),
      "Priorità: alta · Gruppi: Beach tennis, Lavoro",
      "📱 +393331234567",
      "Messaggio: standard",
    ]);
  });

  it("FR-012: senza anno l'età non compare", () => {
    const lines = renderScheda({ ...marco, birthYear: null }, [], [], today).split("\n");
    expect(lines[1]).toBe(T.schedaDate("14/03", "compleanno tra 137 giorni"));
  });

  it("RF-03: compleanno oggi e domani", () => {
    expect(renderScheda({ ...marco, birthDay: 28, birthMonth: 10 }, [], [], today).split("\n")[1]).toBe(
      T.schedaDate("28/10/1994", "compie 32 anni oggi"),
    );
    expect(renderScheda({ ...marco, birthDay: 29, birthMonth: 10 }, [], [], today).split("\n")[1]).toBe(
      T.schedaDate("29/10/1994", "compie 32 anni domani"),
    );
  });

  it("RF-03: senza nickname, gruppi e contatti le parti sono omesse", () => {
    expect(renderScheda(bare, [], [], today).split("\n")).toEqual([
      T.schedaTitle("Marco Rossi", null),
      T.schedaDate("14/03/1994", "compie 33 anni tra 137 giorni"),
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
    expect(schedaKeyboard(12, { phone: null, instagram: null, telegram: null }).inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([[T.btnEdit, T.btnDelete]]);
    const kb = schedaKeyboard(12, { phone: null, instagram: null, telegram: null }, true);
    expect(kb.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([["Segna fatto"], [T.btnEdit, T.btnDelete]]);
    expect(buttons(kb)[0]).toEqual(["Segna fatto", "p:f:12"]);
  });
});

describe("RF-03, FR-002, FR-005: schedaKeyboard", () => {
  const all = { phone: "+393331234567", instagram: "marco.rossi", telegram: "mrossi" };
  const none = { phone: null, instagram: null, telegram: null };
  const rowsOf = (kb: ReturnType<typeof schedaKeyboard>) => kb.inline_keyboard.map((r) => r.map((b) => b.text));

  it("FR-002: contatti, Segna fatto, Modifica/Elimina nell'ordine", () => {
    const kb = schedaKeyboard(12, all, true);
    expect(rowsOf(kb)).toEqual([["WhatsApp", "Instagram", "Telegram"], ["Segna fatto"], [T.btnEdit, T.btnDelete]]);
    expect(buttons(kb)).toEqual([
      ["WhatsApp", "https://wa.me/393331234567"],
      ["Instagram", "https://ig.me/m/marco.rossi"],
      ["Telegram", "https://t.me/mrossi"],
      ["Segna fatto", "p:f:12"],
      [T.btnEdit, "p:m:12"],
      [T.btnDelete, "p:x:12"],
    ]);
  });

  it("FR-002: nessun contatto → prima riga Modifica/Elimina; solo telefono → riga WhatsApp", () => {
    expect(rowsOf(schedaKeyboard(12, none))).toEqual([[T.btnEdit, T.btnDelete]]);
    expect(rowsOf(schedaKeyboard(12, { ...none, phone: "+393331234567" }))).toEqual([["WhatsApp"], [T.btnEdit, T.btnDelete]]);
  });

  it("FR-005, D-27: nessun Copia messaggio e WhatsApp senza ?text=", () => {
    const flat = schedaKeyboard(12, all, true).inline_keyboard.flat();
    expect(flat.some((b) => "copy_text" in b)).toBe(false);
    for (const b of flat) if ("url" in b) expect(b.url).not.toContain("?text=");
  });
});

describe("RF-03, FR-001: username fuori dal testo della scheda", () => {
  it("RF-03, FR-001: persona con soli username → nessuna riga contatti nel testo", () => {
    const text = renderScheda({ ...marco, phone: null }, [], [], today);
    expect(text.split("\n")).toEqual([
      T.schedaTitle("Marco Rossi", "Marchino"),
      T.schedaDate("14/03/1994", "compie 33 anni tra 137 giorni"),
      "Priorità: alta",
      "Messaggio: standard",
    ]);
    expect(text).not.toMatch(/IG @|TG @|marco\.rossi|mrossi/);
  });

  it("FR-001: renderRiepilogo senza username", () => {
    const text = renderRiepilogo(marco, [], today);
    expect(text).toContain("📱 +393331234567");
    expect(text).not.toMatch(/IG @|TG @|marco\.rossi|mrossi/);
  });
});
