import { describe, expect, it } from "vitest";
import { normalizeUsername } from "../../src/domain/username";

describe("BR-16: username senza @", () => {
  it("BR-16: @ iniziale rimosso", () => expect(normalizeUsername("@marco.rossi")).toEqual({ ok: true, value: "marco.rossi" }));
  it("BR-16: spazi rimossi", () => expect(normalizeUsername("  mrossi ")).toEqual({ ok: true, value: "mrossi" }));
  it("BR-16: solo @ → errore", () => expect(normalizeUsername("@")).toEqual({ ok: false }));
  it("BR-16: vuoto → errore", () => expect(normalizeUsername("")).toEqual({ ok: false }));
});
