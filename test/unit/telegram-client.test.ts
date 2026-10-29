import { describe, expect, it } from "vitest";

const BOM = String.fromCharCode(0xfeff);
import { createTelegramApi, TelegramError } from "../../src/telegram/client";

interface Captured {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

function fakeFetch(response: unknown, status = 200) {
  const captured: Captured[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(response), { status });
  }) as typeof fetch;
  return { fn, captured };
}

describe("R-05: client della Bot API", () => {
  it("R-05: sendMessage usa POST JSON senza parse_mode", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: { message_id: 42 } });
    const api = createTelegramApi("tok", fn);
    const res = await api.sendMessage(7, "ciao", { inline_keyboard: [[{ text: "A", callback_data: "s:n" }]] });
    expect(res).toEqual({ message_id: 42 });
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/sendMessage");
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.body).toEqual({
      chat_id: 7,
      text: "ciao",
      reply_markup: { inline_keyboard: [[{ text: "A", callback_data: "s:n" }]] },
    });
    expect(captured[0]!.body).not.toHaveProperty("parse_mode");
  });

  it("R-05: ok:false con error_code 400 → TelegramError con il solo codice", async () => {
    const { fn } = fakeFetch({ ok: false, error_code: 400, description: "Bad Request: dati" }, 400);
    const api = createTelegramApi("tok", fn);
    const err = await api.sendMessage(7, "ciao").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TelegramError);
    expect((err as TelegramError).errorCode).toBe(400);
    expect((err as TelegramError).message).not.toContain("dati");
  });

  it("FR-014 (005): setMyCommands invia l'elenco dei comandi", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: true });
    const api = createTelegramApi("tok", fn);
    await api.setMyCommands([{ command: "gruppi", description: "Elenco gruppi" }]);
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/setMyCommands");
    expect(captured[0]!.body).toEqual({ commands: [{ command: "gruppi", description: "Elenco gruppi" }] });
  });

  it("R-05: editMessageReplyMarkup", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: true });
    const api = createTelegramApi("tok", fn);
    await api.editMessageReplyMarkup(7, 9, { inline_keyboard: [] });
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/editMessageReplyMarkup");
    expect(captured[0]!.body).toEqual({ chat_id: 7, message_id: 9, reply_markup: { inline_keyboard: [] } });
    const { fn: bad } = fakeFetch({ ok: false, error_code: 400 }, 400);
    await expect(createTelegramApi("tok", bad).editMessageReplyMarkup(7, 9, { inline_keyboard: [] })).rejects.toThrow(
      TelegramError,
    );
  });

  it("RF-12: editMessageText con e senza tastiera", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: true });
    const api = createTelegramApi("tok", fn);
    const kb = { inline_keyboard: [[{ text: "WhatsApp", url: "https://wa.me/393331234567" }]] };
    await api.editMessageText(7, 9, "testo\n\n✅ Fatto", kb);
    await api.editMessageText(7, 9, "solo testo");
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/editMessageText");
    expect(captured[0]!.body).toEqual({ chat_id: 7, message_id: 9, text: "testo\n\n✅ Fatto", reply_markup: kb });
    expect(captured[1]!.body).toEqual({ chat_id: 7, message_id: 9, text: "solo testo" });
    expect(captured[0]!.body).not.toHaveProperty("parse_mode");
    const { fn: bad } = fakeFetch({ ok: false, error_code: 400 }, 400);
    await expect(createTelegramApi("tok", bad).editMessageText(7, 9, "x")).rejects.toThrow(TelegramError);
  });

  it("R-05: answerCallbackQuery con e senza testo", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: true });
    const api = createTelegramApi("tok", fn);
    await api.answerCallbackQuery("q1");
    await api.answerCallbackQuery("q2", "Persona non trovata");
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/answerCallbackQuery");
    expect(captured[0]!.body).toEqual({ callback_query_id: "q1" });
    expect(captured[1]!.body).toEqual({ callback_query_id: "q2", text: "Persona non trovata" });
    const { fn: bad } = fakeFetch({ ok: false, error_code: 400 }, 400);
    await expect(createTelegramApi("tok", bad).answerCallbackQuery("q")).rejects.toThrow(TelegramError);
  });

  it("FR-001a: sendMessage invia entities nel body e mai parse_mode", async () => {
    const { fn, captured } = fakeFetch({ ok: true, result: { message_id: 1 } });
    const api = createTelegramApi("tok", fn);
    const entities = [
      { type: "code" as const, offset: 0, length: 9 },
      { type: "bot_command" as const, offset: 11, length: 4 },
    ];
    await api.sendMessage(7, "Ven 30/10  /p_4", undefined, entities);
    await api.sendMessage(7, "semplice", undefined, []);
    await api.sendMessage(7, "semplice");
    expect(captured[0]!.body).toEqual({ chat_id: 7, text: "Ven 30/10  /p_4", entities });
    expect(captured[1]!.body).not.toHaveProperty("entities");
    expect(captured[2]!.body).not.toHaveProperty("entities");
    for (const c of captured) expect(c.body).not.toHaveProperty("parse_mode");
  });
});

// Fetch simulato che conserva l'init grezzo (multipart, GET) per i metodi dei file (004).
function rawFetch(respond: (url: string) => Response) {
  const captured: { url: string; init: RequestInit | undefined }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return respond(String(input));
  }) as typeof fetch;
  return { fn, captured };
}

describe("contracts/telegram-file.md (004): file in uscita e in ingresso", () => {
  it("RNF-09, R-02: sendDocument invia multipart con chat_id, document (Blob con nome file) e caption, senza parse_mode", async () => {
    const { fn, captured } = rawFetch(() => Response.json({ ok: true, result: { message_id: 77 } }));
    const api = createTelegramApi("tok", fn);
    const content = new TextEncoder().encode(BOM + "nome;data\r\n");
    const res = await api.sendDocument(7, { name: "compleanni-modello.csv", content, mimeType: "text/csv; charset=utf-8" }, "Legenda");
    expect(res).toEqual({ message_id: 77 });
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/sendDocument");
    expect(captured[0]!.init?.method).toBe("POST");
    const form = captured[0]!.init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("chat_id")).toBe("7");
    expect(form.get("caption")).toBe("Legenda");
    expect(form.has("parse_mode")).toBe(false);
    const doc = form.get("document") as File;
    expect(doc.name).toBe("compleanni-modello.csv");
    expect(doc.type).toBe("text/csv; charset=utf-8");
    expect(new Uint8Array(await doc.arrayBuffer())).toEqual(content);
  });

  it("R-02: sendDocument senza caption non ha la chiave caption", async () => {
    const { fn, captured } = rawFetch(() => Response.json({ ok: true, result: { message_id: 1 } }));
    await createTelegramApi("tok", fn).sendDocument(7, { name: "a.json", content: new Uint8Array([123, 125]), mimeType: "application/json" });
    expect((captured[0]!.init?.body as FormData).has("caption")).toBe(false);
  });

  it("R-01: getFile invia JSON { file_id } e restituisce file_path", async () => {
    const { fn, captured } = rawFetch(() => Response.json({ ok: true, result: { file_id: "F1", file_path: "documents/file_3.csv", file_size: 12 } }));
    const res = await createTelegramApi("tok", fn).getFile("F1");
    expect(res).toEqual({ file_path: "documents/file_3.csv", file_size: 12 });
    expect(captured[0]!.url).toBe("https://api.telegram.org/bottok/getFile");
    expect(JSON.parse(String(captured[0]!.init?.body))).toEqual({ file_id: "F1" });
  });

  it("R-01: downloadFile fa GET dell'URL del file e restituisce i byte", async () => {
    const { fn, captured } = rawFetch(() => new Response(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])));
    const bytes = await createTelegramApi("tok", fn).downloadFile("documents/file_3.csv");
    expect(captured[0]!.url).toBe("https://api.telegram.org/file/bottok/documents/file_3.csv");
    expect(captured[0]!.init?.method).toBe("GET");
    expect(bytes).toEqual(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]));
  });

  it("principio V: errore HTTP → TelegramError con lo status e senza il token nel messaggio", async () => {
    const { fn } = rawFetch(() => new Response("not found", { status: 404 }));
    const api = createTelegramApi("segretissimo", fn);
    const err = await api.downloadFile("documents/x.csv").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TelegramError);
    expect((err as TelegramError).errorCode).toBe(404);
    expect((err as TelegramError).message).not.toContain("segretissimo");
    const { fn: bad } = rawFetch(() => Response.json({ ok: false, error_code: 400 }, { status: 400 }));
    const err2 = await createTelegramApi("segretissimo", bad).getFile("x").catch((e: unknown) => e);
    expect((err2 as TelegramError).errorCode).toBe(400);
    expect((err2 as TelegramError).message).not.toContain("segretissimo");
  });
});
