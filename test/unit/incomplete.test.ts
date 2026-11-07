import { describe, expect, it } from "vitest";
import {
  filterByCode,
  INCOMPLETE_FILTERS,
  incompleteRows,
  isMissing,
  matchesFilter,
  parseIncompleteArg,
  type IncompleteKey,
  type IncompletePerson,
} from "../../src/domain/incomplete";
import { rowToIncompletePerson } from "../../src/db/incomplete";
import { T } from "../../src/texts";
import type { LocalDate } from "../../src/time";

// Oggi = 28/10/2026.
const TODAY: LocalDate = { year: 2026, month: 10, day: 28 };

function person(over: Partial<IncompletePerson> = {}): IncompletePerson {
  const p: IncompletePerson = {
    id: 1,
    fullName: "Marco Rossi",
    nickname: null,
    birthDay: 14,
    birthMonth: 3,
    birthYear: 1990,
    phone: "+393331234567",
    instagram: "marco",
    telegram: "marco_tg",
    rawBirthYear: 1990,
    ...over,
  };
  return p;
}

const filtro = (key: IncompleteKey) => INCOMPLETE_FILTERS.find((f) => f.key === key)!;

describe("RF-50, FR-011: parseIncompleteArg", () => {
  it("RF-50: senza argomento → menu", () => {
    expect(parseIncompleteArg("")).toEqual({ kind: "menu" });
    expect(parseIncompleteArg("   ")).toEqual({ kind: "menu" });
  });

  it.each(["telefono", "instagram", "telegram", "anno", "contatti"])("RF-50: %s → filtro", (a) => {
    const r = parseIncompleteArg(a);
    expect(r.kind).toBe("filter");
    if (r.kind === "filter") expect(r.filter.arg).toBe(a);
  });

  it.each([
    ["Anno", "anno"],
    ["TELEFONO", "telefono"],
    ["  TELEFONO ", "telefono"],
  ])("FR-011: «%s» → filtro %s (maiuscole e spazi ai bordi)", (a, key) => {
    expect(parseIncompleteArg(a)).toEqual({ kind: "filter", filter: filtro(key as IncompleteKey) });
  });

  it.each(["email", "telefoni", "ig", "contatto", "telefono famiglia"])("FR-011: «%s» → unknown", (a) => {
    expect(parseIncompleteArg(a)).toEqual({ kind: "unknown" });
  });
});

describe("FR-008, FR-017: isMissing", () => {
  it.each([null, "", "   "])("FR-008: %j è mancante", (v) => expect(isMissing(v)).toBe(true));
  it.each(["+39333123", "marco", 1990])("FR-008: %j non è mancante", (v) => expect(isMissing(v)).toBe(false));
});

describe("RF-50, FR-008: matchesFilter", () => {
  it.each([
    ["telefono", { phone: null }],
    ["instagram", { instagram: "" }],
    ["telegram", { telegram: "  " }],
    ["anno", { birthYear: null, rawBirthYear: null }],
    ["contatti", { phone: null, instagram: null, telegram: null }],
  ] as const)("FR-008: filtro %s con e senza il dato", (key, senza) => {
    expect(matchesFilter(person(senza), filtro(key))).toBe(true);
    expect(matchesFilter(person(), filtro(key))).toBe(false);
  });

  it("US2-6: Marco con solo Instagram → telefono e telegram sì, instagram e contatti no", () => {
    const marco = person({ phone: null, telegram: null });
    expect(matchesFilter(marco, filtro("telefono"))).toBe(true);
    expect(matchesFilter(marco, filtro("telegram"))).toBe(true);
    expect(matchesFilter(marco, filtro("instagram"))).toBe(false);
    expect(matchesFilter(marco, filtro("contatti"))).toBe(false);
  });

  it("FR-008: instagram di soli spazi e nessun altro contatto → nessun contatto", () => {
    expect(matchesFilter(person({ phone: null, instagram: "  ", telegram: null }), filtro("contatti"))).toBe(true);
  });

  it("FR-008: anno anomalo (1850) non è mancante", () => {
    expect(matchesFilter(person({ birthYear: 1850, rawBirthYear: 1850 }), filtro("anno"))).toBe(false);
  });

  it("FR-008: anno '' o di soli spazi è mancante", () => {
    expect(matchesFilter(person({ birthYear: null, rawBirthYear: "" }), filtro("anno"))).toBe(true);
    expect(matchesFilter(person({ birthYear: null, rawBirthYear: "  " }), filtro("anno"))).toBe(true);
  });
});

describe("FR-008, FR-010: filterByCode", () => {
  it("FR-008: codici 1…5 nell'ordine telefono, instagram, telegram, anno, contatti", () => {
    expect([1, 2, 3, 4, 5].map((n) => filterByCode(n)?.key)).toEqual(["telefono", "instagram", "telegram", "anno", "contatti"]);
  });
  it.each([0, 6, -1, 999999999999999])("FR-010: %i → undefined", (n) => expect(filterByCode(n)).toBeUndefined());
});

describe("RF-50, FR-012: incompleteRows", () => {
  it("FR-012: per prossimo compleanno (oggi compreso), poi nome, poi id; solo chi non ha il dato", () => {
    const people = [
      person({ id: 1, fullName: "Zeno", birthDay: 1, birthMonth: 11, phone: null }),
      person({ id: 2, fullName: "Anna", birthDay: 28, birthMonth: 10, phone: null }),
      person({ id: 3, fullName: "Bruno", birthDay: 1, birthMonth: 11, phone: null }),
      person({ id: 4, fullName: "Bruno", birthDay: 1, birthMonth: 11, phone: null }),
      person({ id: 5, fullName: "Carla", birthDay: 27, birthMonth: 10, phone: null }),
      person({ id: 6, fullName: "Dario", birthDay: 29, birthMonth: 10 }),
    ];
    expect(incompleteRows(people, filtro("telefono"), TODAY).map((r) => r.person.id)).toEqual([2, 3, 4, 1, 5]);
  });

  it("§5.7: persona senza anno → riga senza età", () => {
    const [r] = incompleteRows([person({ birthYear: null, rawBirthYear: null })], filtro("anno"), TODAY);
    expect(r!.age).toBeNull();
  });
});

describe("RF-50, FR-013, US2-7: testi della lista vuota", () => {
  it.each([
    ["telefono", "✅ Tutte le persone hanno il telefono."],
    ["instagram", "✅ Tutte le persone hanno l'username Instagram."],
    ["telegram", "✅ Tutte le persone hanno l'username Telegram."],
    ["anno", "✅ Tutte le persone hanno l'anno di nascita."],
    ["contatti", "✅ Tutte le persone hanno almeno un contatto."],
  ] as const)("FR-013: incompleteAllHave(%s)", (key, testo) => {
    expect(T.incompleteAllHave(key)).toBe(testo);
  });

  it("FR-013: rubrica vuota", () => {
    expect(T.incompleteNoPersons).toBe("📝 La rubrica è vuota: non ci sono persone.");
  });
});

describe("FR-012, FR-024: rowToIncompletePerson", () => {
  const row = (birth_year: number | string | null) => ({
    id: 7,
    full_name: "Anna Bianchi",
    nickname: null,
    birth_day: 2,
    birth_month: 11,
    birth_year,
    phone: null,
    instagram: "anna",
    telegram: null,
  });

  it.each(["", "  "])("FR-012: anno %j → birthYear null, rawBirthYear invariato, nessuna età", (v) => {
    const p = rowToIncompletePerson(row(v));
    expect(p.birthYear).toBeNull();
    expect(p.rawBirthYear).toBe(v);
    expect(incompleteRows([p], filtro("anno"), TODAY)[0]!.age).toBeNull();
  });

  it("FR-012: anno 1990 → birthYear 1990", () => {
    const p = rowToIncompletePerson(row(1990));
    expect(p).toMatchObject({ birthYear: 1990, rawBirthYear: 1990, phone: null, instagram: "anna", telegram: null });
  });
});
