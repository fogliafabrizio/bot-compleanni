import { GROUP_BUTTONS_MAX } from "../config";
import {
  listWithCountsStatement,
  readGroupList,
  ungroupedFrom,
  ungroupedPersonsStatement,
  type GroupListData,
  type GroupWithCount,
} from "../db/groups";
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
  // Persone senza gruppo: con withNew e > 0, voce [Senza gruppo (N)] sopra ➕ (RF-07 v1.2, FR-003).
  ungrouped?: number;
}

const newGroupButton = () => button(T.btnNewGroup, { kind: "group", action: "n" });
const allGroupsButton = () => button(T.btnAllGroups, { kind: "group", action: "l" });

// Puro. 0 gruppi → avviso; fino a GROUP_BUTTONS_MAX → pulsanti a due colonne; oltre → righe di
// testo e invito a scrivere il nome (V-09). Se `withNew`, in fondo [Senza gruppo (N)] (solo N > 0) e
// ➕ Nuovo gruppo, ciascuno su una riga a sé: al più 60 + 2 = 62 pulsanti (research R-04 di 009).
export function renderGroupList(
  groups: readonly GroupWithCount[],
  opts: GroupListOptions,
): { lines: ListLine[]; keyboard?: InlineKeyboardMarkup } {
  const ungrouped = opts.withNew ? (opts.ungrouped ?? 0) : 0;
  const ungroupedRow = ungrouped > 0 ? [button(T.btnUngrouped(ungrouped), { kind: "group", action: "s" })] : [];
  const newRow = opts.withNew ? [newGroupButton()] : [];
  if (groups.length === 0) return { lines: [plainLine(T.noGroups)], keyboard: keyboard([ungroupedRow, newRow]) };
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
      ...(opts.withNew ? { keyboard: keyboard([ungroupedRow, newRow]) } : {}),
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
  rows.push(ungroupedRow, newRow);
  return { lines: [plainLine(opts.title)], keyboard: keyboard(rows) };
}

const withPrefix = (prefix: string | undefined, lines: readonly ListLine[]) =>
  prefix ? [plainLine(prefix), plainLine(""), ...lines] : [...lines];

// Elenco gruppi, eventualmente preceduto da un avviso. Con `data` già letti nessuna andata a D1;
// altrimenti una batch [gruppi, conteggio senza gruppo].
export async function showGroups(ctx: Ctx, prefix?: string, data?: GroupListData): Promise<void> {
  const { groups, ungrouped } = data ?? (await readGroupList(ctx.deps.db));
  const r = renderGroupList(groups, { title: T.groupsTitle, action: "o", withNew: true, ungrouped });
  await sendLines(ctx, withPrefix(prefix, r.lines), r.keyboard);
}

// Scelta tra più candidati (/gruppi <testo>, /prossimi): senza ➕ Nuovo gruppo.
export async function showGroupChoice(ctx: Ctx, title: string, groups: readonly GroupWithCount[], days?: number): Promise<void> {
  const r = renderGroupList(groups, { title, action: days === undefined ? "o" : "p", withNew: false, ...(days !== undefined ? { days } : {}) });
  await sendLines(ctx, r.lines, r.keyboard);
}

// FR-008: titolo, righe di 003 per prossimo compleanno (o `empty`) e pulsanti sull'ultimo messaggio,
// con [⬅️ Tutti i gruppi] su una riga a sé in fondo (RF-19 v1.2, FR-001).
async function renderGroupCard(
  ctx: Ctx,
  title: string,
  people: readonly ListPerson[],
  actionRows: InlineKeyboardButton[][],
  prefix?: string,
): Promise<void> {
  const rows = formatRows(sortByNextBirthday(people, toLocal(ctx.deps.now())));
  const body = [plainLine(title), plainLine(""), ...(rows.length > 0 ? rows : [plainLine(T.groupCardEmpty)])];
  await sendLines(ctx, withPrefix(prefix, body), keyboard([...actionRows, [allGroupsButton()]]));
}

// Scheda di un gruppo reale: Rinomina ed Elimina, poi ⬅️ Tutti i gruppi.
export async function showGroupCard(ctx: Ctx, group: GroupWithCount, people: readonly ListPerson[], prefix?: string): Promise<void> {
  const hash = nameHash(group.name);
  await renderGroupCard(
    ctx,
    T.groupCardTitle(group.name, group.members),
    people,
    [
      [
        button(T.btnRename, { kind: "group", action: "r", groupId: group.id, nameHash: hash }),
        button(T.btnDeleteGroup, { kind: "group", action: "x", groupId: group.id, nameHash: hash }),
      ],
    ],
    prefix,
  );
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

// Una batch con gruppi, appartenenze e conteggio senza gruppo, letti insieme anche quando l'esito
// non è una scheda (R-07; R-02 di 009).
export async function readGroupSearch(ctx: Ctx): Promise<{ groups: GroupCountRow[]; memberships: MembershipRow[]; ungrouped: number }> {
  const { db } = ctx.deps;
  const [groups, memberships, ungrouped] = await db.batch(groupSearchStatements(db));
  return {
    groups: (groups?.results ?? []) as GroupCountRow[],
    memberships: (memberships?.results ?? []) as MembershipRow[],
    ungrouped: ungroupedFrom(ungrouped),
  };
}

// RF-19, FR-006, FR-007: un trovato → scheda; più → scelta; nessuno → avviso + elenco; chiave del
// testo vuota → elenco. Nessuna seconda andata a D1. Si cerca solo tra i gruppi salvati: "Senza
// gruppo" non si trova per nome (FR-003 di 009).
export async function searchGroups(ctx: Ctx, args: string): Promise<void> {
  const { groups, memberships, ungrouped } = await readGroupSearch(ctx);
  const found = findGroups(groups, args);
  if (found.kind === "empty") await showGroups(ctx, undefined, { groups, ungrouped });
  else if (found.kind === "one") await showGroupCard(ctx, found.group, membersOf(memberships, found.group.id));
  else if (found.kind === "many") await showGroupChoice(ctx, T.groupsMany(args), found.groups);
  else await showGroups(ctx, T.groupNoMatch(args), { groups, ungrouped });
}

// /gruppi e il suo alias /gruppo (FR-014).
export async function handleGruppiCommand(ctx: Ctx, args: string): Promise<void> {
  if (args === "") await showGroups(ctx);
  else await searchGroups(ctx, args);
}

// Tocco g2:l [⬅️ Tutti i gruppi] (RF-19, FR-002): nuovo messaggio con l'elenco attuale, come
// /gruppi; nessun avviso anche se il gruppo della scheda nel frattempo è cambiato.
export async function showAllGroups(ctx: Ctx): Promise<void> {
  await showGroups(ctx);
}

export async function replyGroupGone(ctx: Ctx, data?: GroupListData): Promise<void> {
  await showGroups(ctx, T.groupGone, data);
}

// Scheda del gruppo virtuale (RF-19, D-31, FR-007): come una scheda gruppo, con il solo
// [⬅️ Tutti i gruppi]; niente Rinomina né Elimina.
export async function showUngroupedCard(ctx: Ctx, people: readonly ListPerson[]): Promise<void> {
  await renderGroupCard(ctx, T.ungroupedCardTitle(people.length), people, []);
}

// Tocco g2:s (FR-007, FR-008, research R-03 di 009): una batch [persone senza gruppo, gruppi]. Vale
// il numero calcolato ora, non quello sul pulsante: 0 → avviso + elenco aggiornato, senza rileggere.
export async function openUngrouped(ctx: Ctx): Promise<void> {
  const { db } = ctx.deps;
  const [people, groups] = await db.batch([ungroupedPersonsStatement(db), listWithCountsStatement(db)]);
  const list = ((people?.results ?? []) as ListPersonRow[]).map(rowToListPerson);
  if (list.length > 0) await showUngroupedCard(ctx, list);
  else await showGroups(ctx, T.allGrouped, { groups: (groups?.results ?? []) as GroupWithCount[], ungrouped: 0 });
}
