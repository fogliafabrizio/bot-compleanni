import { describe, expect, it } from "vitest";
import { OWNER_ID } from "../helpers/constants";
import { SEED_ISO, seedFullData } from "../helpers/seed";
import { makeDeps } from "../helpers/deps";
import { say } from "../helpers/send";

const ISO = SEED_ISO;

describe("US2: /backup (RF-26, FR-017)", () => {
  it("RF-26, FR-017: /backup invia il JSON completo e coerente con D1 nella chat del proprietario", async () => {
    await seedFullData();
    const deps = makeDeps();
    await say(deps, "/backup");
    const [doc] = deps.tg.documents();
    expect(doc).toMatchObject({ chatId: OWNER_ID, name: "compleanni-backup-2026-10-28.json", mimeType: "application/json" });
    expect(doc!.caption).toBe("Backup: 3 persone, 2 gruppi, 3 occorrenze. Per ripristinarlo usa /ripristina.");
    expect(doc!.text.startsWith("{")).toBe(true);
    const b = JSON.parse(doc!.text) as Record<string, unknown>;
    expect(b).toEqual({
      format: "bot-compleanni-backup",
      version: 1,
      created_at: "2026-10-28T10:00:00.000Z",
      persons: [
        {
          id: 1,
          full_name: "Marco Rossi",
          nickname: "Marchino",
          birth_day: 14,
          birth_month: 3,
          birth_year: 1985,
          phone: "+393331234567",
          instagram: "marco.ig",
          telegram: "marco_tg",
          priority: "alta",
          custom_message: "Auguri {nome}!",
          created_at: ISO,
          updated_at: ISO,
        },
        {
          id: 2,
          full_name: "Anna Bianchi",
          nickname: null,
          birth_day: 29,
          birth_month: 2,
          birth_year: null,
          phone: null,
          instagram: null,
          telegram: null,
          priority: "bassa",
          custom_message: null,
          created_at: ISO,
          updated_at: ISO,
        },
        {
          id: 4,
          full_name: "Luca Verdi",
          nickname: null,
          birth_day: 1,
          birth_month: 1,
          birth_year: 2000,
          phone: null,
          instagram: null,
          telegram: null,
          priority: "media",
          custom_message: null,
          created_at: ISO,
          updated_at: ISO,
        },
      ],
      groups: [
        { id: 1, name: "Famiglia" },
        { id: 2, name: "Amici" },
      ],
      person_groups: [
        { person_id: 1, group_id: 1 },
        { person_id: 1, group_id: 2 },
        { person_id: 2, group_id: 2 },
      ],
      occurrences: [
        { id: 1, person_id: 1, year: 2026, effective_date: "2026-03-14", status: "fatto", outcome_at: ISO, created_at: "2026-10-28T10:00:00.000Z" },
        { id: 2, person_id: 2, year: 2026, effective_date: "2026-02-28", status: "saltato", outcome_at: ISO, created_at: "2026-10-28T10:00:00.000Z" },
        {
          id: 3,
          person_id: 4,
          year: 2026,
          effective_date: "2026-01-01",
          status: "non_confermato",
          outcome_at: ISO,
          created_at: "2026-10-28T10:00:00.000Z",
        },
      ],
      settings: { default_message: "Buon compleanno {nome}!" },
    });
  });

  it("RF-26: zero persone → file comunque inviato", async () => {
    const deps = makeDeps();
    await say(deps, "/backup");
    const [doc] = deps.tg.documents();
    expect(doc!.caption).toBe("Backup: 0 persone, 0 gruppi, 0 occorrenze. Per ripristinarlo usa /ripristina.");
    expect(JSON.parse(doc!.text)).toMatchObject({ persons: [], groups: [], person_groups: [], occurrences: [], settings: { default_message: null } });
  });
});
