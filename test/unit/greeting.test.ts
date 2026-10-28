import { describe, expect, it } from "vitest";
import { composeGreeting, validateGreeting } from "../../src/domain/greeting";

const marco = { nickname: "Marchino", fullName: "Marco Rossi", customMessage: null };

describe("FR-031, RF-15: composizione del messaggio di auguri", () => {
  it("RF-15: default con nickname → {nome} = nickname", () => {
    expect(composeGreeting(marco, "Tanti auguri {nome}! 🎉")).toBe("Tanti auguri Marchino! 🎉");
  });

  it("FR-031: senza nickname → nome completo", () => {
    expect(composeGreeting({ ...marco, nickname: null }, "Auguri {nome}")).toBe("Auguri Marco Rossi");
  });

  it("FR-031: il messaggio personalizzato prevale sul default, con {nome} sostituito ovunque", () => {
    expect(composeGreeting({ ...marco, customMessage: "Ciao {nome}, auguri {nome}!" }, "Default {nome}")).toBe(
      "Ciao Marchino, auguri Marchino!",
    );
  });

  it("A-06: default assente in settings → DEFAULT_BIRTHDAY_MESSAGE", () => {
    expect(composeGreeting(marco, null)).toBe("Tanti auguri Marchino! 🎉");
  });

  it("BR-03: l'età non compare mai", () => {
    expect(composeGreeting(marco, null)).not.toMatch(/\d/);
  });
});

describe("FR-035: validazione del messaggio di auguri", () => {
  it("FR-035: spazi rimossi, vuoto rifiutato", () => {
    expect(validateGreeting("  Auguri {nome}  ")).toEqual({ ok: true, value: "Auguri {nome}" });
    expect(validateGreeting("   ")).toEqual({ ok: false, error: "empty" });
  });

  it("FR-035: 256 caratteri senza {nome} accettati, 257 rifiutati", () => {
    expect(validateGreeting("x".repeat(256)).ok).toBe(true);
    expect(validateGreeting("x".repeat(257))).toEqual({ ok: false, error: "too_long" });
  });

  it("FR-035: ogni {nome} vale 60 caratteri", () => {
    expect(validateGreeting(`{nome}${"x".repeat(196)}`).ok).toBe(true);
    expect(validateGreeting(`{nome}${"x".repeat(197)}`)).toEqual({ ok: false, error: "too_long" });
    expect(validateGreeting(`{nome}{nome}${"x".repeat(136)}`).ok).toBe(true);
    expect(validateGreeting(`{nome}{nome}${"x".repeat(137)}`).ok).toBe(false);
  });

  it("FR-035: un'emoji conta 1 (code point)", () => {
    expect(validateGreeting("🎉".repeat(256)).ok).toBe(true);
    expect(validateGreeting("🎉".repeat(257)).ok).toBe(false);
  });
});
