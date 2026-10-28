import { buildReminderData, renderByKind } from "../bot/promemoria";
import { MAX_SENDS_PER_RUN, SEND_INTERVAL_MS } from "../config";
import {
  claimStatements,
  readStatements,
  resultStatements,
  type CandidateRow,
  type ClaimedRow,
  type OccurrenceRow,
  type RetryRow,
  type SendResult,
} from "../db/reminders";
import type { CronDeps } from "../deps";
import { planTargets, selectNew, splitByCap, type Kind } from "../domain/schedule";
import { log } from "../log";
import { TelegramError } from "../telegram/client";
import { addDays, floorToHour, localDayStartUtc, toDateString, toIso, toLocal, type LocalDate } from "../time";

// Ciclo orario (contracts/ciclo-orario.md): lettura → selezione → reclamo → invio → esito.
// Tre chiamate D1 fisse più al massimo MAX_SENDS_PER_RUN invii (principio II, research R-07).

export interface RunReport {
  hour: number;
  claimed: number;
  queued: number;
  sent: number;
  failed: number;
  closed: number;
  abandoned: number;
}

const KIND_ORDER: Record<Kind, number> = { giorno: 0, recupero: 1, pre: 2 };

const changes = (r: D1Result | undefined) => r?.meta.changes ?? 0;

export async function runHourly(deps: CronDeps, scheduledAt: Date): Promise<RunReport> {
  // R-02: l'ora dell'esecuzione viene da scheduledTime, i timestamp scritti da now().
  const local = toLocal(scheduledAt);
  const T: LocalDate = { year: local.year, month: local.month, day: local.day };
  const report: RunReport = { hour: local.hour, claimed: 0, queued: 0, sent: 0, failed: 0, closed: 0, abandoned: 0 };
  const { db } = deps;

  try {
    const today = toDateString(T);
    const targets = planTargets(T, local.hour);
    const pairs = targets.flatMap((t) => t.pairs);

    // 1. Lettura.
    const [defRes, candRes, occRes, retryRes] = await db.batch(
      readStatements(db, { pairs, years: [T.year - 1, T.year + 1], today }),
    );
    const defaultMessage = (defRes?.results[0] as { value: string } | undefined)?.value ?? null;
    const candidates = (candRes?.results ?? []) as CandidateRow[];
    const occurrences = (occRes?.results ?? []) as OccurrenceRow[];
    const retries = ((retryRes?.results ?? []) as RetryRow[]).filter((r) => r.occ_status === "aperta");

    // 2. Selezione (pura).
    const fresh = selectNew(
      candidates.map((c) => ({ id: c.id, priority: c.priority, birthDay: c.birth_day, birthMonth: c.birth_month, createdAt: c.created_at })),
      occurrences.map((o) => ({ personId: o.person_id, year: o.year, status: o.status, hasDaySend: o.has_day_send === 1 })),
      targets,
      {
        slotInstantIso: toIso(floorToHour(scheduledAt)),
        dayStartPrevIso: toIso(localDayStartUtc(addDays(T, -1))),
        dayStartTodayIso: toIso(localDayStartUtc(T)),
      },
    );
    const { claim, queue, retryClaim } = splitByCap(fresh, MAX_SENDS_PER_RUN, retries);

    const known = new Set(occurrences.map((o) => `${o.person_id}:${o.year}`));
    const newOccurrences = new Map<string, { personId: number; year: number; effectiveDate: string }>();
    for (const s of [...claim, ...queue]) {
      const key = `${s.personId}:${s.year}`;
      if (!known.has(key)) newOccurrences.set(key, { personId: s.personId, year: s.year, effectiveDate: s.effectiveDate });
    }

    // 3. Reclamo: solo le righe restituite in in_invio vengono inviate (N-02).
    const nowIso = toIso(deps.now());
    const { statements, index } = claimStatements(db, {
      today,
      minOpenDate: toDateString(addDays(T, -2)),
      nowIso,
      newOccurrences: [...newOccurrences.values()],
      claims: claim,
      queued: queue,
      retryIds: retryClaim.map((r) => r.id),
    });
    const claimRes = await db.batch(statements);
    report.closed = changes(claimRes[index.closed]);
    report.abandoned = index.abandoned.reduce((n, i) => n + changes(claimRes[i]), 0);
    report.queued = index.queued.reduce((n, i) => n + changes(claimRes[i]), 0);
    const rowsOf = (ids: number[]) => ids.flatMap((i) => (claimRes[i]?.results ?? []) as ClaimedRow[]);
    const fresher = rowsOf(index.claimed).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.person_id - b.person_id);
    const toSend = [...fresher, ...rowsOf(index.retried)].filter((r) => r.status === "in_invio");
    report.claimed = toSend.length;

    // 4. Invio, in sequenza con una pausa (R-06); un errore riguarda solo quell'invio (RNF-12).
    const byPerson = new Map(candidates.map((c) => [c.id, c]));
    const statusOf = new Map(occurrences.map((o) => [`${o.person_id}:${o.year}`, o.status]));
    const results: SendResult[] = [];
    for (const [i, row] of toSend.entries()) {
      if (i > 0) await deps.sleep(SEND_INTERVAL_MS);
      try {
        const person = byPerson.get(row.person_id);
        if (!person) throw new Error("person_missing");
        const data = buildReminderData(person, {
          actionTarget: { scope: "o", id: row.id },
          year: row.year,
          lastYear: statusOf.get(`${row.person_id}:${row.year - 1}`) ?? null,
          defaultMessage,
        });
        const { text, keyboard } = renderByKind(row.kind, row.ref, data);
        const msg = await deps.tg.sendMessage(Number(deps.ownerId), text, keyboard);
        results.push({ id: row.id, ok: true, messageId: msg.message_id, sentAt: toIso(deps.now()) });
        report.sent++;
      } catch (err) {
        results.push({ id: row.id, ok: false, code: err instanceof TelegramError ? err.errorCode : 0 });
        report.failed++;
      }
    }

    // 5. Esito.
    if (results.length > 0) await db.batch(resultStatements(db, results));
  } catch {
    // Guasto D1: gli invii non reclamati non partono (N-04), gli in_invio non si ripetono (N-02).
    log("cron_error", { hour: report.hour });
    return report;
  }

  log("cron_run", { ...report });
  return report;
}
