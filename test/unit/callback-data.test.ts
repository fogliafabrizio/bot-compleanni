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

  it("contracts/callback-data.md (002): ambito o per gli esiti", () => {
    expect(encodeCallback({ kind: "static", scope: "o", action: "f", id: 123 })).toBe("o:f:123");
    expect(decodeCallback("o:f:123")).toEqual({ kind: "static", scope: "o", action: "f", id: 123 });
    const longest = encodeCallback({ kind: "static", scope: "o", action: "s", id: 999999999999999 });
    expect(longest).toBe("o:s:999999999999999");
    expect(new TextEncoder().encode(longest).length).toBeLessThanOrEqual(64);
    // La validazione dell'azione spetta al router.
    expect(decodeCallback("o:x")).toEqual({ kind: "static", scope: "o", action: "x" });
  });

  it("R-10: encode lancia oltre 64 byte UTF-8", () => {
    expect(() => encodeCallback({ kind: "flow", flowId: "k3x9q2", action: "t", arg: "x".repeat(60) })).toThrow();
  });
});
