import { describe, expect, it } from "vitest";
import { normalizePhone } from "../../src/domain/phone";

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
});
