// Tutti i testi rivolti all'utente (RNF-15): si cambiano qui senza toccare la logica.

import {
  CSV_COLUMNS,
  CSV_GROUP_SEPARATOR,
  GROUP_KEY_MIN_LENGTH,
  IMPORT_MAX_ROWS,
  OUTCOME_CORRECTION_DAYS,
  RECEIVED_FILE_MAX_BYTES,
  STATUS_WINDOW_DAYS,
  TELEGRAM_DOWNLOAD_MAX_BYTES,
  TEXT_LIMITS,
} from "./config";
import type { Kind } from "./domain/schedule";
import type { BotCommand } from "./telegram/types";
import type { LocalClock, LocalDate } from "./time";

export const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

// Giorni della settimana delle liste (AFU §5.7): indice = Date.getUTCDay().
export const WEEKDAYS_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;

// Mesi abbreviati dell'istogramma di /statistiche (AFU §5.11): "Gen" … "Dic".
export const MONTHS_SHORT = MONTHS_IT.map((m) => m.charAt(0).toUpperCase() + m.slice(1, 3));

const daysSuffix = (group: string | null) => (group ? ` (${group})` : "");

const MB = 1024 * 1024;

// Migliaia separate da "." (contracts/flussi.md di 004: "1.204 occorrenze").
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Conteggi di un backup o dei dati attuali (FR-019, FR-020).
export interface Counts {
  persons: number;
  groups: number;
  occurrences: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Orari di /stato e dell'avviso di buco (AFU §5.10, §5.12): "H:MM", ora senza zero iniziale.
const clock = (c: LocalClock) => `${c.hour}:${pad2(c.minute)}`;
const ddmm = (d: LocalDate) => `${pad2(d.day)}/${pad2(d.month)}`;
const sameDay = (a: LocalDate, b: LocalDate) => a.year === b.year && a.month === b.month && a.day === b.day;

// Conteggi degli invii di /stato (AFU §5.10): "3 inviati, 0 falliti, 1 abbandonato".
export interface DeliveryCounts {
  inviati: number;
  falliti: number;
  abbandonati: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const deliveryCounts = (c: DeliveryCounts) =>
  `${plural(c.inviati, "inviato", "inviati")}, ${plural(c.falliti, "fallito", "falliti")}, ` +
  plural(c.abbandonati, "abbandonato", "abbandonati");

const countsText = (c: Counts) =>
  `${thousands(c.persons)} persone, ${thousands(c.groups)} gruppi, ${thousands(c.occurrences)} occorrenze`;

// FR-007a, contracts/csv.md: riga d'esempio del modello, saltata all'import. Una sola definizione.
export const CSV_EXAMPLE_ROW = [
  "Esempio Da Cancellare",
  "Esempio",
  "14/03/1990",
  "+39 3331234567",
  "esempio.ig",
  "esempio_tg",
  "Famiglia|Amici",
  "alta",
  "Tanti auguri {nome}!",
] as const;

export const T = {
  // Comuni
  actionUnavailable: "❌ Questa azione non è più disponibile.",
  personNotFound: "❌ Non trovo questa persona: forse è stata eliminata.",
  notUnderstood: "❌ Non ho capito. Scrivi /aiuto per vedere cosa so fare.",
  cancelled: "Ok, ho annullato.",
  nothingToCancel: "Non c'è nessuna operazione da annullare.",
  genericError: "❌ Qualcosa è andato storto. Riprova tra poco.",
  btnCancel: "Annulla",
  btnSkip: "⏭ Salta",
  btnYes: "Sì",
  btnFix: "Correggi",
  btnDone: "Fine",
  btnClear: "Svuota",

  // US1 — /id
  yourId: (id: number) => `Il tuo ID Telegram è ${id}`,

  // US2 — inserimento guidato
  askFullName: "👤 Come si chiama? Nome e cognome",
  askNickname: "💬 Come lo chiami nei messaggi? (nickname)",
  askBirthDate: "🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno",
  confirmDate: (s: string) => `${s}, giusto?`,
  invalidDate: "❌ Data non valida. Usa gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994).",
  // FR-007 di 006, AFU §5.2.
  askPhone: "📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎",
  invalidPhone: "❌ Numero non valido. Scrivilo con il prefisso, es. +39 333 1234567",
  // RF-01, RF-04: telefono da contatto condiviso (FR-009, FR-010 di 006).
  confirmPhone: (n: string) => `📱 ${n}, giusto?`,
  contactWithoutPhone: "❌ Questo contatto non ha un numero di telefono: scrivilo tu.",
  askInstagram: "📸 Username Instagram?",
  askTelegram: "✈️ Username Telegram?",
  askGroups: "👥 Gruppi?",
  btnNewGroup: "➕ Nuovo gruppo",
  askNewGroupName: "👥 Come si chiama il nuovo gruppo?",
  groupExists: "❌ Hai già un gruppo con questo nome: scegline un altro.",
  askPriority: "⭐ Priorità?",
  btnHigh: "Alta",
  btnMedium: "Media",
  btnLow: "Bassa",
  selected: (label: string) => `${label} ✓`,
  groupToggle: (name: string, on: boolean) => `${on ? "☑" : "☐"} ${name}`,
  askMessage: "✍️ Messaggio di auguri personalizzato? Se salti uso quello standard.",
  summaryTitle: "📋 Riepilogo:",
  btnSave: "Salva",
  btnSaveAnyway: "Salva comunque",
  possibleDuplicate: (name: string, date: string) =>
    `⚠️ Hai già ${name} con data ${date}: potrebbe essere un duplicato. Vuoi salvarlo comunque?`,
  tooLong: (max: number) => `❌ Testo troppo lungo: al massimo ${max} caratteri.`,
  emptyValue: "❌ Il valore non può essere vuoto.",
  // FR-008 di 008: in testa alla scheda dopo il salvataggio, nello stesso messaggio.
  personSaved: (name: string) => `🎉 Fatto! ${name} è in rubrica.`,

  // Scheda (AFU §5.6)
  schedaTitle: (name: string, nickname: string | null) => `👤 ${name}${nickname ? ` — "${nickname}"` : ""}`,
  schedaDate: (date: string, when: string) => `🎂 ${date} · ${when}`,
  schedaAge: (age: number, days: number) =>
    days === 0 ? `compie ${age} anni oggi` : days === 1 ? `compie ${age} anni domani` : `compie ${age} anni tra ${days} giorni`,
  schedaNoAge: (days: number) =>
    days === 0 ? "compleanno oggi" : days === 1 ? "compleanno domani" : `compleanno tra ${days} giorni`,
  schedaPriority: (p: string) => `Priorità: ${p}`,
  schedaGroups: (names: string) => `Gruppi: ${names}`,
  schedaPhone: (phone: string) => `📱 ${phone}`,
  schedaMessageStandard: "Messaggio: standard",
  schedaMessageCustom: (m: string) => `Messaggio: "${m}"`,
  schedaHistory: (items: string) => `Storico: ${items}`,
  outcome: { fatto: "fatto", saltato: "saltato", non_confermato: "non confermato" },
  btnEdit: "✏️ Modifica",
  btnDelete: "🗑 Elimina",

  // US4 — modifica
  editWhichField: "✏️ Quale campo vuoi modificare?",
  fieldLabels: {
    n: "Nome",
    k: "Nickname",
    d: "Data",
    p: "Telefono",
    i: "Instagram",
    t: "Telegram",
    g: "Gruppi",
    r: "Priorità",
    m: "Messaggio",
  },
  editAsk: {
    n: "👤 Nuovo nome completo?",
    k: "💬 Nuovo nickname?",
    d: "🎂 Nuova data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno",
    // FR-012 di 006: stesse regole di RF-01, compreso il suggerimento del contatto.
    p: "📱 Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎",
    i: "📸 Nuovo username Instagram?",
    t: "✈️ Nuovo username Telegram?",
    m: "✍️ Nuovo messaggio di auguri personalizzato?",
  },
  // In testa alla scheda dopo una modifica, nello stesso messaggio.
  personUpdated: (name: string) => `✅ Ho aggiornato ${name}.`,

  // US5 — eliminazione
  confirmDeletePerson: (name: string) => `⚠️ Vuoi eliminare ${name}? Perderai anche il suo storico.`,
  personDeleted: (name: string) => `✅ Ho eliminato ${name}.`,

  // US6 — gruppi (v1.1: RF-07, RF-19, contracts/gruppi.md di 005)
  groupsTitle: "👥 I tuoi gruppi",
  groupButton: (name: string, n: number) => `${name} (${n})`,
  // Righe dell'elenco testuale oltre GROUP_BUTTONS_MAX gruppi (FR-013).
  groupLine: (name: string, n: number) => `${name} (${n})`,
  groupsTypeName: "Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam",
  groupCardTitle: (name: string, n: number) => `👥 ${name} · ${n === 1 ? "1 persona" : `${n} persone`}`,
  groupCardEmpty: "Nel gruppo non c'è ancora nessuno.",
  groupGone: "❌ Questo gruppo non esiste più.",
  // Ricerca (FR-007): `q` è il testo come scritto dall'utente.
  groupsMany: (q: string) => `🔍 Più gruppi corrispondono a «${q}»:`,
  groupNoMatch: (q: string) => `🔍 Nessun gruppo corrisponde a «${q}».`,
  // FR-006a
  groupKeyTooShort: `❌ Il nome del gruppo deve avere almeno ${GROUP_KEY_MIN_LENGTH} lettere o cifre.`,
  noGroups: "👥 Non hai ancora nessun gruppo.",
  btnRename: "✏️ Rinomina",
  btnDeleteGroup: "🗑 Elimina",
  askRenameTo: (name: string) => `👥 Nuovo nome per il gruppo ${name}?`,
  confirmDeleteGroup: (name: string, n: number) =>
    `⚠️ Vuoi eliminare il gruppo ${name}? ` +
    (n === 0
      ? "Nessuna persona ha questa etichetta"
      : n === 1
        ? "1 persona perderà questa etichetta"
        : `${n} persone perderanno questa etichetta`),
  groupCreated: (name: string) => `✅ Ho creato il gruppo ${name}.`,
  groupRenamed: (name: string) => `✅ Ho rinominato il gruppo in ${name}.`,
  groupDeleted: (name: string) => `✅ Ho eliminato il gruppo ${name}.`,

  // Promemoria (AFU §5.3–§5.5, contracts/promemoria.md). Il "!" finale segue §5.3 (research R-04 di 008).
  reminderTitle: (name: string, fullName: string | null, age: number | null, leap29: boolean) =>
    `🎂 Oggi è il compleanno di ${name}${fullName ? ` (${fullName})` : ""}` +
    `${age !== null ? `, compie ${age} anni` : ""}${leap29 ? " (compleanno il 29/02)" : ""}!`,
  reminderGroups: (names: string) => `Gruppi: ${names}`,
  reminderPhone: (phone: string) => `📱 ${phone}`,
  lastYear: { fatto: "L'anno scorso: fatto ✅", saltato: "L'anno scorso: saltato" },
  recoveryTitle: (name: string, fullName: string | null) =>
    `⏰ Ieri era il compleanno di ${name}${fullName ? ` (${fullName})` : ""}. Hai fatto gli auguri?`,
  preReminder: (days: number, name: string, age: number | null, ddmm: string) =>
    `📅 Tra ${days === 1 ? "1 giorno" : `${days} giorni`}: compleanno di ${name}${age !== null ? ` (${age} anni)` : ""} — ${ddmm}`,
  btnWhatsApp: "WhatsApp",
  btnInstagram: "Instagram",
  btnTelegram: "Telegram",
  btnCopy: "Copia messaggio",
  btnOutcomeDone: "Fatto ✅",
  btnSkipYear: "Salta quest'anno",
  btnSkipped: "Saltato",
  outcomeDone: "✅ Fatto",
  outcomeSkipped: "Saltato",
  skippedThisYear: "Saltato quest'anno",

  // Viste e ricerche (feature 003, contracts/comandi.md)
  listOutcome: { aperta: "in attesa", saltato: "saltato", non_confermato: "non confermato" },
  // RF-16
  todayNone: "🎂 Oggi non ci sono compleanni. Il prossimo:",
  todayNoPersons: "🎂 Oggi non ci sono compleanni e la rubrica è ancora vuota.",
  todayOthers: "🎂 Altri compleanni di oggi:",
  // RF-17
  upcomingHeader: (days: number, group: string | null) =>
    `📆 ${days === 1 ? "Prossimo giorno" : `Prossimi ${days} giorni`}${daysSuffix(group)}`,
  upcomingNone: (days: number, group: string | null) =>
    `📆 ${days === 1 ? "Nessun compleanno nel prossimo giorno" : `Nessun compleanno nei prossimi ${days} giorni`}${daysSuffix(group)}`,
  upcomingDaysRange: (max: number) => `❌ Il numero di giorni deve essere tra 1 e ${max}.`,
  // RF-18
  searchUsage: "Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco",
  searchHeader: (q: string) => `🔍 Risultati per «${q}»`,
  searchNone: (q: string) => `🔍 Nessun risultato per «${q}»`,
  // RF-20
  monthHeader: (monthName: string, year: number) => `🗓 Compleanni di ${monthName} ${year}`,
  monthNone: (monthName: string) => `🗓 Nessun compleanno a ${monthName}`,
  monthInvalid: "❌ Mese non riconosciuto: scrivilo per nome (es. marzo) o per numero da 1 a 12.",
  // RF-21, BR-08
  btnMarkDone: "Segna fatto",
  overdueHeader: (days: number) => `⏳ Ultimi ${days} giorni, non fatti`,
  overdueNone: (days: number) => `⏳ Nessun compleanno in sospeso negli ultimi ${days} giorni`,
  // RF-22
  yearHeader: (y: number) => `🗂 Riepilogo ${y}`,
  yearCounts: (f: number, s: number, n: number) => [`Fatto: ${f}`, `Saltato: ${s}`, `Non confermato: ${n}`],
  yearSkipped: "Saltati:",
  yearStreak: "Saltati per 2 o più anni di fila:",
  yearNone: "nessuno",
  yearInvalid: (min: number, max: number) => `❌ Anno non valido: scrivi un anno tra ${min} e ${max}.`,

  // /statistiche (RF-32, AFU §5.11, contracts/statistiche.md)
  statsTitle: "📊 Statistiche",
  statsPersons: (n: number, alta: number, media: number, bassa: number) =>
    `${plural(n, "persona", "persone")} · Alta ${alta} · Media ${media} · Bassa ${bassa}`,
  statsGroup: (name: string, n: number) => `${name} ${n}`,
  statsNoGroup: (n: number) => `Senza gruppo ${n}`,
  statsGroups: (items: readonly string[]) => `Gruppi: ${items.length > 0 ? items.join(" · ") : "nessun gruppo"}`,
  statsMissing: (senzaAnno: number, senzaContatti: number) =>
    `Senza anno di nascita: ${senzaAnno} · Senza contatti: ${senzaContatti}`,
  statsMonthsTitle: "🎂 Compleanni per mese",
  statsYear: (year: number, percent: number) => `${year} ${percent}%`,
  statsDone: (items: readonly string[]) =>
    `✅ Auguri fatti: ${items.length > 0 ? items.join(" · ") : "non ci sono ancora anni con esiti"}`,

  // Avviso di buco del cron (N-06, FR-006, AFU §5.12)
  gapAlert: (from: LocalClock, to: LocalClock, today: LocalDate) =>
    "⚠️ Il controllo orario non è girato " +
    (sameDay(from, today) && sameDay(to, today)
      ? `dalle ${clock(from)} alle ${clock(to)} di oggi`
      : `dalle ${clock(from)} del ${ddmm(from)} alle ${clock(to)} del ${ddmm(to)}`) +
    ":\nalcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.",

  // /stato (RF-31, AFU §5.10, contracts/stato.md)
  statoTitle: "🩺 Stato del bot",
  neverRecorded: "mai registrato",
  // "oggi alle 15:00" se è la data di oggi, altrimenti "28/10 alle 23:00".
  statoWhen: (c: LocalClock, today: LocalDate) => (sameDay(c, today) ? `oggi alle ${clock(c)}` : `${ddmm(c)} alle ${clock(c)}`),
  statoAt: (c: LocalClock) => `${ddmm(c)} alle ${clock(c)}`,
  statoCron: (when: string) => `⏱ Ultimo controllo orario: ${when}`,
  statoToday: (c: DeliveryCounts) => `📨 Oggi: ${deliveryCounts(c)}`,
  statoWeek: (c: DeliveryCounts) => `📨 Ultimi ${STATUS_WINDOW_DAYS} giorni: ${deliveryCounts(c)}`,
  // Tipo e riferimento dell'invio, coerenti con i promemoria di 002.
  statoKind: (kind: Kind, ref: number) =>
    kind === "pre"
      ? `pre-reminder a ${ref === 1 ? "1 giorno" : `${ref} giorni`}`
      : kind === "giorno"
        ? `reminder delle ${ref}:00`
        : "recupero",
  statoAbandoned: (name: string, what: string, date: LocalDate) => `   – ${name}, ${what} del ${ddmm(date)}`,
  statoBackup: (when: string) => `💾 Ultimo backup mensile: ${when}`,
  statoBackupEsito: { riuscito: "✅", non_riuscito: "❌ non riuscito", in_invio: "⚠️ esito sconosciuto" },
  statoWebhookOk: (pending: number) => `🔗 Webhook: nessun errore, ${pending} update in coda`,
  statoWebhookError: (when: string, message: string, pending: number) =>
    `🔗 Webhook: ultimo errore ${when}: "${message}", ${pending} update in coda`,
  statoWebhookUnavailable: "🔗 Webhook: non disponibile",

  // /messaggio (contracts/messaggio.md)
  greetingAsk: (current: string) =>
    `✍️ Messaggio attuale: «${current}»\nScrivi il nuovo messaggio di auguri. Usa {nome} per il nome.`,
  greetingPreview: (text: string) => `✍️ Anteprima: «${text}»\nConfermi?`,
  greetingSaved: "✅ Ho aggiornato il messaggio di auguri.",
  greetingTooLong: (max: number, perName: number) =>
    `❌ Il messaggio può avere al massimo ${max} caratteri (ogni {nome} conta ${perName}).`,
  sampleName: "Marco",
  btnConfirm: "Conferma",

  // Documenti ricevuti (feature 004, contracts/comandi.md)
  fileTooBigTelegram: `❌ Il file è troppo grande: Telegram mi lascia ricevere file fino a ${TELEGRAM_DOWNLOAD_MAX_BYTES / MB} MB.`,
  fileTooBig: `❌ Il file è troppo grande: al massimo ${RECEIVED_FILE_MAX_BYTES / MB} MB.`,
  useRipristina: "Per ripristinare un backup usa /ripristina.",
  sendCsv: "Per importare persone inviami un file .csv (usa /modello per il formato).",
  downloadFailed: "❌ Non sono riuscito a scaricare il file. Riprova.",
  waitingBackupFile: "💾 Aspetto il file JSON di backup. Usa /annulla per interrompere.",

  // /modello (RF-23, FR-007): legenda nella caption del documento (≤ 1024 caratteri).
  templateCaption: [
    "📄 Ecco il modello per importare le persone: compilalo al PC e rimandamelo qui.",
    "",
    "• nome e data sono obbligatori",
    "• data: gg/mm/aaaa oppure gg/mm se l'anno non è noto (formatta la colonna come Testo)",
    "• telefono: con o senza +39",
    "• instagram, telegram: username, con o senza @",
    `• gruppi: separati da ${CSV_GROUP_SEPARATOR} (es. Famiglia${CSV_GROUP_SEPARATOR}Amici); quelli nuovi vengono creati`,
    "• priorita: alta, media o bassa (vuota = media)",
    "• messaggio: auguri personalizzati, {nome} diventa il nome",
    "• la riga d'esempio viene ignorata: puoi lasciarla o cancellarla",
    '• separatore ; oppure , — salva come "CSV UTF-8"',
  ].join("\n"),

  // Rifiuto del CSV per intero (contracts/comandi.md)
  csvNotUtf8: '❌ Non riesco a leggere il file: salvalo da Excel come "CSV UTF-8" e rimandalo.',
  csvInvalidHeader: `❌ Intestazione non valida. Colonne attese: ${CSV_COLUMNS.join("; ")} (obbligatorie: nome e data).`,
  csvEmpty: "❌ Il file non contiene righe da importare.",
  csvTooManyRows: `❌ Il file ha più di ${IMPORT_MAX_ROWS} righe: dividilo in file da al massimo ${IMPORT_MAX_ROWS} righe.`,

  // Motivi di errore di riga (FR-010, contracts/csv.md)
  rowReason: {
    nameMissing: "nome mancante",
    nameTooLong: `nome troppo lungo (max ${TEXT_LIMITS.fullName})`,
    nicknameTooLong: `nickname troppo lungo (max ${TEXT_LIMITS.nickname})`,
    dateMissing: "data mancante",
    dateInvalid: (v: string) => `data "${v}" non valida`,
    phoneInvalid: "telefono non valido",
    priorityInvalid: (v: string) => `priorità "${v}" non valida`,
    groupTooLong: (v: string) => `gruppo "${v}" troppo lungo (max ${TEXT_LIMITS.groupName})`,
    // FR-006a: solo per i gruppi da creare.
    groupKeyTooShort: (v: string) => `gruppo "${v}" senza almeno ${GROUP_KEY_MIN_LENGTH} lettere o cifre`,
    messageTooLong: "messaggio troppo lungo",
    extraColumns: "colonne in più",
  },

  // Anteprima e flusso import (contracts/flussi.md)
  previewTitle: "📥 Anteprima import",
  previewNew: (n: number) => (n === 1 ? "1 persona nuova" : `${n} persone nuove`),
  previewExampleSkipped: "Riga d'esempio ignorata",
  previewDuplicates: (n: number) => (n === 1 ? "1 duplicato (saltato):" : `${n} duplicati (saltati):`),
  previewDuplicateLine: (line: number, name: string, date: string) => `• riga ${line}: ${name} ${date}`,
  previewErrors: (n: number) => (n === 1 ? "⚠️ 1 errore:" : `⚠️ ${n} errori:`),
  previewErrorLine: (line: number, reasons: readonly string[]) => `• riga ${line}: ${reasons.join("; ")}`,
  previewGroups: (names: string) => `Gruppi da creare: ${names}`,
  previewTruncated: (n: number) => `…e altre ${n} righe non mostrate (correggi il file e rimandalo).`,
  previewShort: (n: number, d: number, e: number, groups: string) =>
    `📥 Anteprima in attesa: ${n} nuove, ${d} duplicati, ${e} errori.${groups ? ` Gruppi da creare: ${groups}.` : ""}`,
  previewMoreGroups: (n: number) => `e altri ${n}`,
  btnImport: "Importa",
  imported: (n: number, m: number) =>
    `🎉 Importate ${n} ${n === 1 ? "persona" : "persone"}, ${m === 1 ? "creato 1 gruppo" : `creati ${m} gruppi`}.`,
  becameDuplicates: (k: number) =>
    k === 1 ? "⚠️ 1 riga è diventata un duplicato e l'ho saltata." : `⚠️ ${k} righe sono diventate duplicati e le ho saltate.`,
  nothingImported: "⚠️ Non ho importato nessuno: tutte le righe ora sono duplicati.",

  // /export (RF-25)
  exportCaption: (n: number) => `📤 Ecco l'export: ${n === 1 ? "1 persona" : `${n} persone`}.`,

  // /backup e /ripristina (RF-26, contracts/comandi.md, flussi.md, backup-json.md)
  backupCaption: (n: number, m: number, k: number) =>
    `💾 Backup: ${thousands(n)} persone, ${thousands(m)} gruppi, ${thousands(k)} occorrenze. Per ripristinarlo usa /ripristina.`,
  restoreAsk: "💾 Inviami il file JSON di backup da ripristinare.",
  restoreConfirm1: (date: string, b: Counts, a: Counts) =>
    `⚠️ Backup del ${date}: ${countsText(b)}.\nDati attuali che verranno sostituiti: ${countsText(a)}.`,
  restoreConfirm2:
    "⚠️ Attenzione: l'operazione è irreversibile. Tutti i dati attuali verranno cancellati e sostituiti dal backup. Vuoi procedere?",
  btnContinue: "Continua",
  btnRestore: "Sì, ripristina",
  restoreDone: (c: Counts, customDefault: boolean) =>
    `✅ Ripristino completato: ${countsText(c)}.\nMessaggio di auguri standard: ${customDefault ? "personalizzato" : "quello iniziale"}`,
  backupNotJson: "❌ Il file non è un JSON valido: mandami il file .json del backup.",
  backupWrongFormat: "❌ Il file non è un backup di questo bot.",
  backupVersion: (v: string) => `❌ Versione del backup non supportata (${v}).`,
  backupInvalidField: (entity: string, id: string, field: string) => `❌ Backup non valido: ${entity} ${id}, campo ${field}.`,
  backupDuplicateId: (entity: string, id: string) => `❌ Backup non valido: ${entity} ${id} ${entity.endsWith("a") ? "ripetuta" : "ripetuto"}.`,
  backupInvalidSetting: (field: string) => `❌ Backup non valido: impostazioni, campo ${field}.`,
  backupDuplicateGroupName: "❌ Backup non valido: gruppi con lo stesso nome.",
  backupMissingRef: (entity: string, id: string) => `❌ Backup non valido: riferimento a ${entity} ${id} inesistente.`,
  backupDuplicateOccurrence: (personId: string) => `❌ Backup non valido: occorrenze ripetute per la persona ${personId}.`,

  // US7 — benvenuto e aiuto
  welcome:
    "👋 Ciao! Sono il tuo bot dei compleanni: tengo l'elenco delle persone a cui tieni e ti aiuto a non dimenticare i loro compleanni.",
  btnAddPerson: "Aggiungi persona",
  btnCommands: "Comandi",
  help: [
    "📖 Ecco cosa posso fare:",
    "/nuovo — aggiungi una persona, un campo alla volta",
    "/gruppi [nome] — elenco gruppi a pulsanti; con un nome cerca il gruppo e apre la scheda",
    "/messaggio — modifica il messaggio di auguri",
    "/oggi — compleanni di oggi",
    "/prossimi [giorni] [gruppo] — prossimi compleanni",
    "/cerca <testo> — cerca per nome o nickname",
    "/mese [mese] — compleanni del mese",
    `/scaduti — ultimi ${OUTCOME_CORRECTION_DAYS} giorni non fatti`,
    "/anno [anno] — riepilogo dell'anno",
    // RF-32, RF-31 (§5.1, FR-016 di 007)
    "/statistiche — statistiche della rubrica e andamento",
    "/stato — salute di cron, invii, backup e webhook",
    "/modello — modello CSV per l'import",
    "/export — esporta le persone in CSV",
    "/backup — backup completo in JSON",
    "/ripristina — ripristina da un backup",
    "/annulla — interrompe l'operazione guidata in corso",
    "/id — mostra il tuo ID Telegram",
    "/aiuto — mostra questo elenco",
    "/start — messaggio di benvenuto",
    "/p_<id> — apre la scheda di una persona (tocca il comando dove compare)",
    "",
    "Per importare persone inviami un file CSV.",
  ].join("\n"),
} as const;

// Menu dei comandi di Telegram (FR-014 di 005, research R-10): i comandi di /aiuto senza "/" né
// argomenti; /gruppo resta un alias non elencato. Il cron lo registra con setMyCommands quando cambia.
export const BOT_COMMANDS: readonly BotCommand[] = [
  { command: "nuovo", description: "Aggiungi una persona" },
  { command: "gruppi", description: "Elenco gruppi; con un nome cerca e apre la scheda" },
  { command: "messaggio", description: "Modifica il messaggio di auguri" },
  { command: "oggi", description: "Compleanni di oggi" },
  { command: "prossimi", description: "Prossimi compleanni" },
  { command: "cerca", description: "Cerca per nome o nickname" },
  { command: "mese", description: "Compleanni del mese" },
  { command: "scaduti", description: `Ultimi ${OUTCOME_CORRECTION_DAYS} giorni non fatti` },
  { command: "anno", description: "Riepilogo dell'anno" },
  { command: "statistiche", description: "Statistiche della rubrica e andamento" },
  { command: "stato", description: "Salute di cron, invii, backup e webhook" },
  { command: "modello", description: "Modello CSV per l'import" },
  { command: "export", description: "Esporta le persone in CSV" },
  { command: "backup", description: "Backup completo in JSON" },
  { command: "ripristina", description: "Ripristina da un backup" },
  { command: "annulla", description: "Interrompe l'operazione guidata in corso" },
  { command: "id", description: "Mostra il tuo ID Telegram" },
  { command: "aiuto", description: "Elenco dei comandi" },
  { command: "start", description: "Messaggio di benvenuto" },
];
