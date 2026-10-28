import { describe, expect, it } from "vitest";
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
