import { describe, expect, it } from "vitest";
import type { Priority } from "../../src/config";
import {
  birthPairsFor,
  planTargets,
  selectNew,
  splitByCap,
  type Candidate,
  type OccurrenceInfo,
  type Target,
} from "../../src/domain/schedule";
import { addDays, localDayStartUtc, type LocalDate } from "../../src/time";

const T: LocalDate = { year: 2027, month: 3, day: 14 };
const OLD = "2026-01-01T00:00:00.000Z";

function cand(id: number, priority: Priority, day: number, month: number, createdAt = OLD): Candidate {
  return { id, priority, birthDay: day, birthMonth: month, createdAt };
}

function win(today: LocalDate, hour: number) {
  const start = localDayStartUtc(today);
  return {
    slotInstantIso: new Date(start.getTime() + hour * 3_600_000).toISOString(),
    dayStartPrevIso: localDayStartUtc(addDays(today, -1)).toISOString(),
    dayStartTodayIso: start.toISOString(),
  };
}

const kinds = (targets: Target[]) => targets.map((t) => `${t.kind}/${t.ref}@${t.effectiveDate}`);

describe("§7, N-01: piano dell'ora (parte giorno)", () => {
  it.each([9, 13, 18, 21])("§7: alle %i target giorno sulla data di oggi", (h) => {
    expect(kinds(planTargets(T, h))).toContain(`giorno/${h}@2027-03-14`);
  });

  it("N-05: alle 10 nessun target giorno", () => {
    expect(planTargets(T, 10).filter((t) => t.kind === "giorno")).toEqual([]);
  });

  it("BR-04: il 28/02 non bisestile include i nati il 29/02", () => {
    const [t] = planTargets({ year: 2027, month: 2, day: 28 }, 9);
    expect(t!.pairs).toEqual([
      [2, 28],
      [2, 29],
    ]);
    expect(birthPairsFor({ year: 2028, month: 2, day: 28 })).toEqual([[2, 28]]);
    expect(birthPairsFor({ year: 2028, month: 2, day: 29 })).toEqual([[2, 29]]);
  });
});

describe("§7, BR-10: selezione degli invii nuovi (parte giorno)", () => {
  it("§7: Media esclusa alle 21, Bassa esclusa alle 13", () => {
    const cs = [cand(1, "alta", 14, 3), cand(2, "media", 14, 3), cand(3, "bassa", 14, 3)];
    const at = (h: number) => selectNew(cs, [], planTargets(T, h), win(T, h)).filter((s) => s.kind === "giorno").map((s) => s.personId);
    expect(at(9)).toEqual([1, 2, 3]);
    expect(at(13)).toEqual([1, 2]);
    expect(at(18)).toEqual([1, 2, 3]);
    expect(at(21)).toEqual([1]);
  });

  it("BR-07: occorrenza chiusa esclusa, aperta inclusa", () => {
    const cs = [cand(1, "alta", 14, 3), cand(2, "alta", 14, 3)];
    const occ: OccurrenceInfo[] = [
      { personId: 1, year: 2027, status: "fatto", hasDaySend: true },
      { personId: 2, year: 2027, status: "aperta", hasDaySend: true },
    ];
    expect(selectNew(cs, occ, planTargets(T, 9), win(T, 9)).map((s) => s.personId)).toEqual([2]);
  });

  it("BR-10: persona creata dopo l'istante dello slot esclusa", () => {
    const created = "2027-03-14T09:30:00.000Z"; // 10:30 locali
    const cs = [cand(1, "media", 14, 3, created)];
    expect(selectNew(cs, [], planTargets(T, 9), win(T, 9))).toEqual([]);
    expect(selectNew(cs, [], planTargets(T, 13), win(T, 13)).filter((s) => s.kind === "giorno")).toHaveLength(1);
  });

  it("BR-05: anno ed effective_date del target", () => {
    const [s] = selectNew([cand(1, "alta", 14, 3)], [], planTargets(T, 9), win(T, 9));
    expect(s).toEqual({ personId: 1, kind: "giorno", ref: 9, year: 2027, effectiveDate: "2027-03-14" });
  });

  it("R-05: ordinamento giorno, recupero, pre, poi ID persona", () => {
    const cs = [cand(5, "alta", 21, 3), cand(4, "alta", 13, 3), cand(3, "alta", 14, 3), cand(2, "alta", 15, 3), cand(1, "alta", 14, 3)];
    const order = selectNew(cs, [], planTargets(T, 13), win(T, 13)).map((s) => `${s.kind}:${s.personId}`);
    expect(order).toEqual(["giorno:1", "giorno:3", "recupero:4", "pre:2", "pre:5"]);
  });

  it("R-05: tetto di 40 invii, prima i nuovi poi i retry", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const r = splitByCap(items, 40, ["r1", "r2"]);
    expect(r.claim).toHaveLength(40);
    expect(r.queue).toEqual([40, 41, 42, 43, 44]);
    expect(r.retryClaim).toEqual([]);
    const small = splitByCap([1, 2], 40, ["r1", "r2"]);
    expect(small).toEqual({ claim: [1, 2], queue: [], retryClaim: ["r1", "r2"] });
    expect(splitByCap(Array.from({ length: 39 }, (_, i) => i), 40, ["r1", "r2"]).retryClaim).toEqual(["r1"]);
  });
});

describe("RF-13, BR-11: recupero", () => {
  it("RF-13: alle 13 target recupero/13 sulla data di ieri; nelle altre ore nessuno", () => {
    expect(kinds(planTargets(T, 13))).toContain("recupero/13@2027-03-13");
    for (const h of [0, 9, 12, 14, 18, 21]) expect(planTargets(T, h).some((t) => t.kind === "recupero")).toBe(false);
  });

  it("RF-13: il 01/01 il recupero riguarda il 31/12 dell'anno precedente", () => {
    const t = planTargets({ year: 2027, month: 1, day: 1 }, 13).find((x) => x.kind === "recupero");
    expect(t).toMatchObject({ year: 2026, effectiveDate: "2026-12-31" });
  });

  it("§7: il recupero vale per tutte le priorità", () => {
    const cs = [cand(1, "alta", 13, 3), cand(2, "media", 13, 3), cand(3, "bassa", 13, 3)];
    const r = selectNew(cs, [], planTargets(T, 13), win(T, 13)).filter((s) => s.kind === "recupero");
    expect(r.map((s) => s.personId)).toEqual([1, 2, 3]);
    expect(r[0]).toMatchObject({ ref: 13, year: 2027, effectiveDate: "2027-03-13" });
  });

  it("BR-11: creata prima di D → recupero anche senza occorrenza", () => {
    const r = selectNew([cand(1, "bassa", 13, 3, "2027-03-12T22:59:59.000Z")], [], planTargets(T, 13), win(T, 13));
    expect(r.filter((s) => s.kind === "recupero")).toHaveLength(1);
  });

  it("BR-11: creata durante D → solo con un invio giorno inviato o in_invio", () => {
    const during = "2027-03-13T15:00:00.000Z";
    const cs = [cand(1, "media", 13, 3, during)];
    const t = planTargets(T, 13);
    const rec = (occ: OccurrenceInfo[]) => selectNew(cs, occ, t, win(T, 13)).filter((s) => s.kind === "recupero");
    expect(rec([])).toEqual([]);
    expect(rec([{ personId: 1, year: 2027, status: "aperta", hasDaySend: false }])).toEqual([]);
    expect(rec([{ personId: 1, year: 2027, status: "aperta", hasDaySend: true }])).toHaveLength(1);
  });

  it("BR-11: creata dopo la fine di D → mai", () => {
    const cs = [cand(1, "alta", 13, 3, "2027-03-13T23:00:00.000Z")];
    const occ: OccurrenceInfo[] = [{ personId: 1, year: 2027, status: "aperta", hasDaySend: true }];
    expect(selectNew(cs, occ, planTargets(T, 13), win(T, 13)).filter((s) => s.kind === "recupero")).toEqual([]);
  });
});

describe("RF-09: pre-reminder", () => {
  it("RF-09: alle 13 target pre/N sulle date T+N", () => {
    const k = kinds(planTargets(T, 13));
    expect(k).toEqual(expect.arrayContaining(["pre/7@2027-03-21", "pre/2@2027-03-16", "pre/1@2027-03-15"]));
    expect(planTargets(T, 9).some((t) => t.kind === "pre")).toBe(false);
  });

  it("§7: Alta −7, −2, −1; Media solo −1; Bassa nessuno", () => {
    const pre = (p: Priority) =>
      selectNew([cand(1, p, 21, 3), cand(2, p, 16, 3), cand(3, p, 15, 3)], [], planTargets(T, 13), win(T, 13))
        .filter((s) => s.kind === "pre")
        .map((s) => s.ref);
    expect(pre("alta").sort()).toEqual([1, 2, 7]);
    expect(pre("media")).toEqual([1]);
    expect(pre("bassa")).toEqual([]);
  });

  it("BR-05: il 26/12/2026 il pre −7 riguarda il 02/01/2027 e l'occorrenza 2027", () => {
    const d = { year: 2026, month: 12, day: 26 };
    const [s] = selectNew([cand(1, "alta", 2, 1)], [], planTargets(d, 13), win(d, 13));
    expect(s).toEqual({ personId: 1, kind: "pre", ref: 7, year: 2027, effectiveDate: "2027-01-02" });
  });

  it("BR-04: nato il 29/02, anno non bisestile → −1 il 27/02", () => {
    const d = { year: 2027, month: 2, day: 27 };
    const [s] = selectNew([cand(1, "media", 29, 2)], [], planTargets(d, 13), win(d, 13));
    expect(s).toEqual({ personId: 1, kind: "pre", ref: 1, year: 2027, effectiveDate: "2027-02-28" });
  });
});
