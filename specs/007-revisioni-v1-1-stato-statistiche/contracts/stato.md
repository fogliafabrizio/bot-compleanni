# Contratto: `/stato` (RF-31)

Fonti: spec FR-009…FR-012, AFU §5.10; research R-04, R-07, R-09.

## Ingresso

`/stato` (anche `/stato@bot`, argomenti ignorati) dal proprietario. Altri mittenti: nessuna
risposta (001 FR-027). Durante un flusso guidato: il flusso si interrompe e il comando esegue
(001 FR-018).

## Esecuzione

```text
[d1, wh] = await Promise.allSettled([
  db.batch(statoReadStatements(db, { today, from: today − 6, hourStartIso })),   // 1 subrequest D1
  tg.getWebhookInfo(),                                                // 1 subrequest Telegram
])
d1 rejected → l'errore si propaga come per ogni comando (gestione esistente del router)
wh rejected → riga webhook "non disponibile", log("webhook_info_error", { error_code })
sendLines(ctx, formatStato(...))                                      // di norma 1 subrequest
```

Batch `statoReadStatements` (`src/db/stato.ts`):

| # | Query | Risultato |
|---|---|---|
| 0 | `SELECT key, value FROM settings WHERE key IN ('cron_last_run','auto_backup_last')` | 0–2 righe |
| 1 | aggregato `deliveries` con `local_date BETWEEN from AND today`, `GROUP BY is_today, bucket` | ≤ 6 righe |
| 2 | dettaglio abbandonati della finestra con `persons.nickname, persons.full_name, kind, ref, local_date`, `ORDER BY local_date, d.id` | n righe |

`bucket` ∈ `inviato`, `fallito`, `abbandonato` secondo la tabella di [data-model.md](../data-model.md);
gli `in_invio` correnti (`sent_at >= hourStartIso`, ora piena di `now`) sono esclusi nella `WHERE`.
Persona eliminata → righe sparite per cascata.

La riga degli ultimi 7 giorni riporta sempre i tre conteggi, come la riga di oggi (RF-31, FR-009,
AFU §5.10, mockup corretto il 29/10/2026).

## Uscita (layout AFU §5.10)

```text
🩺 Stato del bot
⏱ Ultimo controllo orario: <oggi alle H:MM | GG/MM alle H:MM | mai registrato>
📨 Oggi: <i> inviati, <f> falliti, <a> abbandonati
📨 Ultimi 7 giorni: <i> inviati, <f> falliti, <a> abbandonati
   – <nickname|nome>, <tipo e riferimento> del GG/MM        (una riga per abbandonato, nessuna se 0)
💾 Ultimo backup mensile: <GG/MM alle H:MM ✅ | GG/MM alle H:MM ❌ non riuscito | GG/MM alle H:MM ⚠️ esito sconosciuto | mai registrato>
🔗 Webhook: <nessun errore | ultimo errore GG/MM alle H:MM: "<testo>">, <n> update in coda
🔗 Webhook: non disponibile                                  (se getWebhookInfo fallisce)
```

- Tipo e riferimento: `pre-reminder a <n> giorni`, `reminder delle <H>:00`, `recupero`; formule
  esatte in `src/texts.ts` (principio VIII), coerenti con i testi dei promemoria di 002.
- Singolare/plurale nei conteggi ("1 abbandonato") come nel mockup.
- Orari in Europe/Rome via `toLocalClock` (`src/time.ts`); "oggi" confrontando la data locale.
- `last_error_date` di Telegram è in secondi Unix → `new Date(s × 1000)`.

## Errori e privacy

- `getWebhookInfo`: ogni errore (`TelegramError`, rete, risposta non valida) → solo la riga del
  webhook cambia (FR-012).
- Log ammessi: `webhook_info_error` con `error_code`. Mai nomi, testi di errore, conteggi per persona.

## Budget

D1: 1 (+ quelle del router già presenti). Telegram: 1 `getWebhookInfo` + ≥ 1 `sendMessage`.
CPU: < 1 ms con 200 persone (bench `bench/stato.bench.ts`).
