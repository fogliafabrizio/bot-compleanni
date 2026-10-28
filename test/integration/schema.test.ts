import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { insertGroup, insertPerson } from "../helpers/db";

describe("AFU §8: schema iniziale", () => {
  it("AFU §8: esistono le 7 tabelle", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "conversation_state",
      "deliveries",
      "groups",
      "occurrences",
      "person_groups",
      "persons",
      "settings",
    ]);
  });

  it("BR-17: due gruppi con lo stesso name_norm sono rifiutati dal DB", async () => {
    await insertGroup("Famiglia");
    await expect(
      env.DB.prepare("INSERT INTO groups (name, name_norm) VALUES ('FAMIGLIA', 'famiglia')").run(),
    ).rejects.toThrow();
  });

  it("BR-06: due occorrenze con la stessa (person_id, year) sono rifiutate", async () => {
    const pid = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const ins = () =>
      env.DB.prepare(
        "INSERT INTO occurrences (person_id, year, effective_date, created_at) VALUES (?, 2026, '2026-03-14', 'x')",
      )
        .bind(pid)
        .run();
    await ins();
    await expect(ins()).rejects.toThrow();
  });

  it("N-02: due invii con la stessa (occurrence_id, kind, ref) sono rifiutati", async () => {
    const pid = await insertPerson({ fullName: "Marco Rossi", day: 14, month: 3 });
    const occ = await env.DB.prepare(
      "INSERT INTO occurrences (person_id, year, effective_date, created_at) VALUES (?, 2026, '2026-03-14', 'x') RETURNING id",
    )
      .bind(pid)
      .first<{ id: number }>();
    const ins = () =>
      env.DB.prepare(
        "INSERT INTO deliveries (occurrence_id, kind, ref, status, local_date) VALUES (?, 'giorno', 9, 'inviato', '2026-03-14')",
      )
        .bind(occ!.id)
        .run();
    await ins();
    await expect(ins()).rejects.toThrow();
  });

  it("A-06: la tabella settings nasce vuota", async () => {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first<{ n: number }>();
    expect(r!.n).toBe(0);
  });
});
