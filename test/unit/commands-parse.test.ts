import { describe, expect, it } from "vitest";
import { COMMANDS, parseCommand } from "../../src/bot/commands";

describe("RF-28: parsing dei comandi", () => {
  it("RF-29: /id", () => expect(parseCommand("/id")).toEqual({ name: "id", args: "" }));
  it("RF-29: /ID@BotCompleanni_bot", () => expect(parseCommand("/ID@BotCompleanni_bot")).toEqual({ name: "id", args: "" }));
  it("RF-03: /p_12", () => expect(parseCommand("/p_12")).toEqual({ name: "p", personId: 12, args: "" }));
  it("RF-03: /p_12@Bot", () => expect(parseCommand("/p_12@Bot")).toEqual({ name: "p", personId: 12, args: "" }));
  it("RF-03: /p_x non è una scheda", () => expect(parseCommand("/p_x")).toEqual({ name: "p_x", args: "" }));
  it("RF-28: spazi iniziali e argomenti", () => expect(parseCommand("  /nuovo qualcosa")).toEqual({ name: "nuovo", args: "qualcosa" }));
  it("RF-28: testo libero → null", () => expect(parseCommand("ciao")).toBeNull());
  it("RF-17: /prossimi 7 famiglia → args", () =>
    expect(parseCommand("/prossimi 7 famiglia")).toEqual({ name: "prossimi", args: "7 famiglia" }));
  it("RF-18: /cerca con spazi ai bordi → args ripulito", () =>
    expect(parseCommand("/cerca   Nicolò  ")).toEqual({ name: "cerca", args: "Nicolò" }));
  it("RF-16: /oggi@bot → args vuoto", () => expect(parseCommand("/oggi@bot")).toEqual({ name: "oggi", args: "" }));
  it("RF-03: /p_12 mantiene personId", () => expect(parseCommand("/p_12")?.personId).toBe(12));
  it("RF-19: nome di gruppo con spazi", () =>
    expect(parseCommand("/gruppo  Beach tennis")).toEqual({ name: "gruppo", args: "Beach tennis" }));
});

describe("RF-23, RF-25, RF-26: comandi della feature 004", () => {
  it.each(["modello", "export", "backup", "ripristina"])("/%s riconosciuto e presente in COMMANDS", (name) => {
    expect(parseCommand(`/${name}`)).toEqual({ name, args: "" });
    expect(COMMANDS[name]).toBeTypeOf("function");
  });
});
