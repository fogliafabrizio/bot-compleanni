// Costanti di configurazione (principio VIII, RNF-18): unico punto in cui cambiarle.

export const TIMEZONE = "Europe/Rome";

export const SLOT_HOURS = [9, 13, 18, 21] as const;
export const PRE_REMINDER_HOUR = 13;
export const RECOVERY_HOUR = 13;

export type Priority = "alta" | "media" | "bassa";

export const PRIORITY_PROFILES: Record<Priority, { preReminderDays: readonly number[]; slots: readonly number[] }> = {
  alta: { preReminderDays: [7, 2, 1], slots: [9, 13, 18, 21] },
  media: { preReminderDays: [1], slots: [9, 13, 18] },
  bassa: { preReminderDays: [], slots: [9, 18] },
};

export const DEFAULT_PRIORITY: Priority = "media";

export const PHONE_DEFAULT_PREFIX = "+39";

// A-06: valore iniziale del messaggio di auguri standard (la tabella settings nasce vuota).
export const DEFAULT_BIRTHDAY_MESSAGE = "Tanti auguri {nome}! 🎉";

// Segnaposto del messaggio di auguri, sostituito con nickname o nome completo (RF-15).
export const GREETING_PLACEHOLDER = "{nome}";

export const MIN_BIRTH_YEAR = 1900;

export const TEXT_LIMITS = {
  fullName: 60,
  nickname: 60,
  groupName: 30,
  // FR-035: limite del pulsante nativo di copia (research R-01).
  customMessage: 256,
  // FR-035: ogni {nome} vale quanto il nome o il nickname più lungo.
  greetingNamePlaceholder: 60,
} as const;

// Tetto di invii per esecuzione oraria: il massimo resta 43 subrequest (research R-05).
export const MAX_SENDS_PER_RUN = 40;

// Pausa tra due invii nella stessa chat, limite di Telegram (research R-06).
export const SEND_INTERVAL_MS = 1000;

// A-05, BR-08: un esito si può correggere in "fatto" fino al giorno D+7 compreso.
export const OUTCOME_CORRECTION_DAYS = 7;

// A-04: un flusso guidato senza interazioni scade dopo questo intervallo.
export const CONVERSATION_TTL_HOURS = 24;

export const FLOW_ID_LENGTH = 6;

// FR-005: lunghezza massima di un messaggio Telegram; le liste più lunghe si dividono.
export const MESSAGE_MAX_LENGTH = 4096;

// Research R-05: righe con entità per messaggio (2 entità ciascuna), limite prudenziale.
export const LIST_MAX_LINES_PER_MESSAGE = 45;

// FR-001a, research R-02: tetto della colonna "nome (età)" delle liste, in code point.
export const LIST_NAME_COLUMN_MAX = 20;

// FR-007a, research R-06: messaggi del reminder inviati da /oggi; i restanti vanno in lista.
export const TODAY_MAX_MESSAGES = 10;

// RF-17: giorni di /prossimi senza argomento e massimo ammesso.
export const UPCOMING_DEFAULT_DAYS = 30;
export const UPCOMING_MAX_DAYS = 366;
