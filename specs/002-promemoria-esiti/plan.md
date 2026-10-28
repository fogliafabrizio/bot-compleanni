# Implementation Plan: Promemoria ed esiti

**Branch**: `002-promemoria-esiti` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-promemoria-esiti/spec.md`

## Summary

Riempie l'handler `scheduled` del Cron Trigger orario: a ogni esecuzione il Worker ricava l'ora
locale Europe/Rome da `scheduledTime` e invia **solo** ciò che è pianificato per quell'ora
(pre-reminder, reminder del giorno, recupero, secondo i profili di AFU §7), chiude a
*non confermato* le occorrenze scadute e ritenta nella stessa giornata gli invii falliti.
Aggiunge i pulsanti di contatto (WhatsApp, Instagram, Telegram, Copia messaggio nativo), gli
esiti Fatto/Salta con correzione BR-08, `/messaggio` e il limite di 256 caratteri per i messaggi
di auguri.

Approccio: architettura e stack della feature 001 invariati (Worker TypeScript strict, D1, client
Bot API su `fetch`, dipendenze e `now` iniettati). Selezione per **ora esatta** (N-01, N-04,
BR-10 in un solo criterio); idempotenza garantita dall'indice unico già presente
`deliveries(occurrence_id, kind, ref)` con reclamo `INSERT OR IGNORE … RETURNING` prima
dell'invio; **3 chiamate D1 fisse** per esecuzione (lettura, reclamo, esito) e un **tetto di 40
invii**: il massimo assoluto è 43 subrequest. Dettagli e alternative in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`). Nessuna nuova dipendenza: il benchmark CPU usa
`vitest bench` già installato

**Storage**: D1 `birthday-bot-db`; tabelle `occurrences`, `deliveries`, `settings` già create dalla
migration 0001; nuova migration `0002_indice_retry.sql` con un solo indice
([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers, D1 locale, fake Telegram con errori simulabili, `now` e
`scheduledAt` iniettati, `sleep` no-op; benchmark CPU in ambiente Node per le sole funzioni pure

**Target Platform**: Cloudflare Workers Free; Cron `0 * * * *` (UTC) invariato; webhook invariato

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: invii entro pochi secondi dall'ora piena; pausa di 1 s tra invii nella
stessa chat (limite Telegram)

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); D1: un `batch` =
una query, ≤ 100 parametri per statement; 6 connessioni simultanee; `copy_text` ≤ 256 caratteri;
`callback_data` ≤ 64 byte

**Scale/Scope**: ~200 persone (RNF-16); fino a ~25 messaggi nell'ora più carica nel caso
realistico peggiore

## Verifica dei limiti di piattaforma *(richiesta esplicita, principio II)*

**Subrequest per esecuzione oraria** (research R-07, R-09; contratto
[ciclo-orario.md](contracts/ciclo-orario.md)):

| Scenario (200 persone) | Invii | D1 | Telegram | Totale |
|---|---|---|---|---|
| Ora senza invii (20 ore su 24) | 0 | 2 | 0 | 2 |
| Giorno tipico | 1–3 | 3 | 1–3 | 4–6 |
| 13:00, 5 compleanni Alta su ciascuna delle 5 date (−7, −2, −1, oggi, ieri) | 25 | 3 | 25 | 28 |
| 13:00, 8 compleanni Alta su ciascuna delle 5 date | 40 | 3 | 40 | **43** |
| 200 compleanni lo stesso giorno, ore 9 | 200 → 40 inviati + 160 in coda | 3 | 40 | **43** |

Il numero di chiamate D1 non dipende dal numero di persone: letture in una `batch`, scritture in
due `batch` con statement multi-riga (≤ 100 parametri, ~25 statement anche con 200 invii).
Il tetto `MAX_SENDS_PER_RUN = 40` rende il massimo **43 ≤ 50** per qualunque distribuzione dei
compleanni; gli eccedenti restano registrati e partono alle ore successive della stessa giornata
(percorso dei retry, N-03).

**CPU per esecuzione** (stima, research R-09): ~3,5–6 ms con 40 invii (dominata da 40 `fetch`),
< 1 ms senza invii. Nessuna chiamata `Intl` per persona, nessun lavoro quadratico.

**Callback Fatto/Salta**: 3 subrequest, < 1 ms CPU. **`/messaggio`**: ≤ 4 subrequest.

**Come si verifica**: (1) test di integrazione con contatore D1 e fake Telegram per ogni scenario
della tabella (valore esatto e ≤ 50); (2) `vitest bench` delle parti pure con 200 persone e 40
invii, soglia 3 ms; (3) dopo il deploy, *Metrics* del Worker: p99 CPU dei cron < 7 ms, nessun
`exceededCpu` (altrimenti si abbassa il tetto).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, il Cron esistente, Bot API. Nessun servizio nuovo; metriche della dashboard già incluse nel piano Free, nessuna observability aggiuntiva | ✅ |
| II | Limiti Free | Stima subrequest e CPU nel caso peggiore (sezione precedente); scritture multiple in `D1.batch`; un solo Cron | ✅ |
| III | Semplicità | Zero dipendenze nuove; nessun framework; schema invariato salvo un indice; occorrenze create al bisogno invece di una pianificazione anticipata (R-03, R-04) | ✅ |
| IV | Sicurezza | Pulsanti `o:` serviti solo al proprietario dal router esistente (token, whitelist, chat privata); pulsanti URL solo `https://` (V-04); nessun segreto nuovo | ✅ |
| V | Privacy | Log del ciclo con soli conteggi e codici (`cron_run`, `cron_error`); `last_error_code` numerico; messaggi solo nella chat del proprietario | ✅ |
| VI | Tempo | Ora del ciclo da `scheduledTime`, timestamp da `deps.now()`; conversione solo in `src/time.ts` (nuova `localDayStartUtc`); test 29/02, cavallo d'anno, cambio d'ora di marzo e ottobre | ✅ |
| VII | Affidabilità | Unicità `(occurrence_id, kind, ref)` nel DB e reclamo prima dell'invio; retry solo con `local_date = oggi`, poi `abbandonato`; slot persi non recuperati; errori isolati per invio; statement non fallibili per riga | ✅ |
| VIII | Centralizzazione | Profili, slot, ore, tetto, pausa, finestra di correzione, limiti in `src/config.ts`; testi in `src/texts.ts`; default degli auguri solo in `config.ts` | ✅ |
| IX | Mono-proprietario | Chat del proprietario = `OWNER_TELEGRAM_ID`; `settings` chiave-valore; nessuna unicità globale nuova | ✅ |
| X | Qualità e test | Ogni scenario della spec → test (quickstart §2); niente orologio né rete reali; il benchmark non sostituisce i test | ✅ |
| XI | Tracciabilità | ID AFU in research, contratti, nomi dei test | ✅ |
| XII | Italiano | Testi utente e documenti in italiano | ✅ |

Vincoli V-01…V-07: un cron (V-01); CPU (V-02); solo `https://` e `copy_text`, telefono nel testo
(V-04); Instagram/Telegram senza testo, Copia messaggio (V-05); WhatsApp con numero internazionale
(V-06).

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/](contracts/). Nessuna violazione.

### Decisioni del proprietario (2026-10-28)

Segnalate come scostamenti o interpretazioni dell'AFU (constitution, "Fonte di verità") e
approvate dal proprietario; registrate nei Chiarimenti della spec (FR-003, FR-006, FR-020).

1. **Tetto di 40 invii per esecuzione vs N-01** — N-01 vuole tutto inviato "all'ora prevista".
   Oltre 40 messaggi nella stessa ora, gli eccedenti arrivano all'ora successiva (stessa
   giornata). Senza tetto un giorno affollato supererebbe 50 subrequest e l'esecuzione fallirebbe
   per tutti. Con ~200 persone il caso realistico peggiore (~25) non lo raggiunge.
2. **BR-13, "occorrenza aperta dell'anno corrente"** — interpretata come "le occorrenze aperte
   della persona" (al più quella in corso o, a dicembre, quella di gennaio già nata da un
   pre-reminder), e applicata solo se cambiano giorno o mese, non per il solo anno.
3. **Invio rimasto `in_invio`** (esecuzione interrotta tra invio e registrazione): non viene
   ritentato. Si sceglie "al massimo una volta" (N-02) rispetto al retry (N-03).

### Scelte non fissate dalla spec (modificabili senza impatto sull'architettura)

Posizione di "(compleanno il 29/02)" in fondo alla prima riga; riga vuota prima dell'esito
aggiornato; `/messaggio` mostra il messaggio attuale nella domanda; testo dell'errore di
lunghezza; nome d'esempio dell'anteprima (`T.sampleName`); pausa di 1 s tra gli invii; i
pulsanti Fatto/Salta non interrompono un flusso guidato in corso.

## Project Structure

### Documentation (this feature)

```text
specs/002-promemoria-esiti/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ciclo-orario.md  # handler scheduled, algoritmo, budget
│   ├── promemoria.md    # testi, tastiere, risposte ai tocchi
│   ├── callback-data.md # ambito o:
│   └── messaggio.md     # /messaggio e composizione degli auguri
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Nuovi file marcati `+`, modificati `~`.

```text
migrations/
└── + 0002_indice_retry.sql

src/
├── ~ index.ts               # scheduled → runHourly(makeCronDeps(env), scheduledTime); sleep = scheduler.wait
├── ~ config.ts              # MAX_SENDS_PER_RUN, SEND_INTERVAL_MS, OUTCOME_CORRECTION_DAYS, limiti 256/60
├── ~ texts.ts               # pre-reminder, reminder, recupero, esiti, pulsanti, /messaggio, /aiuto
├── ~ time.ts                # addDays, toDateString, localDayStartUtc, floorToHour
├── cron/
│   └── + hourly.ts          # runHourly: lettura → selezione → reclamo → invio → esito
├── domain/
│   ├── + schedule.ts        # piano (T, H) → target; selezione per profilo, BR-10, BR-11 (puro)
│   └── + greeting.ts        # composeGreeting, validateGreeting (puro)
├── db/
│   ├── + reminders.ts       # statement della batch di lettura, reclamo, esito (multi-riga)
│   ├── + outcomes.ts        # batch UPDATE esito + SELECT per ricomporre il messaggio
│   ├── + settings.ts        # default_message
│   ├── ~ persons.ts         # DELETE occorrenze aperte nella batch del cambio data (BR-13)
│   └── ~ conversation.ts    # FLOW_NAMES += "messaggio"
├── bot/
│   ├── + promemoria.ts      # render testi e tastiere (puro), varianti dopo l'esito
│   ├── + esiti.ts           # handler dei callback o:f / o:s
│   ├── ~ router.ts          # ramo o: prima di routeStatic, senza clear del flusso
│   ├── ~ commands.ts        # /messaggio
│   └── flows/
│       ├── + messaggio.ts   # flusso messaggio (testo → conferma)
│       ├── ~ nuovo.ts       # validateGreeting per il messaggio personalizzato
│       └── ~ modifica.ts    # validateGreeting; BR-13 sul campo Data
└── telegram/
    ├── ~ types.ts           # InlineKeyboardButton: callback_data | url | copy_text
    ├── ~ client.ts          # editMessageText
    └── ~ keyboard.ts        # ambito o, urlButton, copyButton

test/
├── helpers/~ fake-telegram.ts   # editMessageText, failNext(code), pulsanti url/copy
├── helpers/+ cron.ts            # runAt(localDate, hour), seed di persone/occorrenze
├── unit/+ schedule.test.ts, + greeting.test.ts, + promemoria.test.ts, ~ time.test.ts, ~ callback-data.test.ts
└── integration/
    ├── ~ scheduled.test.ts      # sostituisce "handler vuoto"
    ├── + us1-reminder … + us6-modifiche
    ├── + ciclo-idempotenza, + ciclo-retry, + ciclo-budget
    └── ~ us2-inserimento, ~ us4-modifica (limite 256)

bench/
└── + ciclo.bench.ts             # vitest bench, Node: pianificazione + render + serializzazione
vitest.bench.config.ts           # + ambiente Node, solo bench/
```

**Structure Decision**: struttura della feature 001 invariata (`domain/` puro, `db/` SQL,
`telegram/` trasporto, `bot/` interazione), più `src/cron/` per l'orchestrazione dell'handler
`scheduled`. Le parti pure (`domain/schedule.ts`, `domain/greeting.ts`, `bot/promemoria.ts`) non
importano `cloudflare:*`, così il benchmark gira in Node.

## Complexity Tracking

Nessuna violazione della constitution da giustificare. La configurazione di benchmark
(`vitest.bench.config.ts`) è uno strumento di sviluppo senza nuove dipendenze, richiesto dalla
verifica CPU del principio II.
