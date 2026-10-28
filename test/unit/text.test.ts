import { describe, expect, it } from "vitest";
import { cleanText, normKey } from "../../src/domain/text";

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
