import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

// Tabelle in ordine compatibile con le chiavi esterne (figli prima dei padri).
const TABLES = [
  "deliveries",
  "occurrences",
  "person_groups",
  "persons",
  "groups",
  "settings",
  "conversation_state",
];

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Ogni test parte da un database vuoto.
beforeEach(async () => {
  await env.DB.batch([
    ...TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);
});
