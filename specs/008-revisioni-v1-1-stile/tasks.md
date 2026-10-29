---

description: "Task list della feature 008 — Revisioni v1.1, guida di stile (RNF-19)"
---

# Tasks: Revisioni v1.1 — Guida di stile

**Input**: documenti di design in `specs/008-revisioni-v1-1-stile/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/testi.md](contracts/testi.md), [quickstart.md](quickstart.md)

**Tests**: richiesti (constitution X, research R-08, SC-001/SC-002). Ogni area di testi ha il suo task di aggiornamento dei test esistenti e le sue voci nell'inventario eseguibile.

**Organizzazione**: i task sono raggruppati per **area di testi**, e ogni area sta nella fase della user story che la contiene. Ogni task cita RNF-19 e le chiavi di `src/texts.ts` che tocca; i testi nuovi esatti sono quelli di [contracts/testi.md](contracts/testi.md) (colonna "Testo nuovo"), da copiare senza variazioni.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1, US2, US3)

## Mappa area → user story

| Area di testi | User story | Fase |
|---|---|---|
| Scheda e gruppi | US1 — Inserimento e scheda (P1) | 3 |
| Flussi guidati (inserimento, Modifica, `/messaggio`) | US1 — Inserimento e scheda (P1) | 3 |
| Liste e viste | US2 — Liste e viste (P1) | 4 |
| Benvenuto e aiuto | US3 — Promemoria, conferme, avvisi ed errori (P2) | 5 |
| Promemoria | US3 | 5 |
| Import/export/backup | US3 | 5 |
| Stato e statistiche | US3 (solo verifica, FR-018) | 5 |
| Errori comuni | US3 | 5 |

## Regole valide per tutti i task

- Testi **solo** in `src/texts.ts` (RNF-15); fuori da quel file cambiano solo i 4 punti di cablaggio di research R-01 (`src/bot/scheda.ts`, `src/bot/flows/nuovo.ts`, `src/bot/flows/modifica.ts`, `src/bot/flows/elimina.ts`).
- **Non toccare**: `src/telegram/keyboard.ts`, codec dei `callback_data`, `src/db/`, `src/domain/`, `src/cron/`, `migrations/`, `DEFAULT_BIRTHDAY_MESSAGE` in `src/config.ts`, `CSV_EXAMPLE_ROW`, `CSV_COLUMNS`, `BOT_COMMANDS`, nomi dei file e formato JSON del backup (FR-006, FR-016, FR-019, FR-020, research R-05).
- **Test esistenti** (research R-08): ogni stringa letterale che duplica un testo del bot diventa la chiave di `T` (`toBe(T.askFullName)`, `toContain(T.summaryTitle)`, `tap(deps, T.btnSkip)`, `T.personSaved("Marchino")`); i dati dell'utente (nomi, nickname, messaggi personalizzati) restano letterali; scenari e logica dei test non cambiano (SC-006).
- **Letterali** solo in `test/integration/v11-stile.test.ts` (mockup §5 e criteri di RNF-19, SC-002).
- **Inventario** (FR-004a): ogni area aggiunge in `test/unit/testi.test.ts` le sue chiavi con il tipo di [contracts/testi.md](contracts/testi.md) (T, D, C, A, E, I, F, R, PA, PC); le regole per tipo sono quelle predisposte in T002.
- Per trovare le asserzioni da riscrivere: `grep -rn "<testo attuale>" test/` per ciascun testo attuale della tabella del contratto.

---

## Phase 1: Setup

**Purpose**: base di partenza verde e misurata

- [X] T001 Eseguire `npm run typecheck` e `npm test` dalla radice e verificare che siano verdi prima di ogni modifica (SC-006, baseline per RNF-19); l'esito serve da confronto al checkpoint di ogni area, nessun file da modificare

---

## Phase 2: Foundational (prerequisiti bloccanti)

**Purpose**: l'infrastruttura di test dell'inventario e dei mockup, condivisa da tutte le aree

**⚠️ CRITICAL**: nessuna area può iniziare prima di questa fase

- [X] T002 Creare `test/unit/testi.test.ts` (RNF-19, FR-004a, SC-001, SC-003, SC-004, SC-005): (a) costante `INVENTARIO: Record<string, Tipo>` vuota, con `type Tipo = "T" | "D" | "C" | "A" | "E" | "I" | "F" | "R" | "PA" | "PC"`, che le aree riempiono; (b) helper `testoDi(chiave)` che risolve chiavi annidate (`editAsk.n`, `fieldLabels.*`, `rowReason.*`) e invoca le funzioni di `T` con gli argomenti della mappa `ESEMPI: Record<string, readonly unknown[]>`, una voce per ogni chiave funzione: stringhe senza emoji (`"Marco Rossi"`, `"Marchino"`, `"14/03"`), numeri (`3`), un `Counts` (`{ persons: 3, groups: 2, occurrences: 5 }`), `LocalClock`/`LocalDate` del 29/10/2026, booleani `false`, array (`["2026 87%"]`). Una funzione senza voce in `ESEMPI` fa fallire il test. Se il risultato è un array (es. `yearCounts`), i controlli valgono per ogni elemento; (c) helper `iniziaConEmoji(s)` basato su `/^\p{Extended_Pictographic}/u` e `contieneEmoji(s)` su `/\p{Extended_Pictographic}/u`; (d) test parametrici per tipo, iterati su `INVENTARIO`: T → `iniziaConEmoji`; D → inizia con l'icona della mappa chiusa di FR-007 (👤 💬 🎂 📱 📸 ✈️ 👥 ⭐ ✍️ 📋 ✏️ 💾), eccezione esplicita `confirmDate`; C → contiene 🎉 o ✅, con un'eccezione esplicita: `welcome` deve contenere 👋 (FR-013, RNF-19); A → inizia con ⚠️; E → inizia con ❌; I → non contiene 🎉 ✅ ⚠️ ❌; R → `!contieneEmoji`; PA → contiene un'emoji solo se la chiave è in `["btnEdit","btnRename","btnDelete","btnDeleteGroup","btnSkip","btnNewGroup","btnOutcomeDone"]` (FR-009); PC → `!contieneEmoji`; (e) test di esclusione: `DEFAULT_BIRTHDAY_MESSAGE === "Tanti auguri {nome}! 🎉"` (A-06, FR-020), `CSV_EXAMPLE_ROW` uguale al valore attuale copiato letteralmente, nessuna `description` di `BOT_COMMANDS` con emoji (§5.1); (f) il test "100% delle chiavi di `T` classificate" scritto ma marcato `it.todo`, da attivare in T029
- [X] T003 [P] Creare `test/integration/v11-stile.test.ts` (RNF-19, SC-002) con lo stesso setup dei test di integrazione esistenti (D1 locale, fake Telegram, `now` iniettato, helper `tap`/`send` come in `test/integration/us2-inserimento.test.ts`) e un `describe` vuoto per ciascun mockup: §5.2, §5.3-§5.5, §5.6, §5.7, §5.8, §5.9, criteri di RNF-19; le aree aggiungono gli scenari

**Checkpoint**: suite verde (i nuovi file non hanno ancora casi falliti)

---

## Phase 3: User Story 1 — Inserimento e scheda con il nuovo tono (Priority: P1) 🎯 MVP

**Goal**: domande con l'icona del campo, "⏭ Salta", conferma "🎉 Fatto! {name} è in rubrica." nello stesso messaggio della scheda, scheda con 👤 e 🎂, pulsanti "✏️ Modifica" e "🗑 Elimina", testi dei gruppi conformi a §5.9.

**Independent Test**: un inserimento completo e uno saltando i facoltativi, una Modifica di ogni campo, un'eliminazione, la creazione/rinomina/eliminazione di un gruppo: icone delle domande, etichette dei pulsanti, conferme e scheda coincidono con §5.2, §5.6, §5.9.

### Area "Scheda e gruppi"

- [X] T004 [US1] Scheda persona in `src/texts.ts` (RNF-19, FR-011, §5.6): sostituire `schedaNickname` con `schedaTitle(name: string, nickname: string | null)` → `👤 {name} — "{nickname}"`, senza nickname `👤 {name}`; aggiungere `schedaDate(date: string, when: string)` → `🎂 {date} · {when}`; `btnEdit` → "✏️ Modifica"; `btnDelete` → "🗑 Elimina"; `confirmDeletePerson` → "⚠️ Vuoi eliminare {name}? Perderai anche il suo storico."; `personDeleted` da stringa a funzione `(name: string)` → "✅ Ho eliminato {name}."; verificare invariati `schedaAge`, `schedaNoAge`, `schedaPriority`, `schedaGroups`, `schedaPhone`, `schedaMessageStandard`, `schedaMessageCustom`, `schedaHistory`, `outcome` (FR-005, FR-006)
- [X] T005 [US1] Cablaggio della scheda e dell'eliminazione (RNF-19, FR-008, FR-011, research R-01; chiavi `schedaTitle`, `schedaDate`, `personDeleted`): in `src/bot/scheda.ts` `schedaLines` usa `T.schedaTitle(p.fullName, p.nickname)` e `T.schedaDate(formatShort(...), when)` al posto della composizione locale; `showScheda(ctx, personId, confirm?: (name: string) => string)` antepone `confirm(nickname ?? fullName)` seguito da `\n\n` alla scheda (stesso `reply`, nessuna query in più); in `src/bot/flows/elimina.ts` `reply(ctx, T.personDeleted(data(state).name))`; `npm run typecheck` verde (dipende da T004)
- [X] T006 [US1] Gruppi in `src/texts.ts` (RNF-19, FR-017, §5.9): `groupCardEmpty` → "Nel gruppo non c'è ancora nessuno."; `groupGone` → "❌ Questo gruppo non esiste più."; `groupNoMatch` → "🔍 Nessun gruppo corrisponde a «{q}»."; `groupKeyTooShort` → "❌ Il nome del gruppo deve avere almeno 2 lettere o cifre."; `noGroups` → "👥 Non hai ancora nessun gruppo."; `askRenameTo` → "👥 Nuovo nome per il gruppo {name}?"; `confirmDeleteGroup` → prima frase "⚠️ Vuoi eliminare il gruppo {name}?" (seconda frase invariata); `groupCreated` → "✅ Ho creato il gruppo {name}."; `groupRenamed` → "✅ Ho rinominato il gruppo in {name}."; `groupDeleted` → "✅ Ho eliminato il gruppo {name}."; verificare invariati `groupsTitle`, `groupButton`, `groupLine`, `groupsTypeName`, `groupCardTitle`, `groupsMany`, `btnRename`, `btnDeleteGroup` (dipende da T004 per l'ordine sul file)
- [X] T007 [P] [US1] Aggiornare i test esistenti dell'area scheda e gruppi alle costanti di `T` (RNF-19, SC-006; chiavi `schedaTitle`, `schedaDate`, `btnEdit`, `btnDelete`, `confirmDeletePerson`, `personDeleted`, `groupCardEmpty`, `groupGone`, `groupNoMatch`, `groupKeyTooShort`, `noGroups`, `askRenameTo`, `confirmDeleteGroup`, `groupCreated`, `groupRenamed`, `groupDeleted`): `test/integration/us3-scheda.test.ts`, `test/integration/us5-eliminazione.test.ts`, `test/integration/us5-storico.test.ts`, `test/integration/us6-gruppi.test.ts`, `test/integration/v11-gruppi-ricerca.test.ts`, `test/unit/scheda.test.ts` (titolo 👤 e riga 🎂 via `T.schedaTitle`/`T.schedaDate`); i nomi dei gruppi con emoji restano letterali (FR-021) (dipende da T005, T006)
- [X] T008 [US1] Inventario e mockup dell'area scheda e gruppi (RNF-19, FR-004a, SC-002): in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` tutte le chiavi delle sezioni "Scheda persona", "Eliminazione" e "Gruppi" di [contracts/testi.md](contracts/testi.md) con il loro tipo (es. `schedaTitle: "T"`, `schedaDate: "F"`, `btnEdit: "PA"`, `confirmDeletePerson: "A"`, `personDeleted: "C"`, `groupLine: "R"`, `groupNoMatch: "T"`, `groupCardEmpty: "F"`, `groupsTypeName: "I"`); in `test/integration/v11-stile.test.ts` scenari letterali §5.6 (scheda con `👤 Marco Rossi — "Marchino"`, riga `🎂 14/03/1994 · compie …`, priorità e gruppi senza emoji, pulsanti `✏️ Modifica` e `🗑 Elimina`, pulsanti di contatto senza icona) e §5.9 (`👥 I tuoi gruppi`, `👥 <nome> · N persone`, `🔍 Più gruppi corrispondono a «…»:`, conferma ✅ e richiesta ⚠️ di eliminazione); un gruppo con emoji nel nome compare identico (FR-021) (dipende da T007)

### Area "Flussi guidati"

- [X] T009 [US1] Inserimento guidato in `src/texts.ts` (RNF-19, FR-007, FR-008, FR-009, §5.2): `askFullName` → "👤 Come si chiama? Nome e cognome"; `askNickname` → "💬 Come lo chiami nei messaggi? (nickname)"; `askBirthDate` → "🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno"; `invalidDate` → "❌ Data non valida. Usa gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994)."; `invalidPhone` → "❌ Numero non valido. Scrivilo con il prefisso, es. +39 333 1234567"; `contactWithoutPhone` → "❌ Questo contatto non ha un numero di telefono: scrivilo tu."; `askInstagram` → "📸 Username Instagram?"; `askTelegram` → "✈️ Username Telegram?"; `askGroups` → "👥 Gruppi?"; `askNewGroupName` → "👥 Come si chiama il nuovo gruppo?"; `groupExists` → "❌ Hai già un gruppo con questo nome: scegline un altro."; `askPriority` → "⭐ Priorità?"; `askMessage` → "✍️ Messaggio di auguri personalizzato? Se salti uso quello standard."; `summaryTitle` → "📋 Riepilogo:"; `possibleDuplicate` → "⚠️ Hai già {name} con data {date}: potrebbe essere un duplicato. Vuoi salvarlo comunque?"; `tooLong` → "❌ Testo troppo lungo: al massimo {max} caratteri."; `emptyValue` → "❌ Il valore non può essere vuoto."; `btnSkip` → "⏭ Salta"; nuova `personSaved(name: string)` → "🎉 Fatto! {name} è in rubrica."; verificare invariati `confirmDate`, `askPhone`, `confirmPhone`, `btnNewGroup`, `btnHigh`, `btnMedium`, `btnLow`, `selected`, `groupToggle`, `btnSave`, `btnSaveAnyway`, `btnYes`, `btnFix`, `btnDone`, `btnClear` (dipende da T006 per l'ordine sul file)
- [X] T010 [US1] Modifica e `/messaggio` in `src/texts.ts` (RNF-19, FR-007, FR-004, A-06): `editWhichField` → "✏️ Quale campo vuoi modificare?"; `editAsk.n` → "👤 Nuovo nome completo?"; `editAsk.k` → "💬 Nuovo nickname?"; `editAsk.d` → "🎂 Nuova data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno"; `editAsk.p` → "📱 Nuovo telefono? …" (resto invariato); `editAsk.i` → "📸 Nuovo username Instagram?"; `editAsk.t` → "✈️ Nuovo username Telegram?"; `editAsk.m` → "✍️ Nuovo messaggio di auguri personalizzato?"; nuova `personUpdated(name: string)` → "✅ Ho aggiornato {name}."; `greetingAsk` → "✍️ Messaggio attuale: «{current}»…" (resto invariato); `greetingPreview` → "✍️ Anteprima: «{text}»…" (resto invariato); `greetingSaved` → "✅ Ho aggiornato il messaggio di auguri."; `greetingTooLong` → "❌ Il messaggio può avere al massimo …" (resto invariato); verificare invariati `fieldLabels.*`, `btnConfirm`, `sampleName`; `{current}` e `{text}` mostrati esattamente come salvati (FR-006) (dipende da T009)
- [X] T011 [US1] Cablaggio delle conferme di salvataggio e modifica (RNF-19, FR-008, research R-01; chiavi `personSaved`, `personUpdated`): in `src/bot/flows/nuovo.ts` `save` chiama `showScheda(ctx, inserted.last_row_id, T.personSaved)`; in `src/bot/flows/modifica.ts` i due `showScheda` (campi, riga ≈101; gruppi, riga ≈260) diventano `showScheda(ctx, …, T.personUpdated)`; `npm run typecheck` verde (dipende da T005, T010)
- [X] T012 [P] [US1] Aggiornare i test esistenti dei flussi guidati alle costanti di `T` (RNF-19, SC-006; chiavi `askFullName`, `askNickname`, `askBirthDate`, `invalidDate`, `invalidPhone`, `contactWithoutPhone`, `askInstagram`, `askTelegram`, `askGroups`, `askNewGroupName`, `groupExists`, `askPriority`, `askMessage`, `summaryTitle`, `possibleDuplicate`, `tooLong`, `emptyValue`, `btnSkip`, `personSaved`, `editWhichField`, `editAsk.*`, `personUpdated`, `greetingAsk`, `greetingPreview`, `greetingSaved`, `greetingTooLong`): `test/integration/us2-inserimento.test.ts` (compresi tutti i `tap(deps, "Salta")` → `tap(deps, T.btnSkip)` e "Riepilogo:" → `T.summaryTitle`), `test/integration/us4-modifica.test.ts`, `test/integration/us6-modifiche.test.ts`, `test/integration/us4-messaggio.test.ts` (il messaggio salvato tra « » resta letterale), `test/integration/us1-reminder.test.ts` (solo la domanda del nickname), `test/integration/budget.test.ts`, `test/integration/viste-budget.test.ts`, `test/unit/greeting.test.ts`; dopo salvataggio e modifica asserire che il messaggio inizi con `T.personSaved(nome)` / `T.personUpdated(nome)` seguito dalla scheda (dipende da T011)
- [X] T013 [US1] Inventario e mockup dell'area flussi guidati (RNF-19, FR-004a, FR-007, SC-001, SC-002): in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` tutte le chiavi delle sezioni "Inserimento guidato", "Modifica" e "`/messaggio`" di [contracts/testi.md](contracts/testi.md) (es. `askFullName: "D"`, `confirmDate: "D"`, `selected: "F"`, `btnSkip: "PA"`, `possibleDuplicate: "A"`, `personSaved: "C"`, `editAsk.p: "D"`, `fieldLabels.*: "PA"`), più un test che la stessa icona apra la domanda in inserimento e in Modifica (`askFullName`/`editAsk.n` 👤, `askNickname`/`editAsk.k` 💬, `askBirthDate`/`editAsk.d` 🎂, `askPhone`/`editAsk.p` 📱, `askInstagram`/`editAsk.i` 📸, `askTelegram`/`editAsk.t` ✈️, `askMessage`/`editAsk.m` ✍️); in `test/integration/v11-stile.test.ts` scenario letterale §5.2 (domande `👤 Come si chiama? Nome e cognome` … `📸 Username Instagram?`, pulsante `⏭ Salta`, `📋 Riepilogo:`, conferma `🎉 Fatto! Marchino è in rubrica.` nello stesso messaggio della scheda — criterio 1 di RNF-19) e un messaggio personalizzato con emoji mostrato identico nella scheda e in `/messaggio` (FR-006) (dipende da T008, T012)

**Checkpoint**: `npm run typecheck` e `npm test` verdi; US1 verificabile da sola con l'Independent Test (MVP)

---

## Phase 4: User Story 2 — Liste e viste con l'emoji solo nell'intestazione (Priority: P1)

**Goal**: ogni intestazione e vista vuota di `/oggi`, `/prossimi`, `/mese`, `/cerca`, `/scaduti`, `/anno` inizia con l'emoji di sezione di research R-02; le righe restano senza emoji e allineate.

**Independent Test**: aprire ogni vista con e senza risultati; l'intestazione inizia con l'emoji della vista e nessuna riga contiene emoji aggiunte dal bot.

### Area "Liste e viste"

- [X] T014 [US2] Viste in `src/texts.ts` (RNF-19, FR-002, FR-003, FR-014, §5.7, research R-02): `todayNone` → "🎂 Oggi non ci sono compleanni. Il prossimo:"; `todayNoPersons` → "🎂 Oggi non ci sono compleanni e la rubrica è ancora vuota."; `todayOthers` → "🎂 Altri compleanni di oggi:"; `upcomingHeader` → "📆 Prossimi N giorni ({group})" / "📆 Prossimo giorno"; `upcomingNone` → "📆 Nessun compleanno nei prossimi N giorni ({group})"; `upcomingDaysRange` → "❌ Il numero di giorni deve essere tra 1 e {max}."; `searchHeader` → "🔍 Risultati per «{q}»"; `searchNone` → "🔍 Nessun risultato per «{q}»"; `monthHeader` → "🗓 Compleanni di {mese} {anno}"; `monthNone` → "🗓 Nessun compleanno a {mese}"; `monthInvalid` → "❌ Mese non riconosciuto: … da 1 a 12."; `overdueHeader` → "⏳ Ultimi N giorni, non fatti"; `overdueNone` → "⏳ Nessun compleanno in sospeso negli ultimi N giorni"; `yearHeader` → "🗂 Riepilogo {y}"; `yearInvalid` → "❌ Anno non valido: scrivi un anno tra {min} e {max}."; verificare invariati `listOutcome`, `searchUsage`, `btnMarkDone`, `yearCounts`, `yearSkipped`, `yearStreak`, `yearNone`, `MONTHS_IT`, `WEEKDAYS_IT`, `MONTHS_SHORT`; nessuna modifica a `formatListLine`
- [X] T015 [P] [US2] Aggiornare i test esistenti delle liste e viste alle costanti di `T` (RNF-19, SC-003, SC-006; chiavi `todayNone`, `todayNoPersons`, `todayOthers`, `upcomingHeader`, `upcomingNone`, `upcomingDaysRange`, `searchHeader`, `searchNone`, `monthHeader`, `monthNone`, `monthInvalid`, `overdueHeader`, `overdueNone`, `yearHeader`, `yearInvalid`): `test/integration/us1-oggi.test.ts`, `test/integration/us2-prossimi.test.ts`, `test/integration/us3-cerca.test.ts`, `test/integration/us4-scaduti.test.ts`, `test/integration/us5-gruppo-mese.test.ts`, `test/integration/us6-anno.test.ts`, `test/integration/viste-budget.test.ts`, `test/unit/liste.test.ts` (le righe attese restano identiche, allineamento invariato) (dipende da T014)
- [X] T016 [US2] Inventario e mockup dell'area liste e viste (RNF-19, FR-003, FR-004a, FR-014, SC-002, SC-003): in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi della sezione "Viste e ricerche" di [contracts/testi.md](contracts/testi.md) (es. `upcomingHeader: "T"`, `upcomingNone: "T"`, `listOutcome: "F"`, `yearCounts: "F"`, `searchUsage: "I"`, `upcomingDaysRange: "E"`, `btnMarkDone: "PA"`), un test che ogni vista vuota inizi con la stessa emoji della sua intestazione (📆, 🗓, 🔍, ⏳, 🎂) e un test che `formatListLine` non produca emoji per una persona senza emoji nel nome; in `test/integration/v11-stile.test.ts` scenario letterale §5.7 (`📆 Prossimi 30 giorni (Famiglia)` seguito da righe `Gio 30/10  Anna (28)      /p_4` senza emoji — criterio 2 di RNF-19), una lista divisa in più messaggi con l'emoji solo nell'intestazione del primo (003 FR-005) e un nome con emoji mostrato identico nella riga (FR-021) (dipende da T013, T015)

**Checkpoint**: suite verde; US1 e US2 verificabili ognuna da sola

---

## Phase 5: User Story 3 — Promemoria, conferme, avvisi ed errori riconoscibili (Priority: P2)

**Goal**: benvenuto con 👋, `/aiuto` con 📖, promemoria come §5.3-§5.5, import/export/backup con le emoji di sezione e 🎉/✅/⚠️/❌, `/stato` e `/statistiche` verificati invariati, errori comuni con ❌.

**Independent Test**: per ogni comando provocare un successo, un avviso e un errore (data non valida, possibile duplicato, CSV con errori, backup non valido, eliminazione di un gruppo) e verificare l'emoji iniziale; ricevere pre-reminder, reminder e recupero e confrontarli con §5.3-§5.5; `/start` contiene 👋.

### Area "Benvenuto e aiuto"

- [X] T017 [US3] Benvenuto e aiuto in `src/texts.ts` (RNF-19, FR-013): `welcome` → "👋 Ciao! Sono il tuo bot dei compleanni: …" (resto invariato); prima riga di `help` → "📖 Ecco cosa posso fare:" (righe dei comandi e ultima riga invariate, senza emoji); verificare invariati `btnAddPerson`, `btnCommands`, `BOT_COMMANDS`
- [X] T018 [US3] Test dell'area benvenuto e aiuto (RNF-19, FR-013, SC-001; chiavi `welcome`, `help`, `btnAddPerson`, `btnCommands`): aggiornare alle costanti di `T` `test/integration/us7-start-aiuto.test.ts` e verificare `test/integration/menu-comandi.test.ts` (invariato, §5.1); in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` `welcome: "C"`, `help: "T"`, `btnAddPerson: "PA"`, `btnCommands: "PA"`, un test che `T.welcome` contenga 👋, che la prima riga di `T.help` inizi con un'emoji e le altre righe no, e che `T.help.length < MESSAGE_MAX_LENGTH` (research R-06); in `test/integration/v11-stile.test.ts` scenario `/start` con 👋 (US3 scenario 5) (dipende da T016, T017)

### Area "Promemoria"

- [X] T019 [US3] Promemoria in `src/texts.ts` (RNF-19, FR-010, FR-012, §5.3-§5.5, research R-04): `reminderTitle` termina con "!" (es. "🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni!"), anche senza età e con la nota del 29/02; verificare invariati `reminderGroups`, `reminderPhone`, `lastYear`, `recoveryTitle`, `preReminder`, `btnWhatsApp`, `btnInstagram`, `btnTelegram`, `btnCopy`, `btnOutcomeDone`, `btnSkipYear`, `btnSkipped`, `outcomeDone`, `outcomeSkipped`, `skippedThisYear` (dipende da T017 per l'ordine sul file)
- [X] T020 [P] [US3] Aggiornare i test esistenti dei promemoria alle costanti di `T` (RNF-19, SC-006; chiavi `reminderTitle`, `recoveryTitle`, `preReminder`, `lastYear`, `btnOutcomeDone`, `btnSkipYear`): `test/integration/us1-reminder.test.ts` (il "!" finale), `test/integration/us2-recupero.test.ts`, `test/integration/us3-pre-reminder.test.ts`, `test/unit/promemoria.test.ts`, più le eventuali asserzioni sul titolo del reminder in `test/integration/scheduled.test.ts` e `test/integration/ciclo-*.test.ts` (trovarle con `grep -rn "Oggi è il compleanno" test/`) (dipende da T019)
- [X] T021 [US3] Inventario e mockup dell'area promemoria (RNF-19, FR-004a, FR-010, FR-012, SC-002, SC-004): in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi della sezione "Promemoria" di [contracts/testi.md](contracts/testi.md) (es. `reminderTitle: "T"`, `preReminder: "T"`, `recoveryTitle: "T"`, `btnWhatsApp: "PC"`, `btnCopy: "PC"`, `btnOutcomeDone: "PA"`, `outcomeDone: "F"`), un test che le etichette dei pulsanti di contatto siano esattamente "WhatsApp", "Instagram", "Telegram", "Copia messaggio" (lunghezza invariata, SC-004) e la nota dell'eccezione "!" di `reminderTitle` (research R-04); in `test/integration/v11-stile.test.ts` scenari letterali §5.3 (reminder con 🎂, 📱, "L'anno scorso: fatto ✅", pulsanti di contatto senza icona, "Fatto ✅", "Salta quest'anno"), §5.4 (📅) e §5.5 (⏰) (dipende da T018, T020)

### Area "Import/export/backup"

- [X] T022 [US3] Documenti, modello e import in `src/texts.ts` (RNF-19, FR-004, FR-015, FR-016, §5.8): `fileTooBigTelegram` → "❌ Il file è troppo grande: Telegram mi lascia ricevere file fino a 20 MB."; `fileTooBig` → "❌ Il file è troppo grande: al massimo N MB."; `downloadFailed` → "❌ Non sono riuscito a scaricare il file. Riprova."; `waitingBackupFile` → "💾 Aspetto il file JSON di backup. Usa /annulla per interrompere."; prima riga di `templateCaption` → "📄 Ecco il modello per importare le persone: compilalo al PC e rimandamelo qui." (righe "•" invariate); `csvNotUtf8`, `csvInvalidHeader`, `csvEmpty` con "❌ " in testa (resto invariato); `csvTooManyRows` → "❌ Il file ha più di 200 righe: dividilo in file da al massimo 200 righe."; `previewTitle` → "📥 Anteprima import"; `previewErrors` → "⚠️ N errori:"; `previewShort` → "📥 Anteprima in attesa: …" (resto invariato); `imported` → "🎉 Importate N persone, creati M gruppi."; `becameDuplicates` → "⚠️ N righe sono diventate duplicati e le ho saltate."; `nothingImported` → "⚠️ Non ho importato nessuno: tutte le righe ora sono duplicati."; verificare invariati `useRipristina`, `sendCsv`, `rowReason.*`, `previewNew`, `previewExampleSkipped`, `previewDuplicates`, `previewGroups`, `previewTruncated`, `previewMoreGroups`, `previewDuplicateLine`, `previewErrorLine`, `btnImport`, `CSV_EXAMPLE_ROW`, `CSV_COLUMNS` (dipende da T019 per l'ordine sul file)
- [X] T023 [US3] Export, backup e ripristino in `src/texts.ts` (RNF-19, FR-004, FR-016): `exportCaption` → "📤 Ecco l'export: N persone." (al singolare "1 persona"); `backupCaption` → "💾 Backup: …" (resto invariato, vale per richiesta e mensile); `restoreAsk` → "💾 Inviami il file JSON di backup da ripristinare."; `restoreConfirm1` → "⚠️ Backup del {date}: …" (resto invariato); `restoreDone` → "✅ Ripristino completato: …" (resto invariato); `backupNotJson` → "❌ Il file non è un JSON valido: mandami il file .json del backup."; `backupWrongFormat`, `backupVersion`, `backupInvalidField`, `backupDuplicateId`, `backupInvalidSetting`, `backupDuplicateGroupName`, `backupMissingRef`, `backupDuplicateOccurrence` con "❌ " in testa (resto invariato); verificare invariati `restoreConfirm2`, `btnContinue`, `btnRestore`; nomi dei file e formato JSON invariati (dipende da T022)
- [X] T024 [P] [US3] Aggiornare i test esistenti di import/export/backup alle costanti di `T` (RNF-19, SC-006; chiavi `fileTooBigTelegram`, `fileTooBig`, `downloadFailed`, `waitingBackupFile`, `templateCaption`, `csvNotUtf8`, `csvInvalidHeader`, `csvEmpty`, `csvTooManyRows`, `previewTitle`, `previewErrors`, `previewShort`, `imported`, `becameDuplicates`, `nothingImported`, `exportCaption`, `backupCaption`, `restoreAsk`, `restoreConfirm1`, `restoreDone`, `backupNotJson`, `backupWrongFormat`, `backupVersion`, `backupInvalid*`/`backupDuplicate*`/`backupMissingRef`): `test/integration/us1-import.test.ts`, `test/integration/us1-modello.test.ts`, `test/integration/documenti.test.ts`, `test/integration/import-budget.test.ts`, `test/integration/us4-export.test.ts`, `test/integration/us2-backup.test.ts`, `test/integration/us3-backup-mensile.test.ts`, `test/integration/us2-ripristino.test.ts`, `test/unit/import.test.ts`, `test/unit/backup.test.ts`; le fixture CSV e il contenuto dei file attesi restano identici (FR-016) (dipende da T023)
- [X] T025 [US3] Inventario e mockup dell'area import/export/backup (RNF-19, FR-004a, FR-015, FR-016, SC-002, SC-005): in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi delle sezioni "Documenti ricevuti, modello, import" ed "Export, backup, ripristino" di [contracts/testi.md](contracts/testi.md) (es. `previewTitle: "T"`, `templateCaption: "T"`, `previewErrors: "A"`, `previewErrorLine: "R"`, `imported: "C"`, `restoreConfirm1: "A"`, `restoreConfirm2: "A"`, `restoreDone: "C"`, `backupNotJson: "E"`, `sendCsv: "I"`, `waitingBackupFile: "D"`, `rowReason.*: "F"`), un test che la prima riga di `T.templateCaption` inizi con 📄 e le righe "•" non abbiano emoji, e che `T.templateCaption.length <= DOCUMENT_CAPTION_MAX_LENGTH` (research R-06); in `test/integration/v11-stile.test.ts` scenario letterale §5.8 (`📥 Anteprima import`, `⚠️ N errori:` seguito dalle righe "• riga N: …" senza emoji (struttura come oggi, nota §5.8 del contratto), conferma `🎉 Importate N persone, creati M gruppi`) e un export reimportato senza differenze (004 FR-016) (dipende da T021, T024)

### Area "Stato e statistiche"

- [X] T026 [US3] Verifica dell'area stato e statistiche, senza modifiche a `src/texts.ts` (RNF-19, FR-018, §5.10-§5.12; chiavi `statsTitle`, `statsMonthsTitle`, `statsDone`, `statsPersons`, `statsGroup`, `statsNoGroup`, `statsGroups`, `statsMissing`, `statsYear`, `gapAlert`, `statoTitle`, `statoCron`, `statoToday`, `statoWeek`, `statoBackup`, `statoWebhookOk`, `statoWebhookError`, `statoWebhookUnavailable`, `statoAbandoned`, `statoBackupEsito`, `statoKind`, `statoWhen`, `statoAt`, `neverRecorded`): confermare che `test/integration/v11-stato.test.ts`, `test/integration/v11-statistiche.test.ts`, `test/integration/v11-buco-cron.test.ts`, `test/unit/stato.test.ts`, `test/unit/statistiche.test.ts` passino senza modifiche; in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi con il tipo della sezione "`/statistiche`, avviso di buco, `/stato`" del contratto (`statsTitle: "T"`, `statoTitle: "T"`, `gapAlert: "A"`, `statoAbandoned: "R"`, le righe con icona di §5.10 come `"F"`) (dipende da T025)

### Area "Errori comuni"

- [X] T027 [US3] Errori e informativi comuni in `src/texts.ts` (RNF-19, FR-001a, FR-004, FR-004a, research R-03): `actionUnavailable` → "❌ Questa azione non è più disponibile."; `personNotFound` → "❌ Non trovo questa persona: forse è stata eliminata."; `notUnderstood` → "❌ Non ho capito. Scrivi /aiuto per vedere cosa so fare."; `genericError` → "❌ Qualcosa è andato storto. Riprova tra poco."; `cancelled` → "Ok, ho annullato."; `nothingToCancel` → "Non c'è nessuna operazione da annullare."; verificare invariati `yourId`, `btnCancel`, `btnYes`, `btnFix`, `btnDone`, `btnClear`; `actionUnavailable` e `personNotFound` restano sotto i 200 caratteri dei toast (dipende da T023 per l'ordine sul file)
- [X] T028 [US3] Test dell'area errori comuni (RNF-19, SC-006; chiavi `actionUnavailable`, `personNotFound`, `notUnderstood`, `genericError`, `cancelled`, `nothingToCancel`, `yourId`): trovare con `grep -rn "non è più disponibile\|Persona non trovata\|Non ho capito\|Si è verificato un errore\|Operazione annullata\|Nessuna operazione da annullare" test/` tutte le asserzioni e sostituirle con le costanti di `T` (in particolare `test/integration/us1-accesso.test.ts`, `test/unit/conversation.test.ts` e i test dei flussi e dei callback); in `test/unit/testi.test.ts` aggiungere a `INVENTARIO` le chiavi della sezione "Comuni" del contratto (`actionUnavailable: "E"`, `cancelled: "I"`, `yourId: "I"`, `btnCancel: "PA"` …) e un test che i toast `actionUnavailable` e `personNotFound` siano ≤ 200 caratteri; in `test/integration/v11-stile.test.ts` uno scenario per ciascuna emoji di US3: successo (🎉/✅), avviso (⚠️ possibile duplicato), errore (❌ comando non capito) (dipende da T026, T027)

**Checkpoint**: suite verde; tutte le user story verificabili da sole

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 Attivare in `test/unit/testi.test.ts` il test "100% delle chiavi di `T` classificate" (da `it.todo` a `it`): enumera ricorsivamente le foglie di `T` in notazione a punto (tutti gli oggetti annidati: `editAsk`, `fieldLabels`, `rowReason`, `outcome`, `lastYear`, `listOutcome`, `statoBackupEsito`); in `INVENTARIO` la forma `prefisso.*` si espande in tutte le foglie del prefisso e fallisce se una manca da `INVENTARIO` o se `INVENTARIO` ha una chiave che non esiste più (es. `schedaNickname`) (RNF-19, FR-004a, SC-001); completare le voci mancanti con il tipo di [contracts/testi.md](contracts/testi.md)
- [X] T030 [P] Aggiornare `postman/bot-compleanni.postman_collection.json` (RNF-19, research R-09): le descrizioni "Atteso: …" ai testi nuovi delle chiavi riviste in T004-T027 (es. "Prossimi 30 giorni" → "📆 Prossimi 30 giorni", "Modifica/Elimina" → "✏️ Modifica/🗑 Elimina", "Non ho capito…" → "❌ Non ho capito. Scrivi /aiuto per vedere cosa so fare.", "Nessuna operazione da annullare" → "Non c'è nessuna operazione da annullare."); versione 2.3.0 → 2.4.0 con "feature 001–008" nella descrizione; nessuna richiesta, `callback_data`, `pm.test` o fixture modificata
- [X] T031 [P] Aggiungere in `postman/README.md` la nota della versione 2.4.0 ("feature 008: guida di stile RNF-19, solo descrizioni Atteso")
- [X] T032 Validazione di [quickstart.md](quickstart.md) (RNF-19, SC-005, SC-006): `npm run typecheck`, `npm test`, poi `git diff --stat -- src` che deve mostrare solo `src/texts.ts`, `src/bot/scheda.ts`, `src/bot/flows/nuovo.ts`, `src/bot/flows/modifica.ts`, `src/bot/flows/elimina.ts` (nessuna modifica a `src/telegram/keyboard.ts`, `src/db/`, `src/domain/`, `src/cron/`, `src/config.ts`, `migrations/`)
- [X] T033 Rilettura finale del catalogo `T` in `src/texts.ts` rispetto ai vincoli di FR-001a (RNF-19, SC-007): "tu"/prima persona, oggetto nominato nelle conferme, errori ≤ 2 frasi con rimedio, vuoti e informativi in una frase, niente "Per favore"/"Purtroppo", "!" solo in `welcome`, nelle conferme di successo e in `reminderTitle` (eccezione R-04); ogni testo diverso da [contracts/testi.md](contracts/testi.md) va riallineato al contratto

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza
- **Foundational (Phase 2)**: dopo il Setup; blocca tutte le aree
- **US1 (Phase 3)**, **US2 (Phase 4)**, **US3 (Phase 5)**: dopo la Phase 2. Tutti i task sui testi modificano lo stesso `src/texts.ts` e tutti i task d'inventario lo stesso `test/unit/testi.test.ts` e `test/integration/v11-stile.test.ts`, quindi le aree si eseguono **in sequenza** (T004 → T033); in parallelo solo l'aggiornamento dei test esistenti di un'area con i testi dell'area successiva
- **Polish (Phase 6)**: dopo tutte le aree

### User Story Dependencies

- **US1 (P1)**: nessuna dipendenza da altre storie
- **US2 (P1)**: indipendente nel comportamento; segue US1 solo per l'ordine sui file condivisi
- **US3 (P2)**: indipendente nel comportamento; T028 copre anche asserzioni di errori comuni nei test dei flussi di US1

### Within Each Area

- testi in `src/texts.ts` → cablaggio (solo scheda e flussi guidati) → test esistenti alle costanti di `T` → inventario e mockup
- dopo il task sui testi la suite resta rossa finché il task dei test esistenti dell'area non è completo: chiudere sempre l'area prima di passare oltre

### Parallel Opportunities

- T003 in parallelo con T002 (file diversi)
- I task "test esistenti" [P] (T007, T012, T015, T020, T024) toccano solo file di test dell'area: possono procedere mentre si scrivono i testi dell'area successiva in `src/texts.ts`
- T030 e T031 in parallelo tra loro e con T029

---

## Parallel Example: User Story 1

```text
# Dopo T005 e T006 (testi e cablaggio di scheda e gruppi):
Task: "T007 Aggiornare i test esistenti dell'area scheda e gruppi alle costanti di T"
Task: "T009 Inserimento guidato in src/texts.ts"            # file diverso, procede in parallelo

# Dopo T011:
Task: "T012 Aggiornare i test esistenti dei flussi guidati alle costanti di T"
Task: "T014 Viste in src/texts.ts"                           # area successiva (US2)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 e Phase 2
2. Phase 3 (aree "Scheda e gruppi" e "Flussi guidati")
3. **STOP and VALIDATE**: Independent Test di US1 e criterio 1 di RNF-19 (conferma del salvataggio) verdi
4. Deploy se si vuole rilasciare subito il flusso più usato

### Incremental Delivery

1. Setup + Foundational
2. US1 → validare → (deploy)
3. US2 → criterio 2 di RNF-19 (emoji solo nell'intestazione) → (deploy)
4. US3 area per area (benvenuto e aiuto, promemoria, import/export/backup, stato e statistiche, errori comuni) → (deploy)
5. Polish: inventario al 100%, Postman 2.4.0, quickstart

---

## Notes

- I testi nuovi esatti sono solo in [contracts/testi.md](contracts/testi.md): in caso di dubbio vale il contratto, non il riassunto nel task
- Nessuna migration, nessuna dipendenza, nessun `callback_data` modificato (FR-019, FR-022)
- Commit a fine area o a fine user story, senza attribuzioni nel messaggio
