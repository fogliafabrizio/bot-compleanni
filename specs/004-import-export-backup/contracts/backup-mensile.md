# Contratto — Backup automatico mensile nel cron

Riferimenti: RF-27, A-03, RNF-11; FR-022, FR-023, FR-023a della spec; principio II (un solo Cron
Trigger), VII (idempotenza garantita dal database). Codice: `src/cron/backup-mensile.ts`,
statement in `src/db/settings.ts`.

## Aggancio all'handler esistente

```text
scheduled(controller, env)
  ├─ runHourly(deps, scheduledAt)          // invariato (002)
  └─ runMonthlyBackup(deps, scheduledAt)   // nuovo, dopo; proprio try/catch
```

`wrangler.jsonc` invariato (`"crons": ["0 * * * *"]`).

## Algoritmo

```text
L = toLocal(scheduledAt); mese = AAAA-MM di L
se L.day == AUTO_BACKUP_DAY e L.hour < AUTO_BACKUP_HOUR: fine (0 subrequest)
reclamo (1 query):
  INSERT INTO settings (key, value, updated_at) VALUES ('auto_backup', mese || ':in_invio', now)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    WHERE settings.value NOT IN (mese || ':in_invio', mese || ':inviato')
  RETURNING value
nessuna riga restituita: fine
lettura del backup (1 batch) → sendDocument al proprietario (stesso file e caption di /backup)
esito (1 query): mese || ':inviato'  oppure  mese || ':fallito' su TelegramError
```

`AUTO_BACKUP_DAY = 1`, `AUTO_BACKUP_HOUR = 9` in `config.ts`. Il backup è "dovuto" dal 1° alle
9:00 locali fino a fine mese, finché non risulta `inviato`.

## Garanzie e casi

| Caso | Comportamento |
|---|---|
| 1° del mese, 9:00, Telegram ok | un invio; `AAAA-MM:inviato` |
| esecuzione delle 9:00 ripetuta | il reclamo non restituisce righe: nessun secondo invio (FR-023) |
| errore Telegram alle 9:00 del 1°, ok il 2 alle 14:00 | `fallito` → reclamato e inviato alle 14:00 del 2, una volta (FR-023a) |
| esecuzione delle 9:00 non avvenuta | inviato alla prima esecuzione oraria successiva del mese |
| guasto D1 sul reclamo | nessun invio; riprova all'ora successiva |
| guasto dopo il reclamo, prima dell'esito | resta `in_invio`: nessun nuovo invio nel mese (al massimo una volta) |
| primo deploy a metà mese | inviato alla prima esecuzione oraria (approvato 2026-10-29, research R-11) |
| ripristino di un backup | `auto_backup` non toccata |
| 0 persone | file comunque inviato |

## Log (principio V)

`log("auto_backup", { sent: boolean, error_code?: number })` — solo esito e codice, nessun
dato personale.

## Budget

Con backup dovuto: ≤ 43 (runHourly) + 3 D1 + 1 Telegram = **≤ 47** subrequest; altrimenti
≤ 44. Verificato con il contatore di `ciclo-budget.test.ts` (research R-12).
