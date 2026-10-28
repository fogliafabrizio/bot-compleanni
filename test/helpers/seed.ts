import { env } from "cloudflare:test";
import { addToGroup, insertDelivery, insertGroup, insertOccurrence, insertPerson } from "./db";

// Dati completi per backup e ripristino (feature 004): persone con e senza anno, 29/02, gruppi,
// appartenenze, occorrenze con esiti diversi, un invio e messaggio di default personalizzato.
export const SEED_ISO = "2026-01-02T10:00:00.000Z";

export async function seedFullData(): Promise<void> {
  await insertPerson({
    id: 1,
    fullName: "Marco Rossi",
    nickname: "Marchino",
    day: 14,
    month: 3,
    year: 1985,
    phone: "+393331234567",
    instagram: "marco.ig",
    telegram: "marco_tg",
    priority: "alta",
    customMessage: "Auguri {nome}!",
    createdAt: SEED_ISO,
  });
  await insertPerson({ id: 2, fullName: "Anna Bianchi", day: 29, month: 2, year: null, priority: "bassa", createdAt: SEED_ISO });
  await insertPerson({ id: 4, fullName: "Luca Verdi", day: 1, month: 1, year: 2000, createdAt: SEED_ISO });
  const fam = await insertGroup("Famiglia");
  const ami = await insertGroup("Amici");
  await addToGroup(1, fam);
  await addToGroup(1, ami);
  await addToGroup(2, ami);
  await insertOccurrence({ personId: 1, year: 2026, effectiveDate: "2026-03-14", status: "fatto", outcomeAt: SEED_ISO });
  await insertOccurrence({ personId: 2, year: 2026, effectiveDate: "2026-02-28", status: "saltato", outcomeAt: SEED_ISO });
  const occ = await insertOccurrence({ personId: 4, year: 2026, effectiveDate: "2026-01-01", status: "non_confermato", outcomeAt: SEED_ISO });
  await insertDelivery({ occurrenceId: occ, kind: "giorno", ref: 9, status: "inviato", localDate: "2026-01-01" });
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('default_message', 'Buon compleanno {nome}!', ?)")
    .bind(SEED_ISO)
    .run();
}
