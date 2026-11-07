import { describe, expect, it } from "vitest";
import { SLOT_HOURS, type Priority } from "../../src/config";
import {
  birthPairsFor,
  planTargets,
  selectNew,
  splitByCap,
  type Candidate,
  type OccurrenceInfo,
  type Target,
} from "../../src/domain/schedule";
import { addDays, localDayStartUtc, toLocal, type LocalDate } from "../../src/time";

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

describe("RF-10, §7 (v1.3): slot delle 00:00 per la priorità Alta", () => {
  it("RF-10: SLOT_HOURS = [0, 9, 13, 18, 21] derivato dai profili", () => {
    expect([...SLOT_HOURS]).toEqual([0, 9, 13, 18, 21]);
  });

  it("RF-10: planTargets(T, 0) = un solo target giorno con ref 0 sulla data T", () => {
    expect(kinds(planTargets(T, 0))).toEqual(["giorno/0@2027-03-14"]);
  });

  it("RF-10: planTargets(T, 9) invariato", () => {
    expect(kinds(planTargets(T, 9))).toEqual(["giorno/9@2027-03-14"]);
  });

  it("§7: a ora 0 ammessa solo Alta, Media e Bassa no", () => {
    const cs = [cand(1, "alta", 14, 3), cand(2, "media", 14, 3), cand(3, "bassa", 14, 3)];
    expect(selectNew(cs, [], planTargets(T, 0), win(T, 0))).toEqual([
      { personId: 1, kind: "giorno", ref: 0, year: 2027, effectiveDate: "2027-03-14" },
    ]);
  });

  it("BR-10: Alta creata alle 23:30 del giorno prima → sì; alle 00:00:00, 00:30 o 10:00 → no", () => {
    const at = (createdAt: string) => selectNew([cand(1, "alta", 14, 3, createdAt)], [], planTargets(T, 0), win(T, 0)).length;
    expect(at("2027-03-13T22:30:00.000Z")).toBe(1); // 23:30 locali del 13/03
    expect(at("2027-03-13T23:00:00.000Z")).toBe(0); // 00:00:00 del 14/03
    expect(at("2027-03-13T23:30:00.000Z")).toBe(0); // 00:30
    expect(at("2027-03-14T09:00:00.000Z")).toBe(0); // 10:00
  });

  it("BR-07: occorrenza fatto o saltato → nessun invio delle 00:00", () => {
    const cs = [cand(1, "alta", 14, 3), cand(2, "alta", 14, 3)];
    const occ: OccurrenceInfo[] = [
      { personId: 1, year: 2027, status: "fatto", hasDaySend: false },
      { personId: 2, year: 2027, status: "saltato", hasDaySend: false },
    ];
    expect(selectNew(cs, occ, planTargets(T, 0), win(T, 0))).toEqual([]);
  });

  it("BR-04: a ora 0 il 28/02/2027 include i nati il 29/02; nel 2028 no", () => {
    const pairsAt = (iso: string) => {
      const l = toLocal(new Date(iso));
      return planTargets({ year: l.year, month: l.month, day: l.day }, l.hour).map((t) => t.pairs);
    };
    expect(pairsAt("2027-02-27T23:00:00Z")).toEqual([
      [
        [2, 28],
        [2, 29],
      ],
    ]);
    expect(pairsAt("2028-02-28T23:00:00Z")).toEqual([[[2, 29]]]);
    expect(pairsAt("2028-02-27T23:00:00Z")).toEqual([[[2, 28]]]);
  });

  it("BR-24: nei giorni del cambio d'ora il target giorno 0 cade sulla data giusta", () => {
    const at = (iso: string) => {
      const l = toLocal(new Date(iso));
      expect(l.hour).toBe(0);
      return kinds(planTargets({ year: l.year, month: l.month, day: l.day }, l.hour));
    };
    expect(at("2026-03-28T23:00:00Z")).toEqual(["giorno/0@2026-03-29"]);
    expect(at("2026-10-24T22:00:00Z")).toEqual(["giorno/0@2026-10-25"]);
  });

  it("BR-05: scheduledAt 2026-12-31T23:00Z → target giorno 0 del 01/01/2027, anno 2027", () => {
    const l = toLocal(new Date("2026-12-31T23:00:00Z"));
    const d = { year: l.year, month: l.month, day: l.day };
    const [t] = planTargets(d, l.hour);
    expect(t).toMatchObject({ kind: "giorno", ref: 0, year: 2027, effectiveDate: "2027-01-01" });
    expect(selectNew([cand(1, "alta", 1, 1)], [], planTargets(d, 0), win(d, 0))).toEqual([
      { personId: 1, kind: "giorno", ref: 0, year: 2027, effectiveDate: "2027-01-01" },
    ]);
  });
});
