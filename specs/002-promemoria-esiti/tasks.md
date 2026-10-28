---

description: "Task list per la feature 002 — Promemoria ed esiti"
---

# Tasks: Promemoria ed esiti

**Input**: documenti di progetto in `specs/002-promemoria-esiti/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (ciclo-orario.md, promemoria.md, callback-data.md, messaggio.md), quickstart.md

**Tests**: OBBLIGATORI. La constitution (principio X) e SC-001 chiedono almeno un test per ogni
RF e per ogni criterio Dato/Quando/Allora. Ogni `describe`/`it` MUST citare l'ID AFU verificato
(principio XI), es. `it("N-02: stessa ora eseguita due volte, un solo messaggio", …)`. I test di
ogni story si scrivono per primi e devono fallire prima dell'implementazione.

**Organization**: task raggruppati per user story (US1…US6 della spec), in ordine di priorità.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1…US6)

## Convenzioni valide per tutti i task

- Valgono tutte le convenzioni di `specs/001-fondamenta-anagrafica/tasks.md` (testi solo in
  `src/texts.ts`, costanti solo in `src/config.ts`, log solo con codici e numeri tramite
  `src/log.ts`, testo semplice senza `parse_mode`, nessun `new Date()` fuori da `src/index.ts`).
- Il ciclo orario ricava data e ora locale **da `scheduledAt`** (research R-02); i timestamp
  scritti (`sent_at`, `outcome_at`, `created_at`) da `deps.now()`.
- Ogni conversione di fuso avviene in `src/time.ts` (principio VI).
- Scritture multiple sempre in `db.batch` (principio II). Statement multi-riga spezzati in blocchi
  da **≤ 100 parametri** (limite D1, research R-01).
- Valori ammessi (data-model.md): `deliveries.kind` ∈ `pre`, `giorno`, `recupero`;
  `deliveries.ref` = "`pre`: giorni prima (7, 2, 1); `giorno`: ora dello slot (9, 13, 18, 21);
  `recupero`: 13 (`RECOVERY_HOUR`)"; `deliveries.status` ∈ `in_invio`, `inviato`, `fallito`,
  `abbandonato`; `occurrences.status` ∈ `aperta`, `fatto`, `saltato`, `non_confermato`.
- I task che modificano `src/texts.ts`, `src/config.ts`, `src/bot/router.ts`,
  `src/bot/promemoria.ts`, `src/cron/hourly.ts`, `src/domain/schedule.ts` o
  `src/db/reminders.ts` non sono [P] tra loro.
- Test integrazione: D1 locale, fake Telegram, `sleep` no-op, `scheduledAt` costruito con
  l'helper `runAt` di T008. Date di riferimento: salvo diversa indicazione oggi = 14/03/2027
  (ora solare, UTC+1), così 09:00 locali = `2027-03-14T08:00:00.000Z`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: migration, costanti, configurazione del benchmark

- [X] T001 Creare `migrations/0002_indice_retry.sql` con esattamente: commento `-- Ricerca dei retry della giornata a ogni esecuzione oraria (research R-08).` e `CREATE INDEX idx_deliveries_retry ON deliveries(local_date, status);`. Nessun'altra modifica di schema
- [X] T002 [P] In `src/config.ts` aggiungere: `MAX_SENDS_PER_RUN = 40`, `SEND_INTERVAL_MS = 1000`, `OUTCOME_CORRECTION_DAYS = 7` (A-05); in `TEXT_LIMITS` cambiare `customMessage: 500` in `customMessage: 256` e aggiungere `greetingNamePlaceholder: 60` (FR-035, "ogni `{nome}` vale 60 caratteri"); aggiungere `GREETING_PLACEHOLDER = "{nome}"`. Commenti con gli ID (principio VIII, research R-05, R-06)
- [X] T003 [P] Creare `vitest.bench.config.ts` alla radice: `defineConfig` di `vitest/config` **senza** il plugin Cloudflare, `test.environment: "node"`, `test.include: []`, `benchmark.include: ["bench/**/*.bench.ts"]`. Aggiungere a `package.json` lo script `"bench": "vitest bench --run --config vitest.bench.config.ts"`. Nessuna nuova dipendenza (plan, Complexity Tracking)
- [X] T004 Aggiornare `test/integration/schema.test.ts` (se verifica l'elenco degli indici) e aggiungere un caso `it("N-03: indice idx_deliveries_retry presente", …)` che legge `sqlite_master`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tempo, trasporto Telegram, composizione degli auguri e helper di test usati da tutte le story

**⚠️ CRITICAL**: nessuna user story può iniziare prima della fine di questa fase

### Test

- [X] T005 [P] Estendere `test/unit/time.test.ts`: `addDays` attraverso fine mese, fine anno (31/12 + 1 → 01/01) e 28/02 → 01/03 non bisestile; `toDateString({2027,3,4})` = `"2027-03-04"`; `floorToHour`; `localDayStartUtc` per un giorno normale d'inverno (`2027-01-10` → `2027-01-09T23:00:00.000Z`), d'estate (`2027-07-10` → `2027-07-09T22:00:00.000Z`), **domenica del cambio a ora legale** (`2027-03-28` → `2027-03-27T23:00:00.000Z`) e **del ritorno all'ora solare** (`2027-10-31` → `2027-10-30T22:00:00.000Z`); `toLocal` alle 13:00 locali dei due giorni del cambio. Citare BR-24
- [X] T006 [P] Creare `test/unit/greeting.test.ts`: `composeGreeting` con default `"Tanti auguri {nome}! 🎉"` e nickname "Marchino" → `"Tanti auguri Marchino! 🎉"` (RF-15); senza nickname → nome completo; messaggio personalizzato prevale sul default; `{nome}` sostituito anche nel personalizzato e in ogni occorrenza; default da `settings` assente → `DEFAULT_BIRTHDAY_MESSAGE`. `validateGreeting`: trim, vuoto rifiutato, 256 caratteri senza `{nome}` accettato, 257 rifiutato, `"{nome}"` + 196 caratteri accettato (60 + 196 = 256), + 197 rifiutato, emoji contata 1 (code point). Citare FR-031, FR-035
- [X] T007 [P] Estendere `test/unit/callback-data.test.ts`: `encodeCallback`/`decodeCallback` per `{ kind: "static", scope: "o", action: "f", id: 123 }` → `"o:f:123"` e `"o:s:999999999999999"` (≤ 64 byte); `"o:x"` senza id resta decodificabile come static (la validazione dell'azione è del router); estendere il controllo "≤ 64 byte" ai soli pulsanti con `callback_data` (i pulsanti `url` e `copy_text` non hanno `callback_data`). Citare contracts/callback-data.md

### Helper di test

- [X] T008 Creare `test/helpers/cron.ts` ed estendere gli helper esistenti:
  - in `test/helpers/db.ts`, `PersonSeed` acquisisce `createdAt?: string` (default `NOW.toISOString()`), usato per `created_at` e `updated_at`; aggiungere `insertOccurrence({ personId, year, effectiveDate, status = "aperta", outcomeAt = null })` e `insertDelivery({ occurrenceId, kind, ref, status, attempts = 1, localDate, telegramMessageId = null })` che restituiscono l'id;
  - in `test/helpers/deps.ts`, `makeCronDeps(opts)` = `makeDeps(opts)` + `sleep: async () => {}` e un contatore `sleeps`;
  - in `test/helpers/cron.ts`, `localInstant(y, m, d, hour): Date` (istante UTC dell'ora locale Europe/Rome, calcolato con `localDayStartUtc` + ore) e `runAt(deps, y, m, d, hour)` che imposta `deps.setNow(localInstant(...))` e chiama `runHourly(deps, localInstant(...))`
- [X] T009 Estendere `test/helpers/fake-telegram.ts`: metodo `editMessageText(chatId, messageId, text, keyboard?)` registrato come `{ method: "editMessageText", … }` e helper `textEdits()`; `failNext(code: number, times = 1)` che fa lanciare `TelegramError(code)` alle prossime `sendMessage`; `failWhen(predicate: (text) => boolean, code)` per far fallire solo i messaggi di una persona (RNF-12); `buttons()`/`labels()`/`cbOf()` gestiscono anche pulsanti `url` (valore = url) e `copy_text` (valore = `copy_text.text`); aggiungere `urlOf(kb, label)` e `copyOf(kb, label)`

### Implementazione

- [X] T010 In `src/time.ts` aggiungere (unico punto del fuso, principio VI): `addDays(d: LocalDate, n: number): LocalDate` (su `Date.UTC`), `toDateString(d: LocalDate): string` (`YYYY-MM-DD`), `floorToHour(d: Date): Date`, `localDayStartUtc(d: LocalDate): Date` — istante UTC della mezzanotte locale: stima `Date.UTC(y, m-1, d) - 1h`, poi correzione con `toLocal` finché la data locale è `d` e l'ora è 0 (al più ±1 h, giorni del cambio d'ora inclusi). Fa passare T005
- [X] T011 [P] Creare `src/domain/greeting.ts` (puro, nessun import di `cloudflare:*`): `composeGreeting(p: { nickname: string | null; fullName: string; customMessage: string | null }, defaultMessage: string | null): string` (template = personalizzato ?? default ?? `DEFAULT_BIRTHDAY_MESSAGE`; ogni `GREETING_PLACEHOLDER` → nickname ?? nome completo; mai l'età, BR-03) e `validateGreeting(input: string): { ok: true; value: string } | { ok: false; error: "empty" | "too_long" }` con "lunghezza = code point del testo senza `{nome}` + 60 × numero di `{nome}`", massimo `TEXT_LIMITS.customMessage` (256). Fa passare T006
- [X] T012 [P] Creare `src/db/settings.ts`: `DEFAULT_MESSAGE_KEY = "default_message"`; `defaultMessageStatement(db)` = `SELECT value FROM settings WHERE key = ?` (da usare dentro le batch di lettura); `getDefaultMessage(db): Promise<string | null>`; `saveDefaultMessageGuardedStatement(db, chatId, flowId, value, nowIso)` = `INSERT INTO settings (key, value, updated_at) SELECT 'default_message', ?, ? WHERE <flowGuardSql> ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at` (contracts/messaggio.md). Riga assente → `null` (il default resta in `config.ts`, principio VIII)
- [X] T013 In `src/telegram/types.ts` trasformare `InlineKeyboardButton` in unione: `{ text: string; callback_data: string } | { text: string; url: string } | { text: string; copy_text: { text: string } }` (research R-10); aggiungere `reply_markup?: InlineKeyboardMarkup` a `Message`. Sistemare i punti del codice che leggono `callback_data` assumendolo sempre presente
- [X] T014 In `src/telegram/client.ts` aggiungere a `TelegramApi` e all'implementazione `editMessageText(chatId, messageId, text, keyboard?)` → metodo Bot API `editMessageText` con `chat_id`, `message_id`, `text` e, se presente, `reply_markup` (una tastiera `{ inline_keyboard: [] }` rimuove i pulsanti). Errori come gli altri metodi (`TelegramError` col solo codice). Estendere `test/unit/telegram-client.test.ts` con il corpo atteso della richiesta
- [X] T015 In `src/telegram/keyboard.ts`: ammettere lo scope `"o"` in `Callback` e in `decodeCallback` (accanto a `s`, `p`, `g`); aggiungere `urlButton(text, url)` e `copyButton(text, copied)` (`copy_text: { text: copied }`); `encodeCallback` invariato. Fa passare T007
- [X] T016 In `src/deps.ts` aggiungere `export interface CronDeps extends Deps { sleep(ms: number): Promise<void> }`. In `src/index.ts` aggiungere `makeCronDeps(env)` = `makeDeps(env)` + `sleep: (ms) => scheduler.wait(ms)` (se `scheduler.wait` non è tipizzato nella versione installata, `new Promise((r) => setTimeout(r, ms))`). L'handler `scheduled` resta vuoto fino a T024

**Checkpoint**: `npm run typecheck` e `npm test` verdi (i test della feature 001 sul limite 500 si aggiornano in US4)

---

## Phase 3: User Story 1 — Reminder del giorno con contatto in un tocco (Priority: P1) 🎯 MVP

**Goal**: negli slot del profilo arriva un messaggio per persona con dati, pulsanti di contatto e Fatto/Salta; il ciclo orario è idempotente, ritenta nella giornata e rispetta il tetto di invii.

**Independent Test**: con una persona che compie gli anni oggi, `runAt` alle 9, 13, 18, 21 locali e verifica di messaggi, contenuto, pulsanti e chiusura con Fatto/Salta.

### Test per User Story 1 (scrivere prima, devono fallire)

- [X] T017 [P] [US1] Creare `test/unit/schedule.test.ts` (parte `giorno`): `planTargets(T, H)` per `H` ∈ 9, 13, 18, 21 contiene il target `giorno/H` sulla data `T`; per `H` = 10 non contiene target `giorno`; 28/02/2027 (non bisestile) include le coppie `(2,28)` e `(2,29)`, 28/02/2028 solo `(2,28)` e 29/02/2028 `(2,29)` (BR-04); `selectNew` filtra per profilo (Media alle 21 → escluso; Bassa alle 13 → escluso, §7), per occorrenza chiusa (esclusa) e per BR-10 (`created_at` > istante dello slot → escluso); ordinamento `giorno` < `recupero` < `pre`, poi ID persona; tetto: con 45 invii i primi 40 `in_invio`, gli altri 5 in coda
- [X] T018 [P] [US1] Creare `test/unit/promemoria.test.ts` (parte reminder): testo §5.3 con nickname diverso dal nome (`🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni`), senza nickname (solo nome), senza anno (nessuna età), nato il 29/02 in anno non bisestile (` (compleanno il 29/02)` in fondo alla prima riga); righe `Gruppi: …` (ordine alfabetico), `📱 +393331234567`, `L'anno scorso: fatto ✅` / `L'anno scorso: saltato` presenti solo con il dato; con esito precedente `non_confermato` nessuna riga (BR-09). Tastiera: riga 1 WhatsApp/Instagram/Telegram solo se presenti (RF-11), riga 2 `Copia messaggio`, riga 3 `Fatto ✅` / `Salta quest'anno` con `o:f:<id>` / `o:s:<id>`; URL WhatsApp `https://wa.me/393331234567?text=Tanti%20auguri%20Marchino!%20%F0%9F%8E%89` (V-06, senza età, BR-03); `https://ig.me/m/<username>`, `https://t.me/<username>` con `encodeURIComponent`; nessun URL `tel:`/`sms:` (V-04); `copy_text.text` = auguri (FR-029); auguri > 256 caratteri → nessun `Copia messaggio`. Varianti dopo l'esito: `\n\n✅ Fatto` e `\n\nSaltato` con le sole righe di contatto
- [X] T019 [P] [US1] Creare `test/integration/us1-reminder.test.ts` con gli scenari della spec US1: (1) due persone lo stesso giorno → due messaggi separati con i propri pulsanti (RF-10, D-03); (2) esito precedente `non_confermato` → niente "L'anno scorso" (BR-09); (3) solo telefono e Instagram → WhatsApp, Instagram, Copia messaggio, niente Telegram (RF-11); (4) URL WhatsApp con auguri senza età (RF-11, BR-03); (5) senza telefono → niente WhatsApp; (6) `copy_text` = auguri della persona (FR-029); (7) Fatto → occorrenza `fatto` con `outcome_at`, `editMessageText` del messaggio premuto con "✅ Fatto" e soli contatti, nessun messaggio a 13/18/21 (RF-12, BR-07); (8) Salta quest'anno → `saltato`, stessi effetti; (9) Media → messaggi alle 9, 13, 18, nessuno alle 21 (§7); Alta 4 slot, Bassa 9 e 18 (SC-003, parte giorno). Inoltre: secondo Fatto su un altro reminder della stessa occorrenza → esito invariato, nessun edit, risposta "Questa azione non è più disponibile" (FR-015); Fatto dopo l'eliminazione della persona → "Persona non trovata"; un callback `o:f:<id>` costruito per un pre-reminder → esito invariato, "Questa azione non è più disponibile"; un tocco `o:` durante `/nuovo` non annulla il flusso (research R-11); budget del tocco = 3 subrequest
- [X] T020 [P] [US1] Creare `test/integration/ciclo-idempotenza.test.ts`: `runAt` due volte alle 9 → un solo `sendMessage` e una riga `deliveries` (N-02, SC-002); due `runHourly` concorrenti (`Promise.all`) con lo stesso `scheduledAt` → un solo messaggio; riga in `in_invio` lasciata da un'esecuzione interrotta → mai rinviata (research R-08)
- [X] T021 [P] [US1] Creare `test/integration/ciclo-retry.test.ts`: `failNext(500)` alle 9 → riga `fallito`, `attempts = 1`, `last_error_code = 500`; `runAt` alle 10 → reinviato, `inviato`, `attempts = 2` (N-03); fallisce per tutto il giorno → il giorno dopo alle 0 `abbandonato` e mai inviato (N-03); nessuna esecuzione alle 9 → `runAt` alle 13 non invia lo slot delle 9 per una Bassa (N-04, FR-007); `failWhen` su una persona → le altre due ricevono il messaggio nella stessa esecuzione (RNF-12, SC-006); retry di un'occorrenza chiusa nel frattempo → `abbandonato`, nessun invio; tetto: 45 persone Alta con compleanno oggi alle 9 → 40 inviati, 5 righe `fallito` con `attempts = 0`, alle 10 i 5 partono (research R-05); il giorno del cambio d'ora (28/03/2027 e 31/10/2027) lo slot delle 9 parte all'istante UTC corretto (BR-24, SC-008)
- [X] T022 [P] [US1] Sostituire in `test/integration/scheduled.test.ts` il caso "handler vuoto" con un test del collegamento (N-01): l'handler `scheduled` del worker, chiamato con `createScheduledController({ cron: "0 * * * *", scheduledTime })` alle **10 locali** (nessuno slot) con un'occorrenza aperta di due giorni prima, termina senza errori e la porta a `non_confermato`. Nessun invio a Telegram in questo test (principio X: niente rete reale); gli invii sono coperti dai test di `runHourly` con `makeCronDeps`

### Implementazione per User Story 1

- [X] T023 [US1] Creare `src/domain/schedule.ts` (puro): tipi `Kind = "pre" | "giorno" | "recupero"`, `Target { kind; ref; date: LocalDate; year; effectiveDate: string; pairs: [month, day][] }`; `planTargets(T: LocalDate, H: number): Target[]` con la sola regola `giorno` (`H` ∈ `SLOT_HOURS` → `giorno/H` su `T`); `birthPairsFor(date)` con la regola BR-04 (riusare `effectiveDate` di `src/domain/date.ts`); `selectNew(candidates, occurrences, targets, slotInstantIso)` con filtri: priorità ammessa da `PRIORITY_PROFILES[p].slots`, occorrenza dell'anno assente o `aperta`, BR-10 `created_at ≤ slotInstantIso`; ordinamento `giorno`, `recupero`, `pre`, poi ID persona; `splitByCap(items, cap, retries)` → `{ claim, queue, retryClaim }` con `cap = MAX_SENDS_PER_RUN`, prima i nuovi poi i retry (research R-05). Fa passare la parte `giorno` di T017
- [X] T024 [US1] Creare `src/db/reminders.ts` con gli statement del ciclo (contracts/ciclo-orario.md, research R-07):
  - `readStatements(db, { pairs, years, today })` → array per la batch di lettura: default message (`defaultMessageStatement`); candidati = persone con `(birth_month, birth_day)` tra le coppie **o** con un retry di oggi, con `group_concat(g.name, char(31)) AS group_names`; occorrenze dei candidati per gli anni `T.year−1 … T.year+1` con `has_day_send` (= `EXISTS` invio `giorno` con `status IN ('inviato','in_invio')`); retry = `deliveries` con `local_date = ?` e `status = 'fallito'` (usa `idx_deliveries_retry`) con `occurrence_id, kind, ref, attempts, person_id, o.status`;
  - `claimStatements(db, { today, minOpenDate, nowIso, newOccurrences, newDeliveries, queued, retryIds })` → in ordine: `UPDATE occurrences SET status = 'non_confermato', outcome_at = ? WHERE status = 'aperta' AND effective_date <= ?`; `UPDATE deliveries SET status = 'abbandonato' WHERE status = 'fallito' AND local_date < ?`; abbandono dei retry di oggi con occorrenza non `aperta`; `INSERT OR IGNORE INTO occurrences (person_id, year, effective_date, status, created_at)` multi-riga con guardia `EXISTS (SELECT 1 FROM persons WHERE id = ?)` per riga (UNION ALL di SELECT); `INSERT OR IGNORE INTO deliveries (occurrence_id, kind, ref, status, attempts, local_date) SELECT o.id, …, 'in_invio', 1, ? FROM occurrences o WHERE o.person_id = ? AND o.year = ? AND o.status = 'aperta' … RETURNING id, occurrence_id, kind, ref, status` (stessa forma con `'fallito', 0` per la coda); `UPDATE deliveries SET status = 'in_invio', attempts = attempts + 1 WHERE id IN (…) AND status = 'fallito' AND EXISTS (occorrenza aperta) RETURNING …`. Ogni statement multi-riga in blocchi ≤ 100 parametri (helper `chunk`);
  - `resultStatements(db, results)` → per ogni invio `UPDATE deliveries SET status = 'inviato', sent_at = ?, telegram_message_id = ?` oppure `SET status = 'fallito', last_error_code = ?` (`0` per errori interni) `WHERE id = ?`
- [X] T025 [US1] Creare `src/bot/promemoria.ts` (puro, nessun import di `cloudflare:*`): `ReminderData` (persona, gruppi, esito anno precedente, anno occorrenza, data effettiva, auguri composti, `deliveryId`); `contactRows(data, layout: "giorno" | "recupero")` con WhatsApp (`https://wa.me/<phone senza +>?text=<encodeURIComponent(auguri)>`, solo se telefono), Instagram (`https://ig.me/m/<encodeURIComponent>`), Telegram (`https://t.me/<encodeURIComponent>`), `Copia messaggio` (`copyButton`, solo se `[...auguri].length ≤ 256`); `renderGiorno(data)` → `{ text, keyboard }` come contracts/promemoria.md §Reminder; `renderGiornoAfter(data, "fatto" | "saltato")`. Gruppi ordinati con un `Intl.Collator("it-IT", { sensitivity: "base" })` creato a livello di modulo e condiviso con `src/bot/scheda.ts`. Testi nuovi in `src/texts.ts`: `reminderTitle(nome, fullNameOrNull, age|null, leap29)`, `reminderGroups`, `reminderPhone`, `lastYear.fatto = "L'anno scorso: fatto ✅"`, `lastYear.saltato = "L'anno scorso: saltato"`, `btnWhatsApp`, `btnInstagram`, `btnTelegram`, `btnCopy = "Copia messaggio"`, `btnDone = "Fatto ✅"`, `btnSkipYear = "Salta quest'anno"`, `outcomeDone = "✅ Fatto"`, `outcomeSkipped = "Saltato"`. Fa passare T018
- [X] T026 [US1] Creare `src/cron/hourly.ts` con `runHourly(deps: CronDeps, scheduledAt: Date): Promise<RunReport>` secondo contracts/ciclo-orario.md: `T, H` da `toLocal(scheduledAt)`, `slotInstant = floorToHour(scheduledAt)`; `planTargets`; batch di lettura (salta la query dei candidati se non ci sono coppie né retry); `selectNew` + `splitByCap`; batch di reclamo; per ogni riga restituita in `in_invio`: composizione (`composeGreeting` + render per `kind`) e `sendMessage(Number(deps.ownerId), text, keyboard)` dentro `try/catch` per invio (RNF-12), `deps.sleep(SEND_INTERVAL_MS)` **tra** due invii; batch di esito solo se c'è almeno un invio; `log("cron_run", { hour, claimed, queued, sent, failed, closed, abandoned })`; eccezione D1 → `log("cron_error")` e uscita. Nessun dato personale nei log (principio V). Un `kind` senza renderer (prima di US2/US3) non è mai pianificato da `planTargets`
- [X] T027 [US1] Collegare `src/index.ts`: `scheduled(controller, env)` → `await runHourly(makeCronDeps(env), new Date(controller.scheduledTime))`. Rimuovere il commento "Vuoto" e aggiornare il commento del cron in `wrangler.jsonc` ("Ciclo orario dei promemoria")
- [X] T028 [US1] Creare `src/db/outcomes.ts`: `applyOutcomeBatch(db, { deliveryId, action: "f" | "s", minCorrectionDate, nowIso })` → una `db.batch` con (1) `UPDATE occurrences SET status = ?, outcome_at = ? WHERE id = (SELECT occurrence_id FROM deliveries WHERE id = ?) AND ((status = 'aperta' AND (? = 's' OR (SELECT kind FROM deliveries WHERE id = ?) <> 'pre')) OR (? = 'f' AND (SELECT kind FROM deliveries WHERE id = ?) = 'recupero' AND status IN ('saltato','non_confermato') AND effective_date >= ?))`, con stato di arrivo `fatto` per `f` e `saltato` per `s` — il tipo di messaggio è controllato **nella query**: Fatto su un pre-reminder non cambia mai l'esito e la correzione BR-08 è ammessa solo dal recupero; e (2) `SELECT` di invio (`kind`, `ref`), occorrenza (`year`, `effective_date`, `status`), persona, `group_names`, esito dell'anno precedente e default message; restituisce `{ changed: boolean, data: … | null }` (research R-11)
- [X] T029 [US1] Creare `src/bot/esiti.ts`: `handleOutcomeCallback(ctx, action: "f" | "s", deliveryId)`: `T = toLocal(now)`; chiamare `applyOutcomeBatch` con `action` e `minCorrectionDate = toDateString(addDays(T, -OUTCOME_CORRECTION_DAYS))` (tipo di messaggio e correzione decisi nella query, T028); `data === null` → `answerCallback(T.personNotFound)`; `!changed` → `answerCallback(T.actionUnavailable)`; altrimenti `editMessageText(ctx.chatId, ctx.callback.messageId, …)` con la variante "dopo l'esito" del `kind` (per ora `giorno`; `pre` e `recupero` si aggiungono in US3 e US2) e `answerCallback()` senza testo
- [X] T030 [US1] In `src/bot/router.ts`, in `routeCallback`, gestire `cb.kind === "static" && cb.scope === "o"` **prima** di `routeStatic`: azione `f` o `s` con `id` → `handleOutcomeCallback`; altrimenti `T.actionUnavailable`. Nessuna chiamata a `clear` (research R-11). Fa passare T019…T022

**Checkpoint**: US1 completa e testabile da sola: reminder del giorno, Fatto/Salta, idempotenza, retry, tetto

---

## Phase 4: User Story 2 — Recupero del giorno dopo ed esito finale (Priority: P1)

**Goal**: alle 13 di D+1 un unico recupero per le occorrenze ancora aperte; a fine D+1 *non confermato*; correzione in *fatto* entro D+7.

**Independent Test**: lasciare aperta un'occorrenza, `runAt` alle 13 di D+1 e alle 0 di D+2; verificare un solo recupero, il passaggio a `non_confermato` e la correzione.

### Test per User Story 2

- [X] T031 [P] [US2] In `test/unit/schedule.test.ts` aggiungere la parte `recupero`: alle 13 di `T` target `recupero/13` sulla data `T−1`; nelle altre ore nessun recupero; BR-11 con `inizioD = localDayStartUtc(T−1)` e `inizioT = localDayStartUtc(T)`: creata prima di `inizioD` → recupero anche senza occorrenza; creata in `[inizioD, inizioT)` → solo con `has_day_send`; creata dopo `inizioT` → mai; il recupero vale per tutte le priorità (§7); il 01/01 il recupero riguarda il 31/12 dell'anno precedente
- [X] T032 [P] [US2] In `test/unit/promemoria.test.ts` aggiungere: `⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?` + `📱 <numero>` solo se presente (chiarimento 2026-10-28); tastiera riga 1 WhatsApp/Instagram/Telegram/Copia messaggio, riga 2 `Fatto ✅` / `Saltato`; dopo Fatto → `\n\n✅ Fatto` + soli contatti; dopo Saltato → `\n\nSaltato` + contatti + `Fatto ✅` (`o:f:<id>`)
- [X] T033 [P] [US2] Creare `test/integration/us2-recupero.test.ts` con gli scenari della spec US2: (1) occorrenza aperta → alle 13 di D+1 un recupero, `runAt` ripetuto alle 13 e alle 14 → nessun altro (RF-13, D-05); (2) nessuna risposta → `runAt` alle 0 di D+2 → `non_confermato` con `outcome_at`, nessun messaggio (RF-13); (3) Fatto sul recupero → `fatto`; (4) Saltato → `saltato` e il messaggio mantiene `Fatto ✅`; (5) `saltato` e `non_confermato` con data effettiva a 7 giorni → Fatto sul recupero → `fatto`; a 8 giorni → "Questa azione non è più disponibile" (BR-08, A-05); (6) occorrenza `fatto` → Saltato sul recupero → esito invariato e "Questa azione non è più disponibile"; Fatto su un **reminder** di un'occorrenza `saltato` → nessuna correzione (FR-016); (7) persona inserita il giorno D dopo l'ultimo slot del profilo → nessun recupero (BR-11); (8) persona inserita prima di D, nessuna esecuzione o tutti `fallito` nel giorno D → recupero alle 13 di D+1, occorrenza creata se mancante (BR-11, N-04). Inoltre: chiusura mancata alle 0 (nessuna esecuzione) → applicata all'esecuzione successiva; occorrenza chiusa con Fatto il giorno D → nessun recupero (SC-004); SC-003 completo per Alta, Media e Bassa (pre + giorno + recupero) quando US3 è completa — marcare il caso dei pre-reminder con `it.todo` se US3 non è ancora implementata

### Implementazione per User Story 2

- [X] T034 [US2] In `src/domain/schedule.ts`: `planTargets` aggiunge `recupero/RECOVERY_HOUR` sulla data `T−1` quando `H === RECOVERY_HOUR`; `selectNew` applica BR-11 (research R-04) ricevendo `dayStartPrevIso` e `dayStartTodayIso` (calcolati in `src/cron/hourly.ts` con `localDayStartUtc`); il recupero non filtra per priorità. Fa passare T031
- [X] T035 [US2] In `src/bot/promemoria.ts` aggiungere `renderRecupero(data)` e `renderRecuperoAfter(data, "fatto" | "saltato")` (contracts/promemoria.md §Recupero) e i testi in `src/texts.ts`: `recoveryTitle(nome, fullNameOrNull) = "⏰ Ieri era il compleanno di <nome>[ (<nome completo>)]. Hai fatto gli auguri?"`, `btnSkipped = "Saltato"`. Fa passare T032
- [X] T036 [US2] In `src/cron/hourly.ts` passare i limiti di giornata a `selectNew`, il valore `minOpenDate = toDateString(addDays(T, -2))` alla chiusura `non_confermato` e collegare `renderRecupero` per `kind = 'recupero'`; contare `closed` dalla `meta.changes` dello statement di chiusura
- [X] T037 [US2] In `src/bot/esiti.ts` collegare `renderRecuperoAfter` per `kind = 'recupero'` (dopo `saltato` la tastiera mantiene `Fatto ✅`); la correzione BR-08 è ammessa solo per `f` su un recupero. Fa passare T033

**Checkpoint**: US1 e US2 funzionano insieme e separatamente

---

## Phase 5: User Story 3 — Pre-reminder informativi (Priority: P2)

**Goal**: alle 13 dei giorni −7, −2, −1 (secondo il profilo) un avviso con il solo "Salta quest'anno".

**Independent Test**: persone Alta, Media, Bassa; `runAt` alle 13 dei giorni precedenti il compleanno.

### Test per User Story 3

- [X] T038 [P] [US3] In `test/unit/schedule.test.ts` aggiungere la parte `pre`: alle 13 di `T` target `pre/N` sulle date `T+N` per `N` ∈ 7, 2, 1; Alta riceve −7, −2, −1, Media solo −1, Bassa nessuno (§7); 26/12/2026 alle 13 → target `pre/7` sulla data 02/01/2027 con `year = 2027` (BR-05); nato il 29/02, anno non bisestile → −1 il 27/02 (conteggio dalla data effettiva 28/02, BR-04)
- [X] T039 [P] [US3] In `test/unit/promemoria.test.ts` aggiungere: `📅 Tra 7 giorni: compleanno di Marchino (32 anni) — 14/03`; `Tra 1 giorno` al singolare; senza anno nessuna età; nato il 29/02 → `— 29/02` anche negli anni non bisestili (BR-04); età dell'anno dell'occorrenza (BR-03, BR-05); unico pulsante `Salta quest'anno` (`o:s:<id>`); dopo Salta → `\n\nSaltato quest'anno` e tastiera vuota
- [X] T040 [P] [US3] Creare `test/integration/us3-pre-reminder.test.ts` con gli scenari della spec US3: (1) Alta, compleanno 14/03/2027 → alle 13 del 07/03 "📅 Tra 7 giorni: compleanno di Marco (32 anni) — 14/03" (RF-09); (2) Salta sul pre-reminder → `saltato`, messaggio aggiornato senza pulsanti, nessun pre-reminder, reminder o recupero successivo (RF-09, BR-07, chiarimento 2026-10-28); (3) Bassa → nessun pre-reminder (§7); (4) compleanno 02/01 Alta → alle 13 del 26/12 pre −7 con l'età del 2027 e occorrenza `year = 2027` (BR-05). Inoltre alle 13 di un giorno con slot, pre-reminder e recupero insieme arrivano messaggi separati (D-03); completare il caso SC-003 lasciato `it.todo` in T033. Inoltre (SC-008, BR-04): persona Alta nata il 29/02/1996 → alle 13 del 27/02/2027 pre −1 "📅 Tra 1 giorno: compleanno di … (31 anni) — 29/02"; alle 9 del 28/02/2027 reminder con "(compleanno il 29/02)"; nel 2028 (bisestile) nessun invio il 28/02 e reminder il 29/02 senza la nota

### Implementazione per User Story 3

- [X] T041 [US3] In `src/domain/schedule.ts`: `planTargets` aggiunge `pre/N` sulla data `T+N` per ogni `N` presente in almeno un `PRIORITY_PROFILES[*].preReminderDays`, quando `H === PRE_REMINDER_HOUR`; `selectNew` filtra con `preReminderDays.includes(N)`; l'anno del target è quello della data `T+N` (BR-05). Fa passare T038
- [X] T042 [US3] In `src/bot/promemoria.ts` aggiungere `renderPre(data, days)` e `renderPreAfter(data, days)`; in `src/texts.ts` `preReminder(days, nome, age|null, ddmm)` con `Tra 1 giorno` / `Tra N giorni`, `skippedThisYear = "Saltato quest'anno"`. Collegare `kind = 'pre'` in `src/cron/hourly.ts` e in `src/bot/esiti.ts` (un `f` su un pre-reminder è già respinto dalla query di T028 e risponde `T.actionUnavailable`). Fa passare T039 e T040

**Checkpoint**: US1, US2, US3 complete: profili di §7 interamente coperti

---

## Phase 6: User Story 4 — Messaggio di auguri (Priority: P2)

**Goal**: `/messaggio` cambia il default con anteprima e conferma; limite 256 con `{nome}` = 60 anche per il messaggio personalizzato.

**Independent Test**: cambiare il default con `/messaggio`, poi verificare l'URL WhatsApp e il `copy_text` del reminder per una persona senza e una con messaggio personalizzato.

### Test per User Story 4

- [X] T043 [P] [US4] Creare `test/integration/us4-messaggio.test.ts`: (1) default "Tanti auguri {nome}! 🎉" e nickname "Marchino" → testo WhatsApp "Tanti auguri Marchino! 🎉" (RF-15); (2) Anna con messaggio personalizzato → usato il suo (RF-15); (3) `/messaggio` → domanda con il messaggio attuale → nuovo testo → anteprima con `T.sampleName` e `[Conferma] [Annulla]` (RF-15); Conferma → riga `settings` `default_message` e risposta "Messaggio di auguri aggiornato"; Annulla → nessuna riga; (4) persona senza nickname → `{nome}` = nome completo; testo oltre il limite → errore con "256" e domanda ripetuta (FR-035); testo vuoto → domanda ripetuta; nello step `conferma`, un testo inviato al posto di un pulsante → domanda di conferma ripetuta con i pulsanti, nessun salvataggio (FR-032, regola dei flussi della feature 001); `/annulla`, altro comando e scadenza 24 h come i flussi 001 (FR-032); doppio tocco su Conferma → una sola scrittura; `/aiuto` elenca `/messaggio`; budget ≤ 4 subrequest per update
- [X] T044 [P] [US4] Aggiornare `test/integration/us2-inserimento.test.ts` e `test/integration/us4-modifica.test.ts`: il test "massimo 500" diventa "massimo 256" con la regola `{nome}` = 60 (FR-035 sostituisce FR-010a di 001); aggiungere un caso con `{nome}` + 197 caratteri rifiutato

### Implementazione per User Story 4

- [X] T045 [US4] In `src/bot/flows/nuovo.ts` e `src/bot/flows/modifica.ts` sostituire `validateText(text, TEXT_LIMITS.customMessage)` con `validateGreeting` (adattando l'errore `too_long` al testo `T.greetingTooLong`); in `src/texts.ts` `greetingTooLong = "Il messaggio può avere al massimo 256 caratteri (ogni {nome} conta 60)."` (il numero letto da `TEXT_LIMITS`). Fa passare T044
- [X] T046 [US4] Aggiungere `"messaggio"` a `FLOW_NAMES` in `src/db/conversation.ts` e creare `src/bot/flows/messaggio.ts` registrato nel motore (`src/bot/flows/engine.ts`) come i flussi 001: step `testo` (testo `T.greetingAsk(attuale)` con `[Annulla]`; input validato con `validateGreeting`; valido → `data = { text }`, step `conferma`) e step `conferma` (`T.greetingPreview(composeGreeting({ nickname: null, fullName: T.sampleName, customMessage: null }, text))` con pulsanti `f:<flowId>:y` Conferma e `f:<flowId>:a` Annulla; Conferma → `db.batch([saveDefaultMessageGuardedStatement(...), consumeStatement(...)])`, se lo stato era già consumato → "Questa azione non è più disponibile"; altrimenti `T.greetingSaved`). Testi in `src/texts.ts`: `greetingAsk`, `greetingPreview`, `greetingSaved = "Messaggio di auguri aggiornato"`, `sampleName = "Marco"`, `btnConfirm = "Conferma"` (contracts/messaggio.md)
- [X] T047 [US4] In `src/bot/commands.ts` aggiungere il comando `messaggio: (ctx) => startMessaggio(ctx)` e in `src/texts.ts` la voce `/messaggio — modifica il messaggio di auguri` nel testo di `help`. Fa passare T043

**Checkpoint**: US4 completa; WhatsApp e Copia messaggio usano il nuovo default

---

## Phase 7: User Story 5 — Storico esiti nella scheda (Priority: P3)

**Goal**: la scheda mostra gli esiti definitivi per anno; lo storico alimenta "L'anno scorso".

**Independent Test**: occorrenze chiuse in anni diversi → riga "Storico" della scheda e riga "L'anno scorso" del reminder.

### Test per User Story 5

- [X] T048 [P] [US5] Creare `test/integration/us5-storico.test.ts`: (1) `fatto` 2025 e `saltato` 2024 → scheda con "Storico: 2025 fatto · 2024 saltato" (RF-03, RF-14); `non_confermato` mostrato come "non confermato"; occorrenza `aperta` dell'anno corrente non compare (FR-034); (2) nessun esito → nessuna riga "Storico" (FR-013 di 001); (3) esito 2026 `saltato` → reminder del 2027 con "L'anno scorso: saltato" (RF-10, BR-09); esito ottenuto da un tocco Fatto reale (non solo seed) compare nella scheda

### Implementazione per User Story 5

- [X] T049 [US5] Verificare che `getOutcomes` in `src/db/persons.ts` e `renderScheda` in `src/bot/scheda.ts` soddisfino T048 senza modifiche (research R-13); correggere solo se un caso fallisce. Usare in `scheda.ts` il `Intl.Collator` condiviso introdotto in T025 al posto di `localeCompare` con opzioni

**Checkpoint**: storico visibile e coerente con i reminder

---

## Phase 8: User Story 6 — Modifiche a ridosso del compleanno (Priority: P3)

**Goal**: inserimenti e modifiche vicino al compleanno producono solo i promemoria futuri.

**Independent Test**: inserire o modificare persone in momenti diversi rispetto agli slot e verificare quali promemoria partono.

### Test per User Story 6

- [X] T050 [P] [US6] Creare `test/integration/us6-modifiche.test.ts`: (1) persona Media inserita **con il flusso `/nuovo`** alle 10:30 del compleanno → messaggi alle 13 e 18, non alle 9 (BR-10, BR-11); (2) occorrenza aperta Media, alle 10 cambio priorità in Alta con il flusso Modifica → messaggi alle 13, 18, 21 (BR-12); (3) occorrenza aperta, cambio data con Modifica → occorrenza e invii cancellati, nuovi promemoria secondo la nuova data (BR-13); cambio data verso una data già passata nell'anno → nessun promemoria retroattivo (BR-13, BR-10); occorrenza dell'anno già chiusa → esito invariato, nessuna seconda occorrenza (BR-06, BR-13); cambio del solo anno di nascita → occorrenza aperta conservata (research R-04); a dicembre, occorrenza aperta dell'anno successivo nata da un pre-reminder → annullata dal cambio data

### Implementazione per User Story 6

- [X] T051 [US6] In `src/db/persons.ts` aggiungere `cancelOpenOccurrencesGuardedStatement(db, chatId, flowId, personId)` = `DELETE FROM occurrences WHERE person_id = ? AND status = 'aperta' AND <flowGuardSql>`; in `src/bot/flows/modifica.ts`, nel salvataggio del campo Data, aggiungerlo alla stessa `db.batch` di `updateFieldGuardedStatements` **prima** dello statement che consuma lo stato, solo se giorno o mese cambiano rispetto alla persona salvata (BR-13, research R-04). Nessuna subrequest aggiuntiva. Fa passare T050 (BR-10 e BR-12 sono già garantiti dal ciclo orario)

**Checkpoint**: tutte le user story complete

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: verifica esplicita dei limiti di piattaforma, privacy, documentazione

- [X] T052 Creare `test/integration/ciclo-budget.test.ts` (principio II, RNF-17) con 200 persone e contatore D1 + fake Telegram, asserendo il **valore esatto** e ≤ 50 per ogni scenario di research R-09: ora senza invii (alle 10) = 2; giorno tipico (1 compleanno, alle 9) = 4; alle 13 con 5 persone Alta per ciascuna delle date T+7, T+2, T+1, T, T−1 (occorrenze di T−1 aperte) = 28; stesso scenario con 8 per data = 43; 200 persone Alta con compleanno oggi alle 9 = 43, con 160 righe `fallito` e `attempts = 0`. Verificare anche che la batch di reclamo dello scenario da 200 contenga ≤ 30 statement e che nessuno statement superi 100 parametri (helper che ispeziona gli statement passati a `batch`)
- [X] T053 [P] Creare `bench/ciclo.bench.ts` (Node, `vitest bench`): dati sintetici di 200 persone (nessun dato reale); misurare per l'esecuzione delle 13 con 40 invii: `planTargets` + `selectNew` + `splitByCap` + per ogni invio `composeGreeting` + render + `JSON.stringify` del corpo `sendMessage`. Soglia documentata: < 3 ms per iterazione (research R-09); stampare il risultato e annotarlo in research R-09 ("Misura") con data e macchina
- [X] T054 [P] Creare `test/unit/privacy-log.test.ts` (o estendere un test esistente): spiare `console.log` durante `runHourly` con invii riusciti e falliti e durante un tocco Fatto; nessuna riga contiene nome, nickname, telefono, username, testo degli auguri o date di nascita (principio V, RNF-08)
- [X] T055 [P] Aggiornare `README.md`: comandi (`/messaggio`), funzionamento del ciclo orario (slot per priorità, recupero, retry, tetto di 40 invii), migration `0002` applicata da `scripts/deploy.ps1`, verifica CPU dalla dashboard (quickstart §4)
- [X] T056 Verificare che `scripts/deploy.ps1` applichi tutte le migration (`wrangler d1 migrations apply birthday-bot-db --remote`); se applica solo la 0001 per nome, correggerlo
- [X] T057 Eseguire `npm run typecheck`, `npm test` e `npm run bench`; tutti verdi e bench sotto soglia (gate di chiusura 1, 4, 5)
- [ ] T058 Eseguire la prova manuale di quickstart §3 (`wrangler dev --test-scheduled`, `/__scheduled` con `time`) e annotare l'esito; verificare che ogni RF, BR, N e criterio Dato/Quando/Allora della spec sia citato in almeno un test (`grep` degli ID: RF-09…RF-15, RF-03, BR-03…BR-13, BR-24, N-01…N-05, V-04…V-06, RNF-10, RNF-12, RNF-17) (gate di chiusura 2)
- [ ] T059 Dopo il primo deploy, controllare la pagina Metrics della dashboard Cloudflare per il Worker `bot-compleanni`: con almeno 24 ore di esecuzioni, p99 del CPU time dei cron < 7 ms e nessun esito `exceededCpu`; annotare il valore in research R-09. Se il p99 supera 7 ms, abbassare `MAX_SENDS_PER_RUN` in `src/config.ts` e ripetere `npm run bench` (SC-007, gate di chiusura 4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza
- **Foundational (Phase 2)**: dopo Setup; blocca tutte le user story
- **US1 (Phase 3)**: dopo Foundational; contiene il motore del ciclo orario (T023, T024, T026) e il gestore degli esiti (T028…T030) su cui si appoggiano US2, US3, US5, US6
- **US2, US3 (Phase 4, 5)**: dopo US1; indipendenti tra loro (toccano gli stessi file: eseguirle in sequenza)
- **US4 (Phase 6)**: dopo Foundational; indipendente dal ciclo orario per `/messaggio` e il limite 256; lo scenario "testo WhatsApp" richiede US1
- **US5 (Phase 7)**: dopo US1 (riga "L'anno scorso")
- **US6 (Phase 8)**: dopo US1
- **Polish (Phase 9)**: dopo tutte le story; T052 richiede US1, US2, US3 (scenario delle 13)

### Within Each User Story

- Test prima, devono fallire
- `domain/` puro → `db/` → `bot/` render → `cron/` orchestrazione → router
- Story completa prima della successiva in ordine di priorità

### Parallel Opportunities

- Setup: T002, T003 in parallelo
- Foundational: T005, T006, T007 (test) in parallelo; T011, T012 in parallelo; T013 → T014, T015
- US1: T017…T022 (test) in parallelo
- US2: T031, T032, T033 in parallelo; US3: T038, T039, T040 in parallelo
- US4: T043, T044 in parallelo; tutta US4 in parallelo con US2/US3 (file diversi, salvo `src/texts.ts`: coordinare)
- Polish: T053, T054, T055 in parallelo

---

## Parallel Example: User Story 1

```bash
# Test di US1 insieme:
Task: "Creare test/unit/schedule.test.ts (parte giorno)"
Task: "Creare test/unit/promemoria.test.ts (parte reminder)"
Task: "Creare test/integration/us1-reminder.test.ts"
Task: "Creare test/integration/ciclo-idempotenza.test.ts"
Task: "Creare test/integration/ciclo-retry.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1): reminder del giorno con contatti, Fatto/Salta, ciclo idempotente con retry e tetto
3. **STOP e VALIDA**: test di US1 verdi, prova manuale quickstart §3 punti 1–6
4. Deploy possibile: il bot ricorda già i compleanni nel giorno giusto

### Incremental Delivery

1. US1 → MVP
2. US2 → rete di sicurezza (recupero, *non confermato*, correzione)
3. US3 → pre-reminder
4. US4 → `/messaggio` e limite 256
5. US5, US6 → storico e casi limite
6. Polish → verifica budget e CPU (gate di chiusura)

---

## Notes

- [P] = file diversi, nessuna dipendenza da task incompleti
- Ogni test cita l'ID AFU (principio XI)
- Commit dopo ogni task o gruppo logico (senza righe di attribuzione)
- Fermarsi a ogni checkpoint per validare la story
