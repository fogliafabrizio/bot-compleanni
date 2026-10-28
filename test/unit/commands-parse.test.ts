import { describe, expect, it } from "vitest";
import { parseCommand } from "../../src/bot/commands";

describe("RF-28: parsing dei comandi", () => {
  it("RF-29: /id", () => expect(parseCommand("/id")).toEqual({ name: "id" }));
  it("RF-29: /ID@BotCompleanni_bot", () => expect(parseCommand("/ID@BotCompleanni_bot")).toEqual({ name: "id" }));
  it("RF-03: /p_12", () => expect(parseCommand("/p_12")).toEqual({ name: "p", personId: 12 }));
  it("RF-03: /p_12@Bot", () => expect(parseCommand("/p_12@Bot")).toEqual({ name: "p", personId: 12 }));
  it("RF-03: /p_x non è una scheda", () => expect(parseCommand("/p_x")).toEqual({ name: "p_x" }));
  it("RF-28: spazi iniziali e argomenti", () => expect(parseCommand("  /nuovo qualcosa")).toEqual({ name: "nuovo" }));
  it("RF-28: testo libero → null", () => expect(parseCommand("ciao")).toBeNull());
});
