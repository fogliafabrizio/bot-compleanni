import { bench, describe } from "vitest";
import { plainLine, splitMessage } from "../src/bot/liste";
import { CSV_COLUMNS, IMPORT_MAX_ROWS, RECEIVED_FILE_MAX_BYTES } from "../src/config";
import { buildBackup, encodeBackup, parseBackup, type BackupData, type NormalizedBackup } from "../src/domain/backup";
import { decodeUtf8, parseCsv, writeCsv } from "../src/domain/csv";
import { buildPreview, exportRow, importState, mapHeader, previewText, type ExportPerson } from "../src/domain/import";
import type { LocalDate } from "../src/time";
import { csvOf, syntheticBackup, syntheticRows } from "../test/helpers/csv-fixtures";

// Parti pure di import, backup ed export (research R-12 di 004). Soglia: < 3 ms per iterazione sui
// casi da ~200 persone, < 8 ms sui casi alla dimensione massima accettata (1 MiB). Solo dati sintetici.

const today: LocalDate = { year: 2026, month: 10, day: 28 };
const enc = new TextEncoder();

// Percorso dell'invio di un CSV: decodifica, parsing, validazione, anteprima, stato.
function importPath(bytes: Uint8Array): void {
  const d = decodeUtf8(bytes);
  if (!d.ok) throw new Error("scenario non valido");
  const parsed = parseCsv(d.text, IMPORT_MAX_ROWS);
  if ("tooManyRows" in parsed) throw new Error("scenario non valido");
  const [header, ...records] = parsed.records;
  const map = mapHeader(header!.cells);
  if (!map.ok) throw new Error("scenario non valido");
  const preview = buildPreview(records, map.map, [], [{ name: "Famiglia", nameNorm: "famiglia" }], today);
  splitMessage(previewText(preview).map(plainLine));
  JSON.stringify(importState(preview));
}

function withGroups(rows: string[][]): string[][] {
  return rows.map((r, i) => {
    const out = [...r];
    out[3] = `333 ${1000000 + i}`;
    out[6] = i % 3 === 0 ? "Famiglia|Calcetto" : "Amici";
    out[8] = i % 5 === 0 ? "Tanti auguri {nome}!" : "";
    return out;
  });
}

const csv200 = enc.encode(csvOf(withGroups(syntheticRows(200))));
const csv500 = enc.encode(csvOf(withGroups(syntheticRows(500))));

// 500 righe al limite: metà con celle lunghe (errori), metà con 8 gruppi nuovi, ~1 MiB.
const longCell = (c: string) => c.repeat(540);
const csvMax = enc.encode(
  csvOf(
    Array.from({ length: 500 }, (_, i) => {
      if (i % 2 === 1) return [longCell("n"), longCell("k"), longCell("9"), longCell("t"), "", "", longCell("g"), longCell("p"), longCell("m")];
      const groups = Array.from({ length: 8 }, (_, j) => `Gruppo con nome lungo n. ${String(i * 8 + j).padStart(5, "0")}`);
      return [`Persona ${i}`, "", `${(i % 28) + 1}/${(Math.floor(i / 28) % 12) + 1}/1990`, "", "", "", groups.join("|"), "", ""];
    }),
  ),
);

const backup200 = syntheticBackup({ persons: 200, occurrencesPerPerson: 10 });
const data200: BackupData = { ...backup200, default_message: null };
const backup200Bytes = encodeBackup(backup200);
const backupMaxBytes = encodeBackup(syntheticBackup({ persons: 200, occurrencesPerPerson: 29 }));
const backupMaxParsed = parseBackup(backupMaxBytes, today);
if (!backupMaxParsed.ok) throw new Error("scenario non valido");
const backupMaxState = JSON.stringify({ backup: backupMaxParsed.backup, counts: { persons: 0, groups: 0, occurrences: 0 } });

const exportPeople: ExportPerson[] = backup200.persons.map((p) => ({
  fullName: p.full_name,
  nickname: p.nickname,
  birthDay: p.birth_day,
  birthMonth: p.birth_month,
  birthYear: p.birth_year,
  phone: p.phone,
  instagram: p.instagram,
  telegram: p.telegram,
  priority: p.priority,
  customMessage: p.custom_message,
}));

if (csvMax.byteLength > RECEIVED_FILE_MAX_BYTES || csvMax.byteLength < 0.9 * RECEIVED_FILE_MAX_BYTES) {
  throw new Error(`CSV massimo fuori misura: ${csvMax.byteLength}`);
}
if (backupMaxBytes.byteLength > RECEIVED_FILE_MAX_BYTES || backupMaxBytes.byteLength < 0.9 * RECEIVED_FILE_MAX_BYTES) {
  throw new Error(`backup massimo fuori misura: ${backupMaxBytes.byteLength}`);
}

describe("research R-12 (004): import CSV", () => {
  bench("import 200 righe", () => importPath(csv200));
  bench("import 500 righe", () => importPath(csv500));
  bench("import 500 righe da ~1 MiB, anteprima al tetto", () => importPath(csvMax));
});

describe("research R-12 (004): backup", () => {
  bench("backup 200 persone + 2000 occorrenze", () => {
    encodeBackup(buildBackup(data200, "2026-11-01T08:00:00.000Z"));
  });
  bench("validazione backup 200 persone + 2000 occorrenze", () => {
    if (!parseBackup(backup200Bytes, today).ok) throw new Error("scenario non valido");
  });
  // Le due invocazioni più pesanti del flusso ripristina, misurate separatamente come avvengono.
  bench("invio del JSON da ~1 MiB: validazione + salvataggio dello stato", () => {
    const r = parseBackup(backupMaxBytes, today);
    if (!r.ok) throw new Error("scenario non valido");
    JSON.stringify({ backup: r.backup, counts: { persons: 0, groups: 0, occurrences: 0 } });
  });
  bench("Sì, ripristina con ~1 MiB: lettura dello stato + parametri json_each", () => {
    const state = JSON.parse(backupMaxState) as { backup: NormalizedBackup };
    for (const list of [state.backup.groups, state.backup.persons, state.backup.person_groups, state.backup.occurrences]) JSON.stringify(list);
  });
});

describe("research R-12 (004): export", () => {
  bench("export 200 persone", () => {
    writeCsv([CSV_COLUMNS, ...exportPeople.map((p, i) => exportRow(p, i % 2 === 0 ? ["Famiglia", "Amici"] : []))]);
  });
});
