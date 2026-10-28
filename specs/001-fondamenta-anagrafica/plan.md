# Implementation Plan: Fondamenta e anagrafica

**Branch**: `001-fondamenta-anagrafica` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-fondamenta-anagrafica/spec.md`

## Summary

Prima feature del bot: posa le fondamenta tecniche (Worker Cloudflare in TypeScript strict,
webhook Telegram protetto da token segreto e whitelist, schema D1 completo di AFU §8, Cron
Trigger orario con handler vuoto) e implementa l'anagrafica: inserimento guidato (RF-01, RF-02),
scheda (RF-03), modifica per campo (RF-04), eliminazione (RF-05), annullamento e scadenza dei
flussi (RF-06, A-04), gruppi (RF-07, RF-08), `/start`, `/aiuto`, `/id` (RF-28, RF-29) e
controllo d'accesso (RF-30, RNF-02, RNF-03).

Approccio: client Bot API minimale su `fetch`, router senza framework, stato conversazione in
D1 con `flow_id` nei `callback_data` per invalidare i pulsanti vecchi, validazioni come
funzioni pure riusabili dall'import futuro, dipendenze (D1, Telegram, `now`) iniettate per
test deterministici con Vitest nel pool workers. Dettagli e alternative in
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (ultima stabile), `strict` + `noUncheckedIndexedAccess`;
target ES2022 sul runtime Cloudflare Workers (`workerd`)

**Primary Dependencies**: nessuna di runtime. Sviluppo: `wrangler`, `typescript`, `vitest`,
`@cloudflare/vitest-pool-workers` (giustificate in research R-02)

**Storage**: Cloudflare D1 `birthday-bot-db`, binding `DB`, migration SQL in `migrations/`
(`0001_schema_iniziale.sql` con tutte le tabelle di AFU §8); `database_id: "REPLACE_ME"` in
`wrangler.jsonc`, sostituito da `scripts/setup-bot.ps1`

**Testing**: Vitest + `@cloudflare/vitest-pool-workers`, D1 locale con migration applicate in
setup, Telegram simulato con un fake iniettato, `now` iniettato

**Target Platform**: Cloudflare Workers, piano Free; webhook `POST /webhook`; Cron Trigger
`0 * * * *` (UTC) con handler `scheduled` vuoto

**Project Type**: web-service (bot Telegram via webhook), progetto singolo

**Performance Goals**: risposta a ogni update entro pochi ms di CPU; nessun requisito di
throughput (utente unico)

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); `callback_data`
≤ 64 byte; nessun servizio esterno (RNF-01, RNF-07); nessun dato personale nei log (RNF-08)

**Scale/Scope**: 100–200 persone (RNF-16), decine di gruppi, un solo proprietario

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, un Cron, Bot API. Niente KV/DO/Queues/R2, niente servizi esterni | ✅ |
| II | Limiti Free | Budget per update in [contracts/webhook.md](contracts/webhook.md): ≤ ~9 subrequest, ~1–2 ms CPU nel caso peggiore; scritture multiple con `D1.batch` (R-11); un solo Cron. Ciclo orario, import, export, backup fuori perimetro: la stima è richiesta nelle rispettive feature | ✅ |
| III | Semplicità | TS strict; client su `fetch`, nessun framework; zero dipendenze di runtime; dev deps giustificate (R-02); nessuna funzione oltre la spec | ✅ |
| IV | Sicurezza | Token segreto verificato per primo, a tempo costante (R-03); whitelist su ID numerico, eccezione solo `/id`, estranei ignorati senza alcuna chiamata (R-04); secret solo in `wrangler secret`/`.dev.vars`, test con valori fittizi; conferma per eliminazione persona e gruppo | ✅ |
| V | Privacy | Log solo con codici (R-15); testo semplice verso Telegram; dati serviti solo in chat privata del proprietario | ✅ |
| VI | Tempo | `src/time.ts` unico punto di conversione Europe/Rome; `now` iniettato, `new Date()` solo in `src/index.ts` (R-06, R-07); test 29/02 per validazione e scheda. Cavallo d'anno e cambio d'ora: test sul calcolo dei giorni mancanti (es. 28/12 → 02/01; date attorno a fine marzo/fine ottobre) | ✅ |
| VII | Affidabilità invii | Nessun invio programmato in questa feature; lo schema già garantisce l'idempotenza a livello DB (`UNIQUE(occurrence_id, kind, ref)`) | ✅ |
| VIII | Centralizzazione | `src/texts.ts` (tutti i testi); `src/config.ts` (fuso, slot, profili, prefisso +39, messaggio default A-06, limiti, TTL 24 h). La migration non duplica il messaggio default (R-13) | ✅ |
| IX | Mono-proprietario, pronto per multi-utente | Stato per `chat_id`; unicità come indici sostituibili; `settings` chiave-valore documentata; nessuna funzione multi-utente | ✅ |
| X | Qualità e test | Vitest + pool workers; ogni scenario della spec → almeno un test; nessun orologio o rete reale | ✅ |
| XI | Tracciabilità | ID AFU in spec, piano, contratti; test che citano l'ID | ✅ |
| XII | Italiano | Testi utente e documenti in italiano | ✅ |

Vincoli AFU V-01…V-07: rispettati (un cron; testo semplice con numero cliccabile; nessun
pulsante `tel:`/`sms:` in questa feature).

**Re-check post Phase 1**: confermato ✅ su tutti i principi dopo la stesura di
[data-model.md](data-model.md) e [contracts/](contracts/). Nessuna deviazione da giustificare.

### Conflitto AFU segnalato e risolto

- **RF-08 vs RF-06** — RF-08: "il gruppo viene creato e risulta già selezionato"; RF-06:
  Annulla "interrompe senza salvare nulla". Decisione del proprietario (spec, chiarimento
  2026-10-28): il gruppo appare creato e selezionato, ma viene scritto in D1 solo con il
  salvataggio finale (research R-12).

### Scelte non fissate dalla spec (modificabili senza impatto sull'architettura)

Formulazioni e dettagli di presentazione elencati in research R-08 e R-16: giorno/mese a una
cifra accettati (`4/3/1994`), telefono mostrato in E.164 nella scheda, "oggi"/"domani" nella
scheda, risposta a `/annulla` senza flusso, messaggio generico di errore interno, proprietario
servito solo in chat privata (R-04).

## Project Structure

### Documentation (this feature)

```text
specs/001-fondamenta-anagrafica/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── webhook.md       # HTTP, Env, chiamate Bot API, budget
│   ├── comandi.md       # comandi, scheda, /gruppi
│   ├── flussi.md        # flussi guidati step per step
│   └── callback-data.md # formato callback_data ≤ 64 byte
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
wrangler.jsonc               # Worker, D1 "birthday-bot-db" (DB, REPLACE_ME), cron "0 * * * *"
package.json                 # script: dev, test, typecheck, types
tsconfig.json                # strict
vitest.config.ts             # pool workers, migration D1, binding di test fittizi
.dev.vars.example            # nomi dei secret, valori vuoti
worker-configuration.d.ts    # generato da `wrangler types`

migrations/
└── 0001_schema_iniziale.sql # tutte le tabelle di AFU §8

src/
├── index.ts                 # fetch + scheduled (vuoto); costruisce Deps; unico new Date()
├── config.ts                # fuso, slot, profili, prefisso +39, messaggio default, limiti, TTL
├── texts.ts                 # tutti i testi del bot (RNF-15)
├── time.ts                  # conversione Europe/Rome, differenze in giorni di calendario
├── log.ts                   # log solo con codici (principio V)
├── deps.ts                  # tipo Deps { db, tg, now, ownerId }
├── telegram/
│   ├── types.ts             # sottoinsieme di Update, Message, CallbackQuery
│   ├── client.ts            # TelegramApi su fetch: sendMessage, editMessageReplyMarkup, answerCallbackQuery
│   └── keyboard.ts          # costruzione tastiere, encode/decode callback_data
├── bot/
│   ├── webhook.ts           # handleRequest: route, token segreto, parsing update
│   ├── router.ts            # /id, whitelist, comandi vs flussi vs callback
│   ├── commands.ts          # /start, /aiuto, /p_<id>, /gruppi, /annulla, fallback
│   ├── scheda.ts            # render scheda (§5.6) e riepilogo
│   └── flows/
│       ├── engine.ts        # stato, flow_id, scadenza, step a testo/pulsanti
│       ├── nuovo.ts
│       ├── modifica.ts
│       ├── elimina.ts
│       └── gruppi.ts
├── domain/
│   ├── date.ts              # RF-02, BR-01, BR-02, prossimo compleanno, 29/02
│   ├── phone.ts             # BR-15
│   ├── username.ts          # BR-16
│   └── text.ts              # trim, limiti, chiave normalizzata (BR-14, BR-17)
└── db/
    ├── persons.ts
    ├── groups.ts
    └── conversation.ts

test/
├── setup.ts                 # applyD1Migrations
├── env.d.ts                 # tipi di cloudflare:test
├── helpers/                 # fake Telegram, builder di update, now fisso
├── unit/                    # domain, time, scheda, callback-data
└── integration/             # un file per user story (US1…US7) + scadenza e pulsanti vecchi
```

**Structure Decision**: progetto singolo alla radice del repository (già contenente
`scripts/setup-bot.ps1` e `scripts/deploy.ps1`, che si aspettano `wrangler.jsonc` alla radice e
il nome DB `birthday-bot-db`). Separazione per responsabilità: `domain/` puro e testabile,
`db/` per le query D1, `telegram/` per il trasporto, `bot/` per l'interazione. Le tabelle per le
feature successive esistono già, i moduli `db/` corrispondenti arriveranno con quelle feature.

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
