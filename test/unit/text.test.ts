import { describe, expect, it } from "vitest";
import { cleanText, groupKey, hasValidGroupKey, nameHash, normKey, searchKey } from "../../src/domain/text";

describe("FR-010a: pulizia dei testi", () => {
  it("FR-010a: rimuove gli spazi ai bordi", () => {
    expect(cleanText("  Marco Rossi  ", 60)).toEqual({ ok: true, value: "Marco Rossi" });
  });

  it("FR-010a: soli spazi → empty", () => {
    expect(cleanText("   ", 60)).toEqual({ ok: false, reason: "empty", max: 60 });
  });

  it("FR-010a: 61 caratteri → too_long con max 60", () => {
    expect(cleanText("a".repeat(61), 60)).toEqual({ ok: false, reason: "too_long", max: 60 });
  });

  it("FR-010a: 60 emoji sono validi (lunghezza in code point)", () => {
    expect(cleanText("🎉".repeat(60), 60).ok).toBe(true);
  });
});

describe("BR-14, BR-17: chiave normalizzata", () => {
  it("BR-14: trim e minuscolo it-IT", () => {
    expect(normKey("  Àlba ROSSI ")).toBe("àlba rossi");
  });
});

describe("BR-26, FR-006: chiave di ricerca dei gruppi (research R-02)", () => {
  it.each([
    ["👨‍👩‍👧 Famiglia", "famiglia", "emoji composta con ZWJ"],
    ["👍🏽 Amici", "amici", "colore della pelle"],
    ["★ Calcetto 🇮🇹", "calcetto", "simbolo e bandiera"],
    ["\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F} Scozia", "scozia", "bandiera con tag"],
    ["❤️ Cuori", "cuori", "selettore di variante U+FE0F"],
    ["1\u{FE0F}\u{20E3} Calcetto", "calcetto", "keycap"],
    ["Università", "universita", "accenti"],
    ["UNIVERSITA", "universita", "maiuscole"],
    ["Nicolò".normalize("NFC"), "nicolo", "forma composta NFC"],
    ["Nicolò".normalize("NFD"), "nicolo", "forma decomposta NFD"],
    ["beach-tennis", "beach tennis", "trattino"],
    ["Beach  tennis", "beach tennis", "spazi doppi"],
    [" Beach tennis ", "beach tennis", "spazi ai bordi"],
    ["2024 Calcetto", "2024 calcetto", "cifre conservate"],
    ["🏖", "", "solo emoji"],
    ["★★", "", "solo simboli"],
    ["", "", "vuoto"],
    ["   ", "", "solo spazi"],
    ["🏖 X", "x", "una sola lettera"],
    ["U2", "u2", "lettera e cifra"],
    ["★ Bar", "bar", "simbolo iniziale"],
    ["Smørrebrød", "smørrebrød", "lettere senza decomposizione"],
  ])("BR-26, FR-006: groupKey(%j) = %j (%s)", (input, key) => {
    expect(groupKey(input)).toBe(key);
  });

  it("RF-18: searchKey resta invariata (il trattino non diventa spazio)", () => {
    expect(searchKey("Rossi-Bianchi")).toBe("rossi-bianchi");
  });
});

describe("FR-006a, FR-005: validità del nome e hash", () => {
  it.each(["🏖", "★★", "🏖 X"])("FR-006a: %j non valido (chiave < 2)", (name) => {
    expect(hasValidGroupKey(name)).toBe(false);
  });

  it.each(["U2", "★ Bar", "Famiglia"])("FR-006a: %j valido", (name) => {
    expect(hasValidGroupKey(name)).toBe(true);
  });

  it("FR-005: nameHash deterministico, 1–7 caratteri [0-9a-z]", () => {
    for (const s of ["Famiglia", "👨‍👩‍👧 Smoke Casa", "", "x".repeat(30)]) {
      expect(nameHash(s)).toBe(nameHash(s));
      expect(nameHash(s)).toMatch(/^[0-9a-z]{1,7}$/);
    }
  });

  it("FR-005: valori di riferimento (anche per la collection Postman)", () => {
    expect(nameHash("Famiglia")).toBe("esn6mr");
    expect(nameHash("famiglia")).toBe("1y0qzw3");
    expect(nameHash("")).toBe("ztntfp");
    expect(nameHash("Smoke Lavoro")).toBe("1ea1eld");
    expect(nameHash("👨‍👩‍👧 Smoke Casa")).toBe("1ol49qr");
    expect(nameHash("Smoke Casa Rossi")).toBe("19kbv82");
  });

  it("FR-005: un cambio di sole maiuscole cambia l'hash", () => {
    expect(nameHash("Famiglia")).not.toBe(nameHash("famiglia"));
  });
});
