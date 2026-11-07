import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { MAX_SENDS_PER_RUN } from "../../src/config";
import { T } from "../../src/texts";
import { localDayStartUtc } from "../../src/time";
import { OWNER_ID } from "../helpers/constants";
import { localInstant, runAt, simulateRegularCron } from "../helpers/cron";
import { count, insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

// Slot delle 00:00 per la priorità Alta (REV-012: §7, RF-10, BR-04, BR-05, BR-10, BR-12, N-01…N-06,
// RNF-19). Compleanno di riferimento: 14/03/2027 (ora solare: 00:00 locali = 13/03 23:00Z).

const marco = {
  id: 1,
  fullName: "Marco Rossi",
  nickname: "Marchino",
  day: 14,
  month: 3,
  year: 1995,
  priority: "alta" as const,
};
const anna = { id: 2, fullName: "Anna Bianchi", day: 14, month: 3, priority: "media" as const };

const at = (deps: TestCronDeps, hour: number, day = 14, opts?: { regular?: boolean }) => runAt(deps, 2027, 3, day, hour, opts);

async function hours(deps: TestCronDeps, from: number, to: number, day = 14): Promise<number[]> {
  const got: number[] = [];
  for (let h = from; h <= to; h++) {
    const before = deps.tg.messages().length;
    await at(deps, h, day);
    if (deps.tg.messages().length > before) got.push(h);
  }
  return got;
}

// Tutte le ore UTC di una giornata locale.
async function runDay(deps: TestCronDeps, y: number, m: number, d: number): Promise<void> {
  const start = localDayStartUtc({ year: y, month: m, day: d }).getTime();
  const end = localDayStartUtc({ year: y, month: m, day: d + 1 }).getTime();
  for (let t = start; t < end; t += 3_600_000) {
    deps.setNow(new Date(t));
    await simulateRegularCron(new Date(t));
    await runHourly(deps, new Date(t));
  }
}

const deliveries = () =>
  rows<{ kind: string; ref: number; status: string; local_date: string }>(
    "SELECT kind, ref, status, local_date FROM deliveries ORDER BY kind, ref",
  );

const setPriority = (id: number, p: "alta" | "media" | "bassa") =>
  env.DB.prepare("UPDATE persons SET priority = ? WHERE id = ?").bind(p, id).run();

const occStatus = async (personId = 1, year = 2027) =>
  (await rows<{ status: string }>("SELECT status FROM occurrences WHERE person_id = ? AND year = ?", personId, year))[0]?.status;

describe("RF-10, §7 (v1.3): reminder delle 00:00 per la priorità Alta", () => {
  it("US1-1: Marco Alta, esecuzione 2026-03-13T23:00Z → reminder del giorno con contatti, Fatto e Salta, senza disable_notification", async () => {
    await insertPerson({ ...marco, phone: "+393331234567", instagram: "marco.rossi", createdAt: "2026-01-01T00:00:00.000Z" });
    const deps = makeCronDeps();
    const scheduledAt = new Date("2026-03-13T23:00:00.000Z");
    expect(localInstant(2026, 3, 14, 0).toISOString()).toBe(scheduledAt.toISOString());
    deps.setNow(scheduledAt);
    await simulateRegularCron(scheduledAt);
    await runHourly(deps, scheduledAt);
    const msgs = deps.tg.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.chatId).toBe(OWNER_ID);
    expect(msgs[0]!.text).toBe([T.reminderTitle("Marchino", "Marco Rossi", 31, false), "📱 +393331234567"].join("\n"));
    expect(labels(msgs[0]!.keyboard)).toEqual(["WhatsApp", "Instagram", "Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
    // Nessuna opzione di invio silenzioso: la chiamata ha solo chat, testo, tastiera ed entità.
    expect(Object.keys(msgs[0]!).every((k) => ["method", "chatId", "text", "keyboard", "entities"].includes(k))).toBe(true);
    expect(await deliveries()).toEqual([{ kind: "giorno", ref: 0, status: "inviato", local_date: "2026-03-14" }]);
  });

  it("FR-003: il reminder delle 00:00 è identico a quello delle 9:00", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    const deps = makeCronDeps();
    await at(deps, 0);
    await at(deps, 9);
    const [m0, m9] = deps.tg.messages();
    expect(m0!.text).toBe(m9!.text);
    expect(labels(m0!.keyboard)).toEqual(labels(m9!.keyboard));
  });

  it.each([
    ["Fatto ✅", "fatto"],
    ["Salta quest'anno", "saltato"],
  ])("US1-2, BR-07: «%s» sul reminder delle 00:00 → nessun altro invio né recupero", async (btn, esito) => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 0);
    const [m0] = deps.tg.messages();
    await press(deps, cbOf(m0!.keyboard, btn), 100);
    expect(await occStatus()).toBe(esito);
    deps.tg.reset();
    expect(await hours(deps, 1, 23)).toEqual([]);
    await at(deps, 13, 15);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("US1-3: senza risposta alle 00:00 → reminder alle 9:00", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    expect(await hours(deps, 0, 9)).toEqual([0, 9]);
  });

  it("US1-4, §7: Anna Media → nulla alle 00:00, primo alle 9:00; Alta e Media lo stesso giorno", async () => {
    await insertPerson(marco);
    await insertPerson(anna);
    const deps = makeCronDeps();
    await at(deps, 0);
    expect(deps.tg.messages().map((m) => m.text)).toEqual([T.reminderTitle("Marchino", "Marco Rossi", 32, false)]);
    deps.tg.reset();
    for (let h = 1; h <= 8; h++) await at(deps, h);
    expect(deps.tg.messages()).toHaveLength(0);
    await at(deps, 9);
    expect(deps.tg.messages()).toHaveLength(2);
    expect(await count("deliveries", "ref = 0")).toBe(1);
  });

  it("US1-5, N-03: errore Telegram alle 00:00 → retry alle 1:00", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    deps.tg.failNext(500);
    const r0 = await at(deps, 0);
    expect(r0).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
    expect(await deliveries()).toEqual([{ kind: "giorno", ref: 0, status: "fallito", local_date: "2027-03-14" }]);
    await at(deps, 1);
    expect(deps.tg.messages()).toHaveLength(1);
    expect((await deliveries())[0]).toMatchObject({ ref: 0, status: "inviato" });
  });

  it("US1-5, N-03: fallisce per tutto il giorno → retry dalle 1:00, abbandonato il giorno dopo", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    deps.tg.failWhen(() => true, 502);
    for (let h = 0; h < 24; h++) await at(deps, h);
    const r = await rows<{ attempts: number; status: string }>("SELECT attempts, status FROM deliveries WHERE kind = 'giorno' AND ref = 0");
    expect(r).toEqual([{ attempts: 24, status: "fallito" }]);
    await at(deps, 0, 15);
    expect(await count("deliveries", "kind = 'giorno' AND ref = 0 AND status = 'abbandonato'")).toBe(1);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("US1-6, BR-10, BR-11: Alta inserita alle 10:00 del compleanno → nessuno slot 0, primo alle 13:00", async () => {
    await insertPerson({ ...marco, createdAt: localInstant(2027, 3, 14, 10).toISOString() });
    const deps = makeCronDeps();
    expect(await hours(deps, 0, 23)).toEqual([13, 18, 21]);
    expect(await count("deliveries", "ref = 0")).toBe(0);
  });

  it("US1-7, BR-04: Alta nata il 29/02, anno 2027 → reminder alle 00:00 del 28/02", async () => {
    await insertPerson({ ...marco, day: 29, month: 2, year: 1996 });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 2, 28, 0);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("(compleanno il 29/02)");
    expect(await deliveries()).toEqual([{ kind: "giorno", ref: 0, status: "inviato", local_date: "2027-02-28" }]);
  });

  it("US1-8, RNF-19: slot 0 abbandonato → /stato «Marco, reminder delle 00:00 del 14/03»", async () => {
    await insertPerson({ ...marco, nickname: null });
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.startsWith("🎂"), 502);
    for (let h = 0; h < 24; h++) await at(deps, h);
    await at(deps, 0, 15);
    deps.tg.reset();
    deps.setNow(localInstant(2027, 3, 15, 0));
    await say(deps, "/stato");
    const lines = deps.tg.lastText()!.split("\n");
    expect(lines).toContain("   – Marco Rossi, reminder delle 00:00 del 14/03");
    expect(lines).toContain("   – Marco Rossi, reminder delle 9:00 del 14/03");
    expect(lines).toContain("⏱ Ultimo controllo orario: oggi alle 00:00");
    for (const l of lines) expect(l).not.toMatch(/(^|[^0-9])0:00/);
  });

  it("US1-9, RNF-19, N-06: buco 23:00 → 2:00 e 21:00 → 00:00", async () => {
    const lastRunAt = (d: number, h: number) =>
      env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
        .bind(localInstant(2027, 3, d, h).toISOString(), localInstant(2027, 3, d, h).toISOString())
        .run();
    const deps = makeCronDeps();
    await lastRunAt(13, 23);
    await at(deps, 2, 14, { regular: false });
    expect(deps.tg.lastText()).toContain("dalle 23:00 del 13/03 alle 2:00 del 14/03");
    await env.DB.prepare("DELETE FROM settings").run();
    deps.tg.reset();
    await lastRunAt(13, 21);
    await at(deps, 0, 14, { regular: false });
    expect(deps.tg.lastText()).toContain("dalle 21:00 del 13/03 alle 00:00 del 14/03");
  });

  it.each([
    ["alta", 3, 5],
    ["media", 1, 3],
    ["bassa", 0, 2],
  ] as const)("SC-002: occorrenza %s senza risposta → %i pre-reminder, %i reminder, 1 recupero", async (priority, pre, giorno) => {
    await insertPerson({ ...marco, priority });
    const deps = makeCronDeps();
    for (let d = 5; d <= 16; d++) await runDay(deps, 2027, 3, d);
    const texts = deps.tg.messages().map((m) => m.text);
    expect(texts.filter((t) => t.startsWith("📅"))).toHaveLength(pre);
    expect(texts.filter((t) => t.startsWith("🎂"))).toHaveLength(giorno);
    expect(texts.filter((t) => t.startsWith("⏰"))).toHaveLength(1);
  });

  it("SC-003, N-02: doppia esecuzione delle 00:00 → un solo invio ('giorno', 0)", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 0);
    await at(deps, 0);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(await count("deliveries", "kind = 'giorno' AND ref = 0")).toBe(1);
  });
});

describe("RF-10, BR-10, BR-12 (v1.3): casi limite dello slot delle 00:00", () => {
  it("BR-10: Alta creata alle 23:30 del giorno prima → lo slot 0 parte, nessun pre-reminder −1", async () => {
    const created = new Date(localInstant(2027, 3, 13, 23).getTime() + 30 * 60_000).toISOString();
    await insertPerson({ ...marco, createdAt: created });
    const deps = makeCronDeps();
    await at(deps, 0);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(await count("deliveries", "kind = 'pre'")).toBe(0);
  });

  it.each([
    ["00:00:00", 0],
    ["00:30", 30],
  ])("BR-10: Alta creata alle %s del compleanno → lo slot 0 non parte", async (_label, minutes) => {
    const created = new Date(localInstant(2027, 3, 14, 0).getTime() + minutes * 60_000).toISOString();
    await insertPerson({ ...marco, createdAt: created });
    const deps = makeCronDeps();
    expect(await hours(deps, 0, 9)).toEqual([9]);
    expect(await count("deliveries", "ref = 0")).toBe(0);
  });

  it("BR-12: Media → Alta alle 00:30 → slot 0 non parte, valgono 9, 13, 18, 21", async () => {
    await insertPerson({ ...marco, priority: "media" });
    const deps = makeCronDeps();
    await at(deps, 0);
    await setPriority(1, "alta");
    expect(await hours(deps, 1, 23)).toEqual([9, 13, 18, 21]);
    expect(await count("deliveries", "ref = 0")).toBe(0);
  });

  it("BR-12: Alta → Media prima delle 00:00 → lo slot 0 non parte", async () => {
    await insertPerson(marco);
    await setPriority(1, "media");
    const deps = makeCronDeps();
    await at(deps, 0);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("BR-12: Alta → Media alle 8:00 dopo l'invio delle 00:00 → invio 0 resta, partono 9, 13, 18 e il recupero", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 0);
    await setPriority(1, "media");
    expect(await hours(deps, 1, 23)).toEqual([9, 13, 18]);
    await at(deps, 13, 15);
    const d = await deliveries();
    expect(d.filter((x) => x.kind === "giorno").map((x) => x.ref)).toEqual([0, 9, 13, 18]);
    expect(d.filter((x) => x.kind === "recupero")).toHaveLength(1);
  });

  it("N-04: esecuzione delle 00:00 mancata → nessun recupero, alle 9:00 il successivo", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    expect(await hours(deps, 1, 9)).toEqual([9]);
    expect(await count("deliveries", "ref = 0")).toBe(0);
  });

  it("N-03: riga in_invio delle 00:00 (esito sconosciuto) → non ritentata", async () => {
    await insertPerson(marco);
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14" });
    await insertDelivery({
      occurrenceId: occ,
      kind: "giorno",
      ref: 0,
      status: "in_invio",
      localDate: "2027-03-14",
      sentAt: localInstant(2027, 3, 14, 0).toISOString(),
    });
    const deps = makeCronDeps();
    expect(await hours(deps, 0, 8)).toEqual([]);
    expect((await deliveries())[0]).toMatchObject({ ref: 0, status: "in_invio" });
  });

  it(`N-01: più di ${MAX_SENDS_PER_RUN} Alta alle 00:00 → le eccedenti alle esecuzioni successive`, async () => {
    for (let i = 1; i <= MAX_SENDS_PER_RUN + 5; i++) await insertPerson({ id: i, fullName: `Persona ${i}`, day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    const r0 = await at(deps, 0);
    expect(r0).toMatchObject({ claimed: MAX_SENDS_PER_RUN, sent: MAX_SENDS_PER_RUN });
    expect(await count("deliveries", "ref = 0 AND status = 'fallito'")).toBe(5);
    deps.tg.reset();
    await at(deps, 1);
    expect(deps.tg.messages()).toHaveLength(5);
    expect(await count("deliveries", "ref = 0 AND status = 'inviato'")).toBe(MAX_SENDS_PER_RUN + 5);
  });

  it("RF-16: /oggi dopo l'invio delle 00:00 → come oggi, non conta come slot", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 0);
    deps.tg.reset();
    deps.setNow(new Date(localInstant(2027, 3, 14, 0).getTime() + 30 * 60_000));
    await say(deps, "/oggi");
    expect(deps.tg.messages()[0]!.text).toContain("Marco Rossi");
    expect(await count("deliveries")).toBe(1);
    deps.tg.reset();
    await at(deps, 9);
    expect(deps.tg.messages()).toHaveLength(1);
  });

  it("FR-022: occorrenza già aperta il giorno del deploy → nessun invio retroattivo delle 00:00", async () => {
    await insertPerson(marco);
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "inviato", localDate: "2027-03-14" });
    const deps = makeCronDeps();
    expect(await hours(deps, 10, 23)).toEqual([13, 18, 21]);
    expect(await count("deliveries", "ref = 0")).toBe(0);
  });

  it("BR-05: Alta nata il 01/01, esecuzione 2026-12-31T23:00Z → occorrenza 2027 con «L'anno scorso» del 2026; recupero il 02/01/2027 alle 13", async () => {
    await insertPerson({ ...marco, day: 1, month: 1 });
    await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-01-01", status: "fatto" });
    const deps = makeCronDeps();
    const scheduledAt = new Date("2026-12-31T23:00:00.000Z");
    deps.setNow(scheduledAt);
    await simulateRegularCron(scheduledAt);
    await runHourly(deps, scheduledAt);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("L'anno scorso: fatto ✅");
    expect(await rows("SELECT year, effective_date FROM occurrences WHERE person_id = 1 ORDER BY year")).toEqual([
      { year: 2026, effective_date: "2026-01-01" },
      { year: 2027, effective_date: "2027-01-01" },
    ]);
    expect(await deliveries()).toEqual([{ kind: "giorno", ref: 0, status: "inviato", local_date: "2027-01-01" }]);
    await runDay(deps, 2027, 1, 1);
    deps.tg.reset();
    for (let h = 0; h <= 13; h++) await runAt(deps, 2027, 1, 2, h);
    expect(deps.tg.messages().map((m) => m.text.slice(0, 1))).toEqual(["⏰"]);
    expect(deps.tg.messages()).toHaveLength(1);
    expect((await rows<{ local_date: string }>("SELECT local_date FROM deliveries WHERE kind = 'recupero'"))[0]?.local_date).toBe("2027-01-02");
  });
});
