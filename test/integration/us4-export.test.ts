import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { T } from "../../src/texts";
import { OWNER_ID } from "../helpers/constants";
import { BOM } from "../helpers/csv-fixtures";
import { addToGroup, count, insertGroup, insertOccurrence, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf } from "../helpers/fake-telegram";
import { press, say, sendFile } from "../helpers/send";

const HEADER = "nome;nickname;data;telefono;instagram;telegram;gruppi;priorita;messaggio";

async function seed(): Promise<void> {
  await insertPerson({
    id: 1,
    fullName: "Marco Rossi",
    nickname: "Marchino",
    day: 14,
    month: 3,
    year: 1985,
    phone: "+393331234567",
    instagram: "marco.ig",
    telegram: "marco_tg",
    priority: "alta",
    customMessage: "Auguri {nome}!",
  });
  await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 29, month: 2, priority: "bassa" });
  await insertPerson({ id: 5, fullName: 'Rossi; "Il Boss"', day: 1, month: 12, year: 1970 });
  const u = await insertGroup("Università");
  const a = await insertGroup("amici");
  const f = await insertGroup("Famiglia");
  await addToGroup(1, u);
  await addToGroup(1, a);
  await addToGroup(1, f);
  await addToGroup(2, f);
  await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "fatto" });
}

async function exportText(deps: TestDeps): Promise<string> {
  await say(deps, "/export");
  return deps.tg.documents().at(-1)!.text;
}

const domain = async () => ({
  persons: await rows(
    `SELECT full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, phone, instagram, telegram, priority,
       custom_message FROM persons ORDER BY full_name`,
  ),
  memberships: await rows(
    `SELECT p.full_name, g.name FROM person_groups pg JOIN persons p ON p.id = pg.person_id JOIN groups g ON g.id = pg.group_id
     ORDER BY p.full_name, g.name`,
  ),
  groups: await rows("SELECT name, name_norm FROM groups ORDER BY name"),
});

describe("US4: /export (RF-25, FR-016)", () => {
  it("RF-25, FR-016: /export invia compleanni-export-2026-10-28.csv con BOM, ';' e una riga per persona in ordine di id", async () => {
    await seed();
    const deps = makeDeps();
    const text = await exportText(deps);
    const [doc] = deps.tg.documents();
    expect(doc).toMatchObject({ chatId: OWNER_ID, name: "compleanni-export-2026-10-28.csv", mimeType: "text/csv; charset=utf-8" });
    expect(doc!.caption).toBe("Export di 3 persone.");
    expect(text).toBe(
      [
        `${BOM}${HEADER}`,
        "Marco Rossi;Marchino;14/03/1985;+39 3331234567;marco.ig;marco_tg;amici|Famiglia|Università;alta;Auguri {nome}!",
        "Anna Bianchi;;29/02;;;;Famiglia;bassa;",
        '"Rossi; ""Il Boss""";;01/12/1970;;;;;media;',
        "",
      ].join("\r\n"),
    );
    // Nessuno storico (RF-25).
    expect(text).not.toContain("fatto");
  });

  it("RF-25: 0 persone → sola intestazione e caption Export di 0 persone.", async () => {
    const deps = makeDeps();
    expect(await exportText(deps)).toBe(`${BOM}${HEADER}\r\n`);
    expect(deps.tg.documents()[0]!.caption).toBe(T.exportCaption(0));
    expect(T.exportCaption(0)).toBe("Export di 0 persone.");
  });

  it("SC-004: export → svuota → reimport: tutte nuove, zero errori, persone e gruppi identici", async () => {
    await seed();
    const before = await domain();
    const deps = makeDeps();
    const file = await exportText(deps);
    await env.DB.batch([env.DB.prepare("DELETE FROM persons"), env.DB.prepare("DELETE FROM groups")]);
    await sendFile(deps, "compleanni-export-2026-10-28.csv", file);
    expect(deps.tg.lastText()).toBe("Anteprima import\n3 persone nuove\nGruppi da creare: amici, Famiglia, Università");
    await press(deps, cbOf(deps.tg.lastKeyboard(), T.btnImport));
    expect(deps.tg.lastText()).toBe("Importate 3 persone, creati 3 gruppi.");
    expect(await domain()).toEqual(before);
  });

  it("BR-14: export reinviato sulla stessa istanza → tutte duplicate", async () => {
    await seed();
    const deps = makeDeps();
    const file = await exportText(deps);
    await sendFile(deps, "export.csv", file);
    expect(deps.tg.lastText()).toContain("0 persone nuove\n3 duplicati (saltati):");
    expect(deps.tg.lastKeyboard()).toBeUndefined();
    expect(await count("persons")).toBe(3);
  });
});
