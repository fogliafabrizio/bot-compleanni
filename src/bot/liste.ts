import { LIST_MAX_LINES_PER_MESSAGE, LIST_NAME_COLUMN_MAX, MESSAGE_MAX_LENGTH } from "../config";
import { formatShort } from "../domain/date";
import { displayName, type ListRow } from "../domain/viste";
import type { MessageEntity } from "../telegram/types";
import { T, WEEKDAYS_IT } from "../texts";
import type { LocalDate } from "../time";
import type { Ctx } from "./context";

// Formato delle liste e divisione dei messaggi (contracts/liste.md di 003, AFU §5.7). Puro salvo
// sendList: nessun import di cloudflare:*, così il benchmark gira in Node.

// Offset delle entità relativi alla riga (ListLine) o al messaggio (OutMessage).
export interface ListLine {
  text: string;
  entities: MessageEntity[];
}

export type OutMessage = ListLine;

export interface LineInput {
  // Data effettiva della riga: dà il giorno della settimana (BR-04).
  date: LocalDate;
  birthDay: number;
  birthMonth: number;
  name: string;
  age: number | null;
  // Etichetta dell'esito, solo in /scaduti.
  outcome?: string;
  id: number;
}

const codePoints = (s: string) => [...s].length;
const pad = (s: string, width: number) => s + " ".repeat(Math.max(0, width - codePoints(s)));

// La colonna dell'esito è larga quanto l'etichetta più lunga ("non confermato").
const OUTCOME_WIDTH = Math.max(...Object.values(T.listOutcome).map(codePoints));

export const nameColumn = (name: string, age: number | null) => (age !== null ? `${name} (${age})` : name);

// FR-001a: larghezza comune della colonna "nome (età)", con tetto LIST_NAME_COLUMN_MAX.
export function columnWidth(columns: readonly string[]): number {
  return Math.min(Math.max(0, ...columns.map(codePoints)), LIST_NAME_COLUMN_MAX);
}

// "<Ggg> <gg/mm>  <nome (età)>[  <esito>]" in un'entità code, poi "  /p_<id>" con un'entità
// bot_command esattamente sul comando, fuori dal code.
export function formatListLine(item: LineInput, width: number): ListLine {
  const weekday = WEEKDAYS_IT[new Date(Date.UTC(item.date.year, item.date.month - 1, item.date.day)).getUTCDay()];
  const ddmm = formatShort({ day: item.birthDay, month: item.birthMonth, year: null });
  let left = `${weekday} ${ddmm}  ${pad(nameColumn(item.name, item.age), width)}`;
  if (item.outcome !== undefined) left += `  ${pad(item.outcome, OUTCOME_WIDTH)}`;
  const command = `/p_${item.id}`;
  return {
    text: `${left}  ${command}`,
    entities: [
      { type: "code", offset: 0, length: left.length },
      { type: "bot_command", offset: left.length + 2, length: command.length },
    ],
  };
}

// Righe di una lista con la colonna dei nomi allineata su tutta la lista.
export function formatRows<R extends ListRow>(rows: readonly R[], outcomeOf?: (r: R) => string): ListLine[] {
  const width = columnWidth(rows.map((r) => nameColumn(displayName(r.person), r.age)));
  return rows.map((r) => formatListLine(lineInput(r, outcomeOf?.(r)), width));
}

export function lineInput(r: ListRow, outcome?: string): LineInput {
  return {
    date: r.date,
    birthDay: r.person.birthDay,
    birthMonth: r.person.birthMonth,
    name: displayName(r.person),
    age: r.age,
    id: r.person.id,
    ...(outcome !== undefined ? { outcome } : {}),
  };
}

export const plainLine = (text: string): ListLine => ({ text, entities: [] });

// FR-005, research R-05: riempimento greedy a righe intere entro MESSAGE_MAX_LENGTH caratteri e
// LIST_MAX_LINES_PER_MESSAGE righe con entità; le righe vuote in testa alle continuazioni si scartano.
export function splitMessage(lines: readonly ListLine[]): OutMessage[] {
  const out: OutMessage[] = [];
  let text = "";
  let entities: MessageEntity[] = [];
  let lineCount = 0;
  let withEntities = 0;

  const flush = () => {
    out.push({ text, entities });
    text = "";
    entities = [];
    lineCount = 0;
    withEntities = 0;
  };

  for (const line of lines) {
    const counts = line.entities.length > 0 ? 1 : 0;
    if (lineCount > 0) {
      const tooLong = text.length + 1 + line.text.length > MESSAGE_MAX_LENGTH;
      const tooMany = withEntities + counts > LIST_MAX_LINES_PER_MESSAGE;
      if (tooLong || tooMany) flush();
    }
    if (lineCount === 0 && out.length > 0 && line.text === "") continue;
    const offset = lineCount > 0 ? text.length + 1 : 0;
    text = lineCount > 0 ? `${text}\n${line.text}` : line.text;
    for (const e of line.entities) entities.push({ ...e, offset: e.offset + offset });
    lineCount++;
    withEntities += counts;
  }
  if (lineCount > 0) flush();
  return out;
}

// Invia "<intestazione>", riga vuota e le righe, in uno o più messaggi senza tastiera (FR-004).
export async function sendList(ctx: Ctx, header: string, lines: readonly ListLine[]): Promise<void> {
  for (const m of splitMessage([plainLine(header), plainLine(""), ...lines])) {
    await ctx.deps.tg.sendMessage(ctx.chatId, m.text, undefined, m.entities);
  }
}
