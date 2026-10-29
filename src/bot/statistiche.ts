import {
  statisticheReadStatements,
  type StatsGroupRow,
  type StatsMonthRow,
  type StatsPersonsRow,
  type StatsYearRow,
} from "../db/statistiche";
import { formatStatistiche } from "../domain/statistiche";
import type { Ctx } from "./context";
import { sendLines } from "./liste";

// /statistiche (RF-32, contracts/statistiche.md): una batch D1, poi la risposta.
export async function showStatistiche(ctx: Ctx): Promise<void> {
  const { db } = ctx.deps;
  const [personsRes, groupsRes, monthsRes, yearsRes] = await db.batch(statisticheReadStatements(db));
  const p = personsRes?.results[0] as StatsPersonsRow | undefined;
  // Mesi senza compleanni = 0.
  const months = Array.from({ length: 12 }, () => 0);
  for (const r of (monthsRes?.results ?? []) as StatsMonthRow[]) months[r.birth_month - 1] = r.n;
  await sendLines(
    ctx,
    formatStatistiche({
      persons: {
        total: p?.total ?? 0,
        alta: p?.alta ?? 0,
        media: p?.media ?? 0,
        bassa: p?.bassa ?? 0,
        senzaAnno: p?.senza_anno ?? 0,
        senzaContatti: p?.senza_contatti ?? 0,
        senzaGruppo: p?.senza_gruppo ?? 0,
      },
      groups: (groupsRes?.results ?? []) as StatsGroupRow[],
      months,
      years: (yearsRes?.results ?? []) as StatsYearRow[],
    }),
  );
}
