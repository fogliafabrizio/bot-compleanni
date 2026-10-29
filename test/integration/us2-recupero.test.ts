import { describe, expect, it } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { localDayStartUtc } from "../../src/time";
import { count, insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { localInstant, runAt, simulateRegularCron } from "../helpers/cron";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press } from "../helpers/send";
import { T } from "../../src/texts";

// D = 13/03/2027, D+1 = 14/03/2027.
const marco = { id: 1, fullName: "Marco Rossi", nickname: "Marchino", day: 13, month: 3, year: 1995, priority: "media" as const };

const status = async (personId = 1, year = 2027) =>
  (await rows<{ status: string; outcome_at: string | null }>(
    "SELECT status, outcome_at FROM occurrences WHERE person_id = ? AND year = ?",
    personId,
    year,
  ))[0];

const recoveries = (deps: TestCronDeps) => deps.tg.messages().filter((m) => m.text.startsWith("⏰"));

// Esegue tutte le ore UTC di una giornata locale.
async function runDay(deps: TestCronDeps, y: number, m: number, d: number): Promise<void> {
  const start = localDayStartUtc({ year: y, month: m, day: d }).getTime();
  const end = localDayStartUtc({ year: y, month: m, day: d + 1 }).getTime();
  for (let t = start; t < end; t += 3_600_000) {
    deps.setNow(new Date(t));
    await simulateRegularCron(new Date(t));
    await runHourly(deps, new Date(t));
  }
}

describe("US2: recupero ed esito finale", () => {
  it("RF-13, D-05: occorrenza aperta → un solo recupero alle 13 di D+1", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 12);
    expect(deps.tg.messages()).toHaveLength(0);
    await runAt(deps, 2027, 3, 14, 13);
    await runAt(deps, 2027, 3, 14, 13);
    await runAt(deps, 2027, 3, 14, 14);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toBe("⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?\n📱 +393331234567");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["WhatsApp", "Copia messaggio", "Fatto ✅", "Saltato"]);
  });

  it("RF-13: nessuna risposta → alle 0 di D+2 non confermato con outcome_at, nessun messaggio", async () => {
    await insertPerson(marco);
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    await runAt(deps, 2027, 3, 14, 23);
    expect((await status())?.status).toBe("aperta");
    deps.tg.reset();
    const r = await runAt(deps, 2027, 3, 15, 0);
    expect(r.closed).toBe(1);
    expect(await status()).toEqual({ status: "non_confermato", outcome_at: localInstant(2027, 3, 15, 0).toISOString() });
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("RF-13: chiusura mancata alle 0 → applicata all'esecuzione successiva", async () => {
    await insertPerson(marco);
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 15, 3);
    expect((await status())?.status).toBe("non_confermato");
  });

  it("§7: Fatto sul recupero → fatto", async () => {
    await insertPerson(marco);
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fatto ✅"), 100);
    expect((await status())?.status).toBe("fatto");
    const [edit] = deps.tg.textEdits();
    expect(edit!.text.endsWith("\n\n✅ Fatto")).toBe(true);
    expect(labels(edit!.keyboard)).toEqual(["Copia messaggio"]);
  });

  it("§7, BR-08: Saltato sul recupero → saltato, il messaggio mantiene Fatto ✅ per la correzione", async () => {
    await insertPerson(marco);
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Saltato"), 100);
    expect((await status())?.status).toBe("saltato");
    const edit = deps.tg.textEdits()[0]!;
    expect(edit.text.endsWith("\n\nSaltato")).toBe(true);
    expect(labels(edit.keyboard)).toEqual(["Copia messaggio", "Fatto ✅"]);
    // Correzione dallo stesso pulsante.
    await press(deps, cbOf(edit.keyboard, "Fatto ✅"), 100);
    expect((await status())?.status).toBe("fatto");
  });

  it.each(["saltato", "non_confermato"] as const)(
    "BR-08, A-05: %s con data effettiva a 7 giorni → Fatto sul recupero corregge; a 8 giorni no",
    async (closed) => {
      await insertPerson(marco);
      const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13", status: closed });
      const rec = await insertDelivery({ occurrenceId: occ, kind: "recupero", ref: 13, status: "inviato", localDate: "2027-03-14" });
      const deps = makeCronDeps();
      deps.setNow(localInstant(2027, 3, 21, 22)); // 8 giorni dopo D, sera
      await press(deps, `o:f:${rec}`, 100);
      expect((await status())?.status).toBe(closed);
      expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
      deps.setNow(localInstant(2027, 3, 20, 23)); // D+7, ultima ora
      await press(deps, `o:f:${rec}`, 100);
      expect((await status())?.status).toBe("fatto");
    },
  );

  it("BR-08, FR-015: occorrenza fatto → Saltato sul recupero non cambia nulla", async () => {
    await insertPerson(marco);
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13", status: "fatto" });
    const rec = await insertDelivery({ occurrenceId: occ, kind: "recupero", ref: 13, status: "inviato", localDate: "2027-03-14" });
    const deps = makeCronDeps({ now: localInstant(2027, 3, 14, 15) });
    await press(deps, `o:s:${rec}`, 100);
    expect((await status())?.status).toBe("fatto");
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(deps.tg.textEdits()).toHaveLength(0);
  });

  it("FR-016: Fatto su un reminder di un'occorrenza saltato → nessuna correzione", async () => {
    await insertPerson(marco);
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-13", status: "saltato" });
    const giorno = await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "inviato", localDate: "2027-03-13" });
    const deps = makeCronDeps({ now: localInstant(2027, 3, 14, 15) });
    await press(deps, `o:f:${giorno}`, 100);
    expect((await status())?.status).toBe("saltato");
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
  });

  it("BR-11: persona inserita il giorno D dopo l'ultimo slot del profilo → nessun recupero", async () => {
    // Media: ultimo slot alle 18; inserita alle 19 del 13/03.
    await insertPerson({ ...marco, createdAt: localInstant(2027, 3, 13, 19).toISOString() });
    const deps = makeCronDeps();
    for (const h of [19, 20, 21, 22, 23]) await runAt(deps, 2027, 3, 13, h);
    await runDay(deps, 2027, 3, 14);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("occurrences")).toBe(0);
  });

  it("BR-11: persona inserita durante D con un reminder partito → recupero", async () => {
    await insertPerson({ ...marco, createdAt: localInstant(2027, 3, 13, 10).toISOString() });
    const deps = makeCronDeps();
    for (const h of [13, 18]) await runAt(deps, 2027, 3, 13, h);
    await runAt(deps, 2027, 3, 14, 13);
    expect(recoveries(deps)).toHaveLength(1);
  });

  it("BR-11, N-04: persona inserita prima di D, nessuna esecuzione nel giorno D → recupero e occorrenza creata", async () => {
    await insertPerson({ ...marco, priority: "bassa" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    expect(recoveries(deps)).toHaveLength(1);
    expect((await status())?.status).toBe("aperta");
  });

  it("BR-11, N-04: persona inserita prima di D, tutti i reminder di D falliti → recupero", async () => {
    await insertPerson({ ...marco, priority: "bassa" });
    const deps = makeCronDeps();
    deps.tg.failWhen((t) => t.startsWith("🎂"), 500);
    await runDay(deps, 2027, 3, 13);
    await runAt(deps, 2027, 3, 14, 0);
    await runAt(deps, 2027, 3, 14, 13);
    expect(recoveries(deps)).toHaveLength(1);
  });

  it("SC-004: occorrenza chiusa con Fatto il giorno D → nessun recupero", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 13, 9);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fatto ✅"), 100);
    deps.tg.reset();
    await runDay(deps, 2027, 3, 14);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it.each([
    ["alta", 3, 4],
    ["media", 1, 3],
    ["bassa", 0, 2],
  ] as const)("SC-003: priorità %s senza risposta → %i pre-reminder, %i reminder, 1 recupero", async (priority, pre, giorno) => {
    await insertPerson({ ...marco, day: 14, priority });
    const deps = makeCronDeps();
    for (let d = 5; d <= 16; d++) await runDay(deps, 2027, 3, d);
    const texts = deps.tg.messages().map((m) => m.text);
    expect(texts.filter((t) => t.startsWith("📅"))).toHaveLength(pre);
    expect(texts.filter((t) => t.startsWith("🎂"))).toHaveLength(giorno);
    expect(texts.filter((t) => t.startsWith("⏰"))).toHaveLength(1);
    expect((await status())?.status).toBe("non_confermato");
  });
});
