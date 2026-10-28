import { env } from "cloudflare:test";
import { NOW } from "./constants";

// Inserimenti e letture dirette in D1 per preparare e verificare gli scenari.

export interface PersonSeed {
  id?: number;
  fullName: string;
  day: number;
  month: number;
  year?: number | null;
  nickname?: string | null;
  phone?: string | null;
  instagram?: string | null;
  telegram?: string | null;
  priority?: "alta" | "media" | "bassa";
  customMessage?: string | null;
}

export async function insertPerson(p: PersonSeed): Promise<number> {
  const iso = NOW.toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO persons (id, full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, phone, instagram,
       telegram, priority, custom_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      p.id ?? null,
      p.fullName,
      p.fullName.trim().toLocaleLowerCase("it-IT"),
      p.nickname ?? null,
      p.day,
      p.month,
      p.year ?? null,
      p.phone ?? null,
      p.instagram ?? null,
      p.telegram ?? null,
      p.priority ?? "media",
      p.customMessage ?? null,
      iso,
      iso,
    )
    .first<{ id: number }>();
  return res!.id;
}

export async function insertGroup(name: string): Promise<number> {
  const res = await env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES (?, ?) RETURNING id")
    .bind(name, name.trim().toLocaleLowerCase("it-IT"))
    .first<{ id: number }>();
  return res!.id;
}

export async function addToGroup(personId: number, groupId: number): Promise<void> {
  await env.DB.prepare("INSERT INTO person_groups (person_id, group_id) VALUES (?, ?)").bind(personId, groupId).run();
}

export async function count(table: string, where = "1 = 1", ...params: unknown[]): Promise<number> {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  return r!.n;
}

export async function rows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  return (await env.DB.prepare(sql).bind(...params).all<T>()).results;
}

export const ALL_TABLES = [
  "persons",
  "groups",
  "person_groups",
  "occurrences",
  "deliveries",
  "settings",
  "conversation_state",
] as const;

export async function totalRows(): Promise<number> {
  let n = 0;
  for (const t of ALL_TABLES) n += await count(t);
  return n;
}
