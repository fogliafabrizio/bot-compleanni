import { env } from "cloudflare:test";
import { runHourly, type RunReport } from "../../src/cron/hourly";
import { runScheduled } from "../../src/cron/scheduled";
import { addHours, floorToHour, localDayStartUtc, toLocal } from "../../src/time";
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

// regular (default): il cron ha girato anche nelle ore saltate dal test, come in produzione. Si
// registra l'ora precedente in cron_last_run (direttamente su D1, fuori dal conteggio delle
// subrequest) così non scatta l'avviso di buco (N-06 di 007). false: i test di N-06 controllano
// da sé l'ora registrata.
export interface RunOptions {
  regular?: boolean;
}

export async function simulateRegularCron(at: Date, opts: RunOptions = {}): Promise<void> {
  if (opts.regular === false) return;
  const previous = addHours(floorToHour(at), -1).toISOString();
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE excluded.value > settings.value`,
  )
    .bind(previous, previous)
    .run();
}

// Esegue il ciclo orario come il Cron Trigger dell'ora locale indicata.
export async function runAt(deps: TestCronDeps, y: number, m: number, d: number, hour: number, opts: RunOptions = {}): Promise<RunReport> {
  const at = localInstant(y, m, d, hour);
  deps.setNow(at);
  await simulateRegularCron(at, opts);
  return runHourly(deps, at);
}

// Esegue l'handler scheduled completo (ciclo orario + backup mensile) dell'ora locale indicata.
export async function runScheduledAt(deps: TestCronDeps, y: number, m: number, d: number, hour: number, opts: RunOptions = {}): Promise<void> {
  const at = localInstant(y, m, d, hour);
  deps.setNow(at);
  await simulateRegularCron(at, opts);
  return runScheduled(deps, at);
}
