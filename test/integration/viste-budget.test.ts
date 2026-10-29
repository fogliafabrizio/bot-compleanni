import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { LIST_MAX_LINES_PER_MESSAGE, MESSAGE_MAX_LENGTH } from "../../src/config";
import { nameHash } from "../../src/domain/text";
import { insertOccurrence, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { commandParts } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { NOW } from "../helpers/constants";
import { T } from "../../src/texts";

// Oggi = mercoledì 28/10/2026. 200 persone (RNF-16) con compleanni sparsi su tutto l'anno.

async function seed(n: number, opts: { day?: number; month?: number; group?: number } = {}): Promise<void> {
  const iso = NOW.toISOString();
  const stmts = Array.from({ length: n }, (_, i) =>
    env.DB.prepare(
      `INSERT INTO persons (full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'media', ?, ?)`,
    ).bind(
      `Persona Sintetica ${i}`,
      `persona sintetica ${i}`,
      i % 2 === 0 ? `Nick ${i}` : null,
      opts.day ?? (i % 28) + 1,
      opts.month ?? (i % 12) + 1,
      1980 + (i % 30),
      iso,
      iso,
    ),
  );
  await env.DB.batch(stmts);
  if (opts.group !== undefined) {
    await env.DB.prepare("INSERT INTO person_groups (person_id, group_id) SELECT id, ? FROM persons").bind(opts.group).run();
  }
}

async function measure(deps: TestDeps, run: () => Promise<unknown>): Promise<{ d1: number; tg: number }> {
  deps.counter.count = 0;
  deps.tg.reset();
  await run();
  return { d1: deps.counter.count, tg: deps.tg.calls.length };
}

// `keyboardOnLast`: la scheda gruppo (FR-008 di 005) ha Rinomina ed Elimina sull'ultimo messaggio.
function expectCompleteList(deps: TestDeps, n: number, messages: number, keyboardOnLast = false): void {
  const msgs = deps.tg.messages();
  expect(msgs).toHaveLength(messages);
  for (const [i, m] of msgs.entries()) {
    expect(m.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    expect(commandParts(m).length).toBeLessThanOrEqual(LIST_MAX_LINES_PER_MESSAGE);
    // RNF-14, SC-005: nessuna tastiera sulle liste.
    if (keyboardOnLast && i === msgs.length - 1) expect(m.keyboard).toBeDefined();
    else expect(m.keyboard).toBeUndefined();
  }
  const ids = msgs.flatMap(commandParts);
  expect(ids).toHaveLength(n);
  expect(new Set(ids).size).toBe(n);
}

describe("principio II, RNF-14, RNF-16, SC-002, SC-005: budget delle viste", () => {
  it("RNF-16, SC-002: /prossimi 366 con 200 persone → 200 righe uniche in 5 messaggi, 2 D1 + 5 Telegram", async () => {
    await seed(200);
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/prossimi 366"));
    expectCompleteList(deps, 200, 5);
    expect(m).toEqual({ d1: 2, tg: 5 });
  });

  it("RNF-16, RF-19: /gruppo (scheda gruppo) con tutte le 200 persone → 5 messaggi, 2 D1 + 5 Telegram", async () => {
    const g = (await env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES ('Tutti', 'tutti') RETURNING id").first<{ id: number }>())!.id;
    await seed(200, { group: g });
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/gruppo tutti"));
    expectCompleteList(deps, 200, 5, true);
    expect(m).toEqual({ d1: 2, tg: 5 });
  });

  it("principio II, RF-17 (005): /prossimi 366 <testo> con esito one su 200 persone → una batch, 2 D1 + 5 Telegram ≤ 8", async () => {
    const g = (await env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES ('👨‍👩‍👧 Tutti', '👨‍👩‍👧 tutti') RETURNING id").first<{ id: number }>())!.id;
    await env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES ('Lavoro', 'lavoro')").run();
    await seed(200, { group: g });
    const deps = makeDeps();
    deps.counter.batches = [];
    const m = await measure(deps, () => say(deps, "/prossimi 366 tutti"));
    expectCompleteList(deps, 200, 5);
    expect(deps.tg.messages()[0]!.text.split("\n")[0]).toBe(T.upcomingHeader(366, "👨‍👩‍👧 Tutti"));
    expect(deps.counter.batches).toHaveLength(1);
    expect(m).toEqual({ d1: 2, tg: 5 });
  });

  it("principio II, FR-011 (005): tocco g2:p con 200 persone → 2 D1 (clear, batch) + 5 messaggi + 1 answer = 8 ≤ 9", async () => {
    const g = (await env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES ('Tutti', 'tutti') RETURNING id").first<{ id: number }>())!.id;
    await seed(200, { group: g });
    const deps = makeDeps();
    const m = await measure(deps, () => press(deps, `g2:p:${g}:${nameHash("Tutti")}:366`));
    expectCompleteList(deps, 200, 5);
    expect(m).toEqual({ d1: 2, tg: 6 });
  });

  it("principio II: con un flusso guidato attivo /prossimi 366 costa una chiamata D1 in più (clear)", async () => {
    await seed(200);
    const deps = makeDeps();
    await say(deps, "/nuovo");
    const m = await measure(deps, () => say(deps, "/prossimi 366"));
    expect(m).toEqual({ d1: 3, tg: 5 });
  });

  it("principio II, FR-007a: /oggi con 15 compleanni → 2 D1 + 11 Telegram", async () => {
    await seed(15, { day: 28, month: 10 });
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/oggi"));
    expect(m).toEqual({ d1: 2, tg: 11 });
  });

  it("principio II: /anno con 200 saltati in serie → 2 D1 + 9 messaggi, ognuno entro i limiti", async () => {
    await seed(200);
    await env.DB.prepare(
      `INSERT INTO occurrences (person_id, year, effective_date, status, created_at)
       SELECT id, y.year, printf('%d-%02d-%02d', y.year, birth_month, birth_day), 'saltato', 'x'
       FROM persons, (SELECT 2024 AS year UNION ALL SELECT 2025) y`,
    ).run();
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/anno 2025"));
    expect(m).toEqual({ d1: 2, tg: 9 });
    expect(m.d1 + m.tg).toBeLessThanOrEqual(50);
    for (const msg of deps.tg.messages()) {
      expect(msg.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
      expect(commandParts(msg).length).toBeLessThanOrEqual(LIST_MAX_LINES_PER_MESSAGE);
    }
    expect(deps.tg.messages().flatMap(commandParts)).toHaveLength(400);
  });

  it("principio II: t:f → 1 D1 + 2 Telegram; p:f → 3 D1 + 2 Telegram", async () => {
    const id = await insertPerson({ fullName: "Marco", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const [occ] = await rows<{ id: number }>("SELECT id FROM occurrences");
    expect(await measure(deps, () => press(deps, `t:f:${occ!.id}`))).toEqual({ d1: 1, tg: 2 });

    const luca = await insertPerson({ fullName: "Luca", day: 25, month: 10 });
    await insertOccurrence({ personId: luca, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    expect(await measure(deps, () => press(deps, `p:f:${luca}`))).toEqual({ d1: 3, tg: 2 });
    expect(id).toBeGreaterThan(0);
  });
});

describe("principio II, RNF-17: budget di /stato e /statistiche (007)", () => {
  it("RNF-17, R-07: /stato ≤ 5 subrequest (router + 1 batch D1 + getWebhookInfo + sendMessage)", async () => {
    await seed(200);
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/stato"));
    expect(m).toEqual({ d1: 2, tg: 2 });
    expect(m.d1 + m.tg).toBeLessThanOrEqual(5);
  });

  it("RNF-17, R-08: /statistiche ≤ 4 subrequest (router + 1 batch D1 + sendMessage)", async () => {
    await seed(200);
    const deps = makeDeps();
    const m = await measure(deps, () => say(deps, "/statistiche"));
    expect(m).toEqual({ d1: 2, tg: 1 });
    expect(m.d1 + m.tg).toBeLessThanOrEqual(4);
  });
});
