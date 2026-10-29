# Contratto: ciclo orario e backup mensile v1.1 (N-06, RF-31)

Modifica [ciclo-orario.md di 002](../../002-promemoria-esiti/contracts/ciclo-orario.md) e
[backup-mensile.md di 004](../../004-import-export-backup/contracts/backup-mensile.md). Fonti:
spec FR-004…FR-008, AFU §5.12; research R-02…R-05, R-11.

## `runHourly` (`src/cron/hourly.ts`)

```text
current = toIso(floorToHour(scheduledAt))
1. Lettura (1 batch, 1 subrequest):
   [lastRun, upsertRun, default, candidati, occorrenze, retry] =
     db.batch([selectCronLastRun, upsertCronLastRun(current, nowIso), ...readStatements esistenti])
1b. Buco (N-06):
   gap = detectGap(lastRun?.value ?? null, current)
   se gap: try sendMessage(owner, T.gapAlert(gap.from, gap.to, T))   // +1 subrequest, fuori dal tetto
           catch → log("gap_alert", { sent: false, error_code })     // nessun retry, nessuna scrittura
2. Selezione            (invariata)
3. Reclamo              (insert in_invio e retry scrivono sent_at = nowIso)
4. Invio                (invariato)
5. Esito                (errore → sent_at = NULL)
```

- `detectGap(last, current)`: `null` se `last` assente/non valido o `current − last ≤ 2 h`;
  altrimenti `{ from: last, to: current }`.
- `RunReport` acquisisce `gapAlert: "none" | "sent" | "failed"` (solo per log e test; la regola del
  menu in `scheduled.ts` non cambia).
- Guasto della batch di lettura: nulla registrato, nessun avviso, `cron_error` come oggi.

### Avviso (AFU §5.12)

```text
⚠️ Il controllo orario non è girato dalle <H>:00 alle <H>:00 di oggi:
alcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.
```

Giorni diversi: `dalle <H>:00 del GG/MM alle <H>:00 del GG/MM`. Ore in Europe/Rome.

### Casi (tutti con test)

| Ultima registrata | Corrente | Avviso |
|---|---|---|
| assente | 14:00 | no, registra 14:00 |
| 14:00 | 15:00 | no |
| 14:00 | 16:00 | no (esattamente 2 h) |
| 14:00 | 17:00 | sì |
| 14:00 | 19:00 | sì, "dalle 14:00 alle 19:00 di oggi" |
| 19:00 (dopo avviso) | 20:00 | no |
| 19:00 | 19:00 (riesecuzione) | no |
| 20:00 | 19:00 (esecuzione tardiva) | no, valore resta 20:00 |
| 23:00 del 28/10 | 3:00 del 29/10 | sì, con le date |
| 1:00 (passaggio a ora legale) | 3:00 locali | no (1 h reale) |
| 2:00 CEST | 2:00 CET (ritorno all'ora solare) | no (1 h reale) |

## `runMonthlyBackup` (`src/cron/backup-mensile.ts`)

```text
attempt = claimAutoBackup(db, month, nowIso)      // batch [reclamo, auto_backup_last=in_invio] — 1 subrequest
attempt null → null
try sendBackup(deps, owner)                       // 1 D1 + 1 Telegram (invariato)
  ok              → setAutoBackupResult(month, "inviato", attempt.at, "riuscito")
  TelegramError   → setAutoBackupResult(month, "fallito", attempt.at, "non_riuscito")   // ritentato
  altro errore    → setAutoBackupResult(month, "errore",  attempt.at, "non_riuscito")   // non ritentato
                    log("auto_backup", { sent: false, error_code: 0 })
```

`setAutoBackupResult` = batch [stato di `auto_backup`, `auto_backup_last`] — 1 subrequest.
`claimAutoBackup` non riprende `:in_invio`, `:inviato`, `:errore`.

## Budget del Cron Trigger (caso peggiore)

3 D1 + 40 promemoria + 1 avviso + 3 D1 + 1 backup = **48 ≤ 50**. Dettaglio in research R-11.
