import { describe, expect, it } from "vitest";
import { insertOccurrence, insertPerson } from "../helpers/db";
import { localInstant, runAt } from "../helpers/cron";
import { makeCronDeps, makeDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

const lastLine = (text: string | undefined) => text?.split("\n").at(-1);

describe("US5: storico esiti", () => {
  it("RF-03, RF-14, FR-034: fatto 2025 e saltato 2024 → Storico dal più recente", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertOccurrence({ personId: 1, year: 2024, effectiveDate: "2024-03-14", status: "saltato" });
    await insertOccurrence({ personId: 1, year: 2025, effectiveDate: "2025-03-14", status: "fatto" });
    const deps = makeDeps();
    await say(deps, "/p_1");
    expect(lastLine(deps.tg.lastText())).toBe("Storico: 2025 fatto · 2024 saltato");
  });

  it("FR-034: non confermato mostrato come «non confermato»; l'occorrenza aperta non compare", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "non_confermato" });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14", status: "aperta" });
    const deps = makeDeps();
    await say(deps, "/p_1");
    expect(lastLine(deps.tg.lastText())).toBe("Storico: 2026 non confermato");
  });

  it("RF-03, FR-013 (001): nessun esito → nessuna riga Storico", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertOccurrence({ personId: 1, year: 2027, effectiveDate: "2027-03-14", status: "aperta" });
    const deps = makeDeps();
    await say(deps, "/p_1");
    expect(deps.tg.lastText()).not.toContain("Storico");
  });

  it("RF-10, BR-09: esito 2026 saltato → reminder 2027 con «L'anno scorso: saltato»", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "saltato" });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    expect(lastLine(deps.tg.lastText())).toBe("L'anno scorso: saltato");
  });

  it("RF-14: un esito ottenuto da un tocco Fatto reale compare nella scheda", async () => {
    await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3 });
    const deps = makeCronDeps();
    await runAt(deps, 2027, 3, 14, 9);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Fatto ✅"), 100);
    deps.setNow(localInstant(2027, 3, 20, 10));
    await say(deps, "/p_1");
    expect(lastLine(deps.tg.lastText())).toBe("Storico: 2027 fatto");
  });
});
