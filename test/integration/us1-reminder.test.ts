import { describe, expect, it } from "vitest";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { runAt } from "../helpers/cron";
import { makeCronDeps, type TestCronDeps } from "../helpers/deps";
import { cbOf, copyOf, labels, urlOf } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";

// Oggi = 14/03/2027 (ora solare): 09:00 locali = 08:00 UTC.
const at = (deps: TestCronDeps, hour: number) => runAt(deps, 2027, 3, 14, hour);

const marco = {
  id: 1,
  fullName: "Marco Rossi",
  nickname: "Marchino",
  day: 14,
  month: 3,
  year: 1995,
  priority: "alta" as const,
};

async function occStatus(personId: number, year = 2027): Promise<{ status: string; outcome_at: string | null } | undefined> {
  return (await rows<{ status: string; outcome_at: string | null }>(
    "SELECT status, outcome_at FROM occurrences WHERE person_id = ? AND year = ?",
    personId,
    year,
  ))[0];
}

describe("US1: reminder del giorno", () => {
  it("RF-10, D-03: due persone lo stesso giorno → due messaggi separati con i propri pulsanti", async () => {
    await insertPerson(marco);
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 14, month: 3, priority: "alta" });
    const deps = makeCronDeps();
    await at(deps, 9);
    const msgs = deps.tg.messages();
    expect(msgs).toHaveLength(2);
    expect(msgs.every((m) => m.chatId === 1001)).toBe(true);
    expect(msgs[0]!.text).toContain("Marchino (Marco Rossi)");
    expect(msgs[1]!.text).toContain("Anna Bianchi");
    expect(cbOf(msgs[0]!.keyboard, "Fatto ✅")).not.toBe(cbOf(msgs[1]!.keyboard, "Fatto ✅"));
    // §5.3: un messaggio con tutti i dati.
    expect(msgs[0]!.text).toBe("🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni");
  });

  it("RF-10, BR-09: esito precedente non confermato → nessuna riga L'anno scorso; fatto → riga presente", async () => {
    await insertPerson(marco);
    await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 14, month: 3, priority: "alta" });
    await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "non_confermato" });
    await insertOccurrence({ personId: 2, year: 2026, effectiveDate: "2026-03-14", status: "fatto" });
    const deps = makeCronDeps();
    await at(deps, 9);
    const [m1, m2] = deps.tg.messages();
    expect(m1!.text).not.toContain("L'anno scorso");
    expect(m2!.text).toContain("L'anno scorso: fatto ✅");
  });

  it("RF-10: righe Gruppi e telefono", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    await addToGroup(1, await insertGroup("Beach tennis"));
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(deps.tg.lastText()).toBe(
      ["🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni", "Gruppi: Beach tennis", "📱 +393331234567"].join("\n"),
    );
  });

  it("RF-11: solo telefono e Instagram → WhatsApp, Instagram, Copia messaggio, niente Telegram", async () => {
    await insertPerson({ ...marco, phone: "+393331234567", instagram: "marco.rossi" });
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["WhatsApp", "Instagram", "Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
    expect(urlOf(deps.tg.lastKeyboard(), "Instagram")).toBe("https://ig.me/m/marco.rossi");
  });

  it("RF-11, BR-03, V-06: WhatsApp apre la chat con gli auguri senza età", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    const deps = makeCronDeps();
    await at(deps, 9);
    const url = urlOf(deps.tg.lastKeyboard(), "WhatsApp");
    expect(url).toBe("https://wa.me/393331234567?text=Tanti%20auguri%20Marchino!%20%F0%9F%8E%89");
    expect(decodeURIComponent(url)).not.toContain("32");
  });

  it("RF-11: senza telefono niente WhatsApp né riga del numero", async () => {
    await insertPerson({ ...marco, telegram: "marcor" });
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(labels(deps.tg.lastKeyboard())).not.toContain("WhatsApp");
    expect(labels(deps.tg.lastKeyboard())).toContain("Telegram");
    expect(deps.tg.lastText()).not.toContain("📱");
  });

  it("RF-11, FR-005: US1-7 il reminder mantiene WhatsApp con gli auguri e Copia messaggio", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(urlOf(deps.tg.lastKeyboard(), "WhatsApp")).toContain("?text=");
    expect(labels(deps.tg.lastKeyboard())).toContain("Copia messaggio");
  });

  it("FR-002, Q5: username Telegram non valido → pulsante Telegram assente nel reminder", async () => {
    await insertPerson({ ...marco, telegram: "abc" });
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
  });

  it("FR-029, V-05: Copia messaggio copia gli auguri della persona", async () => {
    await insertPerson({ ...marco, customMessage: "Buon compleanno {nome}!" });
    const deps = makeCronDeps();
    await at(deps, 9);
    expect(copyOf(deps.tg.lastKeyboard(), "Copia messaggio")).toBe("Buon compleanno Marchino!");
  });

  it("RF-12, BR-07: Fatto → fatto con outcome_at, aggiornato solo il messaggio premuto, nessun altro slot", async () => {
    await insertPerson({ ...marco, phone: "+393331234567" });
    const deps = makeCronDeps();
    await at(deps, 9);
    const sent = deps.tg.messages()[0]!;
    const messageId = 100;
    deps.setNow(new Date("2027-03-14T08:30:00.000Z"));
    await press(deps, cbOf(sent.keyboard, "Fatto ✅"), messageId);
    expect(await occStatus(1)).toEqual({ status: "fatto", outcome_at: "2027-03-14T08:30:00.000Z" });
    const [edit] = deps.tg.textEdits();
    expect(edit).toMatchObject({ chatId: 1001, messageId, text: `${sent.text}\n\n✅ Fatto` });
    expect(labels(edit!.keyboard)).toEqual(["WhatsApp", "Copia messaggio"]);
    expect(deps.tg.lastAnswer()).toBeUndefined();
    deps.tg.reset();
    for (const h of [13, 18, 21]) await at(deps, h);
    await runAt(deps, 2027, 3, 15, 13);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it("RF-12, BR-07: Salta quest'anno → saltato, stessi effetti", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 9);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Salta quest'anno"), 100);
    expect((await occStatus(1))?.status).toBe("saltato");
    expect(deps.tg.textEdits()[0]!.text.endsWith("\n\nSaltato")).toBe(true);
    deps.tg.reset();
    for (const h of [13, 18, 21]) await at(deps, h);
    await runAt(deps, 2027, 3, 15, 13);
    expect(deps.tg.messages()).toHaveLength(0);
  });

  it.each([
    ["alta", [9, 13, 18, 21]],
    ["media", [9, 13, 18]],
    ["bassa", [9, 18]],
  ] as const)("§7, SC-003 (giorno): priorità %s → slot %j", async (priority, slots) => {
    await insertPerson({ ...marco, priority });
    const deps = makeCronDeps();
    const got: number[] = [];
    for (let h = 0; h < 24; h++) {
      const before = deps.tg.messages().length;
      await at(deps, h);
      if (deps.tg.messages().length > before) got.push(h);
    }
    expect(got).toEqual(slots);
  });

  it("FR-015: secondo Fatto su un altro reminder della stessa occorrenza → esito invariato, nessun edit", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 9);
    await at(deps, 13);
    const [m9, m13] = deps.tg.messages();
    await press(deps, cbOf(m9!.keyboard, "Salta quest'anno"), 100);
    deps.tg.reset();
    await press(deps, cbOf(m13!.keyboard, "Fatto ✅"), 101);
    expect((await occStatus(1))?.status).toBe("saltato");
    expect(deps.tg.textEdits()).toHaveLength(0);
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
  });

  it("FR-018c: Fatto dopo l'eliminazione della persona → Persona non trovata", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 9);
    const cb = cbOf(deps.tg.lastKeyboard(), "Fatto ✅");
    await deps.db.prepare("DELETE FROM persons WHERE id = 1").run();
    await press(deps, cb, 100);
    expect(deps.tg.lastAnswer()).toBe("Persona non trovata");
    expect(deps.tg.textEdits()).toHaveLength(0);
  });

  it("FR-014: o:f costruito per un pre-reminder → esito invariato", async () => {
    await insertPerson({ ...marco, day: 15 });
    const deps = makeCronDeps();
    await at(deps, 13); // pre −1 per il 15/03
    const cb = cbOf(deps.tg.lastKeyboard(), "Salta quest'anno").replace("o:s:", "o:f:");
    await press(deps, cb, 100);
    expect((await occStatus(1))?.status).toBe("aperta");
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
  });

  it("contracts/callback-data.md: azione o: sconosciuta → Questa azione non è più disponibile", async () => {
    const deps = makeCronDeps();
    await press(deps, "o:x:1");
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
    await press(deps, "o:f");
    expect(deps.tg.lastAnswer()).toBe("Questa azione non è più disponibile");
  });

  it("R-11: un tocco o: durante /nuovo non annulla il flusso", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 9);
    const cb = cbOf(deps.tg.lastKeyboard(), "Fatto ✅");
    await say(deps, "/nuovo");
    await press(deps, cb, 100);
    expect(await count("conversation_state")).toBe(1);
    expect((await occStatus(1))?.status).toBe("fatto");
    await say(deps, "Anna Bianchi");
    expect(deps.tg.lastText()).toBe("Nickname? (come lo chiami nei messaggi)");
  });

  it("principio II: un tocco Fatto costa 3 subrequest", async () => {
    await insertPerson(marco);
    const deps = makeCronDeps();
    await at(deps, 9);
    const cb = cbOf(deps.tg.lastKeyboard(), "Fatto ✅");
    deps.counter.count = 0;
    deps.tg.reset();
    await press(deps, cb, 100);
    expect(deps.counter.count + deps.tg.calls.length).toBe(3);
  });
});
