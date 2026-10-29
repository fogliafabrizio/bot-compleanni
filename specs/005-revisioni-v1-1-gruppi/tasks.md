---

description: "Task list per la feature 005 — Revisioni v1.1, Gruppi"
---

# Tasks: Revisioni v1.1 — Gruppi

**Input**: documenti di progetto in `specs/005-revisioni-v1-1-gruppi/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-13), data-model.md, contracts/
(callback-data.md, gruppi.md), quickstart.md

**Tests**: OBBLIGATORI (constitution principio X, SC-001). Ogni `describe`/`it` MUST citare l'ID AFU
o FR verificato (principio XI), es. `it("RF-19, BR-26: /gruppi fam con un solo gruppo apre la scheda", …)`.
Dentro ogni fase i test si scrivono per primi e devono fallire prima dell'implementazione. La colonna
"#" di quickstart.md §3 indica lo scenario coperto.

**Organization**: ordine a strati richiesto dal proprietario — (1) dominio con la chiave BR-26 e i
suoi test unitari, (2) accesso ai dati, (3) viste e callback per user story (US2 → US1 → US3),
(4) testi e menu comandi, (5) aggiornamento dei test esistenti e smoke Postman.
US1 e US2 sono entrambe P1; US2 viene prima perché elenco e scheda gruppo, che costruisce, sono gli
esiti della ricerca di US1 (FR-007 rimanda a FR-001…FR-004 e FR-008).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1, US2, US3 della spec)

## Convenzioni valide per tutti i task

- Valgono le convenzioni di `specs/001…004/tasks.md`: testi solo in `src/texts.ts` (stringhe esatte
  da `contracts/gruppi.md`), costanti solo in `src/config.ts`, log solo con codici e numeri tramite
  `src/log.ts` (mai nomi di gruppi o persone), nessun `new Date()` fuori da `src/index.ts`,
  `today = toLocal(ctx.deps.now())`. **Nessun `parse_mode`.**
- **Nessuna migration, nessuna dipendenza nuova, nessuna conversione di dati** (FR-015, R-12).
  `name_norm` resta `normKey(name)` e resta la chiave dell'unicità BR-17: non va mai sostituita
  con `groupKey`.
- **Funzioni riusate, mai duplicate**: `searchKey` (invariata, serve `/cerca` RF-18), `normKey`,
  `cleanText`, `compareNames` di `src/domain/text.ts`; `sortByNextBirthday` di `src/domain/viste.ts`;
  `formatRows`, `splitMessage`, `plainLine`, `sendList` di `src/bot/liste.ts`; `validateText`,
  `newGroupStep` di `src/bot/flows/steps.ts`; motore dei flussi di `src/bot/flows/engine.ts`;
  `flowGuardSql`, `consumeStatement` di `src/db/conversation.ts`.
- `src/domain/text.ts` e `src/domain/viste.ts` restano **puri** (nessun import di `cloudflare:*`,
  `src/db/*`, `src/bot/*`): girano nel bench in Node.
- **`groupKey` è l'unica funzione della chiave BR-26** (principio VIII): ricerca, ordinamento,
  validazione FR-006a e import la chiamano, nessuno la reimplementa.
- **Import circolari** (R-09): `src/bot/gruppi.ts` contiene solo viste e **non** importa
  `src/bot/flows/*`. `handleGroupCallback` (tocchi `g2:*`) sta in `src/bot/flows/gruppi.ts`, che
  importa le viste da `src/bot/gruppi.ts` e da `src/bot/viste.ts`; il router importa già i flussi.
- Una sola `db.batch` di lettura per comando o tocco (R-07); scritture di rinomina ed eliminazione
  in **una** `db.batch` con `flowGuardSql`, `consumeStatement` e la rilettura in coda.
- I task che modificano lo stesso file tra `src/texts.ts`, `src/bot/gruppi.ts`,
  `src/bot/flows/gruppi.ts`, `src/bot/viste.ts`, `src/telegram/keyboard.ts`, `src/bot/commands.ts`,
  `src/db/viste.ts`, `test/integration/us6-gruppi.test.ts`, `postman/bot-compleanni.postman_collection.json`
  non sono [P] tra loro.
- Test di integrazione: D1 locale, `FakeTelegram`, helper `say`/`press`/`send` di
  `test/helpers/send.ts`, `makeDeps({ now })`, `makeCronDeps`/`runAt` di `test/helpers/cron.ts`, seed
  con `insertPerson`/`insertGroup`/`addToGroup` di `test/helpers/db.ts`. `NOW` = 2026-10-28T10:00Z =
  **mercoledì 28/10/2026, 11:00 Europe/Rome**. Solo dati sintetici (principio V).
- Valori di riferimento di `nameHash` (FNV-1a 32 bit su unità UTF-16, base 36), da usare nei test
  unitari e nello script della collection Postman: `"Famiglia"` → `esn6mr`, `"famiglia"` →
  `1y0qzw3`, `""` → `ztntfp`, `"Smoke Lavoro"` → `1ea1eld`, `"👨‍👩‍👧 Smoke Casa"` → `1ol49qr`,
  `"Smoke Casa Rossi"` → `19kbv82`.

---

## Phase 1: Setup (configurazione)

**Purpose**: costanti condivise (principio VIII).

- [X] T001 Aggiungere a `src/config.ts` `GROUP_BUTTONS_MAX = 60` (V-09, FR-013: massimo pulsanti di gruppo per tastiera, + [➕ Nuovo gruppo] = 61 ≤ 100) e `GROUP_KEY_MIN_LENGTH = 2` (BR-26, FR-006a: lunghezza minima della chiave del nome di un gruppo), ciascuna con commento che cita gli ID

---

## Phase 2: Fondamenta A — Dominio della chiave BR-26 (Blocking)

**Purpose**: funzioni pure della chiave di ricerca, dell'hash del nome, della ricerca e del
`callback_data` `g2`, con i test unitari scritti prima.

**⚠️ CRITICAL**: nessuna vista né callback può partire prima della fine di questa fase.

### Test unitari (prima, devono fallire)

- [X] T002 [P] Test di `groupKey` in `test/unit/text.test.ts` (titoli "BR-26, FR-006: …"), uno per riga della tabella di research R-02: `👨‍👩‍👧 Famiglia`→`famiglia` (ZWJ), `👍🏽 Amici`→`amici` (colore della pelle), `★ Calcetto 🇮🇹`→`calcetto`, `🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scozia`→`scozia` (tag), `❤️ Cuori`→`cuori` (U+FE0F), `1️⃣ Calcetto`→`calcetto` (keycap), `Università` e `UNIVERSITA`→`universita`, `Nicolò` in NFC e in NFD→`nicolo`, `beach-tennis` / `Beach  tennis` / ` Beach tennis `→`beach tennis`, `2024 Calcetto`→`2024 calcetto`, `🏖` / `★★` / `""` / `"   "`→`""`, `🏖 X`→`x`, `U2`→`u2`, `★ Bar`→`bar`, `Smørrebrød`→`smørrebrød`; più un test che `searchKey("Rossi-Bianchi")` resta invariata (RF-18 fuori perimetro)
- [X] T003 Test di `hasValidGroupKey` e `nameHash` in `test/unit/text.test.ts` (dopo T002, stesso file): FR-006a — `🏖`, `★★`, `🏖 X` → `false`; `U2`, `★ Bar`, `Famiglia` → `true`; FR-005 — `nameHash` deterministico, risultato `/^[0-9a-z]{1,7}$/`, valori fissi `"Famiglia"`→`esn6mr`, `"famiglia"`→`1y0qzw3`, `""`→`ztntfp` (riferimento anche per Postman), `nameHash("Famiglia") !== nameHash("famiglia")`
- [X] T004 [P] Test di `findGroups` e `sortGroups` in `test/unit/viste-parse.test.ts` (titoli "BR-26, FR-007: …", "FR-001: …", "FR-016: …"): testo `famiglia` con "👨‍👩‍👧 Famiglia" e "Famiglia Rossi" → `one` "👨‍👩‍👧 Famiglia" (esatta vince); `fam` con un solo gruppo che contiene "fam" → `one`; `fam` con "Famiglia" e "Famiglia Rossi" → `many` ordinati; `famiglia` con "Famiglia" e "👨‍👩‍👧 Famiglia" (due esatte) → `many` con solo quei due; `xyz` → `none`; `🏖` e `"  "` → `empty`; gruppo "🏖" esistente mai trovato da nessun testo; `sortGroups` mette "👨‍👩‍👧 Famiglia" accanto a "Famiglia" e ordina per chiave, poi `compareNames`, poi `id`
- [X] T005 Test di `parseUpcomingArgs` per FR-011a in `test/unit/viste-parse.test.ts` (dopo T004, stesso file): `fam` → `{ ok: true, days: 30, group: "fam" }`; `2024 calcetto` → `{ ok: false }`; `30 2024 calcetto` → `{ ok: true, days: 30, group: "2024 calcetto" }`; `7 fam` → 7 + "fam"; la funzione resta invariata nella regola (i test devono già passare: se falliscono, correggere il test, non la regola di 003)
- [X] T006 [P] Test del nuovo ambito `g2` in `test/unit/callback-data.test.ts` (titoli "FR-005, FR-017, V-09: …"; i vecchi casi `g:*` si spostano in T048): round-trip di `g2:n`, `g2:o:12:1x9k3pq`, `g2:r:12:esn6mr`, `g2:x:12:esn6mr`, `g2:p:12:esn6mr:7`; caso peggiore `g2:p:999999999999999:zzzzzzz:366` = 32 byte ≤ 64; rifiutati (`decodeCallback` → `null`): `g2:o` senza id, `g2:o:abc:esn6mr`, `g2:o:12:ESN6MR`, `g2:o:12:12345678` (hash > 7), `g2:p:12:esn6mr` (giorni mancanti), `g2:p:12:esn6mr:0`, `g2:p:12:esn6mr:367`, `g2:z:12:esn6mr`, `g2:n:12`
- [X] T007 [P] Test dell'import in `test/unit/import.test.ts` (titoli "FR-006a, 004 FR-006: …"): riga con gruppo nuovo `🏖` → riga non valida con motivo `gruppo "🏖" senza almeno 2 lettere o cifre`; gruppo nuovo `🏖 X` → non valida; gruppo nuovo `U2` → valida e tra `groupsToCreate`; gruppo `🏖` già esistente (stesso `name_norm`) → riga valida e associata, nessun gruppo da creare; `src/domain/backup.ts` non applica la regola (un backup con gruppo "🏖" resta valido, test in `test/unit/backup.test.ts` se assente)

### Implementazione

- [X] T008 Implementare `groupKey(s: string): string` in `src/domain/text.ts` (BR-26, FR-006, research R-02): (1) sequenze keycap `/[0-9#*]️?⃣/gu` → spazio; (2) `searchKey` invariata (NFD, via `\p{M}`, minuscolo); (3) `/[^\p{L}\p{Nd}]+/gu` → `" "`; (4) `trim()`. Commento con BR-26 e il motivo del passo keycap. **Non** modificare `searchKey` né `normKey`
- [X] T009 Implementare in `src/domain/text.ts` `hasValidGroupKey(name) = groupKey(name).length >= GROUP_KEY_MIN_LENGTH` (FR-006a) e `nameHash(s)` = FNV-1a 32 bit (`0x811c9dc5`, `Math.imul(h, 0x01000193) >>> 0`) sulle unità UTF-16, `toString(36)` (FR-005); T002–T003 verdi
- [X] T010 Implementare in `src/domain/viste.ts` il tipo `GroupSearch<G>` (`empty` | `one` | `many` | `none`, data-model.md) e le funzioni generiche su `G extends { id: number; name: string }`: `sortGroups(groups)` (chiave `groupKey`, poi `compareNames`, poi `id`; `groupKey` calcolata una volta per gruppo) e `findGroups(groups, query)` secondo research R-03 (FR-006, FR-007, FR-011, FR-016); candidati di `many` ordinati con `sortGroups`; T004–T005 verdi
- [X] T011 [P] Aggiungere in `src/telegram/keyboard.ts` la variante `{ kind: "group"; action: "n" | "o" | "r" | "x" | "p"; groupId?: number; nameHash?: string; days?: number }` a `Callback`, con encode e decode del formato `g2:<azione>[:<groupId>:<nameHash>[:<giorni>]]` di contracts/callback-data.md (`groupId` `\d{1,15}`, `nameHash` `[0-9a-z]{1,7}`, `giorni` `\d{1,3}` in 1…`UPCOMING_MAX_DAYS`; `n` senza campi, `o|r|x` con id e hash, `p` con id, hash e giorni; ogni altra forma → `null`) (FR-005, V-09). **Lasciare per ora** lo scope `g` statico (si toglie in T027); T006 verde salvo i vecchi casi `g:*`
- [X] T012 Applicare FR-006a ai gruppi da creare in `src/domain/import.ts` (research R-11): nella funzione `groupsToCreate`/`buildPreview`, un gruppo della riga che non esiste per `name_norm` e ha `hasValidGroupKey` falso rende la riga non valida con `T.rowReason.groupKeyTooShort(valore)`; aggiungere in `src/texts.ts`, dentro `rowReason`, `groupKeyTooShort: (v: string) => \`gruppo "${v}" senza almeno ${GROUP_KEY_MIN_LENGTH} lettere o cifre\``; `src/domain/backup.ts` invariato; T007 verde

**Checkpoint**: `npm test -- test/unit` verde (salvo i vecchi casi `g:*` di `callback-data.test.ts`, sistemati in T048).

---

## Phase 3: Fondamenta B — Accesso ai dati (Blocking)

**Purpose**: statement D1 per ricerca, scheda, scritture guardate sul nome e riga del menu.

- [X] T013 [P] In `src/db/groups.ts` (FR-005, FR-009, FR-010, research R-05, R-07): `renameGuardedStatements` e `deleteGuardedStatements` ricevono anche `expectedName` e scrivono `… WHERE id = ? AND name = ? AND ${flowGuardSql}`; aggiungere `groupByIdStatement(db, groupId)` (gruppo per id, riusato da `getById`) e `listWithCountsStatement(db)` (stessa query di `listWithCounts`, che la riusa). Nessuno statement nuovo per le persone del gruppo: per rileggere dopo la rinomina si usa `groupCardStatements` di T014
- [X] T014 [P] In `src/db/viste.ts` (RF-17, RF-19, research R-07): `groupSearchStatements(db)` → [gruppi con `id`, `name`, `members` (COUNT), appartenenze `pg.group_id` + `LIST_PERSON_COLUMNS` da `person_groups JOIN persons`]; `groupCardStatements(db, groupId)` → [gruppo per id con `members`, persone del gruppo con `LIST_PERSON_COLUMNS`]; tipi riga `GroupCountRow`, `MembershipRow extends ListPersonRow { group_id: number }` e mapper con `rowToListPerson`; le righe dei gruppi di `groupSearchStatements` hanno la stessa forma di `GroupWithCount` (`id`, `name`, `members`), così passano direttamente a `showGroups`. Non rimuovere ancora `groupLookupStatements`/`groupNamesStatement` (T036)
- [X] T015 [P] In `src/db/settings.ts` (FR-014, research R-10, data-model `settings`): `BOT_COMMANDS_KEY = "bot_commands"`, `getBotCommandsHash(db): Promise<string | null>` e `saveBotCommandsHash(db, hash, nowIso)` con upsert sulla riga esistente, sullo stile di `AUTO_BACKUP_KEY`

**Checkpoint**: `npm run typecheck` verde; le fondamenta sono pronte.

---

## Phase 4: User Story 2 — Elenco gruppi a pulsanti e scheda gruppo (Priority: P1) 🎯 MVP (parte 1)

**Goal**: `/gruppi` mostra i gruppi come pulsanti; il tocco apre la scheda gruppo con
[✏️ Rinomina] [🗑 Elimina], che agiscono direttamente su quel gruppo (RF-07, RF-19, RNF-14, V-09).

**Independent Test**: con Famiglia (8) e Lavoro (5): `/gruppi`, tocco, Rinomina ed Elimina dalla
scheda; ripetere senza gruppi, con 60 e con 61 gruppi (quickstart §3 #8–#15).

### Test per US2 (prima, devono fallire)

- [X] T016 [US2] Nuovo `describe("v1.1 RF-07, RF-19 — elenco e scheda gruppo")` in `test/integration/us6-gruppi.test.ts` (i vecchi casi MVP del file si aggiornano in T044): #8 `/gruppi` con Famiglia (8) e Lavoro (5) → testo `👥 I tuoi gruppi`, pulsanti `Famiglia (8)` `Lavoro (5)` su due colonne in ordine `sortGroups`, ultima riga `➕ Nuovo gruppo` (`g2:n`); #9 tocco `g2:o` → un nuovo `sendMessage`, nessun `editMessage*`, nessun pulsante Indietro; #10 scheda `👥 Famiglia · 8 persone`, righe di 003 per prossimo compleanno con `/p_<id>`, tastiera `✏️ Rinomina` (`g2:r`) `🗑 Elimina` (`g2:x`) e nient'altro; #13 tocco `g2:o` su gruppo eliminato, rinominato e rinominato solo nelle maiuscole → `Il gruppo non esiste più.` + elenco, DB invariato (FR-005); #14 nessun gruppo → `Non hai ancora nessun gruppo.` + solo `➕ Nuovo gruppo`; #15 60 gruppi → pulsanti, 61 → testuale con `Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam` (V-09, SC-005); casi limite: scheda con 200 persone divisa in più messaggi con la tastiera solo sull'ultimo; scheda di gruppo vuoto `👥 X · 0 persone` + `Nel gruppo non ci sono persone.` + tastiera; `1 persona` al singolare; gruppo esistente "🏖" presente nell'elenco
- [X] T017 [US2] Nello stesso file `test/integration/us6-gruppi.test.ts`, `describe("v1.1 RF-07, FR-006a, FR-017 — Nuovo, Rinomina, Elimina")`: #11 `g2:r` → `Nuovo nome per il gruppo Famiglia?` senza "Quale gruppo?", nome valido → `Gruppo rinominato in <nuovo>` + riga vuota + scheda aggiornata in un nuovo messaggio, vecchia scheda non modificata; #12 `g2:x` su gruppo con 8 persone → conferma con "8 persone perderanno questa etichetta", Sì → gruppo assente, persone presenti, `Gruppo Famiglia eliminato` + elenco aggiornato; `g2:n` + `🏖`/`★★`/`🏖 X` → `Il nome del gruppo deve contenere almeno 2 lettere o cifre` e stessa domanda, `U2` e `★ Bar` creati; rinomina con chiave corta, con nome di un altro gruppo (`Esiste già un gruppo con questo nome`), > 30 caratteri → rifiutata con stessa domanda (BR-17, 001 FR-010a); gruppo "🏖" esistente rinominabile solo con nome conforme (FR-016); gruppo rinominato da altri tra domanda e risposta → `Il gruppo non esiste più.` + elenco, flusso chiuso, DB invariato; `g2:r`/`g2:x` con hash vecchio → `Il gruppo non esiste più.`; FR-017: `g:n`, `g:r`, `g:x`, `f:<flowId>:sg:<id>` e `f:<flowId>:y` su stato `gruppi`/`conferma` salvato a mano → `answerCallbackQuery` "Questa azione non è più disponibile", DB invariato; Annulla negli step `crea`, `rinomina`, `elimina`
- [X] T018 [P] [US2] In `test/integration/us2-inserimento.test.ts` aggiungere "FR-006a: creazione al volo di un gruppo nello step Gruppi di /nuovo": `🏖` e `🏖 X` rifiutati con `Il nome del gruppo deve contenere almeno 2 lettere o cifre` e stessa domanda, `★ Bar` accettato (vale anche per Modifica, stesso `newGroupStep`)

### Implementazione per US2

- [X] T019 [US2] Testi delle viste dei gruppi in `src/texts.ts` (contracts/gruppi.md, RF-07, RF-19, FR-006a): `groupsTitle: "👥 I tuoi gruppi"` (era `"Gruppi:"`); `groupButton: (name, n) => \`${name} (${n})\``; `groupLine` diventa `(name, n) => \`${name} (${n})\`` (righe dell'elenco testuale); `groupsTypeName: "Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam"`; `groupCardTitle: (name, n) => \`👥 ${name} · ${n === 1 ? "1 persona" : \`${n} persone\`}\``; `groupCardEmpty: "Nel gruppo non ci sono persone."`; `groupGone: "Il gruppo non esiste più."`; `groupKeyTooShort: \`Il nome del gruppo deve contenere almeno ${GROUP_KEY_MIN_LENGTH} lettere o cifre\``; `btnRename` (`"✏️ Rinomina"`) e `btnDeleteGroup` (`"🗑 Elimina"`) esistono già e si riusano. Non rimuovere ancora i testi obsoleti (T043)
- [X] T020 [US2] In `src/bot/liste.ts` `sendList(ctx, header, lines, keyboard?: InlineKeyboardMarkup)`: la tastiera va solo sull'ultimo messaggio prodotto da `splitMessage` (FR-008, R-08); tutti i chiamanti esistenti restano senza tastiera (003 FR-004, RNF-14)
- [X] T021 [US2] In `src/bot/flows/steps.ts` aggiungere `validateGroupName(input): Validation<string>` = `validateText(input, TEXT_LIMITS.groupName)` + `hasValidGroupKey`, con errore `T.groupKeyTooShort` (FR-006a, R-05); `newGroupStep` la usa al posto di `validateText` (creazione al volo in `/nuovo` e Modifica); T018 verde
- [X] T022 [US2] Creare `src/bot/gruppi.ts` (solo viste, **nessun import da `src/bot/flows/*`**; RF-07, RF-19, FR-001…FR-004, FR-008, FR-012, FR-013, R-06, R-08): `renderGroupList(groups, opts: { title: string; action: "o" | "p"; days?: number; withNew: boolean })` puro → `{ lines, keyboard }`: 0 gruppi → `T.noGroups` + solo `➕ Nuovo gruppo` (`g2:n`); 1…`GROUP_BUTTONS_MAX` → titolo e pulsanti `T.groupButton` a due colonne in ordine `sortGroups` con `callback_data` `g2:o:<id>:<nameHash(name)>` (o `g2:p:…:<giorni>`), poi `➕ Nuovo gruppo` se `withNew`; oltre → titolo, riga vuota, righe `T.groupLine`, riga vuota, `T.groupsTypeName`, tastiera solo con `➕ Nuovo gruppo` se `withNew`; `showGroups(ctx, prefix?, groups?: readonly GroupWithCount[])` (se `groups` è passato non legge da D1, altrimenti una lettura `listWithCounts`; prefisso + riga vuota; invio con `sendList`, così l'elenco lungo si divide con la tastiera sull'ultimo messaggio); `showGroupCard(ctx, group: { id; name; members }, people: ListPerson[], prefix?)` con `T.groupCardTitle`, riga vuota, `formatRows(sortByNextBirthday(people, today))` oppure `T.groupCardEmpty`, tastiera `[✏️ Rinomina g2:r][🗑 Elimina g2:x]` con id e `nameHash`; `openGroupCard(ctx, groupId, hash)` = una batch `groupCardStatements`, gruppo assente o `nameHash(name) !== hash` → `replyGroupGone`; `replyGroupGone(ctx, groups?)` = `showGroups(ctx, T.groupGone, groups)`
- [X] T023 [US2] Riscrivere il flusso in `src/bot/flows/gruppi.ts` (FR-006a, FR-009, FR-010, FR-017, data-model `conversation_state`, R-05): togliere `showGroups` (spostata in T022), `startGruppi`, gli step `nome`, `scelta`, `conferma` e l'azione `sg`; step `crea` (testo, dati `{}`, `T.askNewGroupName` + Annulla, `validateGroupName`, `existsNorm`, `createGuardedStatements`, poi `showGroups(ctx, T.groupCreated(nome))`), `rinomina` (testo, dati `{ groupId, groupName }`, `T.askRenameTo(groupName)` + Annulla, `validateGroupName`, `existsNorm(…, groupId)`, una batch `[...renameGuardedStatements(… expectedName = groupName), ...groupCardStatements(db, groupId)]`; 0 righe e gruppo assente o con nome diverso → `abortFlow` + `replyGroupGone`; 0 righe per doppio invio → nessuna risposta; altrimenti `showGroupCard(ctx, gruppo riletto, persone rilette, T.groupRenamed(nuovo))`), `elimina` (pulsanti `y` e Annulla, dati `{ groupId, groupName }`, `T.confirmDeleteGroup(groupName, countMembers)`, al Sì una batch `[...deleteGuardedStatements(… expectedName), groupByIdStatement(db, groupId), listWithCountsStatement(db)]`; gruppo cambiato → `replyGroupGone(ctx, elenco riletto nella batch)`; altrimenti `showGroups(ctx, T.groupDeleted(groupName), elenco riletto nella batch)`); esportare `startCrea(ctx)`, `startRinomina(ctx, groupId, groupName)`, `startEliminaGruppo(ctx, groupId, groupName)`
- [X] T024 [US2] In `src/bot/flows/gruppi.ts` aggiungere `handleGroupCallback(ctx, cb: Extract<Callback, { kind: "group" }>)` (FR-002, FR-005, contracts/callback-data.md "Validazione al tocco"): `n` → `startCrea`; `o` → `openGroupCard`; `r` / `x` → `getById`, gruppo assente o `nameHash(name) !== cb.nameHash` → `replyGroupGone` senza scritture, altrimenti `startRinomina` / `startEliminaGruppo` con id e nome salvato; `p` → per ora `answerCallback(ctx, T.actionUnavailable)` (completato in T035)
- [X] T025 [US2] In `src/bot/router.ts` (FR-005, FR-017): ramo `cb.kind === "group"` → `clear(ctx.deps.db, ctx.chatId)` come i pulsanti senza stato, poi `handleGroupCallback`, poi `answerCallback(ctx)`; rimuovere `"g:n"`, `"g:r"`, `"g:x"` da `STATIC_CALLBACKS` e l'import di `startGruppi`
- [X] T026 [US2] In `src/bot/commands.ts` importare `showGroups` da `./gruppi` invece che da `./flows/gruppi` (RF-07); `gruppi` senza argomento mostra l'elenco a pulsanti (la ricerca arriva in T031)
- [X] T027 [US2] In `src/telegram/keyboard.ts` togliere `"g"` dagli scope statici di `Callback` e dal ramo del decoder (FR-017, R-04): `g:n`, `g:r`, `g:x` → `decodeCallback` restituisce `null` → "Questa azione non è più disponibile"; `npm run typecheck` verde, T016–T017 verdi

**Checkpoint**: elenco, scheda, Rinomina ed Elimina dalla scheda funzionano; US2 verificabile da sola.

---

## Phase 5: User Story 1 — Ricerca morbida del gruppo (Priority: P1) 🎯 MVP (parte 2)

**Goal**: `/gruppi <testo>` (alias `/gruppo`) trova il gruppo per parte del nome ignorando
maiuscole, accenti ed emoji e apre la scheda; più candidati → pulsanti (RF-19, BR-26, RNF-14).
Il criterio US1-7 (`/aiuto` e menu) è coperto nella Phase 7.

**Independent Test**: con "👨‍👩‍👧 Famiglia", "Famiglia Rossi", "Lavoro", "Università": `/gruppi fam`,
`/gruppi famiglia`, `/gruppo lavoro`, `/gruppi universita`, `/gruppi xyz` (quickstart §3 #1–#6).

### Test per US1 (prima, devono fallire)

- [X] T028 [P] [US1] Creare `test/integration/v11-gruppi-ricerca.test.ts` (titoli con RF-19, BR-26, RNF-14): #1 `/gruppi fam` con "👨‍👩‍👧 Famiglia" unico → scheda `👥 👨‍👩‍👧 Famiglia · …`; #2 `/gruppi famiglia` con "👨‍👩‍👧 Famiglia" e "Famiglia Rossi" → scheda di "👨‍👩‍👧 Famiglia"; #3 `/gruppi fam` con "Famiglia" e "Famiglia Rossi" → `🔍 Più gruppi corrispondono a «fam»:` + due pulsanti `g2:o` senza `➕ Nuovo gruppo`, il tocco apre la scheda; #4 `/gruppi UNIVERSITA` → scheda di "Università"; #5 `/gruppi xyz` → `Nessun gruppo corrisponde a «xyz».` + riga vuota + elenco a pulsanti; #6 `/gruppo lavoro` e `/gruppi lavoro` → messaggi identici (testo, entità, tastiera); casi limite: "Famiglia" e "👨‍👩‍👧 Famiglia" con `/gruppi famiglia` → due pulsanti; `/gruppi 🏖` e `/gruppo` senza argomento → elenco gruppi; 61 candidati → elenco testuale con invito; gruppo "🏖" esistente non trovato da `/gruppi 🏖`; `/gruppi` interrompe un `/nuovo` in corso (RF-06)

### Implementazione per US1

- [X] T029 [US1] Testi della ricerca in `src/texts.ts` (contracts/gruppi.md "Ricerca"): `groupsMany: (q: string) => \`🔍 Più gruppi corrispondono a «${q}»:\``; `groupNoMatch: (q: string) => \`Nessun gruppo corrisponde a «${q}».\`` (`q` = `args` come scritto dall'utente)
- [X] T030 [US1] In `src/bot/gruppi.ts` aggiungere `searchGroups(ctx, args)` e `handleGruppiCommand(ctx, args)` (RF-19, FR-006, FR-007, R-03, R-07): una batch `groupSearchStatements`; `findGroups(groups, args)`: `empty` → `showGroups(ctx)`; `one` → `showGroupCard` con le persone filtrate dalle appartenenze lette (nessuna seconda andata a D1); `many` → `renderGroupList(candidati, { title: T.groupsMany(args), action: "o", withNew: false })`; `none` → `showGroups(ctx, T.groupNoMatch(args), gruppi letti dalla batch di ricerca)` (nessuna seconda lettura); `handleGruppiCommand` chiama `showGroups` se `args` è vuoto, altrimenti `searchGroups`
- [X] T031 [US1] In `src/bot/commands.ts` `gruppi` e `gruppo` puntano allo **stesso** handler `(ctx, cmd) => handleGruppiCommand(ctx, cmd.args)` (`COMMANDS.gruppi === COMMANDS.gruppo`, FR-014 alias); rimuovere l'import di `showGruppo`
- [X] T032 [US1] In `src/bot/viste.ts` rimuovere `showGruppo` (sostituita dalla scheda gruppo, modifica 003 FR-014); lasciare `lookupGroup` e `replyGroupNotFound` finché `showProssimi` li usa (T034); T028 verde

**Checkpoint**: US1 e US2 complete (salvo menu, Phase 7): MVP della revisione.

---

## Phase 6: User Story 3 — Filtro gruppo di `/prossimi` con la ricerca morbida (Priority: P2)

**Goal**: `/prossimi [giorni] [gruppo]` usa `findGroups`; più candidati → pulsanti `g2:p` che
conservano N (RF-17, BR-26, RNF-14, FR-011, FR-011a).

**Independent Test**: con "👨‍👩‍👧 Famiglia" e "Famiglia Rossi": `/prossimi 7 fam`, `/prossimi 7 famiglia`,
`/prossimi 7 xyz` (quickstart §3 #16–#20).

### Test per US3 (prima, devono fallire)

- [X] T033 [US3] Nuovo `describe("v1.1 RF-17, BR-26 — filtro gruppo")` in `test/integration/us2-prossimi.test.ts` (il vecchio caso FR-010 si aggiorna in T046): #16 `/prossimi 7 fam` con "👨‍👩‍👧 Famiglia" unico → lista 7 giorni filtrata con il nome salvato nel titolo; #17 due gruppi → `🔍 Più gruppi corrispondono a «fam»:` + pulsanti `g2:p:<id>:<h>:7`, il tocco dà la lista filtrata a 7 giorni; #18 `/prossimi 7 xyz` → `Nessun gruppo corrisponde a «xyz».` + elenco a pulsanti `g2:o`; #19 `/prossimi fam` → 30 giorni filtrati; #20 `/prossimi 2024 calcetto` → errore 1–366 di 003 FR-011, `/prossimi 30 2024 calcetto` con "2024 Calcetto" → lista filtrata; casi limite: `/prossimi 7 🏖` → lista senza filtro; tocco `g2:p` su gruppo rinominato → `Il gruppo non esiste più.` + elenco

### Implementazione per US3

- [X] T034 [US3] In `src/bot/viste.ts` (RF-17, FR-011, FR-011a): `showProssimi` usa `parseUpcomingArgs` invariato e, se c'è testo del gruppo, una batch `groupSearchStatements` + `findGroups`: `empty` → lista senza filtro (003 FR-009); `one` → lista N giorni con le persone filtrate e il nome salvato nei titoli `T.upcomingHeader`/`T.upcomingNone`; `many` → `renderGroupList(candidati, { title: T.groupsMany(testo), action: "p", days: N, withNew: false })`; `none` → `showGroups(ctx, T.groupNoMatch(testo), gruppi letti dalla batch di ricerca)`; aggiungere `showProssimiForGroup(ctx, groupId, hash, days)` (una batch `groupCardStatements`, gruppo assente o hash diverso → `replyGroupGone`); rimuovere `lookupGroup` e `replyGroupNotFound`
- [X] T035 [US3] In `src/bot/flows/gruppi.ts` completare `handleGroupCallback` per `p` → `showProssimiForGroup(ctx, cb.groupId, cb.nameHash, cb.days)` (FR-011, FR-005)
- [X] T036 [US3] In `src/db/viste.ts` rimuovere `groupLookupStatements` e `groupNamesStatement` se non hanno più chiamanti (verificare con una ricerca nel repo); `npm run typecheck` e T033 verdi

**Checkpoint**: le tre user story funzionano; restano menu, test MVP aggiornati e smoke.

---

## Phase 7: Testi e menu comandi — `/aiuto` e `setMyCommands` (US1, FR-014)

**Goal**: `/aiuto` e il menu Telegram mostrano `/gruppi [nome]` e non `/gruppo`; il menu si
sincronizza dal cron entro un'ora dal rilascio (RF-19, §5.1, research R-10).

**Independent Test**: `menu-comandi.test.ts` (cron con menu cambiato e invariato) e `/aiuto`
(quickstart §3 #7).

### Test (prima, devono fallire)

- [X] T037 [P] [US1] In `test/helpers/fake-telegram.ts` aggiungere `setMyCommands(commands)` registrato in `calls` come `{ method: "setMyCommands", commands }` e un getter filtrato sullo stile di `sent()`
- [X] T038 [US1] Creare `test/integration/menu-comandi.test.ts` (titoli "RF-19, FR-014: …", dopo T037): `BOT_COMMANDS` contiene `gruppi` con descrizione `Elenco gruppi; con un nome cerca e apre la scheda` e nessuna voce `gruppo`; primo cron senza invii e senza riga `bot_commands` → una `setMyCommands` con `BOT_COMMANDS` e riga salvata con `nameHash(JSON.stringify(BOT_COMMANDS))`; secondo cron → nessuna `setMyCommands`; cron con almeno un invio reclamato → passo saltato; cron con backup mensile inviato → passo saltato; menu cambiato e invii a ogni ora per tre esecuzioni → `setMyCommands` alla prima esecuzione senza invii (FR-014); `setMyCommands` che fallisce → promemoria e backup non toccati, hash non salvato, log `bot_commands_error` con solo `error_code`

### Implementazione

- [X] T039 [P] [US1] In `src/telegram/types.ts` tipo `BotCommand { command: string; description: string }` e in `src/telegram/client.ts` metodo `setMyCommands(commands: readonly BotCommand[]): Promise<void>` nell'interfaccia `TelegramApi` e in `createTelegramApi` (FR-014); caso in `test/unit/telegram-client.test.ts` per il body inviato
- [X] T040 [US1] In `src/texts.ts` (RF-19, §5.1, contracts/gruppi.md "/aiuto e menu"): nel testo di `/aiuto` la riga `/gruppi — elenca, crea, rinomina ed elimina i gruppi` diventa `/gruppi [nome] — elenco gruppi a pulsanti; con un nome cerca il gruppo e apre la scheda` e la riga `/gruppo <nome> — persone di un gruppo` sparisce; esportare `BOT_COMMANDS: readonly BotCommand[]` con tutti i comandi di `/aiuto` (senza `/` e senza argomenti, descrizioni in italiano ≤ 256 caratteri) e la voce `gruppi` = `Elenco gruppi; con un nome cerca e apre la scheda`, senza `gruppo`
- [X] T041 [US1] Creare `src/cron/comandi.ts` con `syncBotCommands(deps: CronDeps)` (FR-014, R-10): `hash = nameHash(JSON.stringify(BOT_COMMANDS))`; se `getBotCommandsHash` è diverso → `deps.telegram.setMyCommands(BOT_COMMANDS)` poi `saveBotCommandsHash`; altrimenti nulla (1 D1 a vuoto, 2 D1 + 1 Telegram quando cambia)
- [X] T042 [US1] In `src/cron/scheduled.ts` aggiungere il passo isolato dopo `runHourly` e `runMonthlyBackup` (principio VII, RNF-12): conservare il `RunReport` di `runHourly` e l'esito di `runMonthlyBackup`; se `report.claimed > 0` o il backup ha `sent: true`, saltare; altrimenti `try { await syncBotCommands(deps) } catch (err) { log("bot_commands_error", errorCode(err)) }`; aggiornare il commento in testa; T038 verde

**Checkpoint**: US1 completa anche per il criterio US1-7.

---

## Phase 8: Polish — test esistenti, budget, bench e smoke Postman

**Purpose**: pulizia dei testi obsoleti, aggiornamento dei test MVP che cambiano comportamento
(SC-001), verifica dei limiti (principio II) e smoke manuale (research R-13).

- [X] T043 Rimuovere da `src/texts.ts` i testi senza più chiamanti (verificare con una ricerca nel repo): `askGroupToRename`, `askGroupToDelete`, `groupUsage`, `groupHeader`, `groupEmpty`, `existingGroups`, `groupNotFound`; `npm run typecheck` verde
- [X] T044 [P] Aggiornare i vecchi casi MVP di `test/integration/us6-gruppi.test.ts` (001 US6, plan "Test"): Rinomina ed Elimina partono dalla scheda (`g2:r`/`g2:x`) invece che da `g:r`/`g:x` + "Quale gruppo?"; il test FR-018c diventa FR-005/FR-017; restano verdi BR-17 e FR-010a in creazione e rinomina, FR-022 singolare/plurale, Annulla, RF-06 (`/gruppi` interrompe `/nuovo`)
- [X] T045 [P] Aggiornare la sezione `/gruppo` di `test/integration/us5-gruppo-mese.test.ts` (003): `/gruppo Lavoro` → scheda gruppo (`👥 Lavoro · …` invece di `Gruppo Lavoro`, tastiera `g2:r`/`g2:x`); `/gruppo` vuoto → elenco gruppi invece della sintassi; inesistente → `Nessun gruppo corrisponde a «…».` + elenco a pulsanti; gruppo vuoto → scheda con `0 persone` e `Nel gruppo non ci sono persone.`; ID nei titoli (RF-19, BR-26)
- [X] T046 [P] Aggiornare in `test/integration/us2-prossimi.test.ts` il caso FR-010 di 003: gruppo inesistente → `Nessun gruppo corrisponde a «…».` + elenco a pulsanti invece di `Gruppi esistenti: …`; il caso con maiuscole resta verde (RF-17)
- [X] T047 [P] Aggiornare `test/integration/us7-start-aiuto.test.ts` (RF-19, §5.1, quickstart #7): `/aiuto` contiene `/gruppi [nome] — elenco gruppi a pulsanti; con un nome cerca il gruppo e apre la scheda` e nessuna riga che inizia con `/gruppo `
- [X] T048 [P] Aggiornare `test/unit/callback-data.test.ts` (FR-017): `g:n`, `g:r`, `g:x` escono dal round-trip ed entrano tra i dati rifiutati (`decodeCallback` → `null`); ogni tastiera generata da `renderGroupList` e `showGroupCard` ha `callback_data` ≤ 64 byte UTF-8
- [X] T049 [P] Verificare e aggiornare `test/integration/us2-inserimento.test.ts` e `test/integration/us4-modifica.test.ts` dove controllano l'elenco di `/gruppi` o i suoi pulsanti dopo una creazione al volo (nuovo titolo `👥 I tuoi gruppi`, pulsanti `g2:o`)
- [X] T050 [P] In `test/integration/budget.test.ts` (principio II, R-07): `/gruppi` con 20 gruppi (aggiornare i valori esatti), `/gruppi <testo>` con esito `one` su 200 persone, tocco `g2:o` con 200 persone (scheda divisa, ≤ 9 subrequest), Rinomina con risposta valida e scheda di 200 persone (≤ 8), Elimina Sì (≤ 4); valori esatti del plan e ≤ 50
- [X] T051 [P] In `test/integration/viste-budget.test.ts` aggiungere `/prossimi 30 <testo>` con esito `one` su 200 persone (≤ 8 subrequest, una sola batch D1 di lettura) e tocco `g2:p` (≤ 9)
- [X] T052 [P] In `test/integration/ciclo-budget.test.ts` aggiungere: cron con 40 invii + backup mensile + menu cambiato ≤ 50 subrequest con passo del menu saltato (nessuna `setMyCommands`); cron senza invii con menu cambiato = 7 subrequest, invariato = 5 (tabella "Subrequest" del plan)
- [X] T053 [P] In `bench/liste.bench.ts` aggiungere i casi "ricerca gruppo 200 persone / 100 gruppi" (`findGroups` + filtro appartenenze + `sortByNextBirthday` + `formatRows`), "scheda 200 persone" e "elenco 100 gruppi" (`sortGroups` + `renderGroupList`), soglia 3 ms
- [X] T054 [P] In `postman/seed-smoke.sql` aggiungere i gruppi `9203 '👨‍👩‍👧 Smoke Casa'` (`name_norm` = `normKey`) e `9204 'Smoke Casa Rossi'` con almeno una persona ciascuno tra 9001–9006, senza cambiare 9201 e 9202 (research R-13)
- [X] T055 Nella collection `postman/bot-compleanni.postman_collection.json`: versione 2.1.0 e funzione `nameHash` nello script di collection (stesso algoritmo di `src/domain/text.ts`, con un controllo che `nameHash("Famiglia") === "esn6mr"`); id dei gruppi creati letti dal D1 locale con `postman/helper.mjs` (estenderlo solo se non espone già la lettura necessaria)
- [X] T056 Nella stessa collection, cartelle **02** (`/aiuto` con `/gruppi [nome]`, senza `/gruppo`) e **04** (`/prossimi 7 smoke casa` → scelta tra 9203 e 9204; tocco `g2:p:9203:1ol49qr:7` → lista 7 giorni; `/prossimi 7 inesistente` → avviso + elenco a pulsanti) (RF-17, RF-19)
- [X] T057 Nella stessa collection, cartella **06** rinominata `06 · /gruppi <nome> (RF-19, BR-26)`: `/gruppi smoke lavoro` → scheda; `/gruppo smoke lavoro` → identica; `/gruppi casa` → scelta; `/gruppi pippo` → avviso + elenco; `/gruppi` → elenco a pulsanti
- [X] T058 Nella stessa collection, cartella **16** rinominata `16 · Gruppi (/gruppi, g2:*)` (RF-07, FR-005, FR-006a, FR-017): `g2:n` → crea "Postman Amici"; "🏖" → rifiutato; `g2:o` → scheda; `g2:r` → rinomina (DB: `name` aggiornato) e scheda nuova; `g2:r` con hash vecchio → `Il gruppo non esiste più.`; `g2:x` → conferma → Sì (DB: gruppo assente, persone presenti); `g:r` e `f:{{flowId}}:sg:…` → "Questa azione non è più disponibile"
- [X] T059 [P] In `postman/README.md` voce di Changelog 2.1.0: cartelle 02, 04, 06, 16 aggiornate, gruppi 9203/9204 nel seed, `nameHash` nello script di collection
- [X] T060 Gate di qualità: `npm run typecheck` (zero errori), `npm test` (tutto verde), `npm run bench` (casi T053 ≤ 3 ms); ricerca nel repo che non restino riferimenti a `showGruppo`, `startGruppi`, `groupLookupStatements`, `"g:n"`, `"g:r"`, `"g:x"`, step `scelta`/`conferma` del flusso `gruppi`
- [ ] T061 Smoke manuale secondo quickstart.md §5: `scripts/smoke-postman.ps1`, runner della collection 2.1.0 in ordine, controlli nella chat Telegram delle cartelle 02, 04, 06, 16

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: nessuna dipendenza.
- **Phase 2 (Dominio)**: dipende da T001. Blocca tutto il resto.
- **Phase 3 (Accesso ai dati)**: dipende da T001 e, per l'ordine richiesto, segue la Phase 2 (non
  usa le funzioni di dominio). Blocca le viste.
- **Phase 4 (US2)**: dipende da Phase 2 e 3.
- **Phase 5 (US1)**: dipende da Phase 4 (riusa `showGroups`, `showGroupCard`, `renderGroupList`, `g2:o`).
- **Phase 6 (US3)**: dipende da Phase 4 (`renderGroupList`, `replyGroupGone`, `handleGroupCallback`)
  e da T029 (testi della ricerca).
- **Phase 7 (Menu)**: dipende da T009 (`nameHash`) e T015; indipendente dalle viste, ma eseguita
  dopo come da ordine richiesto.
- **Phase 8 (Polish)**: dipende da tutte le precedenti.

### Dipendenze puntuali

- T002 → T003 (stesso file); T004 → T005 (stesso file).
- T008 → T009 → T010, T012; T011 indipendente dai task di `text.ts`.
- T019 → T021, T022; T020 → T022; T013, T014 → T022; T013, T014 → T023; T022 → T023 → T024 → T025 → T026 → T027.
- T029 → T030 → T031 → T032; T034 → T035 → T036.
- T037 → T038; T039, T040, T015 → T041 → T042.
- T043 dopo T032, T034 (ultimi chiamanti dei testi rimossi).
- T054 → T055 → T056 → T057 → T058 (stesso file della collection dopo il seed).
- T060 → T061.

### Test che falliscono di proposito tra le fasi

Fino alla Phase 8 alcuni test MVP falliscono perché descrivono il comportamento di prima (vecchi
casi `g:*` in `callback-data.test.ts` dopo T027, US6 di 001, `/gruppo` di 003, FR-010 di
`/prossimi`, `/aiuto`). È l'effetto dell'ordine richiesto ("infine aggiornamento dei test
esistenti"): durante le fasi intermedie si eseguono i file della fase in corso
(`npm test -- <file>`), la suite completa deve essere verde solo a T060.

---

## Parallel Example

```text
# Phase 2 — test unitari su file diversi:
T002 test/unit/text.test.ts        (groupKey)
T004 test/unit/viste-parse.test.ts (findGroups, sortGroups)
T006 test/unit/callback-data.test.ts (g2)
T007 test/unit/import.test.ts      (FR-006a)

# Phase 3 — accesso ai dati:
T013 src/db/groups.ts
T014 src/db/viste.ts
T015 src/db/settings.ts

# Phase 8 — test esistenti e supporti:
T044 us6-gruppi · T045 us5-gruppo-mese · T046 us2-prossimi · T047 us7-start-aiuto
T048 callback-data · T050 budget · T051 viste-budget · T052 ciclo-budget · T053 bench · T054 seed · T059 README
```

---

## Implementation Strategy

### MVP (US2 + US1, entrambe P1)

1. Phase 1–3: costanti, dominio BR-26 con test, accesso ai dati.
2. Phase 4 (US2): elenco a pulsanti e scheda gruppo → validare con T016–T018.
3. Phase 5 (US1): ricerca morbida → validare con T028. È la revisione più urgente (AFU, "Ordine di
   realizzazione consigliato"), ma ha bisogno di elenco e scheda.
4. **STOP e VALIDATE**: `/gruppi`, `/gruppi <testo>`, Rinomina ed Elimina dalla scheda.

### Incremental Delivery

1. MVP (US2 + US1) → 2. US3 (`/prossimi`) → 3. menu comandi → 4. test MVP aggiornati, budget,
   bench, smoke Postman → deploy con `scripts/deploy.ps1` (nessuna migration).

---

## Notes

- [P] = file diversi e nessuna dipendenza da task incompleti; i task sullo stesso file sono sempre
  sequenziali.
- Ogni task cita gli ID AFU/FR: riportarli nei titoli dei test e nei commenti del codice toccato.
- Commit dopo ogni gruppo logico, senza righe di attribuzione (regole globali).
- Dopo il deploy: verificare entro un'ora `SELECT value FROM settings WHERE key = 'bot_commands'`
  (quickstart §6).
