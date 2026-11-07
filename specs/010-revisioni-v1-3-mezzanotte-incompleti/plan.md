# Implementation Plan: Revisioni v1.3 — Mezzanotte e profili incompleti

**Branch**: `010-revisioni-v1-3-mezzanotte-incompleti` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-revisioni-v1-3-mezzanotte-incompleti/spec.md`

## Summary

Revisioni REV-012 e REV-013 dell'AFU v1.3 sul bot già rilasciato (feature 001-009):

- **Slot delle 00:00 per la priorità Alta** (§7, RF-10, D-02): il profilo Alta diventa
  00:00 · 9:00 · 13:00 · 18:00 · 21:00; la mezzanotte si scrive "00:00" in `/stato` e nell'avviso di
  buco (RNF-19, N-06).
- **Profili incompleti** (RF-50, RF-32, RF-28, RNF-14, RNF-19, D-34): nuovo comando
  `/incomplete [campo]` con 5 filtri a pulsanti e liste §5.7; pulsante [📝 Profili incompleti] in fondo
  a `/statistiche`; `/incomplete` in `/aiuto` e nel menu dei comandi.

Approccio:

- **Nessuna migration, nessuna dipendenza, nessuna conversione dei dati** (AFU "Impatto della
  versione 1.3"; FR-021): lo slot 0 è un valore di `deliveries.ref` già ammesso, i profili incompleti
  si calcolano dai campi esistenti.
- **Cron non toccato**: resta l'unico trigger orario `0 * * * *`; l'esecuzione delle 00:00 locali (23:00
  UTC in ora solare, 22:00 UTC in ora legale) gira già e oggi non pianifica nulla. Basta aggiungere lo
  0 agli slot: `planTargets`, idempotenza, retry, coda e recupero sono già generici su `ref`
  (research R-03).
- **Un solo punto per gli slot**: `SLOT_HOURS` derivato da `PRIORITY_PROFILES` (research R-01).
- **Regola unica del dato mancante** (`NULL`, vuoto o spazi): un frammento SQL condiviso da
  `/incomplete` e `/statistiche` e un predicato puro per la lista (research R-06).
- **`callback_data` compatibili**: azione `i` nell'ambito senza stato `s` (`s:i`, `s:i:1…5`),
  decoder invariato (research R-09).
- **Testi** solo in `src/texts.ts`, nell'inventario eseguibile ([contracts/testi-v13.md](contracts/testi-v13.md)).

## Technical Context

**Language/Version**: TypeScript (`strict`), target Cloudflare Workers (come 001-009)

**Primary Dependencies**: nessuna di runtime nuova; client Bot API proprio basato su `fetch`
(`src/telegram/client.ts`)

**Storage**: Cloudflare D1, schema invariato (`migrations/0001`, `0002`); nuove righe `deliveries`
con `ref = 0`, sola lettura per `/incomplete`

**Testing**: Vitest + `@cloudflare/vitest-pool-workers` (`npm test`); bench Vitest in Node
(`npm run bench`); smoke Postman in locale (`postman/bot-compleanni.postman_collection.json`)

**Target Platform**: Cloudflare Workers piano Free, webhook Telegram; un solo Cron Trigger orario
(non toccato)

**Project Type**: bot Telegram (web-service serverless a progetto singolo)

**Performance Goals**: ogni invocazione ≤ 10 ms CPU; ciclo delle 00:00 con 200 Alta come il ciclo
delle 9:00 di oggi (`bench/ciclo.bench.ts`); `/incomplete telefono` su 200 persone < 1 ms
(`bench/liste.bench.ts`)

**Constraints**: ≤ 50 subrequest per invocazione (ciclo delle 00:00: 43, caso peggiore di
`runScheduled` invariato a 48; `/incomplete` e tocchi ≤ 8); `callback_data` ≤ 64 byte (caso
peggiore 5); Europe/Rome con now iniettato; nessun dato personale nei log; testi solo in
`src/texts.ts`

**Scale/Scope**: ~200 persone; 13 moduli `src/` toccati, 3 moduli nuovi (`src/bot/incomplete.ts`,
`src/db/incomplete.ts`, `src/domain/incomplete.ts`)

Nessun NEEDS CLARIFICATION: i casi aperti sono stati chiusi nel clarify del 2026-11-06.

## Constitution Check

*GATE: verificato prima della Phase 0 e ricontrollato dopo la Phase 1.*

| Principio | Verifica | Esito |
|---|---|---|
| I. Costo zero | Solo Workers, D1, Bot API; nessun servizio nuovo | ✅ |
| II. Limiti Free | Ciclo orario toccato → stima obbligatoria: 00:00 con 200 Alta = 43 subrequest (`splitByCap`, 160 in coda), `runScheduled` caso peggiore invariato 48; CPU come l'esecuzione delle 9:00 esistente. `/incomplete` e pulsanti ≤ 8 subrequest, CPU < 1 ms su 200 persone (research R-13). Un solo Cron Trigger, non toccato | ✅ |
| III. YAGNI | Nessuna dipendenza; nessun ambito `callback_data` nuovo; riuso di `formatRows`/`formatListLine`, `sendList`/`splitMessage`, `sortByNextBirthday`, `LIST_PERSON_COLUMNS`; escluse le alternative scartate v1.3 (combinazioni, filtro per gruppo, conteggi cliccabili, gruppi nella riga, "Senza gruppo" tra i filtri) | ✅ |
| IV. Sicurezza | Router invariato: estranei ignorati prima del decoder; `s:i:<n>` validato al tocco; nessuna operazione distruttiva nuova | ✅ |
| V. Privacy | Nessun log nuovo; `callback_data` con soli codici numerici, mai testo dell'utente | ✅ |
| VI. Tempo | Conversione UTC → Europe/Rome solo in `src/time.ts`; `scheduledAt` e `now` iniettati; test su 29/02 (BR-04), giorni del cambio d'ora (29/03 e 25/10/2026), ora solare e legale; lista ordinata con `toLocal(deps.now())` | ✅ |
| VII. Affidabilità invii | Unicità `(occurrence_id, kind, ref)` a livello di DB distingue lo slot 0 (N-02); retry nella giornata dalle 1:00 e abbandono (N-03); nessun recupero di slot persi (N-04); errore su una persona non blocca le altre (RNF-12, codice invariato) | ✅ |
| VIII. Centralizzazione | Slot e profili solo in `src/config.ts` (`SLOT_HOURS` derivato da `PRIORITY_PROFILES`); testi e `formatClock` solo in `src/texts.ts`; regola del dato mancante in un solo frammento SQL | ✅ |
| IX. Mono-proprietario | Nessuna modifica allo schema | ✅ |
| X. Qualità e test | Almeno un test per ogni criterio Dato/Quando/Allora v1.3 di RF-10, RF-50, RF-32, RNF-19 e per RF-28 (tabella "Copertura"); test senza orologio né rete reali | ✅ |
| XI. Tracciabilità | ID AFU in plan, contratti, nomi dei test | ✅ |
| XII. Italiano | Testi e documenti in italiano | ✅ |

Vincoli V-01…V-07 e V-09: nessuna violazione (tastiera del menu: 5 pulsanti). Nessuna deviazione:
tabella di complessità vuota.

**Ricontrollo post-design**: research, data model e contratti non introducono violazioni; il ciclo
delle 00:00 resta dentro il tetto `MAX_SENDS_PER_RUN` e il caso peggiore di `runScheduled` non cambia;
i nuovi percorsi webhook sono ≤ 8 subrequest. ✅

## Moduli toccati

### Slot delle 00:00 (REV-012)

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/config.ts` | `PRIORITY_PROFILES.alta.slots = [0, 9, 13, 18, 21]`; `SLOT_HOURS` derivato (unione ordinata degli slot dei profili, dichiarato dopo `PRIORITY_PROFILES`) | §7, RF-10, D-02, FR-001, principio VIII |
| `src/domain/schedule.ts` | `planTargets(T, 0)` produce il target `giorno` 0 (via `SLOT_HOURS`, nessuna logica nuova); `admitted`: per `ref === 0` ammessa solo se `createdAt < dayStartTodayIso`, il filtro per profilo (`profile.slots.includes`) esclude Media e Bassa; commento su `Target.ref` (0 = mezzanotte) | RF-10, BR-04, BR-10, FR-002, FR-004 (R-02) |
| `src/texts.ts` | `formatClock(hour, minute)` esportata (0 → "00"), usata da `clock`; `statoKind` → `reminder delle ${formatClock(ref, 0)}` | RNF-19, FR-007, FR-023 (R-05) |
| `src/domain/stato.ts` | **verificato, nessuna modifica**: passa `LocalClock` e `ref` ai testi | RNF-19 |
| `src/cron/hourly.ts`, `src/db/reminders.ts` | **verificati, nessuna modifica**: idempotenza, retry, coda e recupero generici su `ref` | N-01, N-02, N-03, BR-11 (R-03) |
| `src/bot/promemoria.ts` | **verificato, nessuna modifica**: il testo del reminder non contiene l'orario | FR-003 |

### Profili incompleti (REV-013)

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/domain/incomplete.ts` *(nuovo, puro)* | `INCOMPLETE_FILTERS` (codice 1…5, chiave, argomento, nell'ordine di FR-008), `filterByCode`, `parseIncompleteArg`, `isMissing`, `matchesFilter`, `incompleteRows(people, filter, today)` = filtro + `sortByNextBirthday` di `src/domain/viste.ts` | RF-50, FR-008, FR-011, FR-012 |
| `src/db/incomplete.ts` *(nuovo)* | `missingSql(col)`, condizioni SQL dei 5 filtri (`MISSING`), `incompleteCountsStatement` (una `SELECT` aggregata), `incompletePersonsStatement` (una `SELECT` con `LIST_PERSON_COLUMNS` + contatti), tipi delle righe | RF-50, FR-008, FR-017 (R-06, R-07) |
| `src/db/statistiche.ts` | `senza_anno` e `senza_contatti` con le condizioni `MISSING.anno` e `MISSING.contatti` di `src/db/incomplete.ts` | RF-32, FR-017 |
| `src/bot/incomplete.ts` *(nuovo)* | `handleIncomplete(ctx, args)` (comando), `sendIncompleteMenu(ctx)` (titolo, domanda, 5 pulsanti due per riga), `sendIncompleteList(ctx, filter)` (rubrica vuota / tutti hanno il dato / `sendList` con `formatRows` senza tastiera), `showIncompleteFromButton(ctx, id)` (tocco `s:i[:n]`) | RF-50, RNF-14, FR-009…FR-013, FR-015 |
| `src/bot/commands.ts` | `incomplete: (ctx, cmd) => handleIncomplete(ctx, cmd.args)` in `COMMANDS`; `parseCommand` invariato (già gestisce `@nomebot`, maiuscole del nome e spazi) | RF-50, FR-011 |
| `src/bot/statistiche.ts` | `sendLines(ctx, lines, keyboard([[button(T.btnIncomplete, s:i)]]))`: pulsante sull'ultimo messaggio, anche con rubrica vuota | RF-32, RNF-14, FR-016 (R-10) |
| `src/bot/router.ts` | `STATIC_CALLBACKS["s:i"] = (ctx, id) => showIncompleteFromButton(ctx, id)` | RNF-14, FR-010, FR-016 (R-09) |
| `src/telegram/keyboard.ts` | **nessuna modifica di codice**: decoder `s:<azione>[:<id>]` invariato; commento del contratto 010 accanto a quello di 009 | FR-025 |
| `src/bot/liste.ts` | **riuso, nessuna modifica**: `formatRows` → `formatListLine`, `sendList` → `splitMessage` | §5.7, FR-012 |
| `src/cron/comandi.ts` | **verificato, nessuna modifica**: l'hash di `BOT_COMMANDS` cambia e `syncBotCommands` registra il menu alla prima esecuzione oraria senza invii | RF-28, FR-018 (R-11) |
| `src/texts.ts` | chiavi di [contracts/testi-v13.md](contracts/testi-v13.md); `INCOMPLETE_LABELS`; riga di `help` e voce di `BOT_COMMANDS` dopo `/anno` | RNF-15, RNF-19, RF-28, FR-018…FR-020 |

Non toccati: `src/cron/hourly.ts`, `src/cron/scheduled.ts`, `src/db/reminders.ts`,
`src/db/backup.ts`, `src/domain/backup.ts`, `src/bot/export.ts`, `src/bot/import.ts`, `wrangler.toml`
(cron), `migrations/*`.

## Funzioni di dominio pure (test unitari)

| Funzione | Modulo | Casi minimi |
|---|---|---|
| `planTargets(T, 0)` | `domain/schedule.ts` | un solo target `giorno`, `ref 0`, data T; nessun `pre` né `recupero` a ora 0; `planTargets(T, 9)` invariato; `SLOT_HOURS = [0, 9, 13, 18, 21]` |
| `planTargets` + `birthPairsFor` a ora 0 | `domain/schedule.ts` | 28/02/2027 (non bisestile) → coppie (2,28) e (2,29); 29/02/2028 → (2,29); 28/02/2028 → solo (2,28) (BR-04) |
| `selectNew` a ora 0 | `domain/schedule.ts` | Alta → ammessa; Media e Bassa → no; Alta creata alle 23:30 del giorno prima → sì; alle 00:00:00 → no; alle 00:30 o alle 10:00 → no (BR-10); occorrenza `fatto`/`saltato` → no; giorni del cambio d'ora 29/03/2026 (scheduledAt 28/03 23:00Z) e 25/10/2026 (24/10 22:00Z) → target `giorno` 0 sulla data giusta |
| `toLocal` | `time.ts` | 2026-01-13T23:00Z → 14/01 ore 0; 2026-07-13T22:00Z → 14/07 ore 0; 2026-03-28T23:00Z → 29/03 ore 0; 2026-10-24T22:00Z → 25/10 ore 0 |
| `formatClock(h, m)` | `texts.ts` | (0, 0) → "00:00"; (9, 0) → "9:00"; (1, 0) → "1:00"; (23, 0) → "23:00"; (0, 37) → "00:37"; `statoKind("giorno", 0)` → "reminder delle 00:00", `("giorno", 9)` → "reminder delle 9:00" |
| `parseIncompleteArg(args)` | `domain/incomplete.ts` | `""` → menu; `telefono`, `instagram`, `telegram`, `anno`, `contatti` → filtro; `Anno`, `TELEFONO` → filtro; `email`, `telefoni`, `ig`, `contatto`, `telefono famiglia` → unknown |
| `isMissing(v)` | `domain/incomplete.ts` | `null`, `""`, `"   "` → true; `"+39333…"`, `"marco"`, `1990` → false |
| `matchesFilter(p, f)` | `domain/incomplete.ts` | per ciascuno dei 5 filtri, persona con e senza il dato; Marco con solo Instagram → telefono ✓, telegram ✓, instagram ✗, contatti ✗; persona con `instagram = "  "` e nessun altro contatto → contatti ✓; anno 1850 (anomalo) → anno ✗ |
| `incompleteRows(people, f, today)` | `domain/incomplete.ts` | ordine per prossimo compleanno (oggi compreso), poi nome, poi id; età assente senza anno |
| `filterByCode(n)` | `domain/incomplete.ts` | 1…5 → filtri nell'ordine di FR-008; 0, 6 → undefined |
| `T.incompleteAllHave(key)`, `T.incompleteListHeader(key, n)` | `texts.ts` | testo di ciascun filtro; 1 persona / 41 persone |

## `callback_data`

Dettaglio in [contracts/callback-data.md](contracts/callback-data.md), coerente con
[009](../009-revisioni-v1-2-navigazione/contracts/callback-data.md):

| Pulsante | Dato | Byte max |
|---|---|---|
| 📝 Profili incompleti (`/statistiche`) | `s:i` | 3 |
| Telefono (N) · Instagram (N) · Telegram (N) · Anno di nascita (N) · Nessun contatto (N) | `s:i:1` … `s:i:5` | 5 |

Nessun nuovo ambito, decoder invariato; tutti i pulsanti di 001-009 invariati. Pulsanti vecchi o
malformati (`s:i:0`, `s:i:6`, `s:i:1:2`, `s:i:x`) → "❌ Questa azione non è più disponibile.". Il
numero sul pulsante non entra nel dato: un tocco su un menu vecchio usa i dati attuali (RF-50).

## Migration e dati in produzione

- **Migration: non serve** (AFU "Impatto della versione 1.3", §Modello dati: "Nessuna nuova entità,
  nessun nuovo attributo, nessuna migration"; FR-021). `deliveries.ref` è `INTEGER NOT NULL` senza
  `CHECK` sui valori e accetta 0; l'indice univoco `ux_deliveries_unique (occurrence_id, kind, ref)`
  distingue lo slot 0 dagli altri. Nessun file in `migrations/`.
- **Nessuna conversione**: telefoni, username e anni vuoti o di soli spazi restano come sono e contano
  come mancanti in lettura (FR-008, FR-024).
- **Slot 0 dal primo compleanno dopo il deploy**: le esecuzioni passate non si rieseguono; per le
  occorrenze già aperte il giorno del deploy partono solo gli slot futuri (FR-022).
- **Invii già registrati invariati**; `/stato` formatta al momento della lettura, quindi la mezzanotte
  compare "00:00" anche per i dati di prima (FR-023).
- **Messaggi già inviati**: nessun `editMessage*`; i vecchi `/statistiche` restano senza pulsante
  (FR-025).
- Export, import, backup e ripristino invariati (nessun campo nuovo).

## Query e costi

Dettaglio in [research R-13](research.md#r-13--budget-delle-subrequest-e-cpu-principio-ii).

| Percorso | D1 | Telegram | Totale |
|---|---|---|---|
| Ciclo delle 00:00, nessun Alta | 2 | 0 | 2 |
| Ciclo delle 00:00, 200 Alta lo stesso giorno (`splitByCap`: 40 inviati, 160 in coda per 1:00…4:00) | 3 | 40 | 43 |
| idem + avviso di buco | 3 | 41 | 44 |
| `runScheduled` caso peggiore (invariato, R-11 di 007) | 6 | 42 | 48 |
| `/incomplete` (menu) | 3 (stato, clear, conteggi) | 1 | 4 |
| `/incomplete email` | 3 | 2 | 5 |
| `/incomplete telefono`, 200 persone | 3 (stato, clear, lista) | 5 | 8 |
| Tocco `s:i` | 2 (clear, conteggi) | 1 + answer | 4 |
| Tocco `s:i:<n>`, 200 persone | 2 (clear, lista) | 5 + answer | 8 |
| `/statistiche` con il pulsante | 2 | 1 | 3 (invariato) |

**CPU**: ciclo delle 00:00 = stesso lavoro dell'esecuzione delle 9:00 con 200 compleanni (già misurata);
`/incomplete` su 200 persone = filtro lineare + ordinamento + rendering + divisione, come `/prossimi 366`
(< 1 ms). Conteggi e `SUM` in D1, nessuna riga trasferita per il menu.

## Test

### Esistenti da aggiornare

| File | Modifica |
|---|---|
| `test/unit/schedule.test.ts` | `SLOT_HOURS` con lo 0; `planTargets(T, 0)`; `selectNew` a ora 0 (solo Alta, bordo delle 00:00:00, BR-04, cambio d'ora) |
| `test/unit/promemoria.test.ts` | `renderByKind("giorno", 0, …)` uguale a `("giorno", 9, …)` (stesso testo e pulsanti) |
| `test/unit/stato.test.ts` | `formatStato` con `cron_last_run` alle 00:00 → "oggi alle 00:00"; abbandonato `giorno` 0 → "reminder delle 00:00 del 14/03" |
| `test/unit/time.test.ts` | ora locale 0 da 23:00Z (solare) e 22:00Z (legale), anche nei giorni del cambio d'ora |
| `test/unit/testi.test.ts` | inventario con le chiavi nuove; `formatClock`; nessun "0:00" isolato; 📝 su `btnIncomplete`, nessuna emoji in `btnIncompleteFilter` |
| `test/unit/callback-data.test.ts` | round-trip `s:i`, `s:i:1…5`; ≤ 64 byte sulle tastiere del menu e di `/statistiche` |
| `test/unit/navigazione.test.ts` | punti di passo successivo: `/statistiche` con 1 pulsante (≤ 2 per vista) |
| `test/unit/statistiche.test.ts` | `senzaAnno`/`senzaContatti` invariati nel formato; casi con vuoti/spazi nei fixture di riga |
| `test/unit/commands-parse.test.ts` | `/incomplete`, `/incomplete Anno`, `/incomplete@nomebot telefono`, `/incomplete  TELEFONO ` → nome `incomplete`, args attesi |
| `test/integration/us1-reminder.test.ts` | profilo Alta: reminder anche alle 00:00; Media/Bassa invariati |
| `test/integration/scheduled.test.ts` | esecuzione alle 00:00 locali con invii; menu dei comandi aggiornato con `incomplete` in un'ora senza invii |
| `test/integration/ciclo-idempotenza.test.ts` | doppia esecuzione delle 00:00 → un solo invio `('giorno', 0)` (N-02, SC-003) |
| `test/integration/ciclo-retry.test.ts` | invio delle 00:00 fallito → retry alle 1:00 e successive, abbandono il giorno dopo (N-03) |
| `test/integration/ciclo-budget.test.ts` | 00:00 con 200 Alta = 43, 160 in coda; 00:00 senza Alta = 2 |
| `test/integration/v11-stato.test.ts` | righe di `/stato` con la mezzanotte "00:00" (ultimo controllo e abbandonati) |
| `test/integration/v11-buco-cron.test.ts` | avviso 23:00 → 2:00 ("alle 2:00"); estremo a mezzanotte → "00:00" |
| `test/integration/v12-statistiche.test.ts` | tastiera [📝 Profili incompleti] sull'ultimo messaggio; sezione Età invariata |
| `test/integration/v12-navigazione.test.ts` | elenco dei punti di passo successivo con `/statistiche`; ≤ 2 pulsanti |
| `test/integration/menu-comandi.test.ts` | `BOT_COMMANDS` con `incomplete` dopo `anno`; nuovo hash → `setMyCommands` |
| `test/integration/us7-start-aiuto.test.ts` | `/aiuto` con la riga di `/incomplete [campo]`; `/start` invariato |
| `test/integration/viste-budget.test.ts` | `/statistiche` con tastiera ammessa sull'ultimo messaggio; nuovi casi `/incomplete` (menu, lista 200, argomento sconosciuto), `s:i`, `s:i:<n>` entro R-13 |
| `test/integration/v11-stile.test.ts` | elenco chiuso delle icone dei pulsanti esteso con 📝 |

### Nuovi

| File | Contenuto |
|---|---|
| `test/unit/incomplete.test.ts` | `parseIncompleteArg`, `isMissing`, `matchesFilter`, `filterByCode`, `incompleteRows`, testi per filtro |
| `test/integration/v13-mezzanotte.test.ts` | US1 1-9 ed edge case dello slot 0 (Fatto/Salta, cambio di priorità prima/dopo, persona creata alle 23:30/00:00:00/00:30, coda > 40, esito sconosciuto, `/oggi` dopo l'invio, occorrenza aperta al deploy) |
| `test/integration/v13-incomplete.test.ts` | US2 1-9, US3 1-4 ed edge case (vuoti/spazi, rubrica vuota, filtro a 0, menu vecchio, flusso guidato interrotto, estraneo ignorato, pulsanti malformati, parità "Nessun contatto" = "Senza contatti") |

### Copertura dei criteri Dato/Quando/Allora v1.3 (almeno un test ciascuno)

| Requisito | Criteri (spec) | Test |
|---|---|---|
| RF-10 | US1 1-7; edge Fatto/Salta sulle 00:00, cambio di priorità, idempotenza, slot perso, esito sconosciuto, coda, inserimento a mezzanotte, cambio d'ora, `/oggi` | `v13-mezzanotte`, `schedule`, `ciclo-idempotenza`, `ciclo-retry`, `ciclo-budget`, `us1-reminder` |
| §7 / SC-002 | Alta 3 + 5 + 1, Media 1 + 3 + 1, Bassa 0 + 2 + 1 | `v13-mezzanotte` |
| RNF-19 (00:00) | US1 8-9; SC-004 | `v13-mezzanotte`, `v11-stato`, `v11-buco-cron`, `stato`, `testi` |
| RF-50 | US2 1-9; edge argomenti, filtro a 0, vuoti/spazi, rubrica vuota, menu vecchio, persona eliminata, senza anno, senza gruppo, spezzatura | `v13-incomplete`, `incomplete`, `commands-parse` |
| RF-32 | US3 1-3; parità dei conteggi (SC-005) | `v13-incomplete`, `v12-statistiche` |
| RF-28 | US3 4; menu dei comandi | `us7-start-aiuto`, `menu-comandi` |
| RNF-14 | nuovo messaggio al tocco, messaggio dei pulsanti invariato, liste senza pulsanti, ≤ 2 pulsanti per vista, flusso guidato, estraneo | `v13-incomplete`, `v12-navigazione`, `viste-budget` |
| RNF-19 (📝) | icona sul pulsante e nelle intestazioni; filtri senza emoji | `testi`, `v11-stile` |

### Bench e smoke

- `npm run bench`: in `bench/ciclo.bench.ts` nuovo scenario "00:00, 200 Alta" (pianificazione,
  selezione, composizione); in `bench/liste.bench.ts` nuovo scenario "`/incomplete telefono`, 200
  persone" (filtro + ordinamento + rendering + divisione). Soglie dei file invariate.
- Postman: collection **2.6.0** (descrizione: feature 001–010), cartella "22 · Mezzanotte e profili
  incompleti v1.3" prima della pulizia (che diventa "23"), con `/incomplete`, `/incomplete Anno`, un
  tocco `s:i:<n>`, `/statistiche` e il tocco `s:i`, i malformati e l'estraneo di
  [quickstart.md](quickstart.md) §2; `postman/README.md` e `postman/seed-smoke.sql` aggiornati con
  persone a cui mancano dati diversi (incluso un valore di soli spazi).

## Project Structure

### Documentation (this feature)

```text
specs/010-revisioni-v1-3-mezzanotte-incompleti/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── callback-data.md # s:i e s:i:<1…5>
│   ├── viste-v13.md     # /incomplete, /statistiche, orari della mezzanotte
│   └── testi-v13.md     # testi nuovi e inventario
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── config.ts                 # slot 0 nel profilo Alta, SLOT_HOURS derivato
├── texts.ts                  # formatClock, testi di /incomplete, help, BOT_COMMANDS
├── domain/
│   ├── schedule.ts           # bordo dello slot 0 in admitted
│   └── incomplete.ts         # nuovo (puro)
├── db/
│   ├── incomplete.ts         # nuovo
│   └── statistiche.ts        # condizioni condivise
├── bot/
│   ├── incomplete.ts         # nuovo
│   ├── commands.ts           # /incomplete
│   ├── router.ts             # s:i
│   └── statistiche.ts        # pulsante in fondo
└── telegram/keyboard.ts      # solo commento del contratto

test/
├── unit/{incomplete.test.ts (nuovo), schedule, promemoria, stato, time, testi, callback-data, navigazione, statistiche, commands-parse}
└── integration/{v13-mezzanotte, v13-incomplete (nuovi), + 13 aggiornati}

bench/{ciclo.bench.ts, liste.bench.ts}
postman/bot-compleanni.postman_collection.json   # 2.6.0
```

**Structure Decision**: progetto singolo esistente; tre moduli nuovi per `/incomplete` (dominio puro,
letture D1, gestore), come le altre viste; il resto sono modifiche puntuali.

## Complexity Tracking

Nessuna violazione della constitution: tabella non necessaria.
