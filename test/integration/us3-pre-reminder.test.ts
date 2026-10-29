import { describe, expect, it } from "vitest";
import { runHourly } from "../../src/cron/hourly";
import { localDayStartUtc } from "../../src/time";
import { insertOccurrence, insertPerson, rows } from "../helpers/db";
import { runAt, simulateRegularCron } from "../helpers/cron";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { buttons, cbOf } from "../helpers/fake-telegram";
import { press } from "../helpers/send";

const marco = { id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1995, priority: "alta" as const };

async function runDay(deps: TestCronDeps, y: number, m: number, d: number): Promise<void> {
  const start = localDayStartUtc({ year: y, month: m, day: d }).getTime();
  const end = localDayStartUtc({ year: y, month: m, day: d + 1 }).getTime();
  for (let t = start; t < end; t += 3_600_000) {
    deps.setNow(new Date(t));
    await simulateRegularCron(new Date(t));
    await runHourly(deps, new Date(t));
  }
}

describe("US3: pre-reminder", () => {
  it("RF-09, §7: Alta, compleanno 14/03 → alle 13 del 07/03 il pre −7", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 7, 12);
    expect(deps.tg.messages()).toHaveLength(0);
    await runAt(deps, 2027, 3, 7, 13);
    expect(deps.tg.lastText()).toBe("📅 Tra 7 giorni: compleanno di Marco Rossi (32 anni) — 14/03");
    expect(buttons(deps.tg.lastKeyboard())).toEqual([["Salta quest'anno", expect.stringMatching(/^o:s:\d+$/)]]);
  });

  it("RF-09, BR-07: Salta sul pre-reminder → saltato, messaggio senza pulsanti, nient'altro per l'anno", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 7, 13);
    const text = deps.tg.lastText()!;
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Salta quest'anno"), 100);
    const [occ] = await rows<{ status: string }>("SELECT status FROM occurrences WHERE person_id = 1 AND year = 2027");
    expect(occ?.status).toBe("saltato");
    expect(deps.tg.textEdits()[0]).toMatchObject({ text: `${text}\n\nSaltato quest'anno`, keyboard: { inline_keyboard: [] } });
    deps.tg.reset();
    for (let d = 8; d <= 16; d++) await runDay(deps, 2027, 3, d);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("§7: Bassa → nessun pre-reminder", async () => {
    await insertPerson({ ...marco, priority: "bassa" });
    const deps = makeCronDeps();
    for (let d = 5; d <= 13; d++) await runAt(deps, 2027, 3, d, 13);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("BR-05, BR-03: compleanno 02/01 Alta → alle 13 del 26/12 pre −7 con l'età e l'occorrenza dell'anno nuovo", async () => {
    await insertPerson({ ...marco, day: 2, month: 1 });
    const deps = makeCronDeps();
    await runAt(deps, 2026, 12, 26, 13);
    expect(deps.tg.lastText()).toBe("📅 Tra 7 giorni: compleanno di Marco Rossi (32 anni) — 02/01");
    expect(await rows("SELECT year, effective_date, status FROM occurrences")).toEqual([
      { year: 2027, effective_date: "2027-01-02", status: "aperta" },
    ]);
  });

  it("D-03: alle 13 reminder, pre-reminder e recupero arrivano come messaggi separati", async () => {
    await insertPerson({ ...marco, id: 1, fullName: "Oggi", day: 14 });
    await insertPerson({ ...marco, id: 2, fullName: "Domani", day: 15 });
    await insertPerson({ ...marco, id: 3, fullName: "Ieri", day: 13 });
    await insertOccurrence({ personId: 3, year: 2027, effectiveDate: "2027-03-13" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 13);
    expect(deps.tg.messages().map((m) => m.text.split("\n")[0])).toEqual([
      "🎂 Oggi è il compleanno di Oggi, compie 32 anni",
      "⏰ Ieri era il compleanno di Ieri. Hai fatto gli auguri?",
      "📅 Tra 1 giorno: compleanno di Domani (32 anni) — 15/03",
    ]);
  });

  it("SC-008, BR-04: nato il 29/02 — pre −1 il 27/02/2027, reminder il 28/02 con la nota; nel 2028 il 29/02", async () => {
    await insertPerson({ ...marco, day: 29, month: 2, year: 1996 });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 2, 27, 13);
    expect(deps.tg.lastText()).toBe("📅 Tra 1 giorno: compleanno di Marco Rossi (31 anni) — 29/02");
    await runAt(deps, 2027, 2, 28, 9);
    expect(deps.tg.lastText()).toBe("🎂 Oggi è il compleanno di Marco Rossi, compie 31 anni (compleanno il 29/02)");
    deps.tg.reset();
    await runDay(deps, 2028, 2, 28);
    expect(deps.tg.messages().filter((m) => m.text.startsWith("🎂"))).toHaveLength(0);
    await runAt(deps, 2028, 2, 29, 9);
    expect(deps.tg.lastText()).toBe("🎂 Oggi è il compleanno di Marco Rossi, compie 32 anni");
  });
});
