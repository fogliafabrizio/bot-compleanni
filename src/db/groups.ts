import { consumeStatement, flowGuardSql } from "./conversation";

// Query della tabella groups (data-model.md, RF-07, RF-08, BR-17).

export interface Group {
  id: number;
  name: string;
}

export interface GroupWithCount extends Group {
  members: number;
}

export async function listAll(db: D1Database): Promise<Group[]> {
  const { results } = await db.prepare("SELECT id, name FROM groups ORDER BY name COLLATE NOCASE, id").all<Group>();
  return results;
}

// Righe con la forma di GroupWithCount; l'ordine mostrato è quello di sortGroups (BR-26).
export function listWithCountsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(
    `SELECT g.id, g.name, COUNT(pg.person_id) AS members
     FROM groups g LEFT JOIN person_groups pg ON pg.group_id = g.id
     GROUP BY g.id ORDER BY g.name COLLATE NOCASE, g.id`,
  );
}

export async function listWithCounts(db: D1Database): Promise<GroupWithCount[]> {
  const { results } = await listWithCountsStatement(db).all<GroupWithCount>();
  return results;
}

export function groupByIdStatement(db: D1Database, id: number): D1PreparedStatement {
  return db.prepare("SELECT id, name FROM groups WHERE id = ?").bind(id);
}

export async function getById(db: D1Database, id: number): Promise<Group | null> {
  return groupByIdStatement(db, id).first<Group>();
}

// BR-17: esiste un gruppo con lo stesso nome normalizzato (escluso eventualmente sé stesso)?
export async function existsNorm(db: D1Database, nameNorm: string, excludeId?: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS x FROM groups WHERE name_norm = ? AND id <> ?")
    .bind(nameNorm, excludeId ?? -1)
    .first();
  return row !== null;
}

export async function countMembers(db: D1Database, groupId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM person_groups WHERE group_id = ?")
    .bind(groupId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Ogni funzione restituisce gli statement di una D1.batch; il primo è la scrittura di dominio.
// Rinomina ed eliminazione sono guardate anche sul nome mostrato alla domanda (FR-005, research
// R-05): se nel frattempo il gruppo è cambiato, 0 righe.

export function createGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  name: string,
  nameNorm: string,
): D1PreparedStatement[] {
  return [
    db.prepare(`INSERT INTO groups (name, name_norm) SELECT ?, ? WHERE ${flowGuardSql}`).bind(name, nameNorm, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
}

export function renameGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  groupId: number,
  expectedName: string,
  name: string,
  nameNorm: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(`UPDATE groups SET name = ?, name_norm = ? WHERE id = ? AND name = ? AND ${flowGuardSql}`)
      .bind(name, nameNorm, groupId, expectedName, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
}

// La cascata rimuove le appartenenze; le persone restano (FR-022).
export function deleteGuardedStatements(
  db: D1Database,
  chatId: number,
  flowId: string,
  groupId: number,
  expectedName: string,
): D1PreparedStatement[] {
  return [
    db.prepare(`DELETE FROM groups WHERE id = ? AND name = ? AND ${flowGuardSql}`).bind(groupId, expectedName, chatId, flowId),
    consumeStatement(db, chatId, flowId),
  ];
}
