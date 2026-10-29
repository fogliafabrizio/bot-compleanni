import { bench, describe } from "vitest";
import { buildReminderData, renderByKind, type PersonRowLike } from "../src/bot/promemoria";
import { MAX_SENDS_PER_RUN, type Priority } from "../src/config";
import { planTargets, selectNew, splitByCap, type Candidate } from "../src/domain/schedule";
import { detectGap } from "../src/domain/stato";
import { T as TEXTS } from "../src/texts";
import { toLocalClock, type LocalDate } from "../src/time";

// Parti pure dell'esecuzione delle 13 con 200 persone e 40 invii (research R-09).
// Soglia: < 3 ms per iterazione. Solo dati sintetici, nessun dato reale.

const T: LocalDate = { year: 2027, month: 3, day: 14 };
const PRIORITIES: Priority[] = ["alta", "media", "bassa"];
const DATES = [21, 16, 15, 14, 13];

interface Row extends PersonRowLike {
  id: number;
  priority: Priority;
  created_at: string;
}

const rows: Row[] = Array.from({ length: 200 }, (_, i) => {
  const onDate = i < 40;
  return {
    id: i + 1,
    full_name: `Persona Sintetica ${i + 1}`,
    nickname: i % 2 === 0 ? `Nick${i}` : null,
    birth_day: onDate ? DATES[i % DATES.length]! : (i % 28) + 1,
    birth_month: onDate ? 3 : 7,
    birth_year: 1980 + (i % 30),
    phone: `+39333${String(1000000 + i)}`,
    instagram: i % 3 === 0 ? `ig_user_${i}` : null,
    telegram: i % 4 === 0 ? `tg_user_${i}` : null,
    custom_message: i % 5 === 0 ? "Auguroni {nome}, buona giornata! 🎉" : null,
    group_names: i % 2 === 0 ? "Lavoro\u001fBeach tennis\u001fFamiglia" : null,
    priority: onDate ? "alta" : PRIORITIES[i % 3]!,
    created_at: "2026-01-01T00:00:00.000Z",
  };
});

const window = {
  slotInstantIso: "2027-03-14T12:00:00.000Z",
  dayStartPrevIso: "2027-03-12T23:00:00.000Z",
  dayStartTodayIso: "2027-03-13T23:00:00.000Z",
};

function cycle(): void {
  const targets = planTargets(T, 13);
  const candidates: Candidate[] = rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    birthDay: r.birth_day,
    birthMonth: r.birth_month,
    createdAt: r.created_at,
  }));
  const fresh = selectNew(candidates, [], targets, window);
  const { claim } = splitByCap(fresh, MAX_SENDS_PER_RUN, []);
  const byId = new Map(rows.map((r) => [r.id, r]));
  let bytes = 0;
  for (const [i, s] of claim.entries()) {
    const data = buildReminderData(byId.get(s.personId)!, {
      actionTarget: { scope: "o", id: 1000 + i },
      year: s.year,
      lastYear: null,
      defaultMessage: null,
    });
    const { text, keyboard } = renderByKind(s.kind, s.ref, data);
    bytes += JSON.stringify({ chat_id: 1001, text, reply_markup: keyboard }).length;
  }
  if (claim.length !== 40 || bytes === 0) throw new Error("scenario non valido");
}

describe("research R-09: ciclo 13:00, 200 persone, 40 invii", () => {
  bench("pianificazione + composizione + serializzazione", cycle);

  // FR-017, research R-11 di 007: atteso < 0,05 ms in più rispetto allo scenario precedente.
  bench("con cron_last_run presente (nessun buco)", () => {
    if (detectGap("2027-03-14T11:00:00.000Z", window.slotInstantIso) !== null) throw new Error("scenario non valido");
    cycle();
  });

  bench("buco + avviso (detectGap, toLocalClock, T.gapAlert)", () => {
    const gap = detectGap("2027-03-14T05:00:00.000Z", window.slotInstantIso);
    if (!gap) throw new Error("scenario non valido");
    const text = TEXTS.gapAlert(toLocalClock(gap.from), toLocalClock(gap.to), T);
    if (JSON.stringify({ chat_id: 1001, text }).length === 0) throw new Error("scenario non valido");
    cycle();
  });
});
