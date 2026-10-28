import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { clear, consumeStatement, getActive, start, update } from "../../src/db/conversation";
import { addHours } from "../../src/time";
import { NOW } from "../helpers/constants";
import { count } from "../helpers/db";

const CHAT = 1001;
const MIN = 60_000;

describe("A-04: stato conversazione", () => {
  it("A-04: start crea una riga con flow_id di 6 caratteri e scadenza a 24 h", async () => {
    const s = await start(env.DB, CHAT, "nuovo", "nome", { a: 1 }, NOW);
    expect(s.flowId).toMatch(/^[0-9a-z]{6}$/);
    expect(s.expiresAt).toBe("2026-10-29T10:00:00.000Z");
    const row = await env.DB.prepare("SELECT * FROM conversation_state WHERE chat_id = ?").bind(CHAT).first();
    expect(row).toMatchObject({ flow: "nuovo", step: "nome", flow_id: s.flowId, data: '{"a":1}' });
  });

  it("FR-018a: attivo a 23h59m, scaduto e cancellato a 24h esatte", async () => {
    await start(env.DB, CHAT, "nuovo", "nome", {}, NOW);
    expect(await getActive(env.DB, CHAT, new Date(NOW.getTime() + 24 * 60 * MIN - MIN))).not.toBeNull();
    expect(await getActive(env.DB, CHAT, addHours(NOW, 24))).toBeNull();
    expect(await count("conversation_state")).toBe(0);
  });

  it("A-04: update rinnova la scadenza", async () => {
    const s = await start(env.DB, CHAT, "nuovo", "nome", {}, NOW);
    const later = addHours(NOW, 20);
    await update(env.DB, { ...s, step: "nickname" }, later);
    const active = await getActive(env.DB, CHAT, addHours(NOW, 30));
    expect(active).toMatchObject({ step: "nickname", flowId: s.flowId, expiresAt: addHours(later, 24).toISOString() });
  });

  it("FR-018: start su una chat con flusso attivo lo sostituisce con un nuovo flow_id", async () => {
    const a = await start(env.DB, CHAT, "nuovo", "nome", {}, NOW);
    let b = await start(env.DB, CHAT, "gruppi", "nome", {}, NOW);
    // flow_id casuali: in caso di collisione (improbabile) si rigenera.
    while (b.flowId === a.flowId) b = await start(env.DB, CHAT, "gruppi", "nome", {}, NOW);
    expect(await count("conversation_state")).toBe(1);
    expect((await getActive(env.DB, CHAT, NOW))?.flowId).toBe(b.flowId);
  });

  it("RF-06: clear cancella lo stato", async () => {
    await start(env.DB, CHAT, "nuovo", "nome", {}, NOW);
    await clear(env.DB, CHAT);
    expect(await count("conversation_state")).toBe(0);
  });

  it("R-11: consumeStatement cancella solo se il flow_id coincide", async () => {
    const s = await start(env.DB, CHAT, "nuovo", "nome", {}, NOW);
    await consumeStatement(env.DB, CHAT, "zzzzzz").run();
    expect(await count("conversation_state")).toBe(1);
    await consumeStatement(env.DB, CHAT, s.flowId).run();
    expect(await count("conversation_state")).toBe(0);
  });

  it("A-04: un flusso sconosciuto è trattato come assente", async () => {
    await env.DB.prepare(
      "INSERT INTO conversation_state (chat_id, flow, step, flow_id, data, expires_at, updated_at) VALUES (?, 'ignoto', 'x', 'abcdef', '{}', '2099-01-01T00:00:00.000Z', 'x')",
    )
      .bind(CHAT)
      .run();
    expect(await getActive(env.DB, CHAT, NOW)).toBeNull();
    expect(await count("conversation_state")).toBe(0);
  });
});
