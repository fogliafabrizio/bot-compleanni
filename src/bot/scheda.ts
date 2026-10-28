import { getById, getGroupNames, getOutcomes, type Outcome, type PersonFields } from "../db/persons";
import { formatShort, nextBirthday } from "../domain/date";
import { sortNames } from "../domain/text";
import { button, keyboard } from "../telegram/keyboard";
import type { InlineKeyboardMarkup } from "../telegram/types";
import { T } from "../texts";
import { toLocal, type LocalDate } from "../time";
import { reply, type Ctx } from "./context";

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

// RNF-14: solo pulsanti di azione.
export function schedaKeyboard(personId: number): InlineKeyboardMarkup {
  return keyboard([
    [
      button(T.btnEdit, { kind: "static", scope: "p", action: "m", id: personId }),
      button(T.btnDelete, { kind: "static", scope: "p", action: "x", id: personId }),
    ],
  ]);
}

export async function showScheda(ctx: Ctx, personId: number, prefix?: string): Promise<void> {
  const { db } = ctx.deps;
  const person = await getById(db, personId);
  if (!person) {
    await reply(ctx, T.personNotFound);
    return;
  }
  const [groups, outcomes] = await Promise.all([getGroupNames(db, personId), getOutcomes(db, personId)]);
  const text = renderScheda(person, groups, outcomes, toLocal(ctx.deps.now()));
  await reply(ctx, prefix ? `${prefix}\n\n${text}` : text, schedaKeyboard(personId));
}
