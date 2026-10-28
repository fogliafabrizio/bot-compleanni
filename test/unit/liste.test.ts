import { describe, expect, it } from "vitest";
import { columnWidth, formatListLine, splitMessage, type LineInput, type ListLine } from "../../src/bot/liste";
import { LIST_MAX_LINES_PER_MESSAGE, LIST_NAME_COLUMN_MAX, MESSAGE_MAX_LENGTH } from "../../src/config";

// Oggi = mercoledì 28/10/2026.
const item = (over: Partial<LineInput> = {}): LineInput => ({
  date: { year: 2026, month: 10, day: 30 },
  birthDay: 30,
  birthMonth: 10,
  name: "Anna",
  age: 28,
  id: 4,
  ...over,
});

const slice = (line: ListLine, i: number) => {
  const e = line.entities[i]!;
  return line.text.slice(e.offset, e.offset + e.length);
};

describe("FR-001, FR-001a, §5.7: formatListLine", () => {
  it("FR-001: giorno, data, nome (età) in monospazio e /p_<id> fuori dal code", () => {
    const line = formatListLine(item(), 9);
    expect(line.text).toBe("Ven 30/10  Anna (28)  /p_4");
    expect(line.entities).toEqual([
      { type: "code", offset: 0, length: "Ven 30/10  Anna (28)".length },
      { type: "bot_command", offset: "Ven 30/10  Anna (28)  ".length, length: 4 },
    ]);
  });

  it("FR-001: senza età la colonna è riempita alla larghezza comune", () => {
    const line = formatListLine(item({ name: "Giulia", age: null, id: 9, date: { year: 2026, month: 11, day: 12 }, birthDay: 12, birthMonth: 11 }), 9);
    expect(line.text).toBe("Gio 12/11  Giulia     /p_9");
    expect(slice(line, 0)).toBe("Gio 12/11  Giulia   ");
  });

  it("FR-001a: colonna larga quanto il nome più lungo, con tetto 20; oltre il tetto nessun troncamento", () => {
    expect(columnWidth(["Anna (28)", "Giulia"])).toBe(9);
    const long = "Bartolomeo Alessandro Maria Rossi Bianchi";
    expect(long.length).toBeGreaterThan(30);
    expect(columnWidth(["Anna", long])).toBe(LIST_NAME_COLUMN_MAX);
    const line = formatListLine(item({ name: long, age: null }), LIST_NAME_COLUMN_MAX);
    expect(slice(line, 0)).toBe(`Ven 30/10  ${long}`);
  });

  it("FR-002: esito riempito a 14 dentro il monospazio", () => {
    for (const [outcome, padded] of [
      ["in attesa", "in attesa     "],
      ["saltato", "saltato       "],
      ["non confermato", "non confermato"],
    ] as const) {
      const line = formatListLine(item({ outcome }), 9);
      expect(slice(line, 0)).toBe(`Ven 30/10  Anna (28)  ${padded}`);
      expect(slice(line, 1)).toBe("/p_4");
    }
  });

  it("BR-04: nato il 29/02, data 29/02 e giorno della settimana del 28/02/2027 (Dom)", () => {
    const line = formatListLine(item({ name: "Leo", age: 22, id: 40, date: { year: 2027, month: 2, day: 28 }, birthDay: 29, birthMonth: 2 }), 8);
    expect(line.text).toBe("Dom 29/02  Leo (22)  /p_40");
  });

  it("FR-001a: esattamente due entità non sovrapposte; due spazi fuori da entrambe", () => {
    const line = formatListLine(item({ id: 123 }), 12);
    const [code, cmd] = line.entities;
    expect(line.entities).toHaveLength(2);
    expect(code!.offset + code!.length).toBe(cmd!.offset - 2);
    expect(line.text.slice(code!.offset + code!.length, cmd!.offset)).toBe("  ");
    expect(slice(line, 0)).not.toContain("/p_");
    expect(slice(line, 1)).toBe("/p_123");
  });

  it("FR-001a: offset in unità UTF-16 con emoji e lettere accentate", () => {
    const name = "Zoë 🎉🎂";
    const line = formatListLine(item({ name, age: null, id: 7 }), 10);
    // La colonna si misura in code point (6 + 4 spazi), le entità in unità UTF-16 (8 + 4).
    expect([...name]).toHaveLength(6);
    expect(slice(line, 0)).toBe(`Ven 30/10  ${name}    `);
    expect(slice(line, 1)).toBe("/p_7");
    expect(line.entities[1]!.offset + 4).toBe(line.text.length);
  });
});

const listLine = (i: number, nick = `Persona ${i}`) =>
  formatListLine(item({ name: nick, id: i }), Math.min(nick.length + 5, LIST_NAME_COLUMN_MAX));
const plain = (text: string): ListLine => ({ text, entities: [] });

describe("FR-005, research R-05: splitMessage", () => {
  it("FR-005: lista corta in un solo messaggio, offset traslati", () => {
    const lines = [plain("Prossimi 30 giorni"), plain(""), listLine(1), listLine(2)];
    const out = splitMessage(lines);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe(lines.map((l) => l.text).join("\n"));
    const second = out[0]!.entities[3]!;
    expect(out[0]!.text.slice(second.offset, second.offset + second.length)).toBe("/p_2");
  });

  it("FR-005: oltre 45 righe con entità si apre un nuovo messaggio; intestazione solo nel primo", () => {
    const lines = [plain("Titolo"), plain(""), ...Array.from({ length: 50 }, (_, i) => listLine(i + 1))];
    const out = splitMessage(lines);
    expect(out).toHaveLength(2);
    expect(out[0]!.entities).toHaveLength(LIST_MAX_LINES_PER_MESSAGE * 2);
    expect(out[1]!.entities).toHaveLength(10);
    expect(out[0]!.text.startsWith("Titolo\n\n")).toBe(true);
    expect(out[1]!.text.startsWith("Ven 30/10")).toBe(true);
    expect(out[1]!.text).not.toContain("Titolo");
  });

  it("FR-005: oltre 4096 caratteri si apre un nuovo messaggio, righe mai spezzate", () => {
    const long = (i: number) => plain(`${String(i).padStart(3, "0")} ${"x".repeat(996)}`);
    const out = splitMessage(Array.from({ length: 9 }, (_, i) => long(i)));
    for (const m of out) expect(m.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    expect(out.map((m) => m.text.split("\n").length)).toEqual([4, 4, 1]);
    expect(out.flatMap((m) => m.text.split("\n"))).toEqual(Array.from({ length: 9 }, (_, i) => long(i).text));
  });

  it("FR-005: righe vuote in testa a un messaggio di continuazione scartate", () => {
    const cont = splitMessage([...Array.from({ length: LIST_MAX_LINES_PER_MESSAGE }, (_, i) => listLine(i + 1)), listLine(98), plain(""), listLine(99)]);
    expect(cont).toHaveLength(2);
    expect(cont[1]!.text.split("\n")).toEqual([listLine(98).text, "", listLine(99).text]);
    const blank = splitMessage([plain("y".repeat(MESSAGE_MAX_LENGTH)), plain(""), plain(""), plain("z")]);
    expect(blank.map((m) => m.text)).toEqual(["y".repeat(MESSAGE_MAX_LENGTH), "z"]);
  });

  it("SC-002: 200 righe con nickname di 60 caratteri ed emoji → parti ≤ 4096 e ≤ 45 righe, offset validi", () => {
    const nick = (i: number) => `${"Nickname lunghissimo con emoji 🎉🎂 ".repeat(2).slice(0, 56)}${String(i).padStart(4, "0")}`;
    const lines = Array.from({ length: 200 }, (_, i) => formatListLine(item({ name: nick(i), id: 1000 + i }), LIST_NAME_COLUMN_MAX));
    const out = splitMessage([plain("Prossimi 366 giorni"), plain(""), ...lines]);
    let seen = 0;
    for (const m of out) {
      expect(m.text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
      expect(m.entities.length / 2).toBeLessThanOrEqual(LIST_MAX_LINES_PER_MESSAGE);
      for (let k = 0; k < m.entities.length; k += 2) {
        const code = m.entities[k]!;
        const cmd = m.entities[k + 1]!;
        const expected = lines[seen]!;
        expect(m.text.slice(code.offset, code.offset + code.length)).toBe(slice(expected, 0));
        expect(m.text.slice(cmd.offset, cmd.offset + cmd.length)).toBe(`/p_${1000 + seen}`);
        seen++;
      }
    }
    expect(seen).toBe(200);
  });
});
