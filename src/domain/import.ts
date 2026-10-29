import {
  CSV_COLUMNS,
  CSV_GROUP_SEPARATOR,
  CSV_REQUIRED_COLUMNS,
  DEFAULT_PRIORITY,
  IMPORT_ERROR_VALUE_MAX,
  PREVIEW_GROUPS_PER_LINE,
  TEXT_LIMITS,
  type CsvColumn,
  type Priority,
} from "../config";
import { CSV_EXAMPLE_ROW, T } from "../texts";
import type { LocalDate } from "../time";
import type { CsvRecord } from "./csv";
import { formatShort, parseBirthDate } from "./date";
import { validateGreeting } from "./greeting";
import { normalizePhone } from "./phone";
import { cleanText, hasValidGroupKey, normKey, searchKey, sortNames } from "./text";
import { normalizeUsername } from "./username";

// Validazione delle righe, duplicati, gruppi e anteprima dell'import CSV (contracts/csv.md,
// contracts/flussi.md, research R-04, R-05, R-06). Puro: nessun import di cloudflare:*, db/ o bot/.

export interface ImportGroup {
  name: string;
  nameNorm: string;
}

export interface ImportRow {
  // Numero di riga del foglio (FR-009).
  line: number;
  fullName: string;
  fullNameNorm: string;
  nickname: string | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  // E.164.
  phone: string | null;
  // Senza "@".
  instagram: string | null;
  telegram: string | null;
  priority: Priority;
  customMessage: string | null;
  // Già senza vuoti e ripetuti.
  groups: ImportGroup[];
}

export interface ExistingKey {
  fullNameNorm: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
}

export interface Preview {
  rows: ImportRow[];
  duplicates: { line: number; fullName: string; date: string }[];
  errors: { line: number; reasons: string[] }[];
  exampleSkipped: boolean;
  // Grafia della prima riga importata che li usa.
  groupsToCreate: string[];
}

// Stato del flusso `import`, step `anteprima` (data-model.md).
export interface ImportState {
  rows: ImportRow[];
  preview: {
    newCount: number;
    duplicateCount: number;
    errorCount: number;
    exampleSkipped: boolean;
    groupsToCreate: string[];
  };
}

export type HeaderMap = { columns: Partial<Record<CsvColumn, number>>; width: number };

// BR-18: celle confrontate senza spazi ai bordi, maiuscole e accenti; ordine libero; colonne
// opzionali assenti ammesse. Le celle vuote in coda all'intestazione non contano.
export function mapHeader(cells: readonly string[]): { ok: true; map: HeaderMap } | { ok: false } {
  const keys = cells.map((c) => searchKey(c.trim()));
  let width = keys.length;
  while (width > 0 && keys[width - 1] === "") width--;
  const columns: Partial<Record<CsvColumn, number>> = {};
  for (let i = 0; i < width; i++) {
    const key = keys[i] as CsvColumn;
    if (!(CSV_COLUMNS as readonly string[]).includes(key) || columns[key] !== undefined) return { ok: false };
    columns[key] = i;
  }
  if (CSV_REQUIRED_COLUMNS.some((c) => columns[c] === undefined)) return { ok: false };
  return { ok: true, map: { columns, width } };
}

// Valori citati nei motivi accorciati a IMPORT_ERROR_VALUE_MAX code point (chiarimento 2026-10-29).
export function truncateValue(v: string): string {
  if (v.length <= IMPORT_ERROR_VALUE_MAX) return v;
  let out = "";
  let n = 0;
  for (const ch of v) {
    if (n === IMPORT_ERROR_VALUE_MAX) return `${out}…`;
    out += ch;
    n++;
  }
  return v;
}

const PRIORITIES: readonly Priority[] = ["alta", "media", "bassa"];

// BR-20: gruppi separati da "|", vuoti ignorati, ripetuti (normKey) contati una volta.
function parseGroups(cell: string): { groups: ImportGroup[]; tooLong: string | null } {
  const groups: ImportGroup[] = [];
  let tooLong: string | null = null;
  for (const part of cell.split(CSV_GROUP_SEPARATOR)) {
    const r = cleanText(part, TEXT_LIMITS.groupName);
    if (!r.ok) {
      if (r.reason === "too_long" && tooLong === null) tooLong = part.trim();
      continue;
    }
    const nameNorm = normKey(r.value);
    if (!groups.some((g) => g.nameNorm === nameNorm)) groups.push({ name: r.value, nameNorm });
  }
  return { groups, tooLong };
}

// FR-006, FR-010: stesse funzioni del guidato; tutti i campi non validi, al massimo un motivo per campo.
// `knownGroups` (name_norm dei gruppi esistenti): i gruppi da creare seguono FR-006a, quelli
// esistenti si associano anche se fuori regola (FR-016).
export function validateRecord(
  record: CsvRecord,
  map: HeaderMap,
  today: LocalDate,
  knownGroups: ReadonlySet<string> = new Set(),
): { ok: true; row: ImportRow } | { ok: false; reasons: string[] } {
  const get = (c: CsvColumn) => {
    const i = map.columns[c];
    return i === undefined ? "" : (record.cells[i] ?? "");
  };
  const reasons: string[] = [];
  const R = T.rowReason;

  const name = cleanText(get("nome"), TEXT_LIMITS.fullName);
  if (!name.ok) reasons.push(name.reason === "empty" ? R.nameMissing : R.nameTooLong);

  let nickname: string | null = null;
  if (get("nickname").trim() !== "") {
    const r = cleanText(get("nickname"), TEXT_LIMITS.nickname);
    if (r.ok) nickname = r.value;
    else reasons.push(R.nicknameTooLong);
  }

  const dateText = get("data").trim();
  const date = dateText === "" ? null : parseBirthDate(dateText, today);
  if (date === null) reasons.push(R.dateMissing);
  else if (!date.ok) reasons.push(R.dateInvalid(truncateValue(dateText)));

  let phone: string | null = null;
  if (get("telefono").trim() !== "") {
    const r = normalizePhone(get("telefono"));
    if (r.ok) phone = r.value;
    else reasons.push(R.phoneInvalid);
  }

  const username = (c: CsvColumn) => {
    const r = normalizeUsername(get(c));
    return r.ok ? r.value : null;
  };

  const { groups, tooLong } = parseGroups(get("gruppi"));
  if (tooLong !== null) reasons.push(R.groupTooLong(truncateValue(tooLong)));
  else {
    const short = groups.find((g) => !knownGroups.has(g.nameNorm) && !hasValidGroupKey(g.name));
    if (short) reasons.push(R.groupKeyTooShort(truncateValue(short.name)));
  }

  // BR-21: senza maiuscole; vuota = media.
  const priorityText = get("priorita").trim();
  const priorityValue = priorityText === "" ? DEFAULT_PRIORITY : priorityText.toLocaleLowerCase("it-IT");
  const priority = PRIORITIES.find((p) => p === priorityValue);
  if (!priority) reasons.push(R.priorityInvalid(truncateValue(priorityText)));

  let customMessage: string | null = null;
  if (get("messaggio").trim() !== "") {
    const r = validateGreeting(get("messaggio"));
    if (r.ok) customMessage = r.value;
    else reasons.push(R.messageTooLong);
  }

  if (record.cells.slice(map.width).some((c) => c.trim() !== "")) reasons.push(R.extraColumns);

  if (reasons.length > 0 || !name.ok || !date?.ok || !priority) return { ok: false, reasons };
  return {
    ok: true,
    row: {
      line: record.line,
      fullName: name.value,
      fullNameNorm: normKey(name.value),
      nickname,
      birthDay: date.day,
      birthMonth: date.month,
      birthYear: date.year,
      phone,
      instagram: username("instagram"),
      telegram: username("telegram"),
      priority,
      customMessage,
      groups,
    },
  };
}

// BR-14: regola di findDuplicate (001 FR-004): l'anno conta solo se presente in entrambe.
export function isDuplicate(a: ExistingKey, b: ExistingKey): boolean {
  return (
    a.fullNameNorm === b.fullNameNorm &&
    a.birthDay === b.birthDay &&
    a.birthMonth === b.birthMonth &&
    (a.birthYear === null || b.birthYear === null || a.birthYear === b.birthYear)
  );
}

// FR-007a: la riga d'esempio valida è riconosciuta con la stessa regola dei duplicati.
function exampleKey(today: LocalDate): ExistingKey | null {
  const d = parseBirthDate(CSV_EXAMPLE_ROW[2], today);
  return d.ok ? { fullNameNorm: normKey(CSV_EXAMPLE_ROW[0]), birthDay: d.day, birthMonth: d.month, birthYear: d.year } : null;
}

// BR-23: gruppi delle righe importate che non esistono, con la grafia della prima riga.
function groupsToCreate(rows: readonly ImportRow[], existing: readonly ImportGroup[]): ImportGroup[] {
  const known = new Set(existing.map((g) => g.nameNorm));
  const out: ImportGroup[] = [];
  for (const r of rows) {
    for (const g of r.groups) {
      if (known.has(g.nameNorm)) continue;
      known.add(g.nameNorm);
      out.push(g);
    }
  }
  return out;
}

const dateOf = (r: ImportRow) => formatShort({ day: r.birthDay, month: r.birthMonth, year: r.birthYear });

// RF-24, §5.8: classifica le righe di dati (intestazione esclusa) in nuove, esempio, duplicati, errori.
export function buildPreview(
  records: readonly CsvRecord[],
  map: HeaderMap,
  existingKeys: readonly ExistingKey[],
  existingGroups: readonly ImportGroup[],
  today: LocalDate,
): Preview {
  const example = exampleKey(today);
  const knownGroups = new Set(existingGroups.map((g) => g.nameNorm));
  const preview: Preview = { rows: [], duplicates: [], errors: [], exampleSkipped: false, groupsToCreate: [] };
  for (const record of records) {
    if (record.empty) continue;
    const v = validateRecord(record, map, today, knownGroups);
    if (!v.ok) {
      preview.errors.push({ line: record.line, reasons: v.reasons });
      continue;
    }
    const row = v.row;
    if (example && isDuplicate(row, example)) {
      preview.exampleSkipped = true;
      continue;
    }
    // La prima riga vince: le successive uguali sono duplicati interni.
    if (existingKeys.some((k) => isDuplicate(row, k)) || preview.rows.some((k) => isDuplicate(row, k))) {
      preview.duplicates.push({ line: row.line, fullName: row.fullName, date: dateOf(row) });
      continue;
    }
    preview.rows.push(row);
  }
  preview.groupsToCreate = groupsToCreate(preview.rows, existingGroups).map((g) => g.name);
  return preview;
}

// Research R-06: ricontrollo a Importa sulle righe salvate nello stato.
export function recheck(
  rows: readonly ImportRow[],
  existingKeys: readonly ExistingKey[],
  existingGroups: readonly ImportGroup[],
): { rows: ImportRow[]; skipped: number; groupsToCreate: ImportGroup[] } {
  const fresh = rows.filter((r) => !existingKeys.some((k) => isDuplicate(r, k)));
  return { rows: fresh, skipped: rows.length - fresh.length, groupsToCreate: groupsToCreate(fresh, existingGroups) };
}

export function importState(p: Preview): ImportState {
  return {
    rows: p.rows,
    preview: {
      newCount: p.rows.length,
      duplicateCount: p.duplicates.length,
      errorCount: p.errors.length,
      exampleSkipped: p.exampleSkipped,
      groupsToCreate: p.groupsToCreate,
    },
  };
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Righe del testo dell'anteprima (contracts/flussi.md): conteggi in testa, sezioni solo se non
// vuote, duplicati ed errori tutti in ordine di riga, gruppi a capo ogni PREVIEW_GROUPS_PER_LINE.
export function previewText(p: Preview): string[] {
  const lines = [T.previewTitle, T.previewNew(p.rows.length)];
  if (p.exampleSkipped) lines.push(T.previewExampleSkipped);
  if (p.duplicates.length > 0) {
    lines.push(T.previewDuplicates(p.duplicates.length));
    for (const d of p.duplicates) lines.push(T.previewDuplicateLine(d.line, d.fullName, d.date));
  }
  if (p.errors.length > 0) {
    lines.push(T.previewErrors(p.errors.length));
    for (const e of p.errors) lines.push(T.previewErrorLine(e.line, e.reasons));
  }
  chunks(p.groupsToCreate, PREVIEW_GROUPS_PER_LINE).forEach((names, i) => {
    const text = names.join(", ");
    lines.push(i === 0 ? T.previewGroups(text) : text);
  });
  return lines;
}

// Riepilogo breve per il testo libero durante l'attesa (repeatStep).
export function shortSummary(s: ImportState["preview"]): string {
  const shown = s.groupsToCreate.slice(0, PREVIEW_GROUPS_PER_LINE);
  const more = s.groupsToCreate.length - shown.length;
  const groups = more > 0 ? `${shown.join(", ")}, ${T.previewMoreGroups(more)}` : shown.join(", ");
  return T.previewShort(s.newCount, s.duplicateCount, s.errorCount, groups);
}

// --- Export (RF-25, FR-016, research R-10) ---

export interface ExportPerson {
  fullName: string;
  nickname: string | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  priority: Priority;
  customMessage: string | null;
}

// Una riga nell'ordine di CSV_COLUMNS. Telefono con uno spazio dopo i primi tre caratteri perché
// Excel lo tratti come testo; normalizePhone lo rimuove al reimport (approvato 2026-10-29).
export function exportRow(p: ExportPerson, groupNames: readonly string[]): string[] {
  return [
    p.fullName,
    p.nickname ?? "",
    formatShort({ day: p.birthDay, month: p.birthMonth, year: p.birthYear }),
    p.phone === null ? "" : `${p.phone.slice(0, 3)} ${p.phone.slice(3)}`,
    p.instagram ?? "",
    p.telegram ?? "",
    sortNames(groupNames).join(CSV_GROUP_SEPARATOR),
    p.priority,
    p.customMessage ?? "",
  ];
}
