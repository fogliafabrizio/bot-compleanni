import { CSV_EXPORT_SEPARATOR } from "../config";

// Lettura e scrittura dei CSV (contracts/csv.md, research R-03, R-10). Puro: nessun import di
// cloudflare:*, così il benchmark gira in Node.

export type Separator = ";" | ",";

export interface CsvRecord {
  // Posizione del record nel file, intestazione = 1 (FR-009).
  line: number;
  cells: string[];
  // Tutte le celle vuote dopo il trim: né riga di dati né errore.
  empty: boolean;
}

const BOM = String.fromCharCode(0xfeff);

// BR-22: UTF-8 con o senza BOM (il decoder lo rimuove); byte non UTF-8 → rifiuto.
export function decodeUtf8(bytes: Uint8Array): { ok: true; text: string } | { ok: false } {
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes) };
  } catch {
    return { ok: false };
  }
}

// BR-19: conta ';' e ',' fuori dalle virgolette nel primo record non vuoto; a parità ';'.
export function detectSeparator(text: string): Separator {
  let semi = 0;
  let comma = 0;
  let inQuotes = false;
  let seen = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (ch === ";") semi++;
    else if (ch === ",") comma++;
    else if (ch === "\n" || ch === "\r") {
      if (seen) break;
      continue;
    }
    seen = true;
  }
  return comma > semi ? "," : ";";
}

const isEmpty = (cells: readonly string[]) => cells.every((c) => c.trim() === "");

const QUOTE = 0x22;
const CR = 0x0d;
const LF = 0x0a;

// RFC 4180 un campo alla volta: virgolette solo a inizio campo, "" come virgolette, a capo tra
// virgolette, \r\n o \n. I campi si ritagliano con slice (niente concatenazioni per carattere:
// research R-12, file fino a 1 MiB). FR-008a: si ferma appena le righe di dati non vuote superano
// maxDataRows.
export function parseCsv(text: string, maxDataRows: number): { records: CsvRecord[] } | { tooManyRows: true } {
  const sep = detectSeparator(text).charCodeAt(0);
  const n = text.length;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let headerSeen = false;
  let dataRows = 0;

  const endRecord = (): boolean => {
    const empty = isEmpty(cells);
    records.push({ line: records.length + 1, cells, empty });
    if (!empty) {
      if (headerSeen) dataRows++;
      headerSeen = true;
    }
    cells = [];
    return dataRows <= maxDataRows;
  };
  const delimiterFrom = (k: number) => {
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === sep || c === CR || c === LF) break;
      k++;
    }
    return k;
  };

  let i = 0;
  while (i < n) {
    let field = "";
    if (text.charCodeAt(i) === QUOTE) {
      let j = i + 1;
      for (;;) {
        const q = text.indexOf('"', j);
        // Virgolette non chiuse: il resto del file è il valore.
        if (q < 0) {
          field += text.slice(j);
          i = n;
          break;
        }
        field += text.slice(j, q);
        if (text.charCodeAt(q + 1) === QUOTE) {
          field += '"';
          j = q + 2;
          continue;
        }
        i = q + 1;
        break;
      }
    }
    // Campo senza virgolette, o caratteri dopo le virgolette di chiusura: presi come sono.
    const end = delimiterFrom(i);
    cells.push(field + text.slice(i, end));
    i = end;
    if (i >= n) {
      if (!endRecord()) return { tooManyRows: true };
      break;
    }
    const c = text.charCodeAt(i);
    if (c === sep) {
      i++;
      // Separatore come ultimo carattere del file: un campo vuoto in coda.
      if (i >= n) {
        cells.push("");
        if (!endRecord()) return { tooManyRows: true };
      }
      continue;
    }
    // Un a capo finale non produce un record vuoto in più.
    i += c === CR && text.charCodeAt(i + 1) === LF ? 2 : 1;
    if (!endRecord()) return { tooManyRows: true };
  }
  return { records };
}

const NEEDS_QUOTES = /[;,"\r\n]/;

function quote(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

// FR-005a: UTF-8 con BOM, separatore ';', fine riga \r\n (anche dopo l'ultima).
export function writeCsv(rows: readonly (readonly string[])[]): Uint8Array {
  let out = BOM;
  for (const row of rows) out += `${row.map(quote).join(CSV_EXPORT_SEPARATOR)}\r\n`;
  return new TextEncoder().encode(out);
}
