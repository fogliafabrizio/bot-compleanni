# Implementation Plan: Viste e ricerche

**Branch**: `003-viste-ricerche` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-viste-ricerche/spec.md`

## Summary

Aggiunge i comandi di consultazione `/oggi`, `/prossimi`, `/cerca`, `/gruppo`, `/mese`,
`/scaduti`, `/anno` (RF-16…RF-22) e il pulsante "Segna fatto" della scheda (BR-08). Tutte le
liste sono testuali nel formato di §5.7, senza pulsanti (RNF-14) e senza paginazione (RNF-16);
una lista che supera i 4096 caratteri di un messaggio Telegram viene divisa in più messaggi
consecutivi a righe intere. Le colonne di §5.7 sono allineate: data, nome ed età stanno in
un'entità `code` (monospazio), `/p_<id>` resta fuori ed è coperto da un'entità esplicita
`bot_command`, quindi toccabile.

Approccio: architettura e stack di 001/002 invariati (Worker TypeScript strict, D1, client Bot
API su `fetch`, dipendenze e `now` iniettati, nessuna dipendenza nuova, **nessuna migration**).
Ogni comando fa **una** batch D1 di lettura; filtro, ordinamento per prossimo compleanno,
rendering e divisione dei messaggi sono funzioni pure in TypeScript (~200 righe, < 1 ms).
`/oggi` riusa i render del reminder di 002 con pulsanti legati all'**occorrenza** (nuovo ambito
`t:`), così i messaggi non contano come slot. "Segna fatto" (`p:f:`) chiude in *fatto*
l'occorrenza della finestra oggi−7…ieri con un `UPDATE` condizionato. Dettagli in
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001/002)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`). Nessuna nuova dipendenza

**Storage**: D1 `birthday-bot-db`, schema invariato; scritture solo su `occurrences`
([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale, fake Telegram, `now` iniettato; benchmark
`vitest bench` in Node per le funzioni pure delle liste

**Target Platform**: Cloudflare Workers Free; webhook invariato; Cron invariato (non toccato)

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: risposta a ogni comando in una sola andata a D1 più gli invii

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); messaggio
Telegram ≤ 4096 caratteri; `callback_data` ≤ 64 byte; il webhook risponde dopo aver gestito
l'update, quindi niente pause tra gli invii

**Scale/Scope**: ~200 persone (RNF-16); 7 comandi nuovi, 3 pulsanti nuovi, 1 vista modificata
(scheda)

## Verifica dei limiti di piattaforma *(principio II)*

Questa feature non tocca ciclo orario, import, export o backup; la stima si dà comunque per i
nuovi comandi, perché `/oggi` e le liste lunghe inviano più messaggi.

**Subrequest per comando, 200 persone** (research R-08):

| Comando (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| `/prossimi 366`, `/gruppo` con tutti (200 righe, ≤ 45 per messaggio) | 2 (+1 con flusso) | 5–6 | ≤ 9 |
| `/mese` (tutte le 200 persone nello stesso mese) | 2 (+1) | ≤ 6 | ≤ 9 |
| `/cerca` con 1 risultato / con 200 | 3 / 2 (+1) | 1 / ≤ 6 | ≤ 9 |
| `/scaduti` (200 occorrenze nella finestra) | 2 (+1) | ≤ 6 | ≤ 9 |
| `/anno` (200 saltati + 200 in serie, righe da 110 caratteri) | 2 (+1) | ≤ 12 | ≤ 15 |
| `/oggi` con 200 compleanni oggi | 2 (+1) | 10 reminder + ≤ 5 lista | ≤ 18 |
| `/oggi` senza compleanni | 3 (+1) | 1 | ≤ 5 |
| `t:f`, `t:s` | 1 | 2 (edit + answer) | 3 |
| `p:f` | 3 (`getById` + `clear` del router + batch) | 2 (edit + answer) | 5 |
| `/p_<id>` (scheda, ora in batch) | 2 (+1) | 1 | ≤ 4 |

La colonna D1 include la lettura dello stato della conversazione fatta dal router (`getActive`)
per ogni messaggio di testo, più `clear` se c'è un flusso attivo ("+1"); i pulsanti `p:`
aggiungono `getById` e `clear` di `routeStatic`; i pulsanti `t:` (come `o:`) non leggono lo stato.
Il numero di chiamate D1 per comando è costante; i `sendMessage` crescono solo con il numero di
righe (≤ 45 per messaggio, limite prudenziale sulle entità, research R-05), con la lunghezza del
testo (~37 righe da 110 caratteri) e con il tetto `TODAY_MAX_MESSAGES = 10`. Massimo assoluto
**18 ≤ 50**.

**CPU**: lettura di ≤ 200 righe, `nextBirthday` (aritmetica su `Date.UTC`), un ordinamento,
concatenazione di stringhe, `normalize("NFD")` su ≤ 400 stringhe per `/cerca`: stima < 1 ms;
nessun `Intl` per persona (il `Collator` è di modulo e serve solo a pari data).

**Come si verifica**: test di integrazione con contatore D1/Telegram (`viste-budget.test.ts`,
valore esatto e ≤ 50); `vitest bench` di liste e ricerca su 200 persone con soglia 2 ms; dopo il
deploy, nessun `exceededCpu` nelle *Metrics*.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, Bot API; nessun servizio nuovo | ✅ |
| II | Limiti Free | Tabella precedente: una batch D1 per comando oltre alla lettura del router, massimo 18 subrequest; CPU < 1 ms stimata e misurata con bench; cron invariato | ✅ |
| III | Semplicità | Zero dipendenze, zero migration; riuso di `nextBirthday`, `effectiveDate`, `birthPairsFor`, `renderGiorno*`, `GROUP_NAMES_SQL`; ricerca in TS invece di una colonna nuova (R-09) | ✅ |
| IV | Sicurezza | Nuovi comandi e pulsanti dietro router esistente (token, whitelist, chat privata); `t:`/`p:f` validati dal decoder e da `UPDATE` condizionati | ✅ |
| V | Privacy | Nessun nuovo log con dati personali; i testi di ricerca non vengono loggati; risposte solo nella chat del proprietario | ✅ |
| VI | Tempo | `today = toLocal(deps.now())`; finestre e anni di riferimento calcolati con `addDays`/`daysBetween`; test 29/02, cavallo d'anno (`/prossimi` a dicembre, `/mese` di mesi passati, `/anno` con Y−1) | ✅ |
| VII | Affidabilità | I messaggi di `/oggi` non creano `deliveries` e non alterano l'idempotenza; `INSERT OR IGNORE` sull'indice unico delle occorrenze; esiti con `UPDATE … WHERE status` (nessuna corsa con il cron) | ✅ |
| VIII | Centralizzazione | `MESSAGE_MAX_LENGTH`, `LIST_MAX_LINES_PER_MESSAGE`, `LIST_NAME_COLUMN_MAX`, `TODAY_MAX_MESSAGES`, `UPCOMING_DEFAULT_DAYS`, `UPCOMING_MAX_DAYS` in `config.ts`; finestra = `OUTCOME_CORRECTION_DAYS` esistente; testi, giorni della settimana e mesi in `texts.ts` | ✅ |
| IX | Mono-proprietario | Nessuna tabella o unicità nuova | ✅ |
| X | Qualità e test | Ogni scenario della spec → test ([quickstart.md](quickstart.md) §2); niente orologio né rete reali | ✅ |
| XI | Tracciabilità | ID AFU in research, contratti e nomi dei test | ✅ |
| XII | Italiano | Testi e documenti in italiano | ✅ |

Vincoli V-01…V-07: nessun cron nuovo (V-01); CPU (V-02); nessun pulsante URL nuovo (V-04…V-06).

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/](contracts/). Nessuna violazione.

### Decisioni del proprietario (2026-10-28)

Scostamenti o interpretazioni dell'AFU (constitution, "Fonte di verità") segnalati in fase di
piano e approvati dal proprietario; registrati nei Chiarimenti della spec (FR-001a, FR-002,
FR-007a).

1. **Tetto di 10 messaggi in `/oggi` vs RF-16 "per ciascuno"**: oltre il decimo compleanno del
   giorno, le persone restanti arrivano in un unico messaggio lista con `/p_<id>`, senza i
   pulsanti del reminder. Serve a non mandare raffiche di messaggi in un webhook senza pause
   (R-06); con ~200 persone non scatta mai in pratica.
2. **Ordine delle viste storiche**: `/scaduti` e gli elenchi di `/anno` in ordine di data
   dell'occorrenza invece che "per prossimo compleanno" (R-03).
3. **Colonne allineate come in §5.7**: la parte "giorno, data, nome (età)[, esito]" di ogni
   riga è un'entità `code` riempita a una larghezza comune (tetto 20); `/p_<id>` resta fuori
   dal `code` con un'entità esplicita `bot_command`, quindi toccabile. Entità passate con
   `entities`, senza `parse_mode` (R-02); per via delle entità, al massimo 45 righe per messaggio,
   soglia prudenziale da verificare con il bot reale (task T016a, R-05).

### Scelte non fissate dalla spec (modificabili senza impatto sull'architettura)

Testi delle intestazioni e degli errori ([contracts/comandi.md](contracts/comandi.md)); posizione
di "Segna fatto" sopra Modifica/Elimina; ordine per nome dei messaggi di `/oggi`; l'intestazione
non si ripete nei messaggi di continuazione; `/oggi` crea l'occorrenza di oggi se manca (R-06);
`/aiuto` elenca i nuovi comandi.

## Project Structure

### Documentation (this feature)

```text
specs/003-viste-ricerche/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── comandi.md       # comandi, argomenti, risposte, errori, scheda, /aiuto
│   ├── liste.md         # formato della riga, struttura, divisione dei messaggi
│   └── callback-data.md # ambito t:, azione p:f
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Nuovi file marcati `+`, modificati `~`.

```text
src/
├── ~ config.ts              # MESSAGE_MAX_LENGTH, LIST_MAX_LINES_PER_MESSAGE, LIST_NAME_COLUMN_MAX,
│                            # TODAY_MAX_MESSAGES, UPCOMING_DEFAULT_DAYS, UPCOMING_MAX_DAYS
├── ~ texts.ts               # WEEKDAYS_IT, intestazioni, errori, etichette esito, "Segna fatto", /aiuto
├── domain/
│   ├── + viste.ts           # selezione e ordinamento: prossimi, mese (anno di rif.), cerca, finestra scaduti, args (puro)
│   └── ~ text.ts            # searchKey, compareNames
├── db/
│   ├── + viste.ts           # statement delle batch di lettura delle viste, /oggi, /anno
│   ├── + oggi.ts            # UPDATE per occorrenza + SELECT per ricomporre (t:f / t:s)
│   └── ~ persons.ts         # schedaStatements (persona, gruppi, storico, sospeso) e markDone (p:f)
├── bot/
│   ├── + liste.ts           # formatListLine (colonne + entità code), splitMessage, sendList
│   ├── + viste.ts           # handler /prossimi, /cerca, /gruppo, /mese, /scaduti, /anno
│   ├── + oggi.ts            # handler /oggi e callback t:f / t:s
│   ├── ~ promemoria.ts      # ReminderData: target dei pulsanti {scope "o"|"t", id} al posto di deliveryId
│   ├── ~ esiti.ts           # adattato al nuovo campo di ReminderData
│   ├── ~ scheda.ts          # una batch; riga "Segna fatto"; handler p:f con editMessageText
│   ├── ~ commands.ts        # ParsedCommand.args; 7 comandi nuovi
│   └── ~ router.ts          # ramo t: accanto a o:; STATIC_CALLBACKS "p:f"
├── cron/hourly.ts           # invariato (adatta solo la costruzione di ReminderData)
└── telegram/
    ├── ~ keyboard.ts        # scope "t" nel tipo Callback e nel decoder
    ├── ~ types.ts           # MessageEntity { type: "code"; offset; length }
    └── ~ client.ts          # sendMessage(chatId, text, keyboard?, entities?)

test/
├── helpers/~ db.ts              # seed di occorrenze con stato e data
├── helpers/~ fake-telegram.ts   # registra entities di sendMessage
├── unit/+ liste.test.ts, + viste-parse.test.ts, ~ callback-data.test.ts, ~ commands-parse.test.ts, ~ scheda.test.ts
└── integration/
    ├── + us1-oggi … + us6-anno
    ├── + viste-budget.test.ts
    └── ~ us3-scheda.test.ts, ~ us7-start-aiuto.test.ts

bench/
└── + liste.bench.ts             # 200 persone: ordinamento + render + split; /cerca
```

**Structure Decision**: struttura di 001/002 invariata (`domain/` puro, `db/` SQL, `telegram/`
trasporto, `bot/` interazione). Le parti pure delle viste (`domain/viste.ts`, `bot/liste.ts`) non
importano `cloudflare:*`, così il benchmark gira in Node come quello del ciclo.

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
