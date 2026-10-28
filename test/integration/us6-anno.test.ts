import { describe, expect, it } from "vitest";
import { insertOccurrence, insertPerson } from "../helpers/db";
import { makeDeps } from "../helpers/deps";
import { commandParts, monoParts } from "../helpers/fake-telegram";
import { say } from "../helpers/send";

// Oggi = mercoledì 28/10/2026.

const dateOf = (year: number, i: number) => `${year}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;

describe("US6: /anno", () => {
  it("RF-22, BR-09, FR-019: conteggi, saltati per data e serie di 2+ anni", async () => {
    // 40 fatto, 2 non confermato nel 2025.
    for (let i = 0; i < 42; i++) {
      const id = await insertPerson({ fullName: `Persona ${i}`, day: (i % 28) + 1, month: (i % 12) + 1 });
      await insertOccurrence({ personId: id, year: 2025, effectiveDate: dateOf(2025, i), status: i < 40 ? "fatto" : "non_confermato" });
    }
    const luca = await insertPerson({ fullName: "Luca", day: 10, month: 3, year: 1990 });
    await insertOccurrence({ personId: luca, year: 2024, effectiveDate: "2024-03-10", status: "saltato" });
    await insertOccurrence({ personId: luca, year: 2025, effectiveDate: "2025-03-10", status: "saltato" });
    const giulia = await insertPerson({ fullName: "Giulia", day: 21, month: 11 });
    await insertOccurrence({ personId: giulia, year: 2024, effectiveDate: "2024-11-21", status: "non_confermato" });
    await insertOccurrence({ personId: giulia, year: 2025, effectiveDate: "2025-11-21", status: "saltato" });
    const paolo = await insertPerson({ fullName: "Paolo", day: 5, month: 6, year: 1980 });
    await insertOccurrence({ personId: paolo, year: 2023, effectiveDate: "2023-06-05", status: "saltato" });
    await insertOccurrence({ personId: paolo, year: 2024, effectiveDate: "2024-06-05", status: "saltato" });
    await insertOccurrence({ personId: paolo, year: 2025, effectiveDate: "2025-06-05", status: "saltato" });
    // Aperta: non conteggiata.
    const aperta = await insertPerson({ fullName: "Aperta", day: 1, month: 12 });
    await insertOccurrence({ personId: aperta, year: 2025, effectiveDate: "2025-12-01", status: "aperta" });

    const deps = makeDeps();
    await say(deps, "/anno 2025");
    const [msg] = deps.tg.messages();
    expect(deps.tg.messages()).toHaveLength(1);
    expect(msg!.keyboard).toBeUndefined();
    expect(msg!.text.split("\n")).toEqual([
      "Riepilogo 2025",
      "",
      "Fatto: 40",
      "Saltato: 3",
      "Non confermato: 2",
      "",
      "Saltati:",
      `Lun 10/03  Luca (35)   /p_${luca}`,
      `Gio 05/06  Paolo (45)  /p_${paolo}`,
      `Ven 21/11  Giulia      /p_${giulia}`,
      "",
      "Saltati per 2 o più anni di fila:",
      `Lun 10/03  Luca (35)   /p_${luca}`,
      `Gio 05/06  Paolo (45)  /p_${paolo}`,
    ]);
    expect(commandParts(msg!)).toHaveLength(5);
    expect(new Set(monoParts(msg!).map((s) => s.length)).size).toBe(1);
  });

  it("BR-09: una serie interrotta da fatto nell'anno non compare", async () => {
    const paolo = await insertPerson({ fullName: "Paolo", day: 5, month: 6 });
    await insertOccurrence({ personId: paolo, year: 2023, effectiveDate: "2023-06-05", status: "saltato" });
    await insertOccurrence({ personId: paolo, year: 2024, effectiveDate: "2024-06-05", status: "saltato" });
    await insertOccurrence({ personId: paolo, year: 2025, effectiveDate: "2025-06-05", status: "fatto" });
    const deps = makeDeps();
    await say(deps, "/anno 2025");
    expect(deps.tg.lastText()!.split("\n").slice(2)).toEqual([
      "Fatto: 1",
      "Saltato: 0",
      "Non confermato: 0",
      "",
      "Saltati:",
      "nessuno",
      "",
      "Saltati per 2 o più anni di fila:",
      "nessuno",
    ]);
    await say(deps, "/anno 2024");
    expect(deps.tg.lastText()).toContain(`Saltati per 2 o più anni di fila:\nMer 05/06  Paolo  /p_${paolo}`);
  });

  it("RF-22: /anno → anno corrente; anno senza esiti → zeri e nessuno", async () => {
    const deps = makeDeps();
    await say(deps, "/anno");
    expect(deps.tg.lastText()).toBe(
      ["Riepilogo 2026", "", "Fatto: 0", "Saltato: 0", "Non confermato: 0", "", "Saltati:", "nessuno", "", "Saltati per 2 o più anni di fila:", "nessuno"].join(
        "\n",
      ),
    );
    expect(deps.tg.messages()[0]!.entities).toBeUndefined();
  });

  it.each(["2027", "1850", "20x5"])("FR-019: /anno %s → anno non valido", async (y) => {
    const deps = makeDeps();
    await say(deps, `/anno ${y}`);
    expect(deps.tg.messages().map((m) => m.text)).toEqual(["Anno non valido: scrivi un anno tra 1900 e 2026"]);
  });
});
