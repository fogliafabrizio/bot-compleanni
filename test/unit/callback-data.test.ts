import { describe, expect, it } from "vitest";
import { renderGroupList } from "../../src/bot/gruppi";
import { GROUP_BUTTONS_MAX } from "../../src/config";
import { decodeCallback, encodeCallback } from "../../src/telegram/keyboard";
import type { InlineKeyboardMarkup } from "../../src/telegram/types";

describe("R-10: callback_data", () => {
  it.each(["s:n", "s:h", "p:m:123", "p:x:123", "f:k3x9q2:pr:m", "f:k3x9q2:t:4821", "f:k3x9q2:t:n0", "f:k3x9q2:e:p"])(
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

  it("contracts/callback-data.md (003): ambito t di /oggi e azione p:f", () => {
    expect(decodeCallback("t:f:123")).toEqual({ kind: "static", scope: "t", action: "f", id: 123 });
    expect(decodeCallback("t:s:123")).toEqual({ kind: "static", scope: "t", action: "s", id: 123 });
    expect(decodeCallback("p:f:7")).toEqual({ kind: "static", scope: "p", action: "f", id: 7 });
    for (const s of ["t:f:123", "t:s:123", "p:f:7"]) expect(encodeCallback(decodeCallback(s)!)).toBe(s);
    expect(decodeCallback("t:f:")).toBeNull();
    expect(decodeCallback("t:f:abc")).toBeNull();
    const longest = encodeCallback({ kind: "static", scope: "t", action: "f", id: 999999999999999 });
    expect(new TextEncoder().encode(longest).length).toBe(19);
  });
});

describe("FR-005, FR-017, V-09: ambito g2 dei gruppi (contracts/callback-data.md di 005)", () => {
  it.each(["g2:n", "g2:o:12:1x9k3pq", "g2:r:12:esn6mr", "g2:x:12:esn6mr", "g2:p:12:esn6mr:7"])("FR-005: round-trip di %s", (s) => {
    const cb = decodeCallback(s);
    expect(cb).not.toBeNull();
    expect(encodeCallback(cb!)).toBe(s);
  });

  it.each(["g:n", "g:r", "g:x"])("FR-017: %s di prima del rilascio → null (non più disponibile)", (s) => {
    expect(decodeCallback(s)).toBeNull();
  });

  it("FR-005: decodifica dei campi", () => {
    expect(decodeCallback("g2:n")).toEqual({ kind: "group", action: "n" });
    expect(decodeCallback("g2:o:12:esn6mr")).toEqual({ kind: "group", action: "o", groupId: 12, nameHash: "esn6mr" });
    expect(decodeCallback("g2:p:12:esn6mr:7")).toEqual({ kind: "group", action: "p", groupId: 12, nameHash: "esn6mr", days: 7 });
  });

  it("V-09: caso peggiore di 32 byte ≤ 64", () => {
    const s = encodeCallback({ kind: "group", action: "p", groupId: 999999999999999, nameHash: "zzzzzzz", days: 366 });
    expect(s).toBe("g2:p:999999999999999:zzzzzzz:366");
    expect(new TextEncoder().encode(s).length).toBe(32);
  });

  it.each([
    "g2:o",
    "g2:o:abc:esn6mr",
    "g2:o:12:ESN6MR",
    "g2:o:12:12345678",
    "g2:p:12:esn6mr",
    "g2:p:12:esn6mr:0",
    "g2:p:12:esn6mr:367",
    "g2:z:12:esn6mr",
    "g2:n:12",
    "g2:o:12:esn6mr:7",
    "g2",
  ])("FR-005: %j non valido → null", (s) => {
    expect(decodeCallback(s)).toBeNull();
  });
});

describe("FR-017, V-09: tastiere dei gruppi entro 64 byte", () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const allData = (kb: InlineKeyboardMarkup | undefined) =>
    (kb?.inline_keyboard ?? []).flat().map((b) => ("callback_data" in b ? b.callback_data : ""));

  it("V-09: elenco e scelta con id massimi, nomi di 30 emoji e 366 giorni → callback_data ≤ 64 byte", () => {
    const groups = Array.from({ length: GROUP_BUTTONS_MAX }, (_, i) => ({
      id: 999999999999999 - i,
      name: "👨‍👩‍👧".repeat(6).slice(0, 30) + i,
      members: 200,
    }));
    for (const opts of [
      { title: "t", action: "o" as const, withNew: true },
      { title: "t", action: "p" as const, days: 366, withNew: false },
    ]) {
      const data = allData(renderGroupList(groups, opts).keyboard);
      expect(data.length).toBeGreaterThan(0);
      for (const d of data) expect(bytes(d)).toBeLessThanOrEqual(64);
    }
  });

  it("FR-008: pulsanti della scheda (g2:r, g2:x) con id massimo ≤ 64 byte", () => {
    for (const action of ["r", "x"] as const) {
      const d = encodeCallback({ kind: "group", action, groupId: 999999999999999, nameHash: "zzzzzzz" });
      expect(bytes(d)).toBeLessThanOrEqual(64);
    }
  });
});
