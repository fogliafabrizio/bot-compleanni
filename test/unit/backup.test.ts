import { describe, expect, it } from "vitest";
import { buildBackup, encodeBackup, parseBackup, type BackupData, type BackupV1 } from "../../src/domain/backup";
import { syntheticBackup } from "../helpers/csv-fixtures";

const TODAY = { year: 2026, month: 10, day: 28 };
const ISO = "2026-10-01T08:00:00.000Z";

const DATA: BackupData = {
  persons: [
    {
      id: 3,
      full_name: "Marco Rossi",
      nickname: "Marchino",
      birth_day: 29,
      birth_month: 2,
      birth_year: null,
      phone: "+393331234567",
      instagram: "marco.ig",
      telegram: null,
      priority: "alta",
      custom_message: "Auguri {nome}!",
      created_at: ISO,
      updated_at: ISO,
    },
  ],
  groups: [{ id: 5, name: "Famiglia" }],
  person_groups: [{ person_id: 3, group_id: 5 }],
  occurrences: [
    { id: 9, person_id: 3, year: 2026, effective_date: "2026-02-28", status: "fatto", outcome_at: ISO, created_at: ISO },
  ],
  default_message: "Ciao {nome}",
};

const bytes = (v: unknown) => new TextEncoder().encode(typeof v === "string" ? v : JSON.stringify(v));

function reasonOf(mutate: (b: BackupV1) => void): string {
  const b = structuredClone(buildBackup(DATA, ISO));
  mutate(b);
  const r = parseBackup(bytes(b), TODAY);
  if (r.ok) throw new Error("atteso un rifiuto");
  return r.reason;
}

describe("RF-26, R-08: costruzione del backup", () => {
  it("FR-017: chiavi dello schema v1, nessuna colonna derivata, JSON compatto", () => {
    const withNorm = { ...DATA, persons: DATA.persons.map((p) => ({ ...p, full_name_norm: "x" })) };
    const b = buildBackup(withNorm, ISO);
    expect(Object.keys(b)).toEqual(["format", "version", "created_at", "persons", "groups", "person_groups", "occurrences", "settings"]);
    expect(b.persons[0]).not.toHaveProperty("full_name_norm");
    const text = new TextDecoder().decode(encodeBackup(b));
    expect(text.startsWith('{"format":"bot-compleanni-backup","version":1,')).toBe(true);
    expect(text).not.toContain("\n");
    expect(text).not.toContain("name_norm");
    expect(text).not.toContain("deliveries");
    expect(text).not.toContain("auto_backup");
  });

  it("RNF-11: parseBackup(buildBackup(x)) restituisce la forma normalizzata", () => {
    const r = parseBackup(encodeBackup(buildBackup(DATA, ISO)), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.persons[0]).toEqual({ ...DATA.persons[0], full_name_norm: "marco rossi" });
    expect(r.backup.groups).toEqual([{ id: 5, name: "Famiglia", name_norm: "famiglia" }]);
    expect(r.backup.occurrences).toEqual(DATA.occurrences);
    expect(r.backup.settings).toEqual({ default_message: "Ciao {nome}" });
  });

  it("RNF-11: un backup sintetico grande è valido", () => {
    expect(parseBackup(bytes(syntheticBackup({ persons: 200, occurrencesPerPerson: 10 })), TODAY).ok).toBe(true);
  });
});

describe("FR-018, SC-006: validazione", () => {
  it.each([
    ["testo non JSON", "ciao"],
    ["JSON troncato", '{"format":'],
  ])("SC-006: %s → JSON non valido", (_l, text) => {
    expect(parseBackup(bytes(text), TODAY)).toEqual({ ok: false, reason: "Il file non è un JSON valido." });
  });

  it("SC-006: byte non UTF-8 → JSON non valido", () => {
    expect(parseBackup(new Uint8Array([0x7b, 0xe0, 0x7d]), TODAY)).toEqual({ ok: false, reason: "Il file non è un JSON valido." });
  });

  it.each([
    ["format diverso", (b: BackupV1) => Object.assign(b, { format: "altro" })],
    ["format mancante", (b: BackupV1) => Object.assign(b, { format: undefined })],
    ["persons mancante", (b: BackupV1) => Object.assign(b, { persons: undefined })],
    ["occurrences non lista", (b: BackupV1) => Object.assign(b, { occurrences: {} })],
    ["settings mancante", (b: BackupV1) => Object.assign(b, { settings: undefined })],
  ])("SC-006: %s → non è un backup di questo bot", (_l, mutate) => {
    expect(reasonOf(mutate)).toBe("Il file non è un backup di questo bot.");
  });

  it("SC-006: version 2 → versione non supportata", () => {
    expect(reasonOf((b) => Object.assign(b, { version: 2 }))).toBe("Versione del backup non supportata (2).");
  });

  it.each([
    ["full_name", (b: BackupV1) => (b.persons[0]!.full_name = "x".repeat(61))],
    ["birth_day", (b: BackupV1) => Object.assign(b.persons[0]!, { birth_day: 31, birth_month: 4 })],
    ["birth_day", (b: BackupV1) => Object.assign(b.persons[0]!, { birth_day: 29, birth_month: 2, birth_year: 1995 })],
    ["phone", (b: BackupV1) => (b.persons[0]!.phone = "3331234567")],
    ["instagram", (b: BackupV1) => (b.persons[0]!.instagram = "@marco")],
    ["priority", (b: BackupV1) => Object.assign(b.persons[0]!, { priority: "altissima" })],
    ["custom_message", (b: BackupV1) => (b.persons[0]!.custom_message = "m".repeat(257))],
    ["birth_year", (b: BackupV1) => Object.assign(b.persons[0]!, { birth_year: "1990" })],
  ])("SC-006: persona con campo %s non valido", (field, mutate) => {
    expect(reasonOf(mutate)).toBe(`Backup non valido: persona 3, campo ${field}.`);
  });

  it("SC-006: gruppo con nome > 30", () => {
    expect(reasonOf((b) => (b.groups[0]!.name = "g".repeat(31)))).toBe("Backup non valido: gruppo 5, campo name.");
  });

  it("SC-006: status sconosciuto ed effective_date non reale", () => {
    expect(reasonOf((b) => Object.assign(b.occurrences[0]!, { status: "boh" }))).toBe("Backup non valido: occorrenza 9, campo status.");
    expect(reasonOf((b) => (b.occurrences[0]!.effective_date = "2026-02-30"))).toBe(
      "Backup non valido: occorrenza 9, campo effective_date.",
    );
  });

  it("SC-006: id ripetuto", () => {
    expect(reasonOf((b) => b.persons.push({ ...b.persons[0]!, full_name: "Altro" }))).toBe("Backup non valido: persona 3 ripetuta.");
    expect(reasonOf((b) => b.groups.push({ id: 5, name: "Amici" }))).toBe("Backup non valido: gruppo 5 ripetuto.");
  });

  it("SC-006: gruppi Famiglia/famiglia", () => {
    expect(reasonOf((b) => b.groups.push({ id: 6, name: "famiglia" }))).toBe("Backup non valido: gruppi con lo stesso nome.");
  });

  it("SC-006: appartenenza verso gruppo inesistente, occorrenza verso persona inesistente", () => {
    expect(reasonOf((b) => b.person_groups.push({ person_id: 3, group_id: 77 }))).toBe(
      "Backup non valido: riferimento a gruppo 77 inesistente.",
    );
    expect(reasonOf((b) => (b.occurrences[0]!.person_id = 88))).toBe("Backup non valido: riferimento a persona 88 inesistente.");
  });

  it("SC-006: due occorrenze per la stessa persona e anno", () => {
    expect(reasonOf((b) => b.occurrences.push({ ...b.occurrences[0]!, id: 10 }))).toBe(
      "Backup non valido: occorrenze ripetute per la persona 3.",
    );
  });

  it("SC-006: default_message non valido", () => {
    expect(reasonOf((b) => (b.settings.default_message = "m".repeat(300)))).toBe(
      "Backup non valido: impostazioni, campo default_message.",
    );
  });

  it("principio V: i messaggi non contengono valori personali", () => {
    const reasons = [
      reasonOf((b) => (b.persons[0]!.full_name = `Marco Rossi ${"x".repeat(60)}`)),
      reasonOf((b) => (b.persons[0]!.phone = "333")),
      reasonOf((b) => (b.persons[0]!.birth_day = 31)),
    ];
    for (const r of reasons) {
      for (const s of ["Marco", "Rossi", "333", "29", "31/02"]) expect(r).not.toContain(s);
    }
  });
});
