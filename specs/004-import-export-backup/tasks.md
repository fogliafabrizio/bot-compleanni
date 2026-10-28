---

description: "Task list per la feature 004 — Import, export e backup"
---

# Tasks: Import, export e backup

**Input**: documenti di progetto in `specs/004-import-export-backup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (comandi.md, csv.md,
backup-json.md, flussi.md, backup-mensile.md, telegram-file.md), quickstart.md

**Tests**: OBBLIGATORI. La constitution (principio X) e SC-001 chiedono almeno un test per ogni
criterio Dato/Quando/Allora. Ogni `describe`/`it` MUST citare l'ID AFU o FR verificato
(principio XI), es. `it("RF-24, BR-14: due righe uguali nello stesso file → la seconda è un duplicato", …)`.
I test di ogni story si scrivono per primi e devono fallire prima dell'implementazione. La colonna
"#" di quickstart.md §2 indica lo scenario coperto.

**Organization**: task raggruppati per user story (US1…US4 della spec), in ordine di priorità.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1…US4)

## Convenzioni valide per tutti i task

- Valgono le convenzioni di `specs/001-fondamenta-anagrafica/tasks.md`, `specs/002-promemoria-esiti/tasks.md`
  e `specs/003-viste-ricerche/tasks.md`: testi solo in `src/texts.ts` (stringhe esatte dai
  contratti), costanti solo in `src/config.ts`, log solo con codici e numeri tramite `src/log.ts`
  (mai nomi, date, contenuti di file), nessun `new Date()` fuori da `src/index.ts`,
  `today = toLocal(ctx.deps.now())`. **Nessun `parse_mode`.**
- **Nessuna migration, nessuna dipendenza nuova** (plan.md). Parser CSV, `FormData`, `Blob`,
  `TextDecoder`, `TextEncoder` dal runtime.
- **Funzioni pure riusate, mai duplicate** (research R-04): `cleanText`, `normKey`, `searchKey`,
  `sortNames` di `src/domain/text.ts`; `parseBirthDate`, `formatShort` di `src/domain/date.ts`;
  `normalizePhone` di `src/domain/phone.ts`; `normalizeUsername` di `src/domain/username.ts`;
  `validateGreeting` di `src/domain/greeting.ts`; `splitMessage`/`plainLine` di `src/bot/liste.ts`;
  `TEXT_LIMITS`, `DEFAULT_PRIORITY`, `MIN_BIRTH_YEAR` esistenti in `src/config.ts`.
- I moduli `src/domain/csv.ts`, `src/domain/import.ts`, `src/domain/backup.ts` sono **puri**: nessun
  import di `cloudflare:*`, di `src/db/*` né di `src/bot/*` (girano nel bench in Node).
- Ogni scrittura multipla è **una** `db.batch` con `flowGuardSql` di `src/db/conversation.ts` su ogni
  statement e `consumeStatement` in coda (research R-07, R-09). Le righe passano come **un solo
  parametro JSON** letto con `json_each`/`json_extract` (≤ 100 parametri per statement).
- Vincoli dei valori (contracts/csv.md, backup-json.md): `nome` "obbligatorio, `cleanText`, max 60";
  `nickname` "`cleanText`, max 60"; `data` "`gg/mm/aaaa` o `gg/mm`; anno 1900…anno corrente; 29/02
  solo senza anno o con anno bisestile"; `telefono` "E.164 8–15 cifre, +39 di default"; username
  "`@` iniziale rimossa"; gruppo "`cleanText` max 30"; `priorita` "`alta`, `media`, `bassa` senza
  maiuscole; vuota = `media`"; `messaggio` "`validateGreeting` (256, `{nome}` vale 60)";
  `occurrences.status` "`aperta|fatto|saltato|non_confermato`"; `effective_date` "data reale
  `AAAA-MM-GG`"; import "massimo 500 righe di dati"; file ricevuti "≤ 20 MB (Telegram) e ≤ 1 MiB
  (tetto tecnico)".
- I task che modificano lo stesso file tra `src/texts.ts`, `src/config.ts`, `src/bot/router.ts`,
  `src/bot/commands.ts`, `src/bot/file.ts`, `src/db/settings.ts`, `test/helpers/fake-telegram.ts`
  non sono [P] tra loro.
- Test di integrazione: D1 locale, `FakeTelegram`, helper `say`/`press`/`send` di
  `test/helpers/send.ts`, `makeDeps({ now })`, `makeCronDeps`/`runAt` di `test/helpers/cron.ts`,
  seed con `insertPerson`/`insertGroup`/`addToGroup`/`insertOccurrence` di `test/helpers/db.ts`.
  Data di riferimento salvo diversa indicazione: `NOW` = 2026-10-28T10:00Z = **mercoledì
  28/10/2026, 11:00 Europe/Rome**. Solo dati sintetici (principio V).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: costanti e tipi comuni

- [X] T001 In `src/config.ts` aggiungere, con commento e ID AFU/FR: `IMPORT_MAX_ROWS = 500` (FR-008a), `TELEGRAM_DOWNLOAD_MAX_BYTES = 20 * 1024 * 1024` (V-07, FR-026), `RECEIVED_FILE_MAX_BYTES = 1024 * 1024` (FR-026, research R-01), `CSV_COLUMNS = ["nome", "nickname", "data", "telefono", "instagram", "telegram", "gruppi", "priorita", "messaggio"] as const` (BR-18, FR-001), `CSV_REQUIRED_COLUMNS = ["nome", "data"] as const`, `CSV_EXPORT_SEPARATOR = ";"` (FR-005a), `CSV_GROUP_SEPARATOR = "|"` (BR-20), `BACKUP_FORMAT = "bot-compleanni-backup"`, `BACKUP_FORMAT_VERSION = 1` (research R-08), `AUTO_BACKUP_DAY = 1`, `AUTO_BACKUP_HOUR = 9` (RF-27, A-03), `DOCUMENT_CAPTION_MAX_LENGTH = 1024` (research R-02), `IMPORT_ERROR_VALUE_MAX = 30`, `PREVIEW_GROUPS_PER_LINE = 10`, `PREVIEW_MAX_MESSAGES = 30` (anteprima limitata, research R-04, R-06, R-12, chiarimento 2026-10-29)
- [X] T002 [P] In `src/telegram/types.ts` aggiungere `export interface Document { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number }` e in `Message` i campi `document?: Document`, `caption?: string` e `photo?: { file_id: string }[]` (contracts/telegram-file.md; `mime_type`, `caption` e `photo` non usati per scaricare né per decidere il tipo, research R-13)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: invio e ricezione di file, fake di test, parser/serializzatore CSV, flussi nuovi,
instradamento dei documenti. **Nessuna story può iniziare prima della fine di questa fase.**

### Test della fase (scrivere prima)

- [X] T003 [P] Estendere `test/unit/telegram-client.test.ts` con fetch simulato: `it("RNF-09, R-02: sendDocument invia multipart con chat_id, document (Blob con nome file) e caption, senza parse_mode", …)` (senza caption il form non ha la chiave); `getFile` invia JSON `{ file_id }` e restituisce `file_path`; `downloadFile` fa `GET https://api.telegram.org/file/bot<token>/<file_path>` e restituisce i byte; errore HTTP → `TelegramError` con lo status e **senza il token** nel messaggio
- [X] T004 [P] Creare `test/unit/csv.test.ts` per `src/domain/csv.ts` (contracts/csv.md, quickstart #5, #9, #14): `decodeUtf8` con e senza BOM (BOM rimosso), byte ANSI (`0xE0`) → `{ ok: false }`; `parseCsv` con `;` e con `,` danno gli stessi record (`BR-19`); separatore scelto contando fuori dalle virgolette nell'intestazione, a parità `;`; campo tra virgolette con `;`, `,`, `""` e a capo letto come un valore; terminatori `\r\n` e `\n`; numero di riga = indice del record (intestazione = 1), un campo multilinea resta una riga, righe vuote numerate ma marcate vuote (`FR-009`); stop oltre `IMPORT_MAX_ROWS` record di dati non vuoti → `tooManyRows` (500 ok, 501 rifiutato, `FR-008a`); `writeCsv` produce BOM + `;` + `\r\n` e mette tra virgolette i valori con `;`, `,`, `"`, `\r`, `\n` raddoppiando `"` (`FR-005a`); round-trip `parseCsv(decodeUtf8(writeCsv(rows)))` identico
- [X] T005 [P] Estendere `test/unit/commands-parse.test.ts`: `parseCommand("/modello")`, `"/export"`, `"/backup"`, `"/ripristina"` riconosciuti e presenti in `COMMANDS`

### Implementazione della fase

- [X] T006 In `src/telegram/client.ts` aggiungere a `TelegramApi` e all'implementazione: `sendDocument(chatId, file: { name: string; content: Uint8Array; mimeType: string }, caption?: string): Promise<{ message_id: number }>` (`POST /sendDocument`, `FormData` con `chat_id`, `document` = `new Blob([content], { type: mimeType })` con nome file, `caption` solo se presente; nessun `parse_mode`); `getFile(fileId): Promise<{ file_path: string; file_size?: number }>` (`POST /getFile` JSON come gli altri metodi); `downloadFile(filePath): Promise<Uint8Array>` (`GET` dell'URL file con token solo interno; errore HTTP → `TelegramError(status)` senza URL). Contratto: contracts/telegram-file.md
- [X] T007 In `test/helpers/fake-telegram.ts`: tipo `DocumentCall = { method: "sendDocument"; chatId; name; mimeType; text; caption? }` (contenuto decodificato UTF-8 **con** BOM in `text`) aggiunto a `TgCall`; metodi `sendDocument`, `getFile` (id sconosciuto → `TelegramError(400)`), `downloadFile`; `addFile(fileId, content: string | Uint8Array, filePath?)`; errori simulabili su `sendDocument`, `getFile`, `downloadFile` con lo stesso meccanismo di `sendMessage`; helper `documents()` che filtra le `DocumentCall`. Ogni chiamata conta nel contatore di subrequest. Dipende da T006
- [X] T008 [P] In `test/helpers/updates.ts` aggiungere `documentUpdate(fromId, fileName, fileId, size?: number, chatType = "private")` (messaggio con `document` e senza `text`) e in `test/helpers/send.ts` `sendFile(deps, fake, fileName, content, size?)` che registra il file con `fake.addFile` e invia l'update del proprietario
- [X] T009 [P] Creare `test/helpers/csv-fixtures.ts`: `csvOf(rows: string[][], sep = ";", bom = true)` (usa le colonne di `CSV_COLUMNS`), `syntheticRows(n, seed?)` con nomi `Persona 001…` e date valide distinte, generatore di backup sintetico `syntheticBackup({ persons, occurrencesPerPerson })` conforme a contracts/backup-json.md. Nessun dato reale
- [X] T010 Creare `src/domain/csv.ts` (puro, ~70 righe per il parser, research R-03): `decodeUtf8(bytes): { ok: true; text } | { ok: false }` con `new TextDecoder("utf-8", { fatal: true })` (BOM rimosso dal decoder); `detectSeparator(text): ";" | ","`; `parseCsv(text, maxDataRows): { records: { line: number; cells: string[]; empty: boolean }[] } | { tooManyRows: true }` (macchina a stati RFC 4180: virgolette, `""`, a capo tra virgolette, `\r\n`/`\n`); `writeCsv(rows: readonly (readonly string[])[]): Uint8Array` con BOM UTF-8, `CSV_EXPORT_SEPARATOR`, `\r\n`, quoting di `;`, `,`, `"`, `\r`, `\n`. Fa passare T004
- [X] T011 [P] In `src/db/conversation.ts` estendere `FLOW_NAMES` a `["nuovo", "modifica", "elimina", "gruppi", "messaggio", "import", "ripristina"]` (data-model.md)
- [X] T012 In `src/texts.ts` aggiungere i testi comuni dei documenti ricevuti (contracts/comandi.md, tabella "Documento ricevuto"), testo esatto: `fileTooBigTelegram: "Il file è troppo grande: Telegram consente ai bot di ricevere file fino a 20 MB."`, `fileTooBig: "Il file è troppo grande (massimo 1 MB)."`, `useRipristina: "Per ripristinare un backup usa /ripristina."`, `sendCsv: "Per importare persone inviami un file .csv (usa /modello per il formato)."`, `downloadFailed: "Non sono riuscito a scaricare il file, riprova."`, `waitingBackupFile: "Attendo un file JSON di backup. Usa /annulla per interrompere."` (i numeri 20 e 1 da `config.ts`)
- [X] T013 Creare `src/bot/file.ts` con `handleDocument(ctx, doc: Document, state: ConversationState | null)` (research R-01, R-13): estensione da `file_name` in minuscolo; `file_size` > `TELEGRAM_DOWNLOAD_MAX_BYTES` → `T.fileTooBigTelegram`, > `RECEIVED_FILE_MAX_BYTES` → `T.fileTooBig`, **nessuna** chiamata `getFile`; `downloadDocument(ctx, doc)` = `getFile` + `downloadFile` con ricontrollo di `byteLength` contro il tetto, `TelegramError` → `T.downloadFailed` (flusso invariato); instradamento: `.csv` → `handleCsv` di `src/bot/import.ts` (collegato in T023), `.json` con `state?.flow === "ripristina" && state.step === "file"` → `handleBackupFile` di `src/bot/flows/ripristina.ts` (collegato in T033), `.json` altrimenti → `T.useRipristina`, altra estensione allo step `file` di `ripristina` → `T.waitingBackupFile`, altrimenti → `T.sendCsv`. Import diretti, nessun registro di handler (principio III: quei moduli non importano `file.ts`); finché US1/US2 non esistono i due rami rispondono `T.sendCsv`/`T.useRipristina`. La `caption` è ignorata
- [X] T014 In `src/bot/router.ts`, in `routeMessage`, dopo whitelist, chat privata e `getActive`: se `msg.document` → `await handleDocument(ctx, msg.document, state)` e `return`, **prima** del ramo comandi e di `handleFlowText` (research R-13); se `msg.photo` (immagine inviata come foto) → nessuna `getFile`: allo step `file` di `ripristina` `T.waitingBackupFile`, altrimenti `T.sendCsv`, flusso invariato (edge case "immagine, PDF" della spec). Estranei e gruppi restano ignorati senza chiamate (RNF-09). Dipende da T013

**Checkpoint**: file in ingresso e in uscita funzionanti con il fake; parser e serializzatore CSV verdi

---

## Phase 3: User Story 1 — Onboarding con import CSV (Priority: P1) 🎯 MVP

**Goal**: `/modello` invia il modello con legenda; un CSV inviato produce un'anteprima con nuove,
duplicati, errori e gruppi da creare; Importa salva tutto o niente, Annulla nulla.

**Independent Test**: `/modello`, poi un CSV con righe valide, duplicate (esistenti e interne),
errate e con gruppi nuovi; verificare anteprima, Annulla e Importa (quickstart #1–#21).

### Test per US1 (scrivere prima, devono fallire)

- [X] T015 [P] [US1] Creare `test/unit/import.test.ts` per `src/domain/import.ts` (contracts/csv.md, quickstart #6–#8, #11–#13): intestazione in altro ordine, maiuscole, `Priorità` = `priorita`, colonne opzionali assenti valgono vuote; colonna sconosciuta, ripetuta, `nome` o `data` assenti → `invalidHeader` (`BR-18`); celle mancanti in coda vuote, celle in più non vuote → `colonne in più`; ogni motivo della tabella "Motivi di errore di riga" con testo esatto e più motivi nella stessa riga uniti da `; ` (`FR-010`); telefono `333abc` → errore; `priorita` vuota → `media`, `ALTA` → `alta`, `altissima` → errore (`BR-21`); 29/02 senza anno e 29/02/2024 validi, 29/02/1995 errore; riga d'esempio valida saltata con `exampleSkipped` e non contata altrove, riga d'esempio modificata con errori → errore (`FR-007a`); duplicato di persona esistente con maiuscole diverse, anno mancante in una delle due → duplicato, anni diversi → nuova; duplicato interno: la prima nuova, la seconda duplicata (`BR-14`); gruppi `Famiglia|Beach tennis` con solo `famiglia` esistente → crea solo "Beach tennis"; `Calcetto`/`calcetto` → un gruppo con la prima grafia; `Famiglia||famiglia` → uno; gruppo presente solo in righe errate o duplicate → non creato (`BR-17`, `BR-20`, `BR-23`); un solo motivo per campo (cella `gruppi` con tre gruppi troppo lunghi → un motivo, sul primo); valore citato di 5000 caratteri accorciato a `IMPORT_ERROR_VALUE_MAX` caratteri + `…` (chiarimento 2026-10-29); `previewText` con le sezioni di contracts/flussi.md solo se non vuote, duplicati ed errori **tutti** in ordine di riga, gruppi da creare a capo ogni `PREVIEW_GROUPS_PER_LINE` nomi; `shortSummary` come contracts/flussi.md
- [X] T016 [P] [US1] Creare `test/integration/us1-modello.test.ts` (quickstart #1): `it("RF-23, FR-007: /modello invia compleanni-modello.csv con BOM, ';', intestazione e riga d'esempio", …)` (contenuto = BOM + `nome;nickname;…;messaggio\r\n` + `CSV_EXAMPLE_ROW\r\n`, MIME `text/csv; charset=utf-8`); caption = legenda di contracts/comandi.md e `length ≤ DOCUMENT_CAPTION_MAX_LENGTH`; `/modello` durante un flusso `nuovo` lo annulla in silenzio (FR-018 di 001)
- [X] T017 [P] [US1] Creare `test/integration/us1-import.test.ts` (quickstart #2–#5, #10, #15–#18): file di 112 righe con 3 date non valide e 5 duplicati → anteprima "104 persone nuove", "5 duplicati (saltati):", "3 errori:" con numeri di riga, tabelle di dominio invariate (`RF-24, §5.8`); Importa → 104 persone, gruppi creati, `Importate 104 persone, creati 2 gruppi.`, tastiera rimossa con `editMessageReplyMarkup`, persone con le stesse colonne del guidato (`full_name_norm`, `priority`, `created_at = updated_at = now`) e appartenenze a entrambi i gruppi (`BR-23`); Annulla → `Operazione annullata.` e nulla salvato (`FR-014`); Importa ripremuto e Importa dopo `now + 24 h` → `Questa azione non è più disponibile`; stesso file con `,` e con `;` → stessa anteprima (`BR-19`); file con BOM e accenti letto (`BR-22`); riga d'esempio → `Riga d'esempio ignorata` (`FR-007a`); nessuna riga importabile → anteprima senza pulsanti e nessuno stato (`FR-015`); persona aggiunta con `/nuovo` dopo l'anteprima → riga saltata, prima riga `1 righe sono diventate duplicati…` secondo contracts/flussi.md e numeri effettivi; tutte diventate duplicati → `Nessuna persona importata: tutte le righe sono ora duplicati.`; errore forzato nella batch (riga con valore che viola un `CHECK` iniettata nello stato) → nessuna persona né gruppo salvato, stato invariato (`FR-013`); anteprima di 500 righe con molti errori divisa su più messaggi ≤ 4096 con pulsanti solo nell'ultimo; 500 righe con tutte le celle lunghe 1000 caratteri e 2000 gruppi nuovi → ogni messaggio ≤ 4096, al massimo `PREVIEW_MAX_MESSAGES` messaggi, ultimo con `…e altre N righe non mostrate…` e pulsanti, conteggi completi nel primo; testo libero durante l'attesa → riepilogo breve + pulsanti; import il giorno del compleanno di una riga, poi `runAt` dell'ora corrente e di quella passata → nessun invio retroattivo (002 FR-017/018)
- [X] T018 [P] [US1] Creare `test/integration/documenti.test.ts` (quickstart #19–#20): `.pdf` → `T.sendCsv`; `.json` senza `/ripristina` → `T.useRipristina`, flusso in corso invariato; `file_size` 21 MB → `T.fileTooBigTelegram` e 2 MB → `T.fileTooBig`, **nessuna** `getFile` registrata (`V-07, FR-026`); file senza `file_size` ma scaricato > 1 MiB → `T.fileTooBig`; `getFile` in errore → `T.downloadFailed`; CSV non UTF-8 → rifiuto `"CSV UTF-8"`; intestazione non valida → testo con le colonne attese; file vuoto e sole intestazioni → `Il file non contiene righe da importare.`; 501 righe → rifiuto con massimo 500 (`FR-008a`); CSV inviato durante un flusso `nuovo` → flusso annullato in silenzio e anteprima (R-13); CSV non UTF-8 durante un flusso `nuovo` → flusso annullato e rifiuto; CSV con `file_size` 2 MB o `getFile` in errore durante un flusso `nuovo` → flusso invariato; foto inviata → `T.sendCsv` e nessuna `getFile`, foto allo step `file` di `ripristina` → `T.waitingBackupFile`
- [X] T019 [P] [US1] Estendere `test/integration/us1-accesso.test.ts` (quickstart #21): un estraneo invia un CSV, un JSON, `/modello`, `/export`, `/backup`, `/ripristina` → nessuna chiamata Telegram (né `getFile`) e nessuna scrittura D1 (`RNF-09`, FR-027 di 001); lo stesso dal proprietario in un gruppo → ignorato

### Implementazione per US1

- [X] T020 [US1] In `src/texts.ts` aggiungere (testo esatto da contracts/comandi.md, csv.md, flussi.md): `CSV_EXAMPLE_ROW` come array di 9 celle (`Esempio Da Cancellare`, `Esempio`, `14/03/1990`, `+39 3331234567`, `esempio.ig`, `esempio_tg`, `Famiglia|Amici`, `alta`, `Tanti auguri {nome}!`); `T.templateCaption` (legenda); i motivi di errore di riga (`nome mancante`, `nome troppo lungo (max 60)`, `nickname troppo lungo (max 60)`, `data mancante`, `data "<v>" non valida`, `telefono non valido`, `priorità "<v>" non valida`, `gruppo "<v>" troppo lungo (max 30)`, `messaggio troppo lungo`, `colonne in più`) con i limiti da `config.ts`; rifiuti del CSV (`csvNotUtf8`, `csvInvalidHeader` con l'elenco da `CSV_COLUMNS`, `csvEmpty`, `csvTooManyRows` con `IMPORT_MAX_ROWS`); testi dell'anteprima (`Anteprima import`, `N persone nuove`, `Riga d'esempio ignorata`, `N duplicati (saltati):`, `• riga N: Nome gg/mm[/aaaa]`, `N errori:`, `• riga N: motivi`, `Gruppi da creare: …`), `previewTruncated(n)` = `…e altre ${n} righe non mostrate (correggi il file e rimandalo).`, riepilogo breve, `btnImport: "Importa"`, `imported(n, m)`, `becameDuplicates(k)` con la forma singolare per K = 1 (`1 riga è diventata un duplicato ed è stata saltata.`), `nothingImported`
- [X] T021 [US1] Creare `src/domain/import.ts` (puro, research R-04, R-05, data-model.md): tipi `ImportRow` (`line`, `fullName`, `fullNameNorm`, `nickname: string | null`, `birthDay`, `birthMonth`, `birthYear: number | null`, `phone: string | null` E.164, `instagram`/`telegram: string | null` senza `@`, `priority: "alta" | "media" | "bassa"`, `customMessage: string | null`, `groups: { name; nameNorm }[]` già senza vuoti e ripetuti), `ImportState`, `ExistingKey { fullNameNorm, birthDay, birthMonth, birthYear }`, `Preview { rows; duplicates: { line; fullName; date }[]; errors: { line; reasons: string[] }[]; exampleSkipped; groupsToCreate: string[] }`; `mapHeader(cells)` con `searchKey(trim)` contro `CSV_COLUMNS` → mappa colonna→indice o `invalidHeader`; `truncateValue(v)` (max `IMPORT_ERROR_VALUE_MAX` caratteri + `…`, usata per ogni valore citato); `validateRecord(record, map, today)` che accumula i motivi di **tutti** i campi non validi, al massimo uno per campo (per `gruppi` il primo troppo lungo) (FR-010), riusando `cleanText`, `parseBirthDate`, `normalizePhone`, `normalizeUsername`, `validateGreeting`; `isDuplicate(a, b)` con la regola di `findDuplicate` (stesso `normKey`, giorno, mese; anno solo se presente in entrambe); `buildPreview(records, existingKeys, existingGroups: { name; nameNorm }[], today)` (riga d'esempio confrontata con `CSV_EXAMPLE_ROW` via `normKey` e data; prima riga vince; gruppi da creare con la grafia della prima riga **importata**); `recheck(rows, existingKeys, existingGroups)` per Importa; `previewText(preview): string[]` (righe per `splitMessage`; conteggi in testa, gruppi da creare a capo ogni `PREVIEW_GROUPS_PER_LINE` nomi) e `shortSummary(preview)`. Fa passare T015. Dipende da T010, T020
- [X] T022 [US1] Creare `src/db/import.ts` (dipende da T021 per i tipi `ImportRow`) (research R-06, R-07): `importContextStatements(db)` = batch di lettura `SELECT full_name_norm, birth_day, birth_month, birth_year FROM persons` + `SELECT name, name_norm FROM groups` e `importContextFromResults`; `importGuardedStatements(db, chatId, flowId, rows: ImportRow[], groupsToCreate, nowIso)` che restituisce gli statement di **una** batch: (1) `INSERT OR IGNORE INTO groups (name, name_norm, …) SELECT … FROM json_each(?) WHERE <flowGuardSql>`; (2) `INSERT INTO persons (…) SELECT json_extract(value, '$.…'), … FROM json_each(?) WHERE <guardia>` con `created_at = updated_at = nowIso`; (3) `INSERT OR IGNORE INTO person_groups` con join su `groups.name_norm` e sulla chiave `(full_name_norm, birth_day, birth_month, birth_year IS …)` limitata a `p.id > (SELECT MAX(id) FROM persons) - <N>`; (4) `consumeStatement`. Restituire anche gli indici degli statement per leggere `meta.changes` di gruppi (M) e persone (N). Colonne di `persons` come `insertGuardedStatements` di `src/db/persons.ts`
- [X] T023 [US1] Creare `src/bot/import.ts` (contracts/flussi.md, research R-06): `handleCsv(ctx, bytes, state)`, chiamata da `handleDocument` **solo dopo il download riuscito** (file troppo grande o download fallito lasciano il flusso invariato), in quest'ordine: (1) se c'è un flusso in corso lo annulla in silenzio con `clear`, anche se il file verrà poi rifiutato (come un comando, R-13); (2) `decodeUtf8` → `parseCsv(text, IMPORT_MAX_ROWS)` → `mapHeader` → rifiuti per intero con i testi di T020 (nulla scritto); (3) batch di lettura `importContextStatements`; `buildPreview` con `today`; se `rows.length === 0` → invio del testo senza pulsanti e nessuno stato (FR-015); altrimenti `start` del flusso `import` step `anteprima` con `ImportState` e invio dell'anteprima divisa con `splitMessage` (pulsanti [Importa] `i` e [Annulla] solo nell'ultimo messaggio). In entrambi i casi al massimo `PREVIEW_MAX_MESSAGES` messaggi: se `splitMessage` ne produce di più, si tengono le prime righe che stanno in `PREVIEW_MAX_MESSAGES` messaggi e l'ultimo si chiude con `T.previewTruncated(n)` (n = righe di dettaglio non mostrate), con i pulsanti. Registrare il flusso con `registerFlow`: step `anteprima` `kind: "buttons"`, `actions: ["i"]`, `prompt` = `shortSummary` (usato da `repeatStep` sul testo libero), `onCallback("i")` = rilettura del contesto, `recheck`, batch di `importGuardedStatements`, `editMessageReplyMarkup` vuota, messaggio `imported`/`becameDuplicates`/`nothingImported` (con N = 0 consumare comunque lo stato), `answerCallback`. Se la batch non ha consumato lo stato (guardia fallita) → `T.actionUnavailable`. Collegare `handleCsv` al ramo `.csv` di `src/bot/file.ts` con import diretto. Dipende da T021, T022
- [X] T024 [P] [US1] Creare `src/bot/export.ts` con `handleTemplate(ctx)` per `/modello`: `sendDocument(ctx.chatId, { name: "compleanni-modello.csv", content: writeCsv([CSV_COLUMNS, CSV_EXAMPLE_ROW]), mimeType: "text/csv; charset=utf-8" }, T.templateCaption)` (FR-007, FR-024: solo nella chat del proprietario). Dipende da T010, T020
- [X] T025 [US1] In `src/bot/commands.ts` aggiungere `modello: handleTemplate` a `COMMANDS`; importare `src/bot/import.ts` dove vengono importati gli altri flussi (registrazione di flusso e handler CSV all'avvio). Fa passare T016–T019. Dipende da T023, T024

**Checkpoint**: US1 completa e verificabile in modo indipendente; nessuna regressione nei test 001–003

---

## Phase 4: User Story 2 — Backup e ripristino (Priority: P1)

**Goal**: `/backup` invia il JSON completo; `/ripristina` + file valido + doppia conferma
sostituisce tutti i dati in modo atomico, mantenendo gli id.

**Independent Test**: dati completi → `/backup` → modifiche → `/ripristina` con il file → Continua
→ Sì, ripristina → dati identici; file non validi e Annulla a ogni passo lasciano i dati
invariati (quickstart #22–#28).

### Test per US2 (scrivere prima, devono fallire)

- [X] T026 [P] [US2] Creare `test/unit/backup.test.ts` per `src/domain/backup.ts` (contracts/backup-json.md, quickstart #26): `buildBackup` produce le chiavi dello schema v1 (nessun `full_name_norm`, `name_norm`, `deliveries`, `auto_backup`), liste ordinate per `id`, JSON compatto; `parseBackup(buildBackup(x))` restituisce la forma normalizzata con `full_name_norm`/`name_norm` ricalcolati; un rifiuto per **ogni** riga della tabella di validazione con il messaggio esatto: non JSON e byte non UTF-8, `format` diverso o liste mancanti, `version: 2` → `Versione del backup non supportata (2).`, ogni campo di persona non valido (nome > 60, data 31/04, 29/02/1995, telefono non E.164, username con `@`, priorità `altissima`, messaggio > 256), gruppo con nome > 30, `status` sconosciuto, `effective_date` `2026-02-30`, id ripetuto, gruppi `Famiglia`/`famiglia`, appartenenza verso gruppo inesistente, occorrenza verso persona inesistente, due occorrenze stessa persona e anno; i messaggi non contengono valori personali (nessun nome né data nel testo)
- [X] T027 [P] [US2] Creare `test/integration/us2-backup.test.ts` (quickstart #22, #35): con persone (anche `birth_year` null, 29/02), gruppi, appartenenze, occorrenze con esiti diversi e `default_message` personalizzato → `/backup` invia `compleanni-backup-2026-10-28.json` (MIME `application/json`) alla chat del proprietario con caption `Backup: N persone, M gruppi, K occorrenze. Per ripristinarlo usa /ripristina.`, contenuto conforme allo schema e coerente con D1 (`RF-26, FR-017`); zero persone → file comunque inviato
- [X] T028 [P] [US2] Creare `test/integration/us2-ripristino.test.ts` (quickstart #23–#28): `/ripristina` → `Inviami il file JSON di backup da ripristinare.` + [Annulla]; testo allo step `file` → `T.waitingBackupFile`; file valido → messaggio `conferma1` con data del backup in ora locale, conteggi del backup e attuali (formato `1.204`) e [Continua] [Annulla]; Continua → avviso di irreversibilità con [Sì, ripristina] [Annulla]; Sì → dati sostituiti, riepilogo `Ripristino completato: …` e riga del messaggio standard, tastiera rimossa (`RF-26, RNF-05, FR-019, FR-020`); `/p_<id>` apre le stesse persone (`RNF-11`); round-trip backup → modifiche (nuova persona, gruppo rinominato, esito cambiato, default cambiato) → ripristino → tabelle identiche al backup, `deliveries` vuota (`SC-005`); un id nuovo creato dopo il ripristino è maggiore di tutti quelli mai usati; Annulla a `conferma1` e a `conferma2`, `/annulla`, CSV inviato, `now + 24 h` → dati invariati (`FR-021`); file non valido → motivo, dati invariati, resta in `file` e un secondo file valido prosegue (`SC-006`); errore forzato nella batch di ripristino → dati precedenti intatti (`FR-020`); backup del 01/11 con occorrenza aperta del 05/11 ripristinato il 20/11 → `non_confermato` senza messaggi, occorrenza con D = oggi resta aperta e `runAt` riceve solo gli slot futuri (`FR-020a`); `auto_backup` non toccata dal ripristino

### Implementazione per US2

- [X] T029 [US2] In `src/texts.ts` aggiungere (testo esatto da contracts/comandi.md, flussi.md, backup-json.md): `backupCaption(n, m, k)`, `restoreAsk`, `restoreConfirm1(date, b, a)` con migliaia separate da `.` (`toLocaleString("it-IT")` o equivalente esistente), `restoreConfirm2` (con `⚠️`), `btnContinue: "Continua"`, `btnRestore: "Sì, ripristina"`, `restoreDone(n, m, k)` e le due varianti della riga del messaggio standard, i motivi di rifiuto del backup (`backupNotJson`, `backupWrongFormat`, `backupVersion(v)`, `backupInvalidField(entità, id, campo)`, `backupDuplicateId(entità, id)`, `backupDuplicateGroupName`, `backupMissingRef(entità, id)`, `backupDuplicateOccurrence(personId)`)
- [X] T030 [US2] Creare `src/domain/backup.ts` (puro, research R-08, R-09): tipi `BackupV1` (schema di contracts/backup-json.md) e `NormalizedBackup` (con `full_name_norm`, `name_norm`); `buildBackup(data, createdAtIso): BackupV1` e `encodeBackup(b): Uint8Array` (`JSON.stringify` compatto + `TextEncoder`, senza BOM); `parseBackup(bytes, today): { ok: true; backup: NormalizedBackup } | { ok: false; reason: string }` con i controlli **nell'ordine** di research R-09, rifiuto al primo errore; valori di persona validati con le stesse funzioni del guidato (`cleanText` + `TEXT_LIMITS`, `parseBirthDate` sulla stringa `gg/mm[/aaaa]` con `today`, `normalizePhone` che deve restituire lo stesso valore, username senza `@` e uguale a `normalizeUsername`, priorità, `validateGreeting`), nomi di gruppo `cleanText` max 30, `status` in `aperta|fatto|saltato|non_confermato`, `effective_date` reale `AAAA-MM-GG`, `outcome_at` stringa o `null`, `default_message` `null` o valido. Fa passare T026. Dipende da T029
- [X] T031 [US2] Creare `src/db/backup.ts` (dipende da T030 per il tipo `NormalizedBackup`): `backupReadStatements(db)` = batch di 5 SELECT `ORDER BY id` (persone, gruppi, `person_groups ORDER BY person_id, group_id`, occorrenze, `default_message`) e `backupDataFromResults`; `countStatements(db)` = `COUNT(*)` di persone, gruppi, occorrenze (data-model.md, Riepiloghi); `restoreGuardedStatements(db, chatId, flowId, b: NormalizedBackup, nowIso, closeBefore: string)` = statement di **una** batch con `flowGuardSql` su ciascuno: `DELETE FROM persons`, `DELETE FROM groups`, `DELETE FROM settings WHERE key = 'default_message'`, `INSERT` da `json_each` di gruppi, persone, appartenenze, occorrenze **con gli id del backup**, `INSERT` di `default_message` se non `null`, `UPDATE occurrences SET status = 'non_confermato', outcome_at = nowIso WHERE status = 'aperta' AND effective_date <= closeBefore` (oggi − 2), `consumeStatement`. `sqlite_sequence` e `auto_backup` non toccati. Verificare che `PRAGMA foreign_keys` e i `ON DELETE CASCADE` dello schema svuotino `person_groups`, `occurrences`, `deliveries`
- [X] T032 [US2] Creare `src/bot/backup.ts`: `sendBackup(deps, chatId): Promise<{ persons; groups; occurrences }>` condiviso con il cron (una batch di lettura, `buildBackup` con `toIso(deps.now())`, `sendDocument` di `compleanni-backup-AAAA-MM-GG.json` con data locale di `deps.now()`, MIME `application/json`, `T.backupCaption`); `handleBackup(ctx)` per `/backup` = `sendBackup(ctx.deps, ctx.chatId)` (FR-017, FR-024). Dipende da T030, T031
- [X] T033 [US2] Creare `src/bot/flows/ripristina.ts` (contracts/flussi.md, data-model.md): `registerFlow` con step `file` (`kind: "text"`, prompt `T.restoreAsk` + [Annulla], `onText` → `repeatStep` con `T.waitingBackupFile`), `conferma1` (`kind: "buttons"`, `actions: ["c"]`, prompt `restoreConfirm1` con i conteggi salvati in `data`, Continua → `goTo("conferma2")` con `editMessageReplyMarkup` vuota) e `conferma2` (`actions: ["r"]`, prompt `T.restoreConfirm2`, "Sì, ripristina" → batch di `restoreGuardedStatements` con `closeBefore = toDateString(addDays(today, -2))`, tastiera rimossa, riepilogo `restoreDone`; guardia fallita → `T.actionUnavailable`; errore della batch → si propaga all'avviso generico del webhook, stato invariato). `data` = `{}` allo step `file`, `{ backup, counts }` dalle conferme. `handleBackupFile(ctx, bytes, state)` = `parseBackup(bytes, today)`; rifiuto → `repeatStep(ctx, state, reason)` restando in `file`; valido → batch `countStatements` e `goTo("conferma1", …)`. `startRestore(ctx)` = `startFlow(ctx, "ripristina", "file", {})`. Collegare `handleBackupFile` al ramo `.json` di `src/bot/file.ts` con import diretto. Dipende da T030, T031
- [X] T034 [US2] In `src/bot/commands.ts` aggiungere `backup: handleBackup` e `ripristina: startRestore` a `COMMANDS`; importare `src/bot/flows/ripristina.ts` insieme agli altri flussi. Fa passare T027, T028. Dipende da T032, T033

**Checkpoint**: US1 e US2 funzionano in modo indipendente

---

## Phase 5: User Story 3 — Backup automatico mensile (Priority: P2)

**Goal**: il 1° del mese alle 9:00 locali il proprietario riceve il backup, al massimo una volta
per mese, con recupero alle ore successive in caso di errore Telegram.

**Independent Test**: `runAt` del 1° alle 8:00, 9:00 (ripetuta), 10:00 e del 2 alle 14:00 dopo un
errore; un solo invio, ripristinabile (quickstart #29–#32).

### Test per US3 (scrivere prima, devono fallire)

- [X] T035 [P] [US3] Creare `test/integration/us3-backup-mensile.test.ts` (contracts/backup-mensile.md): `it("RF-27, FR-022: 1° del mese alle 9:00 locali → un sendDocument al proprietario e auto_backup = AAAA-MM:inviato", …)` con `scheduledTime` UTC sia in ora solare (1/12, 08:00Z) sia legale (1/4, 07:00Z); 1° alle 8:00 → nessuna chiamata D1 di `auto_backup` né invio; esecuzione delle 9:00 ripetuta e 1° alle 10:00 dopo l'invio → nessun altro invio (`FR-023`); `sendDocument` in errore il 1° alle 9:00 → `AAAA-MM:fallito`, poi ok il 2 alle 14:00 → un invio (`FR-023a`); valore `AAAA-MM:in_invio` preesistente → nessun invio; prima installazione a metà mese (chiave assente, 15 alle 11:00) → invio; mese nuovo con valore del mese precedente `inviato` → invio; 0 persone → file inviato; il file mensile usato con `/ripristina` → ripristino riuscito (`RNF-11, FR-025`); un errore di `runHourly` non impedisce il backup e viceversa (RNF-12); log `auto_backup` con soli `sent`/`error_code`
- [X] T036 [P] [US3] Estendere `test/integration/ciclo-budget.test.ts`: cron del 1° alle 9:00 con 40 promemoria nella stessa ora + backup dovuto → subrequest totali esatte e ≤ 47; cron senza backup dovuto (già `inviato`) → ≤ 44 (un solo reclamo a vuoto); 1° prima delle 9:00 → nessuna query in più (research R-12)

### Implementazione per US3

- [X] T037 [US3] In `src/db/settings.ts` aggiungere `AUTO_BACKUP_KEY = "auto_backup"`, `claimAutoBackup(db, month: string, nowIso): Promise<boolean>` con lo statement unico di contracts/backup-mensile.md (`INSERT … ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE settings.value NOT IN (?||':in_invio', ?||':inviato') RETURNING value`; `true` solo se restituisce una riga) e `setAutoBackupResult(db, month, result: "inviato" | "fallito", nowIso)`
- [X] T038 [US3] Creare `src/cron/backup-mensile.ts` con `runMonthlyBackup(deps: CronDeps, scheduledAt: Date): Promise<{ sent: boolean } | null>` (contracts/backup-mensile.md): `L = toLocal(scheduledAt)`, mese `AAAA-MM`; se `L.day === AUTO_BACKUP_DAY && L.hour < AUTO_BACKUP_HOUR` → fine senza query; `claimAutoBackup`; se reclamato → `sendBackup(deps, Number(deps.ownerId))` di `src/bot/backup.ts`; esito `inviato`, o `fallito` su `TelegramError`; altre eccezioni si propagano (resta `in_invio`, nessun nuovo invio nel mese); `log("auto_backup", { sent, error_code? })`. Dipende da T032, T037
- [X] T039 [US3] In `src/index.ts`, handler `scheduled`: chiamare `runHourly` e poi `runMonthlyBackup` con lo stesso `scheduledAt`, ciascuna nel proprio `try/catch` con log del solo codice, così il guasto dell'una non blocca l'altra (RNF-12, principio VII). `wrangler.jsonc` invariato. Fa passare T035, T036. Dipende da T038

**Checkpoint**: US1, US2 e US3 funzionano in modo indipendente

---

## Phase 6: User Story 4 — Export CSV (Priority: P3)

**Goal**: `/export` invia un CSV nel formato del modello, una riga per persona, reimportabile
senza errori.

**Independent Test**: persone con tutti i campi → `/export` → svuota → reinvia il file: tutte
nuove, zero errori, campi identici; sulla stessa istanza tutte duplicate (quickstart #33–#35).

### Test per US4 (scrivere prima, devono fallire)

- [X] T040 [P] [US4] Creare `test/integration/us4-export.test.ts` (contracts/csv.md, "Scrittura"): `it("RF-25, FR-016: /export invia compleanni-export-2026-10-28.csv con BOM, ';' e una riga per persona in ordine di id", …)` con 29/02 senza anno, anno sconosciuto, più gruppi (ordine alfabetico uniti da `|`), messaggio personalizzato e non (vuoto), username senza `@`, priorità minuscola, telefono `+39 3331234567`, nome con `;` e `"` tra virgolette; caption `Export di N persone.`; nessuno storico; 0 persone → sola intestazione e caption `Export di 0 persone.`; round-trip: export → `DELETE` di persone e gruppi → invio del file → anteprima con tutte nuove e zero errori → Importa → persone e gruppi identici (`SC-004`); export → invio sulla stessa istanza → tutte duplicate (`BR-14`)

### Implementazione per US4

- [X] T041 [US4] In `src/texts.ts` aggiungere `exportCaption(n)` = `Export di ${n} persone.` (contracts/comandi.md)
- [X] T042 [US4] In `src/domain/import.ts` (o in `src/domain/csv.ts` se più coerente) aggiungere la funzione pura `exportRow(p, groupNames): string[]` (research R-10): `data` con `formatShort`; telefono E.164 con uno spazio dopo i primi tre caratteri; username senza `@`; gruppi con `sortNames` uniti da `CSV_GROUP_SEPARATOR`; priorità minuscola; `messaggio` = `custom_message ?? ""`. Coperta da un caso in `test/unit/import.test.ts`
- [X] T043 [US4] In `src/db/backup.ts` aggiungere `exportReadStatements(db)` (persone `ORDER BY id`, `person_groups` con nome del gruppo) e in `src/bot/export.ts` `handleExport(ctx)`: una batch di lettura, `writeCsv([CSV_COLUMNS, ...rows])`, `sendDocument` di `compleanni-export-AAAA-MM-GG.csv` (data locale di `now()`, MIME `text/csv; charset=utf-8`) con `exportCaption` (FR-016, FR-024). Dipende da T041, T042
- [X] T044 [US4] In `src/bot/commands.ts` aggiungere `export: handleExport` a `COMMANDS`. Fa passare T040. Dipende da T043

**Checkpoint**: tutte le user story funzionano in modo indipendente

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T045 In `src/texts.ts` aggiornare `T.help`: righe `/modello — modello CSV per l'import`, `/export — esporta le persone in CSV`, `/backup — backup completo in JSON`, `/ripristina — ripristina da un backup` prima di `/annulla` e la nota `Per importare persone inviami un file CSV.` (contracts/comandi.md, `/aiuto`); `/start` invariato (RF-28 fuori perimetro). Aggiornare l'elenco atteso in `test/integration/us7-start-aiuto.test.ts`
- [X] T046 [P] Creare `test/integration/import-budget.test.ts` con il contatore di `test/helpers/deps.ts` (research R-12): invio CSV di 500 righe con flusso precedente attivo e anteprima al tetto di `PREVIEW_MAX_MESSAGES` (celle lunghe, 2000 gruppi nuovi) → 36 esatte; Importa → 6; Annulla → 4; `/modello` ≤ 3; `/export` ≤ 4; `/backup` ≤ 4; `/ripristina` → 4 (con flusso precedente); invio del JSON → 6; Continua → 5; "Sì, ripristina" → 5; tutti ≤ 50
- [X] T047 [P] Creare `bench/import-backup.bench.ts` (Node, solo dati di `test/helpers/csv-fixtures.ts` o generati localmente, nessun import di `cloudflare:*`): `decodeUtf8` + `parseCsv` + `buildPreview` + `previewText` + `JSON.stringify` dello stato per 200 e 500 righe; `buildBackup` + `encodeBackup` e `parseBackup` per 200 persone + 2000 occorrenze; export di 200 persone (`exportRow` + `writeCsv`); casi alla dimensione massima accettata (`RECEIVED_FILE_MAX_BYTES`): CSV di 500 righe con celle lunghe fino a ~1 MiB (anteprima al tetto compresa) e `parseBackup` + `JSON.stringify`/`JSON.parse` dello stato `ripristina` per un backup di ~1 MiB; soglia < 3 ms per iterazione sui casi da ~200 persone e < 8 ms sui casi a 1 MiB (principio II, 10 ms per invocazione). Se un caso a 1 MiB supera la soglia, abbassare `RECEIVED_FILE_MAX_BYTES` e aggiornare FR-026 e research R-01
- [X] T048 [P] Verificare che `test/unit/privacy-log.test.ts` copra `src/bot/file.ts`, `src/bot/import.ts`, `src/bot/export.ts`, `src/bot/backup.ts`, `src/bot/flows/ripristina.ts`, `src/cron/backup-mensile.ts`: nessun `log` con nomi, date, contenuti di file o token (principio V); estenderlo se controlla un elenco di file
- [X] T049 [P] Aggiungere a `test/unit/import.test.ts` (o `us1-modello.test.ts`) la verifica che `CSV_EXAMPLE_ROW` sia valida con `validateRecord` (la riga d'esempio deve essere riconosciuta e saltata, FR-007a) e che `T.templateCaption.length ≤ DOCUMENT_CAPTION_MAX_LENGTH`
- [X] T050 Eseguire `npm run typecheck`, `npm test` e `npm run bench`; correggere fino a tutto verde e benchmark entro soglia (gate di chiusura della constitution). Se un test con D1 locale mostra un limite sul parametro JSON di `json_each`, applicare il ripiego di research R-07 (blocchi da 100 righe nella stessa batch)
- [ ] T051 Eseguire la prova manuale di `specs/004-import-export-backup/quickstart.md` §4 (Excel in italiano: colonne separate, accenti, telefono con `+`; round-trip export e backup/ripristino con il bot reale)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza
- **Foundational (Phase 2)**: dipende da Setup; blocca tutte le story
- **US1 (Phase 3)**, **US2 (Phase 4)**: dipendono solo da Foundational
- **US3 (Phase 5)**: dipende da Foundational e da `sendBackup` di US2 (T032)
- **US4 (Phase 6)**: dipende da Foundational (`writeCsv`); il round-trip del suo test usa l'import di US1
- **Polish (Phase 7)**: dopo tutte le story desiderate

### User Story Dependencies

- **US1 (P1)**: indipendente
- **US2 (P1)**: indipendente da US1 (il test "CSV inviato annulla il ripristino" richiede anche US1)
- **US3 (P2)**: riusa `src/bot/backup.ts` e, per lo scenario di ripristino, il flusso di US2
- **US4 (P3)**: `handleExport` è indipendente; la verifica di reimport (SC-004) richiede US1

### Within Each User Story

- Test prima, devono fallire
- `texts.ts` → dominio puro → `db/` → `bot/` → registrazione in `commands.ts`/`index.ts`
- I file condivisi (`texts.ts`, `commands.ts`, `config.ts`, `db/backup.ts`) impongono l'ordine
  sequenziale tra story se lavorate in parallelo

### Parallel Opportunities

- Phase 1: T002 in parallelo a T001
- Phase 2: T003, T004, T005 (test) in parallelo; T008, T009, T011 in parallelo tra loro e con T006; T007 dopo T006; T010 dopo T004; T013 → T014 dopo T012
- US1: T015–T019 in parallelo; T024 in parallelo con T021–T023 (T021 → T022 → T023 in sequenza)
- US2: T026–T028 in parallelo; T030 → T031 in sequenza, poi T032 e T033
- US3: T035, T036 in parallelo
- Polish: T046, T047, T048, T049 in parallelo

---

## Parallel Example: User Story 1

```text
# Dopo Foundational, in parallelo:
Task: "T015 test/unit/import.test.ts"
Task: "T016 test/integration/us1-modello.test.ts"
Task: "T017 test/integration/us1-import.test.ts"
Task: "T018 test/integration/documenti.test.ts"
Task: "T019 test/integration/us1-accesso.test.ts (esteso)"

# Poi:
T020 texts.ts → T021 domain/import.ts → T022 db/import.ts → T023 bot/import.ts ─┐
            └─ T024 bot/export.ts (/modello) ─────────────────────────────────┴─ T025 commands.ts
```

## Parallel Example: User Story 2

```text
Task: "T026 test/unit/backup.test.ts"
Task: "T027 test/integration/us2-backup.test.ts"
Task: "T028 test/integration/us2-ripristino.test.ts"

T029 texts.ts → T030 domain/backup.ts → T031 db/backup.ts ─┬─ T032 bot/backup.ts ──────┐
                                                           └─ T033 flows/ripristina.ts ┴─ T034 commands.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1: `/modello` e import CSV)
3. **STOP and VALIDATE**: test di US1 e di 001–003 verdi; prova manuale quickstart §4 passo 2
4. Deploy se utile: l'onboarding delle oltre 100 persone (SC-002) è già possibile

### Incremental Delivery

1. Setup + Foundational → file in ingresso/uscita e CSV pronti
2. US1 import (P1) → US2 backup e ripristino (P1)
3. US3 backup mensile (P2)
4. US4 export (P3)
5. Polish: `/aiuto`, budget, benchmark, privacy, gate di chiusura

---

## Notes

- [P] = file diversi, nessuna dipendenza da task incompleti
- Ogni test cita l'ID AFU/FR verificato (principio XI)
- Commit dopo ogni task o gruppo logico, senza righe di attribuzione (istruzioni del proprietario)
- Fermarsi a ogni checkpoint per validare la story in modo indipendente
