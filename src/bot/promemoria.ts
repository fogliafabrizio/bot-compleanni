import { TEXT_LIMITS } from "../config";
import { formatShort } from "../domain/date";
import { composeGreeting } from "../domain/greeting";
import type { Kind, OccurrenceStatus } from "../domain/schedule";
import { sortNames } from "../domain/text";
import { button, copyButton, keyboard, urlButton } from "../telegram/keyboard";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "../telegram/types";
import { T } from "../texts";
import { isLeapYear } from "../time";

// Testi e tastiere dei promemoria (contracts/promemoria.md, AFU §5.3–§5.5). Puro: nessun
// import di cloudflare:*, così il benchmark gira in Node (research R-09).

export interface ReminderPerson {
  fullName: string;
  nickname: string | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
}

export interface ReminderData {
  // Destinazione dei pulsanti Fatto / Salta: invio (o:, 002) o occorrenza (t:, /oggi di 003).
  actionTarget: { scope: "o" | "t"; id: number };
  person: ReminderPerson;
  groups: readonly string[];
  // Esito dell'occorrenza dell'anno precedente (BR-09).
  lastYear: OccurrenceStatus | null;
  // Anno dell'occorrenza (BR-03, BR-05).
  year: number;
  // Messaggio di auguri composto, senza età (BR-03).
  greeting: string;
}

export interface Rendered {
  text: string;
  keyboard: InlineKeyboardMarkup;
}

export type Outcome = "fatto" | "saltato";

const displayName = (p: ReminderPerson) => p.nickname ?? p.fullName;

// Il nome completo tra parentesi solo se il nickname esiste ed è diverso.
const fullNameOrNull = (p: ReminderPerson) => (p.nickname && p.nickname !== p.fullName ? p.fullName : null);

const ageOf = (d: ReminderData) => (d.person.birthYear !== null ? d.year - d.person.birthYear : null);

const outcomeButton = (d: ReminderData, label: string, action: "f" | "s") =>
  button(label, { kind: "static", scope: d.actionTarget.scope, action, id: d.actionTarget.id });
const done = (d: ReminderData) => outcomeButton(d, T.btnOutcomeDone, "f");
const skip = (d: ReminderData, label: string) => outcomeButton(d, label, "s");

// RF-11, V-04…V-06: solo i contatti presenti; link https:// e copia nativa.
export function contactRows(d: ReminderData, layout: "giorno" | "recupero"): InlineKeyboardButton[][] {
  const p = d.person;
  const links: InlineKeyboardButton[] = [];
  if (p.phone) links.push(urlButton(T.btnWhatsApp, `https://wa.me/${p.phone.replace(/^\+/, "")}?text=${encodeURIComponent(d.greeting)}`));
  if (p.instagram) links.push(urlButton(T.btnInstagram, `https://ig.me/m/${encodeURIComponent(p.instagram)}`));
  if (p.telegram) links.push(urlButton(T.btnTelegram, `https://t.me/${encodeURIComponent(p.telegram)}`));
  // Messaggi salvati prima di FR-035 possono superare il limite di copy_text (spec Assumptions).
  const copy = [...d.greeting].length <= TEXT_LIMITS.customMessage ? [copyButton(T.btnCopy, d.greeting)] : [];
  return layout === "giorno" ? [links, copy] : [[...links, ...copy]];
}

// --- Reminder del giorno (RF-10, §5.3) ---

function giornoText(d: ReminderData): string {
  const p = d.person;
  const leap29 = p.birthDay === 29 && p.birthMonth === 2 && !isLeapYear(d.year);
  const lines = [T.reminderTitle(displayName(p), fullNameOrNull(p), ageOf(d), leap29)];
  if (d.groups.length > 0) lines.push(T.reminderGroups(sortNames(d.groups).join(", ")));
  if (p.phone) lines.push(T.reminderPhone(p.phone));
  if (d.lastYear === "fatto" || d.lastYear === "saltato") lines.push(T.lastYear[d.lastYear]);
  return lines.join("\n");
}

export function renderGiorno(d: ReminderData): Rendered {
  return {
    text: giornoText(d),
    keyboard: keyboard([...contactRows(d, "giorno"), [done(d), skip(d, T.btnSkipYear)]]),
  };
}

export function renderGiornoAfter(d: ReminderData, outcome: Outcome): Rendered {
  return {
    text: `${giornoText(d)}\n\n${outcome === "fatto" ? T.outcomeDone : T.outcomeSkipped}`,
    keyboard: keyboard(contactRows(d, "giorno")),
  };
}

// --- Recupero (RF-13, §5.5) ---

function recuperoText(d: ReminderData): string {
  const p = d.person;
  const lines = [T.recoveryTitle(displayName(p), fullNameOrNull(p))];
  if (p.phone) lines.push(T.reminderPhone(p.phone));
  return lines.join("\n");
}

export function renderRecupero(d: ReminderData): Rendered {
  return {
    text: recuperoText(d),
    keyboard: keyboard([...contactRows(d, "recupero"), [done(d), skip(d, T.btnSkipped)]]),
  };
}

// Dopo Saltato resta Fatto per la correzione entro D+7 (BR-08).
export function renderRecuperoAfter(d: ReminderData, outcome: Outcome): Rendered {
  return {
    text: `${recuperoText(d)}\n\n${outcome === "fatto" ? T.outcomeDone : T.outcomeSkipped}`,
    keyboard: keyboard([...contactRows(d, "recupero"), ...(outcome === "saltato" ? [[done(d)]] : [])]),
  };
}

// --- Pre-reminder (RF-09, §5.4) ---

function preText(d: ReminderData, days: number): string {
  const p = d.person;
  // BR-04: la data mostrata resta quella di nascita (29/02 anche negli anni non bisestili).
  const ddmm = formatShort({ day: p.birthDay, month: p.birthMonth, year: null });
  return T.preReminder(days, displayName(p), ageOf(d), ddmm);
}

export function renderPre(d: ReminderData, days: number): Rendered {
  return { text: preText(d, days), keyboard: keyboard([[skip(d, T.btnSkipYear)]]) };
}

export function renderPreAfter(d: ReminderData, days: number): Rendered {
  return { text: `${preText(d, days)}\n\n${T.skippedThisYear}`, keyboard: { inline_keyboard: [] } };
}

// --- Dispatch per tipo, usato dal ciclo orario e dal gestore degli esiti ---

export function renderByKind(kind: Kind, ref: number, d: ReminderData): Rendered {
  switch (kind) {
    case "giorno":
      return renderGiorno(d);
    case "recupero":
      return renderRecupero(d);
    case "pre":
      return renderPre(d, ref);
  }
}

export function renderAfterByKind(kind: Kind, ref: number, d: ReminderData, outcome: Outcome): Rendered {
  switch (kind) {
    case "giorno":
      return renderGiornoAfter(d, outcome);
    case "recupero":
      return renderRecuperoAfter(d, outcome);
    case "pre":
      return renderPreAfter(d, ref);
  }
}

// Separatore di group_concat(g.name, char(31)) nelle query.
export const GROUP_SEPARATOR = "\u001f";

// Riga persona come letta dal database (colonne di persons + gruppi concatenati).
export interface PersonRowLike {
  full_name: string;
  nickname: string | null;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  custom_message: string | null;
  group_names: string | null;
}

export function buildReminderData(
  row: PersonRowLike,
  o: { actionTarget: ReminderData["actionTarget"]; year: number; lastYear: OccurrenceStatus | null; defaultMessage: string | null },
): ReminderData {
  const person: ReminderPerson = {
    fullName: row.full_name,
    nickname: row.nickname,
    birthDay: row.birth_day,
    birthMonth: row.birth_month,
    birthYear: row.birth_year,
    phone: row.phone,
    instagram: row.instagram,
    telegram: row.telegram,
  };
  return {
    actionTarget: o.actionTarget,
    person,
    groups: row.group_names ? row.group_names.split(GROUP_SEPARATOR) : [],
    lastYear: o.lastYear,
    year: o.year,
    greeting: composeGreeting({ nickname: row.nickname, fullName: row.full_name, customMessage: row.custom_message }, o.defaultMessage),
  };
}
