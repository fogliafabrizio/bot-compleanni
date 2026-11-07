import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addToGroup, insertGroup, insertPerson } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { say } from "../helpers/send";

// Revisioni v1.2, sezione 🧑 Età di /statistiche (feature 009, US3; REV-010). Date fisse: nessun
// orologio reale.

const AT_29_10_2026 = new Date("2026-10-29T10:00:00.000Z");

async function statistiche(deps: TestDeps): Promise<string[]> {
  deps.tg.reset();
  await say(deps, "/statistiche");
  expect(deps.tg.messages()).toHaveLength(1);
  return deps.tg.messages()[0]!.text.split("\n");
}

// Sezione Età: dal titolo all'ultima riga prima di «✅ Auguri fatti», spazi compressi.
function ageSection(lines: string[]): string[] {
  const from = lines.indexOf("🧑 Età");
  const to = lines.findIndex((l) => l.startsWith("✅ Auguri fatti"));
  return lines.slice(from, to).map((l) => l.replace(/█+/g, "█").replace(/ +/g, " ").trimEnd());
}

const bornOn = (fullName: string, day: number, month: number, year: number | null) => insertPerson({ fullName, day, month, year });

describe("009 US3 — RF-32, BR-03, BR-04: sezione 🧑 Età", () => {
  it("RF-32, FR-011, FR-012 (US3-1): 8, 34, 37, 52 anni → fasce 0-9…50-59, media 33", async () => {
    await bornOn("A", 1, 1, 2018);
    await bornOn("B", 1, 1, 1992);
    await bornOn("C", 1, 1, 1989);
    await bornOn("D", 1, 1, 1974);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual([
      "🧑 Età",
      "0-9 █ 1",
      "10-19 0",
      "20-29 0",
      "30-39 █ 2",
      "40-49 0",
      "50-59 █ 1",
      "Età media: 33 anni",
    ]);
  });

  it("BR-03 (US3-2): 14/03/1994 → 32 anni al 29/10/2026, 31 al 10/03/2026", async () => {
    await bornOn("Marco", 14, 3, 1994);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toContain("Età media: 32 anni");
    expect(ageSection(await statistiche(makeDeps({ now: new Date("2026-03-10T10:00:00.000Z") })))).toContain("Età media: 31 anni");
  });

  it("BR-04 (US3-3): 29/02/2000 al 28/02/2026 → 26 anni", async () => {
    await bornOn("Leo", 29, 2, 2000);
    expect(ageSection(await statistiche(makeDeps({ now: new Date("2026-02-28T10:00:00.000Z") })))).toEqual([
      "🧑 Età",
      "20-29 █ 1",
      "Età media: 26 anni",
    ]);
  });

  it("FR-012 (US3-4): 83 e 91 anni nella fascia 80+", async () => {
    await bornOn("Nonna", 1, 1, 1943);
    await bornOn("Bisnonno", 1, 1, 1935);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual(["🧑 Età", "80+ █ 2", "Età media: 87 anni"]);
  });

  it("FR-013 (US3-5): 23 persone senza anno → richiamo nella riga dell'età media", async () => {
    await bornOn("Con anno", 1, 1, 1992);
    for (let i = 0; i < 23; i++) await bornOn(`Senza ${i}`, 1, 1, null);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 }))).at(-1)).toBe("Età media: 34 anni · senza anno di nascita: 23");
  });

  it("FR-014 (US3-6): nessun anno di nascita → età non disponibile", async () => {
    await bornOn("Senza", 1, 1, null);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual([
      "🧑 Età",
      "Età non disponibile: nessuna persona ha l'anno di nascita.",
    ]);
  });

  it("RF-32, FR-010 (US3-7): «Senza gruppo 12» e le altre righe di 007 invariate", async () => {
    const fam = await insertGroup("Famiglia");
    await addToGroup(await bornOn("In gruppo", 1, 1, 1990), fam);
    for (let i = 0; i < 12; i++) await bornOn(`Sola ${i}`, 1, 1, null);
    const lines = await statistiche(makeDeps({ now: AT_29_10_2026 }));
    expect(lines.slice(0, 6)).toEqual([
      "📊 Statistiche",
      "13 persone · Alta 0 · Media 13 · Bassa 0",
      "Gruppi: Famiglia 1 · Senza gruppo 12",
      "Senza anno di nascita: 12 · Senza contatti: 13",
      "",
      "🎂 Compleanni per mese",
    ]);
  });

  it("FR-010 (US3-8): sezione subito dopo l'istogramma per mese e prima di «✅ Auguri fatti»", async () => {
    await bornOn("A", 1, 1, 1990);
    const lines = await statistiche(makeDeps({ now: AT_29_10_2026 }));
    const dic = lines.findIndex((l) => l.startsWith("Dic "));
    expect(lines.slice(dic + 1, dic + 3)).toEqual(["", "🧑 Età"]);
    expect(lines.at(-1)!.startsWith("✅ Auguri fatti")).toBe(true);
  });

  it("FR-013: tutti con l'anno → nessun richiamo", async () => {
    await bornOn("A", 1, 1, 1990);
    await bornOn("B", 1, 1, 1991);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 }))).at(-1)).toBe("Età media: 36 anni");
  });

  it("FR-013: media 32,5 → 33 (per eccesso)", async () => {
    await bornOn("A", 1, 1, 1994);
    await bornOn("B", 1, 1, 1993);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 }))).at(-1)).toBe("Età media: 33 anni");
  });

  it("FR-014: rubrica vuota → età non disponibile", async () => {
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual([
      "🧑 Età",
      "Età non disponibile: nessuna persona ha l'anno di nascita.",
    ]);
  });

  it("BR-02: nato nel 1900 → 126 anni nella fascia 80+", async () => {
    await bornOn("Centenario", 1, 1, 1900);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual(["🧑 Età", "80+ █ 1", "Età media: 126 anni"]);
  });

  it("FR-026a: anno fuori da BR-02 contato come senza anno, dato invariato", async () => {
    await bornOn("Valida", 1, 1, 1990);
    const fuori = await bornOn("Futuro", 1, 1, 2030);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 }))).at(-1)).toBe("Età media: 36 anni · senza anno di nascita: 1");
    const row = await env.DB.prepare("SELECT birth_year FROM persons WHERE id = ?").bind(fuori).first<{ birth_year: number }>();
    expect(row?.birth_year).toBe(2030);
  });

  it("RF-32: persona in più gruppi contata una volta sola", async () => {
    const fam = await insertGroup("Famiglia");
    const lav = await insertGroup("Lavoro");
    const p = await bornOn("Anna", 1, 1, 1990);
    await addToGroup(p, fam);
    await addToGroup(p, lav);
    expect(ageSection(await statistiche(makeDeps({ now: AT_29_10_2026 })))).toEqual(["🧑 Età", "30-39 █ 1", "Età media: 36 anni"]);
  });

  it("FR-015: nessun nome di persona nella sezione", async () => {
    await insertPerson({ fullName: "Nome Riservato", nickname: "Soprannome", day: 1, month: 1, year: 1990 });
    const text = (await statistiche(makeDeps({ now: AT_29_10_2026 }))).join("\n");
    expect(text).not.toContain("Nome Riservato");
    expect(text).not.toContain("Soprannome");
  });
});

describe("RF-32 (v1.3): pulsante [📝 Profili incompleti] in /statistiche", () => {
  it("RF-32, FR-016: tastiera [📝 Profili incompleti] → s:i sull'ultimo messaggio; sezione Età invariata", async () => {
    await bornOn("A", 1, 1, 2018);
    await bornOn("B", 1, 1, 1992);
    const deps = makeDeps({ now: AT_29_10_2026 });
    const lines = await statistiche(deps);
    const kb = deps.tg.messages().at(-1)!.keyboard;
    expect(kb?.inline_keyboard).toEqual([[{ text: "📝 Profili incompleti", callback_data: "s:i" }]]);
    expect(ageSection(lines)[0]).toBe("🧑 Età");
    expect(lines).toContain("Età media: 21 anni");
  });
});
