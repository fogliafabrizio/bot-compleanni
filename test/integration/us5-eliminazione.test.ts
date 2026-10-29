import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addToGroup, count, insertGroup, insertPerson, rows } from "../helpers/db";
import { makeDeps, type TestDeps } from "../helpers/deps";
import { cbOf, labels } from "../helpers/fake-telegram";
import { press, say } from "../helpers/send";
import { T } from "../../src/texts";

const tap = (deps: TestDeps, label: string) => press(deps, cbOf(deps.tg.lastKeyboard(), label));

async function seed() {
  await insertPerson({ id: 1, fullName: "Marco Rossi", day: 14, month: 3, year: 1994 });
  await addToGroup(1, await insertGroup("Lavoro"));
  const occ = await env.DB.prepare(
    "INSERT INTO occurrences (person_id, year, effective_date, status, created_at) VALUES (1, 2025, '2025-03-14', 'fatto', 'x') RETURNING id",
  ).first<{ id: number }>();
  await env.DB.prepare(
    "INSERT INTO deliveries (occurrence_id, kind, ref, status, local_date) VALUES (?, 'giorno', 9, 'inviato', '2025-03-14')",
  )
    .bind(occ!.id)
    .run();
}

describe("US5: eliminazione persona", () => {
  it("RF-05, RNF-05: conferma esplicita; Sì elimina persona, appartenenze, occorrenze e invii", async () => {
    await seed();
    const deps = makeDeps();
    await press(deps, "p:x:1");
    expect(deps.tg.lastText()).toBe(T.confirmDeletePerson("Marco Rossi"));
    expect(labels(deps.tg.lastKeyboard())).toEqual(["Sì", "Annulla"]);
    await tap(deps, "Sì");
    expect(await count("persons")).toBe(0);
    expect(await count("person_groups")).toBe(0);
    expect(await count("occurrences")).toBe(0);
    expect(await count("deliveries")).toBe(0);
    expect(await count("groups")).toBe(1);
    expect(deps.tg.lastText()).toBe(T.personDeleted("Marco Rossi"));
  });

  it("RF-05: Annulla non cambia nulla", async () => {
    await seed();
    const deps = makeDeps();
    await press(deps, "p:x:1");
    await tap(deps, "Annulla");
    expect(deps.tg.lastText()).toBe(T.cancelled);
    expect(await count("persons")).toBe(1);
    expect(await count("person_groups")).toBe(1);
    expect(await count("occurrences")).toBe(1);
    expect(await count("deliveries")).toBe(1);
  });

  it("FR-018c: dopo Sì i vecchi pulsanti e /p_<id> non agiscono più", async () => {
    await seed();
    const deps = makeDeps();
    await press(deps, "p:x:1");
    const yes = cbOf(deps.tg.lastKeyboard(), "Sì");
    await press(deps, yes);
    await press(deps, yes);
    expect(deps.tg.lastAnswer()).toBe(T.actionUnavailable);
    await press(deps, "p:x:1");
    expect(deps.tg.lastAnswer()).toBe(T.personNotFound);
    await say(deps, "/p_1");
    expect(deps.tg.lastText()).toBe(T.personNotFound);
  });

  it("R-13: dopo l'eliminazione una nuova persona non riceve lo stesso id", async () => {
    await seed();
    const deps = makeDeps();
    await press(deps, "p:x:1");
    await tap(deps, "Sì");
    const id = await insertPerson({ fullName: "Luca Bianchi", day: 1, month: 1 });
    expect(id).not.toBe(1);
    const [p] = await rows<{ id: number }>("SELECT id FROM persons");
    expect(p!.id).toBe(id);
  });
});
