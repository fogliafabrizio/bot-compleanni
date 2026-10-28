import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, TEXT_LIMITS, type Priority } from "../config";
import { T } from "../texts";
import type { LocalDate } from "../time";
import { decodeUtf8 } from "./csv";
import { parseBirthDate } from "./date";
import { validateGreeting } from "./greeting";
import { normalizePhone } from "./phone";
import type { OccurrenceStatus } from "./schedule";
import { cleanText, normKey } from "./text";
import { normalizeUsername } from "./username";

// File di backup JSON v1 (contracts/backup-json.md, research R-08, R-09). Puro: nessun import di
// cloudflare:*, db/ o bot/. Chiavi uguali alle colonne D1.

export interface BackupPerson {
  id: number;
  full_name: string;
  nickname: string | null;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  priority: Priority;
  custom_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupGroup {
  id: number;
  name: string;
}

export interface BackupPersonGroup {
  person_id: number;
  group_id: number;
}

export interface BackupOccurrence {
  id: number;
  person_id: number;
  year: number;
  effective_date: string;
  status: OccurrenceStatus;
  outcome_at: string | null;
  created_at: string;
}

// Dati letti da D1 (liste ordinate per id).
export interface BackupData {
  persons: BackupPerson[];
  groups: BackupGroup[];
  person_groups: BackupPersonGroup[];
  occurrences: BackupOccurrence[];
  default_message: string | null;
}

export interface BackupV1 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_FORMAT_VERSION;
  created_at: string;
  persons: BackupPerson[];
  groups: BackupGroup[];
  person_groups: BackupPersonGroup[];
  occurrences: BackupOccurrence[];
  settings: { default_message: string | null };
}

// Forma pronta per i parametri json_each del ripristino: chiavi di confronto ricalcolate.
export interface NormalizedBackup extends Omit<BackupV1, "persons" | "groups"> {
  persons: (BackupPerson & { full_name_norm: string })[];
  groups: (BackupGroup & { name_norm: string })[];
}

// Solo le chiavi dello schema, nell'ordine del contratto (niente colonne derivate).
export function buildBackup(d: BackupData, createdAtIso: string): BackupV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    created_at: createdAtIso,
    persons: d.persons.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      nickname: p.nickname,
      birth_day: p.birth_day,
      birth_month: p.birth_month,
      birth_year: p.birth_year,
      phone: p.phone,
      instagram: p.instagram,
      telegram: p.telegram,
      priority: p.priority,
      custom_message: p.custom_message,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    groups: d.groups.map((g) => ({ id: g.id, name: g.name })),
    person_groups: d.person_groups.map((pg) => ({ person_id: pg.person_id, group_id: pg.group_id })),
    occurrences: d.occurrences.map((o) => ({
      id: o.id,
      person_id: o.person_id,
      year: o.year,
      effective_date: o.effective_date,
      status: o.status,
      outcome_at: o.outcome_at,
      created_at: o.created_at,
    })),
    settings: { default_message: d.default_message },
  };
}

// JSON compatto, UTF-8 senza BOM.
export function encodeBackup(b: BackupV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(b));
}

// --- Validazione (FR-018, SC-006): rifiuto al primo errore, messaggi con soli id e nomi di campo ---

class Invalid extends Error {
  constructor(readonly reason: string) {
    super("invalid_backup");
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isId = (v: unknown): v is number => isInt(v) && v > 0;
const isStr = (v: unknown): v is string => typeof v === "string";
// Istante come lo scrive toISOString (regex invece di Date.parse: research R-12, backup fino a 1 MiB).
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const isIsoInstant = (v: unknown): v is string => isStr(v) && ISO_INSTANT_RE.test(v);

// Testo già pulito come lo salverebbe il guidato.
const cleanEq = (v: unknown, max: number) => isStr(v) && cleanText(v, max).ok && v.trim() === v;
const optional = (v: unknown, ok: (x: unknown) => boolean) => v === null || ok(v);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(v: unknown): boolean {
  if (!isStr(v)) return false;
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const max = mo === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(mo) ? 30 : 31;
  return d <= max;
}

const STATUSES: readonly string[] = ["aperta", "fatto", "saltato", "non_confermato"];
const PRIORITIES: readonly string[] = ["alta", "media", "bassa"];

// Etichetta per il messaggio: l'id se valido, altrimenti la posizione nella lista.
const label = (o: Obj, index: number) => (isId(o.id) ? String(o.id) : `#${index + 1}`);

type Rules = readonly (readonly [string, (v: unknown) => boolean])[];

function check(entity: string, o: Obj, index: number, rules: Rules): void {
  for (const [field, ok] of rules) {
    if (!ok(o[field])) throw new Invalid(T.backupInvalidField(entity, label(o, index), field));
  }
}

// Valore già normalizzato: la funzione del guidato lo restituisce identico.
function sameAfter(fn: (s: string) => { ok: boolean; value?: string }): (v: unknown) => boolean {
  return (v) => {
    if (!isStr(v)) return false;
    const r = fn(v);
    return r.ok && r.value === v;
  };
}

const isPhone = sameAfter(normalizePhone);
const isUsername = sameAfter(normalizeUsername);
const isGreeting = sameAfter(validateGreeting);

const PERSON_RULES: Rules = Object.entries({
  id: isId,
  full_name: (v: unknown) => cleanEq(v, TEXT_LIMITS.fullName),
  nickname: (v: unknown) => optional(v, (x) => cleanEq(x, TEXT_LIMITS.nickname)),
  birth_day: isInt,
  birth_month: isInt,
  birth_year: (v: unknown) => optional(v, isInt),
  phone: (v: unknown) => optional(v, isPhone),
  instagram: (v: unknown) => optional(v, isUsername),
  telegram: (v: unknown) => optional(v, isUsername),
  priority: (v: unknown) => isStr(v) && PRIORITIES.includes(v),
  custom_message: (v: unknown) => optional(v, isGreeting),
  created_at: isIsoInstant,
  updated_at: isIsoInstant,
});

const GROUP_RULES: Rules = Object.entries({ id: isId, name: (v: unknown) => cleanEq(v, TEXT_LIMITS.groupName) });
const PERSON_GROUP_RULES: Rules = Object.entries({ person_id: isId, group_id: isId });
const OCCURRENCE_RULES: Rules = Object.entries({
  id: isId,
  person_id: isId,
  year: isInt,
  effective_date: isRealDate,
  status: (v: unknown) => isStr(v) && STATUSES.includes(v),
  outcome_at: (v: unknown) => optional(v, isStr),
  created_at: isIsoInstant,
});

function checkPerson(o: Obj, index: number, today: LocalDate): void {
  check("persona", o, index, PERSON_RULES);
  // Data come nel guidato: gg/mm[/aaaa], anno 1900…anno corrente, 29/02 solo se possibile.
  const year = o.birth_year === null ? "" : `/${o.birth_year as number}`;
  if (!parseBirthDate(`${o.birth_day as number}/${o.birth_month as number}${year}`, today).ok) {
    throw new Invalid(T.backupInvalidField("persona", label(o, index), "birth_day"));
  }
}

function list(root: Obj, key: string): Obj[] {
  const v = root[key];
  if (!Array.isArray(v) || !v.every(isObj)) throw new Invalid(T.backupWrongFormat);
  return v;
}

function uniqueIds(entity: string, items: readonly Obj[]): Set<number> {
  const seen = new Set<number>();
  for (const o of items) {
    const id = o.id as number;
    if (seen.has(id)) throw new Invalid(T.backupDuplicateId(entity, String(id)));
    seen.add(id);
  }
  return seen;
}

function validate(root: unknown, today: LocalDate): NormalizedBackup {
  if (!isObj(root) || root.format !== BACKUP_FORMAT) throw new Invalid(T.backupWrongFormat);
  if (root.version !== BACKUP_FORMAT_VERSION) throw new Invalid(T.backupVersion(String(root.version)));
  if (!isIsoInstant(root.created_at) || !isObj(root.settings) || !("default_message" in root.settings)) {
    throw new Invalid(T.backupWrongFormat);
  }
  const persons = list(root, "persons");
  const groups = list(root, "groups");
  const personGroups = list(root, "person_groups");
  const occurrences = list(root, "occurrences");

  // Tipi e valori, con le regole del guidato.
  persons.forEach((p, i) => checkPerson(p, i, today));
  groups.forEach((g, i) => check("gruppo", g, i, GROUP_RULES));
  personGroups.forEach((pg, i) => check("appartenenza", pg, i, PERSON_GROUP_RULES));
  occurrences.forEach((o, i) => check("occorrenza", o, i, OCCURRENCE_RULES));
  const defaultMessage = root.settings.default_message;
  if (!optional(defaultMessage, isGreeting)) {
    throw new Invalid(T.backupInvalidSetting("default_message"));
  }

  // Unicità e riferimenti.
  const personIds = uniqueIds("persona", persons);
  const groupIds = uniqueIds("gruppo", groups);
  uniqueIds("occorrenza", occurrences);
  const names = new Set<string>();
  for (const g of groups) {
    const norm = normKey(g.name as string);
    if (names.has(norm)) throw new Invalid(T.backupDuplicateGroupName);
    names.add(norm);
  }
  const pairs = new Set<string>();
  for (const pg of personGroups) {
    if (!personIds.has(pg.person_id as number)) throw new Invalid(T.backupMissingRef("persona", String(pg.person_id)));
    if (!groupIds.has(pg.group_id as number)) throw new Invalid(T.backupMissingRef("gruppo", String(pg.group_id)));
    const key = `${pg.person_id as number}-${pg.group_id as number}`;
    if (pairs.has(key)) throw new Invalid(T.backupDuplicateId("appartenenza", key));
    pairs.add(key);
  }
  const years = new Set<string>();
  for (const o of occurrences) {
    if (!personIds.has(o.person_id as number)) throw new Invalid(T.backupMissingRef("persona", String(o.person_id)));
    const key = `${o.person_id as number}:${o.year as number}`;
    if (years.has(key)) throw new Invalid(T.backupDuplicateOccurrence(String(o.person_id)));
    years.add(key);
  }

  const b = buildBackup(
    {
      persons: persons as unknown as BackupPerson[],
      groups: groups as unknown as BackupGroup[],
      person_groups: personGroups as unknown as BackupPersonGroup[],
      occurrences: occurrences as unknown as BackupOccurrence[],
      default_message: defaultMessage as string | null,
    },
    root.created_at,
  );
  // buildBackup ha già copiato le liste: le chiavi di confronto si aggiungono alle copie.
  const normalized = b as NormalizedBackup;
  for (const p of normalized.persons) p.full_name_norm = normKey(p.full_name);
  for (const g of normalized.groups) g.name_norm = normKey(g.name);
  return normalized;
}

export function parseBackup(bytes: Uint8Array, today: LocalDate): { ok: true; backup: NormalizedBackup } | { ok: false; reason: string } {
  const decoded = decodeUtf8(bytes);
  let root: unknown;
  try {
    if (!decoded.ok) throw new Error("not_utf8");
    root = JSON.parse(decoded.text) as unknown;
  } catch {
    return { ok: false, reason: T.backupNotJson };
  }
  try {
    return { ok: true, backup: validate(root, today) };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, reason: err.reason };
    throw err;
  }
}
