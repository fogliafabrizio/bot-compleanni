import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, DOCUMENT_CAPTION_MAX_LENGTH, IMPORT_ERROR_VALUE_MAX, PREVIEW_GROUPS_PER_LINE } from "../../src/config";
import type { CsvRecord } from "../../src/domain/csv";
import {
  buildPreview,
  exportRow,
  importState,
  isDuplicate,
  mapHeader,
  previewText,
  recheck,
  shortSummary,
  truncateValue,
  validateRecord,
  type ExistingKey,
  type HeaderMap,
  type ImportGroup,
} from "../../src/domain/import";
import { CSV_EXAMPLE_ROW, T } from "../../src/texts";

const TODAY = { year: 2026, month: 10, day: 28 };

function headerMap(cells: readonly string[] = CSV_COLUMNS): HeaderMap {
  const r = mapHeader(cells);
  if (!r.ok) throw new Error("intestazione non valida");
  return r.map;
}

const MAP = headerMap();

// Record di dati a partire dal numero di riga 2 (la 1 è l'intestazione).
function recs(rows: readonly (readonly string[])[], firstLine = 2): CsvRecord[] {
  return rows.map((cells, i) => ({ line: firstLine + i, cells: [...cells], empty: cells.every((c) => c.trim() === "") }));
}

// Riga completa con i soli campi indicati (gli altri vuoti).
function row(fields: Partial<Record<(typeof CSV_COLUMNS)[number], string>>): string[] {
  return CSV_COLUMNS.map((c) => fields[c] ?? "");
}

function reasonsOf(fields: Partial<Record<(typeof CSV_COLUMNS)[number], string>>, extra: string[] = []): string[] {
  const r = validateRecord(recs([[...row(fields), ...extra]])[0]!, MAP, TODAY);
  return r.ok ? [] : r.reasons;
}

function preview(rows: string[][], existing: ExistingKey[] = [], groups: ImportGroup[] = []) {
  return buildPreview(recs(rows), MAP, existing, groups, TODAY);
}

describe("BR-18, FR-001: intestazione", () => {
  it("BR-18: altro ordine, maiuscole e Priorità = priorita", () => {
    const r = mapHeader(["DATA", " Nome ", "Priorità", "gruppi"]);
    expect(r).toEqual({ ok: true, map: { columns: { data: 0, nome: 1, priorita: 2, gruppi: 3 }, width: 4 } });
  });

  it("BR-18: colonne opzionali assenti valgono vuote", () => {
    const map = headerMap(["nome", "data"]);
    const v = validateRecord(recs([["Marco Rossi", "14/03/1985"]])[0]!, map, TODAY);
    expect(v.ok && v.row).toMatchObject({ fullName: "Marco Rossi", nickname: null, phone: null, priority: "media", groups: [] });
  });

  it.each([
    ["colonna sconosciuta", ["nome", "data", "email"]],
    ["colonna ripetuta", ["nome", "data", "Nome"]],
    ["nome assente", ["data", "telefono"]],
    ["data assente", ["nome", "telefono"]],
  ])("BR-18: %s → invalidHeader", (_label, cells) => {
    expect(mapHeader(cells)).toEqual({ ok: false });
  });

  it("BR-18: celle vuote in coda all'intestazione ignorate", () => {
    expect(mapHeader(["nome", "data", "", " "])).toEqual({ ok: true, map: { columns: { nome: 0, data: 1 }, width: 2 } });
  });
});

describe("FR-010: motivi di errore di riga", () => {
  it("FR-010: celle mancanti in coda vuote; celle in più non vuote → colonne in più", () => {
    const short = validateRecord(recs([["Marco Rossi", "", "14/03"]])[0]!, MAP, TODAY);
    expect(short.ok).toBe(true);
    expect(reasonsOf({ nome: "Marco", data: "14/03" }, ["", " "])).toEqual([]);
    expect(reasonsOf({ nome: "Marco", data: "14/03" }, ["x"])).toEqual(["colonne in più"]);
  });

  it.each([
    [{ nome: "", data: "14/03" }, "nome mancante"],
    [{ nome: "x".repeat(61), data: "14/03" }, "nome troppo lungo (max 60)"],
    [{ nome: "Marco", nickname: "n".repeat(61), data: "14/03" }, "nickname troppo lungo (max 60)"],
    [{ nome: "Marco", data: "" }, "data mancante"],
    [{ nome: "Marco", data: "31/04" }, 'data "31/04" non valida'],
    [{ nome: "Marco", data: "14/03", telefono: "333abc" }, "telefono non valido"],
    [{ nome: "Marco", data: "14/03", priorita: "altissima" }, 'priorità "altissima" non valida'],
    [{ nome: "Marco", data: "14/03", gruppi: "g".repeat(31) }, `gruppo "${"g".repeat(30)}…" troppo lungo (max 30)`],
    [{ nome: "Marco", data: "14/03", messaggio: "m".repeat(257) }, "messaggio troppo lungo"],
  ])("FR-010: %j → %s", (fields, reason) => {
    expect(reasonsOf(fields)).toEqual([reason]);
  });

  it("FR-010: più motivi nella stessa riga uniti da '; ' nell'anteprima", () => {
    const p = preview([row({ nome: "Marco", data: "14/03", telefono: "333abc", priorita: "altissima" })]);
    expect(p.errors).toEqual([{ line: 2, reasons: ["telefono non valido", 'priorità "altissima" non valida'] }]);
    expect(previewText(p)).toContain('• riga 2: telefono non valido; priorità "altissima" non valida');
  });

  it("FR-010: tutti i campi non validi, uno per campo", () => {
    expect(reasonsOf({ nome: "", data: "", telefono: "x", priorita: "boh" })).toEqual([
      "nome mancante",
      "data mancante",
      "telefono non valido",
      'priorità "boh" non valida',
    ]);
  });

  it("FR-010: cella gruppi con tre gruppi troppo lunghi → un solo motivo, sul primo", () => {
    const long = (c: string) => c.repeat(31);
    expect(reasonsOf({ nome: "Marco", data: "14/03", gruppi: `${long("a")}|${long("b")}|${long("c")}` })).toEqual([
      `gruppo "${"a".repeat(30)}…" troppo lungo (max 30)`,
    ]);
  });

  it("chiarimento 2026-10-29: valore citato di 5000 caratteri accorciato a IMPORT_ERROR_VALUE_MAX + …", () => {
    const [reason] = reasonsOf({ nome: "Marco", data: "9".repeat(5000) });
    expect(reason).toBe(`data "${"9".repeat(IMPORT_ERROR_VALUE_MAX)}…" non valida`);
    expect(truncateValue("breve")).toBe("breve");
  });
});

describe("BR-21, BR-01: valori", () => {
  it.each([
    ["", "media"],
    ["ALTA", "alta"],
    [" Bassa ", "bassa"],
  ])("BR-21: priorita %j → %s", (p, expected) => {
    const v = validateRecord(recs([row({ nome: "Marco", data: "14/03", priorita: p })])[0]!, MAP, TODAY);
    expect(v.ok && v.row.priority).toBe(expected);
  });

  it("BR-04: 29/02 senza anno e 29/02/2024 validi, 29/02/1995 errore", () => {
    expect(reasonsOf({ nome: "A", data: "29/02" })).toEqual([]);
    expect(reasonsOf({ nome: "A", data: "29/02/2024" })).toEqual([]);
    expect(reasonsOf({ nome: "A", data: "29/02/1995" })).toEqual(['data "29/02/1995" non valida']);
  });

  it("FR-006: normalizzazione come nel guidato (telefono, username, gruppi)", () => {
    const v = validateRecord(
      recs([row({ nome: " Marco Rossi ", data: "14/03/1985", telefono: "333 123.45-67", instagram: "@marco.rossi", telegram: "marcorossi", gruppi: "Famiglia||famiglia| Amici " })])[0]!,
      MAP,
      TODAY,
    );
    expect(v.ok && v.row).toMatchObject({
      fullName: "Marco Rossi",
      fullNameNorm: "marco rossi",
      phone: "+393331234567",
      instagram: "marco.rossi",
      telegram: "marcorossi",
      groups: [
        { name: "Famiglia", nameNorm: "famiglia" },
        { name: "Amici", nameNorm: "amici" },
      ],
    });
  });
});

describe("FR-007a: riga d'esempio", () => {
  it("FR-007a: la riga d'esempio è valida, saltata e non contata altrove", () => {
    expect(validateRecord(recs([[...CSV_EXAMPLE_ROW]])[0]!, MAP, TODAY).ok).toBe(true);
    const p = preview([[...CSV_EXAMPLE_ROW], row({ nome: "Marco", data: "14/03" })]);
    expect(p.exampleSkipped).toBe(true);
    expect(p.rows.map((r) => r.fullName)).toEqual(["Marco"]);
    expect(p.duplicates).toEqual([]);
    expect(p.errors).toEqual([]);
    expect(p.groupsToCreate).toEqual([]);
    expect(previewText(p)).toContain("Riga d'esempio ignorata");
  });

  it("FR-007a: riga d'esempio modificata con errori → errore", () => {
    const changed: string[] = [...CSV_EXAMPLE_ROW];
    changed[3] = "abc";
    const p = preview([changed]);
    expect(p.exampleSkipped).toBe(false);
    expect(p.errors).toEqual([{ line: 2, reasons: ["telefono non valido"] }]);
  });

  it("FR-007a: la legenda sta nella caption (≤ DOCUMENT_CAPTION_MAX_LENGTH)", () => {
    expect(T.templateCaption.length).toBeLessThanOrEqual(DOCUMENT_CAPTION_MAX_LENGTH);
  });
});

describe("BR-14, FR-011: duplicati", () => {
  const existing: ExistingKey[] = [{ fullNameNorm: "marco rossi", birthDay: 14, birthMonth: 3, birthYear: 1985 }];

  it("BR-14: duplicato di persona esistente con maiuscole diverse", () => {
    const p = preview([row({ nome: "MARCO ROSSI", data: "14/03/1985" })], existing);
    expect(p.rows).toEqual([]);
    expect(p.duplicates).toEqual([{ line: 2, fullName: "MARCO ROSSI", date: "14/03/1985" }]);
  });

  it("BR-14: anno mancante in una delle due → duplicato; anni diversi → nuova", () => {
    expect(preview([row({ nome: "Marco Rossi", data: "14/03" })], existing).duplicates).toHaveLength(1);
    expect(preview([row({ nome: "Marco Rossi", data: "14/03/1990" })], existing).rows).toHaveLength(1);
  });

  it("RF-24, BR-14: due righe uguali nello stesso file → la prima nuova, la seconda duplicato", () => {
    const p = preview([row({ nome: "Anna", data: "01/02" }), row({ nome: "anna", data: "01/02/2000" })]);
    expect(p.rows.map((r) => r.line)).toEqual([2]);
    expect(p.duplicates).toEqual([{ line: 3, fullName: "anna", date: "01/02/2000" }]);
  });

  it("BR-14: isDuplicate segue la regola di findDuplicate", () => {
    const a = { fullNameNorm: "x", birthDay: 1, birthMonth: 2, birthYear: null };
    expect(isDuplicate(a, { ...a, birthYear: 1990 })).toBe(true);
    expect(isDuplicate({ ...a, birthYear: 1991 }, { ...a, birthYear: 1990 })).toBe(false);
    expect(isDuplicate(a, { ...a, birthDay: 2 })).toBe(false);
  });
});

describe("BR-17, BR-20, BR-23: gruppi da creare", () => {
  const famiglia: ImportGroup[] = [{ name: "Famiglia", nameNorm: "famiglia" }];

  it("BR-23: Famiglia|Beach tennis con solo famiglia esistente → crea solo Beach tennis", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "famiglia|Beach tennis" })], [], famiglia);
    expect(p.groupsToCreate).toEqual(["Beach tennis"]);
  });

  it("BR-17: Calcetto/calcetto → un gruppo con la prima grafia; Famiglia||famiglia → uno", () => {
    const p = preview([
      row({ nome: "A", data: "01/01", gruppi: "Calcetto" }),
      row({ nome: "B", data: "02/01", gruppi: "calcetto|Famiglia||famiglia" }),
    ]);
    expect(p.groupsToCreate).toEqual(["Calcetto", "Famiglia"]);
  });

  it("BR-23: gruppo presente solo in righe errate o duplicate → non creato", () => {
    const p = preview([
      row({ nome: "A", data: "01/01" }),
      row({ nome: "A", data: "01/01", gruppi: "SoloDuplicato" }),
      row({ nome: "", data: "01/01", gruppi: "SoloErrore" }),
    ]);
    expect(p.groupsToCreate).toEqual([]);
  });
});

describe("contracts/flussi.md: testo dell'anteprima", () => {
  it("RF-24: sezioni solo se non vuote, in ordine di riga", () => {
    const p = preview(
      [
        row({ nome: "Nuova", data: "01/01", gruppi: "Calcetto|Università" }),
        row({ nome: "Marco Rossi", data: "14/03" }),
        row({ nome: "Errata", data: "31/04" }),
        row({ nome: "", data: "01/01" }),
      ],
      [{ fullNameNorm: "marco rossi", birthDay: 14, birthMonth: 3, birthYear: null }],
    );
    expect(previewText(p)).toEqual([
      "Anteprima import",
      "1 persona nuova",
      "1 duplicato (saltato):",
      "• riga 3: Marco Rossi 14/03",
      "2 errori:",
      '• riga 4: data "31/04" non valida',
      "• riga 5: nome mancante",
      "Gruppi da creare: Calcetto, Università",
    ]);
    expect(previewText(preview([row({ nome: "A", data: "01/01" }), row({ nome: "B", data: "02/01" })]))).toEqual([
      "Anteprima import",
      "2 persone nuove",
    ]);
  });

  it("R-06: gruppi da creare a capo ogni PREVIEW_GROUPS_PER_LINE nomi", () => {
    const groups = Array.from({ length: 25 }, (_, i) => `G${i + 1}`);
    const lines = previewText(preview([row({ nome: "A", data: "01/01", gruppi: groups.join("|") })]));
    const tail = lines.slice(2);
    expect(tail).toHaveLength(3);
    expect(tail[0]).toBe(`Gruppi da creare: ${groups.slice(0, PREVIEW_GROUPS_PER_LINE).join(", ")}`);
    expect(tail[1]).toBe(groups.slice(10, 20).join(", "));
    expect(tail[2]).toBe(groups.slice(20).join(", "));
  });

  it("contracts/flussi.md: riepilogo breve", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "Calcetto|Università" }), row({ nome: "", data: "x" })]);
    expect(shortSummary(importState(p).preview)).toBe(
      "Anteprima in attesa: 1 nuove, 0 duplicati, 1 errori. Gruppi da creare: Calcetto, Università.",
    );
    expect(shortSummary(importState(preview([row({ nome: "A", data: "01/01" })])).preview)).toBe(
      "Anteprima in attesa: 1 nuove, 0 duplicati, 0 errori.",
    );
  });
});

describe("R-06: ricontrollo a Importa", () => {
  it("BR-14: persona aggiunta dopo l'anteprima → riga saltata e gruppi ricalcolati", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "Solo A" }), row({ nome: "B", data: "02/01", gruppi: "Comune" })]);
    const r = recheck(p.rows, [{ fullNameNorm: "a", birthDay: 1, birthMonth: 1, birthYear: null }], [{ name: "comune", nameNorm: "comune" }]);
    expect(r.rows.map((x) => x.fullName)).toEqual(["B"]);
    expect(r.skipped).toBe(1);
    expect(r.groupsToCreate).toEqual([]);
  });
});

describe("RF-25, R-10: riga di export", () => {
  it("RF-25: data, telefono con spazio, username senza @, gruppi in ordine alfabetico, priorità e messaggio", () => {
    expect(
      exportRow(
        {
          fullName: "Marco Rossi",
          nickname: null,
          birthDay: 29,
          birthMonth: 2,
          birthYear: null,
          phone: "+393331234567",
          instagram: "marco.ig",
          telegram: null,
          priority: "alta",
          customMessage: "Auguri {nome}",
        },
        ["Università", "amici", "Famiglia"],
      ),
    ).toEqual(["Marco Rossi", "", "29/02", "+39 3331234567", "marco.ig", "", "amici|Famiglia|Università", "alta", "Auguri {nome}"]);
  });
});

describe("FR-006a, 004 FR-006: gruppi da creare con chiave troppo corta", () => {
  it("FR-006a: gruppo nuovo 🏖 → riga non valida con il motivo", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "🏖" })]);
    expect(p.rows).toEqual([]);
    expect(p.errors).toEqual([{ line: 2, reasons: ['gruppo "🏖" senza almeno 2 lettere o cifre'] }]);
    expect(p.groupsToCreate).toEqual([]);
  });

  it("FR-006a: gruppo nuovo 🏖 X → riga non valida", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "Amici|🏖 X" })]);
    expect(p.errors).toEqual([{ line: 2, reasons: ['gruppo "🏖 X" senza almeno 2 lettere o cifre'] }]);
    expect(p.groupsToCreate).toEqual([]);
  });

  it("FR-006a: gruppo nuovo U2 → riga valida e gruppo da creare", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "U2" })]);
    expect(p.errors).toEqual([]);
    expect(p.groupsToCreate).toEqual(["U2"]);
  });

  it("FR-016: gruppo 🏖 già esistente (stesso name_norm) → riga valida e associata, nessun gruppo da creare", () => {
    const p = preview([row({ nome: "A", data: "01/01", gruppi: "🏖" })], [], [{ name: "🏖", nameNorm: "🏖" }]);
    expect(p.errors).toEqual([]);
    expect(p.rows[0]?.groups).toEqual([{ name: "🏖", nameNorm: "🏖" }]);
    expect(p.groupsToCreate).toEqual([]);
  });

  it("FR-006a: il motivo si aggiunge agli altri errori della riga", () => {
    const p = preview([row({ nome: "", data: "01/01", gruppi: "★★" })]);
    expect(p.errors[0]?.reasons).toEqual(["nome mancante", 'gruppo "★★" senza almeno 2 lettere o cifre']);
  });
});
