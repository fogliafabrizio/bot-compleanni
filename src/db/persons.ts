import type { Priority } from "../config";
import { normKey } from "../domain/text";
import { consumeStatement, flowGuardSql } from "./conversation";

// Query della tabella persons (data-model.md).

export interface PersonFields {
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

export interface Person extends PersonFields {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export type OutcomeStatus = "fatto" | "saltato" | "non_confermato";

export interface Outcome {
  year: number;
  status: OutcomeStatus;
}

interface PersonRow {
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

export function rowToPerson(r: PersonRow): Person {
  return {
    id: r.id,
    fullName: r.full_name,
    nickname: r.nickname,
    birthDay: r.birth_day,
    birthMonth: r.birth_month,
    birthYear: r.birth_year,
    phone: r.phone,
    instagram: r.instagram,
    telegram: r.telegram,
    priority: r.priority,
    customMessage: r.custom_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getById(db: D1Database, id: number): Promise<Person | null> {
  const row = await db.prepare("SELECT * FROM persons WHERE id = ?").bind(id).first<PersonRow>();
  return row ? rowToPerson(row) : null;
}

// BR-14: stesso nome normalizzato, giorno e mese; l'anno conta solo se presente in entrambe.
export async function findDuplicate(
  db: D1Database,
  key: { fullNameNorm: string; day: number; month: number; year: number | null },
  excludeId?: number,
): Promise<Person | null> {
  const row = await db
    .prepare(
      `SELECT * FROM persons
       WHERE full_name_norm = ? AND birth_day = ? AND birth_month = ?
         AND (birth_year IS NULL OR ? IS NULL OR birth_year = ?)
         AND id <> ?
       ORDER BY id LIMIT 1`,
    )
    .bind(key.fullNameNorm, key.day, key.month, key.year, key.year, excludeId ?? -1)
    .first<PersonRow>();
  return row ? rowToPerson(row) : null;
}

// Gruppi creati nel flusso: scritti solo al salvataggio (research R-12).
function pendingGroupStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  pending: readonly { name: string; nameNorm: string }[],
): D1PreparedStatement[] {
  return pending.map((g) =>
    db
      .prepare(`INSERT OR IGNORE INTO groups (name, name_norm) SELECT ?, ? WHERE ${flowGuardSql}`)
      .bind(g.name, g.nameNorm, chatId, flowId),
  );
}

// Statement della D1.batch di salvataggio di una nuova persona (research R-11).
// Il primo statement dopo i gruppi in attesa è l'INSERT della persona: il suo indice è restituito.
export function insertGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  input: PersonFields & { fullNameNorm: string },
  pending: readonly { name: string; nameNorm: string; selected: boolean }[],
  selectedGroupIds: readonly number[],
  nowIso: string,
): { statements: D1PreparedStatement[]; personIndex: number } {
  const statements = pendingGroupStatements(db, chatId, flowId, pending);
  const personIndex = statements.length;
  statements.push(
    db
      .prepare(
        `INSERT INTO persons (full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, phone, instagram,
           telegram, priority, custom_message, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${flowGuardSql}`,
      )
      .bind(
        input.fullName,
        input.fullNameNorm,
        input.nickname,
        input.birthDay,
        input.birthMonth,
        input.birthYear,
        input.phone,
        input.instagram,
        input.telegram,
        input.priority,
        input.customMessage,
        nowIso,
        nowIso,
        chatId,
        flowId,
      ),
  );
  // Nella stessa transazione la persona appena inserita è quella con l'id massimo.
  for (const gid of selectedGroupIds) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO person_groups (person_id, group_id)
           SELECT (SELECT MAX(id) FROM persons), id FROM groups WHERE id = ? AND ${flowGuardSql}`,
        )
        .bind(gid, chatId, flowId),
    );
  }
  for (const g of pending.filter((p) => p.selected)) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO person_groups (person_id, group_id)
           SELECT (SELECT MAX(id) FROM persons), id FROM groups WHERE name_norm = ? AND ${flowGuardSql}`,
        )
        .bind(g.nameNorm, chatId, flowId),
    );
  }
  statements.push(consumeStatement(db, chatId, flowId));
  return { statements, personIndex };
}

const COLUMNS: Record<keyof PersonFields, string> = {
  fullName: "full_name",
  nickname: "nickname",
  birthDay: "birth_day",
  birthMonth: "birth_month",
  birthYear: "birth_year",
  phone: "phone",
  instagram: "instagram",
  telegram: "telegram",
  priority: "priority",
  customMessage: "custom_message",
};

// RF-04: aggiorna solo i campi indicati; il primo statement è l'UPDATE della persona.
export function updateFieldGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  personId: number,
  patch: Partial<PersonFields>,
  nowIso: string,
): D1PreparedStatement[] {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch) as [keyof PersonFields, unknown][]) {
    sets.push(`${COLUMNS[key]} = ?`);
    values.push(value ?? null);
    if (key === "fullName") {
      sets.push("full_name_norm = ?");
      values.push(normKey(String(value)));
    }
  }
  sets.push("updated_at = ?");
  values.push(nowIso);
  return [
    db
      .prepare(`UPDATE persons SET ${sets.join(", ")} WHERE id = ? AND ${flowGuardSql}`)
      .bind(...values, personId, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
}

// BR-13 (research R-04): un cambio di giorno o mese annulla le occorrenze aperte della persona;
// la cascata rimuove i loro invii. Va nella batch del salvataggio, prima del consumo dello stato.
export function cancelOpenOccurrencesGuardedStatement(
  db: D1Database,
  chatId: number,
  flowId: string,
  personId: number,
): D1PreparedStatement {
  return db
    .prepare(`DELETE FROM occurrences WHERE person_id = ? AND status = 'aperta' AND ${flowGuardSql}`)
    .bind(personId, chatId, flowId);
}

// RF-04 (Gruppi): sostituisce le appartenenze; l'UPDATE della persona è il primo statement.
export function replaceGroupsGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  personId: number,
  selectedIds: readonly number[],
  pending: readonly { name: string; nameNorm: string; selected: boolean }[],
  nowIso: string,
): D1PreparedStatement[] {
  const statements = [
    db.prepare(`UPDATE persons SET updated_at = ? WHERE id = ? AND ${flowGuardSql}`).bind(nowIso, personId, chatId, flowId),
    ...pendingGroupStatements(db, chatId, flowId, pending),
    db.prepare(`DELETE FROM person_groups WHERE person_id = ? AND ${flowGuardSql}`).bind(personId, chatId, flowId),
  ];
  for (const gid of selectedIds) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO person_groups (person_id, group_id)
           SELECT ?, id FROM groups WHERE id = ? AND EXISTS (SELECT 1 FROM persons WHERE id = ?) AND ${flowGuardSql}`,
        )
        .bind(personId, gid, personId, chatId, flowId),
    );
  }
  for (const g of pending.filter((p) => p.selected)) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO person_groups (person_id, group_id)
           SELECT ?, id FROM groups WHERE name_norm = ? AND EXISTS (SELECT 1 FROM persons WHERE id = ?) AND ${flowGuardSql}`,
        )
        .bind(personId, g.nameNorm, personId, chatId, flowId),
    );
  }
  statements.push(consumeStatement(db, chatId, flowId));
  return statements;
}

// RF-05: la cascata rimuove appartenenze, occorrenze e invii; primo statement = DELETE.
export function deleteGuardedStatements(db: D1Database, chatId: number, flowId: string, personId: number): D1PreparedStatement[] {
  return [
    db.prepare(`DELETE FROM persons WHERE id = ? AND ${flowGuardSql}`).bind(personId, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
}

export async function getGroupNames(db: D1Database, personId: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT g.name FROM groups g JOIN person_groups pg ON pg.group_id = g.id
       WHERE pg.person_id = ? ORDER BY g.name COLLATE NOCASE`,
    )
    .bind(personId)
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function getGroupIds(db: D1Database, personId: number): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT group_id FROM person_groups WHERE person_id = ?")
    .bind(personId)
    .all<{ group_id: number }>();
  return results.map((r) => r.group_id);
}

export async function getOutcomes(db: D1Database, personId: number): Promise<Outcome[]> {
  const { results } = await db
    .prepare(
      `SELECT year, status FROM occurrences
       WHERE person_id = ? AND status IN ('fatto', 'saltato', 'non_confermato') ORDER BY year DESC`,
    )
    .bind(personId)
    .all<Outcome>();
  return results;
}
