import { describe, expect, it } from "vitest";
import { formatListLine } from "../../src/bot/liste";
import { DEFAULT_BIRTHDAY_MESSAGE, DOCUMENT_CAPTION_MAX_LENGTH, MESSAGE_MAX_LENGTH } from "../../src/config";
import { BOT_COMMANDS, CSV_EXAMPLE_ROW, T, type Counts, type DeliveryCounts } from "../../src/texts";
import type { LocalClock, LocalDate } from "../../src/time";

// Inventario eseguibile dei testi (RNF-19, FR-004a, contracts/testi.md di 008, research R-08).

type Tipo = "T" | "D" | "C" | "A" | "E" | "I" | "F" | "R" | "PA" | "PC";

// Chiave di T (notazione a punto per gli oggetti annidati) → tipo del contratto.
const INVENTARIO: Record<string, Tipo> = {
  // Scheda persona
  schedaTitle: "T",
  schedaDate: "F",
  schedaAge: "F",
  schedaNoAge: "F",
  schedaPriority: "F",
  schedaGroups: "F",
  schedaPhone: "F",
  schedaMessageStandard: "F",
  schedaMessageCustom: "F",
  schedaHistory: "F",
  "outcome.*": "F",
  btnEdit: "PA",
  btnDelete: "PA",
  // Eliminazione
  confirmDeletePerson: "A",
  personDeleted: "C",
  // Gruppi
  groupsTitle: "T",
  groupButton: "PA",
  groupLine: "R",
  groupsTypeName: "I",
  groupCardTitle: "T",
  groupCardEmpty: "F",
  groupGone: "E",
  groupsMany: "T",
  groupNoMatch: "T",
  groupKeyTooShort: "E",
  noGroups: "T",
  btnRename: "PA",
  btnDeleteGroup: "PA",
  askRenameTo: "D",
  confirmDeleteGroup: "A",
  groupCreated: "C",
  groupRenamed: "C",
  groupDeleted: "C",
  // Inserimento guidato
  askFullName: "D",
  askNickname: "D",
  askBirthDate: "D",
  confirmDate: "D",
  invalidDate: "E",
  askPhone: "D",
  invalidPhone: "E",
  confirmPhone: "D",
  contactWithoutPhone: "E",
  askInstagram: "D",
  askTelegram: "D",
  askGroups: "D",
  btnNewGroup: "PA",
  askNewGroupName: "D",
  groupExists: "E",
  askPriority: "D",
  btnHigh: "PA",
  btnMedium: "PA",
  btnLow: "PA",
  selected: "F",
  groupToggle: "F",
  askMessage: "D",
  summaryTitle: "T",
  btnSave: "PA",
  btnSaveAnyway: "PA",
  possibleDuplicate: "A",
  tooLong: "E",
  emptyValue: "E",
  personSaved: "C",
  btnSkip: "PA",
  // Modifica
  editWhichField: "D",
  "fieldLabels.*": "PA",
  "editAsk.*": "D",
  personUpdated: "C",
  // /messaggio
  greetingAsk: "D",
  greetingPreview: "D",
  greetingSaved: "C",
  greetingTooLong: "E",
  sampleName: "F",
  btnConfirm: "PA",
  // Viste e ricerche
  "listOutcome.*": "F",
  todayNone: "T",
  todayNoPersons: "T",
  todayOthers: "T",
  upcomingHeader: "T",
  upcomingNone: "T",
  upcomingDaysRange: "E",
  searchUsage: "I",
  searchHeader: "T",
  searchNone: "T",
  monthHeader: "T",
  monthNone: "T",
  monthInvalid: "E",
  btnMarkDone: "PA",
  overdueHeader: "T",
  overdueNone: "T",
  yearHeader: "T",
  yearCounts: "F",
  yearSkipped: "F",
  yearStreak: "F",
  yearNone: "F",
  yearInvalid: "E",
  // Benvenuto e aiuto (help: la regola T vale per la prima riga, le altre sono verificate a parte)
  welcome: "C",
  help: "T",
  btnAddPerson: "PA",
  btnCommands: "PA",
  // Promemoria (reminderTitle termina con "!" come §5.3: eccezione di research R-04)
  reminderTitle: "T",
  reminderGroups: "F",
  reminderPhone: "F",
  "lastYear.*": "F",
  recoveryTitle: "T",
  preReminder: "T",
  btnWhatsApp: "PC",
  btnInstagram: "PC",
  btnTelegram: "PC",
  btnCopy: "PC",
  btnOutcomeDone: "PA",
  btnSkipYear: "PA",
  btnSkipped: "PA",
  outcomeDone: "F",
  outcomeSkipped: "F",
  skippedThisYear: "F",
  // Documenti ricevuti, modello, import (templateCaption: la regola T vale per la prima riga)
  fileTooBigTelegram: "E",
  fileTooBig: "E",
  useRipristina: "I",
  sendCsv: "I",
  downloadFailed: "E",
  waitingBackupFile: "D",
  templateCaption: "T",
  csvNotUtf8: "E",
  csvInvalidHeader: "E",
  csvEmpty: "E",
  csvTooManyRows: "E",
  "rowReason.*": "F",
  previewTitle: "T",
  previewNew: "F",
  previewExampleSkipped: "F",
  previewDuplicates: "F",
  previewDuplicateLine: "R",
  previewErrors: "A",
  previewErrorLine: "R",
  previewGroups: "F",
  previewTruncated: "F",
  previewShort: "T",
  previewMoreGroups: "F",
  btnImport: "PA",
  imported: "C",
  becameDuplicates: "A",
  nothingImported: "A",
  // Export, backup, ripristino
  exportCaption: "T",
  backupCaption: "T",
  restoreAsk: "D",
  restoreConfirm1: "A",
  restoreConfirm2: "A",
  btnContinue: "PA",
  btnRestore: "PA",
  restoreDone: "C",
  backupNotJson: "E",
  backupWrongFormat: "E",
  backupVersion: "E",
  backupInvalidField: "E",
  backupDuplicateId: "E",
  backupInvalidSetting: "E",
  backupDuplicateGroupName: "E",
  backupMissingRef: "E",
  backupDuplicateOccurrence: "E",
  // /statistiche, avviso di buco, /stato (invariati, FR-018)
  statsTitle: "T",
  statsMonthsTitle: "T",
  statsDone: "F",
  statsPersons: "F",
  statsGroup: "F",
  statsNoGroup: "F",
  statsGroups: "F",
  statsMissing: "F",
  statsYear: "F",
  gapAlert: "A",
  statoTitle: "T",
  statoCron: "F",
  statoToday: "F",
  statoWeek: "F",
  statoBackup: "F",
  statoWebhookOk: "F",
  statoWebhookError: "F",
  statoWebhookUnavailable: "F",
  statoAbandoned: "R",
  "statoBackupEsito.*": "F",
  statoKind: "F",
  statoWhen: "F",
  statoAt: "F",
  neverRecorded: "F",
  // Comuni (btnSkip sta con l'inserimento guidato)
  actionUnavailable: "E",
  personNotFound: "E",
  notUnderstood: "E",
  cancelled: "I",
  nothingToCancel: "I",
  genericError: "E",
  btnCancel: "PA",
  btnYes: "PA",
  btnFix: "PA",
  btnDone: "PA",
  btnClear: "PA",
  yourId: "I",
};

const DAY: LocalDate = { year: 2026, month: 10, day: 29 };
const CLOCK: LocalClock = { ...DAY, hour: 15, minute: 0 };
const COUNTS: Counts = { persons: 3, groups: 2, occurrences: 5 };
const DELIVERY: DeliveryCounts = { inviati: 3, falliti: 0, abbandonati: 1 };

// Argomenti d'esempio di ogni chiave funzione (stringhe senza emoji, così l'emoji viene solo dal bot).
const ESEMPI: Record<string, readonly unknown[]> = {
  yourId: [1001],
  confirmDate: ["14 marzo 1994"],
  confirmPhone: ["+39 333 1234567"],
  selected: ["Media"],
  groupToggle: ["Famiglia", false],
  possibleDuplicate: ["Marco Rossi", "14/03"],
  tooLong: [3],
  personSaved: ["Marchino"],
  schedaTitle: ["Marco Rossi", "Marchino"],
  schedaDate: ["14/03/1994", "compie 33 anni tra 3 giorni"],
  schedaAge: [3, 3],
  schedaNoAge: [3],
  schedaPriority: ["alta"],
  schedaGroups: ["Famiglia"],
  schedaPhone: ["+39 333 1234567"],
  schedaMessageCustom: ["Tanti auguri"],
  schedaHistory: ["2025 fatto"],
  personUpdated: ["Marchino"],
  confirmDeletePerson: ["Marco Rossi"],
  personDeleted: ["Marchino"],
  groupButton: ["Famiglia", 3],
  groupLine: ["Famiglia", 3],
  groupCardTitle: ["Famiglia", 3],
  groupsMany: ["fam"],
  groupNoMatch: ["fam"],
  askRenameTo: ["Famiglia"],
  confirmDeleteGroup: ["Famiglia", 3],
  groupCreated: ["Famiglia"],
  groupRenamed: ["Famiglia"],
  groupDeleted: ["Famiglia"],
  reminderTitle: ["Marchino", "Marco Rossi", 32, false],
  reminderGroups: ["Famiglia"],
  reminderPhone: ["+39 333 1234567"],
  recoveryTitle: ["Marchino", "Marco Rossi"],
  preReminder: [3, "Marchino", 32, "14/03"],
  upcomingHeader: [30, "Famiglia"],
  upcomingNone: [30, "Famiglia"],
  upcomingDaysRange: [3],
  searchHeader: ["marco"],
  searchNone: ["marco"],
  monthHeader: ["marzo", 2026],
  monthNone: ["marzo"],
  overdueHeader: [3],
  overdueNone: [3],
  yearHeader: [2026],
  yearCounts: [3, 3, 3],
  yearInvalid: [2000, 2026],
  statsPersons: [3, 1, 1, 1],
  statsGroup: ["Famiglia", 3],
  statsNoGroup: [3],
  statsGroups: [["Famiglia 3"]],
  statsMissing: [3, 3],
  statsYear: [2026, 87],
  statsDone: [["2026 87%"]],
  gapAlert: [CLOCK, CLOCK, DAY],
  statoWhen: [CLOCK, DAY],
  statoAt: [CLOCK],
  statoCron: ["oggi alle 15:00"],
  statoToday: [DELIVERY],
  statoWeek: [DELIVERY],
  statoKind: ["giorno", 9],
  statoAbandoned: ["Marchino", "recupero", DAY],
  statoBackup: ["oggi alle 15:00"],
  statoWebhookOk: [3],
  statoWebhookError: ["oggi alle 15:00", "Bad Gateway", 3],
  greetingAsk: ["Tanti auguri {nome}"],
  greetingPreview: ["Tanti auguri Marco"],
  greetingTooLong: [3, 3],
  "rowReason.dateInvalid": ["31/02"],
  "rowReason.priorityInvalid": ["urgente"],
  "rowReason.groupTooLong": ["Famiglia"],
  "rowReason.groupKeyTooShort": ["F"],
  previewNew: [3],
  previewDuplicates: [3],
  previewDuplicateLine: [3, "Marco Rossi", "14/03"],
  previewErrors: [3],
  previewErrorLine: [3, ["nome mancante"]],
  previewGroups: ["Famiglia"],
  previewTruncated: [3],
  previewShort: [3, 3, 3, "Famiglia"],
  previewMoreGroups: [3],
  imported: [3, 2],
  becameDuplicates: [3],
  exportCaption: [3],
  backupCaption: [3, 2, 5],
  restoreConfirm1: ["29/10/2026", COUNTS, COUNTS],
  restoreDone: [COUNTS, false],
  backupVersion: ["9"],
  backupInvalidField: ["persona", "3", "nome"],
  backupDuplicateId: ["persona", "3"],
  backupInvalidSetting: ["messaggio"],
  backupMissingRef: ["gruppo", "3"],
  backupDuplicateOccurrence: ["3"],
};

// Valore di una chiave di T, anche annidata ("editAsk.n").
function valoreDi(chiave: string): unknown {
  let v: unknown = T;
  for (const parte of chiave.split(".")) {
    if (typeof v !== "object" || v === null || !(parte in v)) throw new Error(`chiave inesistente in T: ${chiave}`);
    v = (v as Record<string, unknown>)[parte];
  }
  return v;
}

// Testo (o testi, se la funzione restituisce un array) di una chiave; le funzioni usano ESEMPI.
function testoDi(chiave: string): string[] {
  const v = valoreDi(chiave);
  let out: unknown = v;
  if (typeof v === "function") {
    const args = ESEMPI[chiave];
    if (!args) throw new Error(`manca la voce in ESEMPI per la funzione ${chiave}`);
    out = (v as (...a: readonly unknown[]) => unknown)(...args);
  }
  const testi = Array.isArray(out) ? out : [out];
  for (const t of testi) if (typeof t !== "string") throw new Error(`${chiave} non produce una stringa`);
  return testi as string[];
}

const iniziaConEmoji = (s: string) => /^\p{Extended_Pictographic}/u.test(s);
const contieneEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

// Icone delle domande (FR-007, mappa chiusa).
const ICONE_DOMANDE = ["👤", "💬", "🎂", "📱", "📸", "✈️", "👥", "⭐", "✍️", "📋", "✏️", "💾"];
// Pulsanti di azione con icona (FR-009, elenco chiuso).
const PULSANTI_CON_ICONA = ["btnEdit", "btnRename", "btnDelete", "btnDeleteGroup", "btnSkip", "btnNewGroup", "btnOutcomeDone"];

// Foglie di un valore di T in notazione a punto (le funzioni e le stringhe sono foglie).
function foglie(v: unknown, prefisso: string): string[] {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return Object.entries(v).flatMap(([k, x]) => foglie(x, prefisso ? `${prefisso}.${k}` : k));
  }
  return [prefisso];
}

// Chiavi dell'inventario con "prefisso.*" espanso nelle foglie del prefisso.
const espandi = (chiave: string) => (chiave.endsWith(".*") ? foglie(valoreDi(chiave.slice(0, -2)), chiave.slice(0, -2)) : [chiave]);

const voci = (tipo: Tipo) =>
  Object.entries(INVENTARIO)
    .filter(([, t]) => t === tipo)
    .flatMap(([k]) => espandi(k));

// Esegue un controllo per ogni chiave del tipo; con nessuna chiave registra un todo.
function perTipo(tipo: Tipo, descrizione: string, check: (chiave: string, testo: string) => void): void {
  const chiavi = voci(tipo);
  if (chiavi.length === 0) {
    it.todo(`${tipo}: ${descrizione}`);
    return;
  }
  it.each(chiavi)(`${tipo} %s: ${descrizione}`, (chiave) => {
    for (const testo of testoDi(chiave)) check(chiave, testo);
  });
}

describe("RNF-19, FR-004a: regole per tipo di testo", () => {
  perTipo("T", "inizia con l'emoji di sezione", (k, s) => expect(iniziaConEmoji(s), `${k}: ${s}`).toBe(true));
  perTipo("D", "inizia con l'icona del campo", (k, s) => {
    if (k === "confirmDate") return; // §5.2: conferma della data senza icona (research R-03)
    expect(ICONE_DOMANDE.some((i) => s.startsWith(i)), `${k}: ${s}`).toBe(true);
  });
  perTipo("C", "contiene 🎉 o ✅ (welcome: 👋)", (k, s) => {
    if (k === "welcome") expect(s).toContain("👋");
    else expect(s.includes("🎉") || s.includes("✅"), `${k}: ${s}`).toBe(true);
  });
  perTipo("A", "inizia con ⚠️", (k, s) => expect(s.startsWith("⚠️"), `${k}: ${s}`).toBe(true));
  perTipo("E", "inizia con ❌", (k, s) => expect(s.startsWith("❌"), `${k}: ${s}`).toBe(true));
  perTipo("I", "senza 🎉 ✅ ⚠️ ❌", (k, s) => {
    for (const e of ["🎉", "✅", "⚠️", "❌"]) expect(s.includes(e), `${k}: ${s}`).toBe(false);
  });
  perTipo("R", "nessuna emoji", (k, s) => expect(contieneEmoji(s), `${k}: ${s}`).toBe(false));
  perTipo("PA", "icona solo nell'elenco chiuso di FR-009", (k, s) =>
    expect(contieneEmoji(s), `${k}: ${s}`).toBe(PULSANTI_CON_ICONA.includes(k)),
  );
  perTipo("PC", "nessuna emoji", (k, s) => expect(contieneEmoji(s), `${k}: ${s}`).toBe(false));
  perTipo("F", "risolvibile", (k) => expect(testoDi(k).length).toBeGreaterThan(0));
});

describe("FR-007: stessa icona del campo in inserimento e in Modifica", () => {
  it.each([
    ["askFullName", "editAsk.n", "👤"],
    ["askNickname", "editAsk.k", "💬"],
    ["askBirthDate", "editAsk.d", "🎂"],
    ["askPhone", "editAsk.p", "📱"],
    ["askInstagram", "editAsk.i", "📸"],
    ["askTelegram", "editAsk.t", "✈️"],
    ["askMessage", "editAsk.m", "✍️"],
  ])("%s e %s iniziano con %s", (inserimento, modifica, icona) => {
    expect(testoDi(inserimento)[0]!.startsWith(icona)).toBe(true);
    expect(testoDi(modifica)[0]!.startsWith(icona)).toBe(true);
  });
});

describe("FR-002, FR-014: la vista vuota ha la stessa emoji dell'intestazione", () => {
  const prima = (s: string) => s.match(/^\p{Extended_Pictographic}️?/u)?.[0];
  it.each([
    ["upcomingHeader", "upcomingNone", "📆"],
    ["monthHeader", "monthNone", "🗓"],
    ["searchHeader", "searchNone", "🔍"],
    ["overdueHeader", "overdueNone", "⏳"],
    ["todayOthers", "todayNone", "🎂"],
    ["todayOthers", "todayNoPersons", "🎂"],
  ])("%s e %s iniziano con %s", (intestazione, vuota, emoji) => {
    expect(prima(testoDi(intestazione)[0]!)).toBe(emoji);
    expect(prima(testoDi(vuota)[0]!)).toBe(emoji);
  });
  it("📆 vale anche per un giorno solo", () => {
    expect(T.upcomingHeader(1, null).startsWith("📆")).toBe(true);
    expect(T.upcomingNone(1, null).startsWith("📆")).toBe(true);
  });
});

describe("FR-003: righe di lista senza emoji", () => {
  it("formatListLine non aggiunge emoji a una persona senza emoji nel nome", () => {
    const base = { date: DAY, birthDay: 29, birthMonth: 10, name: "Anna Bianchi", age: 36, id: 4 };
    expect(contieneEmoji(formatListLine(base, 12).text)).toBe(false);
    expect(contieneEmoji(formatListLine({ ...base, age: null, outcome: T.listOutcome.non_confermato }, 12).text)).toBe(false);
  });
});

describe("FR-013: benvenuto e aiuto", () => {
  it("il benvenuto contiene 👋", () => {
    expect(T.welcome).toContain("👋");
  });

  it("solo la prima riga di /aiuto ha l'emoji; resta sotto il limite di un messaggio (research R-06)", () => {
    const [prima, ...altre] = T.help.split("\n");
    expect(iniziaConEmoji(prima!)).toBe(true);
    for (const r of altre) expect(contieneEmoji(r), r).toBe(false);
    expect(T.help.length).toBeLessThan(MESSAGE_MAX_LENGTH);
  });
});

describe("FR-010, FR-012: promemoria", () => {
  it("SC-004: pulsanti di contatto invariati e senza icona", () => {
    expect([T.btnWhatsApp, T.btnInstagram, T.btnTelegram, T.btnCopy]).toEqual(["WhatsApp", "Instagram", "Telegram", "Copia messaggio"]);
  });

  it("research R-04: reminderTitle termina con \"!\" anche senza età e con la nota del 29/02", () => {
    expect(T.reminderTitle("Marchino", "Marco Rossi", 32, false).endsWith("anni!")).toBe(true);
    expect(T.reminderTitle("Marchino", null, null, false).endsWith("Marchino!")).toBe(true);
    expect(T.reminderTitle("Marchino", null, 31, true).endsWith("(compleanno il 29/02)!")).toBe(true);
  });
});

describe("FR-015, FR-016: didascalia del modello", () => {
  it("prima riga con 📄, righe • senza emoji, entro il limite delle didascalie (research R-06)", () => {
    const [prima, ...altre] = T.templateCaption.split("\n");
    expect(prima!.startsWith("📄")).toBe(true);
    for (const r of altre) expect(contieneEmoji(r), r).toBe(false);
    expect(T.templateCaption.length).toBeLessThanOrEqual(DOCUMENT_CAPTION_MAX_LENGTH);
  });
});

describe("research R-03, R-06: toast di answerCallbackQuery", () => {
  it.each(["actionUnavailable", "personNotFound"])("%s resta entro i 200 caratteri", (chiave) => {
    expect(testoDi(chiave)[0]!.length).toBeLessThanOrEqual(200);
  });
});

describe("RNF-19: testi esclusi dalla guida", () => {
  it("A-06, FR-020: messaggio di auguri di default invariato", () => {
    expect(DEFAULT_BIRTHDAY_MESSAGE).toBe("Tanti auguri {nome}! 🎉");
  });

  it("004 FR-007a: riga d'esempio del modello invariata", () => {
    expect(CSV_EXAMPLE_ROW).toEqual([
      "Esempio Da Cancellare",
      "Esempio",
      "14/03/1990",
      "+39 3331234567",
      "esempio.ig",
      "esempio_tg",
      "Famiglia|Amici",
      "alta",
      "Tanti auguri {nome}!",
    ]);
  });

  it("§5.1: menu dei comandi senza emoji", () => {
    for (const c of BOT_COMMANDS) expect(contieneEmoji(c.description), c.command).toBe(false);
  });
});

describe("FR-004a, SC-001: inventario completo", () => {
  it("100% delle chiavi di T classificate, nessuna chiave inesistente", () => {
    const tutte = foglie(T, "").sort();
    const inventariate = Object.keys(INVENTARIO)
      .flatMap((k) => (k.endsWith(".*") ? foglie(valoreDi(k.slice(0, -2)), k.slice(0, -2)) : [k]))
      .sort();
    expect(tutte.filter((k) => !inventariate.includes(k)), "chiavi di T non classificate").toEqual([]);
    expect(inventariate.filter((k) => !tutte.includes(k)), "chiavi dell'inventario non più in T").toEqual([]);
    expect(new Set(inventariate).size).toBe(inventariate.length);
  });
});
