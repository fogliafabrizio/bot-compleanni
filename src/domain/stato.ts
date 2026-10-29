import type { ListLine } from "../bot/liste";
import { GAP_ALERT_THRESHOLD_HOURS } from "../config";
import type { WebhookStatus } from "../telegram/client";
import { T, type DeliveryCounts } from "../texts";
import { toLocalClock, type LocalDate } from "../time";
import type { Kind } from "./schedule";

// Stato del bot (RF-31) e avviso di buco del cron (N-06). Puro: nessun import di cloudflare:* o
// di src/db, così il benchmark gira in Node.

const HOUR_MS = 3_600_000;

// N-06, FR-005, research R-03 di 007: buco se tra l'ultima ora piena registrata e quella corrente
// passano più di GAP_ALERT_THRESHOLD_HOURS ore reali. Millisecondi reali: il cambio d'ora non
// genera avvisi. Nessuna ora registrata o valore non valido → nessun avviso (FR-020).
export function detectGap(lastIso: string | null, currentIso: string): { from: Date; to: Date } | null {
  if (lastIso === null) return null;
  const last = Date.parse(lastIso);
  const current = Date.parse(currentIso);
  if (Number.isNaN(last) || Number.isNaN(current)) return null;
  if (current - last <= GAP_ALERT_THRESHOLD_HOURS * HOUR_MS) return null;
  return { from: new Date(last), to: new Date(current) };
}

// Valore della chiave tecnica auto_backup_last (data-model.md di 007).
export type AutoBackupEsito = "in_invio" | "riuscito" | "non_riuscito";

export interface AutoBackupLast {
  at: string;
  esito: AutoBackupEsito;
}

const ESITI: readonly AutoBackupEsito[] = ["in_invio", "riuscito", "non_riuscito"];

// JSON non valido, istante non valido o esito sconosciuto → null ("mai registrato", FR-011).
export function parseAutoBackupLast(value: string | null): AutoBackupLast | null {
  if (value === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(value);
  } catch {
    return null;
  }
  const { at, esito } = (v ?? {}) as { at?: unknown; esito?: unknown };
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  if (!ESITI.includes(esito as AutoBackupEsito)) return null;
  return { at, esito: esito as AutoBackupEsito };
}

export interface AbbandonatoRow {
  // Nickname o nome completo.
  name: string;
  kind: Kind;
  ref: number;
  // AAAA-MM-GG
  localDate: string;
}

export interface StatoData {
  cronLastRun: string | null;
  autoBackupLast: AutoBackupLast | null;
  today: DeliveryCounts;
  week: DeliveryCounts;
  abbandonati: readonly AbbandonatoRow[];
  webhook: WebhookStatus | "non_disponibile";
}

const line = (text: string): ListLine => ({ text, entities: [] });

const parseDate = (s: string): LocalDate => {
  const [year = 0, month = 0, day = 0] = s.split("-").map(Number);
  return { year, month, day };
};

// RF-31, FR-009, FR-011, FR-012: righe di /stato nell'ordine di AFU §5.10; orari in Europe/Rome,
// "oggi" = stessa data locale di now.
export function formatStato(data: StatoData, now: Date): ListLine[] {
  const today = toLocalClock(now);
  const cron = data.cronLastRun !== null && !Number.isNaN(Date.parse(data.cronLastRun)) ? new Date(data.cronLastRun) : null;
  const backup = data.autoBackupLast;
  const wh = data.webhook;
  return [
    line(T.statoTitle),
    line(T.statoCron(cron ? T.statoWhen(toLocalClock(cron), today) : T.neverRecorded)),
    line(T.statoToday(data.today)),
    line(T.statoWeek(data.week)),
    ...data.abbandonati.map((a) => line(T.statoAbandoned(a.name, T.statoKind(a.kind, a.ref), parseDate(a.localDate)))),
    line(
      T.statoBackup(
        backup ? `${T.statoAt(toLocalClock(new Date(backup.at)))} ${T.statoBackupEsito[backup.esito]}` : T.neverRecorded,
      ),
    ),
    line(
      wh === "non_disponibile"
        ? T.statoWebhookUnavailable
        : wh.lastErrorDate !== undefined
          ? T.statoWebhookError(T.statoAt(toLocalClock(wh.lastErrorDate)), wh.lastErrorMessage ?? "", wh.pendingUpdateCount)
          : T.statoWebhookOk(wh.pendingUpdateCount),
    ),
  ];
}
