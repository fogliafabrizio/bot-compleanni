import { bench, describe } from "vitest";
import { formatRows, plainLine, splitMessage } from "../src/bot/liste";
import { matchSearch, sortByNextBirthday, type ListPerson } from "../src/domain/viste";
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
