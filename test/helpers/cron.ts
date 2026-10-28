import { runHourly, type RunReport } from "../../src/cron/hourly";
import { runScheduled } from "../../src/cron/scheduled";
import { addHours, localDayStartUtc, toLocal } from "../../src/time";
import type { TestCronDeps } from "./deps";

// Istante UTC dell'ora locale Europe/Rome indicata: mezzanotte locale + ore, corretto di ±1 h
// nei giorni del cambio d'ora.
export function localInstant(y: number, m: number, d: number, hour: number): Date {
  const start = localDayStartUtc({ year: y, month: m, day: d });
  for (const h of [hour, hour - 1, hour + 1]) {
    const candidate = addHours(start, h);
    const local = toLocal(candidate);
    if (local.hour === hour && local.day === d) return candidate;
  }
  throw new Error(`ora locale inesistente: ${y}-${m}-${d} ${hour}`);
}

// Esegue il ciclo orario come il Cron Trigger dell'ora locale indicata.
export function runAt(deps: TestCronDeps, y: number, m: number, d: number, hour: number): Promise<RunReport> {
  const at = localInstant(y, m, d, hour);
  deps.setNow(at);
  return runHourly(deps, at);
}

// Esegue l'handler scheduled completo (ciclo orario + backup mensile) dell'ora locale indicata.
export function runScheduledAt(deps: TestCronDeps, y: number, m: number, d: number, hour: number): Promise<void> {
  const at = localInstant(y, m, d, hour);
  deps.setNow(at);
  return runScheduled(deps, at);
}
