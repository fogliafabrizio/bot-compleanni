import { describe, expect, it } from "vitest";
import { adjacentMonths, canWidenUpcoming, yearNavigation } from "../../src/domain/viste";

// Pulsanti di passo successivo delle viste (RNF-14, research R-05 di 009): funzioni pure.

describe("RF-20, FR-019: adjacentMonths", () => {
  it.each([
    [1, 12, 2],
    [3, 2, 4],
    [12, 11, 1],
  ])("RF-20: mese %i → prev %i, next %i", (month, prev, next) => {
    expect(adjacentMonths(month)).toEqual({ prev, next });
  });

  it("RF-20, SC-004: i 12 mesi formano un ciclo in entrambe le direzioni", () => {
    for (const dir of ["next", "prev"] as const) {
      const seen: number[] = [];
      let m = 1;
      for (let i = 0; i < 12; i++) {
        seen.push(m);
        m = adjacentMonths(m)[dir];
      }
      expect(m).toBe(1);
      expect(new Set(seen).size).toBe(12);
    }
  });
});

describe("RF-22, FR-020: yearNavigation", () => {
  it.each([
    [2026, 2026, true, 2025, null],
    [2026, 2026, false, null, null],
    [2025, 2026, false, null, 2026],
    [2023, 2026, false, null, 2024],
    [2025, 2026, true, 2024, 2026],
  ])("RF-22: anno %i, corrente %i, storico prima %s → prev %s, next %s", (shown, current, has, prev, next) => {
    expect(yearNavigation(shown, current, has)).toEqual({ prev, next });
  });
});

describe("RF-17, FR-018: canWidenUpcoming", () => {
  it.each([1, 30, 89])("RF-17: %i giorni → pulsante", (days) => expect(canWidenUpcoming(days)).toBe(true));
  it.each([90, 120, 366])("RF-17: %i giorni → nessun pulsante", (days) => expect(canWidenUpcoming(days)).toBe(false));
});
