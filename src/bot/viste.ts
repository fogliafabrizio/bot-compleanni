import { MIN_BIRTH_YEAR, OUTCOME_CORRECTION_DAYS, UPCOMING_MAX_DAYS, UPCOMING_WIDE_DAYS } from "../config";
import {
  groupCardStatements,
  listPersonsStatement,
  membersOf,
  overdueStatement,
  rowToListPerson,
  yearStatements,
  type ListOccurrenceRow,
  type ListPersonRow,
} from "../db/viste";
import type { OccurrenceStatus } from "../domain/schedule";
import { groupKey, nameHash } from "../domain/text";
import {
  adjacentMonths,
  canWidenUpcoming,
  findGroups,
  matchSearch,
  monthRows,
  parseDateString,
  parseMonth,
  parseUpcomingArgs,
  parseYear,
  pendingWindow,
  referenceYear,
  sortByDate,
  sortByNextBirthday,
  upcoming,
  yearNavigation,
  type ListPerson,
  type ListRow,
} from "../domain/viste";
import { button, keyboard } from "../telegram/keyboard";
import { MONTHS_CAP, MONTHS_IT, T } from "../texts";
import { toLocal } from "../time";
import { answerCallback, reply, type Ctx } from "./context";
import { cardFromBatch, readGroupSearch, replyGroupGone, showGroupChoice, showGroups } from "./gruppi";
import { formatRows, plainLine, sendList } from "./liste";
import { showScheda } from "./scheda";

// Comandi delle viste (feature 003, contracts/comandi.md). Ogni comando fa una sola andata a D1
// (research R-08); nessun pulsante sulle righe delle persone (FR-004). Dalla 009 (RNF-14) /prossimi,
// /mese e /anno hanno al più 2 pulsanti di passo successivo sull'ultimo messaggio.

async function allPersons(ctx: Ctx, month?: number): Promise<ListPersonRow[]> {
  return (await listPersonsStatement(ctx.deps.db, month).all<ListPersonRow>()).results;
}

const occurrenceRow = (r: ListOccurrenceRow): ListRow & { status: OccurrenceStatus } => {
  const person = rowToListPerson(r);
  return {
    person,
    date: parseDateString(r.effective_date),
    age: person.birthYear !== null ? r.year - person.birthYear : null,
    status: r.status,
  };
};

// RF-17, FR-011: con il testo di un gruppo, ricerca morbida (BR-26) in una sola batch: un gruppo →
// lista filtrata con il nome salvato; più → scelta g2:p che conserva i giorni; nessuno → avviso +
// elenco. Testo con chiave vuota = nessun filtro (003 FR-009).
export async function showProssimi(ctx: Ctx, args: string): Promise<void> {
  const parsed = parseUpcomingArgs(args);
  if (!parsed.ok) {
    await reply(ctx, T.upcomingDaysRange(UPCOMING_MAX_DAYS));
    return;
  }
  const query = parsed.group !== null && groupKey(parsed.group) !== "" ? parsed.group : null;
  if (query === null) {
    await sendUpcoming(ctx, (await allPersons(ctx)).map(rowToListPerson), parsed.days, null);
    return;
  }
  const { groups, memberships, ungrouped } = await readGroupSearch(ctx);
  const found = findGroups(groups, query);
  if (found.kind === "one") await sendUpcoming(ctx, membersOf(memberships, found.group.id), parsed.days, found.group);
  else if (found.kind === "many") await showGroupChoice(ctx, T.groupsMany(query), found.groups, parsed.days);
  else await showGroups(ctx, T.groupNoMatch(query), { groups, ungrouped });
}

// Tocco g2:p (FR-011, FR-005): gruppo assente o nome cambiato → non esiste più.
export async function showProssimiForGroup(ctx: Ctx, groupId: number, hash: string, days: number): Promise<void> {
  const { db } = ctx.deps;
  const card = cardFromBatch(await db.batch(groupCardStatements(db, groupId)));
  if (!card || nameHash(card.group.name) !== hash) {
    await replyGroupGone(ctx);
    return;
  }
  await sendUpcoming(ctx, card.people, days, card.group);
}

// Tocco s:u [Prossimi 90 giorni] senza filtro (RF-17, FR-018): come /prossimi 90.
export async function showProssimiWide(ctx: Ctx): Promise<void> {
  await sendUpcoming(ctx, (await allPersons(ctx)).map(rowToListPerson), UPCOMING_WIDE_DAYS, null);
}

// RF-17, FR-018: sotto i 90 giorni [Prossimi 90 giorni] sull'ultimo messaggio, anche con la lista
// vuota: s:u senza filtro, g2:p:<id>:<h>:90 con il gruppo (stessa validazione al tocco di 005).
async function sendUpcoming(
  ctx: Ctx,
  people: readonly ListPerson[],
  days: number,
  group: { id: number; name: string } | null,
): Promise<void> {
  const rows = upcoming(people, toLocal(ctx.deps.now()), days);
  const groupName = group?.name ?? null;
  const wide = group
    ? button(T.btnUpcomingWide, { kind: "group", action: "p", groupId: group.id, nameHash: nameHash(group.name), days: UPCOMING_WIDE_DAYS })
    : button(T.btnUpcomingWide, { kind: "static", scope: "s", action: "u" });
  const kb = canWidenUpcoming(days) ? keyboard([[wide]]) : undefined;
  if (rows.length === 0) await reply(ctx, T.upcomingNone(days, groupName), kb);
  else await sendList(ctx, T.upcomingHeader(days, groupName), formatRows(rows), kb);
}

// RF-18
export async function showCerca(ctx: Ctx, args: string): Promise<void> {
  const query = args.trim();
  if (query === "") {
    await reply(ctx, T.searchUsage);
    return;
  }
  const found = matchSearch((await allPersons(ctx)).map(rowToListPerson), query);
  const [only] = found;
  if (found.length === 0) await reply(ctx, T.searchNone(query));
  else if (found.length === 1 && only) await showScheda(ctx, only.id);
  else await sendList(ctx, T.searchHeader(query), formatRows(sortByNextBirthday(found, toLocal(ctx.deps.now()))));
}

// RF-20
export async function showMese(ctx: Ctx, args: string): Promise<void> {
  const today = toLocal(ctx.deps.now());
  const parsed = parseMonth(args, today);
  if (!parsed.ok) {
    await reply(ctx, T.monthInvalid);
    return;
  }
  const monthName = MONTHS_IT[parsed.month - 1] ?? "";
  const rows = monthRows((await allPersons(ctx, parsed.month)).map(rowToListPerson), parsed.month, today);
  // RNF-14, FR-019: [◀️ <mese>] [<mese> ▶️] sull'ultimo messaggio, anche con la vista vuota.
  const { prev, next } = adjacentMonths(parsed.month);
  const kb = keyboard([
    [
      button(T.btnPrevMonth(MONTHS_CAP[prev - 1] ?? ""), { kind: "static", scope: "s", action: "m", id: prev }),
      button(T.btnNextMonth(MONTHS_CAP[next - 1] ?? ""), { kind: "static", scope: "s", action: "m", id: next }),
    ],
  ]);
  if (rows.length === 0) await reply(ctx, T.monthNone(monthName), kb);
  else await sendList(ctx, T.monthHeader(monthName, referenceYear(parsed.month, today)), formatRows(rows), kb);
}

// Tocco s:m:<mese> (RF-20, FR-019): anno di riferimento ricalcolato al tocco da showMese.
export async function showMeseFromButton(ctx: Ctx, id?: number): Promise<void> {
  if (id === undefined || id < 1 || id > 12) await answerCallback(ctx, T.actionUnavailable);
  else await showMese(ctx, String(id));
}

// RF-21
export async function showScaduti(ctx: Ctx): Promise<void> {
  const w = pendingWindow(toLocal(ctx.deps.now()));
  const { results } = await overdueStatement(ctx.deps.db, w.from, w.to).all<ListOccurrenceRow>();
  const rows = sortByDate(results.map(occurrenceRow));
  if (rows.length === 0) {
    await reply(ctx, T.overdueNone(OUTCOME_CORRECTION_DAYS));
    return;
  }
  // La query esclude "fatto"; il ramo serve solo al tipo.
  const label = (s: OccurrenceStatus) => (s === "fatto" ? T.outcome.fatto : T.listOutcome[s]);
  await sendList(ctx, T.overdueHeader(OUTCOME_CORRECTION_DAYS), formatRows(rows, (r) => label(r.status)));
}

// RF-22
export async function showAnno(ctx: Ctx, args: string): Promise<void> {
  const { db } = ctx.deps;
  const today = toLocal(ctx.deps.now());
  const parsed = parseYear(args, today);
  if (!parsed.ok) {
    await reply(ctx, T.yearInvalid(MIN_BIRTH_YEAR, today.year));
    return;
  }
  const [counts, skipped, streak, prevHistory] = await db.batch(yearStatements(db, parsed.year));
  const n: Record<string, number> = {};
  for (const r of (counts?.results ?? []) as { status: string; n: number }[]) n[r.status] = r.n;
  const skippedRows = sortByDate(((skipped?.results ?? []) as ListOccurrenceRow[]).map(occurrenceRow));
  const streakRows = sortByDate(((streak?.results ?? []) as ListOccurrenceRow[]).map(occurrenceRow));
  // Una sola larghezza di colonna per le due sezioni (contracts/liste.md).
  const lines = formatRows([...skippedRows, ...streakRows]);
  const skippedLines = lines.slice(0, skippedRows.length);
  const streakLines = lines.slice(skippedRows.length);
  const none = [plainLine(T.yearNone)];
  // RNF-14, FR-020: ◀️ solo con storico chiuso nell'anno prima, ▶️ solo prima dell'anno corrente.
  const nav = yearNavigation(parsed.year, today.year, ((prevHistory?.results[0] as { has: number } | undefined)?.has ?? 0) === 1);
  const navRow = [
    ...(nav.prev !== null ? [button(T.btnPrevYear(nav.prev), { kind: "static", scope: "s", action: "y", id: nav.prev })] : []),
    ...(nav.next !== null ? [button(T.btnNextYear(nav.next), { kind: "static", scope: "s", action: "y", id: nav.next })] : []),
  ];
  await sendList(ctx, T.yearHeader(parsed.year), [
    ...T.yearCounts(n.fatto ?? 0, n.saltato ?? 0, n.non_confermato ?? 0).map(plainLine),
    plainLine(""),
    plainLine(T.yearSkipped),
    ...(skippedLines.length > 0 ? skippedLines : none),
    plainLine(""),
    plainLine(T.yearStreak),
    ...(streakLines.length > 0 ? streakLines : none),
  ], navRow.length > 0 ? keyboard([navRow]) : undefined);
}

// Tocco s:y:<anno> (RF-22, FR-020): stesso controllo di /anno <anno>, calcolato al tocco.
export async function showAnnoFromButton(ctx: Ctx, id?: number): Promise<void> {
  if (id === undefined || !parseYear(String(id), toLocal(ctx.deps.now())).ok) await answerCallback(ctx, T.actionUnavailable);
  else await showAnno(ctx, String(id));
}
