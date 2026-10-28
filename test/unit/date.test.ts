import { describe, expect, it } from "vitest";
import { formatLong, formatShort, nextBirthday, parseBirthDate } from "../../src/domain/date";

const today = { year: 2026, month: 10, day: 28 };

describe("RF-02, BR-01, BR-02: validazione della data", () => {
  it.each([
    ["14/03/1994", { day: 14, month: 3, year: 1994 }],
    ["4/3/1994", { day: 4, month: 3, year: 1994 }],
    [" 14/03/1994 ", { day: 14, month: 3, year: 1994 }],
    ["29/02", { day: 29, month: 2, year: null }],
    ["29/02/1996", { day: 29, month: 2, year: 1996 }],
    ["01/01/1900", { day: 1, month: 1, year: 1900 }],
    ["25/12/2026", { day: 25, month: 12, year: 2026 }],
  ])("RF-02: %j valida", (input, expected) => {
    expect(parseBirthDate(input, today)).toEqual({ ok: true, ...expected });
  });

  it.each(["31/04", "14-3-94", "14/3/94", "29/02/1995", "31/12/1899", "01/01/2027", "00/01", "32/01", "12/13", "14/03/94a", ""])(
    "BR-01: %j rifiutata",
    (input) => {
      expect(parseBirthDate(input, today)).toEqual({ ok: false });
    },
  );

  it("BR-02: anno futuro e anteriore al 1900 rifiutati", () => {
    expect(parseBirthDate("01/01/2027", today).ok).toBe(false);
    expect(parseBirthDate("31/12/1899", today).ok).toBe(false);
  });
});

describe("RF-02: formati di visualizzazione", () => {
  it("RF-02: formatLong", () => {
    expect(formatLong({ day: 14, month: 3, year: 1994 })).toBe("14 marzo 1994");
    expect(formatLong({ day: 29, month: 2, year: null })).toBe("29 febbraio");
  });

  it("RF-03: formatShort", () => {
    expect(formatShort({ day: 14, month: 3, year: 1994 })).toBe("14/03/1994");
    expect(formatShort({ day: 29, month: 2, year: null })).toBe("29/02");
  });
});

describe("BR-03, BR-04: prossimo compleanno", () => {
  it("RF-03: 14/03 dal 28/10/2026 → 2027, 137 giorni", () => {
    expect(nextBirthday(14, 3, today)).toMatchObject({ year: 2027, daysUntil: 137 });
  });

  it("RF-03: 28/10 dal 28/10/2026 → oggi", () => {
    expect(nextBirthday(28, 10, today)).toMatchObject({ year: 2026, daysUntil: 0 });
  });

  it("BR-04: 29/02 dal 28/10/2026 → 28/02/2027, 123 giorni", () => {
    expect(nextBirthday(29, 2, today)).toEqual({ year: 2027, date: { year: 2027, month: 2, day: 28 }, daysUntil: 123 });
  });

  it("principio VI: 02/01 dal 28/12/2026 → 2027, 5 giorni", () => {
    expect(nextBirthday(2, 1, { year: 2026, month: 12, day: 28 })).toMatchObject({ year: 2027, daysUntil: 5 });
  });
});
