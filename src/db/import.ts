import type { ExistingKey, ImportGroup, ImportRow } from "../domain/import";
import { consumeStatement, flowGuardSql } from "./conversation";

// Lettura del contesto e scrittura dell'import CSV (research R-06, R-07). Le righe passano come un
// solo parametro JSON letto con json_each: pochi statement, ≤ 100 parametri ciascuno.

// Batch di lettura: [chiavi delle persone, gruppi esistenti].
export function importContextStatements(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare("SELECT full_name_norm, birth_day, birth_month, birth_year FROM persons"),
    db.prepare("SELECT name, name_norm FROM groups"),
  ];
}

export function importContextFromResults(results: readonly D1Result[]): { keys: ExistingKey[]; groups: ImportGroup[] } {
  const [persons, groups] = results;
  type KeyRow = { full_name_norm: string; birth_day: number; birth_month: number; birth_year: number | null };
  return {
    keys: ((persons?.results ?? []) as KeyRow[]).map((r) => ({
      fullNameNorm: r.full_name_norm,
      birthDay: r.birth_day,
      birthMonth: r.birth_month,
      birthYear: r.birth_year,
    })),
    groups: ((groups?.results ?? []) as { name: string; name_norm: string }[]).map((g) => ({ name: g.name, nameNorm: g.name_norm })),
  };
}

const field = (f: string) => `json_extract(value, '$.${f}')`;

// Una D1.batch (transazione, FR-013) con la guardia del flusso su ogni statement. Gli indici dicono
// dove leggere meta.changes: gruppi creati (M) e persone importate (N).
export function importGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  rows: readonly ImportRow[],
  groupsToCreate: readonly ImportGroup[],
  nowIso: string,
): { statements: D1PreparedStatement[]; groupsIndex: number; personsIndex: number } {
  const statements = [
    db
      .prepare(`INSERT OR IGNORE INTO groups (name, name_norm) SELECT ${field("name")}, ${field("nameNorm")} FROM json_each(?) WHERE ${flowGuardSql}`)
      .bind(JSON.stringify(groupsToCreate), chatId, flowId),
    // Stesse colonne del guidato (insertGuardedStatements di persons.ts); ORDER BY key = ordine del file.
    db
      .prepare(
        `INSERT INTO persons (full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, phone, instagram,
           telegram, priority, custom_message, created_at, updated_at)
         SELECT ${field("fullName")}, ${field("fullNameNorm")}, ${field("nickname")}, ${field("birthDay")}, ${field("birthMonth")},
           ${field("birthYear")}, ${field("phone")}, ${field("instagram")}, ${field("telegram")}, ${field("priority")},
           ${field("customMessage")}, ?, ?
         FROM json_each(?) WHERE ${flowGuardSql} ORDER BY key`,
      )
      .bind(nowIso, nowIso, JSON.stringify(rows), chatId, flowId),
    // Le N persone appena inserite sono le ultime N per id e la chiave è unica tra loro (R-05, R-07).
    db
      .prepare(
        `INSERT OR IGNORE INTO person_groups (person_id, group_id)
         SELECT p.id, g.id
         FROM json_each(?) r, json_each(r.value, '$.groups') gn
         JOIN groups g ON g.name_norm = json_extract(gn.value, '$.nameNorm')
         JOIN persons p ON p.full_name_norm = json_extract(r.value, '$.fullNameNorm')
           AND p.birth_day = json_extract(r.value, '$.birthDay')
           AND p.birth_month = json_extract(r.value, '$.birthMonth')
           AND p.birth_year IS json_extract(r.value, '$.birthYear')
         WHERE p.id > (SELECT MAX(id) FROM persons) - ? AND ${flowGuardSql}`,
      )
      .bind(JSON.stringify(rows.map((r) => ({ fullNameNorm: r.fullNameNorm, birthDay: r.birthDay, birthMonth: r.birthMonth, birthYear: r.birthYear, groups: r.groups }))), rows.length, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
  return { statements, groupsIndex: 0, personsIndex: 1 };
}
