import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { insertOccurrence, insertPerson, rows } from "../helpers/db";
import { runAt } from "../helpers/cron";
import { makeCronDeps, makeDeps } from "../helpers/deps";
import { buttons, commandParts, monoParts } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

// Oggi = mercoledì 28/10/2026; finestra di /scaduti 21/10…27/10.

const statusOf = async (occId: number) =>
  (await rows<{ status: string }>("SELECT status FROM occurrences WHERE id = ?", occId))[0]?.status;

describe("US4: /scaduti e Segna fatto", () => {
  it("RF-21, FR-016: occorrenze non fatte nella finestra, per data, con esito; fatto, oggi−8 e oggi esclusi", async () => {
    const marco = await insertPerson({ fullName: "Marco", day: 25, month: 10, year: 1994 });
    const sara = await insertPerson({ fullName: "Sara", day: 22, month: 10 });
    const luca = await insertPerson({ fullName: "Luca", day: 27, month: 10, year: 2000 });
    const fatto = await insertPerson({ fullName: "Fatto", day: 24, month: 10 });
    const vecchio = await insertPerson({ fullName: "Vecchio", day: 20, month: 10 });
    const oggi = await insertPerson({ fullName: "Oggi", day: 28, month: 10 });
    await insertOccurrence({ personId: marco, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    await insertOccurrence({ personId: sara, year: 2026, effectiveDate: "2026-10-22", status: "non_confermato" });
    await insertOccurrence({ personId: luca, year: 2026, effectiveDate: "2026-10-27", status: "aperta" });
    await insertOccurrence({ personId: fatto, year: 2026, effectiveDate: "2026-10-24", status: "fatto" });
    await insertOccurrence({ personId: vecchio, year: 2026, effectiveDate: "2026-10-20", status: "saltato" });
    await insertOccurrence({ personId: oggi, year: 2026, effectiveDate: "2026-10-28", status: "aperta" });
    const deps = makeDeps();
    await say(deps, "/scaduti");
    const msg = deps.tg.messages()[0]!;
    expect(msg.text.split("\n").slice(0, 2)).toEqual(["Ultimi 7 giorni, non fatti", ""]);
    expect(monoParts(msg)).toEqual([
      "Gio 22/10  Sara        non confermato",
      "Dom 25/10  Marco (32)  saltato       ",
      "Mar 27/10  Luca (26)   in attesa     ",
    ]);
    expect(commandParts(msg)).toEqual([`/p_${sara}`, `/p_${marco}`, `/p_${luca}`]);
    expect(msg.keyboard).toBeUndefined();
  });

  it("RF-21: nessuna occorrenza in sospeso", async () => {
    const deps = makeDeps();
    await say(deps, "/scaduti");
    expect(deps.tg.lastText()).toBe("Nessun compleanno in sospeso negli ultimi 7 giorni");
  });

  it("RF-21, BR-08: scheda con Segna fatto sopra Modifica/Elimina; il tocco chiude in fatto e aggiorna la scheda", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 25, month: 10, year: 1994 });
    const occ = await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await say(deps, `/p_${id}`);
    const kb = deps.tg.lastKeyboard()!;
    expect(kb.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([["Segna fatto"], ["Modifica", "Elimina"]]);
    expect(buttons(kb)[0]).toEqual(["Segna fatto", `p:f:${id}`]);
    expect(deps.tg.lastText()!.split("\n").at(-1)).toBe("Storico: 2026 saltato");

    deps.tg.reset();
    await press(deps, `p:f:${id}`, 321);
    expect(await statusOf(occ)).toBe("fatto");
    const [edit] = deps.tg.textEdits();
    expect(edit!.messageId).toBe(321);
    expect(edit!.text.split("\n").at(-1)).toBe("Storico: 2026 fatto");
    expect(buttons(edit!.keyboard)).toEqual([
      ["Modifica", `p:m:${id}`],
      ["Elimina", `p:x:${id}`],
    ]);
    expect(deps.tg.callbackAnswers()).toEqual([{ method: "answerCallbackQuery", id: expect.any(String) }]);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("BR-08: nessun Segna fatto per un'occorrenza fatta o di 8 giorni fa", async () => {
    const a = await insertPerson({ fullName: "Fatto", day: 25, month: 10 });
    const b = await insertPerson({ fullName: "Vecchio", day: 20, month: 10 });
    await insertOccurrence({ personId: a, year: 2026, effectiveDate: "2026-10-25", status: "fatto" });
    await insertOccurrence({ personId: b, year: 2026, effectiveDate: "2026-10-20", status: "saltato" });
    const deps = makeDeps();
    for (const id of [a, b]) {
      await say(deps, `/p_${id}`);
      expect(buttons(deps.tg.lastKeyboard()).map(([t]) => t)).toEqual(["Modifica", "Elimina"]);
    }
  });

  it("BR-07: aperta di ieri → Segna fatto → fatto e alle 13 nessun recupero", async () => {
    const id = await insertPerson({ fullName: "Luca", day: 27, month: 10, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    const occ = await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-27", status: "aperta" });
    await env.DB.prepare(
      "INSERT INTO deliveries (occurrence_id, kind, ref, status, attempts, local_date) VALUES (?, 'giorno', 9, 'inviato', 1, '2026-10-27')",
    )
      .bind(occ)
      .run();
    const deps = makeCronDeps();
    await press(deps, `p:f:${id}`);
    expect(await statusOf(occ)).toBe("fatto");
    deps.tg.reset();
    await runAt(deps, 2026, 10, 28, 13);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("BR-08, FR-018: tocco oltre D+7 o su un'occorrenza già fatta → non più disponibile, esito invariato", async () => {
    const id = await insertPerson({ fullName: "Marco", day: 25, month: 10 });
    const occ = await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-25", status: "saltato" });
    const deps = makeDeps();
    await env.DB.prepare("UPDATE occurrences SET effective_date = '2026-10-20' WHERE id = ?").bind(occ).run();
    await press(deps, `p:f:${id}`);
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    expect(await statusOf(occ)).toBe("saltato");
    await env.DB.prepare("UPDATE occurrences SET effective_date = '2026-10-25', status = 'fatto' WHERE id = ?").bind(occ).run();
    await press(deps, `p:f:${id}`);
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    expect(deps.tg.textEdits()).toHaveLength(0);
  });

  it("FR-018c di 001: Segna fatto di una persona eliminata → Persona non trovata", async () => {
    const deps = makeDeps();
    await press(deps, "p:f:999");
    expect(deps.tg.lastAnswer()).toBe("Persona non trovata");
  });
});
