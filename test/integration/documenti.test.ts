import { describe, expect, it } from "vitest";
import { T } from "../../src/texts";
import { OWNER_ID } from "../helpers/constants";
import { csvOf, syntheticRows } from "../helpers/csv-fixtures";
import { count, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { say, send, sendFile } from "../helpers/send";
import { photoUpdate } from "../helpers/updates";

const MB = 1024 * 1024;

const getFiles = (deps: TestDeps) => deps.tg.calls.filter((c) => c.method === "getFile");

async function flow(): Promise<string | undefined> {
  return (await rows<{ flow: string }>("SELECT flow FROM conversation_state"))[0]?.flow;
}

describe("RF-24, R-01, R-13: documenti ricevuti", () => {
  it("RF-24: un .pdf → invito a inviare un .csv, nessun download", async () => {
    const deps = makeDeps();
    await sendFile(deps, "foto.PDF", "%PDF-1.4");
    expect(deps.tg.lastText()).toBe(T.sendCsv);
    expect(getFiles(deps)).toEqual([]);
  });

  it("RF-26: un .json senza /ripristina → usa /ripristina, flusso in corso invariato", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await sendFile(deps, "backup.json", "{}");
    expect(deps.tg.lastText()).toBe(T.useRipristina);
    expect(getFiles(deps)).toEqual([]);
    expect(await flow()).toBe("nuovo");
  });

  it("V-07, FR-026: file_size 21 MB e 2 MB → troppo grande, nessuna getFile", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", "x", 21 * MB);
    expect(deps.tg.lastText()).toBe(T.fileTooBigTelegram);
    expect(T.fileTooBigTelegram).toContain("20 MB");
    await sendFile(deps, "a.csv", "x", 2 * MB);
    expect(deps.tg.lastText()).toBe(T.fileTooBig);
    expect(T.fileTooBig).toBe("Il file è troppo grande (massimo 1 MB).");
    expect(getFiles(deps)).toEqual([]);
  });

  it("FR-026, R-01: file senza file_size ma scaricato > 1 MiB → troppo grande", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", new Uint8Array(MB + 1).fill(0x61), null);
    expect(deps.tg.lastText()).toBe(T.fileTooBig);
    expect(await count("conversation_state")).toBe(0);
  });

  it("R-01: getFile in errore → download non riuscito", async () => {
    const deps = makeDeps();
    deps.tg.failNextOn("getFile", 400);
    await sendFile(deps, "a.csv", csvOf(syntheticRows(2)));
    expect(deps.tg.lastText()).toBe(T.downloadFailed);
    deps.tg.failNextOn("downloadFile", 502);
    await sendFile(deps, "a.csv", csvOf(syntheticRows(2)));
    expect(deps.tg.lastText()).toBe(T.downloadFailed);
  });

  it("BR-22: CSV non UTF-8 → rifiuto con l'invito a salvare come CSV UTF-8", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", new Uint8Array([...new TextEncoder().encode("nome;data\nNicol"), 0xf2, 0x3b, 0x31]));
    expect(deps.tg.lastText()).toBe('Non riesco a leggere il file: salvalo da Excel come "CSV UTF-8" e rimandalo.');
  });

  it("BR-18: intestazione non valida → colonne attese", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", "nome;email\nMarco;m@x\n");
    expect(deps.tg.lastText()).toBe(
      "Intestazione non valida. Colonne attese: nome; nickname; data; telefono; instagram; telegram; gruppi; priorita; messaggio (obbligatorie: nome e data).",
    );
  });

  it("FR-009: file vuoto e sole intestazioni (anche con righe vuote) → nessuna riga da importare", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", "");
    expect(deps.tg.lastText()).toBe("Il file non contiene righe da importare.");
    await sendFile(deps, "a.csv", csvOf([]));
    expect(deps.tg.lastText()).toBe("Il file non contiene righe da importare.");
    await sendFile(deps, "a.csv", `${csvOf([])};;\r\n\r\n`);
    expect(deps.tg.lastText()).toBe("Il file non contiene righe da importare.");
  });

  it("FR-008a: 501 righe → rifiuto con massimo 500; 500 righe → anteprima", async () => {
    const deps = makeDeps();
    await sendFile(deps, "a.csv", csvOf(syntheticRows(501)));
    expect(deps.tg.lastText()).toBe("Il file ha più di 500 righe: dividilo in più file da al massimo 500 righe.");
    await sendFile(deps, "a.csv", csvOf(syntheticRows(500)));
    expect(deps.tg.messages().at(-1)!.text).not.toContain("più di 500");
    expect(await flow()).toBe("import");
  });

  it("R-13: CSV inviato durante un flusso nuovo → flusso annullato in silenzio e anteprima", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    deps.tg.reset();
    await sendFile(deps, "a.csv", csvOf(syntheticRows(2)));
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("Anteprima import");
    expect(await flow()).toBe("import");
  });

  it("R-13: CSV non UTF-8 durante un flusso nuovo → flusso annullato e rifiuto", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await sendFile(deps, "a.csv", new Uint8Array([0xff, 0xfe, 0x00]));
    expect(deps.tg.lastText()).toBe(T.csvNotUtf8);
    expect(await count("conversation_state")).toBe(0);
  });

  it("R-13: CSV troppo grande o download fallito durante un flusso nuovo → flusso invariato", async () => {
    const deps = makeDeps();
    await say(deps, "/nuovo");
    await sendFile(deps, "a.csv", "x", 2 * MB);
    expect(await flow()).toBe("nuovo");
    deps.tg.failNextOn("getFile", 400);
    await sendFile(deps, "a.csv", csvOf(syntheticRows(1)));
    expect(deps.tg.lastText()).toBe(T.downloadFailed);
    expect(await flow()).toBe("nuovo");
  });

  it("edge case 'immagine': foto → invito al .csv senza getFile; allo step file di ripristina → attesa del JSON", async () => {
    const deps = makeDeps();
    await send(deps, photoUpdate(OWNER_ID));
    expect(deps.tg.lastText()).toBe(T.sendCsv);
    await say(deps, "/ripristina");
    await send(deps, photoUpdate(OWNER_ID));
    expect(deps.tg.lastText()).toBe(T.waitingBackupFile);
    await sendFile(deps, "foto.jpg", "jpeg");
    expect(deps.tg.lastText()).toBe(T.waitingBackupFile);
    expect(getFiles(deps)).toEqual([]);
    expect(await flow()).toBe("ripristina");
  });
});
