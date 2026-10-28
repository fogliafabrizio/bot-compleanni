# Quickstart — 002 Promemoria ed esiti

Guida di validazione. Prerequisiti, installazione e secret come nel
[quickstart 001](../001-fondamenta-anagrafica/quickstart.md).

## 1. Gate automatici

```powershell
npm run typecheck          # strict, nessun errore
npm test                   # pool workers: unit + integrazione
npx vitest bench --config vitest.bench.config.ts   # CPU delle parti pure del ciclo (Node)
```

Esito atteso: tutti i test verdi; il benchmark "ciclo 13:00, 200 persone, 40 invii" sotto 3 ms
per iterazione (research R-09).

## 2. Scenari coperti dai test di integrazione

| File | Scenari | ID |
|---|---|---|
| `test/integration/us1-reminder.test.ts` | slot per priorità, un messaggio per persona, contenuto §5.3, pulsanti presenti/assenti, Fatto e Salta con aggiornamento del solo messaggio premuto | RF-10, RF-11, RF-12, BR-07, §7 |
| `test/integration/us2-recupero.test.ts` | recupero unico alle 13 di D+1, *non confermato* a fine D+1, correzione entro/oltre D+7, BR-11 nei tre casi | RF-13, BR-08, BR-11, N-04 |
| `test/integration/us3-pre-reminder.test.ts` | −7/−2/−1 per profilo, Salta dal pre-reminder, cavallo d'anno | RF-09, BR-05 |
| `test/integration/us4-messaggio.test.ts` | `/messaggio` con anteprima e conferma, limite 256 con `{nome}` = 60, personalizzato vs default | RF-15, FR-035 |
| `test/integration/us5-storico.test.ts` | riga "Storico" della scheda, "L'anno scorso" | RF-03, RF-14, BR-09 |
| `test/integration/us6-modifiche.test.ts` | inserimento alle 10:30, cambio priorità, cambio data | BR-10, BR-12, BR-13 |
| `test/integration/ciclo-idempotenza.test.ts` | stessa ora eseguita due volte; esecuzioni sovrapposte | N-02, SC-002 |
| `test/integration/ciclo-retry.test.ts` | errore Telegram → retry orario → abbandono; slot perso non recuperato; errore su una persona | N-03, N-04, RNF-12 |
| `test/integration/ciclo-budget.test.ts` | scenari della tabella R-09 con subrequest esatte e ≤ 50; tetto e coda | RNF-17, principio II |
| `test/unit/schedule.test.ts`, `test/unit/time.test.ts` | 29/02, cambio d'ora di marzo e ottobre, `localDayStartUtc` | BR-04, BR-24 |

## 3. Prova manuale in locale

```powershell
npx wrangler d1 migrations apply birthday-bot-db --local
npx wrangler dev --test-scheduled
```

1. Dal bot (webhook di sviluppo come in 001) inserisci una persona con compleanno **oggi**,
   priorità Alta, telefono e Instagram.
2. Simula lo slot: l'ora del cron si ricava da `scheduledTime`, quindi passa l'istante UTC
   corrispondente all'ora locale voluta (es. 13:00 Europe/Rome in ora legale = 11:00 UTC):
   `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*&time=<epoch ms delle 11:00 UTC di oggi>"`.
3. Atteso: un reminder §5.3 con WhatsApp, Instagram, Copia messaggio, Fatto ✅, Salta quest'anno;
   niente Telegram.
4. Ripeti la stessa chiamata: nessun nuovo messaggio (N-02).
5. Premi **Copia messaggio**: il testo di auguri va negli appunti, senza età.
6. Premi **Fatto ✅**: il messaggio mostra "✅ Fatto" e mantiene i soli contatti; una chiamata per
   le 18:00 locali non invia nulla.
7. `/messaggio` → nuovo testo con `{nome}` → anteprima → Conferma; il reminder successivo usa il
   nuovo testo nel link WhatsApp.

## 4. Verifica dopo il deploy

1. `./scripts/deploy.ps1` (applica anche la migration `0002`).
2. Dopo almeno 24 ore: dashboard Cloudflare → Workers → `bot-compleanni` → **Metrics**: CPU time
   delle invocazioni *Cron* con p99 < 7 ms e nessun errore `exceededCpu`. Oltre 7 ms: abbassare
   `MAX_SENDS_PER_RUN` in `src/config.ts`.
3. `npx wrangler tail --format pretty` durante un'ora con invii: righe `cron_run` con soli
   numeri (nessun dato personale, principio V).
