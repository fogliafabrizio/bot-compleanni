---

description: "Task list per la feature 001 — Fondamenta e anagrafica"
---

# Tasks: Fondamenta e anagrafica

**Input**: documenti di progetto in `specs/001-fondamenta-anagrafica/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (webhook.md, comandi.md, flussi.md, callback-data.md), quickstart.md

**Tests**: OBBLIGATORI. La constitution (principio X) e SC-001 chiedono almeno un test per ogni
RF e per ogni criterio Dato/Quando/Allora. Ogni `describe`/`it` MUST citare l'ID AFU verificato
(principio XI), es. `it("RF-02: rifiuta 31/04", …)`. I test di ogni story si scrivono per primi
e devono fallire prima dell'implementazione.

**Organization**: task raggruppati per user story (US1…US7 della spec), in ordine di priorità.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1…US7)

## Convenzioni valide per tutti i task

- Progetto singolo alla radice: `src/`, `test/`, `migrations/` (vedi plan.md, Project Structure).
- Nessuna funzione di dominio chiama `new Date()` o `Date.now()`: il tempo arriva da
  `deps.now()`. Unica eccezione: `src/index.ts` (research R-06).
- Ogni testo rivolto all'utente sta in `src/texts.ts` (RNF-15); ogni costante di
  configurazione in `src/config.ts` (principio VIII). Nessun'altra stringa italiana nel codice.
- Log solo tramite `src/log.ts`, con codici e numeri, mai dati personali (principio V).
- Messaggi inviati in testo semplice, senza `parse_mode` (research R-05).
- I task che modificano `src/texts.ts`, `src/bot/commands.ts` o `src/bot/router.ts` non sono
  [P] tra loro.
- I test usano il fake Telegram e il `now` fisso di `test/helpers/` (nessuna rete, nessun orologio reale).
  Salvo diversa indicazione, `now` = `2026-10-28T10:00:00.000Z` (28/10/2026, 11:00 a Roma).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inizializzazione del progetto Worker, test e configurazione

- [ ] T001 Creare `package.json` alla radice: `"name": "bot-compleanni"`, `"private": true`, `"type": "module"`; script `"dev": "wrangler dev"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"types": "wrangler types"`; **nessuna** voce in `dependencies`; `devDependencies`: `wrangler`, `typescript`, `vitest` (versione supportata da `@cloudflare/vitest-pool-workers`), `@cloudflare/vitest-pool-workers` (giustificazione in research R-02). Eseguire `npm install` per generare `package-lock.json`
- [ ] T002 [P] Creare `wrangler.jsonc` alla radice: `"$schema": "node_modules/wrangler/config-schema.json"`, `"name": "bot-compleanni"`, `"main": "src/index.ts"`, `"compatibility_date"` = data odierna supportata dal workerd installato, nessun `compatibility_flags`; `"d1_databases": [{ "binding": "DB", "database_name": "birthday-bot-db", "database_id": "REPLACE_ME", "migrations_dir": "migrations" }]`; `"triggers": { "crons": ["0 * * * *"] }`. Nessun secret nel file (RNF-04). Commento che `REPLACE_ME` è sostituito da `scripts/setup-bot.ps1`
- [ ] T003 [P] Creare `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"target": "ES2022"`, `"module": "ES2022"`, `"moduleResolution": "Bundler"`, `"lib": ["ES2022"]`, `"noEmit": true`, `"isolatedModules": true`, `types` con `./worker-configuration.d.ts` e `@cloudflare/vitest-pool-workers`; `include`: `src/**/*.ts`, `test/**/*.ts`, `worker-configuration.d.ts`
- [ ] T004 [P] Creare `.dev.vars.example` con le sole chiavi vuote `TELEGRAM_BOT_TOKEN=`, `OWNER_TELEGRAM_ID=`, `WEBHOOK_SECRET=`; verificare che `.gitignore` contenga già `.dev.vars` (presente) e non toccarlo
- [ ] T005 Eseguire `npm run types` per generare `worker-configuration.d.ts` (dipende da T001, T002) e creare `src/env.ts` con `export interface Env { DB: D1Database; TELEGRAM_BOT_TOKEN: string; OWNER_TELEGRAM_ID: string; WEBHOOK_SECRET: string }`, così l'interfaccia non dipende dalla presenza di `.dev.vars` in locale
- [ ] T006 Creare `vitest.config.ts` con l'API di configurazione della versione installata di `@cloudflare/vitest-pool-workers` (es. `defineWorkersConfig` da `@cloudflare/vitest-pool-workers/config`): `wrangler.configPath: "./wrangler.jsonc"`; migration lette con `readD1Migrations(path.join(__dirname, "migrations"))` e passate come binding `TEST_MIGRATIONS`; binding di test **fittizi** `OWNER_TELEGRAM_ID: "1001"`, `WEBHOOK_SECRET: "test-secret"`, `TELEGRAM_BOT_TOKEN: "test-token"`; `setupFiles: ["./test/setup.ts"]`; storage isolato per test se offerto dalla versione installata
- [ ] T007 Creare `test/setup.ts` che esegue `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` (da `cloudflare:test`) e `test/env.d.ts` che dichiara i binding di test (`DB`, `TEST_MIGRATIONS: D1Migration[]`, i tre secret fittizi) per il modulo `cloudflare:test`. Se lo storage isolato non è disponibile, aggiungere in `test/setup.ts` un `beforeEach` che svuota tutte le tabelle

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, configurazione centralizzata, tempo, client Telegram, motore dei flussi e router

**⚠️ CRITICAL**: nessuna user story può iniziare prima della fine di questa fase

- [ ] T008 Creare `migrations/0001_schema_iniziale.sql` con **tutte** le tabelle di data-model.md (nessun `INSERT` di dati: in particolare **non** inserire il messaggio di default, research R-13). Testualmente:
  - `persons`: `id INTEGER PRIMARY KEY AUTOINCREMENT`; `full_name TEXT NOT NULL`; `full_name_norm TEXT NOT NULL`; `nickname TEXT NULL`; `birth_day INTEGER NOT NULL CHECK (birth_day BETWEEN 1 AND 31)`; `birth_month INTEGER NOT NULL CHECK (birth_month BETWEEN 1 AND 12)`; `birth_year INTEGER NULL CHECK (birth_year >= 1900)`; `phone TEXT NULL CHECK (phone GLOB '+[0-9]*')`; `instagram TEXT NULL`; `telegram TEXT NULL`; `priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','bassa'))`; `custom_message TEXT NULL`; `created_at TEXT NOT NULL`; `updated_at TEXT NOT NULL`; indice **non unico** `idx_persons_dup ON persons(full_name_norm, birth_day, birth_month)`
  - `groups`: `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL`; `name_norm TEXT NOT NULL`; `CREATE UNIQUE INDEX ux_groups_name_norm ON groups(name_norm)`
  - `person_groups`: `person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE`; `group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE`; `PRIMARY KEY (person_id, group_id)`; indice `idx_person_groups_group ON person_groups(group_id)`
  - `occurrences`: `id INTEGER PRIMARY KEY AUTOINCREMENT`; `person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE`; `year INTEGER NOT NULL`; `effective_date TEXT NOT NULL`; `status TEXT NOT NULL DEFAULT 'aperta' CHECK (status IN ('aperta','fatto','saltato','non_confermato'))`; `outcome_at TEXT NULL`; `created_at TEXT NOT NULL`; `CREATE UNIQUE INDEX ux_occurrences_person_year ON occurrences(person_id, year)`; indice `idx_occurrences_date ON occurrences(effective_date)`
  - `deliveries`: `id INTEGER PRIMARY KEY AUTOINCREMENT`; `occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE`; `kind TEXT NOT NULL CHECK (kind IN ('pre','giorno','recupero'))`; `ref INTEGER NOT NULL`; `status TEXT NOT NULL CHECK (status IN ('in_invio','inviato','fallito','abbandonato'))`; `attempts INTEGER NOT NULL DEFAULT 0`; `local_date TEXT NOT NULL`; `sent_at TEXT NULL`; `telegram_message_id INTEGER NULL`; `last_error_code INTEGER NULL`; `CREATE UNIQUE INDEX ux_deliveries_unique ON deliveries(occurrence_id, kind, ref)`
  - `settings`: `key TEXT PRIMARY KEY`; `value TEXT NOT NULL`; `updated_at TEXT NOT NULL` (chiave documentata: `default_message`; tabella vuota)
  - `conversation_state`: `chat_id INTEGER PRIMARY KEY`; `flow TEXT NOT NULL` (nessun CHECK: i valori sono validati da `src/db/conversation.ts`, così i flussi delle feature successive non richiedono migration); `step TEXT NOT NULL`; `flow_id TEXT NOT NULL`; `data TEXT NOT NULL DEFAULT '{}'`; `expires_at TEXT NOT NULL`; `updated_at TEXT NOT NULL`
  - commento in testa al file con il riferimento ad AFU §8 e la nota che le unicità sono indici sostituibili per un futuro multi-utente (principio IX)
- [ ] T009 [P] Scrivere `test/integration/schema.test.ts` (AFU §8, N-02, BR-06, BR-17): dopo le migration esistono le 7 tabelle; inserire due gruppi con lo stesso `name_norm` fallisce; due occorrenze con stessa `(person_id, year)` falliscono; due invii con stessa `(occurrence_id, kind, ref)` falliscono; `settings` è vuota
- [ ] T010 [P] Creare `src/config.ts` (principio VIII, RNF-18) con costanti esportate e tipizzate: `TIMEZONE = "Europe/Rome"`; `SLOT_HOURS = [9, 13, 18, 21] as const`; `PRE_REMINDER_HOUR = 13`; `RECOVERY_HOUR = 13`; `PRIORITY_PROFILES` = `{ alta: { preReminderDays: [7, 2, 1], slots: [9, 13, 18, 21] }, media: { preReminderDays: [1], slots: [9, 13, 18] }, bassa: { preReminderDays: [], slots: [9, 18] } }`; `type Priority = "alta" | "media" | "bassa"`; `DEFAULT_PRIORITY: Priority = "media"`; `PHONE_DEFAULT_PREFIX = "+39"`; `DEFAULT_BIRTHDAY_MESSAGE = "Tanti auguri {nome}! 🎉"` (A-06); `MIN_BIRTH_YEAR = 1900`; `TEXT_LIMITS = { fullName: 60, nickname: 60, groupName: 30, customMessage: 500 }`; `CONVERSATION_TTL_HOURS = 24` (A-04); `FLOW_ID_LENGTH = 6`
- [ ] T011 [P] Creare `src/texts.ts` (RNF-15) come unico oggetto esportato `T` (stringhe e funzioni che restituiscono stringhe) con i testi comuni: `actionUnavailable: "Questa azione non è più disponibile"`, `personNotFound: "Persona non trovata"`, `notUnderstood: "Non ho capito. Scrivi /aiuto per l'elenco dei comandi"`, `cancelled: "Operazione annullata"`, `nothingToCancel: "Nessuna operazione da annullare"`, `genericError: "Si è verificato un errore, riprova"`, etichette pulsanti `btnCancel: "Annulla"`, `btnSkip: "Salta"`, `btnYes: "Sì"`, `btnFix: "Correggi"`, `btnDone: "Fine"`, `btnClear: "Svuota"`, e `MONTHS_IT` (`gennaio` … `dicembre`). Le story successive aggiungono qui i propri testi
- [ ] T012 [P] Scrivere `test/unit/time.test.ts` (principio VI, BR-24): `toLocal` di `2026-10-28T10:00:00Z` → 28/10/2026 ore 11; `2026-07-01T22:30:00Z` → 02/07/2026 ore 0 (ora legale); `2026-03-29T00:59:00Z` → ore 1 e `2026-03-29T01:00:00Z` → ore 3 (cambio d'ora); `2026-10-25T00:30:00Z` → ore 2 e `2026-10-25T01:30:00Z` → ore 2; `daysBetween` 28/12/2026 → 02/01/2027 = 5; 28/10/2026 → 14/03/2027 = 137; 28/03/2026 → 30/03/2026 = 2 (a cavallo del cambio d'ora); `isLeapYear` 2024 sì, 2026 no, 1900 no, 2000 sì
- [ ] T013 [P] Implementare `src/time.ts` (unico punto di conversione del fuso, research R-07): `toLocal(now: Date): { year; month; day; hour }` con un `Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hourCycle: "h23", … })` creato una volta a livello di modulo e `formatToParts`; `type LocalDate = { year; month; day }`; `daysBetween(a: LocalDate, b: LocalDate)` con `Date.UTC` su date di calendario; `isLeapYear(year)`; `addHours(now: Date, h)`; `toIso(now: Date)` (ISO UTC con millisecondi)
- [ ] T014 [P] Creare `src/log.ts`: `log(code: string, extra?: Record<string, number | boolean>)` che scrive `console.log(JSON.stringify({ code, ...extra }))`; il tipo di `extra` impedisce stringhe libere (principio V, RNF-08)
- [ ] T015 [P] Creare `src/telegram/types.ts` con il sottoinsieme tipizzato usato: `Update { update_id; message?; callback_query? }`, `Message { message_id; from?: User; chat: Chat; text? }`, `User { id: number; username? }`, `Chat { id: number; type: "private" | "group" | "supergroup" | "channel" }`, `CallbackQuery { id; from: User; message?: Message; data? }`, `InlineKeyboardButton { text; callback_data }`, `InlineKeyboardMarkup { inline_keyboard: InlineKeyboardButton[][] }`
- [ ] T016 [P] Scrivere `test/unit/telegram-client.test.ts` (research R-05): con un `fetch` fittizio verifica URL `https://api.telegram.org/bot<token>/sendMessage`, metodo POST, body JSON senza `parse_mode`; `ok: false` con `error_code: 400` → eccezione che espone solo `errorCode`; stessi controlli per `editMessageReplyMarkup` e `answerCallbackQuery`
- [ ] T017 Implementare `src/telegram/client.ts`: interfaccia `TelegramApi { sendMessage(chatId: number, text: string, keyboard?: InlineKeyboardMarkup): Promise<{ message_id: number }>; editMessageReplyMarkup(chatId: number, messageId: number, keyboard: InlineKeyboardMarkup): Promise<void>; answerCallbackQuery(id: string, text?: string): Promise<void> }` e `createTelegramApi(token: string, fetchFn: typeof fetch = fetch)`; errori → `TelegramError` con il solo `errorCode` (dipende da T015)
- [ ] T018 [P] Scrivere `test/unit/callback-data.test.ts` (research R-10, contracts/callback-data.md): round-trip encode/decode di `s:n`, `s:h`, `p:m:123`, `p:x:123`, `g:n`, `g:r`, `g:x`, `f:k3x9q2:pr:m`, `f:k3x9q2:t:4821`, `f:k3x9q2:t:n0`, `f:k3x9q2:e:p`; decode di stringhe malformate (`""`, `x:y`, `p:m:abc`, `f:TOOLONG7:a`) → `null`; `encode` lancia se il risultato supera 64 byte UTF-8
- [ ] T019 [P] Implementare `src/telegram/keyboard.ts`: tipi `Callback` (unione discriminata: `{ kind: "static", scope: "s" | "p" | "g", action: string, id?: number }` e `{ kind: "flow", flowId: string, action: string, arg?: string }`), `encodeCallback`, `decodeCallback` (formato di contracts/callback-data.md, `flowId` = `[0-9a-z]{6}`), `button(text, cb)`, `keyboard(rows)`; `encodeCallback` lancia se `new TextEncoder().encode(s).length > 64`
- [ ] T020 [P] Scrivere `test/unit/text.test.ts` (FR-010a, BR-14, BR-17): `cleanText("  Marco Rossi  ", 60)` → `"Marco Rossi"`; `"   "` → errore `empty`; 61 caratteri → errore `too_long` con `max: 60`; 60 emoji → valido (lunghezza in code point); `normKey("  Àlba ROSSI ")` → `"àlba rossi"`
- [ ] T021 [P] Implementare `src/domain/text.ts`: `cleanText(input: string, max: number): { ok: true; value: string } | { ok: false; reason: "empty" | "too_long"; max: number }` (trim, lunghezza `[...s].length`); `normKey(s)` = `s.trim().toLocaleLowerCase("it-IT")`
- [ ] T022 Creare `src/deps.ts`: `interface Deps { db: D1Database; tg: TelegramApi; now: () => Date; ownerId: string }` (dipende da T017)
- [ ] T023 Scrivere `test/unit/conversation.test.ts` (A-04, FR-018a): `start` crea una riga con `flow_id` di 6 caratteri `[0-9a-z]` e `expires_at` = now + 24 h; `getActive` a now + 23h59m restituisce lo stato; a now + 24h esatte restituisce `null` e cancella la riga; `update` rinnova `expires_at`; `start` su una chat con flusso attivo lo sostituisce con un nuovo `flow_id`; `clear` cancella; `guardStatement(chatId, flowId)` cancella solo se il `flow_id` coincide
- [ ] T024 Implementare `src/db/conversation.ts` (research R-09): `type ConversationState { chatId; flow: "nuovo" | "modifica" | "elimina" | "gruppi"; step: string; flowId: string; data: unknown; expiresAt: string }`; `getActive(db, chatId, now)` (riga con `expires_at <= toIso(now)` o con `flow` non tra i valori ammessi → cancellata e `null`); `start(db, chatId, flow, step, data, now)` con `flowId` generato da `crypto.getRandomValues` in base36 lunghezza `FLOW_ID_LENGTH`, `INSERT … ON CONFLICT(chat_id) DO UPDATE`; `update(db, state, now)` che rinnova `expires_at = now + CONVERSATION_TTL_HOURS`; `clear(db, chatId)`; `consumeStatement(db, chatId, flowId)` = `DELETE FROM conversation_state WHERE chat_id = ? AND flow_id = ?` da usare dentro `D1.batch` (research R-11); `flowGuardSql` = frammento `EXISTS (SELECT 1 FROM conversation_state WHERE chat_id = ? AND flow_id = ?)` per condizionare le scritture (dipende da T008, T013)
- [ ] T025 Creare gli helper di test in `test/helpers/`: `constants.ts` (`OWNER_ID = 1001`, `STRANGER_ID = 2002`, `SECRET = "test-secret"`, `NOW = new Date("2026-10-28T10:00:00.000Z")`); `fake-telegram.ts` (implementa `TelegramApi`, registra ogni chiamata in `calls[]`, `message_id` incrementale, helper `lastText()`, `lastKeyboard()`, `callbackAnswers()`); `updates.ts` (`textUpdate(fromId, text, chatType = "private")`, `callbackUpdate(fromId, data, messageId = 1)`, `webhookRequest(update, secret = SECRET)` → `Request` POST `/webhook` con header `X-Telegram-Bot-Api-Secret-Token`); `deps.ts` (`makeDeps({ now? })` con `env.DB`, fake Telegram, `ownerId: "1001"`, `now` modificabile; wrapper che conta `prepare`/`batch` su D1 per i controlli di budget); `send.ts` (`send(deps, update)` che chiama `handleRequest` e restituisce la `Response`)
- [ ] T026 Implementare `src/bot/webhook.ts`: `handleRequest(request: Request, deps: Deps, webhookSecret: string): Promise<Response>`; path ≠ `/webhook` → `404`; metodo ≠ `POST` → `405`; (il controllo del token è aggiunto in US1, T032); body non JSON → `400`; altrimenti `await route(update, deps)` in `try/catch`: in errore `log("handler_error")`, tentativo best effort di `T.genericError` **solo se** l'update proviene dal proprietario (`String(from.id) === deps.ownerId`) in chat privata, per chiunque altro nessuna risposta (RF-30, principio IV), e comunque `200` (contracts/webhook.md)
- [ ] T027 Implementare `src/bot/commands.ts` con `parseCommand(text: string): { name: string; personId?: number } | null`: testo con trim iniziale che inizia con `/`; primo token; suffisso `@NomeBot` rimosso; nome in minuscolo; `^/p_(\d+)$` → `{ name: "p", personId }`; e un registro `COMMANDS: Record<string, (ctx) => Promise<void>>` popolato dalle story. Scrivere `test/unit/commands-parse.test.ts` (`/id`, `/ID@BotCompleanni_bot`, `/p_12`, `/p_12@Bot`, `/p_x` → `{ name: "p_x" }`, `ciao` → `null`)
- [ ] T028 Implementare `src/bot/flows/engine.ts` (contracts/flussi.md, regole comuni): tipo `Step = { kind: "text" | "buttons"; prompt(state, deps) → Promise<{ text: string; keyboard?: InlineKeyboardMarkup }>; onText?(text, state, ctx); onCallback?(action, arg, state, ctx) }`; tipo `FlowDef = { name; steps: Record<string, Step> }`; registro dei flussi; `startFlow(ctx, flow, step, data)` (sostituisce qualunque flusso attivo, invia il prompt); `goTo(ctx, state, step, data)` (aggiorna stato e scadenza, invia il prompt); `handleFlowText(ctx, state, text)` — step `buttons` → reinvia il prompt dello step con i suoi pulsanti (FR-018b), step `text` → `onText`; `handleFlowCallback(ctx, cb)` — se non c'è flusso attivo, `flowId` diverso o azione non prevista dallo step corrente → `answerCallbackQuery(T.actionUnavailable)` senza effetti (FR-018c); altrimenti `answerCallbackQuery()` e `onCallback`; azione `a` (Annulla) gestita in modo uniforme: `clear` + `T.cancelled` (RF-06); helper `cancelSilently(ctx)` per l'annullamento causato da un altro comando
- [ ] T029 Implementare `src/bot/router.ts` con `route(update, deps)` e il contesto `Ctx { deps; chatId; fromId }`: (gli step di US1 per `/id` e whitelist si aggiungono in T033); messaggio di testo del proprietario → se `parseCommand` restituisce un comando: se `COMMANDS[name]` esiste, annulla in silenzio l'eventuale flusso attivo (FR-018, tranne `/annulla` che ha risposta propria) ed esegue il comando; se il comando non esiste → `T.notUnderstood` e, con un flusso attivo, **non** lo annulla e reinvia il prompt dello step corrente (FR-018, chiarimento 2026-10-28); testo non comando → con flusso attivo `handleFlowText`, senza flusso `T.notUnderstood` (FR-025a); messaggio senza testo → come testo non valido; `callback_query` → `decodeCallback`: `null` → `answerCallbackQuery(T.actionUnavailable)`; `kind: "flow"` → `handleFlowCallback`; `kind: "static"` → registro `STATIC_CALLBACKS` popolato dalle story (chiave sconosciuta → `T.actionUnavailable`)
- [ ] T030 Implementare `src/index.ts`: `export default { fetch(request, env: Env) { return handleRequest(request, makeDeps(env), env.WEBHOOK_SECRET) }, async scheduled() { /* vuoto: verrà riempito dalla feature promemoria */ } } satisfies ExportedHandler<Env>`; `makeDeps(env)` con `createTelegramApi(env.TELEGRAM_BOT_TOKEN)`, `now: () => new Date()` (unico punto del codice che legge l'orologio), `ownerId: env.OWNER_TELEGRAM_ID.trim()`
- [ ] T031 [P] Scrivere `test/integration/scheduled.test.ts`: chiamare l'handler `scheduled` di `src/index.ts` con un controller fittizio per il cron `0 * * * *`; nessun errore e nessuna riga scritta in alcuna tabella

**Checkpoint**: `npm run typecheck` senza errori e test della fase verdi; si può iniziare con le user story

---

## Phase 3: User Story 1 - Accesso riservato al proprietario (Priority: P1) 🎯 MVP

**Goal**: solo il proprietario usa il bot; `/id` per tutti; richieste senza token segreto scartate

**Independent Test**: `/id` e un altro comando da un utente estraneo, una richiesta senza token segreto; verificare risposte e assenza di salvataggi

### Tests for User Story 1 ⚠️

- [ ] T032 [P] [US1] Scrivere `test/integration/us1-accesso.test.ts`:
  - RNF-03: richiesta senza header → `401` con corpo vuoto; header errato con update che contiene `from.id = OWNER_ID` → `401`; in entrambi i casi fake Telegram senza chiamate e `conversation_state`/`persons` vuote; `GET /webhook` → `405`; `POST /altro` → `404`
  - RF-29: `/id` da `STRANGER_ID` → un `sendMessage` alla sua chat contenente `2002`; `/id` dal proprietario → contiene `1001`; `/id@BotCompleanni_bot` funziona
  - RF-30, RNF-02, SC-002: da `STRANGER_ID` `/start`, `/nuovo`, `/gruppi`, `/p_1`, `ciao` e un callback `s:n` → risposta `200`, zero chiamate a Telegram (nemmeno `answerCallbackQuery`), nessuna riga in nessuna tabella
  - Edge case: con un flusso del proprietario attivo (riga inserita in `conversation_state`), un messaggio di `STRANGER_ID` non modifica né cancella quella riga
  - R-04: il proprietario scrive `/start` in una chat di tipo `group` → nessuna chiamata a Telegram
  - RNF-02, principio IV: errore interno forzato (es. `deps.db` che lancia) su un update di `STRANGER_ID` → nessuna chiamata a Telegram; lo stesso errore su un update del proprietario → un solo `sendMessage` con `Si è verificato un errore, riprova`; in entrambi i casi risposta `200`

### Implementation for User Story 1

- [ ] T033 [US1] In `src/bot/webhook.ts` aggiungere la verifica del token (RNF-03, research R-03) **prima** di leggere il body: header `X-Telegram-Bot-Api-Secret-Token` assente o con lunghezza diversa → `401`; altrimenti confronto con `crypto.subtle.timingSafeEqual` sui byte UTF-8 di header e `webhookSecret`; diverso → `401` senza corpo
- [ ] T034 [US1] In `src/texts.ts` aggiungere `yourId: (id: number) => \`Il tuo ID Telegram è ${id}\``; in `src/bot/router.ts`, prima di ogni altra logica: (1) se il messaggio ha testo e `parseCommand(text)?.name === "id"` → `sendMessage(chat.id, T.yourId(from.id))` per chiunque, in qualsiasi chat (RF-29), e se il mittente è il proprietario annulla in silenzio il flusso attivo (FR-018); (2) se `String(from.id) !== deps.ownerId` → return senza alcuna chiamata (RF-30, RNF-02); (3) se la chat non è `private` → return (R-04)

**Checkpoint**: US1 verde; il Worker è sicuro da esporre

---

## Phase 4: User Story 2 - Inserimento guidato di una persona (Priority: P1)

**Goal**: `/nuovo` guida campo per campo fino a riepilogo e salvataggio (AFU §5.2)

**Independent Test**: eseguire `/nuovo` seguendo §5.2 e verificare la persona salvata e la scheda inviata

### Tests for User Story 2 ⚠️

- [ ] T035 [P] [US2] Scrivere `test/unit/date.test.ts` (RF-02, BR-01, BR-02, A-07) con `today = { year: 2026, month: 10, day: 28 }`: validi `14/03/1994`, `4/3/1994` (= 04/03/1994), ` 14/03/1994 `, `29/02` (anno null), `29/02/1996`, `01/01/1900`, `25/12/2026`; rifiutati `31/04`, `14-3-94`, `14/3/94`, `29/02/1995`, `31/12/1899`, `01/01/2027`, `00/01`, `32/01`, `12/13`, `14/03/94a`, `""`; `formatLong` → `"14 marzo 1994"` e `"29 febbraio"`; `formatShort` → `"14/03/1994"` e `"29/02"`; `nextBirthday` per 14/03 da 28/10/2026 → anno 2027, 137 giorni; per 28/10 → 0 giorni anno 2026; per 29/02 da 28/10/2026 → data effettiva 28/02/2027 (BR-04) e 123 giorni; per 02/01 da 28/12/2026 → anno 2027, 5 giorni
- [ ] T036 [P] [US2] Scrivere `test/unit/phone.test.ts` (BR-15, FR-009): `333 1234567` → `+393331234567`; `333.123.4567` → `+393331234567`; `+39 333-1234567` → `+393331234567`; `0041 79 123 45 67` → `+41791234567`; `1234567` → `+391234567` (9 cifre dopo il `+`, valido); rifiutati `333abc4567`, `+1234567` (7 cifre), `+1234567890123456` (16 cifre → rifiutato), `++39333`, `""`
- [ ] T037 [P] [US2] Scrivere `test/unit/username.test.ts` (BR-16): `@marco.rossi` → `marco.rossi`; `  mrossi ` → `mrossi`; `@` → errore `empty`; `""` → errore
- [ ] T038 [P] [US2] Scrivere `test/unit/scheda.test.ts` (RF-03, FR-011…FR-013, AFU §5.6) per `renderScheda(person, groups, outcomes, today)`: persona completa (Marco Rossi, "Marchino", 14/03/1994, alta, gruppi `Lavoro`, `Beach tennis`, phone `+393331234567`, IG `marco.rossi`, TG `mrossi`, nessun messaggio) con today 28/10/2026 → righe esatte `Marco Rossi — "Marchino"`, `14/03/1994 · compie 33 anni tra 137 giorni`, `Priorità: alta · Gruppi: Beach tennis, Lavoro`, `📱 +393331234567 · IG @marco.rossi · TG @mrossi`, `Messaggio: standard`, nessuna riga `Storico`; senza anno → `14/03 · compleanno tra 137 giorni` (età assente, FR-012); compleanno oggi → `compie N anni oggi`, domani → `domani`; senza nickname, gruppi e contatti → parti omesse; messaggio personalizzato → `Messaggio: "…"`; con outcomes `[{year: 2025, status: "fatto"}, {year: 2024, status: "saltato"}]` → riga `Storico: 2025 fatto · 2024 saltato`
- [ ] T039 [US2] Scrivere `test/integration/us2-inserimento.test.ts` (usa gli helper di T025; ogni passo è un update inviato con `send`):
  - RF-01 / §5.2: `/nuovo` → `Nome completo?` con `[Annulla]`; `Marco Rossi` → domanda nickname con `[Salta]`; `Marchino` → domanda data con il formato; `14/03/1994` → `14 marzo 1994, giusto?` con `[Sì] [Correggi]`; Sì → telefono con `[Salta]`; Salta su Instagram e Telegram; step Gruppi; step Priorità con `Media ✓`; Salta messaggio; riepilogo con `[Salva] [Annulla]`; Salva → riga in `persons` con `priority = 'media'`, `full_name_norm = 'marco rossi'`, `created_at = updated_at = NOW`, e ultimo messaggio = scheda con `[Modifica] [Elimina]` (FR-003)
  - RF-01 scenario 1, FR-002: solo campi obbligatori (Salta su tutti i campi opzionali, alla Priorità si preme il pulsante preselezionato `Media ✓`) → salvata con `media`; lo step Priorità non ha `Salta`; inserendo direttamente in D1 una persona senza `priority` la colonna vale `media` (DEFAULT dello schema)
  - RF-02: `31/04` e `14-3-94` → messaggio di errore con il formato atteso, step invariato; `29/02/1995` rifiutata; `29/02` accettata; `1899` e `2027` rifiutati (BR-02); Correggi → richiede di nuovo la data
  - BR-15/BR-16: telefono `333 1234567` salvato `+393331234567`; telefono `abc` → errore con l'esempio e domanda ripetuta; Instagram `@marco.rossi` salvato `marco.rossi`
  - FR-010a: nome di soli spazi → rifiutato; nome di 61 caratteri → messaggio con il massimo 60 e domanda ripetuta; messaggio di 501 caratteri rifiutato
  - RF-08: con gruppi esistenti `Famiglia`, `Lavoro`: toggle `Lavoro` → `editMessageReplyMarkup` con `☑ Lavoro`; `➕ Nuovo gruppo` → testo `Beach tennis` → tastiera con `☑ Beach tennis`; prima di Salva la tabella `groups` contiene ancora 2 righe; dopo Salva 3 righe e la persona appartiene a `Lavoro` e `Beach tennis`; nuovo gruppo `famiglia` → rifiutato (BR-17); `Beach tennis` due volte nello stesso flusso → rifiutato
  - BR-14: con `marco rossi` 14/03/1994 già presente, Salva di `Marco Rossi` 14/03/1994 → avviso di possibile duplicato con `[Salva comunque] [Annulla]`; Salva comunque → 2 righe; nuovo tentativo e Annulla → nessuna riga aggiunta; stesso nome con data `14/03` senza anno → avviso (anno assente in una delle due date, chiarimento 2026-10-28); con `Anna Verdi` `14/03` già presente, `anna verdi` `14/03/1990` → avviso; stesso nome con `14/03/1995` → nessun avviso
  - RF-06: `/annulla` a metà → `Operazione annullata`, nessuna riga in `persons`/`groups`, `conversation_state` vuota; Annulla sul riepilogo → idem; Annulla dopo aver creato un nuovo gruppo nel flusso → `groups` invariata (research R-12); `/annulla` senza flusso → `Nessuna operazione da annullare`
  - FR-018: a metà di `/nuovo`, `/id` → risposta con l'ID, flusso cancellato, nessuna riga salvata; il messaggio successivo `Marco` → `Non ho capito…`
  - FR-018 (comando inesistente): allo step nickname, `/annula` → `Non ho capito…` e di nuovo la domanda del nickname; `conversation_state` invariata (stesso `flow_id`); il messaggio successivo `Marchino` viene accettato come nickname
  - RF-08, FR-023: in modifica (Gruppi) e in inserimento, un gruppo creato e poi abbandonato per scadenza (24 h) → `groups` invariata
  - FR-018b: allo step Priorità il testo `alta` → reinvio della domanda Priorità con i suoi pulsanti, nessun cambio di step
  - A-04, FR-018a: avvio `/nuovo`, nome inviato; `now` + 24 h → testo `14/03/1994` → `Non ho capito…`, nessuna risposta sul flusso scaduto, `conversation_state` vuota; con `now` + 23 h 59 m il flusso prosegue
  - FR-018c: dopo Annulla, il vecchio pulsante `Salva` (stesso `flow_id`) → `answerCallbackQuery` con `Questa azione non è più disponibile`, nessuna riga; pulsante di uno step precedente (es. `Sì` della data quando si è allo step telefono) → stessa risposta
  - R-11: due callback `Salva` consecutivi con lo stesso `flow_id` → una sola riga in `persons`; il secondo riceve `Questa azione non è più disponibile`
  - R-10: ogni `callback_data` di ogni tastiera inviata nel test ≤ 64 byte

### Implementation for User Story 2

- [ ] T040 [P] [US2] Implementare `src/domain/date.ts` (RF-02, BR-01, BR-02, BR-04, research R-08): `parseBirthDate(input: string, today: LocalDate): { ok: true; day; month; year: number | null } | { ok: false }` con regex `^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$` dopo trim, giorno valido per il mese (febbraio 29 senza anno, 29 con anno solo se `isLeapYear`), anno in `MIN_BIRTH_YEAR..today.year`; `formatLong({ day, month, year })` con `MONTHS_IT` di `src/texts.ts`; `formatShort` (`dd/mm[/yyyy]`); `effectiveDate(day, month, year)` (29/02 → 28/02 negli anni non bisestili); `nextBirthday(day, month, today): { year; date: LocalDate; daysUntil }` usando `daysBetween` di `src/time.ts`
- [ ] T041 [P] [US2] Implementare `src/domain/phone.ts` (BR-15, FR-009): `normalizePhone(input): { ok: true; value } | { ok: false }` — rimuove spazi, `.` e `-`; `00` iniziale → `+`; senza `+` antepone `PHONE_DEFAULT_PREFIX`; valido solo se `^\+\d{8,15}$`
- [ ] T042 [P] [US2] Implementare `src/domain/username.ts` (BR-16): `normalizeUsername(input): { ok: true; value } | { ok: false }` — trim, rimozione di un `@` iniziale, vuoto rifiutato
- [ ] T043 [P] [US2] Implementare `src/db/persons.ts` (data-model.md, persons): tipo `Person` (camelCase delle colonne); `rowToPerson`; `getById(db, id)`; `findDuplicate(db, { fullNameNorm, day, month, year }, excludeId?)` con `full_name_norm = ? AND birth_day = ? AND birth_month = ? AND (birth_year IS NULL OR ?4 IS NULL OR birth_year = ?4)` (BR-14, chiarimento 2026-10-28: l'anno conta solo se presente in entrambe le date); `insertGuardedStatements(db, chatId, flowId, input, pendingGroupNames, selectedGroupIds, nowIso)` che restituisce gli statement per una `D1.batch`: (1) `INSERT INTO groups (name, name_norm) SELECT ?, ? WHERE <flowGuardSql>` per ogni gruppo in attesa, (2) `INSERT INTO persons (…) SELECT … WHERE <flowGuardSql>`, (3) `INSERT INTO person_groups` per i gruppi selezionati e per quelli in attesa (ricavati per `name_norm`) con `person_id` della persona appena inserita (ad es. `(SELECT MAX(id) FROM persons)` all'interno della stessa transazione), sempre con `<flowGuardSql>`, (4) `consumeStatement` (research R-11); `getGroupNames(db, personId)` ordinati alfabeticamente; `getOutcomes(db, personId)` = occorrenze con `status IN ('fatto','saltato','non_confermato')` ordinate per anno decrescente
- [ ] T044 [P] [US2] Implementare in `src/db/groups.ts` le funzioni usate dallo step Gruppi: `listAll(db)` ordinata per `name` (collazione case-insensitive), `existsNorm(db, nameNorm, excludeId?)` (BR-17)
- [ ] T045 [US2] Implementare `src/bot/scheda.ts`: `renderScheda(person, groupNames, outcomes, today): string` secondo contracts/comandi.md e research R-16 (riga Storico solo se `outcomes.length > 0`, FR-013; età solo con anno, FR-012); `schedaKeyboard(personId)` = `[Modifica] (p:m:<id>) [Elimina] (p:x:<id>)`; `renderRiepilogo(draft, groupNames, today)` = stesso testo senza riga Storico; `showScheda(ctx, personId)` che legge persona, gruppi ed esiti e invia testo + tastiera, oppure `T.personNotFound`. Testi (etichette `Priorità`, `Gruppi`, `Messaggio`, `standard`, `compie … anni tra … giorni`, `oggi`, `domani`, `compleanno tra …`, `Storico`, esiti `fatto`/`saltato`/`non confermato`, `Modifica`, `Elimina`) in `src/texts.ts`
- [ ] T046 [US2] Implementare in `src/bot/flows/steps.ts` gli step riusabili da `nuovo` e `modifica`: validazione testi (`cleanText` con `TEXT_LIMITS`, messaggio `T.tooLong(max)` / `T.emptyValue` + ripetizione della domanda), data + conferma `[Sì] [Correggi]`, telefono, username, step Gruppi (tastiera `☐/☑ <nome>` per gruppi esistenti `t:<id>` e in attesa `t:n<indice>`, `[➕ Nuovo gruppo] (ng)`, `[Fine] (d)`; toggle aggiorna `data` e chiama `editMessageReplyMarkup` sul messaggio del callback) e sotto-step `gruppo_nuovo` (`cleanText` max 30, `normKey` confrontato con `existsNorm` e con i gruppi in attesa → `T.groupExists`; valido → aggiunto a `pendingGroups` già selezionato e ritorno allo step Gruppi, RF-08, research R-12), Priorità `[Alta] [Media] [Bassa]` con `✓` sul valore corrente
- [ ] T047 [US2] Implementare `src/bot/flows/nuovo.ts` (contracts/flussi.md, flusso `nuovo`, step 1–12) registrandolo nel motore: dati parziali tipizzati `NuovoData`; Salta (`k`) sui campi opzionali; riepilogo `[Salva] (s) [Annulla] (a)`; su Salva: `findDuplicate` → se trovato passa allo step `duplicato` con `T.possibleDuplicate(nome, data)` e `[Salva comunque] (sd) [Annulla]`; altrimenti (o con `sd`) esegue `db.batch(insertGuardedStatements(…))`; se l'insert della persona ha `meta.changes === 0` → `answerCallbackQuery(T.actionUnavailable)` e nessun messaggio (R-11); altrimenti `showScheda` della nuova persona (FR-003)
- [ ] T048 [US2] Registrare in `src/bot/commands.ts` i comandi `nuovo` (avvia il flusso `nuovo`) e `annulla` (con flusso attivo `clear` + `T.cancelled`, senza flusso `T.nothingToCancel`, RF-06) e aggiungere a `src/texts.ts` tutti i testi del flusso: `askFullName: "Nome completo?"`, `askNickname: "Nickname? (come lo chiami nei messaggi)"`, `askBirthDate: "Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno"`, `confirmDate: (s) => \`${s}, giusto?\``, `invalidDate` (con il formato atteso), `askPhone: "Telefono? (con prefisso, es. +39 333 1234567)"`, `invalidPhone` (con lo stesso esempio), `askInstagram: "Username Instagram?"`, `askTelegram: "Username Telegram?"`, `askGroups: "Gruppi?"`, `btnNewGroup: "➕ Nuovo gruppo"`, `askNewGroupName`, `groupExists`, `askPriority: "Priorità?"`, `btnHigh: "Alta"`, `btnMedium: "Media"`, `btnLow: "Bassa"`, `askMessage: "Messaggio di auguri personalizzato? Se salti uso quello standard."`, `summaryTitle: "Riepilogo:"`, `btnSave: "Salva"`, `btnSaveAnyway: "Salva comunque"`, `possibleDuplicate`, `tooLong: (max) => …`, `emptyValue`

**Checkpoint**: US1 e US2 verdi; MVP utilizzabile (inserimento protetto)

---

## Phase 5: User Story 3 - Scheda persona (Priority: P2)

**Goal**: `/p_<id>` mostra la scheda con Modifica ed Elimina

**Independent Test**: inserire una persona (anche direttamente in D1) e inviare `/p_<id>`; verificare contenuto e pulsanti

### Tests for User Story 3 ⚠️

- [ ] T049 [P] [US3] Scrivere `test/integration/us3-scheda.test.ts`:
  - RF-03 scenario 1: persona 12 inserita in D1 (id esplicito) → `/p_12` → testo della scheda e tastiera con `callback_data` `p:m:12` e `p:x:12`
  - RF-03 scenario 2, FR-012: persona senza anno → nessuna età nella seconda riga
  - RF-03 scenario 3, FR-013: persona appena inserita → nessuna riga `Storico`; con un'occorrenza `fatto` del 2025 inserita a mano → riga `Storico: 2025 fatto`
  - FR-012a: `/p_999` → `Persona non trovata`; persona eliminata (DELETE diretto) → `/p_12` → `Persona non trovata`
  - FR-018c: callback `p:m:999` e `p:x:999` → `answerCallbackQuery` con `Persona non trovata`, nessun flusso avviato
  - RNF-14: la scheda non contiene pulsanti di navigazione, solo Modifica ed Elimina

### Implementation for User Story 3

- [ ] T050 [US3] Registrare in `src/bot/commands.ts` il comando `p` (da `/p_<id>`) che chiama `showScheda(ctx, personId)` (RF-03)
- [ ] T051 [US3] Registrare in `src/bot/router.ts` la guardia comune per i callback statici `p:*`: se `getById` non trova la persona → `answerCallbackQuery(T.personNotFound)` e stop (FR-018c); altrimenti inoltra alle azioni `m` (US4) e `x` (US5) registrate in `STATIC_CALLBACKS`, rispondendo `T.actionUnavailable` se l'azione non è ancora registrata

**Checkpoint**: US3 verde in autonomia

---

## Phase 6: User Story 4 - Modifica per campo (Priority: P2)

**Goal**: dalla scheda, Modifica → campo → nuovo valore o Svuota, poi scheda aggiornata

**Independent Test**: dalla scheda modificare un campo e svuotarne uno opzionale; verificare che cambi solo quel campo

### Tests for User Story 4 ⚠️

- [ ] T052 [P] [US4] Scrivere `test/integration/us4-modifica.test.ts`:
  - FR-014: `p:m:<id>` → menù con 9 pulsanti `Nome · Nickname · Data · Telefono · Instagram · Telegram · Gruppi · Priorità · Messaggio` più Annulla
  - RF-04 scenario 1: Instagram → `@nuovo.user` → solo `instagram = 'nuovo.user'` cambia, `updated_at` = now del test, `created_at` invariato; ultimo messaggio = scheda aggiornata
  - RF-04 scenario 2, FR-015, SC-005: Telefono → `[Svuota]` → `phone` NULL in 3 interazioni (Modifica, Telefono, Svuota)
  - FR-015: il campo Nome non offre `Svuota`; Data non offre `Svuota`
  - FR-016: Telefono `abc` rifiutato con l'esempio; Data `31/04` rifiutata; Data `15/03/1994` → conferma `15 marzo 1994, giusto?` → Sì → salvata; nome di 61 caratteri rifiutato
  - FR-016a, RF-04 scenario 3, BR-14: con `Marco Rossi` 14/03/1994 e `Luca Bianchi` 14/03/1994, rinominare Luca in `marco rossi` → avviso di possibile duplicato; `Salva comunque` → salvato; rinominare una persona con il proprio nome in maiuscolo → nessun avviso (esclude sé stessa); con `Marco Rossi` 14/03/1994, cambiare la data di un altro `Marco Rossi` (nato 20/05/1994) in `14/03` senza anno → avviso
  - Gruppi: selezione iniziale = gruppi attuali; toggle + `➕ Nuovo gruppo` + Fine → appartenenze sostituite e nuovo gruppo creato; Annulla → nulla cambia
  - Priorità: `Bassa` → salvata subito, scheda rimostrata
  - Persona eliminata durante la modifica (DELETE diretto) → invio del nuovo valore → `Persona non trovata`, flusso chiuso
  - FR-018c: dopo il salvataggio il pulsante del menù precedente → `Questa azione non è più disponibile`

### Implementation for User Story 4

- [ ] T053 [US4] Aggiungere in `src/db/persons.ts` `updateFieldGuardedStatements(db, chatId, flowId, personId, patch, nowIso)` (UPDATE dei soli campi indicati + `updated_at`, condizionato da `flowGuardSql`, più `consumeStatement`) e `replaceGroupsGuardedStatements(db, chatId, flowId, personId, selectedIds, pendingNames, nowIso)` (crea i gruppi in attesa, cancella e reinserisce le appartenenze, aggiorna `updated_at`, `consumeStatement`); per nome e data aggiornare anche `full_name_norm`
- [ ] T054 [US4] Implementare `src/bot/flows/modifica.ts` (contracts/flussi.md, flusso `modifica`) riusando gli step di `src/bot/flows/steps.ts`: menù campi con azioni `e:n|k|d|p|i|t|g|r|m`; `[Svuota] (z)` solo per nickname, telefono, instagram, telegram, messaggio; controllo duplicato (escludendo la persona stessa) per nome e data con step `duplicato`; prima di ogni scrittura verifica che la persona esista ancora (altrimenti `T.personNotFound` e `clear`); dopo il salvataggio `showScheda`
- [ ] T055 [US4] Registrare in `STATIC_CALLBACKS` (`src/bot/router.ts`) l'azione `p:m` che avvia il flusso `modifica` con `personId` e step `menu`, e aggiungere a `src/texts.ts` i testi `editWhichField`, le etichette dei 9 campi (`Nome`, `Nickname`, `Data`, `Telefono`, `Instagram`, `Telegram`, `Gruppi`, `Priorità`, `Messaggio`) e le domande per il nuovo valore di ciascun campo

**Checkpoint**: US4 verde

---

## Phase 7: User Story 5 - Eliminazione persona (Priority: P3)

**Goal**: Elimina dalla scheda con conferma; con Sì sparisce tutto ciò che riguarda la persona

**Independent Test**: premere Elimina, confermare o annullare, verificare lo stato dei dati

### Tests for User Story 5 ⚠️

- [ ] T056 [P] [US5] Scrivere `test/integration/us5-eliminazione.test.ts`:
  - RF-05 scenario 1, RNF-05: `p:x:<id>` → testo esatto `Eliminare Marco Rossi? Perderai anche lo storico` con `[Sì] [Annulla]`; Sì → nessuna riga in `persons`, `person_groups`, `occurrences`, `deliveries` per quella persona (occorrenza e invio inseriti a mano prima del test); i gruppi restano; messaggio di conferma
  - RF-05 scenario 2: Annulla → tutte le righe invariate
  - FR-018c: dopo Sì, il vecchio `Sì` → `Questa azione non è più disponibile`; `p:x:<id>` sulla vecchia scheda → `Persona non trovata`; `/p_<id>` → `Persona non trovata`
  - R-13: dopo l'eliminazione, una nuova persona non riceve lo stesso id

### Implementation for User Story 5

- [ ] T057 [US5] Aggiungere in `src/db/persons.ts` `deleteGuardedStatements(db, chatId, flowId, personId)` = `DELETE FROM persons WHERE id = ? AND <flowGuardSql>` (la cascata rimuove appartenenze, occorrenze, invii) + `consumeStatement`
- [ ] T058 [US5] Implementare `src/bot/flows/elimina.ts` (step `conferma`, `[Sì] (y) [Annulla] (a)`), registrare `p:x` in `STATIC_CALLBACKS` e aggiungere a `src/texts.ts` `confirmDeletePerson: (nome) => \`Eliminare ${nome}? Perderai anche lo storico\`` e `personDeleted`

**Checkpoint**: US5 verde

---

## Phase 8: User Story 6 - Gestione gruppi (Priority: P3)

**Goal**: `/gruppi` elenca, crea, rinomina ed elimina i gruppi

**Independent Test**: con `/gruppi` creare, rinominare ed eliminare gruppi e verificare l'effetto sulle persone

### Tests for User Story 6 ⚠️

- [ ] T059 [P] [US6] Scrivere `test/integration/us6-gruppi.test.ts`:
  - FR-019: `/gruppi` con `Famiglia` (3 persone) e `Beach tennis` (5) → elenco alfabetico con i conteggi e `[➕ Nuovo gruppo] [✏️ Rinomina] [🗑 Elimina]`; senza gruppi → solo `[➕ Nuovo gruppo]`
  - RF-07 scenario 1, BR-17: con `Famiglia`, creare `famiglia` → rifiutato, nessuna riga; `Amici` → creato ed elenco rimostrato; nome di 31 caratteri → rifiutato con il massimo 30
  - RF-07 scenario 2, FR-021: rinominare `Lavoro` in `Ufficio` → `/p_<id>` di una persona associata mostra `Ufficio`; rinomina in un nome esistente di altro gruppo → rifiutata; `lavoro` → `Lavoro` consentita
  - RF-07 scenario 3, FR-022, RNF-05: eliminare un gruppo con 8 persone → testo con `8 persone perderanno questa etichetta` e `[Sì] [Annulla]`; Sì → gruppo eliminato, 8 persone ancora presenti, nessuna appartenenza residua; Annulla → nulla cambia
  - RF-06 / US2 scenario 10: a metà di `/nuovo`, `/gruppi` → nessuna persona salvata, `conversation_state` senza flusso `nuovo`, elenco gruppi mostrato
  - FR-018c: scelta di un gruppo eliminato nel frattempo → `Questa azione non è più disponibile`

### Implementation for User Story 6

- [ ] T060 [US6] Aggiungere in `src/db/groups.ts`: `listWithCounts(db)` (LEFT JOIN `person_groups`, ordine alfabetico), `getById`, `countMembers(db, groupId)`, `createGuardedStatements`, `renameGuardedStatements` (aggiorna `name` e `name_norm`), `deleteGuardedStatements` (cascata su `person_groups`), tutti con `flowGuardSql` + `consumeStatement`
- [ ] T061 [US6] Implementare `src/bot/flows/gruppi.ts` (contracts/flussi.md, flusso `gruppi`): azioni crea (`nome`), rinomina (`scelta` con un pulsante per gruppo `sg:<id>` → `nome`, unicità escludendo il gruppo stesso), elimina (`scelta` → `conferma` con `[Sì] [Annulla]`); al termine rimostra l'elenco `/gruppi`; gruppo non più esistente → `T.actionUnavailable` e `clear`
- [ ] T062 [US6] Registrare il comando `gruppi` in `src/bot/commands.ts` e i callback statici `g:n`, `g:r`, `g:x` in `src/bot/router.ts`; aggiungere a `src/texts.ts` `groupsTitle: "Gruppi:"`, `groupLine: (nome, n) => \`• ${nome} (${n})\``, `noGroups`, `btnRename: "✏️ Rinomina"`, `btnDeleteGroup: "🗑 Elimina"`, `askGroupToRename`, `askGroupToDelete`, `askRenameTo`, `confirmDeleteGroup: (nome, n) => …` con `n persone perderanno questa etichetta` (singolare `1 persona perderà questa etichetta`), `groupCreated`, `groupRenamed`, `groupDeleted`

**Checkpoint**: US6 verde

---

## Phase 9: User Story 7 - Benvenuto e aiuto (Priority: P3)

**Goal**: `/start` con azioni rapide, `/aiuto` con l'elenco dei comandi, fallback per testo non capito

**Independent Test**: inviare `/start`, `/aiuto`, `ciao`, `/pippo` e verificare messaggi e pulsanti

### Tests for User Story 7 ⚠️

- [ ] T063 [P] [US7] Scrivere `test/integration/us7-start-aiuto.test.ts`:
  - RF-28 scenario 1, FR-024: `/start` → benvenuto con esattamente `[Aggiungi persona] (s:n)` e `[Comandi] (s:h)`; nessun pulsante "Scarica modello CSV"
  - `s:n` → avvia il flusso `nuovo` (`Nome completo?`); `s:h` → testo di `/aiuto`
  - RF-28 scenario 2, FR-025: `/aiuto` → una riga per `/nuovo`, `/gruppi`, `/annulla`, `/id`, `/aiuto`, `/start` e la spiegazione di `/p_<id>`, ciascuna con descrizione; nessun comando di feature future (`/prossimi`, `/modello`…)
  - RF-28 scenario 3, FR-025a: fuori flusso `ciao` e `/pippo` → `Non ho capito. Scrivi /aiuto per l'elenco dei comandi`

### Implementation for User Story 7

- [ ] T064 [US7] Registrare i comandi `start` e `aiuto` in `src/bot/commands.ts` e i callback statici `s:n` (avvia `nuovo`) e `s:h` (testo di aiuto) in `src/bot/router.ts`; aggiungere a `src/texts.ts` `welcome`, `btnAddPerson: "Aggiungi persona"`, `btnCommands: "Comandi"`, `help` (comandi della tabella del Perimetro della spec, una riga ciascuno)

**Checkpoint**: tutte le user story verdi

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: gate di chiusura della constitution e validazione finale

- [ ] T065 [P] Scrivere `test/integration/budget.test.ts` (principio II, RNF-17): con il wrapper contatore di `test/helpers/deps.ts`, per il caso peggiore (Salva di `/nuovo` con 2 gruppi in attesa, 2 selezionati e controllo duplicato) e per `/gruppi` con 20 gruppi, verificare chiamate D1 (`prepare` eseguiti + `batch`) + chiamate Telegram ≤ 15 per update (margine ampio sotto 50); annotare i valori misurati in un commento del test
- [ ] T066 [P] Verificare la centralizzazione (principio VIII, RNF-15): `git grep` di stringhe con lettere accentate o parole italiane comuni in `src/` fuori da `src/texts.ts` → nessun risultato; `Europe/Rome`, `+39`, `Tanti auguri` presenti solo in `src/config.ts`; `new Date(` e `Date.now(` presenti solo in `src/index.ts` (principio VI)
- [ ] T067 [P] Verificare segreti e log (principi IV e V, SC-006): `git ls-files` non contiene `.dev.vars`; `git grep -nE "[0-9]{8,10}:[A-Za-z0-9_-]{30,}"` (formato token bot) → nessun risultato; `console.` usato solo in `src/log.ts`
- [ ] T068 Verificare la tracciabilità (principio X e XI, SC-001): ogni ID tra RF-01…RF-08, RF-28, RF-29, RF-30, BR-01, BR-02, BR-14, BR-15, BR-16, BR-17, RNF-02, RNF-03, RNF-05, RNF-13, RNF-14, A-04 compare in almeno un titolo di test (`git grep` in `test/`); aggiungere test mancanti
- [ ] T069 [P] Aggiornare `README.md` con i comandi `npm install`, `npm run typecheck`, `npm test`, `npm run dev` e il rimando a `specs/001-fondamenta-anagrafica/quickstart.md`
- [ ] T070 Eseguire `npm run typecheck` e `npm test`: zero errori e tutti i test verdi (gate 1 e 5); poi seguire `specs/001-fondamenta-anagrafica/quickstart.md` punti 1–3

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza. T005 dipende da T001–T002; T006–T007 da T001
- **Foundational (Phase 2)**: dipende dal Setup; blocca tutte le user story. Ordine interno: T008 → T009/T024; T013 → T024; T015 → T017 → T022 → T026–T030; T019 e T021 indipendenti; T025 dopo T017, T022; T028 → T029 → T030
- **User Stories (Phase 3+)**: dopo la Foundational
- **Polish (Phase 10)**: dopo tutte le story

### User Story Dependencies

- **US1 (P1)**: solo Foundational
- **US2 (P1)**: solo Foundational (i test FR-018 usano `/id` di US1: farla dopo US1, come da priorità)
- **US3 (P2)**: usa `showScheda` di US2 (T045) e `src/db/persons.ts` (T043)
- **US4 (P2)**: dipende da US3 (pulsante Modifica e guardia `p:*`) e dagli step condivisi di US2 (T046)
- **US5 (P3)**: dipende da US3 (pulsante Elimina e guardia `p:*`)
- **US6 (P3)**: solo Foundational e `src/db/groups.ts` di US2 (T044); il test "/gruppi a metà di /nuovo" richiede US2
- **US7 (P3)**: `s:n` richiede il flusso `nuovo` di US2

Ordine consigliato: US1 → US2 → US3 → US4 → US5 → US6 → US7 (US5 e US6 sono tra loro indipendenti).

### Within Each User Story

- Test scritti per primi e falliti prima dell'implementazione
- Domain e db prima dei flussi; flussi prima della registrazione di comandi/callback
- I task su `src/texts.ts`, `src/bot/commands.ts`, `src/bot/router.ts` sono sequenziali

### Parallel Opportunities

- Setup: T002, T003, T004 insieme
- Foundational: T009, T010, T011, T012–T013, T014, T015, T016, T018–T019, T020–T021
- US2: test T035–T038 insieme; implementazioni T040–T044 insieme (file diversi)
- US5 e US6 possono procedere in parallelo dopo US3/US2
- Polish: T065, T066, T067, T069

---

## Parallel Example: User Story 2

```text
# Test unitari insieme:
Task: "T035 test/unit/date.test.ts"
Task: "T036 test/unit/phone.test.ts"
Task: "T037 test/unit/username.test.ts"
Task: "T038 test/unit/scheda.test.ts"

# Moduli indipendenti insieme:
Task: "T040 src/domain/date.ts"
Task: "T041 src/domain/phone.ts"
Task: "T042 src/domain/username.ts"
Task: "T043 src/db/persons.ts"
Task: "T044 src/db/groups.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup e Phase 2 Foundational
2. Phase 3 US1: webhook protetto → **validare** (nessuna risposta a estranei, 401 senza token)
3. Phase 4 US2: inserimento guidato → **validare** con il flusso §5.2
4. Deploy di prova con `scripts/setup-bot.ps1` se si vuole usarlo subito

### Incremental Delivery

1. US3 scheda → US4 modifica → US5 eliminazione → US6 gruppi → US7 benvenuto/aiuto
2. Ogni story: test verdi, `npm run typecheck`, commit
3. Phase 10: gate di chiusura della constitution, poi merge su `main` e `scripts/deploy.ps1`

---

## Notes

- [P] = file diversi e nessuna dipendenza da task incompleti
- Ogni test cita l'ID AFU nel titolo
- Commit dopo ogni task o gruppo logico, senza righe di attribuzione (regola globale del progetto)
- Fermarsi a ogni checkpoint per validare la story in autonomia
