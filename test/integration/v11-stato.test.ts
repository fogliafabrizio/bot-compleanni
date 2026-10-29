import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMonthlyBackup } from "../../src/cron/backup-mensile";
import { claimAutoBackup } from "../../src/db/settings";
import { TelegramError } from "../../src/telegram/client";
import { STRANGER_ID } from "../helpers/constants";
import { localInstant, runAt } from "../helpers/cron";
import { count, insertDelivery, insertOccurrence, insertPerson } from "../helpers/db";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { say, send } from "../helpers/send";
import { textUpdate } from "../helpers/updates";

// Adesso: giovedì 29/10/2026 alle 15:20 a Roma (14:20Z). Finestra: 23/10…29/10.
const NOW = new Date("2026-10-29T14:20:00.000Z");
const TODAY = "2026-10-29";

type Status = "in_invio" | "inviato" | "fallito" | "abbandonato";

let seq = 0;

// Un invio con la sua persona e occorrenza (una persona per invio: nessun conflitto di unicità).
async function delivery(d: {
  status: Status;
  localDate?: string;
  name?: string;
  nickname?: string | null;
  kind?: "pre" | "giorno" | "recupero";
  ref?: number;
  sentAt?: string | null;
}): Promise<number> {
  seq++;
  const localDate = d.localDate ?? TODAY;
  const [, m, day] = localDate.split("-").map(Number) as [number, number, number];
  const personId = await insertPerson({ fullName: d.name ?? `Persona ${seq}`, nickname: d.nickname ?? null, day, month: m });
  const occ = await insertOccurrence({ personId, year: 2026, effectiveDate: localDate });
  await insertDelivery({
    occurrenceId: occ,
    kind: d.kind ?? "giorno",
    ref: d.ref ?? 9,
    status: d.status,
    localDate,
    sentAt: d.sentAt ?? (d.status === "inviato" ? `${localDate}T08:00:00.000Z` : null),
  });
  return personId;
}

async function setting(key: string, value: string): Promise<void> {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").bind(key, value, NOW.toISOString()).run();
}

async function stato(deps: TestCronDeps, now = NOW): Promise<string[]> {
  deps.setNow(now);
  deps.tg.reset();
  await say(deps, "/stato");
  const msgs = deps.tg.messages();
  expect(msgs).toHaveLength(1);
  return msgs[0]!.text.split("\n");
}

const lineOf = (lines: string[], prefix: string) => lines.find((l) => l.startsWith(prefix));

function captureLogs(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  return lines;
}

describe("RF-31: /stato", () => {
  afterEach(() => vi.restoreAllMocks());

  it("RF-31, US1-1: cron regolare e 3 reminder oggi → ora corrente e 3 inviati", async () => {
    for (let i = 1; i <= 3; i++) {
      await insertPerson({ id: i, fullName: `Persona ${i}`, day: 29, month: 10, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    }
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 9);
    await runAt(deps, 2026, 10, 29, 15);
    expect(await stato(deps)).toEqual([
      "🩺 Stato del bot",
      "⏱ Ultimo controllo orario: oggi alle 15:00",
      "📨 Oggi: 3 inviati, 0 falliti, 0 abbandonati",
      "📨 Ultimi 7 giorni: 3 inviati, 0 falliti, 0 abbandonati",
      "💾 Ultimo backup mensile: mai registrato",
      "🔗 Webhook: nessun errore, 0 update in coda",
    ]);
  });

  it("RF-31, US1-2, N-03: reminder di ieri abbandonato → riga dei 7 giorni con il nome", async () => {
    await delivery({ status: "abbandonato", localDate: "2026-10-28", name: "Luca Bianchi", nickname: "Luca", kind: "giorno", ref: 18 });
    const lines = await stato(makeCronDeps());
    expect(lines.slice(2, 5)).toEqual([
      "📨 Oggi: 0 inviati, 0 falliti, 0 abbandonati",
      "📨 Ultimi 7 giorni: 0 inviati, 0 falliti, 1 abbandonato",
      "   – Luca, reminder delle 18:00 del 28/10",
    ]);
  });

  it("RF-31, US1-3, FR-011: nessuna esecuzione del cron → mai registrato", async () => {
    expect(lineOf(await stato(makeCronDeps()), "⏱")).toBe("⏱ Ultimo controllo orario: mai registrato");
  });

  it("RF-31, US1-4, FR-011: nessun backup mensile → mai registrato", async () => {
    await setting("auto_backup", "2026-09:inviato");
    expect(lineOf(await stato(makeCronDeps()), "💾")).toBe("💾 Ultimo backup mensile: mai registrato");
  });

  it("RF-31, US1-5, FR-008: ultimo backup mensile fallito per TelegramError → data, ora e ❌", async () => {
    const deps = makeCronDeps();
    const at = localInstant(2026, 10, 1, 9);
    deps.setNow(at);
    deps.tg.failNextOn("sendDocument", 502);
    await runMonthlyBackup(deps, at);
    expect(lineOf(await stato(deps), "💾")).toBe("💾 Ultimo backup mensile: 01/10 alle 9:00 ❌ non riuscito");
  });

  it("RF-31, US1-6: webhook con errore e 2 update in coda", async () => {
    const deps = makeCronDeps();
    deps.tg.setWebhookInfo({ pendingUpdateCount: 2, lastErrorDate: new Date("2026-10-29T14:00:00Z"), lastErrorMessage: "Connection timed out" });
    expect(lineOf(await stato(deps), "🔗")).toBe('🔗 Webhook: ultimo errore 29/10 alle 15:00: "Connection timed out", 2 update in coda');
  });

  it.each([
    ["TelegramError", new TelegramError(502), 502],
    ["errore di rete", new Error("rete giù"), 0],
  ])("RF-31, US1-7, FR-012: getWebhookInfo in errore (%s) → solo la riga del webhook non disponibile", async (_l, err, code) => {
    const logs = captureLogs();
    await setting("cron_last_run", "2026-10-29T14:00:00.000Z");
    await delivery({ status: "inviato" });
    const deps = makeCronDeps();
    deps.tg.failWebhookInfo(err);
    expect(await stato(deps)).toEqual([
      "🩺 Stato del bot",
      "⏱ Ultimo controllo orario: oggi alle 15:00",
      "📨 Oggi: 1 inviato, 0 falliti, 0 abbandonati",
      "📨 Ultimi 7 giorni: 1 inviato, 0 falliti, 0 abbandonati",
      "💾 Ultimo backup mensile: mai registrato",
      "🔗 Webhook: non disponibile",
    ]);
    const events = logs.map((l) => JSON.parse(l) as { code: string }).filter((l) => l.code === "webhook_info_error");
    expect(events).toEqual([{ code: "webhook_info_error", error_code: code }]);
    for (const l of logs) expect(l).not.toContain("rete giù");
  });

  it("RF-31: controllo orario di un altro giorno → data e ora", async () => {
    await setting("cron_last_run", "2026-10-28T22:00:00.000Z");
    expect(lineOf(await stato(makeCronDeps()), "⏱")).toBe("⏱ Ultimo controllo orario: 28/10 alle 23:00");
  });

  it("FR-010, R-04: in_invio dell'ora corrente non contato; in_invio di un'ora precedente e con sent_at NULL abbandonati", async () => {
    await delivery({ status: "in_invio", sentAt: "2026-10-29T14:05:00.000Z", name: "Corrente" });
    await delivery({ status: "in_invio", sentAt: "2026-10-29T13:30:00.000Z", name: "Ora Prima" });
    await delivery({ status: "in_invio", sentAt: null, name: "Prima Del Deploy", localDate: "2026-10-27" });
    const lines = await stato(makeCronDeps());
    expect(lineOf(lines, "📨 Oggi")).toBe("📨 Oggi: 0 inviati, 0 falliti, 1 abbandonato");
    expect(lineOf(lines, "📨 Ultimi")).toBe("📨 Ultimi 7 giorni: 0 inviati, 0 falliti, 2 abbandonati");
    expect(lines.filter((l) => l.startsWith("   –"))).toEqual([
      "   – Prima Del Deploy, reminder delle 9:00 del 27/10",
      "   – Ora Prima, reminder delle 9:00 del 29/10",
    ]);
  });

  it("FR-010, R-04: cron fermo dopo un'esecuzione interrotta alle 14:00 → a /stato delle 17:00 l'in_invio è abbandonato", async () => {
    await setting("cron_last_run", "2026-10-29T13:00:00.000Z");
    await delivery({ status: "in_invio", sentAt: "2026-10-29T13:00:05.000Z" });
    const lines = await stato(makeCronDeps(), localInstant(2026, 10, 29, 17));
    expect(lineOf(lines, "📨 Oggi")).toBe("📨 Oggi: 0 inviati, 0 falliti, 1 abbandonato");
  });

  it("FR-010, N-03: fallito di ieri tra gli abbandonati, fallito di oggi tra i falliti", async () => {
    await delivery({ status: "fallito", localDate: "2026-10-28", name: "Ieri" });
    await delivery({ status: "fallito", name: "Oggi" });
    const lines = await stato(makeCronDeps());
    expect(lineOf(lines, "📨 Oggi")).toBe("📨 Oggi: 0 inviati, 1 fallito, 0 abbandonati");
    expect(lineOf(lines, "📨 Ultimi")).toBe("📨 Ultimi 7 giorni: 0 inviati, 1 fallito, 1 abbandonato");
    expect(lines.filter((l) => l.startsWith("   –"))).toEqual(["   – Ieri, reminder delle 9:00 del 28/10"]);
  });

  it("FR-010: invii di 7 giorni fa esclusi, di 6 giorni fa inclusi", async () => {
    await delivery({ status: "inviato", localDate: "2026-10-22" });
    await delivery({ status: "abbandonato", localDate: "2026-10-22", name: "Fuori" });
    await delivery({ status: "inviato", localDate: "2026-10-23" });
    await delivery({ status: "abbandonato", localDate: "2026-10-23", name: "Dentro" });
    const lines = await stato(makeCronDeps());
    expect(lineOf(lines, "📨 Ultimi")).toBe("📨 Ultimi 7 giorni: 1 inviato, 0 falliti, 1 abbandonato");
    expect(lines.filter((l) => l.startsWith("   –"))).toEqual(["   – Dentro, reminder delle 9:00 del 23/10"]);
  });

  it("FR-009: dettaglio con i tre tipi di promemoria, nickname o nome completo", async () => {
    await delivery({ status: "abbandonato", localDate: "2026-10-24", name: "Anna Rossi", nickname: "Annina", kind: "pre", ref: 7 });
    await delivery({ status: "abbandonato", localDate: "2026-10-25", name: "Bruno Verdi", kind: "giorno", ref: 18 });
    await delivery({ status: "abbandonato", localDate: "2026-10-26", name: "Carla Neri", kind: "recupero", ref: 0 });
    const lines = await stato(makeCronDeps());
    expect(lines.filter((l) => l.startsWith("   –"))).toEqual([
      "   – Annina, pre-reminder a 7 giorni del 24/10",
      "   – Bruno Verdi, reminder delle 18:00 del 25/10",
      "   – Carla Neri, recupero del 26/10",
    ]);
  });

  it("FR-010: persona eliminata → i suoi invii spariscono dai conteggi", async () => {
    const id = await delivery({ status: "abbandonato", localDate: "2026-10-28", name: "Eliminata" });
    await delivery({ status: "inviato" });
    await env.DB.prepare("DELETE FROM persons WHERE id = ?").bind(id).run();
    const lines = await stato(makeCronDeps());
    expect(lineOf(lines, "📨 Ultimi")).toBe("📨 Ultimi 7 giorni: 1 inviato, 0 falliti, 0 abbandonati");
    expect(lines.some((l) => l.includes("Eliminata"))).toBe(false);
  });

  it("FR-010: /oggi, /backup e l'avviso di buco non sono contati tra gli invii", async () => {
    await insertPerson({ fullName: "Festeggiato", day: 29, month: 10 });
    await setting("cron_last_run", "2026-10-29T05:00:00.000Z");
    const deps = makeCronDeps();
    await runAt(deps, 2026, 10, 29, 15, { regular: false });
    deps.setNow(NOW);
    await say(deps, "/oggi");
    await say(deps, "/backup");
    const lines = await stato(deps);
    expect(deps.tg.calls.some((c) => c.method === "getWebhookInfo")).toBe(true);
    expect(lineOf(lines, "📨 Oggi")).toBe("📨 Oggi: 0 inviati, 0 falliti, 0 abbandonati");
    expect(lineOf(lines, "📨 Ultimi")).toBe("📨 Ultimi 7 giorni: 0 inviati, 0 falliti, 0 abbandonati");
  });

  it("FR-008: backup ❌ alle 9:00 e ✅ alle 10:00 → /stato mostra l'ultimo tentativo", async () => {
    const deps = makeCronDeps();
    deps.tg.failNextOn("sendDocument", 502);
    for (const h of [9, 10]) {
      const at = localInstant(2026, 10, 1, h);
      deps.setNow(at);
      await runMonthlyBackup(deps, at);
    }
    expect(lineOf(await stato(deps), "💾")).toBe("💾 Ultimo backup mensile: 01/10 alle 10:00 ✅");
  });

  it("FR-008: backup reclamato senza esito → ⚠️ esito sconosciuto", async () => {
    await claimAutoBackup(env.DB, "2026-10", localInstant(2026, 10, 1, 9).toISOString());
    expect(lineOf(await stato(makeCronDeps()), "💾")).toBe("💾 Ultimo backup mensile: 01/10 alle 9:00 ⚠️ esito sconosciuto");
  });

  it("FR-008: errore non Telegram del backup mensile → ❌; /backup su richiesta non cambia la riga", async () => {
    const deps = makeCronDeps();
    deps.tg.sendDocument = async () => {
      throw new Error("guasto interno");
    };
    const at = localInstant(2026, 10, 1, 9);
    deps.setNow(at);
    await runMonthlyBackup(deps, at);
    const before = lineOf(await stato(deps), "💾");
    expect(before).toBe("💾 Ultimo backup mensile: 01/10 alle 9:00 ❌ non riuscito");
    const ok = makeCronDeps();
    await say(ok, "/backup");
    expect(lineOf(await stato(ok), "💾")).toBe(before);
  });

  it("001 FR-018: /stato durante /nuovo interrompe il flusso", async () => {
    const deps = makeCronDeps();
    await say(deps, "/nuovo");
    expect(await count("conversation_state", "flow = 'nuovo'")).toBe(1);
    const lines = await stato(deps);
    expect(lines[0]).toBe("🩺 Stato del bot");
    expect(await count("conversation_state")).toBe(0);
  });

  it("001 FR-027: /stato da un estraneo → nessuna chiamata a Telegram", async () => {
    const deps = makeCronDeps();
    await send(deps, textUpdate(STRANGER_ID, "/stato"));
    expect(deps.tg.calls).toEqual([]);
  });
});
