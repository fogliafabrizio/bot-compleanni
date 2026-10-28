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

export const MIN_BIRTH_YEAR = 1900;

export const TEXT_LIMITS = {
  fullName: 60,
  nickname: 60,
  groupName: 30,
  customMessage: 500,
} as const;

// A-04: un flusso guidato senza interazioni scade dopo questo intervallo.
export const CONVERSATION_TTL_HOURS = 24;

export const FLOW_ID_LENGTH = 6;
