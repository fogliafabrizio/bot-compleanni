import { MIN_BIRTH_YEAR, OUTCOME_CORRECTION_DAYS, UPCOMING_MAX_DAYS } from "../config";
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
  type ListPerson,
  type ListRow,
} from "../domain/viste";
import { MONTHS_IT, T } from "../texts";
import { toLocal } from "../time";
import { reply, type Ctx } from "./context";
import { cardFromBatch, readGroupSearch, replyGroupGone, showGroupChoice, showGroups } from "./gruppi";
import { formatRows, plainLine, sendList } from "./liste";
import { showScheda } from "./scheda";

// Comandi delle viste (feature 003, contracts/comandi.md). Ogni comando fa una sola andata a D1
// (research R-08); le liste non hanno tastiera (FR-004, RNF-14).

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
  const { groups, memberships } = await readGroupSearch(ctx);
  const found = findGroups(groups, query);
  if (found.kind === "one") await sendUpcoming(ctx, membersOf(memberships, found.group.id), parsed.days, found.group.name);
  else if (found.kind === "many") await showGroupChoice(ctx, T.groupsMany(query), found.groups, parsed.days);
  else await showGroups(ctx, T.groupNoMatch(query), groups);
}

// Tocco g2:p (FR-011, FR-005): gruppo assente o nome cambiato → non esiste più.
export async function showProssimiForGroup(ctx: Ctx, groupId: number, hash: string, days: number): Promise<void> {
  const { db } = ctx.deps;
  const card = cardFromBatch(await db.batch(groupCardStatements(db, groupId)));
  if (!card || nameHash(card.group.name) !== hash) {
    await replyGroupGone(ctx);
    return;
  }
  await sendUpcoming(ctx, card.people, days, card.group.name);
}

async function sendUpcoming(ctx: Ctx, people: readonly ListPerson[], days: number, groupName: string | null): Promise<void> {
  const rows = upcoming(people, toLocal(ctx.deps.now()), days);
  if (rows.length === 0) await reply(ctx, T.upcomingNone(days, groupName));
  else await sendList(ctx, T.upcomingHeader(days, groupName), formatRows(rows));
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
  if (rows.length === 0) await reply(ctx, T.monthNone(monthName));
  else await sendList(ctx, T.monthHeader(monthName, referenceYear(parsed.month, today)), formatRows(rows));
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
  const [counts, skipped, streak] = await db.batch(yearStatements(db, parsed.year));
  const n: Record<string, number> = {};
  for (const r of (counts?.results ?? []) as { status: string; n: number }[]) n[r.status] = r.n;
  const skippedRows = sortByDate(((skipped?.results ?? []) as ListOccurrenceRow[]).map(occurrenceRow));
  const streakRows = sortByDate(((streak?.results ?? []) as ListOccurrenceRow[]).map(occurrenceRow));
  // Una sola larghezza di colonna per le due sezioni (contracts/liste.md).
  const lines = formatRows([...skippedRows, ...streakRows]);
  const skippedLines = lines.slice(0, skippedRows.length);
  const streakLines = lines.slice(skippedRows.length);
  const none = [plainLine(T.yearNone)];
  await sendList(ctx, T.yearHeader(parsed.year), [
    ...T.yearCounts(n.fatto ?? 0, n.saltato ?? 0, n.non_confermato ?? 0).map(plainLine),
    plainLine(""),
    plainLine(T.yearSkipped),
    ...(skippedLines.length > 0 ? skippedLines : none),
    plainLine(""),
    plainLine(T.yearStreak),
    ...(streakLines.length > 0 ? streakLines : none),
  ]);
}
