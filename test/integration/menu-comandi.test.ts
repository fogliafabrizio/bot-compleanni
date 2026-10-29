import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nameHash } from "../../src/domain/text";
import { BOT_COMMANDS } from "../../src/texts";
import { runScheduledAt } from "../helpers/cron";
import { count, insertPerson } from "../helpers/db";
import { makeCronDeps } from "../helpers/deps";

// Menu dei comandi sincronizzato dal cron (FR-014, research R-10). Il passo si salta quando il
// ciclo ha reclamato invii o il backup mensile ha inviato (principio II).

const MENU_HASH = nameHash(JSON.stringify(BOT_COMMANDS));

// Backup di ottobre già inviato: alle ore successive il backup mensile non fa nulla.
async function backupDone(): Promise<void> {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2026-10:inviato', '2026-10-01T07:00:00.000Z')").run();
}

async function savedHash(): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'bot_commands'").first<{ value: string }>();
  return row?.value ?? null;
}

describe("RF-19, FR-014: menu dei comandi", () => {
  let lines: string[] = [];
  beforeEach(() => {
    lines = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("RF-19, FR-014: BOT_COMMANDS ha /gruppi con la nuova descrizione e nessuna voce /gruppo", () => {
    expect(BOT_COMMANDS.find((c) => c.command === "gruppi")?.description).toBe("Elenco gruppi; con un nome cerca e apre la scheda");
    expect(BOT_COMMANDS.some((c) => c.command === "gruppo")).toBe(false);
    for (const c of BOT_COMMANDS) {
      expect(c.command).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.description.length).toBeLessThanOrEqual(256);
    }
  });

  it("FR-014: primo cron senza invii → setMyCommands e hash salvato; secondo cron → nulla", async () => {
    await backupDone();
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2026, 10, 28, 11);
    expect(deps.tg.commandsSet()).toEqual([{ method: "setMyCommands", commands: [...BOT_COMMANDS] }]);
    expect(await savedHash()).toBe(MENU_HASH);
    deps.tg.reset();
    await runScheduledAt(deps, 2026, 10, 28, 12);
    expect(deps.tg.commandsSet()).toHaveLength(0);
  });

  it("principio II: cron con almeno un invio reclamato → passo saltato", async () => {
    await backupDone();
    await insertPerson({ fullName: "Anna", day: 29, month: 10 });
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2026, 10, 29, 9);
    expect(deps.tg.messages().length).toBeGreaterThan(0);
    expect(deps.tg.commandsSet()).toHaveLength(0);
    expect(await savedHash()).toBeNull();
  });

  it("principio II: cron con il backup mensile inviato → passo saltato", async () => {
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2026, 11, 1, 9);
    expect(deps.tg.documents()).toHaveLength(1);
    expect(deps.tg.commandsSet()).toHaveLength(0);
  });

  it("FR-014: menu cambiato e invii a ogni ora per tre esecuzioni → aggiornato alla prima esecuzione senza invii", async () => {
    await backupDone();
    await insertPerson({ fullName: "Anna", day: 29, month: 10, priority: "alta" });
    const deps = makeCronDeps();
    for (const hour of [9, 13, 18]) {
      deps.tg.reset();
      await runScheduledAt(deps, 2026, 10, 29, hour);
      expect(deps.tg.messages().length).toBeGreaterThan(0);
      expect(deps.tg.commandsSet()).toHaveLength(0);
    }
    deps.tg.reset();
    await runScheduledAt(deps, 2026, 10, 29, 19);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(deps.tg.commandsSet()).toHaveLength(1);
    expect(await savedHash()).toBe(MENU_HASH);
  });

  it("principio VII, RNF-12: setMyCommands che fallisce → promemoria e backup intatti, hash non salvato, log con solo error_code", async () => {
    await backupDone();
    const deps = makeCronDeps();
    deps.tg.failNextOn("setMyCommands", 500);
    await runScheduledAt(deps, 2026, 10, 28, 11);
    expect(await savedHash()).toBeNull();
    expect(await count("settings", "key = 'auto_backup' AND value = '2026-10:inviato'")).toBe(1);
    const errors = lines.map((l) => JSON.parse(l) as Record<string, unknown>).filter((l) => l.code === "bot_commands_error");
    expect(errors).toEqual([{ code: "bot_commands_error", error_code: 500 }]);
    // L'esecuzione successiva ritenta.
    await runScheduledAt(deps, 2026, 10, 28, 12);
    expect(deps.tg.commandsSet()).toHaveLength(1);
    expect(await savedHash()).toBe(MENU_HASH);
  });

  it("§5.1, FR-016: menu con statistiche e stato dopo anno", () => {
    const names = BOT_COMMANDS.map((c) => c.command);
    const i = names.indexOf("anno");
    expect(BOT_COMMANDS.slice(i + 1, i + 3)).toEqual([
      { command: "statistiche", description: "Statistiche della rubrica e andamento" },
      { command: "stato", description: "Salute di cron, invii, backup e webhook" },
    ]);
  });

  it("§5.1, FR-016, 005 FR-014: hash del menu di 005 salvato → un ciclo senza invii registra il menu nuovo", async () => {
    await backupDone();
    const old = BOT_COMMANDS.filter((c) => c.command !== "statistiche" && c.command !== "stato");
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('bot_commands', ?, '2026-10-01T00:00:00.000Z')")
      .bind(nameHash(JSON.stringify(old)))
      .run();
    const deps = makeCronDeps();
    await runScheduledAt(deps, 2026, 10, 28, 11);
    expect(deps.tg.commandsSet()).toEqual([{ method: "setMyCommands", commands: [...BOT_COMMANDS] }]);
    expect(await savedHash()).toBe(MENU_HASH);
  });
});
