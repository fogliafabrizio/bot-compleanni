import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { runAt } from "../helpers/cron";
import { makeCronDeps, makeDeps } from "../helpers/deps";
import { buttons, cbOf, commandParts, labels, monoParts } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

// Oggi = mercoledì 28/10/2026, 11:00 a Roma (NOW).

async function occurrence(personId: number): Promise<{ id: number; year: number; effective_date: string; status: string }> {
  const [o] = await rows<{ id: number; year: number; effective_date: string; status: string }>(
    "SELECT id, year, effective_date, status FROM occurrences WHERE person_id = ? AND year = 2026",
    personId,
  );
  return o!;
}

describe("US1: /oggi", () => {
  it("RF-16, FR-006, FR-007: un messaggio del reminder per compleanno, pulsanti t:, occorrenza creata senza deliveries", async () => {
    const marco = await insertPerson({ fullName: "Marco Rossi", nickname: "Marchino", day: 28, month: 10, year: 1994, phone: "+393331234567" });
    const anna = await insertPerson({ fullName: "Anna Bianchi", day: 28, month: 10 });
    await insertPerson({ fullName: "Altro", day: 29, month: 10 });
    await addToGroup(marco, await insertGroup("Lavoro"));
    await insertOccurrence({ personId: marco, year: 2025, effectiveDate: "2025-10-28", status: "fatto" });
    const deps = makeDeps();
    await say(deps, "/oggi");

    const msgs = deps.tg.messages();
    expect(msgs.map((m) => m.text)).toEqual([
      T.reminderTitle("Anna Bianchi", null, null, false),
      [
        T.reminderTitle("Marchino", "Marco Rossi", 32, false),
        "Gruppi: Lavoro",
        "📱 +393331234567",
        "L'anno scorso: fatto ✅",
      ].join("\n"),
    ]);
    const occA = await occurrence(anna);
    const occM = await occurrence(marco);
    expect(occA).toMatchObject({ effective_date: "2026-10-28", status: "aperta" });
    expect(occM).toMatchObject({ effective_date: "2026-10-28", status: "aperta" });
    expect(labels(msgs[1]!.keyboard)).toEqual(["WhatsApp", "Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
    expect(cbOf(msgs[1]!.keyboard, "Fatto ✅")).toBe(`t:f:${occM.id}`);
    expect(cbOf(msgs[1]!.keyboard, "Salta quest'anno")).toBe(`t:s:${occM.id}`);
    expect(cbOf(msgs[0]!.keyboard, "Fatto ✅")).toBe(`t:f:${occA.id}`);
    expect(await count("deliveries")).toBe(0);

    // Un secondo /oggi non duplica l'occorrenza.
    await say(deps, "/oggi");
    expect(await count("occurrences", "year = 2026")).toBe(2);
  });

  it("RF-16, BR-07: occorrenza già fatta → ✅ Fatto e soli contatti", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10, phone: "+393331234567" });
    await insertOccurrence({ personId: id, year: 2026, effectiveDate: "2026-10-28", status: "fatto" });
    const deps = makeDeps();
    await say(deps, "/oggi");
    expect(deps.tg.lastText()).toBe(`${T.reminderTitle("Marco Rossi", null, null, false)}\n📱 +393331234567\n\n${T.outcomeDone}`);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["WhatsApp", "Copia messaggio"]);
  });

  it("RF-16, BR-07: Fatto da /oggi chiude l'occorrenza; gli slot e il recupero non inviano più nulla", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10, priority: "alta", createdAt: "2026-01-01T00:00:00.000Z" });
    const deps = makeCronDeps();
    await say(deps, "/oggi");
    const occ = await occurrence(id);
    deps.tg.reset();
    await press(deps, `t:f:${occ.id}`, 555);
    expect((await occurrence(id)).status).toBe("fatto");
    const [edit] = deps.tg.textEdits();
    expect(edit).toMatchObject({ messageId: 555, text: `${T.reminderTitle("Marco Rossi", null, null, false)}\n\n${T.outcomeDone}` });
    expect(labels(edit!.keyboard)).toEqual(["Copia messaggio"]);
    expect(deps.tg.callbackAnswers()).toEqual([{ method: "answerCallbackQuery", id: expect.any(String) }]);

    deps.tg.reset();
    await runAt(deps, 2026, 10, 28, 13);
    await runAt(deps, 2026, 10, 28, 18);
    await runAt(deps, 2026, 10, 29, 13);
    expect(deps.tg.messages()).toHaveLength(0);
    expect(await count("deliveries")).toBe(0);
  });

  it("RF-16: Salta da /oggi → saltato; secondo tocco → non più disponibile", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const occ = await occurrence(id);
    await press(deps, `t:s:${occ.id}`);
    expect((await occurrence(id)).status).toBe("saltato");
    expect(deps.tg.textEdits().at(-1)!.text.endsWith("\n\nSaltato")).toBe(true);
    deps.tg.reset();
    await press(deps, `t:f:${occ.id}`);
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(deps.tg.textEdits()).toHaveLength(0);
    expect((await occurrence(id)).status).toBe("saltato");
  });

  it("FR-018c di 001: occorrenza cancellata con la persona → Persona non trovata", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const occ = await occurrence(id);
    await env.DB.prepare("DELETE FROM persons WHERE id = ?").bind(id).run();
    await press(deps, `t:f:${occ.id}`);
    expect(deps.tg.lastAnswer()).toBe(T.personNotFound);
  });

  it("contracts/callback-data.md di 003: t: durante un flusso guidato non lo annulla; azione sconosciuta non disponibile", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const occ = await occurrence(id);
    await say(deps, "/nuovo");
    expect(await count("conversation_state")).toBe(1);
    await press(deps, `t:f:${occ.id}`);
    expect((await occurrence(id)).status).toBe("fatto");
    expect(await count("conversation_state")).toBe(1);
    await press(deps, "t:x:1");
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
  });

  it("FR-007a: 12 compleanni oggi → 10 reminder + un messaggio lista con gli altri 2, senza tastiera", async () => {
    for (let i = 1; i <= 12; i++) await insertPerson({ fullName: `P${String(i).padStart(2, "0")}`, day: 28, month: 10, year: 2000 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const msgs = deps.tg.messages();
    expect(msgs).toHaveLength(11);
    expect(msgs.slice(0, 10).every((m) => labels(m.keyboard).includes("Fatto ✅"))).toBe(true);
    expect(msgs[9]!.text).toContain("P10");
    const list = msgs[10]!;
    expect(list.keyboard).toBeUndefined();
    expect(list.text.split("\n").slice(0, 2)).toEqual([T.todayOthers, ""]);
    expect(monoParts(list).map((s) => s.trimEnd())).toEqual(["Mer 28/10  P11 (26)", "Mer 28/10  P12 (26)"]);
    expect(commandParts(list)).toHaveLength(2);
  });

  it("FR-008: nessun compleanno oggi → tutte le persone del prossimo giorno in formato lista", async () => {
    const a = await insertPerson({ fullName: "Anna Bianchi", nickname: "Anna", day: 30, month: 10, year: 1998 });
    const b = await insertPerson({ fullName: "Bruno", day: 30, month: 10 });
    await insertPerson({ fullName: "Carla", day: 5, month: 11 });
    const deps = makeDeps();
    await say(deps, "/oggi");
    const [msg] = deps.tg.messages();
    expect(deps.tg.messages()).toHaveLength(1);
    expect(msg!.text).toBe(`${T.todayNone}\n\nVen 30/10  Anna (28)  /p_${a}\nVen 30/10  Bruno      /p_${b}`);
    expect(msg!.keyboard).toBeUndefined();
    expect(commandParts(msg!)).toEqual([`/p_${a}`, `/p_${b}`]);
    expect(await count("occurrences")).toBe(0);
  });

  it("FR-008: nessuna persona → testo dedicato", async () => {
    const deps = makeDeps();
    await say(deps, "/oggi");
    expect(deps.tg.messages().map((m) => m.text)).toEqual([
      T.todayNoPersons,
    ]);
  });

  it("RF-16, research R-06: occorrenza creata da /oggi e mai toccata → non confermato a D+2", async () => {
    const id = await insertPerson({ fullName: "Marco Rossi", day: 28, month: 10, createdAt: "2026-10-28T21:00:00.000Z" });
    const deps = makeCronDeps({ now: new Date("2026-10-28T21:30:00.000Z") });
    await say(deps, "/oggi");
    expect((await occurrence(id)).status).toBe("aperta");
    await runAt(deps, 2026, 10, 30, 0);
    expect((await occurrence(id)).status).toBe("non_confermato");
  });

  it("FR-012 di 002, BR-04: il 28/02/2027 il nato il 29/02 riceve il reminder con la nota", async () => {
    const id = await insertPerson({ fullName: "Leo", day: 29, month: 2, year: 2004 });
    const deps = makeDeps({ now: new Date("2027-02-28T10:00:00.000Z") });
    await say(deps, "/oggi");
    expect(deps.tg.lastText()).toBe(T.reminderTitle("Leo", null, 23, true));
    const [o] = await rows<{ year: number; effective_date: string }>("SELECT year, effective_date FROM occurrences WHERE person_id = ?", id);
    expect(o).toEqual({ year: 2027, effective_date: "2027-02-28" });
    expect(buttons(deps.tg.lastKeyboard()).map(([, v]) => v)).toContain(`t:f:${(await rows<{ id: number }>("SELECT id FROM occurrences"))[0]!.id}`);
  });
});
