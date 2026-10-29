import type { PersonRowLike } from "../bot/promemoria";
import type { OccurrenceStatus } from "../domain/schedule";
import type { ListPerson } from "../domain/viste";
import { GROUP_NAMES_SQL } from "./reminders";
import { DEFAULT_MESSAGE_KEY } from "./settings";

// Statement delle batch di lettura delle viste (feature 003, data-model.md, research R-08).

export interface ListPersonRow {
  id: number;
  full_name: string;
  nickname: string | null;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
}

// Riga di una lista storica (/scaduti, /anno): persona + occorrenza.
export interface ListOccurrenceRow extends ListPersonRow {
  occurrence_id: number;
  year: number;
  effective_date: string;
  status: OccurrenceStatus;
}

// Dati del reminder di /oggi: PersonRowLike (002) + occorrenza di oggi.
export interface TodayRow extends PersonRowLike {
  id: number;
  occurrence_id: number;
  year: number;
  status: OccurrenceStatus;
  last_year_status: OccurrenceStatus | null;
  default_message: string | null;
}

export const LIST_PERSON_COLUMNS = "p.id, p.full_name, p.nickname, p.birth_day, p.birth_month, p.birth_year";

export function rowToListPerson(r: ListPersonRow): ListPerson {
  return {
    id: r.id,
    fullName: r.full_name,
    nickname: r.nickname,
    birthDay: r.birth_day,
    birthMonth: r.birth_month,
    birthYear: r.birth_year,
  };
}

// Tutte le persone (≤ 200) o quelle nate nel mese indicato.
export function listPersonsStatement(db: D1Database, month?: number): D1PreparedStatement {
  return month === undefined
    ? db.prepare(`SELECT ${LIST_PERSON_COLUMNS} FROM persons p`)
    : db.prepare(`SELECT ${LIST_PERSON_COLUMNS} FROM persons p WHERE p.birth_month = ?`).bind(month);
}

// --- Gruppi v1.1 (RF-17, RF-19, research R-07) ---

// Gruppo con il numero di persone: stessa forma di GroupWithCount.
export interface GroupCountRow {
  id: number;
  name: string;
  members: number;
}

// Appartenenza con le colonne di lista della persona.
export interface MembershipRow extends ListPersonRow {
  group_id: number;
}

const GROUP_COUNT_SQL = `SELECT g.id, g.name, COUNT(pg.person_id) AS members
  FROM groups g LEFT JOIN person_groups pg ON pg.group_id = g.id`;

// Ricerca in una sola andata: [gruppi con conteggi, tutte le appartenenze]. La chiave BR-26 non si
// calcola in SQL; il filtro sul gruppo trovato è in TypeScript.
export function groupSearchStatements(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare(`${GROUP_COUNT_SQL} GROUP BY g.id`),
    db.prepare(`SELECT pg.group_id, ${LIST_PERSON_COLUMNS} FROM person_groups pg JOIN persons p ON p.id = pg.person_id`),
  ];
}

// Scheda gruppo e filtro di /prossimi al tocco: [gruppo per id con conteggio, persone del gruppo].
export function groupCardStatements(db: D1Database, groupId: number): D1PreparedStatement[] {
  return [
    db.prepare(`${GROUP_COUNT_SQL} WHERE g.id = ? GROUP BY g.id`).bind(groupId),
    db
      .prepare(`SELECT ${LIST_PERSON_COLUMNS} FROM person_groups pg JOIN persons p ON p.id = pg.person_id WHERE pg.group_id = ?`)
      .bind(groupId),
  ];
}

export function membersOf(rows: readonly MembershipRow[], groupId: number): ListPerson[] {
  return rows.filter((r) => r.group_id === groupId).map(rowToListPerson);
}


// Colonne di TodayRow, con alias p (persona) e o (occorrenza); il primo parametro è la chiave del default.
export const TODAY_COLUMNS = `p.id, p.full_name, p.nickname, p.birth_day, p.birth_month, p.birth_year, p.phone, p.instagram,
  p.telegram, p.custom_message, ${GROUP_NAMES_SQL}, o.id AS occurrence_id, o.year, o.status,
  (SELECT prev.status FROM occurrences prev WHERE prev.person_id = p.id AND prev.year = o.year - 1) AS last_year_status,
  (SELECT value FROM settings WHERE key = ?) AS default_message`;

// RF-16, research R-06: crea l'occorrenza aperta di oggi se manca, poi legge i dati dei reminder.
export function todayStatements(
  db: D1Database,
  q: { pairs: readonly [number, number][]; year: number; effectiveDate: string; nowIso: string },
): D1PreparedStatement[] {
  const where = q.pairs.map(() => "(p.birth_month = ? AND p.birth_day = ?)").join(" OR ");
  const pairParams = q.pairs.flat();
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO occurrences (person_id, year, effective_date, status, created_at)
         SELECT p.id, ?, ?, 'aperta', ? FROM persons p WHERE ${where}`,
      )
      .bind(q.year, q.effectiveDate, q.nowIso, ...pairParams),
    db
      .prepare(
        `SELECT ${TODAY_COLUMNS}
         FROM persons p JOIN occurrences o ON o.person_id = p.id AND o.year = ?
         WHERE ${where}`,
      )
      .bind(DEFAULT_MESSAGE_KEY, q.year, ...pairParams),
  ];
}

const OCCURRENCE_COLUMNS = `${LIST_PERSON_COLUMNS}, o.id AS occurrence_id, o.year, o.effective_date, o.status`;

// RF-21: occorrenze con data effettiva nella finestra e stato diverso da fatto (idx_occurrences_date).
export function overdueStatement(db: D1Database, from: string, to: string): D1PreparedStatement {
  return db
    .prepare(
      `SELECT ${OCCURRENCE_COLUMNS} FROM occurrences o JOIN persons p ON p.id = o.person_id
       WHERE o.effective_date BETWEEN ? AND ? AND o.status <> 'fatto' ORDER BY o.effective_date, p.id`,
    )
    .bind(from, to);
}

// RF-22, research R-11: [conteggi per stato, saltati di Y, saltati di Y e di Y − 1].
export function yearStatements(db: D1Database, year: number): D1PreparedStatement[] {
  return [
    db.prepare("SELECT status, COUNT(*) AS n FROM occurrences WHERE year = ? AND status <> 'aperta' GROUP BY status").bind(year),
    db
      .prepare(
        `SELECT ${OCCURRENCE_COLUMNS} FROM occurrences o JOIN persons p ON p.id = o.person_id
         WHERE o.year = ? AND o.status = 'saltato' ORDER BY o.effective_date, p.id`,
      )
      .bind(year),
    db
      .prepare(
        `SELECT ${OCCURRENCE_COLUMNS} FROM occurrences o JOIN persons p ON p.id = o.person_id
         JOIN occurrences prev ON prev.person_id = o.person_id AND prev.year = o.year - 1 AND prev.status = 'saltato'
         WHERE o.year = ? AND o.status = 'saltato' ORDER BY o.effective_date, p.id`,
      )
      .bind(year),
  ];
}
