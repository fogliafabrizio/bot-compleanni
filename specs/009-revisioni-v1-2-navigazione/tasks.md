---

description: "Task list della feature 009 — Revisioni v1.2: Navigazione"
---

# Tasks: Revisioni v1.2 — Navigazione

**Input**: documenti di `specs/009-revisioni-v1-2-navigazione/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md),
[contracts/callback-data.md](contracts/callback-data.md), [contracts/viste-v12.md](contracts/viste-v12.md),
[contracts/testi-v12.md](contracts/testi-v12.md)

**Fonte funzionale**: `docs/AFU.md` v1.2 (REV-008…REV-011)

**Tests**: richiesti (constitution X; plan.md, "Copertura dei criteri Dato/Quando/Allora v1.2"). Ogni
test riporta l'ID AFU nel nome.

**Organizzazione**: ordine richiesto dall'utente — dominio con test unitari → dati → `callback_data` e
router → bot (Gruppi, Statistiche, passo successivo) → testi e inventario → test (nuovi ed esistenti)
→ bench e smoke Postman. Le fasi del bot sono una per user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diverso, nessuna dipendenza da task non completati)
- **[Story]**: user story di spec.md (US1…US6)
- Percorsi relativi alla radice del repository (progetto singolo: `src/`, `test/`, `bench/`, `postman/`)

## Vincoli comuni (valgono per ogni task)

- **Nessuna migration, nessuna dipendenza nuova, nessuna scrittura nuova su D1** (FR-025). Non toccare
  `src/cron/*`, `src/db/backup.ts`, `src/domain/backup.ts`, `src/bot/export.ts`, `src/bot/import.ts`,
  `migrations/*` (FR-028).
- Ogni lettura nuova è una statement **nella `D1.batch` già presente**: nessuna subrequest in più nei
  percorsi esistenti (research R-11).
- Ogni pulsante di passo successivo manda un **nuovo** messaggio (nessun `editMessage*`), sta
  sull'**ultimo** messaggio di una vista spezzata (`sendLines`), al massimo **2** per vista; nessun
  pulsante sulle righe delle persone; `/cerca` senza pulsanti (RNF-14, FR-016, FR-017).
- Date da `toLocal(ctx.deps.now())`; le funzioni pure ricevono `today` (constitution VI).
- Testi solo in `src/texts.ts` (RNF-15); nessun nome, nickname o data nei log (constitution V).
- "Senza gruppo" si calcola con `NOT EXISTS` su `person_groups`: **nessun confronto sul nome**
  `'Senza gruppo'` nel codice (FR-005, FR-027).

> **Nota sull'ordine**: le chiavi `T.*` usate nelle fasi 2–8 nascono nella Fase 9 (Testi), come
> richiesto. Finché la Fase 9 non è completa, `npm run typecheck` e i test che confrontano testi
> possono fallire: il gate completo è al checkpoint della Fase 9 e poi della Fase 10.

---

## Phase 1: Setup (configurazione condivisa)

**Purpose**: costanti centralizzate (constitution VIII)

- [X] T001 In `src/config.ts` aggiungere `export const UPCOMING_WIDE_DAYS = 90;` accanto a `UPCOMING_DEFAULT_DAYS`/`UPCOMING_MAX_DAYS`, con commento `// RF-17, FR-018: finestra allargata di [Prossimi 90 giorni]`, e aggiornare il commento di `GROUP_BUTTONS_MAX` da "61 ≤ 100" a "60 gruppi + [Senza gruppo (N)] + [➕ Nuovo gruppo] = 62 ≤ 100 (V-09)"

---

## Phase 2: Foundational (prerequisiti bloccanti)

**Purpose**: dominio puro con test unitari, letture D1, `callback_data` e router. Blocca tutte le user story.

### 2a — Dominio (funzioni pure) e test unitari

- [X] T002 [P] In `src/domain/viste.ts` aggiungere `adjacentMonths(month: number): { prev: number; next: number }`, circolare: 1 → `{ prev: 12, next: 2 }`, 12 → `{ prev: 11, next: 1 }` (RF-20, FR-019; research R-05)
- [X] T003 In `src/domain/viste.ts` aggiungere `yearNavigation(shown: number, currentYear: number, prevHasHistory: boolean): { prev: number | null; next: number | null }`: `prev = shown − 1` solo se `prevHasHistory`; `next = shown + 1` solo se `shown < currentYear` (RF-22, FR-020)
- [X] T004 In `src/domain/viste.ts` aggiungere `canWidenUpcoming(days: number): boolean` = `days < UPCOMING_WIDE_DAYS` (import da `src/config.ts`) (RF-17, FR-018)
- [X] T005 Creare `test/unit/navigazione.test.ts` (nomi dei test con l'ID AFU): `adjacentMonths` 1 → {12, 2}, 3 → {2, 4}, 12 → {11, 1} e ciclo completo dei 12 mesi in entrambe le direzioni (RF-20, SC-004); `yearNavigation` (2026, 2026, true) → prev 2025/next null, (2026, 2026, false) → nessuno, (2025, 2026, false) → next 2026, (2023, 2026, false) → next 2024, (2025, 2026, true) → entrambi (RF-22); `canWidenUpcoming` 1, 30, 89 → true; 90, 120, 366 → false (RF-17)
- [X] T006 [P] In `src/domain/statistiche.ts` aggiungere `isValidBirthYear(year: number, today: LocalDate): boolean` = `MIN_BIRTH_YEAR ≤ year ≤ today.year` (BR-02, FR-026a) e `currentAge(day, month, year, today): number` = `today.year − year − (daysBetween(today, effectiveDate(day, month, today.year)) > 0 ? 1 : 0)`, minimo 0 (`daysBetween` di `src/time.ts`; nessun confronto `<` tra oggetti `LocalDate`), usando `effectiveDate` di `src/domain/date.ts` (29/02 → 28/02 negli anni non bisestili) (RF-32, BR-03 per la sola `/statistiche`, BR-04, FR-011)
- [X] T007 In `src/domain/statistiche.ts` aggiungere `ageBuckets(ages: readonly number[]): number[]` con 9 fasce (`0-9`…`70-79`, `80+`; indice `Math.min(Math.floor(age / 10), 8)`) restituendo solo le fasce dalla minima alla massima non vuota, intermedie a 0, e `[]` se `ages` è vuoto; e `averageAge(ages): number` = `Math.round(somma / n)` (0,5 per eccesso) (RF-32, FR-012, FR-013, FR-026a: età ≥ 120 in `80+`)
- [X] T008 In `src/domain/statistiche.ts` generalizzare `histogramLines(counts)` in `barLines(labels: readonly string[], counts: readonly number[]): string[]` (stessa regola: al più `STATS_BAR_WIDTH` blocchi per la fascia più numerosa, almeno 1 per una fascia non vuota, conteggi allineati a destra) `histogramLines(counts)` resta esportata come `barLines(MONTHS_SHORT, counts)`, con output identico a oggi, così i test esistenti di `test/unit/statistiche.test.ts` passano senza modifiche (RF-32, research R-07)
- [X] T009 In `src/domain/statistiche.ts` aggiungere `ageSectionLines(ages: readonly number[], withoutYear: number): ListLine[]`: riga `T.statsAgeTitle`; con `ages` vuoto la sola riga `T.statsAgeUnavailable` (FR-014); altrimenti istogramma con etichette `AGE_BUCKET_LABELS` larghe 5 (`T.statsAgeRow`) in una riga con entità `pre`, poi `T.statsAgeAverage(averageAge(ages), withoutYear)` fuori dal blocco; nessun nome di persona (RF-32, FR-010…FR-015)
- [X] T010 In `src/domain/statistiche.ts` estendere `StatisticheData` con `births: readonly StatsBirthRow[]` e `today: LocalDate`; in `formatStatistiche` calcolare le età solo per `births` con `isValidBirthYear`, `withoutYear = persons.total − ages.length` (comprende `NULL` e anni fuori da BR-02, dati invariati) e inserire `line("")` + `ageSectionLines(...)` subito dopo l'istogramma per mese e prima di `T.statsDone` (RF-32, D-32, FR-010, FR-026, FR-026a); le altre righe, compresa "Senza gruppo N", restano invariate
- [X] T011 In `test/unit/statistiche.test.ts` aggiungere i casi delle funzioni nuove (nomi con RF-32/BR-03/BR-04): `currentAge` 14/03/1994 al 29/10/2026 = 32, al 10/03/2026 = 31, al 14/03/2026 = 32; 29/02/2000 al 28/02/2026 = 26, al 27/02/2026 = 25; nato il 30/12/2026 al 29/10/2026 = 0; `isValidBirthYear` 1899 → false, 1900 → true, anno corrente → true, anno + 1 → false; `ageBuckets` [8, 34, 37, 52] → 1,0,0,2,0,1 da `0-9` a `50-59`, [83, 91] → solo `80+` 2, [126] → `80+`, [] → nessuna riga; `averageAge` [8, 34, 37, 52] → 33, [32, 33] → 33, [30, 34] → 32; `ageSectionLines` senza età → "non disponibile", `withoutYear = 0` → solo "Età media", `withoutYear = 23` → richiamo

### 2b — Dati (statement D1 in batch)

- [X] T012 [P] In `src/db/groups.ts` aggiungere `ungroupedCountStatement(db)` = `SELECT COUNT(*) AS n FROM persons p WHERE NOT EXISTS (SELECT 1 FROM person_groups pg WHERE pg.person_id = p.id)`, `ungroupedPersonsStatement(db)` = `SELECT ${LIST_PERSON_COLUMNS} FROM persons p WHERE NOT EXISTS (…)` (riuso di `LIST_PERSON_COLUMNS`/`rowToListPerson` di `src/db/viste.ts`), il tipo `GroupListData = { groups: GroupWithCount[]; ungrouped: number }` e `readGroupList(db): Promise<GroupListData>` come **una** `db.batch([listWithCountsStatement(db), ungroupedCountStatement(db)])` (RF-07, RF-19, FR-003, research R-02, R-03)
- [X] T013 In `src/db/viste.ts` aggiungere `ungroupedCountStatement(db)` in coda a `groupSearchStatements(db)` (terza statement della stessa batch) (RF-07, research R-02) — dipende da T012
- [X] T014 In `src/db/viste.ts` aggiungere a `yearStatements(db, year)` una quarta statement `SELECT EXISTS (SELECT 1 FROM occurrences WHERE year = ? AND status <> 'aperta') AS has` con `year − 1`: contano solo le occorrenze chiuse (*fatto*, *saltato*, *non confermato*) (RF-22, FR-020, research R-06)
- [X] T015 [P] In `src/db/statistiche.ts` aggiungere `StatsBirthRow = { birth_day: number; birth_month: number; birth_year: number }` e una quinta statement in `statisticheReadStatements`: `SELECT birth_day, birth_month, birth_year FROM persons WHERE birth_year IS NOT NULL` (RF-32, data-model "Età attuale")

### 2c — `callback_data` e router

- [X] T016 [P] In `src/telegram/keyboard.ts` estendere `GroupAction` a `"n" | "o" | "r" | "x" | "p" | "l" | "s"`; in `decodeGroup` ammettere `n`, `l`, `s` **solo** senza campi (`fields.length === 1`): `g2:l:1`, `g2:s:5`, `g2:s:5:abc` → `null`; forme di `o|r|x|p` invariate, nessun cambio di versione di `g2`; aggiungere il commento del contratto 009 (`g2:l` ⬅️ Tutti i gruppi, `g2:s` Senza gruppo) (RF-07, RF-19, FR-030, contracts/callback-data.md)
- [X] T017 In `src/bot/viste.ts` aggiungere i gestori dei tocchi senza stato, che validano al tocco e altrimenti rispondono `answerCallback(ctx, T.actionUnavailable)` senza messaggi: `showProssimiWide(ctx)` (lista dei prossimi `UPCOMING_WIDE_DAYS` giorni di tutte le persone, come `/prossimi 90`); `showMeseFromButton(ctx, id?)` (solo `1 ≤ id ≤ 12`, poi `showMese(ctx, String(id))`: anno di riferimento ricalcolato al tocco con `referenceYear`); `showAnnoFromButton(ctx, id?)` (solo se `parseYear(String(id), today)` è ok, poi `showAnno`) (RNF-14, RF-17, RF-20, RF-22, FR-017…FR-020)
- [X] T018 In `src/bot/router.ts` registrare in `STATIC_CALLBACKS` `"s:u"` (con `id` presente → `T.actionUnavailable`, es. `s:u:5`), `"s:m"` → `showMeseFromButton`, `"s:y"` → `showAnnoFromButton`, accanto a `"s:n"` e `"s:h"`; il `clear` del flusso in corso prima del gestore resta com'è (001 FR-018); estranei ignorati prima del decoder (RF-30) (RNF-14) — dipende da T017

**Checkpoint**: dominio, dati e pulsanti pronti; `test/unit/navigazione.test.ts` e i casi nuovi di `test/unit/statistiche.test.ts` passano (dopo la Fase 9 per i confronti di testo).

---

## Phase 3: User Story 1 — Ritorno all'elenco dalla scheda gruppo (Priority: P1) 🎯 MVP

**Goal**: ogni scheda gruppo ha [⬅️ Tutti i gruppi] che manda un nuovo messaggio con l'elenco gruppi (RF-19, D-30).

**Independent Test**: aprire una scheda gruppo (da elenco, da `/gruppi <nome>`, dopo rinomina, gruppo vuoto, scheda spezzata), premere [⬅️ Tutti i gruppi] e verificare il nuovo messaggio con l'elenco e la scheda di partenza invariata; ripetere con > 60 gruppi.

- [X] T019 [US1] In `src/bot/gruppi.ts` estrarre `renderGroupCard(title, rows, actionRows)` comune e far usare a `showGroupCard` le righe `[[✏️ Rinomina] [🗑 Elimina]]` + `[[button(T.btnAllGroups, { kind: "group", action: "l" })]]` su una riga a sé, sull'ultimo messaggio anche se la scheda è spezzata; vale per ogni apertura (`g2:o`, `/gruppi <nome>` con un trovato, dopo la rinomina, gruppo vuoto "0 persone") (RF-19, FR-001; decade il divieto di 005 FR-002)
- [X] T020 [US1] In `src/bot/gruppi.ts` aggiungere `showAllGroups(ctx)` che invia un nuovo messaggio con l'elenco gruppi attuale come `/gruppi` senza argomento (pulsanti fino a 60 gruppi, oltre elenco testuale con l'invito `/gruppi <nome>`) (RF-19, FR-002)
- [X] T021 [US1] In `src/bot/flows/gruppi.ts` gestire in `handleGroupCallback` l'azione `l` → `showAllGroups(ctx)`, senza avvisi anche se il gruppo della scheda è stato eliminato o rinominato nel frattempo (RF-19, FR-002, edge case)

**Checkpoint**: elenco → scheda → elenco percorribile con soli tocchi (SC-002, parte gruppi reali).

---

## Phase 4: User Story 2 — Voce e scheda "Senza gruppo" (Priority: P1)

**Goal**: l'elenco gruppi mostra [Senza gruppo (N)] e apre la scheda virtuale delle persone senza gruppo (RF-07, RF-19, V-09, D-31).

**Independent Test**: con persone senza gruppi scrivere `/gruppi`, verificare la voce, premerla, verificare la scheda; ripetere con tutti classificati, 0 gruppi, > 60 gruppi, un gruppo reale "Senza gruppo" e `/gruppi senza`.

- [X] T022 [US2] In `src/bot/gruppi.ts` estendere `GroupListOptions` con `ungrouped?: number` e `renderGroupList`: voce `[button(T.btnUngrouped(n), { kind: "group", action: "s" })]` su una riga a sé tra i gruppi e [➕ Nuovo gruppo], solo se `opts.withNew` e `ungrouped > 0`; casi: 0 gruppi → `T.noGroups` + voce? + ➕; 1…60 → gruppi a 2 colonne + voce? + ➕ (al più 62 pulsanti, V-09); > 60 → testo con invito + voce? + ➕ (al più 2 pulsanti); mai la voce in `showGroupChoice` (`withNew: false`); un gruppo reale "Senza gruppo" resta ordinato da `sortGroups` come gli altri (RF-07, V-09, FR-003…FR-006, research R-04)
- [X] T023 [US2] In `src/bot/gruppi.ts` cambiare `showGroups(ctx, prefix?, data?: GroupListData)`: senza `data` legge con `readGroupList` (batch, nessuna subrequest in più); passa `ungrouped` a `renderGroupList`; adeguare `replyGroupGone(ctx, data?)`, `handleGruppiCommand`, `showAllGroups` e i chiamanti in `src/bot/flows/gruppi.ts` (RF-07, FR-004)
- [X] T024 [US2] In `src/bot/gruppi.ts` estendere `readGroupSearch(ctx)` con `ungrouped` (terzo risultato della batch di T013) e usarlo in `searchGroups` quando mostra l'elenco dopo "nessun gruppo corrisponde"; `/gruppi senza` cerca solo tra i gruppi salvati e non apre la scheda virtuale (RF-07, RF-19, FR-003, BR-26); adeguare il chiamante in `src/bot/viste.ts` (`showProssimi`)
- [X] T025 [US2] In `src/bot/flows/gruppi.ts`, nello step `elimina`, aggiungere `ungroupedCountStatement` alla batch dopo la `DELETE` (stessa batch di `listWithCountsStatement`) e passare `GroupListData` a `showGroups`/`closeIfChanged` (RF-07, research R-02)
- [X] T026 [US2] In `src/bot/gruppi.ts` aggiungere `showUngroupedCard(ctx, people)` (titolo `T.ungroupedCardTitle(n)`, righe `formatRows(sortByNextBirthday(people, today))` con `/p_<id>`, il solo [⬅️ Tutti i gruppi] `g2:l` sull'ultimo messaggio, niente Rinomina/Elimina, via `renderGroupCard`) e `openUngrouped(ctx)`: **una** batch [`ungroupedPersonsStatement`, `listWithCountsStatement`]; N attuale > 0 → scheda con i dati attuali; N = 0 (anche rubrica vuota) → `showGroups(ctx, T.allGrouped, { groups, ungrouped: 0 })` senza seconda lettura; il N del pulsante non conta (RF-19, FR-007, FR-008, research R-03)
- [X] T027 [US2] In `src/bot/flows/gruppi.ts` gestire in `handleGroupCallback` l'azione `s` → `openUngrouped(ctx)` (RF-19, FR-007) — dipende da T025 (stesso file)

**Checkpoint**: US1 e US2 complete: SC-002 interamente percorribile.

---

## Phase 5: User Story 3 — Distribuzione per età in `/statistiche` (Priority: P2)

**Goal**: sezione 🧑 Età dopo l'istogramma per mese (RF-32, BR-03, D-32).

**Independent Test**: con data fissa e persone di età note (29/02, compleanno non ancora passato, senza anno, anno fuori BR-02) scrivere `/statistiche` e verificare righe, conteggi ed età media; ripetere senza alcun anno.

- [X] T028 [US3] In `src/bot/statistiche.ts` leggere il quinto risultato della batch (T015) e passare `births` e `today = toLocal(ctx.deps.now())` a `formatStatistiche`; nessuna subrequest in più (stato 1 + batch 1) (RF-32, FR-010, research R-11)

**Checkpoint**: `/statistiche` completa con la sezione Età.

---

## Phase 6: User Story 4 — Scorrere mesi e anni (Priority: P2)

**Goal**: [◀️ <mese>] [<mese> ▶️] in `/mese` e [◀️ <anno − 1>] [<anno + 1> ▶️] condizionati in `/anno` (RF-20, RF-22, RNF-14, D-33).

**Independent Test**: `/mese` per gennaio, dicembre, un mese passato e uno vuoto; `/anno` con storici diversi; verificare etichette, circolarità, anno di riferimento al tocco e nuovo messaggio.

- [X] T029 [US4] In `src/bot/viste.ts`, in `showMese`, costruire con `adjacentMonths` la tastiera `[[button(T.btnPrevMonth(MONTHS_CAP[prev − 1]), s:m:<prev>), button(T.btnNextMonth(MONTHS_CAP[next − 1]), s:m:<next>)]]` e passarla all'ultimo messaggio della lista, anche con la vista vuota "🗓 Nessun compleanno a …"; mese non valido → errore senza pulsanti (RF-20, FR-019, RNF-14)
- [X] T030 [US4] In `src/bot/viste.ts`, in `showAnno`, leggere il quarto risultato della batch (T014) e con `yearNavigation(year, today.year, has)` costruire `[◀️ Y−1]` (`s:y:<Y−1>`, `T.btnPrevYear`) e/o `[Y+1 ▶️]` (`s:y:<Y+1>`, `T.btnNextYear`) sull'ultimo messaggio; nessuna tastiera se entrambi `null`; anno non valido o futuro → errore senza pulsanti; con `showAnnoFromButton` pulsanti calcolati al tocco (RF-22, FR-020, contracts/viste-v12.md tabella `/anno`)

**Checkpoint**: SC-004 percorribile con i soli pulsanti.

---

## Phase 7: User Story 5 — Allargare `/prossimi` a 90 giorni (Priority: P3)

**Goal**: [Prossimi 90 giorni] sotto i 90 giorni, con lo stesso filtro di gruppo (RF-17).

**Independent Test**: `/prossimi`, `/prossimi 7 famiglia`, `/prossimi 89`, `/prossimi 90`, `/prossimi 120`, lista vuota, gruppo scelto tra candidati, gruppo eliminato prima del tocco.

- [X] T031 [US5] In `src/bot/viste.ts` cambiare `sendUpcoming(ctx, people, days, group: { id: number; name: string } | null)` e adeguare `showProssimi` (gruppo trovato `found.kind === "one"`) e `showProssimiForGroup` (tocco `g2:p`, compreso il gruppo scelto tra più candidati); se `canWidenUpcoming(days)` aggiungere sull'ultimo messaggio, anche con `T.upcomingNone`, `[T.btnUpcomingWide]` con `s:u` senza filtro o `{ kind: "group", action: "p", groupId, hash: nameHash(name), days: UPCOMING_WIDE_DAYS }` con filtro (riuso di `g2:p`, gruppo eliminato/rinominato → `T.groupGone` + elenco come 005); errori di argomento, gruppo inesistente e scelta tra più gruppi senza pulsante (RF-17, FR-018, research R-01, R-05)

**Checkpoint**: `/prossimi` < 90 sempre con un solo pulsante di passo successivo.

---

## Phase 8: User Story 6 — Aggiungere un'altra persona dopo il salvataggio (Priority: P3)

**Goal**: [➕ Aggiungi un'altra persona] solo nella conferma del salvataggio (RF-01).

**Independent Test**: completare `/nuovo` (anche con "Salva comunque"), verificare il pulsante e il nuovo inserimento al tocco (anche con un flusso in corso); `/p_<id>`, `/cerca`, modifica e Segna fatto senza pulsante.

- [X] T032 [P] [US6] In `src/bot/scheda.ts` cambiare `showScheda(ctx, personId, confirm?, extraRows?: InlineKeyboardButton[][])`: le righe extra si appendono in coda a `schedaKeyboard(...)`; tutti i chiamanti esistenti (`/p_<id>`, `/cerca`, modifica, `markDone`) restano senza (RF-01, FR-021, research R-08)
- [X] T033 [US6] In `src/bot/flows/nuovo.ts`, in `save`, passare `[[button(T.btnAddAnother, { kind: "static", scope: "s", action: "n" })]]` a `showScheda` (riuso di `s:n`: interrompe il flusso in corso senza salvare e chiede il nome, sempre valido, FR-022); verificare senza modificarlo che `duplicateStep` in `src/bot/flows/steps.ts` ("Salva comunque") chiami lo stesso `save`; nessun pulsante "Apri scheda" (RF-01, FR-021, FR-022) — dipende da T032

**Checkpoint**: tutte le user story implementate.

---

## Phase 9: Testi in `src/texts.ts` e inventario (RNF-15, RNF-19)

**Purpose**: tutte le chiavi di [contracts/testi-v12.md](contracts/testi-v12.md) nel punto unico dei testi e nell'inventario eseguibile.

- [X] T034 In `src/texts.ts` aggiungere `MONTHS_CAP = MONTHS_IT.map((m) => m.charAt(0).toUpperCase() + m.slice(1))` accanto a `MONTHS_SHORT` e `AGE_BUCKET_LABELS = ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"]` (RF-20, RF-32)
- [X] T035 In `src/texts.ts` aggiungere i testi dei gruppi: `btnAllGroups` = "⬅️ Tutti i gruppi", `btnUngrouped(n)` = "Senza gruppo ({n})" senza emoji, `ungroupedCardTitle(n)` = "👥 Senza gruppo · 1 persona" / "👥 Senza gruppo · {n} persone" (stessa forma di `groupCardTitle`), `allGrouped` = "Ora tutte le persone hanno un gruppo."; modificare in `help` la riga `/gruppi [nome] — elenco gruppi a pulsanti, con la voce "Senza gruppo"; con un nome cerca il gruppo e apre la scheda` (RF-07, RF-19, §5.1, FR-009, FR-024)
- [X] T036 In `src/texts.ts` aggiungere i pulsanti di passo successivo: `btnUpcomingWide` = "Prossimi 90 giorni" (senza icona; 90 da `UPCOMING_WIDE_DAYS`), `btnPrevMonth(name)` = "◀️ {name}", `btnNextMonth(name)` = "{name} ▶️", `btnPrevYear(y)` = "◀️ {y}", `btnNextYear(y)` = "{y} ▶️", `btnAddAnother` = "➕ Aggiungi un'altra persona" (RF-01, RF-17, RF-20, RF-22, RNF-19, FR-023)
- [X] T037 In `src/texts.ts` aggiungere i testi della sezione Età: `statsAgeTitle` = "🧑 Età"; `statsAgeRow(label, bar, n, width)` = `label.padEnd(5) + " " + bar.padEnd(STATS_BAR_WIDTH) + " " + String(n).padStart(width)` senza emoji; `statsAgeAverage(avg, without)` = "Età media: {avg} anni · senza anno di nascita: {without}", con `without = 0` solo "Età media: {avg} anni" e `avg = 1` → "1 anno"; `statsAgeUnavailable` = "Età non disponibile: nessuna persona ha l'anno di nascita." (RF-32, FR-013, FR-014, FR-024)
- [X] T038 In `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi nuove col tipo di [contracts/testi-v12.md](contracts/testi-v12.md) (PA: `btnAllGroups`, `btnUngrouped`, `btnUpcomingWide`, `btnPrevMonth`, `btnNextMonth`, `btnPrevYear`, `btnNextYear`, `btnAddAnother`; T: `ungroupedCardTitle`, `statsAgeTitle`; I: `allGrouped`, `statsAgeUnavailable`; R: `statsAgeRow`; F: `statsAgeAverage`) e i casi della regola R6: icone ◀️ ▶️ ⬅️ ➕ ammesse, nessuna icona su `btnUpcomingWide` e `btnUngrouped` (RNF-19, FR-023, FR-024)
- [X] T039 [P] In `test/integration/v11-stile.test.ts` estendere l'elenco chiuso delle icone dei pulsanti con ◀️ ▶️ ⬅️ (➕ già presente per `btnNewGroup`) e, nel test "§5.9: gruppi", aggiornare la tastiera attesa della scheda gruppo in `["✏️ Rinomina", "🗑 Elimina", "⬅️ Tutti i gruppi"]` (RNF-19, RF-19, FR-001, FR-023)

**Checkpoint**: `npm run typecheck` a 0 errori; test unitari verdi.

---

## Phase 10: Test di integrazione v1.2 e aggiornamento dei test esistenti

**Purpose**: almeno un test per ogni criterio Dato/Quando/Allora v1.2 (SC-001; plan.md "Copertura"), nomi con l'ID AFU; nessun orologio né rete reali.

### Nuovi test

- [X] T040 [P] [US1] Creare `test/integration/v12-gruppi.test.ts` con i casi di US1 1-4 (RF-19): nuovo messaggio con l'elenco e scheda invariata, scheda spezzata con le due righe di pulsanti sull'ultimo messaggio, > 60 gruppi → elenco testuale, gruppo vuoto; edge: scheda dopo rinomina, da `/gruppi <nome>`, gruppo eliminato o rinominato prima del tocco `g2:l`, nessun gruppo rimasto
- [X] T041 [US2] In `test/integration/v12-gruppi.test.ts` aggiungere US2 1-8 (RF-07, RF-19, V-09): voce su riga a sé sopra ➕, assente con N = 0, 0 gruppi con 30 persone, > 60 gruppi con 5 senza gruppo, gruppo reale "Senza gruppo" distinto, scheda "👥 Senza gruppo · 12 persone" con `/p_<id>` e solo [⬅️ Tutti i gruppi], tocco con N attuale 0 → `T.allGrouped` + elenco (anche rubrica vuota), `/gruppi senza` non apre la scheda; edge: N cambiato > 0, scheda spezzata, rubrica vuota senza gruppi, creazione e rinomina di un gruppo reale "Senza gruppo" ammesse (D-31, BR-17, FR-005) — dipende da T040 (stesso file)
- [X] T042 [P] [US3] Creare `test/integration/v12-statistiche.test.ts` con US3 1-8 (RF-32, BR-03, BR-04): 8/34/37/52 anni, 14/03/1994 al 29/10/2026 e al 10/03/2026, 29/02/2000 al 28/02/2026, 83 e 91 in `80+`, 23 senza anno richiamati, nessun anno → non disponibile, "Senza gruppo 12" invariato; edge: tutti con anno (nessun richiamo), 32,5 → 33, rubrica vuota, nato nel 1900, anno fuori BR-02 contato come senza anno (dato invariato), persona in più gruppi contata una volta, sezione dopo l'istogramma per mese
- [X] T043 [P] [US4] Creare `test/integration/v12-navigazione.test.ts` con US4 1-9 (RF-20, RF-22, RNF-14): `/mese marzo` → [◀️ Febbraio] [Aprile ▶️] e tocco `s:m:4`; dicembre e gennaio circolari; al 29/10/2026 [◀️ Settembre] → settembre 2027; `/anno` con storico 2025 → solo [◀️ 2025]; tocco `s:y:2025` senza storico 2024 → solo [2026 ▶️]; primo anno d'uso → nessun pulsante; `/anno 2023` → solo [2024 ▶️]; nuovo messaggio, precedente invariato; edge: mese vuoto con pulsanti, mese non valido senza pulsanti, cambio d'anno al tocco, solo occorrenze aperte in Y − 1, anno non valido; malformati `s:m`, `s:m:0`, `s:m:13`, `s:y`, `s:y:12`, `s:y:<futuro>` → `T.actionUnavailable`
- [X] T044 [US5] In `test/integration/v12-navigazione.test.ts` aggiungere US5 1-5 (RF-17): `/prossimi` → [Prossimi 90 giorni] e tocco `s:u`; `/prossimi 7 famiglia` → tocco `g2:p:<id>:<h>:90`; `/prossimi 120` senza pulsante; gruppo eliminato → `T.groupGone`; lista vuota con pulsante; edge: 89 sì / 90 no, gruppo scelto tra candidati, gruppo rinominato, argomenti non validi senza pulsante, `s:u:5` → `T.actionUnavailable` — dipende da T043
- [X] T045 [US6] In `test/integration/v12-navigazione.test.ts` aggiungere US6 1-5 (RF-01): conferma "🎉 Fatto! Marchino è in rubrica." con [➕ Aggiungi un'altra persona] in fondo; tocco `s:n` → domanda del nome; `/p_<id>` e ridisegno dopo modifica senza pulsante; tocco durante un altro flusso → flusso interrotto senza salvare; tocco ripetuto dopo aver risposto al nome → ricomincia; edge: dopo "Salva comunque", persona eliminata nel frattempo, `/cerca` con un risultato, Segna fatto — dipende da T044
- [X] T046 [US4] In `test/integration/v12-navigazione.test.ts` aggiungere i casi trasversali RNF-14: ≤ 2 pulsanti di passo successivo per vista, tastiera solo sull'ultimo messaggio di una vista spezzata, nessun pulsante sulle righe delle persone né in `/cerca`, pulsante premuto durante un flusso guidato (flusso sostituito), pulsante di un estraneo (nessuna risposta, RF-30), pulsanti già in chat (`g2:o` di un elenco vecchio apre una scheda con [⬅️ Tutti i gruppi], FR-029, FR-030) — dipende da T045

### Test esistenti da aggiornare

- [X] T047 [P] In `test/unit/callback-data.test.ts` aggiungere round-trip e ≤ 64 byte di `g2:l`, `g2:s`, `s:u`, `s:m:<1…12>`, `s:y:<aaaa>`, `g2:p:999999999999999:zzzzzzz:90` (31 byte) e il rifiuto dei malformati `g2:l:1`, `g2:s:5`, `g2:s:5:abc`; verificare che le forme `n|o|r|x|p` di 005 restino invariate (FR-030, contracts/callback-data.md)
- [X] T048 [P] In `test/unit/statistiche.test.ts` aggiornare i test di `formatStatistiche` con `births` e `today` e verificare la posizione della sezione Età (dopo "🎂 Compleanni per mese", prima di "✅ Auguri fatti") e l'output invariato dell'istogramma per mese con `barLines` (RF-32, FR-010)
- [X] T049 [P] In `test/unit/liste.test.ts` aggiungere `renderGroupList` con `ungrouped`: 0 gruppi con N = 0 e N > 0, ≤ 60, 60 gruppi + N > 0 → 62 pulsanti, 61 gruppi + N > 0 → 2 pulsanti e righe testuali; scheda gruppo con [⬅️ Tutti i gruppi] su riga a sé; scelta tra candidati senza voce virtuale (RF-07, RF-19, V-09)
- [X] T050 [P] In `test/integration/us6-gruppi.test.ts` aggiornare le attese: elenco con la voce virtuale dove ci sono persone senza gruppo; tastiera della scheda gruppo con due righe (RF-07, RF-19)
- [X] T051 [P] In `test/integration/v11-gruppi-ricerca.test.ts` aggiornare: elenco dopo "nessun gruppo corrisponde" con la voce; `/gruppi senza` non apre la scheda virtuale (RF-07, RF-19)
- [X] T052 [P] In `test/integration/v11-statistiche.test.ts` aggiornare il messaggio atteso con le righe della sezione Età (RF-32)
- [X] T053 [P] In `test/integration/us5-gruppo-mese.test.ts` aggiornare `/mese`: tastiera [◀️ …] [… ▶️] sull'ultimo messaggio, anche con la vista vuota (RF-20)
- [X] T054 [P] In `test/integration/us6-anno.test.ts` aggiornare `/anno` con i pulsanti secondo lo storico chiuso dell'anno precedente (RF-22)
- [X] T055 [P] In `test/integration/us2-prossimi.test.ts` aggiornare `/prossimi` < 90 con [Prossimi 90 giorni], anche con lista vuota (RF-17)
- [X] T056 [P] In `test/integration/us2-inserimento.test.ts` aggiornare la conferma del salvataggio con la riga [➕ Aggiungi un'altra persona] (RF-01)
- [X] T057 [P] In `test/integration/viste-budget.test.ts` ammettere in `expectCompleteList` la tastiera sull'ultimo messaggio per `/prossimi` < 90, `/mese`, `/anno`; aggiungere i casi `g2:s` (200 persone senza gruppo: 8 subrequest), `g2:l` (≤ 5), `s:y` (200 saltati in serie: 12), `s:u` (≤ 8) con i valori di research R-11 (constitution II)
- [X] T067 [P] In `test/integration/us7-start-aiuto.test.ts` aggiornare il test "RF-19, AFU §5.1 (#7)": la riga attesa diventa `/gruppi [nome] — elenco gruppi a pulsanti, con la voce "Senza gruppo"; con un nome cerca il gruppo e apre la scheda` e il nome del test cita anche `FR-009` (§5.1, FR-009)
- [X] T058 Eseguire `npm run typecheck` e `npm test`: 0 errori, tutti i test verdi (compresi 001-008 salvo i criteri modificati, SC-001)

**Checkpoint**: copertura completa della tabella "Copertura" di plan.md.

---

## Phase 11: Bench e smoke Postman

**Purpose**: CPU entro i limiti (constitution II) e verifica manuale in Telegram ([quickstart.md](quickstart.md)).

- [X] T059 [P] In `bench/stato.bench.ts` aggiungere `bench("sezione Età, 200 persone", …)` su `ageSectionLines` con 200 età e aggiornare lo scenario `/statistiche` con `births` (200 righe) e `today`; soglia del file invariata (≤ 2 ms per iterazione; Età < 0,1 ms) (RF-32, research R-07)
- [X] T060 [P] In `bench/liste.bench.ts` aggiornare `bench("elenco 100 gruppi", …)` passando `ungrouped > 0` a `renderGroupList` (RF-07, V-09)
- [X] T061 Eseguire `npm run bench`: tutte le soglie rispettate — dipende da T059, T060
- [X] T062 [P] In `postman/seed-smoke.sql` verificare che ci siano persone senza gruppo e occorrenze chiuse dell'anno precedente; se mancano, aggiungerle con id della serie smoke (nessun dato reale) (quickstart §2)
- [X] T063 In `postman/bot-compleanni.postman_collection.json` portare `version` a `2.5.0` e la descrizione a "feature 001–009"; aggiungere la cartella "21 · Navigazione v1.2" prima della pulizia, che diventa "22 · Pulizia", con le 15 richieste di quickstart.md §2 (`/gruppi`, `g2:s`, `g2:o`, `g2:l`, `/prossimi`, `s:u`, `/prossimi 7 smoke famiglia` + `g2:p:…:90`, `/mese marzo` + `s:m:4`, `/mese dicembre`, `/anno` + `s:y:<anno − 1>`, `/statistiche`, `/nuovo` + `s:n`, `/p_<id>`, malformati `s:m:13`, `s:y`, `g2:l:1`, `s:u:5`, estraneo `g2:l`) e i controlli via `postman/helper.mjs` del flusso annullato (tocchi 2, 4, 6, 8, 10, 12) — dipende da T062
- [X] T064 [P] In `postman/README.md` aggiornare versione 2.5.0, cartella 21 e numerazione 22 · Pulizia
- [ ] T065 Eseguire lo smoke con `scripts/smoke-postman.ps1` (wrangler dev) e le verifiche di quickstart.md §3: `SELECT COUNT(*) FROM groups WHERE name = 'Senza gruppo'` invariato rispetto al seed, `/export` e `/backup` senza la voce virtuale, log senza dati personali (FR-027, FR-028, constitution V) — dipende da T063
- [X] T066 Verificare con `git diff --stat` che `migrations/`, `src/cron/`, `src/db/backup.ts`, `src/domain/backup.ts`, `src/bot/export.ts`, `src/bot/import.ts` e `src/bot/flows/steps.ts` non siano modificati (FR-025, FR-028, SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: nessuna dipendenza.
- **Phase 2 (Foundational)**: dopo T001 (T004 usa `UPCOMING_WIDE_DAYS`). Blocca le fasi 3–8.
- **Phase 3–8 (user story)**: dopo la Phase 2, nell'ordine richiesto: US1 → US2 (Gruppi) → US3
  (Statistiche) → US4 → US5 → US6 (passo successivo).
- **Phase 9 (Testi)**: fornisce le chiavi `T.*` usate dalle fasi 2–8; gate di typecheck al suo checkpoint.
- **Phase 10 (Test)**: dopo la Phase 9.
- **Phase 11 (Bench e smoke)**: dopo la Phase 10.

### Dipendenze tra user story

- **US1**: nessuna (usa `g2:l` di T016).
- **US2**: dopo US1 (riusa `renderGroupCard` e `showAllGroups` di T019, T020; stessi file `src/bot/gruppi.ts`, `src/bot/flows/gruppi.ts`).
- **US3**: indipendente dalle altre (solo `src/bot/statistiche.ts`).
- **US4, US5**: indipendenti tra loro come logica, ma condividono `src/bot/viste.ts` → sequenziali (T029 → T030 → T031); T031 dipende da T024 (firma di `readGroupSearch`).
- **US6**: indipendente (file `src/bot/scheda.ts`, `src/bot/flows/nuovo.ts`).

### Catene sullo stesso file (mai in parallelo)

- `src/domain/viste.ts`: T002 → T003 → T004
- `src/domain/statistiche.ts`: T006 → T007 → T008 → T009 → T010
- `src/db/viste.ts`: T013 → T014
- `src/bot/viste.ts`: T017 → T024 (chiamante) → T029 → T030 → T031
- `src/bot/gruppi.ts`: T019 → T020 → T022 → T023 → T024 → T026
- `src/bot/flows/gruppi.ts`: T021 → T025 → T027
- `src/texts.ts`: T034 → T035 → T036 → T037
- `test/integration/v12-gruppi.test.ts`: T040 → T041
- `test/integration/v12-navigazione.test.ts`: T043 → T044 → T045 → T046

---

## Parallel Example

```text
# Phase 2, avvio (file diversi, nessuna dipendenza):
T002 src/domain/viste.ts          T006 src/domain/statistiche.ts
T012 src/db/groups.ts             T015 src/db/statistiche.ts
T016 src/telegram/keyboard.ts

# Phase 8: T032 src/bot/scheda.ts (in parallelo a qualunque task che non tocchi scheda.ts)

# Phase 10, test esistenti (tutti file diversi):
T047 … T057, T067

# Phase 11:
T059 bench/stato.bench.ts   T060 bench/liste.bench.ts   T062 postman/seed-smoke.sql   T064 postman/README.md
```

---

## Implementation Strategy

### MVP (US1 + US2, Gruppi — punto 1 dell'ordine di realizzazione AFU)

1. Phase 1 e Phase 2.
2. Phase 3 (US1) e Phase 4 (US2).
3. Dalla Phase 9: T035 (testi dei gruppi) e T038/T039 per le chiavi dei gruppi.
4. T040, T041, T049, T050, T051: **STOP e verifica** di SC-002.

### Consegna incrementale

1. MVP Gruppi → 2. US3 Statistiche (T028 + T037 + T042) → 3. US4/US5/US6 passo successivo
   (T029…T033 + T036 + T043…T046) → 4. aggiornamento test esistenti, bench, smoke Postman 2.5.0.

---

## Notes

- [P] = file diversi e nessuna dipendenza da task incompleti; i task sullo stesso file non sono mai [P].
- Ogni task cita gli ID AFU (RF, RNF, BR, V, D) e i FR della spec per la tracciabilità (constitution XI).
- Commit dopo ogni task o gruppo logico, senza righe di attribuzione nei messaggi.
