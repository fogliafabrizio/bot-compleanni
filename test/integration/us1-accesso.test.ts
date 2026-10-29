import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleRequest } from "../../src/bot/webhook";
import { OWNER_ID, SECRET, STRANGER_ID } from "../helpers/constants";
import { count, totalRows } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { send } from "../helpers/send";
import { callbackUpdate, documentUpdate, textUpdate, webhookRequest } from "../helpers/updates";
import { T } from "../../src/texts";

describe("US1: accesso riservato al proprietario", () => {
  describe("RNF-03: token segreto del webhook", () => {
    it("RNF-03: senza header → 401 con corpo vuoto, nessun effetto", async () => {
      const deps = makeDeps();
      const res = await send(deps, textUpdate(OWNER_ID, "/nuovo"), null);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
      expect(deps.tg.calls).toEqual([]);
      expect(deps.counter.count).toBe(0);
      expect(await totalRows()).toBe(0);
    });

    it("RNF-03: header errato con l'ID del proprietario → 401, nessun effetto", async () => {
      const deps = makeDeps();
      const res = await send(deps, textUpdate(OWNER_ID, "/nuovo"), "sbagliato");
      expect(res.status).toBe(401);
      expect(deps.tg.calls).toEqual([]);
      expect(await count("conversation_state")).toBe(0);
      expect(await count("persons")).toBe(0);
    });

    it("RNF-03: header della stessa lunghezza ma diverso → 401", async () => {
      const deps = makeDeps();
      const res = await send(deps, textUpdate(OWNER_ID, "/id"), "test-secreX");
      expect(res.status).toBe(401);
      expect(deps.tg.calls).toEqual([]);
    });

    it("RNF-03: GET /webhook → 405; POST /altro → 404; body non JSON → 400", async () => {
      const deps = makeDeps();
      expect((await handleRequest(webhookRequest({}, SECRET, "GET"), deps, SECRET)).status).toBe(405);
      expect((await handleRequest(webhookRequest({}, SECRET, "POST", "/altro"), deps, SECRET)).status).toBe(404);
      expect((await send(deps, "non json")).status).toBe(400);
      expect(deps.tg.calls).toEqual([]);
    });
  });

  describe("RF-29: /id per chiunque", () => {
    it("RF-29: /id da un estraneo risponde con il suo ID", async () => {
      const deps = makeDeps();
      const res = await send(deps, textUpdate(STRANGER_ID, "/id"));
      expect(res.status).toBe(200);
      expect(deps.tg.messages()).toHaveLength(1);
      expect(deps.tg.messages()[0]).toMatchObject({ chatId: STRANGER_ID });
      expect(deps.tg.lastText()).toContain("2002");
      expect(await totalRows()).toBe(0);
    });

    it("RF-29: /id dal proprietario risponde con il suo ID", async () => {
      const deps = makeDeps();
      await send(deps, textUpdate(OWNER_ID, "/id"));
      expect(deps.tg.lastText()).toContain("1001");
    });

    it("RF-29: /id@BotCompleanni_bot funziona", async () => {
      const deps = makeDeps();
      await send(deps, textUpdate(STRANGER_ID, "/id@BotCompleanni_bot"));
      expect(deps.tg.lastText()).toContain("2002");
    });
  });

  describe("RF-30, RNF-02, SC-002: estranei ignorati", () => {
    it.each(["/start", "/nuovo", "/gruppi", "/p_1", "ciao"])("RF-30: %s da estraneo → nessuna risposta", async (text) => {
      const deps = makeDeps();
      const res = await send(deps, textUpdate(STRANGER_ID, text));
      expect(res.status).toBe(200);
      expect(deps.tg.calls).toEqual([]);
      expect(deps.counter.count).toBe(0);
      expect(await totalRows()).toBe(0);
    });

    it("RNF-02: callback s:n da estraneo → nemmeno answerCallbackQuery", async () => {
      const deps = makeDeps();
      const res = await send(deps, callbackUpdate(STRANGER_ID, "s:n"));
      expect(res.status).toBe(200);
      expect(deps.tg.calls).toEqual([]);
      expect(await totalRows()).toBe(0);
    });

    it("RF-30: un estraneo non tocca il flusso attivo del proprietario", async () => {
      await env.DB.prepare(
        "INSERT INTO conversation_state (chat_id, flow, step, flow_id, data, expires_at, updated_at) VALUES (?, 'nuovo', 'nome', 'abc123', '{}', '2099-01-01T00:00:00.000Z', 'x')",
      )
        .bind(OWNER_ID)
        .run();
      const deps = makeDeps();
      await send(deps, textUpdate(STRANGER_ID, "/annulla"));
      await send(deps, textUpdate(STRANGER_ID, "Marco"));
      const row = await env.DB.prepare("SELECT flow_id, step FROM conversation_state WHERE chat_id = ?")
        .bind(OWNER_ID)
        .first();
      expect(row).toEqual({ flow_id: "abc123", step: "nome" });
      expect(deps.tg.calls).toEqual([]);
    });
  });

  it("R-04: il proprietario in una chat di gruppo non riceve risposta", async () => {
    const deps = makeDeps();
    await send(deps, textUpdate(OWNER_ID, "/start", "group"));
    expect(deps.tg.calls).toEqual([]);
  });

  describe("RNF-02, principio IV: errori interni", () => {
    it("RNF-02: errore su update di un estraneo → nessuna chiamata a Telegram", async () => {
      const deps = makeDeps();
      deps.counter.failing = true;
      // L'estraneo non arriva a D1: forziamo l'errore direttamente su Telegram con /id.
      deps.tg.sendMessage = async () => {
        throw new Error("boom");
      };
      const res = await send(deps, textUpdate(STRANGER_ID, "/id"));
      expect(res.status).toBe(200);
      expect(deps.tg.calls).toEqual([]);
    });

    it("principio IV: errore su update del proprietario → un solo messaggio di errore", async () => {
      const deps = makeDeps();
      deps.counter.failing = true;
      const res = await send(deps, textUpdate(OWNER_ID, "/nuovo"));
      expect(res.status).toBe(200);
      expect(deps.tg.messages()).toHaveLength(1);
      expect(deps.tg.lastText()).toBe(T.genericError);
    });
  });
});

describe("RNF-09, FR-027 di 001: file e comandi della feature 004 riservati al proprietario", () => {
  it("RNF-09: un estraneo invia CSV, JSON e i 4 comandi → nessuna chiamata Telegram né D1", async () => {
    const deps = makeDeps();
    deps.tg.addFile("f1", "nome;data\nMarco;14/03\n");
    await send(deps, documentUpdate(STRANGER_ID, "persone.csv", "f1", 30));
    await send(deps, documentUpdate(STRANGER_ID, "backup.json", "f1", 30));
    for (const c of ["/modello", "/export", "/backup", "/ripristina"]) await send(deps, textUpdate(STRANGER_ID, c));
    expect(deps.tg.calls).toEqual([]);
    expect(deps.counter.count).toBe(0);
    expect(await totalRows()).toBe(0);
  });

  it("RNF-09: lo stesso dal proprietario in un gruppo → ignorato", async () => {
    const deps = makeDeps();
    deps.tg.addFile("f1", "nome;data\nMarco;14/03\n");
    await send(deps, documentUpdate(OWNER_ID, "persone.csv", "f1", 30, "group"));
    await send(deps, documentUpdate(OWNER_ID, "backup.json", "f1", 30, "supergroup"));
    for (const c of ["/modello", "/export", "/backup", "/ripristina"]) await send(deps, textUpdate(OWNER_ID, c, "group"));
    expect(deps.tg.calls).toEqual([]);
    expect(deps.counter.count).toBe(0);
    expect(await totalRows()).toBe(0);
  });
});
