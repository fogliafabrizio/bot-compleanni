import { describe, expect, it } from "vitest";
import { daysBetween, isLeapYear, toLocal } from "../../src/time";

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
