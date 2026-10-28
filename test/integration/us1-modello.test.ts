import { describe, expect, it } from "vitest";
import { DOCUMENT_CAPTION_MAX_LENGTH } from "../../src/config";
import { CSV_EXAMPLE_ROW, T } from "../../src/texts";
import { OWNER_ID } from "../helpers/constants";
import { BOM } from "../helpers/csv-fixtures";
import { count } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { say } from "../helpers/send";

describe("US1: /modello (RF-23, FR-007)", () => {
  it("RF-23, FR-007: /modello invia compleanni-modello.csv con BOM, ';', intestazione e riga d'esempio", async () => {
    const deps = makeDeps();
    await say(deps, "/modello");
    const docs = deps.tg.documents();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ chatId: OWNER_ID, name: "compleanni-modello.csv", mimeType: "text/csv; charset=utf-8" });
    expect(docs[0]!.text).toBe(
      `${BOM}nome;nickname;data;telefono;instagram;telegram;gruppi;priorita;messaggio\r\n${CSV_EXAMPLE_ROW.join(";")}\r\n`,
    );
    expect(deps.tg.messages()).toEqual([]);
  });

  it("FR-007: la caption è la legenda e sta nei 1024 caratteri", async () => {
    const deps = makeDeps();
    await say(deps, "/modello");
    const caption = deps.tg.documents()[0]!.caption!;
    expect(caption).toBe(T.templateCaption);
    expect(caption.length).toBeLessThanOrEqual(DOCUMENT_CAPTION_MAX_LENGTH);
    expect(caption).toContain("nome e data sono obbligatori");
    expect(caption).toContain('salva come "CSV UTF-8"');
  });

  it("FR-018 di 001: /modello durante un flusso nuovo lo annulla in silenzio", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    expect(await count("conversation_state")).toBe(1);
    deps.tg.reset();
    await say(deps, "/modello");
    expect(await count("conversation_state")).toBe(0);
    expect(deps.tg.messages()).toEqual([]);
    expect(deps.tg.documents()).toHaveLength(1);
  });
});
