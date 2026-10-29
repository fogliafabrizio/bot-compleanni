import { describe, expect, it } from "vitest";
import { addDays, daysBetween, floorToHour, isLeapYear, localDayStartUtc, toDateString, toLocal, toLocalClock } from "../../src/time";

describe("BR-24: conversione Europe/Rome", () => {
  it("BR-24: 2026-10-28T10:00Z è il 28/10/2026 alle 11", () => {
    expect(toLocal(new Date("2026-10-28T10:00:00Z"))).toEqual({ year: 2026, month: 10, day: 28, hour: 11 });
  });

  it("BR-24: ora legale, 2026-07-01T22:30Z è il 02/07/2026 alle 0", () => {
    expect(toLocal(new Date("2026-07-01T22:30:00Z"))).toEqual({ year: 2026, month: 7, day: 2, hour: 0 });
  });

  it("BR-24: cambio d'ora di marzo", () => {
    expect(toLocal(new Date("2026-03-29T00:59:00Z")).hour).toBe(1);
    expect(toLocal(new Date("2026-03-29T01:00:00Z")).hour).toBe(3);
  });

  it("BR-24: cambio d'ora di ottobre", () => {
    expect(toLocal(new Date("2026-10-25T00:30:00Z")).hour).toBe(2);
    expect(toLocal(new Date("2026-10-25T01:30:00Z")).hour).toBe(2);
  });
});

describe("principio VI: giorni di calendario", () => {
  it("principio VI: a cavallo d'anno 28/12/2026 → 02/01/2027 = 5", () => {
    expect(daysBetween({ year: 2026, month: 12, day: 28 }, { year: 2027, month: 1, day: 2 })).toBe(5);
  });

  it("principio VI: 28/10/2026 → 14/03/2027 = 137", () => {
    expect(daysBetween({ year: 2026, month: 10, day: 28 }, { year: 2027, month: 3, day: 14 })).toBe(137);
  });

  it("principio VI: a cavallo del cambio d'ora 28/03/2026 → 30/03/2026 = 2", () => {
    expect(daysBetween({ year: 2026, month: 3, day: 28 }, { year: 2026, month: 3, day: 30 })).toBe(2);
  });

  it("BR-04: anni bisestili", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("BR-24: date di calendario e inizio della giornata locale", () => {
  it("BR-24: addDays attraverso fine mese, fine anno e 28/02 non bisestile", () => {
    expect(addDays({ year: 2027, month: 1, day: 31 }, 1)).toEqual({ year: 2027, month: 2, day: 1 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2027, month: 2, day: 28 }, 1)).toEqual({ year: 2027, month: 3, day: 1 });
    expect(addDays({ year: 2027, month: 1, day: 1 }, -1)).toEqual({ year: 2026, month: 12, day: 31 });
    expect(addDays({ year: 2026, month: 12, day: 26 }, 7)).toEqual({ year: 2027, month: 1, day: 2 });
  });

  it("BR-24: toDateString", () => {
    expect(toDateString({ year: 2027, month: 3, day: 4 })).toBe("2027-03-04");
  });

  it("BR-24: floorToHour", () => {
    expect(floorToHour(new Date("2027-03-14T08:00:07.123Z")).toISOString()).toBe("2027-03-14T08:00:00.000Z");
    expect(floorToHour(new Date("2027-03-14T08:59:59.999Z")).toISOString()).toBe("2027-03-14T08:00:00.000Z");
  });

  it.each([
    ["inverno", { year: 2027, month: 1, day: 10 }, "2027-01-09T23:00:00.000Z"],
    ["estate", { year: 2027, month: 7, day: 10 }, "2027-07-09T22:00:00.000Z"],
    ["domenica del passaggio all'ora legale", { year: 2027, month: 3, day: 28 }, "2027-03-27T23:00:00.000Z"],
    ["domenica del ritorno all'ora solare", { year: 2027, month: 10, day: 31 }, "2027-10-30T22:00:00.000Z"],
  ])("BR-24: localDayStartUtc, %s", (_label, d, iso) => {
    expect(localDayStartUtc(d).toISOString()).toBe(iso);
  });

  it("BR-24: 13:00 locali nei due giorni del cambio d'ora", () => {
    expect(toLocal(new Date("2027-03-28T11:00:00.000Z"))).toEqual({ year: 2027, month: 3, day: 28, hour: 13 });
    expect(toLocal(new Date("2027-10-31T12:00:00.000Z"))).toEqual({ year: 2027, month: 10, day: 31, hour: 13 });
  });
});

describe("N-06, RF-31, principio VI: toLocalClock", () => {
  it("RF-31: 2026-10-29T14:05Z è il 29/10/2026 alle 15:05", () => {
    expect(toLocalClock(new Date("2026-10-29T14:05:00Z"))).toEqual({ year: 2026, month: 10, day: 29, hour: 15, minute: 5 });
  });

  it("principio VI: ora legale, 2026-07-01T07:00Z è alle 9:00", () => {
    expect(toLocalClock(new Date("2026-07-01T07:00:00Z"))).toMatchObject({ day: 1, hour: 9, minute: 0 });
  });

  it("principio VI: le due 2:00 del 25/10/2026 (00:00Z e 01:00Z)", () => {
    expect(toLocalClock(new Date("2026-10-25T00:00:00Z"))).toMatchObject({ day: 25, hour: 2, minute: 0 });
    expect(toLocalClock(new Date("2026-10-25T01:00:00Z"))).toMatchObject({ day: 25, hour: 2, minute: 0 });
  });

  it("principio VI: toLocal resta invariata (senza minuti)", () => {
    expect(toLocal(new Date("2026-10-29T14:05:00Z"))).toEqual({ year: 2026, month: 10, day: 29, hour: 15 });
  });
});
