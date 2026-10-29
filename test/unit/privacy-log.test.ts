import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramError } from "../../src/telegram/client";
import { insertDelivery, insertOccurrence, insertPerson } from "../helpers/db";
import { runAt, runScheduledAt } from "../helpers/cron";
import { csvOf } from "../helpers/csv-fixtures";
import { makeCronDeps, makeDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

// Principio V, RNF-08: i log contengono solo codici e numeri.
const SECRETS = ["Marco", "Rossi", "Marchino", "393331234567", "marco.ig", "marco_tg", "auguri", "Anna", "Bianchi", "1995", "14/03", "03-14"];

describe("principio V, RNF-08: nessun dato personale nei log", () => {
  let lines: string[] = [];
  beforeEach(() => {
    lines = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("principio V: runHourly con invii riusciti e falliti e un tocco Fatto", async () => {
    await insertPerson({
      id: 1,
      fullName: "Marco Rossi",
      nickname: "Marchino",
      day: 14,
      month: 3,
      year: 1995,
      phone: "+393331234567",
      instagram: "marco.ig",
      telegram: "marco_tg",
      priority: "alta",
      customMessage: "Tanti auguri {nome}",
    });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.includes("Anna"), 400);
    await runAt(deps, 2027, 3, 14, 9);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fatto ✅"), 100);
    expect(lines.some((l) => l.includes("cron_run"))).toBe(true);
    for (const l of lines) for (const s of SECRETS) expect(l).not.toContain(s);
  });

  it("principio V (003): viste, ricerche e tocchi non loggano testi di ricerca, nomi o date", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", nickname: "Marchino", day: 28, month: 10, year: 1995 });
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 14, month: 3 });
    const deps = makeDeps();
    for (const text of ["/oggi", "/prossimi 366", "/cerca Marchino", "/cerca Bianchi", "/gruppo Rossi", "/mese 3", "/scaduti", "/anno 1995"]) {
      await say(deps, text);
    }
    await press(deps, cbOf(deps.tg.messages()[0]!.keyboard, "Fatto ✅"));
    await press(deps, "p:f:1");
    for (const l of lines) for (const s of SECRETS) expect(l).not.toContain(s);
  });

  it("principio V (004): import, export, backup, ripristino e backup mensile non loggano nomi, date, contenuti o token", async () => {
    const deps = makeCronDeps();
    await sendFile(deps, "agenda.csv", csvOf([["Marco Rossi", "Marchino", "14/03/1995", "+39 3331234567", "marco.ig", "marco_tg", "Famiglia", "alta", "Tanti auguri {nome}"]]));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Importa"));
    await sendFile(deps, "rotto.csv", csvOf([["Anna Bianchi", "", "31/04/1995"]]));
    await say(deps, "/export");
    await say(deps, "/backup");
    const backup = deps.tg.documents().at(-1)!.text;
    await say(deps, "/ripristina");
    await sendFile(deps, "backup.json", backup.replace("Marco Rossi", "x".repeat(70)));
    await sendFile(deps, "backup.json", backup);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Continua"));
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Sì, ripristina"));
    deps.tg.failNextOn("sendDocument", 429);
    await runScheduledAt(deps, 2026, 11, 1, 9);
    await runScheduledAt(deps, 2026, 11, 1, 10);
    expect(lines.some((l) => l.includes("auto_backup"))).toBe(true);
    for (const l of lines) for (const s of [...SECRETS, "test-token", "documents/"]) expect(l).not.toContain(s);
  });

  it("principio V, RNF-08, FR-018 (007): avviso di buco, backup con errore interno, /stato e /statistiche loggano solo codici e numeri", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", nickname: "Marchino", day: 14, month: 3, year: 1995, priority: "alta" });
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "abbandonato", localDate: "2027-03-13" });
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', '2027-03-01T05:00:00.000Z', '2027-03-01T05:00:00.000Z')").run();
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.startsWith("⚠️"), 429);
    deps.tg.sendDocument = async () => {
      throw new Error("guasto interno con Marco Rossi");
    };
    await runScheduledAt(deps, 2027, 3, 1, 9, { regular: false });
    await runAt(deps, 2027, 3, 14, 9, { regular: false });
    deps.tg.failWebhookInfo(new TelegramError(502));
    await say(deps, "/stato");
    deps.tg.failWebhookInfo(new Error("Connection timed out: Marco Rossi"));
    await say(deps, "/stato");
    await say(deps, "/statistiche");
    const events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(events).toContainEqual({ code: "gap_alert", sent: false, error_code: 429 });
    expect(events).toContainEqual({ code: "auto_backup", sent: false, error_code: 0 });
    expect(events).toContainEqual({ code: "webhook_info_error", error_code: 502 });
    expect(events).toContainEqual({ code: "webhook_info_error", error_code: 0 });
    for (const e of events) for (const v of Object.values(e)) expect(["string", "number", "boolean"]).toContain(typeof v);
    for (const l of lines) {
      for (const s of [...SECRETS, "timed out", "guasto", "2027-03-01T05", "in_invio", "riuscito"]) expect(l).not.toContain(s);
    }
  });
});
