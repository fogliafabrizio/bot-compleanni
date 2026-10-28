import { describe, expect, it } from "vitest";
import { searchKey } from "../../src/domain/text";
import {
  matchSearch,
  monthRows,
  nextBirthdayRow,
  parseMonth,
  parseUpcomingArgs,
  parseYear,
  pendingWindow,
  sortByNextBirthday,
  upcoming,
  type ListPerson,
} from "../../src/domain/viste";

const today = { year: 2026, month: 10, day: 28 };

let nextId = 1;
const p = (fullName: string, birthDay: number, birthMonth: number, birthYear: number | null = null, nickname: string | null = null): ListPerson => ({
  id: nextId++,
  fullName,
  nickname,
  birthDay,
  birthMonth,
  birthYear,
});

const names = (rows: { person: ListPerson }[]) => rows.map((r) => r.person.nickname ?? r.person.fullName);

describe("FR-012, research R-09: searchKey", () => {
  it("FR-012: senza maiuscole né accenti", () => {
    expect(searchKey("Nicolò")).toBe(searchKey("NICOLO"));
    expect(searchKey("NICOLÒ")).toBe("nicolo");
    expect(searchKey("Élodie")).toBe("elodie");
  });
});

describe("FR-002, research R-03, R-04: prossimo compleanno", () => {
  it("R-04: nextBirthdayRow con data effettiva, anno ed età che compirà", () => {
    const r = nextBirthdayRow(p("Anna", 30, 10, 1998), today);
    expect(r.date).toEqual({ year: 2026, month: 10, day: 30 });
    expect(r.age).toBe(28);
    expect(r.daysUntil).toBe(2);
    expect(nextBirthdayRow(p("Luca", 1, 3, 1990), today)).toMatchObject({ date: { year: 2027, month: 3, day: 1 }, age: 37 });
    expect(nextBirthdayRow(p("Senza anno", 1, 3), today).age).toBeNull();
  });

  it("FR-002: oggi in cima, poi per data; a pari data per nome e poi id", () => {
    const rows = sortByNextBirthday([p("Zeno", 5, 11), p("bruno", 5, 11), p("Anna", 28, 10), p("Bruno", 5, 11), p("Carla", 1, 11)], today);
    expect(names(rows)).toEqual(["Anna", "Carla", "bruno", "Bruno", "Zeno"]);
    expect(rows[2]!.person.id).toBeLessThan(rows[3]!.person.id);
  });

  it("FR-002: il nome visualizzato è il nickname", () => {
    expect(names(sortByNextBirthday([p("Zeno Rossi", 5, 11, null, "Al"), p("Bruno", 5, 11)], today))).toEqual(["Al", "Bruno"]);
  });

  it("BR-04: nato il 29/02 in anno non bisestile alla posizione del 28/02", () => {
    const t = { year: 2027, month: 2, day: 20 };
    const rows = sortByNextBirthday([p("Marzo", 1, 3), p("Leo", 29, 2, 2005), p("Pre", 27, 2), p("Post", 28, 2)], t);
    expect(names(rows)).toEqual(["Pre", "Leo", "Post", "Marzo"]);
    expect(rows[1]!.date).toEqual({ year: 2027, month: 2, day: 28 });
  });

  it("R-04: cavallo d'anno a dicembre", () => {
    const t = { year: 2026, month: 12, day: 20 };
    const rows = sortByNextBirthday([p("Gennaio", 5, 1, 2000), p("Dicembre", 25, 12, 2000)], t);
    expect(names(rows)).toEqual(["Dicembre", "Gennaio"]);
    expect(rows[1]).toMatchObject({ date: { year: 2027, month: 1, day: 5 }, age: 27 });
  });
});

describe("RF-17, FR-009, FR-011, research R-10: /prossimi", () => {
  it.each([
    ["", { ok: true, days: 30, group: null }],
    ["7", { ok: true, days: 7, group: null }],
    ["7 famiglia", { ok: true, days: 7, group: "famiglia" }],
    ["famiglia", { ok: true, days: 30, group: "famiglia" }],
    ["7 Beach  tennis", { ok: true, days: 7, group: "Beach tennis" }],
    ["Beach tennis", { ok: true, days: 30, group: "Beach tennis" }],
    ["1", { ok: true, days: 1, group: null }],
    ["366", { ok: true, days: 366, group: null }],
    ["0", { ok: false }],
    ["-3", { ok: false }],
    ["400", { ok: false }],
    ["400 famiglia", { ok: false }],
  ])("RF-17: %j", (args, expected) => {
    expect(parseUpcomingArgs(args)).toEqual(expected);
  });

  it("FR-009: da oggi a oggi + N − 1 compresi", () => {
    const rows = upcoming([p("Oggi", 28, 10), p("Sesto", 3, 11), p("Settimo", 4, 11)], today, 7);
    expect(names(rows)).toEqual(["Oggi", "Sesto"]);
    expect(names(upcoming([p("Oggi", 28, 10), p("Domani", 29, 10)], today, 1))).toEqual(["Oggi"]);
  });
});

describe("RF-18, FR-012: /cerca", () => {
  const people = [p("Marco Rossi", 1, 1, null, "Marchino"), p("Nicolò Bianchi", 2, 2), p("Anna Verdi", 3, 3)];
  it("FR-012: parte del nome completo o del nickname, senza maiuscole e accenti", () => {
    expect(matchSearch(people, "marc").map((x) => x.fullName)).toEqual(["Marco Rossi"]);
    expect(matchSearch(people, "MARCHINO").map((x) => x.fullName)).toEqual(["Marco Rossi"]);
    expect(matchSearch(people, "nicolo").map((x) => x.fullName)).toEqual(["Nicolò Bianchi"]);
    expect(matchSearch(people, " verdi ").map((x) => x.fullName)).toEqual(["Anna Verdi"]);
    expect(matchSearch(people, "a")).toHaveLength(3);
    expect(matchSearch(people, "zzz")).toEqual([]);
  });
});

describe("RF-20, FR-015, research R-04: /mese", () => {
  it.each([
    ["", 10],
    ["marzo", 3],
    ["Marzo", 3],
    ["MARZO", 3],
    ["3", 3],
    ["12", 12],
  ])("FR-015: %j → mese %i", (args, month) => {
    expect(parseMonth(args, today)).toEqual({ ok: true, month });
  });

  it.each(["marzzo", "13", "0", "-1", "3 marzo"])("FR-015: %j non riconosciuto", (args) => {
    expect(parseMonth(args, today)).toEqual({ ok: false });
  });

  it("R-04: mese corrente e successivi nell'anno corrente, mesi passati nell'anno prossimo", () => {
    const sara = p("Sara", 5, 10, 1990);
    expect(monthRows([sara], 10, today)[0]).toMatchObject({ date: { year: 2026, month: 10, day: 5 }, age: 36 });
    const marzo = monthRows([p("Luca", 14, 3, 1994)], 3, today);
    expect(marzo[0]).toMatchObject({ date: { year: 2027, month: 3, day: 14 }, age: 33 });
  });

  it("FR-015: ordine per giorno di nascita, poi nome; 29/02 al 28/02 nel 2027", () => {
    const rows = monthRows([p("Zeta", 29, 2, 2004), p("Beta", 3, 2), p("Alfa", 3, 2), p("Gamma", 28, 2)], 2, today);
    expect(names(rows)).toEqual(["Alfa", "Beta", "Gamma", "Zeta"]);
    expect(rows[3]!.date).toEqual({ year: 2027, month: 2, day: 28 });
  });
});

describe("RF-22, FR-019: /anno", () => {
  it("FR-019: vuoto = anno corrente; 4 cifre tra 1900 e l'anno corrente", () => {
    expect(parseYear("", today)).toEqual({ ok: true, year: 2026 });
    expect(parseYear("2025", today)).toEqual({ ok: true, year: 2025 });
    expect(parseYear("1900", today)).toEqual({ ok: true, year: 1900 });
    for (const bad of ["2027", "1899", "1850", "20x5", "25", "02025"]) expect(parseYear(bad, today)).toEqual({ ok: false });
  });
});

describe("RF-21, BR-08: finestra di /scaduti e Segna fatto", () => {
  it("BR-08: da oggi − 7 a ieri", () => {
    expect(pendingWindow(today)).toEqual({ from: "2026-10-21", to: "2026-10-27" });
    expect(pendingWindow({ year: 2027, month: 1, day: 3 })).toEqual({ from: "2026-12-27", to: "2027-01-02" });
  });
});
