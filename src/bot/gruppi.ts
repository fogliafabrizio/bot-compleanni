import { GROUP_BUTTONS_MAX } from "../config";
import { listWithCounts, type GroupWithCount } from "../db/groups";
import {
  groupCardStatements,
  groupSearchStatements,
  membersOf,
  rowToListPerson,
  type GroupCountRow,
  type ListPersonRow,
  type MembershipRow,
} from "../db/viste";
import { nameHash } from "../domain/text";
import { findGroups, sortByNextBirthday, sortGroups, type ListPerson } from "../domain/viste";
import { button, keyboard } from "../telegram/keyboard";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "../telegram/types";
import { T } from "../texts";
import { toLocal } from "../time";
import type { Ctx } from "./context";
import { formatRows, plainLine, sendLines, type ListLine } from "./liste";

// Viste dei gruppi v1.1: elenco a pulsanti, scheda gruppo (RF-07, RF-19, FR-001…FR-004, FR-008,
// FR-012, FR-013, research R-06, R-08). Solo viste: nessun import da ./flows, che le usa (R-09).

export interface GroupListOptions {
  title: string;
  // o = apre la scheda; p = lista di /prossimi con `days` giorni.
  action: "o" | "p";
  days?: number;
  withNew: boolean;
}

const newGroupButton = () => button(T.btnNewGroup, { kind: "group", action: "n" });

// Puro. 0 gruppi → avviso; fino a GROUP_BUTTONS_MAX → pulsanti a due colonne; oltre → righe di
// testo e invito a scrivere il nome (V-09). ➕ Nuovo gruppo in fondo se `withNew`.
export function renderGroupList(
  groups: readonly GroupWithCount[],
  opts: GroupListOptions,
): { lines: ListLine[]; keyboard?: InlineKeyboardMarkup } {
  const newRow = opts.withNew ? [newGroupButton()] : [];
  if (groups.length === 0) return { lines: [plainLine(T.noGroups)], keyboard: keyboard([newRow]) };
  const sorted = sortGroups(groups);
  if (sorted.length > GROUP_BUTTONS_MAX) {
    return {
      lines: [
        plainLine(opts.title),
        plainLine(""),
        ...sorted.map((g) => plainLine(T.groupLine(g.name, g.members))),
        plainLine(""),
        plainLine(T.groupsTypeName),
      ],
      ...(opts.withNew ? { keyboard: keyboard([newRow]) } : {}),
    };
  }
  const buttons = sorted.map((g) =>
    button(T.groupButton(g.name, g.members), {
      kind: "group",
      action: opts.action,
      groupId: g.id,
      nameHash: nameHash(g.name),
      ...(opts.action === "p" && opts.days !== undefined ? { days: opts.days } : {}),
    }),
  );
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push(newRow);
  return { lines: [plainLine(opts.title)], keyboard: keyboard(rows) };
}

const withPrefix = (prefix: string | undefined, lines: readonly ListLine[]) =>
  prefix ? [plainLine(prefix), plainLine(""), ...lines] : [...lines];

// Elenco gruppi, eventualmente preceduto da un avviso. Con `groups` già letti nessuna andata a D1.
export async function showGroups(ctx: Ctx, prefix?: string, groups?: readonly GroupWithCount[]): Promise<void> {
  const list = groups ?? (await listWithCounts(ctx.deps.db));
  const r = renderGroupList(list, { title: T.groupsTitle, action: "o", withNew: true });
  await sendLines(ctx, withPrefix(prefix, r.lines), r.keyboard);
}

// Scelta tra più candidati (/gruppi <testo>, /prossimi): senza ➕ Nuovo gruppo.
export async function showGroupChoice(ctx: Ctx, title: string, groups: readonly GroupWithCount[], days?: number): Promise<void> {
  const r = renderGroupList(groups, { title, action: days === undefined ? "o" : "p", withNew: false, ...(days !== undefined ? { days } : {}) });
  await sendLines(ctx, r.lines, r.keyboard);
}

// FR-008: titolo con il numero di persone, righe di 003 per prossimo compleanno, Rinomina ed
// Elimina sull'ultimo messaggio.
export async function showGroupCard(ctx: Ctx, group: GroupWithCount, people: readonly ListPerson[], prefix?: string): Promise<void> {
  const rows = formatRows(sortByNextBirthday(people, toLocal(ctx.deps.now())));
  const body = [plainLine(T.groupCardTitle(group.name, group.members)), plainLine(""), ...(rows.length > 0 ? rows : [plainLine(T.groupCardEmpty)])];
  const hash = nameHash(group.name);
  const kb = keyboard([
    [
      button(T.btnRename, { kind: "group", action: "r", groupId: group.id, nameHash: hash }),
      button(T.btnDeleteGroup, { kind: "group", action: "x", groupId: group.id, nameHash: hash }),
    ],
  ]);
  await sendLines(ctx, withPrefix(prefix, body), kb);
}

// Gruppo e persone letti da una batch di groupCardStatements; null se il gruppo non c'è.
export function cardFromBatch(results: readonly D1Result[], at = 0): { group: GroupCountRow; people: ListPerson[] } | null {
  const group = results[at]?.results[0] as GroupCountRow | undefined;
  if (!group) return null;
  return { group, people: ((results[at + 1]?.results ?? []) as ListPersonRow[]).map(rowToListPerson) };
}

// Tocco g2:o (FR-002, FR-005): una batch; gruppo assente o nome cambiato → non esiste più.
export async function openGroupCard(ctx: Ctx, groupId: number, hash: string): Promise<void> {
  const { db } = ctx.deps;
  const card = cardFromBatch(await db.batch(groupCardStatements(db, groupId)));
  if (!card || nameHash(card.group.name) !== hash) {
    await replyGroupGone(ctx);
    return;
  }
  await showGroupCard(ctx, card.group, card.people);
}

// Una batch con gruppi e appartenenze, letti insieme anche quando l'esito non è una scheda (R-07).
export async function readGroupSearch(ctx: Ctx): Promise<{ groups: GroupCountRow[]; memberships: MembershipRow[] }> {
  const { db } = ctx.deps;
  const [groups, memberships] = await db.batch(groupSearchStatements(db));
  return {
    groups: (groups?.results ?? []) as GroupCountRow[],
    memberships: (memberships?.results ?? []) as MembershipRow[],
  };
}

// RF-19, FR-006, FR-007: un trovato → scheda; più → scelta; nessuno → avviso + elenco; chiave del
// testo vuota → elenco. Nessuna seconda andata a D1.
export async function searchGroups(ctx: Ctx, args: string): Promise<void> {
  const { groups, memberships } = await readGroupSearch(ctx);
  const found = findGroups(groups, args);
  if (found.kind === "empty") await showGroups(ctx, undefined, groups);
  else if (found.kind === "one") await showGroupCard(ctx, found.group, membersOf(memberships, found.group.id));
  else if (found.kind === "many") await showGroupChoice(ctx, T.groupsMany(args), found.groups);
  else await showGroups(ctx, T.groupNoMatch(args), groups);
}

// /gruppi e il suo alias /gruppo (FR-014).
export async function handleGruppiCommand(ctx: Ctx, args: string): Promise<void> {
  if (args === "") await showGroups(ctx);
  else await searchGroups(ctx, args);
}

export async function replyGroupGone(ctx: Ctx, groups?: readonly GroupWithCount[]): Promise<void> {
  await showGroups(ctx, T.groupGone, groups);
}
