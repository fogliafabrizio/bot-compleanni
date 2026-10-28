import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { T } from "../../src/texts";
import { addHours } from "../../src/time";
import { NOW, OWNER_ID } from "../helpers/constants";
import { localInstant, runAt } from "../helpers/cron";
import { csvOf, syntheticBackup, syntheticRows } from "../helpers/csv-fixtures";
import { count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeCronDeps, makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";
import { seedFullData } from "../helpers/seed";

const MSG_ID = 777;

async function snapshot() {
  return {
    persons: await rows("SELECT * FROM persons ORDER BY id"),
    groups: await rows("SELECT * FROM groups ORDER BY id"),
    personGroups: await rows("SELECT * FROM person_groups ORDER BY person_id, group_id"),
    occurrences: await rows("SELECT id, person_id, year, effective_date, status, outcome_at FROM occurrences ORDER BY id"),
    defaultMessage: await rows("SELECT value FROM settings WHERE key = 'default_message'"),
  };
}

async function flowStep(): Promise<string | undefined> {
  return (await rows<{ step: string }>("SELECT step FROM conversation_state WHERE flow = 'ripristina'"))[0]?.step;
}

async function backupText(deps: TestDeps): Promise<string> {
  await say(deps, "/backup");
  return deps.tg.documents().at(-1)!.text;
}

async function toConfirm2(deps: TestDeps, content: string): Promise<void> {
  await say(deps, "/ripristina");
  await sendFile(deps, "backup.json", content);
  await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnContinue), MSG_ID);
}

async function restore(deps: TestDeps, content: string): Promise<void> {
  await toConfirm2(deps, content);
  await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnRestore), MSG_ID);
}

describe("US2: /ripristina (RF-26, RNF-05, FR-018…FR-021)", () => {
  it("RF-26, RNF-05, FR-019, FR-020: file valido → due conferme → dati sostituiti e riepilogo", async () => {
    await insertPerson({ fullName: "Da Sostituire", day: 1, month: 1 });
    await insertGroup("Vecchio");
    const deps = makeDeps();
    await say(deps, "/ripristina");
    expect(deps.tg.lastText()).toBe("Inviami il file JSON di backup da ripristinare.");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Annulla"]);

    await say(deps, "ciao");
    expect(deps.tg.lastText()).toContain(T.waitingBackupFile);
    expect(await flowStep()).toBe("file");

    // 01/11/2026 00:30 a Roma = 31/10 23:30 UTC; 301 × 4 = 1.204 occorrenze.
    const b = syntheticBackup({ persons: 301, occurrencesPerPerson: 4, createdAt: "2026-10-31T23:30:00.000Z" });
    await sendFile(deps, "backup.json", JSON.stringify(b));
    expect(deps.tg.lastText()).toBe(
      "Backup del 01/11/2026: 301 persone, 2 gruppi, 1.204 occorrenze.\nDati attuali che verranno sostituiti: 1 persone, 1 gruppi, 0 occorrenze.",
    );
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Continua", "Annulla"]);

    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnContinue), MSG_ID);
    expect(deps.tg.edits().at(-1)).toMatchObject({ messageId: MSG_ID, keyboard: { inline_keyboard: [] } });
    expect(deps.tg.lastText()).toBe(T.restoreConfirm2);
    expect(deps.tg.lastText()).toContain("⚠️");
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Sì, ripristina", "Annulla"]);
    expect(await count("persons")).toBe(1);

    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnRestore), MSG_ID + 1);
    expect(deps.tg.lastText()).toBe("Ripristino completato: 301 persone, 2 gruppi, 1.204 occorrenze.\nMessaggio di auguri standard: quello iniziale");
    expect(deps.tg.edits().at(-1)).toMatchObject({ messageId: MSG_ID + 1, keyboard: { inline_keyboard: [] } });
    expect(await count("persons")).toBe(301);
    expect(await count("groups")).toBe(2);
    expect(await count("occurrences")).toBe(1204);
    expect(await count("conversation_state")).toBe(0);
    expect(await count("persons", "full_name = 'Da Sostituire'")).toBe(0);
  });

  it("RNF-11: /p_<id> del backup apre la stessa persona", async () => {
    const deps = makeDeps();
    await restore(deps, JSON.stringify(syntheticBackup({ persons: 5, occurrencesPerPerson: 0 })));
    await say(deps, "/p_4");
    expect(deps.tg.lastText()).toContain("Persona 004");
  });

  it("SC-005, RNF-11: backup → modifiche → ripristino → dati identici, deliveries vuota, id nuovi maggiori", async () => {
    await seedFullData();
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', '2026-10:inviato', ?)").bind(NOW.toISOString()).run();
    const deps = makeDeps();
    const file = await backupText(deps);
    const before = await snapshot();

    const newId = await insertPerson({ fullName: "Nuova Dopo Backup", day: 3, month: 3 });
    await env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = 1").run();
    await env.DB.prepare("UPDATE occurrences SET status = 'fatto' WHERE id = 2").run();
    await env.DB.prepare("UPDATE settings SET value = 'Altro {nome}' WHERE key = 'default_message'").run();

    await restore(deps, file);
    expect(deps.tg.lastText()).toBe("Ripristino completato: 3 persone, 2 gruppi, 3 occorrenze.\nMessaggio di auguri standard: personalizzato");
    expect(await snapshot()).toEqual(before);
    expect(await count("deliveries")).toBe(0);
    expect((await rows<{ value: string }>("SELECT value FROM settings WHERE key = 'auto_backup'"))[0]?.value).toBe("2026-10:inviato");
    const later = await insertPerson({ fullName: "Dopo Ripristino", day: 4, month: 4 });
    expect(later).toBeGreaterThan(newId);
  });

  it("FR-021: Annulla a conferma1 e a conferma2, /annulla, CSV inviato, 24 ore → dati invariati", async () => {
    await seedFullData();
    const deps = makeDeps();
    const file = await backupText(deps);
    await env.DB.prepare("UPDATE groups SET name = 'Parenti', name_norm = 'parenti' WHERE id = 1").run();
    const changed = await snapshot();

    await say(deps, "/ripristina");
    await sendFile(deps, "backup.json", file);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Annulla"));
    expect(deps.tg.lastText()).toBe(T.cancelled);
    expect(await snapshot()).toEqual(changed);

    await toConfirm2(deps, file);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Annulla"));
    expect(await snapshot()).toEqual(changed);

    await toConfirm2(deps, file);
    const restoreCb = cbOf(deps.tg.lastKeyboard(), T.btnRestore);
    await say(deps, "/annulla");
    await press(deps, restoreCb);
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(await snapshot()).toEqual(changed);

    await toConfirm2(deps, file);
    const restoreCb2 = cbOf(deps.tg.lastKeyboard(), T.btnRestore);
    await sendFile(deps, "persone.csv", csvOf(syntheticRows(1)));
    await press(deps, restoreCb2);
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    await press(deps, cbOf(deps.tg.lastKeyboard(), "Annulla"));

    await toConfirm2(deps, file);
    deps.setNow(addHours(NOW, 24));
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnRestore));
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    expect(await snapshot()).toEqual(changed);
  });

  it("SC-006: file non valido → motivo, dati invariati, resta in file; un secondo file valido prosegue", async () => {
    await insertPerson({ fullName: "Resta", day: 1, month: 1 });
    const deps = makeDeps();
    await say(deps, "/ripristina");
    const bad = syntheticBackup({ persons: 2, occurrencesPerPerson: 1 });
    bad.version = 2 as 1;
    await sendFile(deps, "backup.json", JSON.stringify(bad));
    expect(deps.tg.lastText()).toContain("Versione del backup non supportata (2).");
    await sendFile(deps, "backup.json", "non è json");
    expect(deps.tg.lastText()).toContain("Il file non è un JSON valido.");
    expect(await flowStep()).toBe("file");
    expect(await count("persons")).toBe(1);
    await sendFile(deps, "backup.json", JSON.stringify(syntheticBackup({ persons: 2, occurrencesPerPerson: 1 })));
    expect(await flowStep()).toBe("conferma1");
  });

  it("FR-020: errore forzato nella batch di ripristino → dati precedenti intatti", async () => {
    await seedFullData();
    const before = await snapshot();
    const deps = makeDeps();
    await toConfirm2(deps, JSON.stringify(syntheticBackup({ persons: 3, occurrencesPerPerson: 1 })));
    const [st] = await rows<{ data: string }>("SELECT data FROM conversation_state");
    const data = JSON.parse(st!.data) as { backup: { persons: { birth_day: number }[] } };
    data.backup.persons[2]!.birth_day = 40; // viola il CHECK di persons.birth_day
    await env.DB.prepare("UPDATE conversation_state SET data = ?").bind(JSON.stringify(data)).run();
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnRestore));
    expect(deps.tg.lastText()).toBe(T.genericError);
    expect(await snapshot()).toEqual(before);
    expect(await flowStep()).toBe("conferma2");
  });

  it("FR-020a: occorrenza aperta con D+1 concluso → non_confermato senza messaggi; D = oggi resta aperta, solo slot futuri", async () => {
    const created = "2026-11-01T08:00:00.000Z";
    const b = syntheticBackup({ persons: 0, occurrencesPerPerson: 0, createdAt: created });
    const person = (id: number, name: string, day: number) => ({
      id,
      full_name: name,
      nickname: null,
      birth_day: day,
      birth_month: 11,
      birth_year: 1990,
      phone: null,
      instagram: null,
      telegram: null,
      priority: "alta" as const,
      custom_message: null,
      created_at: "2026-01-01T08:00:00.000Z",
      updated_at: "2026-01-01T08:00:00.000Z",
    });
    b.persons = [person(1, "Passata Cinque", 5), person(2, "Festa Oggi", 20)];
    b.occurrences = [
      { id: 1, person_id: 1, year: 2026, effective_date: "2026-11-05", status: "aperta", outcome_at: null, created_at: created },
      { id: 2, person_id: 2, year: 2026, effective_date: "2026-11-20", status: "aperta", outcome_at: null, created_at: created },
    ];
    const deps = makeCronDeps({ now: localInstant(2026, 11, 20, 11) });
    await restore(deps, JSON.stringify(b));
    const occ = await rows<{ id: number; status: string; outcome_at: string | null }>("SELECT id, status, outcome_at FROM occurrences ORDER BY id");
    expect(occ[0]).toMatchObject({ id: 1, status: "non_confermato" });
    expect(occ[0]!.outcome_at).not.toBeNull();
    expect(occ[1]).toMatchObject({ id: 2, status: "aperta", outcome_at: null });
    expect(deps.tg.messages().filter((m) => m.text.includes("compleanno"))).toEqual([]);
    deps.tg.reset();
    await runAt(deps, 2026, 11, 20, 13);
    expect(deps.tg.messages()).toHaveLength(1);
    expect(deps.tg.lastText()).toContain("Festa Oggi");
    expect(deps.tg.messages()[0]!.chatId).toBe(OWNER_ID);
  });
});
