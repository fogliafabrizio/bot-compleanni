import { describe, expect, it } from "vitest";
import { isInstagramLinkable, isTelegramLinkable, normalizeUsername } from "../../src/domain/username";

describe("BR-16: username senza @", () => {
  it("BR-16: @ iniziale rimosso", () => expect(normalizeUsername("@marco.rossi")).toEqual({ ok: true, value: "marco.rossi" }));
  it("BR-16: spazi rimossi", () => expect(normalizeUsername("  mrossi ")).toEqual({ ok: true, value: "mrossi" }));
  it("BR-16: solo @ → errore", () => expect(normalizeUsername("@")).toEqual({ ok: false }));
  it("BR-16: vuoto → errore", () => expect(normalizeUsername("")).toEqual({ ok: false }));
});

describe("FR-002, Q5: username validi per il link", () => {
  it.each(["marco.rossi", "m_r", "a".repeat(30)])("FR-002: Instagram %j valido", (u) => {
    expect(isInstagramLinkable(u)).toBe(true);
  });

  it.each(["marco rossi", "màrco", "a".repeat(31), ""])("FR-002: Instagram %j non valido", (u) => {
    expect(isInstagramLinkable(u)).toBe(false);
  });

  it.each(["mrossi", "a".repeat(32)])("FR-002: Telegram %j valido", (u) => {
    expect(isTelegramLinkable(u)).toBe(true);
  });

  it.each(["abc", "marco.rossi", "a".repeat(33), "màrco1"])("FR-002: Telegram %j non valido", (u) => {
    expect(isTelegramLinkable(u)).toBe(false);
  });
});
