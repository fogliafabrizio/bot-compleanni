---

description: "Task list per la feature 003 — Viste e ricerche"
---

# Tasks: Viste e ricerche

**Input**: documenti di progetto in `specs/003-viste-ricerche/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (comandi.md, liste.md, callback-data.md), quickstart.md

**Tests**: OBBLIGATORI. La constitution (principio X) e SC-001 chiedono almeno un test per ogni
RF e per ogni criterio Dato/Quando/Allora. Ogni `describe`/`it` MUST citare l'ID AFU o FR
verificato (principio XI), es. `it("RF-17: /prossimi 7 famiglia mostra solo il gruppo Famiglia", …)`.
I test di ogni story si scrivono per primi e devono fallire prima dell'implementazione.

**Organization**: task raggruppati per user story (US1…US6 della spec), in ordine di priorità.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1…US6)

## Convenzioni valide per tutti i task

- Valgono le convenzioni di `specs/001-fondamenta-anagrafica/tasks.md` e
  `specs/002-promemoria-esiti/tasks.md`: testi solo in `src/texts.ts`, costanti solo in
  `src/config.ts`, log solo con codici e numeri tramite `src/log.ts` (mai testi di ricerca, nomi
  o date), nessun `new Date()` fuori da `src/index.ts`, `today = toLocal(ctx.deps.now())`.
- **Nessun `parse_mode`**, mai: il monospazio delle liste si ottiene solo con `entities`
  (`{ type: "code", offset, length }`, offset/lunghezze in unità UTF-16 = `String.length`),
  contracts/liste.md.
- **Nessuna migration e nessuna modifica di schema** (data-model.md). Scritture solo su
  `occurrences`; `deliveries` non si legge né si scrive in questa feature.
- Ogni comando fa **una** `db.batch` di lettura (due solo per `/oggi` senza compleanni e `/cerca`
  con un solo risultato), research R-08. Nessuna lista ha tastiera inline (FR-004, RNF-14).
- Valori ammessi: `occurrences.status` ∈ `aperta`, `fatto`, `saltato`, `non_confermato`;
  giorni di `/prossimi` "intero 1–366, default 30"; mese "nome italiano (case-insensitive) o
  1–12, default corrente"; anno "4 cifre, `MIN_BIRTH_YEAR` ≤ Y ≤ anno corrente, default
  corrente"; testo di `/cerca` "non vuoto dopo `trim`" (data-model.md, Validazioni).
- I task che modificano lo stesso file tra `src/texts.ts`, `src/config.ts`,
  `src/bot/router.ts`, `src/bot/commands.ts`, `src/bot/viste.ts`, `src/db/viste.ts`,
  `src/domain/viste.ts`, `src/bot/scheda.ts`, `src/bot/promemoria.ts` non sono [P] tra loro.
- Test di integrazione: D1 locale, `FakeTelegram`, helper `say`/`press` di `test/helpers/send.ts`,
  `makeDeps({ now })`. Data di riferimento salvo diversa indicazione: `NOW` di
  `test/helpers/constants.ts` = 2026-10-28T10:00Z = **mercoledì 28/10/2026, 11:00 Europe/Rome**
  (ora solare, UTC+1).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: costanti e testi comuni

- [X] T001 In `src/config.ts` aggiungere, con commento e ID: `MESSAGE_MAX_LENGTH = 4096` (limite Telegram, FR-005), `LIST_MAX_LINES_PER_MESSAGE = 45` (limite prudenziale sulle entità, research R-05), `LIST_NAME_COLUMN_MAX = 20` (FR-001a, research R-02), `TODAY_MAX_MESSAGES = 10` (FR-007a, research R-06), `UPCOMING_DEFAULT_DAYS = 30` e `UPCOMING_MAX_DAYS = 366` (RF-17). Riusare `OUTCOME_CORRECTION_DAYS` esistente per le finestre di `/scaduti` e "Segna fatto", senza duplicarlo
- [X] T002 In `src/texts.ts` aggiungere `export const WEEKDAYS_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;` (indice = `getUTCDay()`) e in `T` le etichette di esito delle liste `listOutcome: { aperta: "in attesa", saltato: "saltato", non_confermato: "non confermato" }` e i testi comuni dei gruppi: `groupNotFound: (q) => \`Il gruppo «${q}» non esiste.\``, `existingGroups: (names) => \`Gruppi esistenti: ${names}\`` (riusare `T.noGroups` se non ce ne sono). Testi esatti da `contracts/comandi.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: trasporto con entità, callback `t:`, argomenti dei comandi, modulo delle liste,
funzioni pure condivise. **Nessuna story può iniziare prima della fine di questa fase.**

### Test della fase (scrivere prima)

- [X] T003 [P] Estendere `test/unit/telegram-client.test.ts`: `it("FR-001a: sendMessage invia entities nel body e mai parse_mode", …)` con fetch simulato; senza `entities` il body non contiene la chiave
- [X] T004 [P] Estendere `test/unit/callback-data.test.ts`: `t:f:123` e `t:s:123` decodificati come `{ kind: "static", scope: "t", action, id }`; `p:f:7` decodificato; round-trip encode/decode; `t:f:` senza id e `t:f:abc` → `null` (contracts/callback-data.md)
- [X] T005 [P] Estendere `test/unit/commands-parse.test.ts`: `parseCommand("/prossimi 7 famiglia")` → `{ name: "prossimi", args: "7 famiglia" }`; `"/cerca   Nicolò  "` → `args: "Nicolò"`; `"/oggi@bot"` → `args: ""`; `"/p_12"` mantiene `personId: 12`
- [X] T006 [P] Creare `test/unit/liste.test.ts` (contracts/liste.md): `formatListLine` con età e senza età, nickname vs nome completo, esito `in attesa`/`saltato`/`non confermato` riempito a 14, data `29/02` con giorno della settimana del 28/02/2027 (`Dom`), colonna riempita a `W` comune, nome di 30 caratteri oltre il tetto 20 non troncato, entità `code` con `offset 0` che termina prima dei due spazi e **non** copre `/p_<id>`, entità `bot_command` con offset e lunghezza esatti di `/p_<id>` (esattamente due entità per riga, non sovrapposte), offset UTF-16 corretti con emoji e lettere accentate; `splitMessage`: un messaggio per liste corte, nuove parti oltre 4096 caratteri **e** oltre 45 righe con entità, righe mai spezzate, righe vuote in testa alle continuazioni scartate, offset traslati nella posizione della riga, intestazione solo nel primo; 200 righe con nickname di 60 caratteri ed emoji → ogni parte ≤ 4096 e ≤ 45 righe
- [X] T007 [P] Creare `test/unit/viste-parse.test.ts` per le funzioni pure di `src/domain/viste.ts` e `src/domain/text.ts`: `searchKey("Nicolò") === searchKey("NICOLO")`; `sortByNextBirthday` (oggi = 0 in cima, pari data per nome con `Intl.Collator` e poi `id`, 29/02 in anno non bisestile alla posizione del 28/02, cavallo d'anno a dicembre); `nextBirthdayRow` restituisce data effettiva, anno ed età "che compirà"

### Implementazione della fase

- [X] T008 [P] In `src/telegram/types.ts` aggiungere `export interface MessageEntity { type: "code" | "bot_command"; offset: number; length: number }`; in `src/telegram/client.ts` estendere `TelegramApi.sendMessage(chatId, text, keyboard?, entities?: MessageEntity[])` e l'implementazione (campo `entities` nel body solo se l'array è non vuoto; nessun `parse_mode`). `reply` in `src/bot/context.ts` resta invariato
- [X] T009 In `test/helpers/fake-telegram.ts`: `sendMessage` accetta e registra `entities` in `SendCall` (`entities?: MessageEntity[]`); aggiungere `monoParts(call): string[]` che restituisce le sottostringhe coperte dalle entità `code` e `commandParts(call): string[]` per quelle `bot_command`, usate dai test delle liste. Dipende da T008 (tipo `MessageEntity`)
- [X] T010 [P] In `src/telegram/keyboard.ts` aggiungere lo scope `"t"` al tipo `Callback` e al decoder (stesse regole di `o`: 2–3 parti, `ACTION_RE`, `ID_RE`), commento con riferimento a contracts/callback-data.md
- [X] T011 [P] In `src/bot/commands.ts` aggiungere `args: string` a `ParsedCommand` (testo dopo il primo token, `trim()`); aggiornare `parseCommand` senza cambiare il comportamento di `name` e `personId`
- [X] T012 [P] In `src/domain/text.ts` aggiungere `searchKey(s) = s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT")` (research R-09) ed esportare `compareNames(a, b)` basata sul `COLLATOR` di modulo esistente (nessun nuovo `Collator`)
- [X] T013 Creare `src/domain/viste.ts` (puro, nessun import di `cloudflare:*`): tipo `ListPerson { id, fullName, nickname, birthDay, birthMonth, birthYear }`; `nextBirthdayRow(p, today)` → `{ person, date: LocalDate, age: number | null }` con `nextBirthday` ed `effectiveDate` di `src/domain/date.ts` (età = `next.year − birthYear`); `sortByNextBirthday(rows, today)` per `daysUntil`, poi `compareNames` sul nome visualizzato (`nickname ?? fullName`), poi `id` (research R-03). Dipende da T012
- [X] T014 Creare `src/bot/liste.ts` (puro + invio) secondo contracts/liste.md: `formatListLine({ date: LocalDate, birthDay, birthMonth, name, age, outcome?, id }, width)` → `{ text, entities }` con parte sinistra `"<Ggg> <gg/mm>  " + pad("nome[ (età)]", width) + ["  " + pad(esito, 14)]` coperta da un'entità `code`, poi `"  /p_<id>"` fuori dal `code` con un'entità `bot_command` esattamente su `/p_<id>`; giorno della settimana da `WEEKDAYS_IT[new Date(Date.UTC(y, m − 1, d)).getUTCDay()]` sulla data effettiva, data `gg/mm` di nascita; `columnWidth(names)` = `min(max lunghezza in code point, LIST_NAME_COLUMN_MAX)`; `splitMessage(lines: ListLine[])` greedy con `MESSAGE_MAX_LENGTH` e `LIST_MAX_LINES_PER_MESSAGE`; `sendList(ctx, header, lines)` che invia `[header, "", ...righe]` con `ctx.deps.tg.sendMessage(chatId, text, undefined, entities)` in sequenza, senza pause e senza tastiera. Dipende da T001, T002, T008
- [X] T015 Creare `src/db/viste.ts` con le parti condivise: `LIST_PERSON_COLUMNS` (`p.id, p.full_name, p.nickname, p.birth_day, p.birth_month, p.birth_year`), `rowToListPerson`, `listPersonsStatement(db, month?)` (tutte le persone, oppure `WHERE birth_month = ?`; una sola query, ≤ 200 righe) e `groupLookupStatements(db, nameNorm)` → `[SELECT id, name FROM groups WHERE name_norm = ?, SELECT <colonne> FROM persons p WHERE p.id IN (SELECT pg.person_id FROM person_groups pg JOIN groups g ON g.id = pg.group_id WHERE g.name_norm = ?), SELECT name FROM groups ORDER BY name COLLATE NOCASE, id]` da eseguire in **una** `db.batch` (research R-08; indici `ux_groups_name_norm`, `idx_person_groups_group`)
- [X] T016 In `src/bot/viste.ts` (nuovo) aggiungere l'helper condiviso `replyGroupNotFound(ctx, query, allNames)`: `T.groupNotFound(query)` + a capo + `T.existingGroups(nomi uniti da ", ")` oppure `T.noGroups` (FR-010, FR-014). Dipende da T002
- [ ] T016a Verifica manuale con il bot reale (`npx wrangler dev` con il webhook di sviluppo, quickstart 001): inviare tramite `sendList` una lista di prova di 50 righe sintetiche (2 messaggi, 45 + 5) e controllare che le colonne siano allineate, che ogni `/p_<id>` sia toccabile e apra la scheda e che nessuna entità venga ignorata nel primo messaggio (90 entità). Se Telegram ignora entità oltre una soglia, abbassare `LIST_MAX_LINES_PER_MESSAGE` in `src/config.ts` e aggiornare research R-05. Annotare l'esito in research R-05. Dipende da T014; da completare **prima** di US2 (research R-05, FR-001a)

**Checkpoint**: `npm run typecheck` e i test T003–T007 verdi; T016a superato; nessun comportamento esistente cambiato.

---

## Phase 3: User Story 1 — Compleanni di oggi (Priority: P1) 🎯 MVP

**Goal**: `/oggi` invia per ogni compleanno di oggi il messaggio del reminder con i pulsanti e lo
stato attuale; senza compleanni indica il prossimo (RF-16, FR-006…FR-008).

**Independent Test**: con persone che compiono gli anni oggi (occorrenze aperte, chiuse e
mancanti) e in un giorno senza compleanni, inviare `/oggi` e premere Fatto/Salta.

### Test per US1 (scrivere prima, devono fallire)

- [X] T017 [P] [US1] Creare `test/integration/us1-oggi.test.ts` (oggi = 28/10/2026): `RF-16`: due persone nate il 28/10 → due messaggi uguali a `renderGiorno` (titolo, gruppi, telefono, "L'anno scorso"), con WhatsApp/Copia e `Fatto ✅`/`Salta quest'anno` con `callback_data` `t:f:<occId>`/`t:s:<occId>`; occorrenza mancante → creata `aperta` con `effective_date = '2026-10-28'`, **zero righe in `deliveries`**; `RF-16, BR-07`: occorrenza già `fatto` → testo con "✅ Fatto" e soli pulsanti di contatto; premere `t:f` → occorrenza `fatto`, `editMessageText` del messaggio premuto, poi `runAt` delle 13:00 e 18:00 di oggi e delle 13:00 di domani (helper `test/helpers/cron.ts`) non inviano nulla per quella persona; `t:s` → `saltato`; secondo tocco → "Questa azione non è più disponibile"; occorrenza cancellata (persona eliminata) → "Persona non trovata"; `t:` durante un flusso `/nuovo` non annulla il flusso; `FR-007a`: 12 compleanni oggi → 10 messaggi reminder + 1 messaggio "Altri compleanni di oggi:" con 2 righe in formato lista, senza tastiera; `FR-008`: nessun compleanno oggi → "Oggi non ci sono compleanni. Il prossimo:" con **tutte** le persone del prossimo giorno (due persone il 30/10) in formato lista; nessuna persona → testo dedicato; `RF-16, research R-06`: persona inserita oggi alle 22:00 (`createdAt`), `/oggi` alle 22:30 e nessun tocco → `runAt` delle 00:00 del 30/10/2026 porta l'occorrenza a `non_confermato` (comportamento voluto); `FR-012 di 002`: oggi 28/02/2027 e persona nata il 29/02 → reminder con "(compleanno il 29/02)"
- [X] T018 [P] [US1] Aggiornare `test/unit/promemoria.test.ts` al nuovo campo di `ReminderData` (T019): con target `{ scope: "o", id }` i pulsanti restano `o:f:<id>`/`o:s:<id>`, con `{ scope: "t", id }` diventano `t:f:<id>`/`t:s:<id>`

### Implementazione per US1

- [X] T019 [US1] In `src/bot/promemoria.ts` sostituire `ReminderData.deliveryId` con `actionTarget: { scope: "o" | "t"; id: number }`, usato da `done`/`skip`; in `buildReminderData` il parametro `deliveryId` diventa `actionTarget`. Adeguare i chiamanti senza cambiare comportamento: `src/cron/hourly.ts` (`{ scope: "o", id: row.id }`), `src/bot/esiti.ts` (`{ scope: "o", id: deliveryId }`), `bench/ciclo.bench.ts`. Tutti i test esistenti di 002 devono restare verdi
- [X] T020 [US1] In `src/db/viste.ts` aggiungere `todayStatements(db, { pairs, year, effectiveDate, nowIso })` → batch `[INSERT OR IGNORE INTO occurrences (person_id, year, effective_date, status, created_at) SELECT p.id, ?, ?, 'aperta', ? FROM persons p WHERE <(p.birth_month = ? AND p.birth_day = ?) per ogni coppia>, SELECT p.id, <colonne di PersonRowLike>, GROUP_NAMES_SQL, o.id AS occurrence_id, o.year, o.status, (SELECT prev.status FROM occurrences prev WHERE prev.person_id = p.id AND prev.year = o.year − 1) AS last_year_status, (SELECT value FROM settings WHERE key = DEFAULT_MESSAGE_KEY) AS default_message FROM persons p JOIN occurrences o ON o.person_id = p.id AND o.year = ? WHERE <stesse coppie>]`; coppie da `birthPairsFor(today)` di `src/domain/schedule.ts` (BR-04); tipo `TodayRow` di data-model.md
- [X] T021 [US1] Creare `src/db/oggi.ts` con `applyTodayOutcome(db, { occurrenceId, action: "f" | "s", nowIso })`: una `db.batch` con `UPDATE occurrences SET status = ?, outcome_at = ? WHERE id = ? AND status = 'aperta'` e la `SELECT` degli stessi campi di `TodayRow` per `o.id = ?`; restituisce `{ changed, data }` come `applyOutcomeBatch` di `src/db/outcomes.ts`
- [X] T022 [US1] In `src/texts.ts` aggiungere: `todayNone: "Oggi non ci sono compleanni. Il prossimo:"`, `todayNoPersons: "Oggi non ci sono compleanni e non hai ancora inserito nessuna persona."`, `todayOthers: "Altri compleanni di oggi:"` (contracts/comandi.md)
- [X] T023 [US1] Creare `src/bot/oggi.ts`: `showOggi(ctx)` — esegue `todayStatements` in una batch, ordina le righe per nome (`compareNames`), per le prime `TODAY_MAX_MESSAGES` invia `renderGiorno` (occorrenza `aperta`) o `renderGiornoAfter(…, "fatto" | "saltato")` costruiti con `buildReminderData(row, { actionTarget: { scope: "t", id: occurrence_id }, year, lastYear, defaultMessage })`; le restanti con `sendList(ctx, T.todayOthers, …)` (età = `year − birth_year`); se non ci sono righe legge `listPersonsStatement`, prende tutte le persone con il minimo `daysUntil` (`sortByNextBirthday`) e risponde con `sendList(ctx, T.todayNone, …)`, oppure `T.todayNoPersons`. `handleTodayCallback(ctx, action, occurrenceId)` — `applyTodayOutcome`; `data` assente → `answerCallback(T.personNotFound)`; `changed` falso → `T.actionUnavailable`; altrimenti `editMessageText` del messaggio premuto con `renderGiornoAfter` e `answerCallback()` senza testo (3 subrequest)
- [X] T024 [US1] In `src/bot/router.ts` gestire `cb.scope === "t"` nello stesso ramo di `o:` (prima di `routeStatic`, senza `clear` del flusso): azioni `f`/`s` con id → `handleTodayCallback`, altrimenti `T.actionUnavailable`. In `src/bot/commands.ts` registrare `oggi: (ctx) => showOggi(ctx)` con commento `// RF-16`

**Checkpoint**: `us1-oggi.test.ts` e tutti i test di 001/002 verdi.

---

## Phase 4: User Story 2 — Prossimi compleanni (Priority: P1)

**Goal**: `/prossimi [giorni] [gruppo]` mostra i compleanni da oggi a oggi + N − 1 nel formato
di §5.7 (RF-17, FR-009…FR-011).

**Independent Test**: persone in date e gruppi diversi; `/prossimi`, `/prossimi 7`,
`/prossimi 7 famiglia`, `/prossimi 7 inesistente`, `/prossimi 400`.

### Test per US2 (scrivere prima, devono fallire)

- [X] T025 [P] [US2] Creare `test/integration/us2-prossimi.test.ts` (oggi = 28/10/2026): `RF-17`: `/prossimi` → intestazione "Prossimi 30 giorni", righe ordinate per prossimo compleanno fino al 26/11 compreso, il 27/11 escluso; `/prossimi 7 famiglia` (gruppo salvato come "Famiglia") → "Prossimi 7 giorni (Famiglia)" e solo i membri; `/prossimi famiglia` → 30 giorni filtrati; `/prossimi 7 FAMIGLIA` uguale; gruppo inesistente → "Il gruppo «inesistente» non esiste." + "Gruppi esistenti: …"; `/prossimi 0`, `/prossimi -3`, `/prossimi 400` → "Il numero di giorni deve essere tra 1 e 366" e nessuna lista; `/prossimi 1` → "Prossimo giorno"; chiarimento: Anna oggi e Luca il 04/11 → `/prossimi 7` con Anna in cima e Luca assente; `§5.7`: persona senza anno → riga senza età; righe con parte sinistra in monospazio (`monoParts`) allineate alla stessa larghezza e `/p_<id>` fuori dall'entità; nessuna tastiera; nessun compleanno → "Nessun compleanno nei prossimi 7 giorni"; cavallo d'anno: oggi 20/12/2026, `/prossimi 30` include il 05/01/2027 con l'età del 2027

### Implementazione per US2

- [X] T026 [US2] In `src/domain/viste.ts` aggiungere `parseUpcomingArgs(args)` → `{ ok: true, days, group: string | null } | { ok: false }`: primo token `/^-?\d+$/` = giorni (valido solo 1–`UPCOMING_MAX_DAYS`), resto (anche con spazi) = gruppo; primo token non numerico → tutto è il gruppo, giorni = `UPCOMING_DEFAULT_DAYS` (research R-10); e `upcoming(rows, today, days)` = righe con `daysUntil ≤ days − 1` ordinate con `sortByNextBirthday` (FR-009). Aggiungere i casi in `test/unit/viste-parse.test.ts`
- [X] T027 [US2] In `src/texts.ts` aggiungere `upcomingHeader: (days, group: string | null) => …` ("Prossimi N giorni", "Prossimo giorno" con N = 1, suffisso ` (Gruppo)`), `upcomingNone: (days, group) => …` ("Nessun compleanno nei prossimi N giorni" + suffisso), `upcomingDaysRange: (max) => \`Il numero di giorni deve essere tra 1 e ${max}\``, chiamata con `UPCOMING_MAX_DAYS` (contracts/comandi.md, principio VIII)
- [X] T028 [US2] In `src/bot/viste.ts` implementare `showProssimi(ctx, args)`: argomenti non validi → `T.upcomingDaysRange`; con gruppo → `groupLookupStatements(normKey(gruppo))` in una batch (gruppo assente → `replyGroupNotFound`), senza gruppo → `listPersonsStatement`; righe di `upcoming` formattate con `formatListLine` (data effettiva del prossimo compleanno, età che compirà) e `columnWidth` sull'intera lista; `sendList` con `T.upcomingHeader(days, nomeSalvato)` oppure `T.upcomingNone`. Registrare `prossimi` in `src/bot/commands.ts` (`// RF-17`)

**Checkpoint**: US1 e US2 verdi in modo indipendente.

---

## Phase 5: User Story 3 — Ricerca e apertura della scheda (Priority: P1)

**Goal**: `/cerca <testo>` trova per parte del nome o nickname, senza maiuscole e accenti; un
risultato apre la scheda (RF-18, FR-012, FR-013).

**Independent Test**: persone dai nomi simili; testo che ne trova una, più di una, nessuna.

### Test per US3 (scrivere prima, devono fallire)

- [X] T029 [P] [US3] Creare `test/integration/us3-cerca.test.ts`: `RF-18`: un solo risultato (`/cerca marc` con "Marco Rossi") → messaggio identico a `/p_<id>` (stessa scheda e tastiera); più risultati → "Risultati per «a»" + righe ordinate per prossimo compleanno, nessuna tastiera; `/cerca MARCHINO` trova il nickname "Marchino"; chiarimento: `/cerca nicolo` trova "Nicolò" e `/cerca NICOLÒ` trova "Nicolo"; ricerca sia su nome completo sia su nickname; nessun risultato → "Nessun risultato per «zzz»"; `/cerca` senza testo → testo di sintassi; la ricerca stessa usa una sola chiamata D1 (contatore), più quelle di `showScheda` con un solo risultato

### Implementazione per US3

- [X] T030 [US3] In `src/domain/viste.ts` aggiungere `matchSearch(rows, query)`: `searchKey(query)` contenuto in `searchKey(fullName)` o in `searchKey(nickname)` (FR-012). Aggiungere i casi in `test/unit/viste-parse.test.ts`
- [X] T031 [US3] In `src/texts.ts` aggiungere `searchUsage: "Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco"`, `searchHeader: (q) => \`Risultati per «${q}»\``, `searchNone: (q) => \`Nessun risultato per «${q}»\``
- [X] T032 [US3] In `src/bot/viste.ts` implementare `showCerca(ctx, args)`: vuoto → `T.searchUsage`; legge tutte le persone con `listPersonsStatement` (una chiamata), filtra con `matchSearch`; 1 risultato → `showScheda(ctx, id)`; più → `sendList(ctx, T.searchHeader(q), …)` ordinate con `sortByNextBirthday`; 0 → `T.searchNone(q)`. Registrare `cerca` in `src/bot/commands.ts` (`// RF-18`)

**Checkpoint**: US1–US3 (tutte le P1) verdi.

---

## Phase 6: User Story 4 — Scaduti e "Segna fatto" (Priority: P2)

**Goal**: `/scaduti` mostra le occorrenze da oggi−7 a ieri con esito diverso da *fatto*; la
scheda offre "Segna fatto" (RF-21, BR-08, FR-016…FR-018).

**Independent Test**: occorrenze *saltato*, *non confermato*, aperta di ieri e *fatto* negli
ultimi 7 giorni più una *saltato* di 8 giorni fa; `/scaduti`, schede, "Segna fatto".

### Test per US4 (scrivere prima, devono fallire)

- [X] T033 [P] [US4] Creare `test/integration/us4-scaduti.test.ts` (oggi = 28/10/2026, finestra 21/10…27/10): `RF-21`: occorrenze `saltato` del 25/10, `non_confermato` del 22/10 e `aperta` del 27/10 → "Ultimi 7 giorni, non fatti" con tre righe in ordine di data e gli esiti "non confermato", "saltato", "in attesa"; età = anno dell'occorrenza − anno di nascita; `fatto` del 24/10, `saltato` del 20/10 (8 giorni) e occorrenza `aperta` di oggi esclusi; nessuna in sospeso → "Nessun compleanno in sospeso negli ultimi 7 giorni"; `RF-21, BR-08`: `/p_<id>` della `saltato` del 25/10 → tastiera con riga `[Segna fatto]` (`p:f:<personId>`) sopra `[Modifica] [Elimina]`; scheda della persona con `fatto` o con `saltato` di 8 giorni fa → nessun "Segna fatto"; tocco → occorrenza `fatto`, `editMessageText` della scheda con "Storico: 2026 fatto" e senza "Segna fatto", `answerCallbackQuery` senza testo; `BR-07`: aperta del 27/10 → "Segna fatto" → `fatto` e `runAt` delle 13:00 di oggi non invia il recupero; `BR-08, FR-018`: tocco dopo aver spostato l'occorrenza a 8 giorni fa o su un'occorrenza già `fatto` → "Questa azione non è più disponibile" ed esito invariato; persona eliminata → "Persona non trovata"
- [X] T034 [P] [US4] Aggiornare `test/unit/scheda.test.ts` e `test/integration/us3-scheda.test.ts`: `schedaKeyboard(personId, hasPending)` con e senza la riga "Segna fatto"; `/p_<id>` fa una sola `db.batch` oltre a `getActive` del router: 2 chiamate D1 senza flusso attivo (contatore di `test/helpers/deps.ts`)

### Implementazione per US4

- [X] T035 [US4] In `src/db/persons.ts` aggiungere `schedaStatements(db, personId, { from, to })` → `[SELECT * FROM persons WHERE id = ?, gruppi (stessa query di getGroupNames), storico (stessa query di getOutcomes), SELECT id, year, effective_date, status FROM occurrences WHERE person_id = ? AND status <> 'fatto' AND effective_date BETWEEN ? AND ? LIMIT 1]` e `markDoneStatement(db, personId, { from, to, nowIso })` = `UPDATE occurrences SET status = 'fatto', outcome_at = ? WHERE person_id = ? AND status <> 'fatto' AND effective_date BETWEEN ? AND ?` (FR-017, FR-018); `from = oggi − OUTCOME_CORRECTION_DAYS`, `to = ieri` come `toDateString(addDays(today, …))`
- [X] T036 [US4] In `src/texts.ts` aggiungere `btnMarkDone: "Segna fatto"`, `overdueHeader: (days) => \`Ultimi ${days} giorni, non fatti\``, `overdueNone: (days) => \`Nessun compleanno in sospeso negli ultimi ${days} giorni\``, entrambe chiamate con `OUTCOME_CORRECTION_DAYS` (principio VIII)
- [X] T037 [US4] In `src/bot/scheda.ts`: `showScheda` legge con **una** `db.batch(schedaStatements(…))` (persona assente → `T.personNotFound`); `schedaKeyboard(personId, hasPending = false)` aggiunge sopra Modifica/Elimina la riga `button(T.btnMarkDone, { kind: "static", scope: "p", action: "f", id })`; nuovo `markDone(ctx, personId)`: una batch `[markDoneStatement, ...schedaStatements]`, `changes = 0` → `answerCallback(T.actionUnavailable)`; altrimenti `editMessageText` del messaggio premuto con `renderScheda` aggiornata e `schedaKeyboard(personId, false)`. Gli altri chiamanti di `schedaKeyboard` restano validi con il default
- [X] T038 [US4] In `src/bot/router.ts` aggiungere a `STATIC_CALLBACKS` la voce `"p:f": (ctx, id) => markDone(ctx, id ?? 0)` (il controllo "Persona non trovata" di `routeStatic` resta a monte)
- [X] T039 [US4] In `src/db/viste.ts` aggiungere `overdueStatement(db, from, to)`: `SELECT <colonne lista>, o.id AS occurrence_id, o.year, o.effective_date, o.status FROM occurrences o JOIN persons p ON p.id = o.person_id WHERE o.effective_date BETWEEN ? AND ? AND o.status <> 'fatto' ORDER BY o.effective_date, p.id` (indice `idx_occurrences_date`); in `src/bot/viste.ts` implementare `showScaduti(ctx)`: righe con data = `effective_date`, età = `year − birth_year`, esito = `T.listOutcome[status]`, ordine per data e poi `compareNames` (FR-002, FR-016); `sendList(ctx, T.overdueHeader, …)` oppure `T.overdueNone`. Registrare `scaduti` in `src/bot/commands.ts` (`// RF-21`)

**Checkpoint**: US4 verde; i test della scheda di 001/002 verdi.

---

## Phase 7: User Story 5 — Persone di un gruppo e compleanni del mese (Priority: P2)

**Goal**: `/gruppo <nome>` e `/mese [mese]` (RF-19, RF-20, FR-014, FR-015).

**Independent Test**: gruppi e compleanni in mesi diversi; `/gruppo lavoro`, `/mese`,
`/mese marzo`, `/mese 3`, varianti non valide.

### Test per US5 (scrivere prima, devono fallire)

- [X] T040 [P] [US5] Creare `test/integration/us5-gruppo-mese.test.ts` (oggi = 28/10/2026): `RF-19`: `/gruppo lavoro` → "Gruppo Lavoro" + tutte le persone del gruppo, senza limite di giorni, per prossimo compleanno; `/gruppo LAVORO` uguale; gruppo inesistente → messaggio + elenco gruppi; `/gruppo` senza nome → sintassi + elenco gruppi; gruppo vuoto → "Nessuna persona nel gruppo Lavoro"; `RF-20`: `/mese marzo`, `/mese Marzo` e `/mese 3` identici → "Compleanni di marzo 2027" ordinati per giorno; `/mese` → mese corrente "Compleanni di ottobre 2026"; chiarimento: Sara 05/10/1990 → riga "Lun 05/10  Sara (36)" (testo della parte monospazio senza spazi di riempimento finali); `/mese marzzo`, `/mese 13`, `/mese 0` → "Mese non riconosciuto: …"; `/mese febbraio` con un nato il 29/02 → riga "29/02" con il giorno della settimana del 28/02/2027; mese senza compleanni → "Nessun compleanno a giugno"

### Implementazione per US5

- [X] T041 [US5] In `src/domain/viste.ts` aggiungere `parseMonth(args, today)` → `{ ok: true, month } | { ok: false }` (vuoto = mese corrente; `normKey` confrontato con `MONTHS_IT`; intero 1–12) e `monthRows(rows, month, today)`: anno di riferimento `R = month ≥ today.month ? today.year : today.year + 1`, data effettiva `effectiveDate(day, month, R)`, età `R − birthYear`, ordine per giorno di nascita poi `compareNames` (FR-015, research R-04). Casi in `test/unit/viste-parse.test.ts`
- [X] T042 [US5] In `src/texts.ts` aggiungere `groupHeader: (name) => \`Gruppo ${name}\``, `groupEmpty: (name) => \`Nessuna persona nel gruppo ${name}\``, `groupUsage: "Scrivi /gruppo seguito dal nome del gruppo, es. /gruppo Famiglia"`, `monthHeader: (monthName, year) => \`Compleanni di ${monthName} ${year}\``, `monthNone: (monthName) => \`Nessun compleanno a ${monthName}\``, `monthInvalid: "Mese non riconosciuto: scrivilo per nome (es. marzo) o per numero da 1 a 12"`
- [X] T043 [US5] In `src/bot/viste.ts` implementare `showGruppo(ctx, args)` (vuoto → `T.groupUsage` + elenco gruppi dalla stessa batch; `groupLookupStatements`; inesistente → `replyGroupNotFound`; persone ordinate con `sortByNextBirthday`, età che compirà) e `showMese(ctx, args)` (`parseMonth`; `listPersonsStatement(db, month)`; `monthRows`; `sendList` con `T.monthHeader(MONTHS_IT[m − 1], R)`). Registrare `gruppo` (`// RF-19`) e `mese` (`// RF-20`) in `src/bot/commands.ts`

**Checkpoint**: US5 verde in modo indipendente.

---

## Phase 8: User Story 6 — Riepilogo dell'anno (Priority: P3)

**Goal**: `/anno [anno]` con conteggi, saltati e serie di 2+ anni (RF-22, FR-019).

**Independent Test**: storico su più anni; `/anno`, `/anno 2025`, anno senza dati.

### Test per US6 (scrivere prima, devono fallire)

- [X] T044 [P] [US6] Creare `test/integration/us6-anno.test.ts`: `RF-22`: 2025 con 40 `fatto`, 3 `saltato`, 2 `non_confermato` → "Riepilogo 2025", "Fatto: 40", "Saltato: 3", "Non confermato: 2" e la sezione "Saltati:" con 3 righe in ordine di data (data dell'occorrenza 2025, età `2025 − anno di nascita`); Luca `saltato` 2024 e 2025 → in "Saltati per 2 o più anni di fila:"; `BR-09`: Giulia `non_confermato` 2024 e `saltato` 2025 → tra i saltati ma non nella serie; Paolo `saltato` 2023 e 2024, `fatto` 2025 → non nella serie di 2025; `/anno` → anno corrente 2026; occorrenze `aperta` non conteggiate; anno senza esiti → conteggi a zero e sezioni con "nessuno"; `/anno 2027`, `/anno 1850`, `/anno 20x5` → "Anno non valido: scrivi un anno tra 1900 e 2026"; nessuna tastiera

### Implementazione per US6

- [X] T045 [US6] In `src/db/viste.ts` aggiungere `yearStatements(db, year)` → batch `[SELECT status, COUNT(*) AS n FROM occurrences WHERE year = ? AND status <> 'aperta' GROUP BY status, SELECT <colonne lista>, o.effective_date, o.year FROM occurrences o JOIN persons p ON p.id = o.person_id WHERE o.year = ? AND o.status = 'saltato' ORDER BY o.effective_date, p.id, stessa SELECT con JOIN occurrences prev ON prev.person_id = o.person_id AND prev.year = o.year − 1 AND prev.status = 'saltato']` (FR-019, research R-11)
- [X] T046 [US6] In `src/domain/viste.ts` aggiungere `parseYear(args, today)` → anno corrente se vuoto; valido solo `/^\d{4}$/` con `MIN_BIRTH_YEAR ≤ Y ≤ today.year`. In `src/texts.ts` aggiungere `yearHeader: (y) => \`Riepilogo ${y}\``, `yearCounts: (f, s, n) => [\`Fatto: ${f}\`, \`Saltato: ${s}\`, \`Non confermato: ${n}\`]`, `yearSkipped: "Saltati:"`, `yearStreak: "Saltati per 2 o più anni di fila:"`, `yearNone: "nessuno"`, `yearInvalid: (min, max) => \`Anno non valido: scrivi un anno tra ${min} e ${max}\``, chiamata con `MIN_BIRTH_YEAR` e `today.year` (principio VIII)
- [X] T047 [US6] In `src/bot/viste.ts` implementare `showAnno(ctx, args)`: `parseYear`; una batch `yearStatements`; righe con data effettiva dell'occorrenza ed età `Y − birth_year`, `columnWidth` calcolata su tutte le righe delle due sezioni; `sendList` con `[...yearCounts, "", yearSkipped, righe | yearNone, "", yearStreak, righe | yearNone]` (contracts/comandi.md). Registrare `anno` in `src/bot/commands.ts` (`// RF-22`)

**Checkpoint**: tutte le story verdi.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T048 In `src/texts.ts` aggiornare `T.help`: prima di `/annulla` le righe `/oggi — compleanni di oggi`, `/prossimi [giorni] [gruppo] — prossimi compleanni`, `/cerca <testo> — cerca per nome o nickname`, `/gruppo <nome> — persone di un gruppo`, `/mese [mese] — compleanni del mese`, `/scaduti — ultimi 7 giorni non fatti`, `/anno [anno] — riepilogo dell'anno` (AFU §5.1); aggiornare l'elenco dei comandi atteso in `test/integration/us7-start-aiuto.test.ts`
- [X] T049 [P] Creare `test/integration/viste-budget.test.ts` con il contatore di `test/helpers/deps.ts`: `RNF-16, SC-002`: 200 persone → `/prossimi 366` e `/gruppo` (tutte nel gruppo) restituiscono 200 righe uniche distribuite su 5 messaggi, ogni messaggio ≤ 4096 caratteri e ≤ 45 righe; `RNF-14, SC-005`: nessuna `sendMessage` di lista con tastiera; principio II: subrequest esatte e ≤ 50 (valori di plan.md, che includono `getActive` del router) per `/prossimi 366` (2 D1 + 5 Telegram), `/oggi` con 15 compleanni (2 D1 + 11 Telegram), `/anno` con 200 saltati in serie (2 D1 + messaggi), `t:f` (1 D1 + 2 Telegram), `p:f` (3 D1: `getById` + `clear` + batch, + 2 Telegram); con un flusso guidato attivo `/prossimi 366` costa una chiamata D1 in più (`clear`)
- [X] T050 [P] Creare `bench/liste.bench.ts` (solo dati sintetici): 200 persone → `sortByNextBirthday` + `formatListLine` + `splitMessage`; `matchSearch` su 200 persone; soglia < 2 ms per iterazione (research R-12). Nessun import di `cloudflare:*`
- [X] T051 [P] Verificare che `test/unit/privacy-log.test.ts` copra i nuovi moduli: nessuna chiamata a `log` con testi di ricerca, nomi o date in `src/bot/viste.ts`, `src/bot/oggi.ts`, `src/bot/liste.ts` (principio V); estendere il test se controlla un elenco di file
- [X] T052 Eseguire `npm run typecheck`, `npm test` e `npm run bench`; correggere fino a tutto verde e benchmark entro soglia (gate di chiusura della constitution)
- [ ] T053 Eseguire la prova manuale di `specs/003-viste-ricerche/quickstart.md` §3 e verificare a vista l'allineamento delle colonne e che ogni `/p_<id>` sia toccabile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza
- **Foundational (Phase 2)**: dopo Setup; **blocca tutte le story**
- **User Stories (Phase 3–8)**: dopo Foundational; indipendenti tra loro salvo quanto sotto
- **Polish (Phase 9)**: dopo le story desiderate; T049 richiede tutte le story

### User Story Dependencies

- **US1 (P1)**: solo Foundational. Contiene il refactor `actionTarget` di `promemoria.ts` (T019)
- **US2 (P1)**: solo Foundational
- **US3 (P1)**: solo Foundational; il caso "un risultato" usa `showScheda` esistente e funziona
  anche prima di US4 (dopo US4 la scheda costa una sola chiamata D1)
- **US4 (P2)**: solo Foundational; modifica `scheda.ts`, quindi i test della scheda di 001/002
  vanno rieseguiti
- **US5 (P2)**: solo Foundational (`groupLookupStatements`, `replyGroupNotFound`)
- **US6 (P3)**: solo Foundational

### Within Each User Story

- Test prima, devono fallire
- `domain/` (puro) → `db/` → `texts.ts` → `bot/` → registrazione in `commands.ts`/`router.ts`
- I file condivisi (`texts.ts`, `commands.ts`, `bot/viste.ts`, `db/viste.ts`, `domain/viste.ts`)
  impongono l'ordine sequenziale tra story se lavorate in parallelo

### Parallel Opportunities

- Phase 2: T003–T007 (test) in parallelo; T008, T010, T011, T012 in parallelo (file diversi), T009 subito dopo T008
- In ogni story il task di test [P] può partire subito dopo Foundational
- US1 e US4 toccano file in gran parte diversi (`oggi.ts`, `promemoria.ts` vs `scheda.ts`,
  `persons.ts`) e si prestano a essere sviluppate in parallelo
- Phase 9: T049, T050, T051 in parallelo

---

## Parallel Example: User Story 1

```text
# Dopo Foundational, in parallelo:
Task: "T017 test/integration/us1-oggi.test.ts"
Task: "T018 test/unit/promemoria.test.ts (actionTarget)"

# Poi in sequenza (stessi file o dipendenze):
T019 promemoria.ts → T020 db/viste.ts → T021 db/oggi.ts → T022 texts.ts → T023 bot/oggi.ts → T024 router/commands
```

## Parallel Example: Foundational

```text
Task: "T008 MessageEntity + sendMessage(entities)"
Task: "T010 scope t nel decoder"
Task: "T011 ParsedCommand.args"
Task: "T012 searchKey e compareNames"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1, `/oggi`)
3. **STOP and VALIDATE**: `us1-oggi.test.ts` e test di 002 verdi; prova manuale passi 1–2 del quickstart
4. Deploy se utile: `/oggi` è già una rete di sicurezza autonoma

### Incremental Delivery

1. Setup + Foundational → modulo liste pronto
2. US1 `/oggi` → US2 `/prossimi` → US3 `/cerca` (tutte P1)
3. US4 `/scaduti` + "Segna fatto" → US5 `/gruppo`, `/mese` (P2)
4. US6 `/anno` (P3)
5. Polish: `/aiuto`, budget, benchmark, gate di chiusura

---

## Notes

- [P] = file diversi, nessuna dipendenza da task incompleti
- Ogni test cita l'ID AFU/FR verificato (principio XI)
- Commit dopo ogni task o gruppo logico, senza righe di attribuzione (istruzioni del proprietario)
- Fermarsi a ogni checkpoint per validare la story in modo indipendente
