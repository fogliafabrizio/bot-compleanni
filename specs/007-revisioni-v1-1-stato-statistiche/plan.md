# Implementation Plan: Revisioni v1.1 — Stato e statistiche

**Branch**: `007-revisioni-v1-1-stato-statistiche` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-revisioni-v1-1-stato-statistiche/spec.md`

## Summary

Revisione REV-007 dell'AFU v1.1: due comandi nuovi, `/stato` (RF-31: ultimo controllo orario,
invii di oggi e dei 7 giorni con il dettaglio degli abbandonati, ultimo backup mensile, webhook) e
`/statistiche` (RF-32: totali per priorità, gruppo e mese, schede senza anno o contatti, % di
*fatto* per anno), più l'avviso di buco del cron (N-06, D-28) e i dati tecnici delle Impostazioni
(§8), esclusi da backup e ripristino.

Approccio: architettura e stack di 001–006 invariati, **nessuna dipendenza nuova, nessuna
migration, nessun indice nuovo, nessuna conversione dei dati**.

- **Chiavi tecniche** in `settings`: `cron_last_run` (ISO UTC dell'ora piena prevista) e
  `auto_backup_last` (JSON `{at, esito}`); `auto_backup` di 004 resta il reclamo mensile, con lo
  stato nuovo `errore` (R-01, R-05).
- **N-06**: lettura del valore precedente e upsert anti-regressione in testa alla batch di
  lettura del ciclo (atomici, 0 subrequest in più); `detectGap` puro su millisecondi reali (cambio
  d'ora senza casi speciali); un solo `sendMessage` prima del reclamo, fuori tetto, senza retry
  (R-02, R-03).
- **`/stato`**: una batch D1 di 3 query aggregate su `settings` e `deliveries` (indice
  `idx_deliveries_retry` già esistente) in parallelo a `getWebhookInfo`, unica subrequest esterna
  oltre alla risposta; errore del webhook → solo quella riga "non disponibile" (R-07). Gli
  `in_invio` dell'esecuzione corrente si riconoscono da `sent_at` scritto al reclamo (R-04).
- **`/statistiche`**: aggregati SQL in una batch, formattazione e istogramma testuale in
  TypeScript (entità `pre`, 10 blocchi al massimo), ≈ 0,1–0,3 ms CPU (R-08).
- **Backup/ripristino**: già limitati a `default_message` per costruzione; solo test di
  regressione e commenti (R-06).
- **Menu e `/aiuto`**: due voci in `BOT_COMMANDS` e `T.help`; il menu si aggiorna da solo con
  `syncBotCommands` di 005 (R-10).

Dettagli in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001–006)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`)

**Storage**: D1 `birthday-bot-db`, schema invariato; `settings` con 2 chiavi tecniche nuove e uno
stato nuovo nel valore di `auto_backup`; `deliveries.sent_at` valorizzata anche per `in_invio`
([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale e fake Telegram (+ `getWebhookInfo`
configurabile), `now` e `scheduledTime` iniettati

**Target Platform**: Cloudflare Workers Free; webhook e un solo Cron Trigger orario invariati

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: `/stato` < 1 ms CPU, `/statistiche` ≈ 0,1–0,3 ms, ciclo orario + avviso
< 0,05 ms in più rispetto al bench di 002 (≈ 200 persone, RNF-16)

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); un solo cron
(N-01, V-01); Europe/Rome solo in `src/time.ts`; testi solo in `src/texts.ts`; nessun dato
personale nei log (RNF-08)

**Scale/Scope**: ~200 persone, ≤ ~1.200 invii/anno; 2 comandi nuovi, 1 avviso automatico,
2 chiavi tecniche, 1 metodo Telegram nuovo (`getWebhookInfo`)

## Moduli toccati

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/db/settings.ts` | + `CRON_LAST_RUN_KEY`, `AUTO_BACKUP_LAST_KEY`, `TECHNICAL_KEYS`; + `cronLastRunStatements(db, currentIso, nowIso)` (select + upsert anti-regressione); `claimAutoBackup` → batch [reclamo, `auto_backup_last = in_invio`], ritorna `{ attemptIso } \| null`, esclude `:errore`; `setAutoBackupResult(month, stato, attemptIso, esito)` → batch di 2 | §8, FR-001, FR-004, FR-008 |
| `src/db/reminders.ts` | `readStatements` con i 2 statement di `cron_last_run` in testa; `insertDeliveries(in_invio)` e retry scrivono `sent_at = nowIso`; esito di errore azzera `sent_at` | FR-004, FR-010 |
| `src/cron/hourly.ts` | legge il valore precedente dalla batch; `detectGap` → `sendMessage(T.gapAlert)` prima del reclamo, `try/catch`, log `gap_alert`; `RunReport.gapAlert` | N-06, FR-004…FR-007 |
| `src/cron/backup-mensile.ts` | scrive l'esito di ogni tentativo; errori non Telegram → `errore` + `non_riuscito`, non più propagati | RF-31, FR-008 |
| `src/cron/scheduled.ts` | nessuna modifica di logica (commento sul budget a 48) | R-11 |
| `src/domain/stato.ts` (nuovo) | `detectGap`; tipi e `formatStato` (pura: righe, singolari/plurali, "mai registrato", ⚠️/❌/✅, riga webhook) | RF-31, N-06 |
| `src/domain/statistiche.ts` (nuovo) | `formatStatistiche` (pura), `histogramLines`, percentuali | RF-32 |
| `src/db/stato.ts` (nuovo) | `statoReadStatements(db, { today, from, hourStartIso })` (3 query; "corrente" = `sent_at >= hourStartIso`) | RF-31, FR-010 |
| `src/db/statistiche.ts` (nuovo) | `statisticheReadStatements(db)` (4 query) | RF-32 |
| `src/bot/stato.ts`, `src/bot/statistiche.ts` (nuovi) | handler: batch + `getWebhookInfo` con `Promise.allSettled`, `sendLines` | RF-31, RF-32, FR-012 |
| `src/bot/commands.ts` | `stato`, `statistiche` in `COMMANDS` | §5.1 |
| `src/telegram/client.ts`, `types.ts` | + `getWebhookInfo(): { pendingUpdateCount, lastErrorDate?, lastErrorMessage? }` | RF-31 |
| `src/time.ts` | + `toLocalClock` (ora e minuti locali) | RF-31, N-06, principio VI |
| `src/config.ts` | + `STATS_BAR_WIDTH = 10`, `STATUS_WINDOW_DAYS = 7`, `GAP_ALERT_THRESHOLD_HOURS = 2` | RF-32, RF-31, N-06 |
| `src/texts.ts` | + `gapAlert`, testi di `/stato` e `/statistiche`, `MONTHS_SHORT` derivato da `MONTHS_IT`; `BOT_COMMANDS` e `help` con le due voci | §5.1, §5.10…§5.12 |
| `src/db/backup.ts` | solo commento: chiavi tecniche escluse (lettura e ripristino per chiave `default_message`) | FR-002, FR-003 |
| `test/helpers/fake-telegram.ts` | + `getWebhookInfo` (risposta o errore impostabili) | — |
| `bench/ciclo.bench.ts`, `bench/stato.bench.ts` (nuovo) | scenario con buco; `/stato` e `/statistiche` su 200 persone | RNF-17 |

Non toccati: `src/domain/backup.ts` (formato e versione invariati), `src/bot/backup.ts`
(`/backup` non scrive dati tecnici), flussi guidati, router (whitelist e interruzione dei flussi
ereditate), migration.

### Dettaglio: chiavi tecniche *(richiesta: nomi e formato)*

| Chiave | Formato del valore | Scrittore | Momento |
|---|---|---|---|
| `cron_last_run` | `2026-10-29T14:00:00.000Z` (ISO UTC dell'ora piena prevista, `toIso(floorToHour(scheduledAt))`) | `src/cron/hourly.ts` via `readStatements` | all'inizio di ogni esecuzione, prima degli invii |
| `auto_backup_last` | `{"at":"2026-10-01T07:00:02.114Z","esito":"in_invio"}` → `"riuscito"` \| `"non_riuscito"` | `src/cron/backup-mensile.ts` via `claimAutoBackup` / `setAutoBackupResult` | al reclamo e all'esito di ogni tentativo |
| `auto_backup` (004) | `2026-10:<in_invio\|inviato\|fallito\|errore>` | `src/cron/backup-mensile.ts` | come oggi, + `errore` |
| `bot_commands` (005) | hash | `src/cron/comandi.ts` | invariato |

`updated_at` di ogni riga = `now()` reale della scrittura. `/backup` su richiesta non scrive alcuna
chiave tecnica.

### Dettaglio: N-06 *(dove si legge e scrive, idempotenza)*

```
runHourly(scheduledAt)
 └─ db.batch([ SELECT cron_last_run,                       ← valore precedente
               UPSERT cron_last_run = ora piena corrente    ← WHERE nuovo > vecchio
               WHERE excluded.value > settings.value,
               ...lettura esistente ])                      ← 1 transazione, 1 subrequest
 └─ detectGap(precedente, corrente)  > 2 h reali ?
       └─ sì → sendMessage(owner, T.gapAlert)  (1 tentativo, errore → log e prosegue)
 └─ reclamo → invii → esito (invariati)
```

Riesecuzione della stessa ora: legge l'ora appena scritta → differenza 0 → nessun avviso.
Esecuzioni concorrenti: serializzate dalla transazione della batch → una sola vede il buco.
Esecuzione tardiva di un'ora già superata: differenza negativa, valore non regredisce. Nessuna
chiave "avviso inviato": l'idempotenza segue dall'atomicità lettura+scrittura (research R-02, R-03).

### Dettaglio: `/stato` *(batch D1 + webhook)*

```
showStato
 ├─ Promise.allSettled
 │   ├─ db.batch([settings tecniche, aggregato deliveries 7 gg, dettaglio abbandonati])  ← 1 D1
 │   └─ tg.getWebhookInfo()                                                            ← 1 Telegram
 ├─ webhook rejected → riga "🔗 Webhook: non disponibile", log("webhook_info_error", {error_code})
 └─ sendLines(formatStato(...))                                                        ← ≥ 1 Telegram
```

Contratto completo in [contracts/stato.md](contracts/stato.md).

## Verifica dei limiti di piattaforma *(principio II)*

| Invocazione (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| Cron: 40 invii + avviso + backup mensile | 3 + 3 | 40 + 1 + 1 | **48** |
| Cron: 40 invii + avviso | 3 | 41 | 44 |
| Cron: nessun invio + avviso + menu cambiato | 5 | 2 | 7 |
| `/stato` (router + batch + webhook + risposta) | 2 + 1 | 1 + 1 | ≤ 5 |
| `/statistiche` | 2 + 1 | 1 | ≤ 4 |

Prima di questa feature il caso peggiore del cron era 47 (004). Le nuove scritture viaggiano nelle
batch esistenti; l'avviso è l'unico +1.

**CPU stimata (200 persone, 20 gruppi, 5 anni, ~250 invii nella finestra)**:

| Invocazione | Lavoro in TypeScript | Stima |
|---|---|---|
| Ciclo orario | + 2 `Date.parse`, 1 `toLocalClock` e 1 stringa solo con buco | < 0,05 ms in più |
| `/stato` | ≤ 6 righe aggregate + n righe di dettaglio, formattazione | < 1 ms |
| `/statistiche` | ~40 righe aggregate, `sortGroups` su ≤ 20, 12 righe di istogramma | ≈ 0,1–0,3 ms |

Le query SQL girano in D1 e non contano nella CPU del Worker; l'attesa di `getWebhookInfo` non
conta (FR-017). Verifica con `bench/ciclo.bench.ts` (aggiornato) e `bench/stato.bench.ts` (nuovo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, un Cron, Bot API (`getWebhookInfo` è Bot API) | ✅ |
| II | Limiti Free | Cron ≤ 48 subrequest, comandi ≤ 5; CPU entro le stime; un solo Cron Trigger; scritture multiple in `D1.batch` (reclamo + `auto_backup_last`, esito + `auto_backup_last`, `cron_last_run` nella batch di lettura); stima per il ciclo orario e il backup presente | ✅ |
| III | Semplicità | Zero dipendenze, zero migration, zero indici; riuso di `settings`, `sent_at`, `idx_deliveries_retry`, `sendLines`, `sortGroups`, `syncBotCommands` | ✅ |
| IV | Sicurezza | Comandi dietro whitelist e secret del router esistente; nessuna operazione distruttiva nuova | ✅ |
| V | Privacy | Log solo `gap_alert {sent, hours \| error_code}`, `auto_backup {sent, error_code}`, `webhook_info_error {error_code}`; testo dell'errore webhook e nomi solo nella risposta al proprietario; `privacy-log.test.ts` esteso | ✅ |
| VI | Tempo | Ora piena da `scheduledTime`; soglia in millisecondi reali; visualizzazione con `toLocalClock` in `src/time.ts`; test di cambio d'ora nei due versi e mezzanotte | ✅ |
| VII | Affidabilità | Avviso idempotente per atomicità della batch; un solo tentativo; errore dell'avviso non blocca i promemoria; `in_invio` mai ritentati; regola di ripetizione del backup invariata (`errore` non ritentato come prima) | ✅ |
| VIII | Centralizzazione | Testi in `src/texts.ts`; soglia, finestra e larghezza barra in `src/config.ts`; fuso solo in `src/time.ts` | ✅ |
| IX | Mono-proprietario | Chiavi di `settings` estendibili con un ID proprietario; nessuna unicità nuova | ✅ |
| X | Qualità e test | Un test per ogni criterio Dato/Quando/Allora e caso limite di RF-31, RF-32, N-06 ([quickstart.md](quickstart.md)); now e `getWebhookInfo` simulati | ✅ |
| XI | Tracciabilità | ID AFU in research, contratti, quickstart e nomi dei test | ✅ |
| XII | Italiano | Testi e documenti in italiano | ✅ |

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/](contracts/). Nessuna violazione, tabella di complessità vuota.

### Scelte di piano da confermare

Precisano punti che la spec non fissa:

1. **Chiave nuova `auto_backup_last` invece di riusare `auto_backup`**: `auto_backup` in
   produzione contiene già i mesi passati e `/stato` li mostrerebbe subito, mentre FR-020 e l'AFU
   ("Impatto della versione 1.1") chiedono "mai registrato" fino al primo tentativo dopo il deploy.
   Se si preferisce vedere subito l'ultimo backup già fatto, basta leggere `auto_backup` (meno
   codice), ma va cambiato FR-020 nella spec.
2. **Errore non Telegram del backup mensile = stato `errore`, non ritentato nel mese**: mantiene la
   regola di 004 (oggi restava `in_invio`, non ritentato) e lo registra come ❌ (chiarimento 4).
3. **`deliveries.sent_at` scritto al reclamo** per riconoscere gli `in_invio` dell'esecuzione in
   corso (research R-04): nessuna colonna nuova; i test che verificano `sent_at NULL` sulle righe
   `in_invio` vanno aggiornati.
4. **Dettaglio degli abbandonati senza tetto**: una riga per ciascuno (FR-009); oltre i 4096
   caratteri il messaggio si divide con `sendLines`.
5. **Posizione nel menu e in `/aiuto`**: `/statistiche` e `/stato` subito dopo `/anno`.

## Dati in produzione *(FR-019…FR-023)*

- **Migration**: **non serve**. `settings` è chiave/valore: le chiavi nuove sono righe, non
  struttura. **Nessun indice nuovo**: le query di `/stato` filtrano su `deliveries.local_date`,
  coperto da `idx_deliveries_retry (local_date, status)` di 0002; `/statistiche` aggrega tabelle di
  ~200 righe. `schema.test.ts` invariato.
- **Chiavi vuote fino alla prima esecuzione**: `cron_last_run` nasce alla prima esecuzione oraria
  dopo il deploy (senza avviso, `detectGap(null, …) = null`); `auto_backup_last` al primo tentativo
  di backup mensile. Fino ad allora `/stato` mostra "mai registrato".
- **Conversioni**: nessuna. `auto_backup` esistente resta valido; gli `in_invio` storici hanno
  `sent_at NULL` e `/stato` li conta come abbandonati, come richiesto; storico di invii e
  occorrenze usato così com'è (FR-021).
- **Backup esistenti**: formato e versione invariati → ripristinabili; il ripristino tocca solo
  `default_message` (FR-022, SC-005).
- **Menu**: aggiornato dal primo ciclo senza invii dopo il deploy (hash cambiato), nessun passo
  manuale.
- **Deploy**: `scripts/deploy.ps1` invariato.

## Test

**Da aggiornare**:

- `test/integration/us3-backup-mensile.test.ts` — esito registrato in `auto_backup_last`; errore non
  Telegram → `errore`, non ritentato, non propagato;
- `test/integration/ciclo-budget.test.ts` — caso peggiore 48 con avviso e backup;
- `test/integration/ciclo-idempotenza.test.ts`, `ciclo-retry.test.ts` — `sent_at` al reclamo e
  azzerato sull'errore; `cron_last_run` presente nella batch;
- `test/integration/us2-backup.test.ts`, `us2-ripristino.test.ts`, `test/unit/backup.test.ts` —
  chiavi tecniche assenti dal file e intatte dopo il ripristino; file con chiavi tecniche accettato;
- `test/integration/us7-start-aiuto.test.ts`, `menu-comandi.test.ts` — voci nuove;
- `test/unit/privacy-log.test.ts` — eventi nuovi.

**Nuovi**:

- unitari: `test/unit/stato.test.ts` (`detectGap` tabellare con cambio d'ora e mezzanotte,
  `formatStato`, testo dell'avviso), `test/unit/statistiche.test.ts` (istogramma, percentuali,
  gruppi, vuoti), `test/unit/time.test.ts` (+ `toLocalClock`), `test/unit/telegram-client.test.ts`
  (+ `getWebhookInfo`);
- integrazione: `v11-stato.test.ts` (RF-31 US1-1…7 e casi limite), `v11-buco-cron.test.ts` (N-06
  US2-1…5 e casi limite), `v11-statistiche.test.ts` (RF-32 US3-1…4 e casi limite).

Mappa completa criterio → test in [quickstart.md](quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/007-revisioni-v1-1-stato-statistiche/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── stato.md
│   ├── statistiche.md
│   └── ciclo-orario-v11.md
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── bot/        commands.ts, stato.ts (nuovo), statistiche.ts (nuovo)
├── cron/       hourly.ts, backup-mensile.ts, scheduled.ts (commento)
├── db/         settings.ts, reminders.ts, backup.ts (commento), stato.ts (nuovo), statistiche.ts (nuovo)
├── domain/     stato.ts (nuovo), statistiche.ts (nuovo)
├── telegram/   client.ts, types.ts
├── config.ts, texts.ts, time.ts
test/
├── helpers/    fake-telegram.ts
├── unit/       stato.test.ts, statistiche.test.ts (nuovi) + aggiornati
└── integration/ v11-stato.test.ts, v11-buco-cron.test.ts, v11-statistiche.test.ts (nuovi) + aggiornati
bench/          ciclo.bench.ts, stato.bench.ts (nuovo)
```

**Structure Decision**: progetto singolo esistente; i moduli nuovi seguono la divisione
`bot/` (handler) → `db/` (statement) → `domain/` (funzioni pure) già usata da `viste`.

## Complexity Tracking

Nessuna violazione della constitution.
