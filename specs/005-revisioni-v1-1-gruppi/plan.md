# Implementation Plan: Revisioni v1.1 — Gruppi

**Branch**: `005-revisioni-v1-1-gruppi` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-revisioni-v1-1-gruppi/spec.md`

## Summary

Revisione delle funzioni dei gruppi già rilasciate (REV-003, REV-004 dell'AFU v1.1): `/gruppi`
senza argomento diventa un elenco a pulsanti, `/gruppi <testo>` (alias `/gruppo`) cerca il gruppo
per parte del nome ignorando maiuscole, accenti ed emoji e apre la **scheda gruppo**, da cui
partono Rinomina ed Elimina; il filtro gruppo di `/prossimi` usa la stessa ricerca (RF-07, RF-17,
RF-19, BR-26, RNF-14, V-09).

Approccio: architettura e stack di 001–004 invariati, **nessuna dipendenza nuova, nessuna
migration, nessuna conversione dei dati**.

- **Chiave BR-26**: `groupKey` pura in `src/domain/text.ts`, costruita su `searchKey` di `/cerca`
  (che resta invariata) + keycap e non alfanumerici a spazio; `hasValidGroupKey` (≥ 2 caratteri,
  FR-006a). Calcolata al momento, mai salvata; `name_norm` resta per l'unicità BR-17.
- **Ricerca**: `findGroups` pura (esatta vince, più esatte → scelta, chiave vuota = nessun testo)
  e `sortGroups` per chiave; una sola batch D1 (gruppi con conteggi + appartenenze).
- **Pulsanti**: nuovo ambito versionato `g2:<azione>[:<id>:<hash del nome>[:<giorni>]]`, ≤ 32 byte;
  l'hash FNV-1a del nome esatto rende inerte un pulsante dopo eliminazione o rinomina (FR-005); i
  vecchi `g:*` e lo step `scelta` spariscono → "Questa azione non è più disponibile" (FR-017).
- **Scheda gruppo**: liste di 003 (`formatRows`, `splitMessage`) con [✏️ Rinomina] [🗑 Elimina]
  sull'ultimo messaggio; `sendList` accetta una tastiera finale opzionale.
- **Flusso `gruppi`**: step `crea`, `rinomina`, `elimina` avviati dalla scheda con id e nome già
  noti; scritture `… WHERE id = ? AND name = ?` + guardia di flusso, in batch.
- **Menu**: `BOT_COMMANDS` in `src/texts.ts`, `setMyCommands` nel client, sincronizzazione
  idempotente dal cron con hash in `settings.bot_commands`.

Dettagli in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001–004)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`). Regex Unicode (`\p{L}`, `\p{Nd}`, `\p{M}`) e
`String.prototype.normalize` dal runtime

**Storage**: D1 `birthday-bot-db`, schema invariato; nuova riga `settings.bot_commands`; flusso
`gruppi` con step rinominati ([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale e fake Telegram (esteso con `setMyCommands`),
`now` e `scheduledTime` iniettati; `vitest bench` in Node per le parti pure

**Target Platform**: Cloudflare Workers Free; webhook e Cron Trigger (`0 * * * *`) invariati,
handler `scheduled` esteso con un passo isolato

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: ricerca gruppo, scheda di 200 persone ed elenco di 100 gruppi ≤ 3 ms di CPU
misurati (≤ 10 ms di limite); una batch D1 di lettura per comando o tocco

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); ≤ 100 pulsanti per
tastiera (V-09 → 60 gruppi); `callback_data` ≤ 64 byte; messaggi ≤ 4096 caratteri

**Scale/Scope**: ~200 persone (RNF-16), decine di gruppi (fino a qualche centinaio per l'elenco
testuale); 1 comando rivisto (`/gruppi` + alias), 1 vista nuova (scheda gruppo), 1 filtro rivisto
(`/prossimi`), 1 passo cron nuovo (menu)

## Moduli toccati

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/domain/text.ts` | + `groupKey`, `hasValidGroupKey`, `nameHash`; `searchKey` e `normKey` invariate | BR-26, FR-006, FR-006a, FR-005 |
| `src/domain/viste.ts` | + `findGroups`, `sortGroups`; `parseUpcomingArgs` invariato nella regola (test FR-011a) | FR-007, FR-011, FR-011a |
| `src/config.ts` | + `GROUP_BUTTONS_MAX = 60`, `GROUP_KEY_MIN_LENGTH = 2` | V-09, FR-006a |
| `src/texts.ts` | testi di elenco, scelta, scheda, "non esiste più", regola della chiave, motivo dell'import; `/aiuto` con `/gruppi [nome]` senza `/gruppo`; + `BOT_COMMANDS`; rimossi `askGroupToRename`, `askGroupToDelete`, `groupUsage`, `groupHeader`, `existingGroups` se non più usati | RF-07, RF-19, §5.1, §5.9 |
| `src/telegram/keyboard.ts` | + variante `{ kind: "group", action, groupId?, nameHash?, days? }` con prefisso `g2`; `g` esce da `Callback` e dal decoder | FR-005, FR-017 |
| `src/telegram/client.ts` (+ `types.ts`) | + `setMyCommands(commands)` | FR-014 |
| `src/bot/gruppi.ts` *(nuovo)* | `showGroups` (spostata da `flows/gruppi.ts`), `renderGroupList`, `showGroupCard`, `openGroupCard`, `searchGroups` (per `/gruppi <testo>`), `replyGroupGone`; solo viste, nessun import da `src/bot/flows/*` | RF-07, RF-19, FR-001…FR-010, FR-013 |
| `src/bot/flows/gruppi.ts` | step `crea`, `rinomina`, `elimina`; rimosso `scelta`; `startRinomina(groupId, name)`, `startElimina…(groupId, name)`; dopo rinomina scheda, dopo eliminazione elenco; + `handleGroupCallback` (`g2:*`), che importa le viste da `bot/gruppi.ts` e `bot/viste.ts` | FR-009, FR-010, FR-006a, FR-017 |
| `src/bot/flows/steps.ts` | + `validateGroupName` (cleanText + chiave); usata da `newGroupStep` | FR-006a |
| `src/bot/viste.ts` | `showProssimi` con `findGroups` e scelta `g2:p`; rimossi `showGruppo`, `lookupGroup`, `replyGroupNotFound`; + `showProssimiForGroup(ctx, groupId, hash, days)` per il tocco | RF-17, FR-011 |
| `src/bot/liste.ts` | `sendList(ctx, header, lines, keyboard?)`: tastiera sull'ultimo messaggio | FR-008 |
| `src/db/groups.ts` | rinomina/eliminazione guardate anche su `name`; + statement della batch post-rinomina e post-eliminazione | FR-005, FR-009, FR-010 |
| `src/db/viste.ts` | + `groupSearchStatements` [gruppi con conteggi, appartenenze con colonne di lista]; + `groupCardStatements(id)` [gruppo, persone]; rimosso `groupLookupStatements` (per `name_norm`) | RF-17, RF-19, R-07 |
| `src/bot/commands.ts` | `gruppi` e `gruppo` → stesso handler (`searchGroups` o `showGroups` secondo `args`) | RF-19, FR-014 |
| `src/bot/router.ts` | ramo `kind === "group"` → `handleGroupCallback` (con `clear` come i pulsanti senza stato); rimossi `g:n`, `g:r`, `g:x` da `STATIC_CALLBACKS` | FR-005, FR-017 |
| `src/domain/import.ts` (+ `src/bot/import.ts` se serve il testo) | gruppo da creare con chiave < 2 → riga non valida; `domain/backup.ts` **invariato** | FR-006a, 004 FR-006, FR-016 |
| `src/cron/scheduled.ts` + `src/cron/comandi.ts` *(nuovo)* + `src/db/settings.ts` | passo `syncBotCommands` isolato, saltato se il ciclo ha reclamato invii o il backup mensile ha inviato | FR-014, principio II |
| `test/helpers/fake-telegram.ts` | `setMyCommands` registrato tra le chiamate | — |
| `postman/*` | collection 2.1.0, seed con due gruppi nuovi, README (Changelog) | research R-13 |

## Verifica dei limiti di piattaforma *(principio II)*

La feature tocca il ciclo orario (passo del menu) e non tocca import/export/backup oltre a una
regola di validazione. Stime nel caso peggiore (research R-07, R-10).

**Subrequest**

| Invocazione (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| `/gruppi` (anche > 60 gruppi, elenco diviso in 2 messaggi) | 2 (`getActive`, lettura) | ≤ 2 | ≤ 4 |
| `/gruppi <testo>` con scheda di 200 persone (5 messaggi), flusso precedente annullato | 3 (`getActive`, `clear`, **una batch**) | 5 | 8 |
| `/prossimi 366 <testo>` con 200 persone | 3 | 5 | 8 |
| Tocco `g2:o` / `g2:p` con 200 persone | 3 (`getActive`, `clear`, batch) | 5 + 1 answer | 9 |
| Tocco su gruppo non più esistente | 4 | 1 + 1 | 6 |
| Rinomina: risposta con nome valido, scheda di 200 persone | 3 (`getActive`, controllo, **batch di scrittura + rilettura**) | 5 | 8 |
| Elimina: Sì | 2 (`getActive`, **batch di scrittura + elenco**) | 1 + 1 | 4 |
| Cron con 40 invii + backup mensile | 3 + 4 come in 004 (passo menu **saltato**) | 40 + 1 | ≤ 48 |
| Cron senza invii, menu cambiato | 3 + 1 (reclamo backup a vuoto) + 2 (lettura e scrittura hash) | 1 (`setMyCommands`) | 7 |
| Cron senza invii, menu invariato | 3 + 1 + 1 | 0 | 5 |

Massimo assoluto invariato rispetto a 004 per il cron (il passo del menu non si aggiunge mai al
caso con invii); webhook ≤ 9.

**CPU** (stima): `groupKey` su 100 nomi ≤ 0,1 ms; `findGroups` + filtro delle appartenenze (≤ 600
righe) + `sortByNextBirthday` + `formatRows` di 200 righe ~1 ms, come le liste di 003; elenco di
100 gruppi < 0,2 ms; `nameHash` trascurabile.

**Come si verifica**: `budget.test.ts`, `viste-budget.test.ts`, `ciclo-budget.test.ts` con
contatore D1/Telegram (valori esatti e ≤ 50); `bench/liste.bench.ts` con i casi "ricerca gruppo
200 persone / 100 gruppi" e "scheda 200 persone", soglia 3 ms.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, un Cron, Bot API (`setMyCommands` è un metodo della Bot API) | ✅ |
| II | Limiti Free | Tabella precedente: webhook ≤ 9, cron ≤ 48; **una** batch D1 di lettura per comando/tocco, scritture di rinomina ed eliminazione in **una** `D1.batch` con la rilettura; nessun Cron nuovo; CPU misurata con bench | ✅ |
| III | Semplicità | Zero dipendenze, zero migration, zero tabelle; riuso di `searchKey`, `compareNames`, `cleanText`, motore dei flussi, `formatRows`, `splitMessage`, `sortByNextBirthday`, `existsNorm`; nessuna funzione oltre l'AFU v1.1 (RF-52 escluso) | ✅ |
| IV | Sicurezza | Tocchi `g2` dietro il router esistente (token, whitelist, chat privata); Elimina con conferma (RNF-05); scritture guardate dal flusso e dal nome; `callback_data` senza testo dell'utente | ✅ |
| V | Privacy | Nessun log nuovo con nomi di gruppo o persone; il cron del menu logga solo `error_code` | ✅ |
| VI | Tempo | Scheda e `/prossimi` con `toLocal(deps.now())` come in 003; nessuna nuova logica di data | ✅ |
| VII | Affidabilità | Il passo del menu è isolato con proprio `try/catch` in `runScheduled`, dopo promemoria e backup: un suo guasto non li blocca; non tocca occorrenze né invii | ✅ |
| VIII | Centralizzazione | Testi e `BOT_COMMANDS` in `src/texts.ts`; `GROUP_BUTTONS_MAX`, `GROUP_KEY_MIN_LENGTH` in `config.ts`; `groupKey` unica funzione della chiave, usata da ricerca, ordinamento, validazione e import | ✅ |
| IX | Mono-proprietario | Nessuna unicità nuova; `bot_commands` è una riga di `settings` come `auto_backup` | ✅ |
| X | Qualità e test | Un test per ogni criterio Dato/Quando/Allora v1.1 di RF-07, RF-17, RF-19 ([quickstart.md](quickstart.md) §3); unitari di BR-26 sui casi emoji/accenti/spazi; test MVP aggiornati e ancora verdi | ✅ |
| XI | Tracciabilità | ID AFU in research, contratti, quickstart e nomi dei test (`RF-19, BR-26: …`) | ✅ |
| XII | Italiano | Testi, pulsanti, menu e documenti in italiano | ✅ |

Vincoli: V-01 (nessun Cron nuovo), V-02 (CPU), V-09 (≤ 60 pulsanti di gruppo, + Nuovo gruppo =
61 ≤ 100).

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/](contracts/). Nessuna violazione, tabella di complessità vuota.

### Scelte di piano confermate dal proprietario (2026-10-29)

Precisano punti che la spec non fissava; ora sono registrate nei chiarimenti della spec:

1. **Conferma nello stesso messaggio**: dopo la rinomina, `Gruppo rinominato in <nome>` è la prima
   riga del messaggio della scheda aggiornata (e `Gruppo <nome> eliminato` la prima dell'elenco),
   come fa oggi `showGroups(ctx, prefix)`. Alternativa: due messaggi separati (+1 subrequest).
2. **Menu sincronizzato dal cron** (research R-10): oggi il progetto non registra il menu; FR-014
   chiede che sia aggiornato al rilascio. Il menu cambia entro un'ora dal deploy, al primo cron
   senza invii.
3. **FR-006a non si applica al ripristino da backup** (research R-11): il backup riporta dati già
   esistenti, che FR-016 lascia invariati.
4. **Flussi `gruppi` aperti al momento del rilascio** (compresa una creazione in corso): non
   trovano più lo step e vanno ripresi da `/gruppi` (research R-05). Effetto di FR-017.
5. **Ricerca in una sola andata a D1**: si leggono tutte le appartenenze anche quando l'esito è una
   scelta tra più gruppi (research R-07).

## Dati in produzione *(FR-015, FR-016, FR-017)*

- **Migration**: non serve. La chiave BR-26 si calcola al momento; `name_norm` resta la colonna
  dell'unicità BR-17 con il suo indice; nessuna colonna, tabella o indice nuovi.
- **Conversioni**: nessuna. Nomi dei gruppi (emoji, accenti, maiuscole), `name_norm` e
  appartenenze restano identici (SC-006). Gruppi con chiave < 2 restano, sono nell'elenco e si
  rinominano solo con un nome conforme.
- **Messaggi già inviati**: non vengono modificati; i loro pulsanti (`g:*`, `f:…:sg`, step
  `conferma`) rispondono "Questa azione non è più disponibile".
- **Deploy**: `scripts/deploy.ps1` invariato (la fase migration non trova nulla da applicare).

## Test

**Da aggiornare** (dettaglio in [quickstart.md](quickstart.md) §4):

- `test/integration/us6-gruppi.test.ts` — US6 di 001: elenco a pulsanti, Rinomina ed Elimina dalla
  scheda, FR-018c → FR-005/FR-017;
- `test/integration/us5-gruppo-mese.test.ts` — sezione `/gruppo` di 003: scheda gruppo, elenco al
  posto della sintassi, inesistente con elenco a pulsanti;
- `test/integration/us2-prossimi.test.ts` — test di `/prossimi` con gruppo (FR-010 di 003):
  gruppo inesistente con elenco a pulsanti, più i casi v1.1;
- `test/integration/us7-start-aiuto.test.ts`, `test/integration/budget.test.ts`,
  `test/unit/callback-data.test.ts`.

**Nuovi**:

- unitari: `groupKey` / `hasValidGroupKey` / `nameHash` (casi emoji, ZWJ, colori della pelle,
  bandiere, keycap, accenti NFC/NFD, spazi e punteggiatura — research R-02), `findGroups`,
  `sortGroups`, `parseUpcomingArgs` (FR-011a), `g2` nel `callback_data`, import con chiave corta;
- integrazione: `test/integration/v11-gruppi-ricerca.test.ts` (US1 di 005), casi US2 in
  `us6-gruppi.test.ts`, casi US3 in `us2-prossimi.test.ts`, `test/integration/menu-comandi.test.ts`
  (cron e `setMyCommands`), casi limite della spec. Un test per ogni criterio Dato/Quando/Allora
  v1.1 di RF-07, RF-17, RF-19, con l'ID nel titolo.

**Postman**: sì, la collection di smoke va aggiornata perché tocca `/gruppo` (cartella 06), `/gruppi`
(16), `/prossimi` con gruppo (04) e `/aiuto` (02): versione 2.1.0, `nameHash` nello script di
collection, seed con "👨‍👩‍👧 Smoke Casa" e "Smoke Casa Rossi" (research R-13).

## Project Structure

### Documentation (this feature)

```text
specs/005-revisioni-v1-1-gruppi/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── callback-data.md # ambito g2, pulsanti rimossi
│   └── gruppi.md        # /gruppi [nome], scheda, /prossimi, /aiuto e menu, import
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, non creato qui)
```

### Source Code (repository root)

```text
src/
├── config.ts                 # + GROUP_BUTTONS_MAX, GROUP_KEY_MIN_LENGTH
├── texts.ts                  # testi gruppi v1.1, /aiuto, BOT_COMMANDS
├── domain/
│   ├── text.ts               # + groupKey, hasValidGroupKey, nameHash
│   ├── viste.ts              # + findGroups, sortGroups
│   └── import.ts             # FR-006a sui gruppi da creare
├── db/
│   ├── groups.ts             # scritture guardate anche sul nome
│   ├── viste.ts              # + groupSearchStatements, groupCardStatements
│   └── settings.ts           # + chiave bot_commands
├── telegram/
│   ├── keyboard.ts           # ambito g2, via g
│   ├── client.ts             # + setMyCommands
│   └── types.ts
├── bot/
│   ├── gruppi.ts             # NUOVO: elenco, scheda, ricerca (solo viste)
│   ├── flows/gruppi.ts       # step crea / rinomina / elimina; tocchi g2
│   ├── flows/steps.ts        # + validateGroupName
│   ├── viste.ts              # /prossimi con findGroups; via showGruppo
│   ├── liste.ts              # sendList con tastiera finale
│   ├── commands.ts           # gruppi = gruppo
│   └── router.ts             # ramo g2; via g:*
└── cron/
    ├── scheduled.ts          # + passo syncBotCommands
    └── comandi.ts            # NUOVO: syncBotCommands

test/
├── unit/                     # text, viste-parse, callback-data, import
├── integration/              # us6-gruppi, us5-gruppo-mese, us2-prossimi, us7-start-aiuto,
│                             # budget, viste-budget, ciclo-budget, v11-gruppi-ricerca (nuovo),
│                             # menu-comandi (nuovo)
└── helpers/fake-telegram.ts  # + setMyCommands

bench/liste.bench.ts          # + ricerca gruppo e scheda
postman/                      # collection 2.1.0, seed-smoke.sql, README
```

**Structure Decision**: progetto singolo esistente; un modulo di vista nuovo
(`src/bot/gruppi.ts`) per separare le viste dei gruppi dal flusso guidato ed evitare import
circolari (research R-09), un modulo cron nuovo per il menu.

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
