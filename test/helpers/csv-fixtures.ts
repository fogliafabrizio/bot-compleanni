import { CSV_COLUMNS } from "../../src/config";
import type { BackupV1 } from "../../src/domain/backup";

// Generatori di CSV e backup sintetici (principio V: nessun dato reale). Nessun import di
// cloudflare:*, così li usa anche il benchmark in Node.

export const BOM = String.fromCharCode(0xfeff);

const quote = (v: string, sep: string) => (v.includes(sep) || /["\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

// Intestazione di CSV_COLUMNS e righe di dati; celle mancanti in coda lasciate assenti.
export function csvOf(rows: readonly (readonly string[])[], sep = ";", bom = true): string {
  const lines = [CSV_COLUMNS, ...rows].map((r) => r.map((c) => quote(c, sep)).join(sep));
  return `${bom ? BOM : ""}${lines.join("\r\n")}\r\n`;
}

// Righe complete (9 celle) con nomi "Persona 001…" e date valide tutte distinte.
export function syntheticRows(n: number, seed = 0): string[][] {
  return Array.from({ length: n }, (_, k) => {
    const i = k + seed;
    const day = (i % 28) + 1;
    const month = (Math.floor(i / 28) % 12) + 1;
    const year = 1950 + Math.floor(i / 336);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return [`Persona ${String(i + 1).padStart(3, "0")}`, "", `${dd}/${mm}/${year}`, "", "", "", "", "", ""];
  });
}

// Backup v1 conforme a contracts/backup-json.md: persone, due gruppi, appartenenze, occorrenze chiuse.
export function syntheticBackup(opts: { persons: number; occurrencesPerPerson: number; createdAt?: string }): BackupV1 {
  const iso = "2026-01-01T08:00:00.000Z";
  const persons = Array.from({ length: opts.persons }, (_, k) => ({
    id: k + 1,
    full_name: `Persona ${String(k + 1).padStart(3, "0")}`,
    nickname: k % 3 === 0 ? `Nick ${k + 1}` : null,
    birth_day: (k % 28) + 1,
    birth_month: (Math.floor(k / 28) % 12) + 1,
    birth_year: k % 4 === 0 ? null : 1950 + (k % 50),
    phone: k % 2 === 0 ? `+39333${String(1000000 + k)}` : null,
    instagram: k % 5 === 0 ? `ig_${k + 1}` : null,
    telegram: null,
    priority: (["alta", "media", "bassa"] as const)[k % 3]!,
    custom_message: k % 7 === 0 ? "Auguri {nome}!" : null,
    created_at: iso,
    updated_at: iso,
  }));
  const occurrences = persons.flatMap((p, k) =>
    Array.from({ length: opts.occurrencesPerPerson }, (_, j) => {
      const year = 2025 - j;
      const day = p.birth_month === 2 && p.birth_day === 29 ? 28 : p.birth_day;
      return {
        id: k * opts.occurrencesPerPerson + j + 1,
        person_id: p.id,
        year,
        effective_date: `${year}-${String(p.birth_month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        status: (["fatto", "saltato", "non_confermato"] as const)[(k + j) % 3]!,
        outcome_at: iso,
        created_at: iso,
      };
    }),
  );
  return {
    format: "bot-compleanni-backup",
    version: 1,
    created_at: opts.createdAt ?? iso,
    persons,
    groups: [
      { id: 1, name: "Famiglia" },
      { id: 2, name: "Amici" },
    ],
    person_groups: persons.filter((p) => p.id % 2 === 0).map((p) => ({ person_id: p.id, group_id: (p.id % 4) / 2 + 1 })),
    occurrences,
    settings: { default_message: null },
  };
}
