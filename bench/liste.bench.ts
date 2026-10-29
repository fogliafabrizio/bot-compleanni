import { bench, describe } from "vitest";
import { renderGroupList } from "../src/bot/gruppi";
import { formatRows, plainLine, splitMessage } from "../src/bot/liste";
import type { GroupWithCount } from "../src/db/groups";
import { membersOf, type MembershipRow } from "../src/db/viste";
import { findGroups, matchSearch, sortByNextBirthday, sortGroups, type ListPerson } from "../src/domain/viste";
import type { LocalDate } from "../src/time";

// Parti pure delle liste con 200 persone (research R-12 di 003). Soglia: < 2 ms per iterazione.
// Solo dati sintetici, nessun dato reale.

const today: LocalDate = { year: 2026, month: 10, day: 28 };

const people: ListPerson[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  fullName: `Persona Sintetica ${i + 1}`,
  nickname: i % 2 === 0 ? `Nickname lungo con emoji 🎉 ${i}` : null,
  birthDay: (i % 28) + 1,
  birthMonth: (i % 12) + 1,
  birthYear: i % 3 === 0 ? null : 1980 + (i % 30),
}));

describe("research R-12: liste, 200 persone", () => {
  bench("ordinamento + rendering + divisione", () => {
    const messages = splitMessage([plainLine("Prossimi 366 giorni"), plainLine(""), ...formatRows(sortByNextBirthday(people, today))]);
    if (messages.length !== 5) throw new Error("scenario non valido");
  });

  bench("/cerca, 200 persone", () => {
    if (matchSearch(people, "sintetica 1").length === 0) throw new Error("scenario non valido");
  });
});

// Gruppi v1.1 (feature 005, research R-03, R-07): 200 persone in 100 gruppi, ~600 appartenenze.
// Soglia: ≤ 3 ms per iterazione.
const groups: GroupWithCount[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: i % 3 === 0 ? `👨‍👩‍👧 Gruppo Sintetico ${i}` : `Gruppo Sintetico ${i}`,
  members: 6,
}));
const memberships: MembershipRow[] = people.flatMap((p, i) =>
  [0, 1, 2].map((k) => ({
    group_id: ((i * 3 + k) % 100) + 1,
    id: p.id,
    full_name: p.fullName,
    nickname: p.nickname,
    birth_day: p.birthDay,
    birth_month: p.birthMonth,
    birth_year: p.birthYear,
  })),
);

describe("research R-03, R-07 (005): gruppi, 200 persone / 100 gruppi", () => {
  bench("ricerca gruppo + filtro appartenenze + ordinamento + rendering", () => {
    const found = findGroups(groups, "gruppo sintetico 42");
    if (found.kind !== "one") throw new Error("scenario non valido");
    const rows = formatRows(sortByNextBirthday(membersOf(memberships, found.group.id), today));
    if (rows.length === 0) throw new Error("scenario non valido");
  });

  bench("scheda 200 persone", () => {
    const messages = splitMessage([plainLine("👥 Tutti · 200 persone"), plainLine(""), ...formatRows(sortByNextBirthday(people, today))]);
    if (messages.length !== 5) throw new Error("scenario non valido");
  });

  bench("elenco 100 gruppi", () => {
    const r = renderGroupList(sortGroups(groups), { title: "👥 I tuoi gruppi", action: "o", withNew: true });
    if (r.lines.length < 100) throw new Error("scenario non valido");
  });
});
