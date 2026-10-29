---

description: "Task list per la feature 007 — Revisioni v1.1, Stato e statistiche"
---

# Tasks: Revisioni v1.1 — Stato e statistiche

**Input**: documenti di progetto in `specs/007-revisioni-v1-1-stato-statistiche/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-11), data-model.md,
contracts/ciclo-orario-v11.md, contracts/stato.md, contracts/statistiche.md, quickstart.md

**Tests**: OBBLIGATORI (constitution principio X, SC-001). Ogni `describe`/`it` MUST citare l'ID AFU
o FR verificato (principio XI), es. `it("N-06, FR-005: buco 14:00 → 19:00 → un avviso", …)`.
Dentro ogni fase i test si scrivono per primi e devono fallire prima dell'implementazione, salvo i
test di **regressione** (indicati come tali) che passano già oggi. La mappa criterio → test è in
quickstart.md.

**Organization**: ordine richiesto dal proprietario — (1) chiavi tecniche ed esclusione da
backup/ripristino, (2) registrazione nel ciclo orario e nel backup mensile, (3) N-06 avviso di buco
(US2), (4) `/stato` (US1), (5) `/statistiche` (US3), (6) testi di `/aiuto` e menu dei comandi,
(7) bench, smoke Postman e gate. US1 e US2 sono entrambe P1: US2 viene prima perché scrive i dati
che `/stato` legge; le tre storie restano verificabili in modo indipendente.

**Nota sui testi**: le chiavi **nuove** di `src/texts.ts` necessarie a una storia (`gapAlert`, testi
di `/stato`, testi di `/statistiche`) entrano nella fase di quella storia, perché il codice non
compila senza; la fase 6 aggiunge le voci di `/aiuto` e di `BOT_COMMANDS` e verifica tutte le
stringhe nuove contro i mockup AFU §5.10–§5.12.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1 `/stato`, US2 avviso di buco, US3 `/statistiche`)

## Convenzioni valide per tutti i task

- Valgono le convenzioni di `specs/001…006/tasks.md`: testi solo in `src/texts.ts` (stringhe esatte
  dai contratti), costanti solo in `src/config.ts`, fuso Europe/Rome solo in `src/time.ts`, log solo
  con nomi di evento, codici e numeri tramite `src/log.ts` — **mai nomi, testi di errore del webhook
  o valori delle chiavi** (principio V, RNF-08). Nessun `new Date()` fuori da `src/index.ts`
  (`deps.now()` e `scheduledAt` iniettati). **Nessun `parse_mode`.**
- **Nessuna migration, nessun indice nuovo, nessuna dipendenza nuova, nessuna conversione di dati**
  (FR-019, FR-021, FR-023). `test/integration/schema.test.ts` resta invariato.
- Chiavi tecniche: `cron_last_run` = ISO UTC dell'ora piena prevista
  (`toIso(floorToHour(scheduledAt))`, es. `2026-10-29T14:00:00.000Z`); `auto_backup_last` = JSON
  `{"at":"<ISO UTC del reclamo>","esito":"in_invio"|"riuscito"|"non_riuscito"}`; `auto_backup`
  acquisisce lo stato `errore` (data-model.md). Riga assente = "mai registrato".
- Tipi di invio in `deliveries.kind`: `pre` (pre-reminder, `ref` = giorni prima), `giorno`
  (reminder, `ref` = slot), `recupero` (`src/domain/schedule.ts`).
- **Funzioni riusate, mai duplicate**: `sendLines` di `src/bot/liste.ts`, `sortGroups` di
  `src/domain/viste.ts`, `MONTHS_IT` di `src/texts.ts`, `floorToHour`/`toIso`/`toLocal`/`addDays`/
  `toDateString` di `src/time.ts`, `syncBotCommands` di `src/cron/comandi.ts`.
- `src/domain/stato.ts` e `src/domain/statistiche.ts` restano **puri** (nessun import di
  `cloudflare:*` o `src/db/*`): girano nel bench in Node.
- I task che modificano lo stesso file non sono [P] tra loro: in particolare `src/texts.ts`,
  `src/config.ts`, `src/db/settings.ts`, `src/domain/stato.ts`, `src/bot/commands.ts`,
  `test/unit/stato.test.ts`, `test/integration/viste-budget.test.ts`,
  `postman/bot-compleanni.postman_collection.json`.
- Test di integrazione: D1 locale, `FakeTelegram`, helper `say`/`send` di `test/helpers/send.ts`,
  `runCron`/`scheduledAt` di `test/helpers/cron.ts`, `makeDeps({ now })`, seed con `insertPerson` di
  `test/helpers/db.ts`. Solo dati sintetici (principio V).

---

## Phase 1: Chiavi tecniche ed esclusione da backup e ripristino (Foundational)

**Purpose**: definire i dati tecnici delle Impostazioni e fissare con test di regressione che
backup e ripristino non li toccano (§8, FR-001…FR-003, FR-022; research R-01, R-06).

**⚠️ CRITICAL**: blocca le fasi 2–5.

- [X] T001 In `src/db/settings.ts` aggiungere, con commento che cita §8 e research R-01: `export const CRON_LAST_RUN_KEY = "cron_last_run"`, `export const AUTO_BACKUP_LAST_KEY = "auto_backup_last"`, `export type AutoBackupEsito = "in_invio" | "riuscito" | "non_riuscito"`, `export interface AutoBackupLast { at: string; esito: AutoBackupEsito }` e `export const TECHNICAL_KEYS = [BOT_COMMANDS_KEY, AUTO_BACKUP_KEY, CRON_LAST_RUN_KEY, AUTO_BACKUP_LAST_KEY] as const` (documentale, usata dai test: "non entrano nel backup, il ripristino non le modifica"). Nessuna funzione nuova in questo task (FR-001).
- [X] T002 [P] Aggiungere in `test/integration/us2-backup.test.ts` un `describe("§8, FR-002, SC-005: backup senza dati tecnici")` (regressione): con `default_message` e tutte le `TECHNICAL_KEYS` presenti in `settings`, `/backup` produce un JSON il cui `settings` ha come unica chiave `default_message`; stessa verifica sul file inviato da `runMonthlyBackup` (dovuto il 1° del mese alle 9:00 locali). Dipende da T001.
- [X] T003 [P] Aggiungere in `test/integration/us2-ripristino.test.ts` un `describe("§8, FR-003, FR-022, SC-005: ripristino e dati tecnici")` (regressione): con le `TECHNICAL_KEYS` presenti, il ripristino di `fixtures/backup-ok.json` lascia `value` e `updated_at` di ciascuna identici; un file con `settings.cron_last_run` e `settings.auto_backup_last` in più è accettato, ripristina `default_message` e ignora le chiavi tecniche; un backup creato prima del rilascio (fixture esistente, `BACKUP_FORMAT_VERSION` invariata) resta ripristinabile. Dipende da T001.
- [X] T004 [P] Aggiungere in `test/unit/backup.test.ts` un `describe("§8, FR-002, FR-003: chiavi tecniche")` (regressione): `validate` accetta un backup con `settings` che contiene, oltre a `default_message`, `cron_last_run` e `auto_backup_last`; `buildBackup` restituisce `settings` con la sola chiave `default_message`.
- [X] T005 [P] In `src/db/backup.ts` estendere i commenti di `backupReadStatements` e `restoreGuardedStatements`: le chiavi di `TECHNICAL_KEYS` (`bot_commands`, `auto_backup`, `cron_last_run`, `auto_backup_last`) non entrano nel file e non sono toccate dal ripristino, che opera solo su `DEFAULT_MESSAGE_KEY` (§8, FR-002, FR-003, research R-06). Nessuna modifica di comportamento: T002–T004 verdi.

**Checkpoint**: `npm test -- backup ripristino` verde; nessun cambiamento di comportamento.

---

## Phase 2: Registrazione nel ciclo orario e nel backup mensile (Foundational)

**Purpose**: scrivere `cron_last_run` all'inizio di ogni esecuzione, `sent_at` al reclamo e l'esito
di ogni tentativo di backup mensile (N-06, RF-31, FR-004, FR-008, FR-010, FR-020; research R-02,
R-04, R-05).

**⚠️ CRITICAL**: blocca le fasi 3 e 4.

### Tests

- [X] T006 [P] Aggiungere in `test/integration/ciclo-idempotenza.test.ts` un `describe("N-06, FR-004, FR-020: registrazione di cron_last_run")`: senza riga, un'esecuzione con `scheduledAt = 2026-10-29T13:03:12Z` scrive `cron_last_run = "2026-10-29T13:00:00.000Z"`; l'esecuzione dell'ora dopo lo aggiorna; la riesecuzione della stessa ora lo lascia uguale; un'esecuzione tardiva di un'ora precedente (20:00 poi 19:00 locali) non lo riporta indietro; un guasto durante gli invii (Telegram che lancia un errore non `TelegramError` dopo il reclamo) lascia il valore registrato; un guasto della batch di lettura non scrive nulla (`cron_error` come oggi). Verificare anche che la batch di lettura resti **una** chiamata D1.
- [X] T007 [P] Aggiornare `test/integration/ciclo-retry.test.ts` (research R-04, FR-010): le righe `in_invio` appena reclamate hanno `sent_at = nowIso` del reclamo (sia insert sia `UPDATE` dei retry); esito di successo → `sent_at` = istante di invio (invariato); esito di errore → `status = 'fallito'` e `sent_at IS NULL`. Sostituire le asserzioni esistenti che si aspettano `sent_at NULL` sulle righe `in_invio`.
- [X] T008 [P] Aggiornare `test/integration/us3-backup-mensile.test.ts` con un `describe("RF-31, FR-008: esito del backup mensile")`: successo → `auto_backup = AAAA-MM:inviato` e `auto_backup_last = {"at": <istante del reclamo>, "esito": "riuscito"}`; `TelegramError` → `AAAA-MM:fallito`, `esito: "non_riuscito"`, ritentato all'ora dopo con un `at` nuovo (004 FR-023a invariato); errore non Telegram (es. `sendDocument` del fake che lancia `Error`) → `AAAA-MM:errore`, `esito: "non_riuscito"`, eccezione **non** propagata, `log("auto_backup", { sent: false, error_code: 0 })`, nessun nuovo tentativo nelle ore successive del mese; solo reclamo senza esito (interruzione simulata chiamando `claimAutoBackup` da solo) → `esito: "in_invio"`; `/backup` su richiesta non crea né modifica `auto_backup_last`; FR-020 con `auto_backup = 2026-09:inviato` già presente e `auto_backup_last` assente, il primo tentativo di ottobre crea `auto_backup_last`. Sostituire il test esistente che si aspetta la propagazione dell'errore non Telegram.

### Implementation

- [X] T009 In `src/db/settings.ts` aggiungere `cronLastRunStatements(db, currentIso, nowIso): [D1PreparedStatement, D1PreparedStatement]`: (1) `SELECT value FROM settings WHERE key = ?` su `CRON_LAST_RUN_KEY`; (2) `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE excluded.value > settings.value` (anti-regressione, N-06, FR-004, research R-02). Dipende da T001.
- [X] T010 In `src/db/reminders.ts`: `readStatements` riceve anche `currentRunIso` e `nowIso` e mette in testa i due statement di `cronLastRunStatements` (stessa batch, 0 subrequest in più); `insertDeliveries(..., "in_invio", ...)` e l'`UPDATE` dei retry in `claimStatements` scrivono `sent_at = nowIso`; in `resultStatements` l'esito di errore imposta `sent_at = NULL` (FR-004, FR-010, research R-02, R-04). Aggiungere il parametro `nowIso` dove manca. Dipende da T009.
- [X] T011 In `src/cron/hourly.ts`, `runHourly`: calcolare `currentRunIso = toIso(floorToHour(scheduledAt))`, passarlo con `toIso(deps.now())` a `readStatements` e destrutturare `[lastRunRes, , defRes, candRes, occRes, retryRes]`; conservare `previousRunIso = lastRunRes.results[0]?.value ?? null` (usato in T022). Nessun avviso in questo task. T006 e T007 verdi; adeguare gli altri test di `test/integration/ciclo-*.test.ts` e `test/integration/scheduled.test.ts` solo se contano gli statement della batch. Dipende da T010.
- [X] T012 In `src/db/settings.ts` riscrivere il backup mensile (RF-31, FR-008, research R-05): `claimAutoBackup(db, month, nowIso): Promise<{ attemptIso: string } | null>` come `db.batch` di 2 statement — il reclamo esistente con `WHERE settings.value NOT IN (? || ':in_invio', ? || ':inviato', ? || ':errore')` e l'upsert di `AUTO_BACKUP_LAST_KEY = {"at": nowIso, "esito": "in_invio"}` condizionato a `EXISTS (SELECT 1 FROM settings WHERE key = 'auto_backup' AND value = ? || ':in_invio' AND updated_at = ?)`; `setAutoBackupResult(db, month, stato: "inviato" | "fallito" | "errore", attemptIso, esito: "riuscito" | "non_riuscito", nowIso)` come `db.batch` di 2 statement (stato di `auto_backup`, `auto_backup_last = {"at": attemptIso, esito}`). Dipende da T009 (stesso file).
- [X] T013 In `src/cron/backup-mensile.ts`, `runMonthlyBackup`: usare `attempt = await claimAutoBackup(...)` (null → `return null`); successo → `setAutoBackupResult(month, "inviato", attempt.attemptIso, "riuscito", …)`; `TelegramError` → `"fallito"`, `"non_riuscito"`, `log("auto_backup", { sent: false, error_code })`; **ogni altro errore** → `"errore"`, `"non_riuscito"`, `log("auto_backup", { sent: false, error_code: 0 })`, `return { sent: false }` senza rilanciare; aggiornare il commento (FR-008, chiarimento 4, contracts/ciclo-orario-v11.md). T008 verde. Dipende da T012.

**Checkpoint**: `npm test` verde; dopo un'esecuzione oraria `cron_last_run` esiste, nessun avviso ancora.

---

## Phase 3: User Story 2 — Avviso di buco del cron (Priority: P1) 🎯 MVP

**Goal**: alla prima esecuzione dopo un'interruzione di oltre 2 ore reali il proprietario riceve un
solo avviso con l'intervallo scoperto (N-06, D-28; FR-005…FR-007).

**Independent Test**: `cron_last_run` alle 14:00 e esecuzioni alle 15:00, 16:00, 17:00 e 19:00;
prima esecuzione senza riga; verificare quando parte l'avviso e il testo esatto (AFU §5.12).

### Tests for User Story 2 ⚠️

- [X] T014 [US2] Creare `test/unit/stato.test.ts` con `describe("N-06, FR-005: detectGap")` e `it.each` tabellare dei casi di contracts/ciclo-orario-v11.md: `null`/stringa non valida → `null`; 14:00 → 15:00 `null`; 14:00 → 16:00 `null` (esattamente 2 h); 14:00 → 17:00 buco; 14:00 → 19:00 `{ from: 14:00, to: 19:00 }`; stessa ora → `null`; 20:00 → 19:00 (tardiva) → `null`; 23:00 del 28/10 → 3:00 del 29/10 buco; passaggio all'ora legale `2026-03-29T00:00:00Z` (1:00 CET) → `2026-03-29T01:00:00Z` (3:00 CEST) `null`; ritorno all'ora solare `2026-10-25T00:00:00Z` (2:00 CEST) → `2026-10-25T01:00:00Z` (2:00 CET) `null`. Aggiungere `describe("N-06, FR-006, AFU §5.12: T.gapAlert")`: stesso giorno = oggi → `⚠️ Il controllo orario non è girato dalle 14:00 alle 19:00 di oggi:\nalcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.`; giorni diversi → `dalle 23:00 del 28/10 alle 3:00 del 29/10`; ore senza zero iniziale.
- [X] T015 [P] [US2] Aggiungere in `test/unit/time.test.ts` un `describe("N-06, RF-31, principio VI: toLocalClock")`: `2026-10-29T14:05:00Z` → `{ year: 2026, month: 10, day: 29, hour: 15, minute: 5 }`; un istante in ora legale (`2026-07-01T07:00:00Z` → 9:00); le due 2:00 del 25/10/2026 (`00:00Z` e `01:00Z`) → `hour: 2` entrambe; `toLocal` invariata.
- [X] T016 [P] [US2] Creare `test/integration/v11-buco-cron.test.ts` con `describe("N-06: avviso di buco")`: US2-1 `cron_last_run` 14:00 locali, esecuzione alle 19:00 → un `sendMessage` al proprietario con il testo di T014; US2-2 esecuzioni orarie consecutive → nessun avviso; US2-3 nessuna riga (prima esecuzione dopo il deploy, FR-020) → nessun avviso e riga creata; US2-4 avviso alle 19:00, esecuzione alle 20:00 → nessun secondo avviso; US2-5 buco 14→19 con persone nello slot delle 18 → nessun invio dello slot perso, partono solo invii dell'ora corrente, retry della giornata e backup mensile dovuto (N-04, FR-007). Casi limite: esattamente 2 h → nessun avviso; mezzanotte e più giorni → testo con le date; cambio d'ora nei due versi → nessun avviso; avviso inviato **prima** del primo promemoria (ordine delle chiamate del fake); con 40 invii reclamabili l'avviso non riduce i promemoria (`MAX_SENDS_PER_RUN` invariato, `report.claimed = 40`); `TelegramError` sull'avviso → promemoria inviati comunque, `cron_last_run` aggiornato, `log("gap_alert", { sent: false, error_code })`, nessun avviso all'ora dopo; riesecuzione della stessa ora → nessun avviso; guasto durante gli invii → all'ora dopo nessun avviso.
- [X] T017 [P] [US2] Aggiornare `test/integration/ciclo-budget.test.ts` con `it("RNF-17, R-11: caso peggiore 48 subrequest")`: buco + 40 invii + backup mensile dovuto → 3 + 3 D1 e 42 Telegram, totale 48 ≤ 50; la regola che salta il menu quando il ciclo ha reclamato invii o il backup ha inviato resta invariata. Aggiungere `it("RNF-17, FR-008: errore non Telegram del backup senza invii → menu sincronizzato entro il budget")`: nessun invio reclamato, buco presente, `sendDocument` che lancia `Error` → `runMonthlyBackup` restituisce `{ sent: false }`, `setMyCommands` chiamato una volta, subrequest totali ≤ 50 (≈ 9).

### Implementation for User Story 2

- [X] T018 [P] [US2] In `src/config.ts` aggiungere `export const GAP_ALERT_THRESHOLD_HOURS = 2` con commento "N-06, D-28: avviso oltre 2 ore reali tra le ore piene previste".
- [X] T019 [P] [US2] In `src/time.ts` aggiungere `export interface LocalClock extends LocalDateTime { minute: number }` e `export function toLocalClock(d: Date): LocalClock` con un secondo `Intl.DateTimeFormat` Europe/Rome che include `minute` (research R-09, principio VI); `toLocal` invariata. T015 verde.
- [X] T020 [US2] In `src/texts.ts` aggiungere un helper interno `clock(c: LocalClock)` (`H:MM`, ora senza zero iniziale, minuti a due cifre) e `gapAlert: (from: LocalClock, to: LocalClock, today: LocalDate) => string` con i due formati di T014: "dalle H:MM alle H:MM di oggi" se le due date locali coincidono con `today`, altrimenti "dalle H:MM del GG/MM alle H:MM del GG/MM" (N-06, FR-006, AFU §5.12). Dipende da T019.
- [X] T021 [US2] Creare `src/domain/stato.ts` (puro) con `export function detectGap(lastIso: string | null, currentIso: string): { from: Date; to: Date } | null`: `null` se `lastIso` è nullo o `Date.parse` dà `NaN`; buco se `Date.parse(currentIso) − Date.parse(lastIso) > GAP_ALERT_THRESHOLD_HOURS × 3 600 000` (N-06, FR-005, research R-03). T014 verde. Dipende da T018, T020.
- [X] T022 [US2] In `src/cron/hourly.ts`: aggiungere a `RunReport` il campo `gapAlert: "none" | "sent" | "failed"`; subito dopo la batch di lettura e prima della selezione e del reclamo, `gap = detectGap(previousRunIso, currentRunIso)`; se presente, **un solo** `deps.tg.sendMessage(Number(deps.ownerId), T.gapAlert(toLocalClock(gap.from), toLocalClock(gap.to), today))` in `try/catch`: successo → `log("gap_alert", { sent: true, hours })`; errore → `log("gap_alert", { sent: false, error_code })` (0 se non `TelegramError`), nessun retry, nessuna scrittura. Non conta in `MAX_SENDS_PER_RUN` né in `report.claimed` (N-06, FR-005, FR-007, research R-03). Adeguare i `toEqual` su `RunReport` in `test/integration/scheduled.test.ts`. T016 verde. Dipende da T011, T021.
- [X] T023 [P] [US2] In `src/cron/scheduled.ts` aggiornare il commento sul budget: caso peggiore 48 = 3 D1 + 40 promemoria + 1 avviso + 3 D1 + 1 backup (RNF-17, research R-11); un errore non Telegram del backup mensile ora restituisce `{ sent: false }` invece di propagarsi, quindi il menu può partire nella stessa esecuzione (prima veniva saltato), sempre entro il budget perché senza invii reclamati. Nessuna modifica di logica. T017 verde.

**Checkpoint**: US2 completa e verificabile da sola (`npm test -- buco stato time ciclo-budget`).

---

## Phase 4: User Story 1 — `/stato` (Priority: P1)

**Goal**: con un comando il proprietario vede ultimo controllo orario, invii di oggi e degli ultimi
7 giorni con il dettaglio degli abbandonati, ultimo backup mensile e webhook (RF-31; FR-009…FR-012).

**Independent Test**: storico di invii noto (inviati, falliti, abbandonati, `in_invio` vecchi e
correnti, oggi e giorni precedenti), backup mensile registrato e no, `getWebhookInfo` riuscita e
non riuscita; verificare ogni riga di `/stato` (AFU §5.10).

### Tests for User Story 1 ⚠️

- [X] T024 [P] [US1] Aggiungere in `test/unit/telegram-client.test.ts` un `describe("RF-31: getWebhookInfo")`: risposta `{ ok: true, result: { pending_update_count: 2, last_error_date: 1761746400, last_error_message: "Connection timed out" } }` → `{ pendingUpdateCount: 2, lastErrorDate: new Date(1761746400 * 1000), lastErrorMessage: "Connection timed out" }`; senza campi di errore → solo `pendingUpdateCount`; `ok: false` → `TelegramError`.
- [X] T025 [US1] In `test/helpers/fake-telegram.ts` aggiungere `getWebhookInfo()` con risposta impostabile (`setWebhookInfo(info)`, default `{ pendingUpdateCount: 0 }`) o errore impostabile (`failWebhookInfo(err)`), registrato tra le chiamate come gli altri metodi.
- [X] T026 [US1] Aggiungere in `test/unit/stato.test.ts` un `describe("RF-31, FR-009, FR-011: formatStato")` (dopo T014, stesso file): riga 1 `🩺 Stato del bot`; controllo orario "oggi alle 15:00", "28/10 alle 23:00" se non oggi, "mai registrato"; `📨 Oggi: 3 inviati, 0 falliti, 0 abbandonati` e singolari ("1 inviato", "1 fallito", "1 abbandonato"); riga `📨 Ultimi 7 giorni: 21 inviati, 0 falliti, 1 abbandonato` sempre con i tre conteggi, come la riga di oggi (RF-31, FR-009, AFU §5.10), seguita da una riga `   – <nickname o nome completo>, <tipo> del GG/MM` per abbandonato (`pre` → `pre-reminder a 7 giorni`, `giorno` → `reminder delle 18:00`, `recupero` → `recupero`), nessuna riga se 0; backup `01/10 alle 9:00 ✅`, `… ❌ non riuscito`, `… ⚠️ esito sconosciuto`, "mai registrato"; `parseAutoBackupLast` con JSON non valido → "mai registrato"; webhook `nessun errore, 0 update in coda`, `ultimo errore 29/10 alle 15:00: "<testo>", 2 update in coda`, `non disponibile`.
- [X] T027 [P] [US1] Creare `test/integration/v11-stato.test.ts` con `describe("RF-31: /stato")`: US1-1…US1-7 della spec (cron regolare e 3 reminder oggi; abbandonato di ieri con nome; "mai registrato" senza `cron_last_run`; "mai registrato" senza `auto_backup_last`; ultimo backup fallito per `TelegramError` con data, ora e ❌; webhook con errore e 2 update in coda; `getWebhookInfo` in errore → tutte le altre righe e la sola riga webhook "non disponibile", `log("webhook_info_error", { error_code })`). Casi limite (FR-010): `in_invio` reclamato nell'ora corrente (`sent_at >= ora piena di now`) non contato; `in_invio` di un'ora precedente e `in_invio` con `sent_at NULL` (righe anteriori al deploy, FR-021) contati tra gli abbandonati; cron fermo: `cron_last_run` 14:00, `in_invio` con `sent_at` 14:00:05, `/stato` alle 17:00 → contato tra gli abbandonati; backup mensile ❌ alle 9:00 e ✅ alle 10:00 → `/stato` mostra `01/10 alle 10:00 ✅` (ultimo tentativo); `fallito` di ieri tra gli abbandonati, `fallito` di oggi tra i falliti; invii di 7 giorni fa esclusi, di 6 giorni fa inclusi; dettaglio con i tre tipi; persona eliminata → suoi invii spariti; `/oggi`, `/backup` e avviso di buco non contati; backup `in_invio` → ⚠️ esito sconosciuto; backup con errore non Telegram → ❌; `/backup` non modifica la riga; 001 FR-018 `/stato` durante `/nuovo` interrompe il flusso; 001 FR-027 `/stato` da un estraneo → nessuna chiamata a Telegram.
- [X] T028 [P] [US1] Aggiungere in `test/integration/viste-budget.test.ts` `it("RNF-17, R-07: /stato ≤ 5 subrequest")`: router + 1 batch D1 + 1 `getWebhookInfo` + 1 `sendMessage`.

### Implementation for User Story 1

- [X] T029 [P] [US1] In `src/config.ts` aggiungere `export const STATUS_WINDOW_DAYS = 7` con commento "RF-31: oggi e i 6 giorni precedenti" (FR-010).
- [X] T030 [US1] In `src/telegram/types.ts` aggiungere il tipo grezzo `WebhookInfo` (`pending_update_count: number; last_error_date?: number; last_error_message?: string`); in `src/telegram/client.ts` aggiungere a `TelegramApi` e all'implementazione `getWebhookInfo(): Promise<{ pendingUpdateCount: number; lastErrorDate?: Date; lastErrorMessage?: string }>` (`last_error_date` in secondi Unix → `new Date(s * 1000)`; errori come gli altri metodi, `TelegramError`) (RF-31, contracts/stato.md). T024 verde.
- [X] T031 [US1] In `src/texts.ts` aggiungere i testi di `/stato` di contracts/stato.md (titolo, etichette delle righe, "mai registrato", "oggi alle", "alle", formule dei tipi `pre-reminder a N giorni`/`reminder delle H:00`/`recupero`, conteggi con singolare/plurale, esiti ✅/❌ non riuscito/⚠️ esito sconosciuto, righe del webhook e "non disponibile"), riusando `clock` di T020 (RF-31, AFU §5.10). Dipende da T020.
- [X] T032 [US1] In `src/domain/stato.ts` aggiungere (puro) i tipi `StatoData` (`cronLastRun: string | null`, `autoBackupLast: AutoBackupLast | null`, `today` e `week` con `{ inviati, falliti, abbandonati }`, `abbandonati: { name, kind, ref, localDate }[]`, `webhook: WebhookInfo ridotta | "non_disponibile"`), `parseAutoBackupLast(value: string | null): AutoBackupLast | null` (JSON non valido o `esito` sconosciuto → `null`) e `formatStato(data, now: Date): ListLine[]` con l'ordine e il layout di AFU §5.10 e `toLocalClock` per gli orari ("oggi" = stessa data locale di `now`) (RF-31, FR-009, FR-011, FR-012). T026 verde. Dipende da T021, T031.
- [X] T033 [P] [US1] Creare `src/db/stato.ts` con `statoReadStatements(db, { today, from, hourStartIso }): D1PreparedStatement[]` (3 statement, research R-07): (0) `SELECT key, value FROM settings WHERE key IN ('cron_last_run', 'auto_backup_last')`; (1) aggregato su `deliveries` con `local_date BETWEEN ? AND ?` raggruppato per `local_date = today` e bucket secondo la tabella di data-model.md (`inviato`; `fallito` di oggi; `abbandonato`, `fallito` di giorni precedenti e `in_invio` con `NOT (d.sent_at >= ?)` legato a `hourStartIso`, `sent_at` nullo compreso → abbandonato (research R-04; nessuna sottoquery su `cron_last_run`); `in_invio` corrente escluso nella `WHERE`); (2) dettaglio degli abbandonati con la stessa condizione, `JOIN occurrences` e `persons` per `nickname`, `full_name`, `d.kind`, `d.ref`, `d.local_date`, `ORDER BY d.local_date, d.id`. Nessun indice nuovo (usa `idx_deliveries_retry`). Dipende da T001.
- [X] T034 [US1] Creare `src/bot/stato.ts` con `showStato(ctx)`: `today` da `toLocal(ctx.now())`, `from = addDays(today, -(STATUS_WINDOW_DAYS - 1))`, `hourStartIso = toIso(floorToHour(ctx.now()))`; `Promise.allSettled([db.batch(statoReadStatements(...)), tg.getWebhookInfo()])`; batch rifiutata → rilancia (gestione esistente del router); webhook rifiutato → `"non_disponibile"` e `log("webhook_info_error", { error_code })` (0 se non `TelegramError`; mai il testo dell'errore); poi `sendLines(ctx, formatStato(...))` (RF-31, FR-012, contracts/stato.md). Dipende da T030, T032, T033.
- [X] T035 [US1] In `src/bot/commands.ts` aggiungere `stato: (ctx) => showStato(ctx)` a `COMMANDS` (argomenti ignorati; whitelist e interruzione dei flussi ereditate dal router, 001 FR-018, FR-027) (RF-31, §5.1). T027 e T028 verdi. Dipende da T034.

**Checkpoint**: US1 completa; `/stato` funziona anche con il webhook non leggibile.

---

## Phase 5: User Story 3 — `/statistiche` (Priority: P2)

**Goal**: poche cifre sulla rubrica e la percentuale di *fatto* per anno, senza elenchi (RF-32,
D-29; FR-013…FR-015).

**Independent Test**: rubrica di composizione nota e storico su più anni; ripetere senza storico e
con rubrica vuota; confrontare ogni cifra con il conteggio a mano (SC-004).

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Creare `test/unit/statistiche.test.ts` con `describe("RF-32, FR-013, FR-014: formatStatistiche")`: riga `112 persone · Alta 18 · Media 70 · Bassa 24` e "1 persona"; priorità a 0 sempre presenti; gruppi in ordine `sortGroups` con i gruppi a 0 e `· Senza gruppo N` in fondo solo se N > 0; nessun gruppo → riga "nessun gruppo" senza "Senza gruppo"; `Senza anno di nascita: 23 · Senza contatti: 41`; istogramma `histogramLines` di 12 righe `Gen`…`Dic` con larghezza `STATS_BAR_WIDTH` al mese massimo, barra vuota per 0, almeno 1 blocco per n ≥ 1 (`max(1, round(n × W / max))`), conteggio allineato a destra; `✅ Auguri fatti: 2026 87% · 2025 81%` dal più recente con `Math.round`; anno a 0 fatti → `0%`; senza anni → "non ci sono ancora anni con esiti"; rubrica vuota → 0 persone, 12 righe a zero.
- [X] T037 [P] [US3] Creare `test/integration/v11-statistiche.test.ts` con `describe("RF-32: /statistiche")`: US3-1 rubrica seminata con composizione nota → ogni cifra uguale al conteggio a mano (SC-004); US3-2 senza occorrenze chiuse → frase di FR-014; US3-3 persona in Famiglia e Lavoro contata in entrambi e una volta nel totale; US3-4 nessun compleanno a marzo → riga `Mar` a 0. Casi limite: rubrica vuota; gruppo senza persone a 0; persona nata il 29/02 in febbraio (BR-04); anno con sole occorrenze `aperta` assente; nessun elenco di persone (FR-015); 001 FR-018 interruzione di un flusso; 001 FR-027 estraneo → nessuna risposta.
- [X] T038 [US3] Aggiungere in `test/integration/viste-budget.test.ts` `it("RNF-17, R-08: /statistiche ≤ 4 subrequest")`: router + 1 batch D1 + 1 `sendMessage`. Dopo T028 (stesso file).

### Implementation for User Story 3

- [X] T039 [US3] In `src/config.ts` aggiungere `export const STATS_BAR_WIDTH = 10` con commento "RF-32: blocchi █ del mese con più compleanni". Dopo T029 (stesso file).
- [X] T040 [US3] In `src/texts.ts` aggiungere `MONTHS_SHORT` derivato da `MONTHS_IT` (prime 3 lettere, iniziale maiuscola) e i testi di contracts/statistiche.md: `📊 Statistiche`, riga persone con singolare/plurale e priorità, `Gruppi:`, "nessun gruppo", `Senza gruppo`, `Senza anno di nascita:`, `Senza contatti:`, `🎂 Compleanni per mese`, `✅ Auguri fatti:`, frase senza anni (RF-32, AFU §5.11). Dopo T031 (stesso file).
- [X] T041 [US3] Creare `src/domain/statistiche.ts` (puro) con `histogramLines(counts: readonly number[]): string[]` e `formatStatistiche(data: StatisticheData): ListLine[]` (istogramma in un'entità `pre`, come le liste di 003; gruppi ordinati con `sortGroups`; percentuali `Math.round(fatto * 100 / chiuse)`) (RF-32, FR-013…FR-015, research R-08). T036 verde. Dipende da T039, T040.
- [X] T042 [P] [US3] Creare `src/db/statistiche.ts` con `statisticheReadStatements(db): D1PreparedStatement[]` (4 statement di contracts/statistiche.md): persone (`COUNT(*)`, `SUM(priority = 'alta'|'media'|'bassa')`, `SUM(birth_year IS NULL)`, `SUM(phone IS NULL AND instagram IS NULL AND telegram IS NULL)`, `SUM(NOT EXISTS (SELECT 1 FROM person_groups pg WHERE pg.person_id = p.id))`); gruppi `groups LEFT JOIN person_groups GROUP BY g.id`; mesi `GROUP BY birth_month`; andamento `occurrences WHERE status <> 'aperta' GROUP BY year ORDER BY year DESC` con `SUM(status = 'fatto')` e `COUNT(*)` (RF-32).
- [X] T043 [US3] Creare `src/bot/statistiche.ts` con `showStatistiche(ctx)`: una `db.batch(statisticheReadStatements(db))`, mesi mancanti = 0, `sendLines(ctx, formatStatistiche(...))` (RF-32). Dipende da T041, T042.
- [X] T044 [US3] In `src/bot/commands.ts` aggiungere `statistiche: (ctx) => showStatistiche(ctx)` a `COMMANDS` (RF-32, §5.1). T037 e T038 verdi. Dopo T035 (stesso file).

**Checkpoint**: US3 completa; le cifre coincidono con i conteggi a mano.

---

## Phase 6: Testi di `/aiuto` e menu dei comandi

**Purpose**: rendere visibili i due comandi in `/aiuto` e nel menu di Telegram senza passi manuali
(§5.1, FR-016; research R-10).

- [X] T045 [P] Aggiornare `test/integration/us7-start-aiuto.test.ts` con `it("§5.1, FR-016: /aiuto elenca /statistiche e /stato")`: le due righe subito dopo `/anno [anno] — riepilogo dell'anno`, nell'ordine `/statistiche`, `/stato`.
- [X] T046 [P] Aggiornare `test/integration/menu-comandi.test.ts` con `it("§5.1, FR-016: menu con statistiche e stato")`: `BOT_COMMANDS` contiene `{ command: "statistiche", description: "Statistiche della rubrica e andamento" }` e `{ command: "stato", description: "Salute di cron, invii, backup e webhook" }` dopo `anno`; con l'hash di 005 salvato in `bot_commands`, un ciclo senza invii chiama `setMyCommands` una volta con il menu nuovo e aggiorna l'hash (aggiornamento senza passi manuali, 005 FR-014).
- [X] T047 In `src/texts.ts` aggiungere a `T.help`, dopo la riga di `/anno`, `"/statistiche — statistiche della rubrica e andamento"` e `"/stato — salute di cron, invii, backup e webhook"`, e a `BOT_COMMANDS`, dopo `anno`, le due voci di T046 (§5.1, FR-016). T045 e T046 verdi. Dopo T040 (stesso file).
- [X] T048 Rileggere in `src/texts.ts` tutte le stringhe nuove (`gapAlert`, testi di `/stato` e di `/statistiche`, help, menu) confrontandole con i mockup di `docs/AFU.md` §5.10, §5.11, §5.12 e §5.1 (emoji, punteggiatura, "·", singolari/plurali, "mai registrato"); correggere le differenze e i test unitari collegati (`test/unit/stato.test.ts`, `test/unit/statistiche.test.ts`) (RF-31, RF-32, N-06, principio VIII).

**Checkpoint**: `npm test` verde; `/aiuto` e menu aggiornati.

---

## Phase 7: Bench, smoke Postman e gate di chiusura

**Purpose**: verificare CPU e subrequest (RNF-16, RNF-17, FR-017), privacy dei log (RNF-08,
FR-018), smoke manuale locale e tracciabilità.

- [X] T049 [P] In `bench/ciclo.bench.ts` aggiungere lo scenario con `cron_last_run` presente (nessun buco) e lo scenario "buco + avviso" (`detectGap` + `toLocalClock` + `T.gapAlert`) su ~200 persone; atteso < 0,05 ms in più rispetto allo scenario esistente (FR-017, research R-11).
- [X] T050 [P] Creare `bench/stato.bench.ts`: `formatStato` con ~250 invii nella finestra e 20 abbandonati, `formatStatistiche` con 200 persone, 20 gruppi, 12 mesi e 5 anni (dati sintetici in memoria, solo funzioni pure di `src/domain/`); attesi `/stato` < 1 ms e `/statistiche` ≈ 0,1–0,3 ms, comunque ≤ 10 ms (RNF-17, FR-017, research R-07, R-08).
- [X] T051 [P] Estendere `test/unit/privacy-log.test.ts` con gli eventi nuovi: `gap_alert` (`sent`, `hours` | `error_code`), `auto_backup` con `error_code: 0`, `webhook_info_error` (`error_code`); nessun nome, nickname, testo di errore del webhook o valore delle chiavi tecniche nei log (RNF-08, FR-018, principio V).
- [X] T052 In `postman/bot-compleanni.postman_collection.json` aggiungere la cartella `08b · /stato e /statistiche (RF-31, RF-32, N-06)` subito dopo `08 · /anno (RF-22)` (senza rinumerare le altre): `/stato` (200; Docs con la risposta attesa di AFU §5.10, webhook "nessun errore" o "non disponibile"); "Cron ora" seguito dal controllo su D1 via helper che `cron_last_run` sia l'ora piena corrente in UTC; `/stato` di nuovo (Docs: controllo orario "oggi alle H:00"); `/statistiche` (200; Docs con i totali attesi del seed e 12 righe di istogramma). In `02 · Comandi base` aggiornare la Docs di `/aiuto` con le due righe nuove; in `18 · /modello, /export, /backup` aggiungere alla Docs di `/backup` che `settings` contiene solo `default_message`. Portare `info.version` e la riga "Versione" della descrizione a `2.3.0` (RF-31, RF-32, N-06, §8, §5.1).
- [X] T053 In `postman/README.md` aggiungere la riga della cartella `08b` alla tabella "Cartelle", in "Limiti noti" che l'avviso di buco (N-06) non si prova da Postman (l'helper accetta solo `SELECT`; coperto da `test/integration/v11-buco-cron.test.ts`) e che "Cron ora" scrive `cron_last_run`, e la voce di Changelog `2.3.0` (2026-10-29, feature 007: cartelle toccate, numero totale di richieste). Dipende da T052.
- [X] T054 Eseguire i gate di quickstart.md: `npm run typecheck` senza errori; `npm test` verde, comprese le spec 001–006 (che coprono FR-023 e SC-006: messaggi e dati esistenti invariati), `schema.test.ts` invariato (FR-019) e `privacy-log.test.ts`; `npm run bench` con `bench/ciclo.bench.ts` senza regressioni e `bench/stato.bench.ts` entro le stime (RNF-17, SC-001).
- [X] T055 Verificare che ogni riga della mappa di quickstart.md (RF-31 US1-1…7 e casi limite, N-06 US2-1…5 e casi limite, RF-32 US3-1…4 e casi limite, §8 FR-002/FR-003/FR-022, §5.1 FR-016, RNF-08, RNF-17, 001 FR-018/FR-027) abbia almeno un test che ne cita l'ID nel nome (principio XI, SC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Chiavi tecniche)**: nessuna dipendenza; blocca 2–5.
- **Phase 2 (Registrazione)**: dopo 1; blocca 3 (serve `previousRunIso`) e 4 (`/stato` legge
  `cron_last_run`, `auto_backup_last` e `sent_at`).
- **Phase 3 (US2, avviso di buco)**: dopo 2.
- **Phase 4 (US1, `/stato`)**: dopo 2; usa `clock` di T020 e `toLocalClock` di T019 e condivide
  `src/domain/stato.ts` e `test/unit/stato.test.ts` con la fase 3, quindi va dopo 3.
- **Phase 5 (US3, `/statistiche`)**: dipende solo dalla fase 1 sul codice; eseguita dopo 4 per
  l'ordine richiesto e per i file condivisi (`src/texts.ts`, `src/config.ts`,
  `src/bot/commands.ts`, `viste-budget.test.ts`).
- **Phase 6 (Testi e menu)**: dopo 4 e 5 (i comandi devono esistere prima di essere elencati).
- **Phase 7 (Bench, Postman, gate)**: dopo 6.

### User Story Dependencies

- **US2 (P1)**: dipende dalle fasi 1–2; verificabile da sola (T014–T017).
- **US1 (P1)**: dipende dalle fasi 1–2 e dagli helper di tempo e testo di US2 (T019, T020);
  verificabile da sola (T024–T028).
- **US3 (P2)**: nessuna dipendenza da US1/US2 sul comportamento; verificabile da sola (T036–T038).

### Within Each Phase

- Test prima dell'implementazione (devono fallire, salvo le regressioni della fase 1).
- `settings.ts` → `reminders.ts` → `hourly.ts`; `settings.ts` → `backup-mensile.ts`.
- `config.ts`/`time.ts` → `texts.ts` → `domain/` → `db/` → `bot/` → `commands.ts`.

---

## Parallel Opportunities

Solo task su file diversi e senza dipendenze da task incompleti:

- **Phase 1**: T002 (`us2-backup.test.ts`), T003 (`us2-ripristino.test.ts`), T004
  (`backup.test.ts`), T005 (`src/db/backup.ts`) dopo T001.
- **Phase 2, test**: T006 (`ciclo-idempotenza.test.ts`), T007 (`ciclo-retry.test.ts`), T008
  (`us3-backup-mensile.test.ts`).
- **Phase 3**: T015, T016, T017 in parallelo tra loro e con T014; T018 (`config.ts`) e T019
  (`time.ts`) in parallelo; T023 (`scheduled.ts`) indipendente.
- **Phase 4**: T024, T027, T028 in parallelo (T027 dopo T025); T029 (`config.ts`) e T033
  (`src/db/stato.ts`) in parallelo con T030.
- **Phase 5**: T036 e T037 in parallelo; T042 (`src/db/statistiche.ts`) in parallelo con T039–T041.
- **Phase 6**: T045 e T046 in parallelo.
- **Phase 7**: T049, T050, T051 in parallelo; T052 → T053 → T054 → T055 in sequenza.

Nessun [P] su `src/texts.ts`, `src/config.ts`, `src/db/settings.ts`, `src/domain/stato.ts`,
`src/cron/hourly.ts`, `src/bot/commands.ts`, `test/unit/stato.test.ts`,
`test/integration/viste-budget.test.ts` e sulla collection Postman.

### Parallel Example: Phase 2 (test)

```text
Task: "T006 Registrazione di cron_last_run in test/integration/ciclo-idempotenza.test.ts"
Task: "T007 sent_at al reclamo in test/integration/ciclo-retry.test.ts"
Task: "T008 Esito del backup mensile in test/integration/us3-backup-mensile.test.ts"
```

### Parallel Example: User Story 2

```text
Task: "T015 [US2] toLocalClock in test/unit/time.test.ts"
Task: "T016 [US2] Avviso di buco in test/integration/v11-buco-cron.test.ts"
Task: "T017 [US2] Budget 48 in test/integration/ciclo-budget.test.ts"
Task: "T018 [US2] GAP_ALERT_THRESHOLD_HOURS in src/config.ts"
Task: "T019 [US2] toLocalClock in src/time.ts"
```

### Parallel Example: User Story 3

```text
Task: "T036 [US3] formatStatistiche in test/unit/statistiche.test.ts"
Task: "T037 [US3] /statistiche in test/integration/v11-statistiche.test.ts"
Task: "T042 [US3] statisticheReadStatements in src/db/statistiche.ts"
```

---

## Implementation Strategy

### MVP First (User Story 2)

1. Phase 1: chiavi tecniche e regressioni di backup/ripristino.
2. Phase 2: `cron_last_run`, `sent_at` al reclamo, esito del backup mensile.
3. Phase 3: avviso di buco.
4. **STOP e VALIDA**: T014–T017 verdi; il bot segnala da solo un cron fermo (D-28).

### Incremental Delivery

1. Fasi 1–3 → dati tecnici registrati e avviso di buco (MVP).
2. Fase 4 → `/stato` (controllo su richiesta).
3. Fase 5 → `/statistiche`.
4. Fase 6 → `/aiuto` e menu aggiornati (il menu si registra al primo ciclo senza invii).
5. Fase 7 → bench, Postman 2.3.0 e gate; deploy con `scripts/deploy.ps1` invariato (nessuna
   migration). Verifica manuale in produzione come da quickstart.md.

---

## Notes

- [P] = file diversi, nessuna dipendenza da task incompleti.
- Ogni test cita l'ID AFU/FR nel nome (principio XI).
- Commit dopo ogni fase (messaggi senza attribuzioni, regole globali del proprietario).
- Nessuna conversione dei dati in produzione: persone, gruppi, occorrenze, invii e messaggi restano
  identici (SC-006); le chiavi tecniche nascono vuote (FR-020).
