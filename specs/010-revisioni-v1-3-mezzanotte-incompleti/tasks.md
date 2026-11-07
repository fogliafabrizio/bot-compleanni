---

description: "Task list della feature 010 — Revisioni v1.3: Mezzanotte e profili incompleti"
---

# Tasks: Revisioni v1.3 — Mezzanotte e profili incompleti

**Input**: documenti di `specs/010-revisioni-v1-3-mezzanotte-incompleti/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md),
[contracts/callback-data.md](contracts/callback-data.md), [contracts/viste-v13.md](contracts/viste-v13.md),
[contracts/testi-v13.md](contracts/testi-v13.md)

**Fonte funzionale**: `docs/AFU.md` v1.3 (REV-012, REV-013)

**Tests**: richiesti (constitution X; plan.md, "Copertura dei criteri Dato/Quando/Allora v1.3"). Ogni
test riporta l'ID AFU nel nome.

**Organizzazione**: ordine richiesto dall'utente — dominio con test unitari → dati → `callback_data` e
router → bot (slot delle 00:00 e regola "00:00", `/incomplete`, pulsante di `/statistiche`, `/aiuto` e
menu dei comandi) → testi e inventario → aggiornamento dei test esistenti → bench e smoke Postman. Le
fasi del bot sono una per user story (US1 slot delle 00:00, US2 `/incomplete`, US3 `/statistiche` e
comandi).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diverso, nessuna dipendenza da task non completati)
- **[Story]**: user story di spec.md (US1…US3)
- Percorsi relativi alla radice del repository (progetto singolo: `src/`, `test/`, `bench/`, `postman/`)

## Vincoli comuni (valgono per ogni task)

- **Nessuna migration, nessuna dipendenza nuova, nessuna conversione dei dati** (FR-021, FR-024):
  nessun file in `migrations/`; `deliveries.ref = 0` è già ammesso e `ux_deliveries_unique
  (occurrence_id, kind, ref)` distingue lo slot 0.
- **Cron non toccato**: resta l'unico trigger `0 * * * *` in `wrangler.toml`. Non modificare
  `src/cron/hourly.ts`, `src/cron/scheduled.ts`, `src/cron/comandi.ts`, `src/db/reminders.ts`,
  `src/db/backup.ts`, `src/domain/backup.ts`, `src/bot/export.ts`, `src/bot/import.ts`.
- Media e Bassa, pre-reminder e recupero di tutti i profili **invariati** (FR-001).
- Le ore diverse dalla mezzanotte restano "H:MM" senza zero iniziale ("1:00", "9:00"); solo l'ora 0 si
  scrive "00" (FR-007).
- Ogni pulsante manda un **nuovo** messaggio (nessun `editMessage*`); liste di `/incomplete` **senza
  tastiera**; al massimo 2 pulsanti di passo successivo per vista (RNF-14, FR-010, FR-012, FR-016).
- Regola del dato mancante unica: `NULL`, `''` o soli spazi (FR-008, FR-017), in SQL solo tramite
  `missingSql` di `src/db/incomplete.ts`, in TypeScript solo tramite `isMissing`.
- Fuori perimetro (non implementare): combinazioni di filtri, filtro per gruppo, "Senza gruppo" tra i
  filtri, gruppi nelle righe, pulsanti sulle righe, conteggi di `/statistiche` cliccabili, fascia di
  silenzio notturna, slot delle 00:00 per Media o Bassa.
- Date da `toLocal(ctx.deps.now())` / `scheduledAt` iniettato; le funzioni pure ricevono `today`
  (constitution VI). Testi solo in `src/texts.ts` (RNF-15); nessun nome, nickname, username, telefono o
  data nei log (constitution V).

> **Nota sull'ordine**: le chiavi `T.*` di `/incomplete` usate nelle Fasi 6 e 7 nascono nella Fase 8
> (Testi), come richiesto. Finché la Fase 8 non è completa, `npm run typecheck` e i test che usano quei
> testi possono fallire: il gate completo (typecheck + `npm test` verdi) è al checkpoint della Fase 8 e
> poi della Fase 9. Le Fasi 1–4 hanno invece un gate verde proprio (i testi che servono al dominio —
> `formatClock`, `statoKind`, testi della lista vuota — nascono in Fase 2).

---

## Phase 1: Setup (configurazione condivisa)

**Purpose**: profili di priorità in un unico punto (constitution VIII, research R-01)

- [X] T001 In `src/config.ts` cambiare `PRIORITY_PROFILES.alta.slots` da `[9, 13, 18, 21]` a `[0, 9, 13, 18, 21]` con commento `// §7, RF-10, D-02 (v1.3): slot delle 00:00 solo per Alta`; spostare `SLOT_HOURS` **dopo** `PRIORITY_PROFILES` e derivarlo: `export const SLOT_HOURS: readonly number[] = [...new Set(Object.values(PRIORITY_PROFILES).flatMap((p) => p.slots))].sort((a, b) => a - b);` (risultato `[0, 9, 13, 18, 21]`); il letterale `as const` sparisce: correggere con `grep -rn SLOT_HOURS src test bench` gli eventuali usi che dipendevano dal tipo letterale (FR-001, RNF-18)

---

## Phase 2: Foundational — dominio puro e test unitari

**Purpose**: target orari di Alta con lo slot 0, formattazione "00:00", parsing di `/incomplete`,
predicati dei filtri, testi della lista vuota. Blocca tutte le user story.

### Slot delle 00:00 (REV-012)

- [X] T002 In `src/domain/schedule.ts`, funzione `admitted`, caso `"giorno"`: sostituire la condizione con `profile.slots.includes(t.ref) && (t.ref === 0 ? c.createdAt < w.dayStartTodayIso : c.createdAt <= w.slotInstantIso)` (per lo slot 0 l'istante è le 00:00:00 della data effettiva: creata alle 23:30 del giorno prima → ammessa; alle 00:00:00 o dopo → no; gli altri slot invariati, `<=`); aggiungere sul campo `ref` di `Target` il commento `// giorno: ora dello slot (0 = mezzanotte, v1.3)`; nessun'altra modifica, `planTargets` produce il target `giorno` 0 tramite `SLOT_HOURS` (RF-10, BR-04, BR-10, BR-12, FR-002, FR-004, research R-02)
- [X] T003 [P] In `test/unit/schedule.test.ts` aggiungere casi con l'ID AFU nel nome: `SLOT_HOURS` = `[0, 9, 13, 18, 21]`; `planTargets(T, 0)` = un solo target `giorno` con `ref 0` e data T, nessun `pre` né `recupero`; `planTargets(T, 9)` invariato; `selectNew` a ora 0: Alta ammessa, Media e Bassa no; Alta creata alle 23:30 del giorno prima → sì, alle 00:00:00, 00:30 o 10:00 → no (BR-10); occorrenza `fatto`/`saltato` → no (BR-07); BR-04: 28/02/2027 ora 0 (scheduledAt `2027-02-27T23:00Z`) → coppie (2,28) e (2,29), 29/02/2028 (`2028-02-28T23:00Z`) → solo (2,29), 28/02/2028 → solo (2,28); giorni del cambio d'ora: `2026-03-28T23:00Z` → target `giorno` 0 del 29/03, `2026-10-24T22:00Z` → del 25/10 (BR-24, research R-04); BR-05: `scheduledAt 2026-12-31T23:00Z` → target `giorno` 0 con data 01/01/2027 e `year 2027` (constitution VI). Correggere le asserzioni esistenti che fissavano `SLOT_HOURS = [9, 13, 18, 21]` (RF-10, §7)
- [X] T004 [P] In `test/unit/time.test.ts` aggiungere: `toLocal("2026-01-13T23:00:00Z")` → 14/01 ore 0; `2026-07-13T22:00Z` → 14/07 ore 0; `2026-03-28T23:00Z` → 29/03 ore 0; `2026-10-24T22:00Z` → 25/10 ore 0 (BR-24, constitution VI, research R-04)
- [X] T005 In `src/texts.ts` aggiungere ed esportare, accanto a `pad2`, `export const formatClock = (hour: number, minute: number) => \`${hour === 0 ? "00" : hour}:${pad2(minute)}\`;` con commento `// RNF-19 (v1.3): la mezzanotte si scrive "00:00"; le altre ore "H:MM" senza zero iniziale`; riscrivere `clock` come `const clock = (c: LocalClock) => formatClock(c.hour, c.minute);`; in `statoKind` sostituire l'ora dello slot `giorno` con `` `reminder delle ${formatClock(ref, 0)}` `` ("reminder delle 00:00", "reminder delle 9:00"); verificare con `grep -n ':00' src/texts.ts` che nessun altro testo scriva un'ora senza `clock`/`formatClock` (RNF-19, FR-007, FR-023, research R-05)
- [X] T006 In `test/unit/testi.test.ts` aggiungere i test di `formatClock`: (0, 0) → "00:00"; (9, 0) → "9:00"; (1, 0) → "1:00"; (23, 0) → "23:00"; (0, 37) → "00:37"; `T.statoKind("giorno", 0)` → "reminder delle 00:00", `("giorno", 9)` → "reminder delle 9:00"; verifica SC-004: nessun testo di `T` che riceve un `LocalClock` a ore 0 produce `/(^|[^0-9])0:00/` (RNF-19, SC-004)
- [X] T007 [P] In `test/unit/stato.test.ts` aggiungere: `formatStato` con `cron_last_run` alle 00:00 locali di oggi → "⏱ Ultimo controllo orario: oggi alle 00:00"; invio abbandonato `('giorno', 0)` di Marco del 14/03 → riga "Marco, reminder delle 00:00 del 14/03"; webhook con ultimo errore alle 0:37 → "oggi alle 00:37"; `src/domain/stato.ts` **non si modifica** (passa `LocalClock` e `ref` ai testi) (RNF-19, FR-007, FR-023, US1-8)

### Profili incompleti (REV-013)

- [X] T008 [P] Creare `src/domain/incomplete.ts` (puro, nessun import da `db/` o `bot/`): tipo `IncompleteKey = "telefono" | "instagram" | "telegram" | "anno" | "contatti"`; `interface IncompleteFilter { code: 1 | 2 | 3 | 4 | 5; key: IncompleteKey; arg: string }`; `export const INCOMPLETE_FILTERS: readonly IncompleteFilter[]` nell'ordine di FR-008 (1 telefono/`telefono`, 2 instagram/`instagram`, 3 telegram/`telegram`, 4 anno/`anno`, 5 contatti/`contatti`); `interface IncompletePerson extends ListPerson { phone: string | null; instagram: string | null; telegram: string | null; rawBirthYear: string | number | null }` (`ListPerson` da `src/domain/viste.ts`; `rawBirthYear` = valore grezzo della colonna, può essere `''` in produzione); `filterByCode(n: number): IncompleteFilter | undefined` (1…5, altrimenti `undefined`); `parseIncompleteArg(args: string): { kind: "menu" } | { kind: "filter"; filter: IncompleteFilter } | { kind: "unknown" }` (`args.trim() === ""` → menu; `args.trim().toLowerCase()` uguale a uno dei 5 `arg` → filtro; tutto il resto, varianti, plurali, sinonimi e più parole come `telefono famiglia` → unknown); `isMissing(v: string | number | null): boolean` → `v === null || (typeof v === "string" && v.trim() === "")` (un numero non è mai mancante); `matchesFilter(p: IncompletePerson, f: IncompleteFilter): boolean` (telefono → `isMissing(p.phone)`, instagram, telegram analoghi, anno → `isMissing(p.rawBirthYear)`, contatti → tutti e tre i contatti mancanti); `incompleteRows(people, f, today)` = `people.filter(matchesFilter)` ordinate con `sortByNextBirthday` di `src/domain/viste.ts` (prossimo compleanno, oggi compreso, poi nome, poi id). Nessuna dipendenza dalla priorità (RF-50, FR-008, FR-011, FR-012, data-model "Filtro dei profili incompleti", research R-06, R-08)
- [X] T009 [P] Creare `test/unit/incomplete.test.ts` con l'ID AFU nel nome: `parseIncompleteArg` — `""` → menu; `telefono`, `instagram`, `telegram`, `anno`, `contatti` → filtro; `Anno`, `TELEFONO`, `  TELEFONO ` → filtro; `email`, `telefoni`, `ig`, `contatto`, `telefono famiglia` → unknown; `isMissing` — `null`, `""`, `"   "` → true; `"+39333…"`, `"marco"`, `1990` → false; `matchesFilter` per ciascuno dei 5 filtri con e senza il dato; Marco con solo Instagram → telefono ✓, telegram ✓, instagram ✗, contatti ✗ (US2-6); persona con `instagram = "  "` e nessun altro contatto → contatti ✓; anno 1850 (anomalo) → anno ✗; `filterByCode` 1…5 nell'ordine di FR-008, 0 e 6 → `undefined`; `incompleteRows` — ordine per prossimo compleanno con oggi compreso, poi nome, poi id; persona senza anno senza età; `rowToIncompletePerson` (import da `src/db/incomplete.ts`, dopo T012) con `birth_year = ''` e `'  '` → `birthYear null` e `rawBirthYear` invariato, con `1990` → `birthYear 1990` (RF-50, FR-008, FR-011, FR-012)
- [X] T010 In `src/texts.ts` (dopo T005) aggiungere i testi della lista vuota secondo [contracts/testi-v13.md](contracts/testi-v13.md): `incompleteAllHave: (key: IncompleteKey) => …` → "✅ Tutte le persone hanno il telefono." / "… l'username Instagram." / "… l'username Telegram." / "… l'anno di nascita." / "… almeno un contatto." (tipo C, R3); `incompleteNoPersons: "📝 La rubrica è vuota: non ci sono persone."` (tipo I, R1); importare il solo tipo `IncompleteKey` da `src/domain/incomplete.ts` (RF-50, FR-013, FR-020)
- [X] T011 In `test/unit/incomplete.test.ts` (dopo T009, T010) aggiungere i test di `T.incompleteAllHave` per ciascuna chiave e di `T.incompleteNoPersons` con i testi esatti di FR-013 (RF-50, US2-7)

**Checkpoint**: `npm run typecheck` e `npm test` verdi.

---

## Phase 3: Dati — letture D1

**Purpose**: una `SELECT` aggregata per i conteggi, una per la lista, stessa regola di "Senza contatti"
(research R-06, R-07)

- [X] T012 Creare `src/db/incomplete.ts`: `export const missingSql = (col: string) => \`NULLIF(TRIM(${col}), '') IS NULL\`;` (unico frammento SQL del dato mancante); `export const MISSING: Record<IncompleteKey, string>` con `telefono = missingSql("phone")`, `instagram = missingSql("instagram")`, `telegram = missingSql("telegram")`, `anno = missingSql("birth_year")`, `contatti = (${telefono} AND ${instagram} AND ${telegram})`; `interface IncompleteCountsRow { total: number; telefono: number | null; instagram: number | null; telegram: number | null; anno: number | null; contatti: number | null }`; `incompleteCountsStatement(db)` = `SELECT COUNT(*) AS total, SUM(${MISSING.telefono}) AS telefono, SUM(${MISSING.instagram}) AS instagram, SUM(${MISSING.telegram}) AS telegram, SUM(${MISSING.anno}) AS anno, SUM(${MISSING.contatti}) AS contatti FROM persons` e `rowToIncompleteCounts(r): IncompleteCounts` (`SUM` su tabella vuota = `NULL` → 0); `interface IncompletePersonRow extends ListPersonRow { phone: string | null; instagram: string | null; telegram: string | null }`; `incompletePersonsStatement(db)` = `SELECT ${LIST_PERSON_COLUMNS}, p.phone, p.instagram, p.telegram FROM persons p` (riuso di `LIST_PERSON_COLUMNS` di `src/db/viste.ts`); `rowToIncompletePerson(r): IncompletePerson` = `{ ...rowToListPerson(r), birthYear: isMissing(r.birth_year) ? null : Number(r.birth_year), phone, instagram, telegram, rawBirthYear: r.birth_year }`: un anno vuoto o di soli spazi non deve produrre un'età (`formatListLine` calcolerebbe `next.year - ''` = `next.year` e mostrerebbe "(2026)", §5.7, FR-012). Nessuna scrittura, nessun log (RF-50, FR-008, FR-017, FR-024, data-model)
- [X] T013 In `src/db/statistiche.ts` sostituire `SUM(birth_year IS NULL) AS senza_anno` con `SUM(${MISSING.anno}) AS senza_anno` e `SUM(phone IS NULL AND instagram IS NULL AND telegram IS NULL) AS senza_contatti` con `SUM(${MISSING.contatti}) AS senza_contatti`, importando `MISSING` da `src/db/incomplete.ts`; nessun'altra modifica alla query né alle altre sezioni (RF-32, FR-017, SC-005)
- [X] T014 [P] In `test/unit/statistiche.test.ts` verificare che il formato di `senzaAnno`/`senzaContatti` non cambi e aggiungere fixture di riga che rappresentino i conteggi con vuoti/spazi (RF-32, FR-017)

**Checkpoint**: `npm run typecheck` e `npm test` verdi.

---

## Phase 4: `callback_data` e router

**Purpose**: azione `i` nell'ambito senza stato `s`; decoder invariato (research R-09,
[contracts/callback-data.md](contracts/callback-data.md))

- [X] T015 Creare `src/bot/incomplete.ts` con lo scheletro del gestore dei pulsanti: `export async function showIncompleteFromButton(ctx: Ctx, id: number | undefined): Promise<void>` — `id === undefined` → `sendIncompleteMenu(ctx)`; `filterByCode(id)` trovato → `sendIncompleteList(ctx, filter)`; altrimenti `answerCallback(ctx, T.actionUnavailable)` e nessun messaggio (`s:i:0`, `s:i:6`, `s:i:999999999999999`); dichiarare `sendIncompleteMenu` e `sendIncompleteList` esportate con corpo provvisorio (completate in T021, T022) (RNF-14, FR-010, FR-016)
- [X] T016 In `src/bot/router.ts` aggiungere a `STATIC_CALLBACKS` la voce `"s:i": (ctx, id) => showIncompleteFromButton(ctx, id)` importando da `src/bot/incomplete.ts`; ordine della validazione invariato (decoder → mittente estraneo ignorato → gestore), `clear` del flusso guidato come ogni `s:*` (RNF-14, RF-30, FR-010, FR-016)
- [X] T017 [P] In `src/telegram/keyboard.ts` **solo commento**: accanto al commento del contratto 009 aggiungere `// 010: s:i (📝 Profili incompleti), s:i:<1…5> (filtri di /incomplete) — specs/010-…/contracts/callback-data.md`; decoder ed encoder invariati (FR-025)
- [X] T018 [P] In `test/unit/callback-data.test.ts` aggiungere: round-trip di `s:i` e `s:i:1` … `s:i:5`; `s:i:x`, `s:i:1:2`, `s:i:` e un id di 16 cifre → `null` dal decoder; lunghezze 3 e 5 byte, tutte ≤ 64 (RNF-14, FR-025)

**Checkpoint**: `npm run typecheck` e `npm test` verdi (lo scheletro di T015 usa solo testi esistenti).

---

## Phase 5: User Story 1 — Auguri allo scoccare della mezzanotte per le persone Alta (Priority: P1) 🎯 MVP

**Goal**: le persone Alta ricevono il reminder del giorno alle 00:00 della data effettiva; la mezzanotte
si scrive "00:00" in `/stato` e nell'avviso di buco (§7, RF-10, RNF-19, N-06).

**Independent Test**: con una persona Alta e una Media che compiono gli anni lo stesso giorno, simulare
le esecuzioni orarie dalle 00:00 alle 21:00 e verificare l'invio delle 00:00 alla sola Alta, il
contenuto, Fatto, il retry dopo un errore e la riga di `/stato` di un invio abbandonato.

> Filone indipendente dalla Fase 6 (`/incomplete`): file diversi, salvo `src/texts.ts` (già toccato in
> Fase 2). T019 e T020 possono procedere in parallelo con la Fase 6.

- [X] T019 [P] [US1] Verifica senza modifiche (annotare l'esito nel commit, nessuna riga di codice): `src/cron/hourly.ts` e `src/db/reminders.ts` gestiscono `ref = 0` come gli altri slot (idempotenza `INSERT OR IGNORE` su `(occurrence_id, kind, ref)`, retry sulle righe `fallito` con `local_date = oggi`, `splitByCap` con `MAX_SENDS_PER_RUN = 40`, `has_day_send` che conta anche lo slot 0, `in_invio` non ritentato); `src/bot/promemoria.ts` `renderByKind("giorno", 0, …)` produce lo stesso testo e gli stessi pulsanti di `("giorno", 9, …)` senza `disable_notification`; `src/domain/stato.ts` passa `LocalClock` e `ref` ai testi. Se una verifica fallisce, fermarsi e segnalarlo prima di correggere (RF-10, N-01, N-02, N-03, BR-11, FR-003, research R-03)
- [X] T020 [P] [US1] Creare `test/integration/v13-mezzanotte.test.ts` (Worker + D1 di test, `scheduledAt` iniettato, Telegram simulato), un test per criterio con l'ID nel nome: **US1-1** Marco Alta, compleanno 14/03, esecuzione `2026-03-13T23:00Z` → reminder del giorno con contatti, Fatto, Salta quest'anno, senza `disable_notification` (RF-10); **US1-2** Fatto sul reminder delle 00:00 → nessun invio alle 9, 13, 18, 21 né recupero il 15/03 alle 13 (BR-07); idem Salta quest'anno; **US1-3** senza risposta → reminder alle 9:00; **US1-4** Anna Media → nulla alle 00:00, primo alle 9:00 (§7); **US1-5** errore Telegram alle 00:00 → retry alle 1:00 e successive, `abbandonato` il giorno dopo (N-03); **US1-6** Alta inserita alle 10:00 del compleanno → nessuno slot 0 (BR-10, BR-11); **US1-7** Alta nata il 29/02, 2027 → reminder alle 00:00 del 28/02 (BR-04); **US1-8** slot 0 abbandonato → `/stato` "Marco, reminder delle 00:00 del 14/03" (RNF-19); **US1-9** buco 23:00 → 2:00 → "dalle 23:00 del 13/03 alle 2:00 del 14/03"; buco 21:00 → 00:00 → "… alle 00:00 del 14/03" (RNF-19, N-06); **SC-002** occorrenza senza risposta: Alta 3 + 5 + 1, Media 1 + 3 + 1, Bassa 0 + 2 + 1; **SC-003** doppia esecuzione delle 00:00 → un solo invio `('giorno', 0)` (N-02); edge case: Alta creata alle 23:30 del giorno prima → slot 0 parte (e niente pre-reminder −1); creata alle 00:00:00 o alle 00:30 → non parte; cambio Media → Alta alle 00:30 → slot 0 non parte, valgono 9/13/18/21; Alta → Media prima delle 00:00 → non parte; Alta → Media alle 8:00 dopo l'invio delle 00:00 → invio 0 resta registrato, partono 9/13/18 e il recupero (BR-12); esecuzione delle 00:00 mancata → nessun recupero, alle 9:00 il successivo (N-04); riga `in_invio` delle 00:00 → non ritentata; più di 40 Alta → eccedenti alle esecuzioni successive (N-01); `/oggi` dopo l'invio delle 00:00 → come oggi, non conta come slot (RF-16); occorrenza già aperta il giorno del deploy → nessun invio retroattivo delle 00:00 (FR-022); **BR-05** Alta nata il 01/01, esecuzione `2026-12-31T23:00Z` → reminder delle 00:00 sull'occorrenza 2027 (non 2026), con "L'anno scorso" letto dall'occorrenza 2026; senza risposta → recupero il 02/01/2027 alle 13:00 (constitution VI)

**Checkpoint**: `npm test -- v13-mezzanotte schedule time stato` verde: US1 completa e verificabile da sola.

---

## Phase 6: User Story 2 — Elenco dei profili incompleti con `/incomplete` (Priority: P1)

**Goal**: `/incomplete [campo]` con 5 filtri a pulsanti e liste §5.7 per prossimo compleanno (RF-50,
RNF-14, §5.13).

**Independent Test**: con una rubrica di prova in cui mancano dati diversi a persone diverse, scrivere
`/incomplete` e verificare pulsanti e conteggi; premere ogni filtro e scrivere `/incomplete <campo>` con
argomenti validi, maiuscoli e non validi; verificare ordine, righe, lista vuota, rubrica vuota e
spezzatura.

- [X] T021 [US2] In `src/bot/incomplete.ts` completare `sendIncompleteMenu(ctx)`: una lettura `incompleteCountsStatement` → un messaggio con `T.incompleteTitle`, a capo `T.incompleteQuestion`, tastiera inline di 5 pulsanti `button(T.btnIncompleteFilter(INCOMPLETE_LABELS[f.key], counts[f.key]), encode s:i:<f.code>)` disposti due per riga ([Telefono][Instagram] / [Telegram][Anno di nascita] / [Nessun contatto]); i filtri a 0 compaiono comunque, rubrica vuota → 5 pulsanti con 0 (RF-50, RNF-14, FR-009, §5.13)
- [X] T022 [US2] In `src/bot/incomplete.ts` completare `sendIncompleteList(ctx, filter)`: una lettura `incompletePersonsStatement`; 0 righe → `T.incompleteNoPersons`; `incompleteRows(people, filter, toLocal(ctx.deps.now()).date)` vuota → `T.incompleteAllHave(filter.key)`; altrimenti `sendList(ctx, T.incompleteListHeader(filter.key, rows.length), formatRows(rows))` **senza tastiera** (intestazione solo sul primo messaggio, righe intere via `splitMessage`, nessun gruppo nelle righe) (RF-50, §5.7, FR-012, FR-013, FR-015)
- [X] T023 [US2] In `src/bot/incomplete.ts` aggiungere `export async function handleIncomplete(ctx: Ctx, args: string)`: `parseIncompleteArg(args)` → menu → `sendIncompleteMenu`; filtro → `sendIncompleteList`; unknown → invia `T.incompleteUnknown` e poi `sendIncompleteMenu` (due messaggi, research R-08). Nessuna modifica delle schede da qui (FR-014) (RF-50, FR-011)
- [X] T024 [US2] In `src/bot/commands.ts` aggiungere a `COMMANDS` la voce `incomplete: (ctx, cmd) => handleIncomplete(ctx, cmd.args)`; `parseCommand` invariato (gestisce già `@nomebot`, maiuscole del nome e spazi); il comando interrompe il flusso guidato come ogni altro (001 FR-018) (RF-50, FR-011)
- [X] T025 [P] [US2] In `test/unit/commands-parse.test.ts` aggiungere: `/incomplete` → nome `incomplete`, args `""`; `/incomplete Anno` → args `Anno`; `/incomplete@nomebot telefono` → `telefono`; `/incomplete  TELEFONO ` → `TELEFONO` (RF-50, FR-011)
- [X] T026 [US2] Creare `test/integration/v13-incomplete.test.ts` (Worker + D1 di test, rubrica con `NULL`, `''` e `'   '` nei contatti e nell'anno), un test per criterio con l'ID nel nome: **US2-1** 41 senza telefono → `/incomplete` mostra i 5 pulsanti nell'ordine con [Telefono (41)], due per riga; **US2-2** tocco `s:i:1` → nuovo messaggio "📝 Senza telefono · 41 persone", righe `/p_<id>` per prossimo compleanno, nessuna tastiera, menu non modificato (nessun `editMessage*`); **US2-3** `/incomplete instagram` → lista diretta; **US2-4** `/incomplete Anno` → lista senza anno; **US2-5** `/incomplete email` → errore ❌ e poi il menu; **US2-6** Marco con solo Instagram → in Telefono e Telegram, non in Nessun contatto; **US2-7** tutti con telefono → [Telefono (0)] e "✅ Tutte le persone hanno il telefono."; **US2-8** aggiunta del telefono con Modifica → `/incomplete telefono` non elenca più la persona; **US2-9** lista lunga → più messaggi, intestazione solo sul primo, nessun pulsante; edge case: varianti `telefoni`, `ig`, `contatto`, `telefono famiglia` → unknown; `/incomplete  TELEFONO ` e `/incomplete@nomebot telefono` → lista; valori `''`/spazi contano come mancanti e il dato non viene modificato (FR-024); rubrica vuota → 5 pulsanti a 0 e "La rubrica è vuota"; tocco su menu vecchio → dati attuali; persona senza anno (`NULL`, `''` e `'   '`) → riga senza età, in `/incomplete anno` e negli altri filtri; persona eliminata dopo l'invio di una lista → la lista resta com'era e `/p_<id>` risponde come oggi (001 FR-012a); persona senza gruppi → presente come le altre; `/incomplete` e tocco durante un flusso guidato → flusso interrotto senza salvare; pulsante di un estraneo → nessuna risposta (RF-30); `s:i:0`, `s:i:6`, `s:i:1:2`, `s:i:x` → "❌ Questa azione non è più disponibile." e nessun messaggio; **SC-005** conteggio "Nessun contatto" = "Senza contatti" di `/statistiche` e "Anno di nascita" = "Senza anno di nascita"; conteggi e liste coincidono con quelli calcolati a mano (RF-50, RNF-14, FR-008…FR-015)

**Checkpoint**: dopo la Fase 8, `npm test -- v13-incomplete incomplete commands-parse callback-data` verde: US2 completa e verificabile da sola.

---

## Phase 7: User Story 3 — Dai conteggi di `/statistiche` ai profili incompleti (Priority: P2)

**Goal**: [📝 Profili incompleti] in fondo a `/statistiche`; `/incomplete` in `/aiuto` e nel menu dei
comandi (RF-32, RNF-14, RF-28, §5.1).

**Independent Test**: `/statistiche` con rubrica popolata e vuota → pulsante sull'ultimo messaggio e,
al tocco, il menu dei filtri; `/aiuto` con la riga di `/incomplete`; menu dei comandi aggiornato.

- [X] T027 [US3] In `src/bot/statistiche.ts`, `showStatistiche`: passare a `sendLines` la tastiera `keyboard([[button(T.btnIncomplete, encode s:i)]])` (sull'ultimo messaggio se la vista è spezzata, anche con la rubrica vuota); i conteggi restano solo testo; nessun altro cambiamento (RF-32, RNF-14, FR-016, FR-017, research R-10)
- [X] T028 [US3] In `src/texts.ts` aggiungere la riga di `T.help` "/incomplete [campo] — profili incompleti: pulsanti dei filtri con i conteggi; con un campo (telefono, instagram, telegram, anno, contatti) la lista" dopo `/anno [anno]` e prima di `/statistiche`, e in `BOT_COMMANDS` la voce `{ command: "incomplete", description: "Profili incompleti: dati mancanti delle schede" }` nella stessa posizione; `/start` invariato; `src/cron/comandi.ts` **non si modifica** (il nuovo hash registra il menu alla prima esecuzione oraria senza invii, 005 FR-014) (RF-28, §5.1, FR-018, research R-11)
- [X] T029 [US3] In `test/integration/v13-incomplete.test.ts` (dopo T026) aggiungere: **US3-1** `/statistiche` → [📝 Profili incompleti] in fondo, tocco `s:i` → nuovo messaggio identico a `/incomplete`, `/statistiche` non modificata; **US3-2** rubrica vuota → pulsante presente, filtri a 0; **US3-3** "Senza anno di nascita" e "Senza contatti" restano testo; **US3-4** `/aiuto` contiene la riga di `/incomplete [campo]`, `/start` invariato; `/statistiche` spezzata → pulsante sull'ultimo messaggio; tocco `s:i` durante un flusso guidato → flusso interrotto (RF-32, RF-28, RNF-14)

---

## Phase 8: Testi e inventario (RNF-15, RNF-19)

**Purpose**: tutte le chiavi nuove di [contracts/testi-v13.md](contracts/testi-v13.md) nel punto unico
dei testi e nell'inventario eseguibile.

- [X] T030 In `src/texts.ts` aggiungere le chiavi rimanenti di `/incomplete`: `incompleteTitle: "📝 Profili incompleti"` (T, R2, emoji di sezione 📝); `incompleteQuestion: "Quale dato manca?"` (D); `btnIncompleteFilter: (label: string, n: number) => \`${label} (${n})\`` (PA, R6, **senza emoji**); costante `INCOMPLETE_LABELS: Record<IncompleteKey, string>` = Telefono · Instagram · Telegram · Anno di nascita · Nessun contatto; `incompleteListHeader: (key, n) => …` → "📝 Senza telefono · {1 persona | n persone}", "📝 Senza Instagram · …", "📝 Senza Telegram · …", "📝 Senza anno di nascita · …", "📝 Nessun contatto · …" con `plural()`; `incompleteUnknown: "❌ Non conosco questo dato. Scegli un filtro qui sotto oppure scrivi /incomplete seguito da telefono, instagram, telegram, anno o contatti."` (E, R4); `btnIncomplete: "📝 Profili incompleti"` (PA, R6, icona 📝) (RF-50, RF-32, RNF-19, FR-009, FR-011, FR-012, FR-019, FR-020)
- [X] T031 In `test/unit/testi.test.ts` (dopo T006, T030) aggiungere a `INVENTARIO` tutte le chiavi nuove con il loro tipo (`incompleteTitle` T, `incompleteQuestion` D, `btnIncompleteFilter` PA, `incompleteListHeader` T, `incompleteAllHave` C, `incompleteNoPersons` I, `incompleteUnknown` E, `btnIncomplete` PA) e verificare: `btnIncompleteFilter` senza emoji; `btnIncomplete` e `incompleteTitle` iniziano con 📝; `incompleteListHeader` con 1 persona / 41 persone per ciascun filtro; riga di `help` presente dopo `/anno` (RNF-15, RNF-19, FR-019, FR-020)
- [X] T032 [P] In `test/integration/v11-stile.test.ts` estendere l'elenco chiuso delle icone dei pulsanti con 📝 (RNF-19, FR-019)

**Checkpoint**: `npm run typecheck` e `npm test` verdi su tutto il repository (gate completo).

---

## Phase 9: Aggiornamento dei test esistenti

**Purpose**: allineare i test di 001-009 ai comportamenti modificati (SC-001). Ogni task tocca un file
diverso: tutti [P].

- [X] T033 [P] In `test/unit/promemoria.test.ts`: `renderByKind("giorno", 0, …)` uguale a `("giorno", 9, …)` (stesso testo e pulsanti) (RF-10, FR-003)
- [X] T034 *(rimosso dopo l'analisi del 2026-11-06: `test/unit/navigazione.test.ts` contiene solo funzioni pure senza elenco dei punti di passo successivo; il limite di 2 pulsanti con `/statistiche` è verificato da T043 e T029)*
- [X] T035 [P] In `test/integration/us1-reminder.test.ts`: profilo Alta con reminder anche alle 00:00; Media e Bassa invariati; aggiornare i conteggi attesi di Alta (5 reminder) (RF-10, §7)
- [X] T036 [P] In `test/integration/scheduled.test.ts`: esecuzione alle 00:00 locali con invii; menu dei comandi aggiornato con `incomplete` in un'ora senza invii (RF-10, RF-28)
- [X] T037 [P] In `test/integration/ciclo-idempotenza.test.ts`: doppia esecuzione delle 00:00 → un solo invio `('giorno', 0)` (N-02, SC-003)
- [X] T038 [P] In `test/integration/ciclo-retry.test.ts`: invio delle 00:00 fallito → retry alle 1:00 e successive, abbandono il giorno dopo (N-03)
- [X] T039 [P] In `test/integration/ciclo-budget.test.ts`: 00:00 con 200 Alta = 43 subrequest (40 inviati, 160 in coda che partono tra 1:00 e 4:00); 00:00 senza Alta = 2; caso peggiore di `runScheduled` invariato a 48 (constitution II, research R-13)
- [X] T040 [P] In `test/integration/v11-stato.test.ts`: righe di `/stato` con la mezzanotte "00:00" (ultimo controllo orario e abbandonati) (RNF-19, FR-023)
- [X] T041 [P] In `test/integration/v11-buco-cron.test.ts`: avviso 23:00 → 2:00 ("alle 2:00"); estremo a mezzanotte → "00:00" (RNF-19, N-06)
- [X] T042 [P] In `test/integration/v12-statistiche.test.ts`: tastiera [📝 Profili incompleti] sull'ultimo messaggio; sezione Età invariata (RF-32)
- [X] T043 [P] In `test/integration/v12-navigazione.test.ts`: elenco dei punti di passo successivo con `/statistiche`, ≤ 2 pulsanti (RNF-14)
- [X] T044 [P] In `test/integration/menu-comandi.test.ts`: `BOT_COMMANDS` con `incomplete` dopo `anno`; nuovo hash → `setMyCommands` (RF-28)
- [X] T045 [P] In `test/integration/us7-start-aiuto.test.ts`: `/aiuto` con la riga di `/incomplete [campo]`; `/start` invariato (RF-28)
- [X] T046 [P] In `test/integration/viste-budget.test.ts`: `/statistiche` con la tastiera sull'ultimo messaggio; nuovi casi entro la tabella R-13 — `/incomplete` menu 4, `/incomplete email` 5, `/incomplete telefono` con 200 persone 8, `/incomplete anno` vuota 4, tocco `s:i` 4, tocco `s:i:<n>` con 200 persone 8 (constitution II)

**Checkpoint**: `npm run typecheck` e `npm test` verdi.

---

## Phase 10: Bench e smoke Postman

- [X] T047 [P] In `bench/ciclo.bench.ts` aggiungere lo scenario "00:00, 200 Alta" (pianificazione, selezione, composizione) con la soglia del file invariata (constitution II, research R-13)
- [X] T048 [P] In `bench/liste.bench.ts` aggiungere lo scenario "`/incomplete telefono`, 200 persone" (`incompleteRows` + `formatRows` + `splitMessage`) con la soglia del file (< 1 ms) (constitution II)
- [X] T049 In `postman/bot-compleanni.postman_collection.json` portare la versione a **2.6.0** (descrizione: feature 001–010); aggiungere la cartella "22 · Mezzanotte e profili incompleti v1.3" prima della pulizia (che diventa "23 · Pulizia") con le 9 richieste di [quickstart.md](quickstart.md) §2: `/incomplete`, tocco `s:i:1`, `/incomplete Anno`, `/incomplete email`, `/statistiche`, tocco `s:i`, tocchi malformati `s:i:0` e `s:i:6`, `/aiuto`, pulsante di un estraneo (`s:i:1`) (RF-50, RF-32, RF-28)
- [X] T050 [P] In `postman/seed-smoke.sql` aggiungere persone con dati mancanti diversi: una senza telefono, una con solo Instagram, una senza anno, una con `instagram = '  '` e una persona Alta; aggiornare `postman/README.md` (versione 2.6.0, cartella 22, nuovi dati del seed) (RF-50)

---

## Phase 11: Polish e verifiche finali

- [ ] T051 Eseguire `npm run typecheck`, `npm test`, `npm run bench` e `.\scripts\smoke-postman.ps1`: tutto verde (quickstart §1-2)
- [X] T052 Verifiche finali con `git diff --stat` e `grep`: nessun file in `migrations/`; `wrangler.toml`, `src/cron/*`, `src/db/reminders.ts`, `docs/AFU.md` e le spec 001-009 non toccati; nessun nuovo `console.log`/`log(` con nomi, username, telefoni o date (constitution V); nessun testo fuori da `src/texts.ts` nei file nuovi (RNF-15); nessun "0:00" isolato in `src/texts.ts` (SC-004)

---

## Dependencies & Execution Order

### Dipendenze tra fasi

- **Fase 1 (Setup)** → nessuna dipendenza.
- **Fase 2 (Dominio)** → dipende da T001 (T002, T003). Blocca tutto il resto.
- **Fase 3 (Dati)** → dipende da T008 (tipi `IncompleteKey`, `IncompletePerson`).
- **Fase 4 (`callback_data` e router)** → dipende da Fasi 2-3.
- **Fase 5 (US1)** → dipende da Fase 2 (T001, T002, T005). **Indipendente** dalle Fasi 3, 4, 6.
- **Fase 6 (US2)** → dipende da Fasi 2-4.
- **Fase 7 (US3)** → dipende da Fase 6 (`sendIncompleteMenu`).
- **Fase 8 (Testi)** → chiude typecheck delle Fasi 6 e 7; gate completo.
- **Fase 9 (Test esistenti)** → dipende da Fase 8.
- **Fase 10 (Bench e smoke)** → dipende da Fase 9.
- **Fase 11 (Verifiche finali)** → ultima.

### Dipendenze tra task (solo le non ovvie)

- `src/texts.ts`: T005 → T010 → T028 → T030 (in sequenza, mai in parallelo).
- `test/unit/testi.test.ts`: T006 → T031.
- `test/unit/incomplete.test.ts`: T009 → T011.
- `src/bot/incomplete.ts`: T015 → T021 → T022 → T023.
- `test/integration/v13-incomplete.test.ts`: T026 → T029.
- T013 dipende da T012 (`MISSING`).
- Il caso `rowToIncompletePerson` di T009 si scrive dopo T012 (Fase 3): fino ad allora il gate della
  Fase 2 resta verde senza quel caso.

### I due filoni paralleli

Slot delle 00:00 (T001-T007, T019, T020) e `/incomplete` (T008-T018, T021-T029) toccano file diversi,
salvo `src/texts.ts` (T005 vs T010/T028/T030): con due sviluppatori, il filone `/incomplete` parte dopo
T005.

### Parallel Example: Fase 2

```text
T003 test/unit/schedule.test.ts        T004 test/unit/time.test.ts
T007 test/unit/stato.test.ts           T008 src/domain/incomplete.ts
T009 test/unit/incomplete.test.ts
```

### Parallel Example: US1 e US2 insieme

```text
Filone A: T019 (verifica moduli) → T020 test/integration/v13-mezzanotte.test.ts
Filone B: T021 → T022 → T023 src/bot/incomplete.ts, T024 src/bot/commands.ts, T025 commands-parse
```

### Parallel Example: Fase 9

Tutti i task T033, T035-T046 su file distinti, eseguibili insieme (T034 rimosso).

---

## Implementation Strategy

### MVP (US1)

1. Fasi 1-2 → T019, T020 (Fase 5).
2. **Stop e verifica**: slot delle 00:00 per Alta e "00:00" in `/stato`, rilasciabile da solo (effort S,
   punto 1 dell'ordine di realizzazione AFU).

### Consegna incrementale

1. MVP (US1).
2. Fasi 3, 4, 6 e i testi della Fase 8 → `/incomplete` (US2).
3. Fase 7 → `/statistiche`, `/aiuto`, menu (US3).
4. Fasi 9-11 → test esistenti, bench, smoke e verifiche; poi commit, push e deploy (prompt v1.3 §8).

### Riepilogo

| Fase | Task | Story |
|---|---|---|
| 1 Setup | T001 | — |
| 2 Dominio | T002-T011 | — |
| 3 Dati | T012-T014 | — |
| 4 `callback_data` e router | T015-T018 | — |
| 5 Slot delle 00:00 | T019-T020 | US1 |
| 6 `/incomplete` | T021-T026 | US2 |
| 7 `/statistiche` e comandi | T027-T029 | US3 |
| 8 Testi | T030-T032 | — |
| 9 Test esistenti | T033-T046 | — |
| 10 Bench e smoke | T047-T050 | — |
| 11 Verifiche finali | T051-T052 | — |
