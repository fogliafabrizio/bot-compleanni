import { describe, expect, it } from "vitest";
import { normalizeContactPhone, normalizePhone } from "../../src/domain/phone";

describe("BR-15, FR-009: normalizzazione del telefono", () => {
  it.each([
    ["333 1234567", "+393331234567"],
    ["333.123.4567", "+393331234567"],
    ["+39 333-1234567", "+393331234567"],
    ["0041 79 123 45 67", "+41791234567"],
    ["1234567", "+391234567"],
  ])("BR-15: %j → %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["333abc4567", "+1234567", "+1234567890123456", "++39333", ""])("BR-15: %j rifiutato", (input) => {
    expect(normalizePhone(input)).toEqual({ ok: false });
  });

  it("FR-014, BR-15: normalizePhone non applica BR-25", () => {
    expect(normalizePhone("393331234567")).toEqual({ ok: true, value: "+39393331234567" });
  });
});

describe("BR-25, BR-15, SC-005: normalizeContactPhone", () => {
  it.each([
    ["393331234567", "+393331234567"],
    ["333 1234567", "+393331234567"],
    ["+41 79 123 45 67", "+41791234567"],
    ["0041791234567", "+41791234567"],
    ["(02) 1234-5678", "+390212345678"],
    // Q1: 13 cifre senza prefisso → "+" + cifre.
    ["3933312345678", "+3933312345678"],
    // Q2: lettere ed estensioni scartate.
    ["0212345678x12", "+021234567812"],
  ])("BR-25: %j → %s", (input, expected) => {
    expect(normalizeContactPhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["12345678", "+1234567", "+1234567890123456", "abc"])("BR-25: %j non valido", (input) => {
    expect(normalizeContactPhone(input)).toEqual({ ok: false, reason: "invalid" });
  });

  it.each(["", "   ", undefined])("FR-009: %j senza numero", (input) => {
    expect(normalizeContactPhone(input)).toEqual({ ok: false, reason: "missing" });
  });
});
