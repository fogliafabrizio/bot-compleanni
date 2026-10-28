import { MIN_BIRTH_YEAR, OUTCOME_CORRECTION_DAYS, UPCOMING_MAX_DAYS } from "../config";
import {
  groupLookupStatements,
  groupNamesStatement,
  listPersonsStatement,
  overdueStatement,
  rowToListPerson,
  yearStatements,
  type ListOccurrenceRow,
  type ListPersonRow,
} from "../db/viste";
import type { OccurrenceStatus } from "../domain/schedule";
import { normKey } from "../domain/text";
import {
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
  type ListRow,
} from "../domain/viste";
import { MONTHS_IT, T } from "../texts";
import { toLocal } from "../time";
import { reply, type Ctx } from "./context";
import { formatRows, plainLine, sendList } from "./liste";
import { showScheda } from "./scheda";

// Comandi delle viste (feature 003, contracts/comandi.md). Ogni comando fa una sola andata a D1
// (research R-08); le liste non hanno tastiera (FR-004, RNF-14).

// FR-010, FR-014: gruppo inesistente + elenco dei gruppi esistenti.
export async function replyGroupNotFound(ctx: Ctx, query: string, allNames: readonly string[]): Promise<void> {
  await reply(ctx, `${T.groupNotFound(query)}\n${existingGroupsText(allNames)}`);
}

const existingGroupsText = (names: readonly string[]) => (names.length > 0 ? T.existingGroups(names.join(", ")) : T.noGroups);

// Persone di un gruppo per nome normalizzato; null se il gruppo non esiste (risposta già inviata).
async function lookupGroup(ctx: Ctx, query: string): Promise<{ name: string; people: ListPersonRow[] } | null> {
  const { db } = ctx.deps;
  const [group, people, all] = await db.batch(groupLookupStatements(db, normKey(query)));
  const found = group?.results[0] as { id: number; name: string } | undefined;
  if (!found) {
    await replyGroupNotFound(ctx, query, ((all?.results ?? []) as { name: string }[]).map((r) => r.name));
    return null;
  }
  return { name: found.name, people: (people?.results ?? []) as ListPersonRow[] };
}

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

// RF-17
export async function showProssimi(ctx: Ctx, args: string): Promise<void> {
  const parsed = parseUpcomingArgs(args);
  if (!parsed.ok) {
    await reply(ctx, T.upcomingDaysRange(UPCOMING_MAX_DAYS));
    return;
  }
  let people: ListPersonRow[];
  let groupName: string | null = null;
  if (parsed.group !== null) {
    const found = await lookupGroup(ctx, parsed.group);
    if (!found) return;
    people = found.people;
    groupName = found.name;
  } else {
    people = await allPersons(ctx);
  }
  const rows = upcoming(people.map(rowToListPerson), toLocal(ctx.deps.now()), parsed.days);
  if (rows.length === 0) await reply(ctx, T.upcomingNone(parsed.days, groupName));
  else await sendList(ctx, T.upcomingHeader(parsed.days, groupName), formatRows(rows));
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

// RF-19
export async function showGruppo(ctx: Ctx, args: string): Promise<void> {
  const query = args.trim();
  if (query === "") {
    const { results } = await groupNamesStatement(ctx.deps.db).all<{ name: string }>();
    await reply(ctx, `${T.groupUsage}\n${existingGroupsText(results.map((r) => r.name))}`);
    return;
  }
  const found = await lookupGroup(ctx, query);
  if (!found) return;
  if (found.people.length === 0) {
    await reply(ctx, T.groupEmpty(found.name));
    return;
  }
  const rows = sortByNextBirthday(found.people.map(rowToListPerson), toLocal(ctx.deps.now()));
  await sendList(ctx, T.groupHeader(found.name), formatRows(rows));
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
