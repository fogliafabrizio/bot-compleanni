import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMonthlyBackup } from "../../src/cron/backup-mensile";
import { claimAutoBackup } from "../../src/db/settings";
import { T } from "../../src/texts";
import { OWNER_ID } from "../helpers/constants";
import { localInstant, runScheduledAt } from "../helpers/cron";
import { count, insertPerson, rows } from "../helpers/db";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

async function autoBackup(): Promise<string | undefined> {
  return (await rows<{ value: string }>("SELECT value FROM settings WHERE key = 'auto_backup'"))[0]?.value;
}

async function setAutoBackup(value: string): Promise<void> {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', ?, '2026-01-01T00:00:00.000Z')")
    .bind(value)
    .run();
}

// Backup mensile all'ora locale indicata, con now = scheduledTime.
async function monthlyAt(deps: TestCronDeps, y: number, m: number, d: number, h: number) {
  const at = localInstant(y, m, d, h);
  deps.setNow(at);
  return runMonthlyBackup(deps, at);
}

describe("US3: backup automatico mensile (RF-27, contracts/backup-mensile.md)", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["ora solare", Date.UTC(2026, 11, 1, 8), "2026-12", "compleanni-backup-2026-12-01.json"],
    ["ora legale", Date.UTC(2027, 3, 1, 7), "2027-04", "compleanni-backup-2027-04-01.json"],
  ])("RF-27, FR-022: 1° del mese alle 9:00 locali (%s) → un sendDocument al proprietario e AAAA-MM:inviato", async (_l, utc, month, name) => {
    await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeCronDeps({ now: new Date(utc) });
    expect(await runMonthlyBackup(deps, new Date(utc))).toEqual({ sent: true });
    const docs = deps.tg.documents();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ chatId: OWNER_ID, name, mimeType: "application/json" });
    expect(docs[0]!.caption).toBe("Backup: 1 persone, 0 gruppi, 0 occorrenze. Per ripristinarlo usa /ripristina.");
    expect(await autoBackup()).toBe(`${month}:inviato`);
  });

  it("FR-022: 1° del mese alle 8:00 → nessuna query né invio", async () => {
    const deps = makeCronDeps();
    expect(await monthlyAt(deps, 2026, 12, 1, 8)).toBeNull();
    expect(deps.counter.count).toBe(0);
    expect(deps.tg.calls).toEqual([]);
  });

  it("FR-023: esecuzione delle 9:00 ripetuta e 1° alle 10:00 dopo l'invio → nessun altro invio", async () => {
    const deps = makeCronDeps();
    await monthlyAt(deps, 2026, 12, 1, 9);
    expect(await monthlyAt(deps, 2026, 12, 1, 9)).toBeNull();
    expect(await monthlyAt(deps, 2026, 12, 1, 10)).toBeNull();
    expect(await monthlyAt(deps, 2026, 12, 20, 15)).toBeNull();
    expect(deps.tg.documents()).toHaveLength(1);
  });

  it("FR-023a: sendDocument in errore il 1° alle 9:00 → fallito; ok il 2 alle 14:00 → un invio", async () => {
    const deps = makeCronDeps();
    deps.tg.failNextOn("sendDocument", 502);
    expect(await monthlyAt(deps, 2026, 12, 1, 9)).toEqual({ sent: false });
    expect(await autoBackup()).toBe("2026-12:fallito");
    expect(await monthlyAt(deps, 2026, 12, 2, 14)).toEqual({ sent: true });
    expect(await monthlyAt(deps, 2026, 12, 2, 15)).toBeNull();
    expect(deps.tg.documents()).toHaveLength(1);
    expect(deps.tg.documents()[0]!.name).toBe("compleanni-backup-2026-12-02.json");
    expect(await autoBackup()).toBe("2026-12:inviato");
  });

  it("FR-023: valore AAAA-MM:in_invio preesistente → nessun invio", async () => {
    await setAutoBackup("2026-12:in_invio");
    const deps = makeCronDeps();
    expect(await monthlyAt(deps, 2026, 12, 3, 10)).toBeNull();
    expect(deps.tg.documents()).toEqual([]);
  });

  it("R-11: prima installazione a metà mese → invio alla prima esecuzione oraria", async () => {
    const deps = makeCronDeps();
    expect(await monthlyAt(deps, 2026, 10, 15, 11)).toEqual({ sent: true });
    expect(await autoBackup()).toBe("2026-10:inviato");
  });

  it("FR-023a: mese nuovo con il precedente inviato → invio; 0 persone → file inviato", async () => {
    await setAutoBackup("2026-11:inviato");
    const deps = makeCronDeps();
    expect(await monthlyAt(deps, 2026, 12, 1, 9)).toEqual({ sent: true });
    expect(deps.tg.documents()[0]!.caption).toBe("Backup: 0 persone, 0 gruppi, 0 occorrenze. Per ripristinarlo usa /ripristina.");
    expect(await autoBackup()).toBe("2026-12:inviato");
  });

  it("RNF-11, FR-025: il file mensile usato con /ripristina → ripristino riuscito", async () => {
    await insertPerson({ id: 7, fullName: "Marco Rossi", day: 14, month: 3, year: 1985 });
    const deps = makeCronDeps();
    await monthlyAt(deps, 2026, 12, 1, 9);
    const file = deps.tg.documents()[0]!.text;
    await env.DB.prepare("DELETE FROM persons").run();
    await say(deps, "/ripristina");
    await sendFile(deps, "compleanni-backup-2026-12-01.json", file);
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnContinue));
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnRestore));
    expect(deps.tg.lastText()).toContain("Ripristino completato: 1 persone, 0 gruppi, 0 occorrenze.");
    expect(await rows("SELECT id, full_name FROM persons")).toEqual([{ id: 7, full_name: "Marco Rossi" }]);
    expect(await autoBackup()).toBe("2026-12:inviato");
  });

  it("RNF-12: un errore dei promemoria non impedisce il backup e viceversa", async () => {
    await insertPerson({ fullName: "Compleanno Oggi", day: 1, month: 12, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    const deps = makeCronDeps();
    deps.tg.failNext(500);
    await runScheduledAt(deps, 2026, 12, 1, 9);
    expect(deps.tg.messages()).toEqual([]);
    expect(deps.tg.documents()).toHaveLength(1);

    await env.DB.prepare("DELETE FROM settings").run();
    await env.DB.prepare("DELETE FROM deliveries").run();
    const other = makeCronDeps();
    other.tg.failNextOn("sendDocument", 500);
    await runScheduledAt(other, 2026, 12, 1, 9);
    expect(other.tg.messages()).toHaveLength(1);
    expect(other.tg.documents()).toEqual([]);
    expect(await autoBackup()).toBe("2026-12:fallito");
    expect(await count("deliveries", "status = 'inviato'")).toBe(1);
  });

  it("principio V: log auto_backup con soli sent ed error_code", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeCronDeps();
    await monthlyAt(deps, 2026, 11, 1, 9);
    deps.tg.failNextOn("sendDocument", 429);
    await monthlyAt(deps, 2026, 12, 1, 9);
    const logs = lines.filter((l) => l.includes("auto_backup")).map((l) => JSON.parse(l) as unknown);
    expect(logs).toEqual([
      { code: "auto_backup", sent: true },
      { code: "auto_backup", sent: false, error_code: 429 },
    ]);
    for (const l of lines) expect(l).not.toContain("Marco");
  });
});

describe("RF-31, FR-008: esito del backup mensile", () => {
  afterEach(() => vi.restoreAllMocks());

  async function lastAttempt(): Promise<unknown> {
    const v = (await rows<{ value: string }>("SELECT value FROM settings WHERE key = 'auto_backup_last'"))[0]?.value;
    return v === undefined ? undefined : JSON.parse(v);
  }

  it("FR-008: successo → AAAA-MM:inviato e auto_backup_last con l'istante del reclamo ed esito riuscito", async () => {
    const deps = makeCronDeps();
    const at = localInstant(2026, 12, 1, 9);
    const original = deps.tg.sendDocument.bind(deps.tg);
    deps.tg.sendDocument = async (...args: Parameters<typeof original>) => {
      deps.setNow(new Date(at.getTime() + 3_000));
      return original(...args);
    };
    deps.setNow(at);
    expect(await runMonthlyBackup(deps, at)).toEqual({ sent: true });
    expect(await autoBackup()).toBe("2026-12:inviato");
    expect(await lastAttempt()).toEqual({ at: at.toISOString(), esito: "riuscito" });
  });

  it("FR-008, 004 FR-023a: TelegramError → fallito e non_riuscito; ritentato all'ora dopo con un at nuovo", async () => {
    const deps = makeCronDeps();
    deps.tg.failNextOn("sendDocument", 502);
    expect(await monthlyAt(deps, 2026, 12, 1, 9)).toEqual({ sent: false });
    expect(await autoBackup()).toBe("2026-12:fallito");
    expect(await lastAttempt()).toEqual({ at: localInstant(2026, 12, 1, 9).toISOString(), esito: "non_riuscito" });
    expect(await monthlyAt(deps, 2026, 12, 1, 10)).toEqual({ sent: true });
    expect(await lastAttempt()).toEqual({ at: localInstant(2026, 12, 1, 10).toISOString(), esito: "riuscito" });
  });

  it("FR-008: errore non Telegram → errore e non_riuscito, eccezione non propagata, log error_code 0, nessun nuovo tentativo nel mese", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    const deps = makeCronDeps();
    deps.tg.sendDocument = async () => {
      throw new Error("guasto interno");
    };
    expect(await monthlyAt(deps, 2026, 12, 1, 9)).toEqual({ sent: false });
    expect(await autoBackup()).toBe("2026-12:errore");
    expect(await lastAttempt()).toEqual({ at: localInstant(2026, 12, 1, 9).toISOString(), esito: "non_riuscito" });
    expect(lines.map((l) => JSON.parse(l) as unknown)).toEqual([{ code: "auto_backup", sent: false, error_code: 0 }]);
    expect(await monthlyAt(deps, 2026, 12, 1, 10)).toBeNull();
    expect(await monthlyAt(deps, 2026, 12, 15, 18)).toBeNull();
    expect(await autoBackup()).toBe("2026-12:errore");
  });

  it("FR-008: solo il reclamo, senza esito (interruzione) → esito in_invio", async () => {
    const nowIso = localInstant(2026, 12, 1, 9).toISOString();
    expect(await claimAutoBackup(env.DB, "2026-12", nowIso)).toEqual({ attemptIso: nowIso });
    expect(await autoBackup()).toBe("2026-12:in_invio");
    expect(await lastAttempt()).toEqual({ at: nowIso, esito: "in_invio" });
  });

  it("FR-008: reclamo a vuoto (mese già inviato) → auto_backup_last invariato", async () => {
    await setAutoBackup("2026-12:inviato");
    expect(await claimAutoBackup(env.DB, "2026-12", localInstant(2026, 12, 2, 9).toISOString())).toBeNull();
    expect(await lastAttempt()).toBeUndefined();
  });

  it("FR-008: /backup su richiesta non crea né modifica auto_backup_last", async () => {
    const deps = makeCronDeps();
    await say(deps, "/backup");
    expect(deps.tg.documents()).toHaveLength(1);
    expect(await lastAttempt()).toBeUndefined();
    await monthlyAt(deps, 2026, 12, 1, 9);
    const after = await lastAttempt();
    await say(deps, "/backup");
    expect(await lastAttempt()).toEqual(after);
  });

  it("FR-020: auto_backup = 2026-09:inviato e auto_backup_last assente → il primo tentativo di ottobre la crea", async () => {
    await setAutoBackup("2026-09:inviato");
    const deps = makeCronDeps();
    expect(await lastAttempt()).toBeUndefined();
    expect(await monthlyAt(deps, 2026, 10, 1, 9)).toEqual({ sent: true });
    expect(await lastAttempt()).toEqual({ at: localInstant(2026, 10, 1, 9).toISOString(), esito: "riuscito" });
  });
});
