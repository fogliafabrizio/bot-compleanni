import { describe, expect, it } from "vitest";
import { IMPORT_MAX_ROWS } from "../../src/config";

const BOM = String.fromCharCode(0xfeff);
import { decodeUtf8, detectSeparator, parseCsv, writeCsv } from "../../src/domain/csv";

const enc = (s: string) => new TextEncoder().encode(s);

function records(text: string, max = IMPORT_MAX_ROWS) {
  const r = parseCsv(text, max);
  if ("tooManyRows" in r) throw new Error("tooManyRows inatteso");
  return r.records;
}

describe("BR-22, FR-005: decodifica UTF-8", () => {
  it("BR-22: UTF-8 senza BOM", () => {
    expect(decodeUtf8(enc("nome;data\nNicolò;01/01"))).toEqual({ ok: true, text: "nome;data\nNicolò;01/01" });
  });

  it("BR-22: il BOM viene rimosso", () => {
    expect(decodeUtf8(enc(BOM + "nome;data"))).toEqual({ ok: true, text: "nome;data" });
  });

  it("BR-22: byte ANSI (0xE0 = à in Windows-1252) → rifiutato", () => {
    expect(decodeUtf8(new Uint8Array([0x6e, 0x6f, 0x6d, 0x65, 0x0a, 0x4e, 0x69, 0x63, 0x6f, 0x6c, 0xe0]))).toEqual({ ok: false });
  });
});

describe("BR-19, FR-002: separatore", () => {
  it("BR-19: ';' e ',' danno gli stessi record", () => {
    const a = records("nome;data\nMarco Rossi;14/03/1985\n");
    const b = records("nome,data\nMarco Rossi,14/03/1985\n");
    expect(a).toEqual(b);
    expect(a.map((r) => r.cells)).toEqual([["nome", "data"], ["Marco Rossi", "14/03/1985"]]);
  });

  it("BR-19: contato fuori dalle virgolette nell'intestazione, a parità ';'", () => {
    expect(detectSeparator('"a,b,c";d\n1;2')).toBe(";");
    expect(detectSeparator('"a;b;c",d\n1,2')).toBe(",");
    expect(detectSeparator("a;b,c\n")).toBe(";");
    expect(detectSeparator("\n\nnome,data,telefono\n")).toBe(",");
  });
});

describe("RFC 4180: virgolette, a capo, terminatori", () => {
  it("FR-002: campo tra virgolette con ';', ',', '\"\"' e a capo letto come un valore", () => {
    const r = records('nome;messaggio\n"Rossi; Marco";"Auguri, ""caro""\nci vediamo"\n');
    expect(r[1]!.cells).toEqual(["Rossi; Marco", 'Auguri, "caro"\nci vediamo']);
  });

  it("FR-002: terminatori \\r\\n e \\n", () => {
    expect(records("a;b\r\n1;2\r\n3;4").map((r) => r.cells)).toEqual(records("a;b\n1;2\n3;4\n").map((r) => r.cells));
  });

  it("FR-009: numero di riga = indice del record, un campo multilinea resta una riga, righe vuote numerate e marcate", () => {
    const r = records('nome;data\n"Marco\nRossi";14/03\n\n;\nAnna;01/01\n');
    expect(r.map((x) => [x.line, x.empty])).toEqual([
      [1, false],
      [2, false],
      [3, true],
      [4, true],
      [5, false],
    ]);
    expect(r[4]!.cells).toEqual(["Anna", "01/01"]);
  });
});

describe("FR-008a: limite di righe", () => {
  const file = (n: number) => ["nome;data", ...Array.from({ length: n }, (_, i) => `P${i};01/01`)].join("\n");

  it("FR-008a: 500 righe accettate", () => {
    expect(records(file(500))).toHaveLength(501);
  });

  it("FR-008a: 501 righe → tooManyRows", () => {
    expect(parseCsv(file(501), IMPORT_MAX_ROWS)).toEqual({ tooManyRows: true });
  });

  it("FR-008a: le righe vuote non contano nel limite", () => {
    expect(records(`${file(500)}\n\n;;\n`)).toHaveLength(503);
  });
});

describe("FR-005a: scrittura", () => {
  it("FR-005a: BOM + ';' + \\r\\n e virgolette per ';', ',', '\"', \\r, \\n", () => {
    const bytes = writeCsv([
      ["nome", "data"],
      ["Rossi; Marco", "a,b"],
      ['Il "Boss"', "x\ny"],
      ["semplice", "r\rs"],
    ]);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(bytes);
    expect(text).toBe(BOM + 'nome;data\r\n"Rossi; Marco";"a,b"\r\n"Il ""Boss""";"x\ny"\r\nsemplice;"r\rs"\r\n');
  });

  it("SC-004: round-trip parseCsv(decodeUtf8(writeCsv(rows))) identico", () => {
    const rows = [
      ["nome", "nickname", "messaggio"],
      ["Nicolò D'Amico", "", 'Auguri "{nome}"; a presto,\r\nciao'],
      ["", "", ""],
      ["🎂", "x", "|"],
    ];
    const dec = decodeUtf8(writeCsv(rows));
    if (!dec.ok) throw new Error("decodifica fallita");
    expect(records(dec.text).map((r) => r.cells)).toEqual(rows);
  });
});
