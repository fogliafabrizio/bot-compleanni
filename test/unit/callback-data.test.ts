import { describe, expect, it } from "vitest";
import { decodeCallback, encodeCallback } from "../../src/telegram/keyboard";

describe("R-10: callback_data", () => {
  it.each(["s:n", "s:h", "p:m:123", "p:x:123", "g:n", "g:r", "g:x", "f:k3x9q2:pr:m", "f:k3x9q2:t:4821", "f:k3x9q2:t:n0", "f:k3x9q2:e:p"])(
    "R-10: round-trip di %s",
    (s) => {
      const cb = decodeCallback(s);
      expect(cb).not.toBeNull();
      expect(encodeCallback(cb!)).toBe(s);
    },
  );

  it("R-10: decodifica dei campi", () => {
    expect(decodeCallback("p:m:123")).toEqual({ kind: "static", scope: "p", action: "m", id: 123 });
    expect(decodeCallback("f:k3x9q2:t:n0")).toEqual({ kind: "flow", flowId: "k3x9q2", action: "t", arg: "n0" });
    expect(decodeCallback("f:k3x9q2:a")).toEqual({ kind: "flow", flowId: "k3x9q2", action: "a" });
  });

  it.each(["", "x:y", "p:m:abc", "f:TOOLONG7:a"])("FR-018c: %j malformato → null", (s) => {
    expect(decodeCallback(s)).toBeNull();
  });

  it("R-10: encode lancia oltre 64 byte UTF-8", () => {
    expect(() => encodeCallback({ kind: "flow", flowId: "k3x9q2", action: "t", arg: "x".repeat(60) })).toThrow();
  });
});
