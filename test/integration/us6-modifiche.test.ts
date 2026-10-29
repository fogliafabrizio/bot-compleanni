import { describe, expect, it } from "vitest";
import { count, insertDelivery, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { localInstant, runAt } from "../helpers/cron";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

const tap = (deps: TestCronDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

const occurrences = () =>
  rows<{ year: number; effective_date: string; status: string }>("SELECT year, effective_date, status FROM occurrences ORDER BY year");

async function changeDate(deps: TestCronDeps, personId: number, date: string): Promise<void> {
  await press(deps, `p:m:${personId}`);
  await tap(deps, "Data");
  await say(deps, date);
  await tap(deps, "Sì");
}

// Ore (tra quelle indicate) in cui è partito almeno un reminder del giorno.
async function giornoHours(deps: TestCronDeps, y: number, m: number, d: number, hours: number[]): Promise<number[]> {
  const got: number[] = [];
  for (const h of hours) {
    const before = deps.tg.messages().filter((x) => x.text.startsWith("🎂")).length;
    await runAt(deps, y, m, d, h);
    if (deps.tg.messages().filter((x) => x.text.startsWith("🎂")).length > before) got.push(h);
  }
  return got;
}

describe("US6: modifiche a ridosso del compleanno", () => {
  it("BR-10, BR-11: persona Media inserita con /nuovo alle 10:30 del compleanno → 13 e 18, non le 9", async () => {
    const deps = makeCronDeps({ now: localInstant(2027, 3, 14, 10) });
    await runAt(deps, 2027, 3, 14, 9);
    deps.setNow(new Date(localInstant(2027, 3, 14, 10).getTime() + 30 * 60_000));
    await say(deps, "/nuovo");
    await say(deps, "Marco Rossi");
    await tap(deps, T.btnSkip);
    await say(deps, "14/03/1995");
    await tap(deps, "Sì");
    await tap(deps, T.btnSkip);
    await tap(deps, T.btnSkip);
    await tap(deps, T.btnSkip);
    await tap(deps, "Fine");
    await tap(deps, "Media ✓");
    await tap(deps, T.btnSkip);
    await tap(deps, "Salva");
    expect(await count("persons")).toBe(1);
    expect(await giornoHours(deps, 2027, 3, 14, [11, 12, 13, 14, 18, 21])).toEqual([13, 18]);
    // Un reminder è partito: il recupero arriva il giorno dopo.
    await runAt(deps, 2027, 3, 15, 13);
    expect(deps.tg.lastText()).toContain("⏰ Ieri era il compleanno di Marco Rossi");
  });

  it("BR-12: alle 10 cambio priorità da Media ad Alta → 13, 18, 21", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "media" });
    const deps = makeCronDeps();
    expect(await giornoHours(deps, 2027, 3, 14, [9])).toEqual([9]);
    deps.setNow(localInstant(2027, 3, 14, 10));
    await press(deps, "p:m:1");
    await tap(deps, "Priorità");
    await tap(deps, "Alta");
    expect(await giornoHours(deps, 2027, 3, 14, [13, 18, 21])).toEqual([13, 18, 21]);
  });

  it("BR-13: cambio data con occorrenza aperta → occorrenza e invii cancellati, promemoria secondo la nuova data", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1995, priority: "alta" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    expect(await count("deliveries")).toBe(1);
    deps.setNow(localInstant(2027, 3, 14, 10));
    await changeDate(deps, 1, "16/03/1995");
    expect(await count("occurrences")).toBe(0);
    expect(await count("deliveries")).toBe(0);
    deps.tg.reset();
    await runAt(deps, 2027, 3, 14, 13);
    expect(deps.tg.messages().map((m) => m.text)).toEqual(["📅 Tra 2 giorni: compleanno di Marco Rossi (32 anni) — 16/03"]);
    expect(await giornoHours(deps, 2027, 3, 16, [9])).toEqual([9]);
    expect(await occurrences()).toEqual([{ year: 2027, effective_date: "2027-03-16", status: "aperta" }]);
  });

  it("BR-13, BR-10: cambio verso una data già passata → nessun promemoria retroattivo", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    deps.setNow(localInstant(2027, 3, 14, 10));
    await changeDate(deps, 1, "01/02");
    deps.tg.reset();
    for (const h of [13, 18, 21]) await runAt(deps, 2027, 3, 14, h);
    await runAt(deps, 2027, 3, 15, 13);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("occurrences")).toBe(0);
  });

  it("BR-13, BR-06: occorrenza dell'anno già chiusa → esito invariato, nessuna seconda occorrenza", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, priority: "alta" });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14", status: "fatto" });
    const deps = makeCronDeps({ now: localInstant(2027, 3, 14, 10) });
    await changeDate(deps, 1, "20/03");
    deps.tg.reset();
    await runAt(deps, 2027, 3, 14, 13);
    for (const h of [9, 13, 18, 21]) await runAt(deps, 2027, 3, 20, h);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await occurrences()).toEqual([{ year: 2027, effective_date: "2027-03-14", status: "fatto" }]);
  });

  it("research R-04: cambio del solo anno di nascita → occorrenza aperta conservata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1995, priority: "alta" });
    const occ = await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14" });
    await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "inviato", localDate: "2027-03-14" });
    const deps = makeCronDeps({ now: localInstant(2027, 3, 14, 10) });
    await changeDate(deps, 1, "14/03/1994");
    expect(await count("occurrences", "status = 'aperta'")).toBe(1);
    expect(await count("deliveries")).toBe(1);
  });

  it("BR-13: a dicembre l'occorrenza aperta dell'anno successivo nata da un pre-reminder viene annullata", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 2, month: 1, priority: "alta" });
    const deps = makeCronDeps();
    await runAt(deps, 2026, 12, 26, 13);
    expect(await occurrences()).toEqual([{ year: 2027, effective_date: "2027-01-02", status: "aperta" }]);
    deps.setNow(localInstant(2026, 12, 26, 15));
    await changeDate(deps, 1, "05/01");
    expect(await count("occurrences")).toBe(0);
  });
});
