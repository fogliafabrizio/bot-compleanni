import { markDoneStatement, schedaFromResults, schedaStatements, type Outcome, type PersonFields } from "../db/persons";
import { formatShort, nextBirthday } from "../domain/date";
import { sortNames } from "../domain/text";
import { pendingWindow } from "../domain/viste";
import { button, keyboard } from "../telegram/keyboard";
import type { InlineKeyboardMarkup } from "../telegram/types";
import { T } from "../texts";
import { toIso, toLocal, type LocalDate } from "../time";
import { answerCallback, reply, type Ctx } from "./context";

// Scheda persona (AFU §5.6, contracts/comandi.md, research R-16).

function schedaLines(p: PersonFields, groupNames: readonly string[], today: LocalDate): string[] {
  const lines = [p.nickname ? T.schedaNickname(p.fullName, p.nickname) : p.fullName];

  const next = nextBirthday(p.birthDay, p.birthMonth, today);
  const when =
    p.birthYear === null ? T.schedaNoAge(next.daysUntil) : T.schedaAge(next.year - p.birthYear, next.daysUntil);
  lines.push(`${formatShort({ day: p.birthDay, month: p.birthMonth, year: p.birthYear })} · ${when}`);

  const sorted = sortNames(groupNames);
  lines.push(
    [T.schedaPriority(p.priority), ...(sorted.length > 0 ? [T.schedaGroups(sorted.join(", "))] : [])].join(" · "),
  );

  const contacts = [
    ...(p.phone ? [T.schedaPhone(p.phone)] : []),
    ...(p.instagram ? [T.schedaInstagram(p.instagram)] : []),
    ...(p.telegram ? [T.schedaTelegram(p.telegram)] : []),
  ];
  if (contacts.length > 0) lines.push(contacts.join(" · "));

  lines.push(p.customMessage ? T.schedaMessageCustom(p.customMessage) : T.schedaMessageStandard);
  return lines;
}

export function renderScheda(
  p: PersonFields,
  groupNames: readonly string[],
  outcomes: readonly Outcome[],
  today: LocalDate,
): string {
  const lines = schedaLines(p, groupNames, today);
  // FR-013: la riga Storico compare solo con almeno un esito.
  if (outcomes.length > 0) {
    lines.push(T.schedaHistory(outcomes.map((o) => `${o.year} ${T.outcome[o.status]}`).join(" · ")));
  }
  return lines.join("\n");
}

export function renderRiepilogo(p: PersonFields, groupNames: readonly string[], today: LocalDate): string {
  return `${T.summaryTitle}\n${schedaLines(p, groupNames, today).join("\n")}`;
}

// RNF-14: solo pulsanti di azione; "Segna fatto" sopra Modifica/Elimina se c'è un'occorrenza in
// sospeso (FR-017).
export function schedaKeyboard(personId: number, hasPending = false): InlineKeyboardMarkup {
  return keyboard([
    hasPending ? [button(T.btnMarkDone, { kind: "static", scope: "p", action: "f", id: personId })] : [],
    [
      button(T.btnEdit, { kind: "static", scope: "p", action: "m", id: personId }),
      button(T.btnDelete, { kind: "static", scope: "p", action: "x", id: personId }),
    ],
  ]);
}

export async function showScheda(ctx: Ctx, personId: number, prefix?: string): Promise<void> {
  const { db } = ctx.deps;
  const today = toLocal(ctx.deps.now());
  const data = schedaFromResults(await db.batch(schedaStatements(db, personId, pendingWindow(today))));
  if (!data) {
    await reply(ctx, T.personNotFound);
    return;
  }
  const text = renderScheda(data.person, data.groups, data.outcomes, today);
  await reply(ctx, prefix ? `${prefix}\n\n${text}` : text, schedaKeyboard(personId, data.pending !== null));
}

// "Segna fatto" (p:f, FR-017, FR-018, BR-08): una batch con l'UPDATE e la rilettura della scheda.
export async function markDone(ctx: Ctx, personId: number): Promise<void> {
  const { db } = ctx.deps;
  const now = ctx.deps.now();
  const today = toLocal(now);
  const w = pendingWindow(today);
  const [upd, ...read] = await db.batch([
    markDoneStatement(db, personId, { ...w, nowIso: toIso(now) }),
    ...schedaStatements(db, personId, w),
  ]);
  const data = schedaFromResults(read);
  if (!data) {
    await answerCallback(ctx, T.personNotFound);
    return;
  }
  if ((upd?.meta.changes ?? 0) === 0) {
    await answerCallback(ctx, T.actionUnavailable);
    return;
  }
  const messageId = ctx.callback?.messageId;
  if (messageId !== undefined) {
    await ctx.deps.tg.editMessageText(
      ctx.chatId,
      messageId,
      renderScheda(data.person, data.groups, data.outcomes, today),
      schedaKeyboard(personId, data.pending !== null),
    );
  }
  await answerCallback(ctx);
}
