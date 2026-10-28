// Tutti i testi rivolti all'utente (RNF-15): si cambiano qui senza toccare la logica.

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

export const T = {
  // Comuni
  actionUnavailable: "Questa azione non è più disponibile",
  personNotFound: "Persona non trovata",
  notUnderstood: "Non ho capito. Scrivi /aiuto per l'elenco dei comandi",
  cancelled: "Operazione annullata",
  nothingToCancel: "Nessuna operazione da annullare",
  genericError: "Si è verificato un errore, riprova",
  btnCancel: "Annulla",
  btnSkip: "Salta",
  btnYes: "Sì",
  btnFix: "Correggi",
  btnDone: "Fine",
  btnClear: "Svuota",

  // US1 — /id
  yourId: (id: number) => `Il tuo ID Telegram è ${id}`,

  // US2 — inserimento guidato
  askFullName: "Nome completo?",
  askNickname: "Nickname? (come lo chiami nei messaggi)",
  askBirthDate: "Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno",
  confirmDate: (s: string) => `${s}, giusto?`,
  invalidDate: "Data non valida. Usa il formato gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994)",
  askPhone: "Telefono? (con prefisso, es. +39 333 1234567)",
  invalidPhone: "Numero non valido. Scrivilo con il prefisso, es. +39 333 1234567",
  askInstagram: "Username Instagram?",
  askTelegram: "Username Telegram?",
  askGroups: "Gruppi?",
  btnNewGroup: "➕ Nuovo gruppo",
  askNewGroupName: "Nome del nuovo gruppo?",
  groupExists: "Esiste già un gruppo con questo nome",
  askPriority: "Priorità?",
  btnHigh: "Alta",
  btnMedium: "Media",
  btnLow: "Bassa",
  selected: (label: string) => `${label} ✓`,
  groupToggle: (name: string, on: boolean) => `${on ? "☑" : "☐"} ${name}`,
  askMessage: "Messaggio di auguri personalizzato? Se salti uso quello standard.",
  summaryTitle: "Riepilogo:",
  btnSave: "Salva",
  btnSaveAnyway: "Salva comunque",
  possibleDuplicate: (name: string, date: string) =>
    `Esiste già una persona di nome ${name} con data ${date}: possibile duplicato. Vuoi salvare comunque?`,
  tooLong: (max: number) => `Testo troppo lungo: massimo ${max} caratteri`,
  emptyValue: "Il valore non può essere vuoto",

  // Scheda (AFU §5.6)
  schedaNickname: (name: string, nickname: string) => `${name} — "${nickname}"`,
  schedaAge: (age: number, days: number) =>
    days === 0 ? `compie ${age} anni oggi` : days === 1 ? `compie ${age} anni domani` : `compie ${age} anni tra ${days} giorni`,
  schedaNoAge: (days: number) =>
    days === 0 ? "compleanno oggi" : days === 1 ? "compleanno domani" : `compleanno tra ${days} giorni`,
  schedaPriority: (p: string) => `Priorità: ${p}`,
  schedaGroups: (names: string) => `Gruppi: ${names}`,
  schedaPhone: (phone: string) => `📱 ${phone}`,
  schedaInstagram: (u: string) => `IG @${u}`,
  schedaTelegram: (u: string) => `TG @${u}`,
  schedaMessageStandard: "Messaggio: standard",
  schedaMessageCustom: (m: string) => `Messaggio: "${m}"`,
  schedaHistory: (items: string) => `Storico: ${items}`,
  outcome: { fatto: "fatto", saltato: "saltato", non_confermato: "non confermato" },
  btnEdit: "Modifica",
  btnDelete: "Elimina",

  // US4 — modifica
  editWhichField: "Quale campo vuoi modificare?",
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
    n: "Nuovo nome completo?",
    k: "Nuovo nickname?",
    d: "Nuova data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno",
    p: "Nuovo telefono? (con prefisso, es. +39 333 1234567)",
    i: "Nuovo username Instagram?",
    t: "Nuovo username Telegram?",
    m: "Nuovo messaggio di auguri personalizzato?",
  },

  // US5 — eliminazione
  confirmDeletePerson: (name: string) => `Eliminare ${name}? Perderai anche lo storico`,
  personDeleted: "Persona eliminata",

  // US6 — gruppi
  groupsTitle: "Gruppi:",
  groupLine: (name: string, n: number) => `• ${name} (${n})`,
  noGroups: "Non hai ancora nessun gruppo.",
  btnRename: "✏️ Rinomina",
  btnDeleteGroup: "🗑 Elimina",
  askGroupToRename: "Quale gruppo vuoi rinominare?",
  askGroupToDelete: "Quale gruppo vuoi eliminare?",
  askRenameTo: (name: string) => `Nuovo nome per il gruppo ${name}?`,
  confirmDeleteGroup: (name: string, n: number) =>
    `Eliminare il gruppo ${name}? ` +
    (n === 0
      ? "Nessuna persona ha questa etichetta"
      : n === 1
        ? "1 persona perderà questa etichetta"
        : `${n} persone perderanno questa etichetta`),
  groupCreated: (name: string) => `Gruppo ${name} creato`,
  groupRenamed: (name: string) => `Gruppo rinominato in ${name}`,
  groupDeleted: (name: string) => `Gruppo ${name} eliminato`,

  // Promemoria (AFU §5.3–§5.5, contracts/promemoria.md)
  reminderTitle: (name: string, fullName: string | null, age: number | null, leap29: boolean) =>
    `🎂 Oggi è il compleanno di ${name}${fullName ? ` (${fullName})` : ""}` +
    `${age !== null ? `, compie ${age} anni` : ""}${leap29 ? " (compleanno il 29/02)" : ""}`,
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

  // /messaggio (contracts/messaggio.md)
  greetingAsk: (current: string) =>
    `Messaggio attuale: «${current}»\nScrivi il nuovo messaggio di auguri. Usa {nome} per il nome.`,
  greetingPreview: (text: string) => `Anteprima: «${text}»\nConfermi?`,
  greetingSaved: "Messaggio di auguri aggiornato",
  greetingTooLong: (max: number, perName: number) =>
    `Il messaggio può avere al massimo ${max} caratteri (ogni {nome} conta ${perName}).`,
  sampleName: "Marco",
  btnConfirm: "Conferma",

  // US7 — benvenuto e aiuto
  welcome:
    "Ciao! Sono il tuo bot dei compleanni: tengo l'elenco delle persone a cui tieni e ti aiuto a non dimenticare i loro compleanni.",
  btnAddPerson: "Aggiungi persona",
  btnCommands: "Comandi",
  help: [
    "Comandi disponibili:",
    "/nuovo — aggiungi una persona, un campo alla volta",
    "/gruppi — elenca, crea, rinomina ed elimina i gruppi",
    "/messaggio — modifica il messaggio di auguri",
    "/annulla — interrompe l'operazione guidata in corso",
    "/id — mostra il tuo ID Telegram",
    "/aiuto — mostra questo elenco",
    "/start — messaggio di benvenuto",
    "/p_<id> — apre la scheda di una persona (tocca il comando dove compare)",
  ].join("\n"),
} as const;
