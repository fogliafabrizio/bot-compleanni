---

description: "Task list per la feature 006 — Revisioni v1.1, Scheda e contatti"
---

# Tasks: Revisioni v1.1 — Scheda e contatti

**Input**: documenti di progetto in `specs/006-revisioni-v1-1-scheda-contatti/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-11), data-model.md,
contracts/scheda-contatti.md, quickstart.md

**Tests**: OBBLIGATORI (constitution principio X, SC-001). Ogni `describe`/`it` MUST citare l'ID AFU
o FR verificato (principio XI), es. `it("RF-01, BR-25: contatto 393331234567 → conferma +393331234567", …)`.
Dentro ogni fase i test si scrivono per primi e devono fallire prima dell'implementazione. La colonna
"Scenario spec" di quickstart.md §3 indica lo scenario coperto.

**Organization**: ordine a strati richiesto dal proprietario — (1) dominio BR-25 con i test unitari,
(2) tipi Telegram, motore e router, (3) flusso `/nuovo` con la conferma (US2), (4) Modifica →
Telefono con la conferma (US3), (5) tastiera della scheda (US1), (6) testi, test esistenti
aggiornati, (7) smoke Postman e gate. US1 è P1 come US2 ma viene dopo i flussi per scelta del
proprietario; le tre storie restano verificabili in modo indipendente.

**Nota sui testi**: le due chiavi **nuove** (`confirmPhone`, `contactWithoutPhone`) entrano in
`src/texts.ts` nella fase 3, perché i flussi non compilano senza; le **modifiche** ai testi
esistenti (`askPhone`, `editAsk.p`, testo della scheda senza username) e la rimozione di
`schedaInstagram`/`schedaTelegram` stanno nella fase 6, insieme ai test esistenti che le
verificano. Fino alla fase 6 i test esistenti restano verdi senza modifiche, salvo l'adattamento
alla nuova tastiera della scheda (T029).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza da task incompleti)
- **[Story]**: user story di appartenenza (US1, US2, US3 della spec)

## Convenzioni valide per tutti i task

- Valgono le convenzioni di `specs/001…005/tasks.md`: testi solo in `src/texts.ts` (stringhe esatte
  da `contracts/scheda-contatti.md` e research R-08), costanti solo in `src/config.ts` (`+39` =
  `PHONE_DEFAULT_PREFIX`, già presente), log solo con codici e numeri tramite `src/log.ts` — **mai
  il numero, il nome, lo `user_id` o la vCard del contatto** (principio V). Nessun `new Date()` fuori
  da `src/index.ts`. **Nessun `parse_mode`.**
- **Nessuna migration, nessuna dipendenza nuova, nessuna conversione di dati** (FR-013, R-06).
  `normalizePhone` (BR-15) e `normalizeUsername` (BR-16) restano invariate nel comportamento
  (FR-014): BR-25 vale solo per i numeri da contatto condiviso.
- **Funzioni riusate, mai duplicate**: `dateConfirmStep` come modello di `phoneConfirmStep`,
  `textStep`, `optionalField` di `src/bot/flows/nuovo.ts`, `savePatch` di
  `src/bot/flows/modifica.ts`, `goTo`/`repeatStep`/`flowButton` di `src/bot/flows/engine.ts`,
  `showScheda`/`markDone` di `src/bot/scheda.ts`. URL `wa.me`/`ig.me`/`t.me` costruiti **solo** in
  `contactLinks` (principio VIII). La regex E.164 esiste **una sola volta** in `src/domain/phone.ts`.
- `src/domain/phone.ts`, `src/domain/username.ts` e `src/bot/promemoria.ts` restano **puri**
  (nessun import di `cloudflare:*`, `src/db/*`): girano nel bench in Node.
- Nomi degli step esistenti (`telefono`, `valore`, `instagram`, …) **invariati** (FR-016, R-04);
  step nuovi: `telefono_conferma` (`nuovo`), `valore_conferma` (`modifica`). Azioni di conferma `y`
  (Sì) e `c` (Correggi), nessun formato di `callback_data` nuovo.
- I task che modificano lo stesso file tra `src/texts.ts`, `src/bot/flows/steps.ts`,
  `src/bot/scheda.ts`, `test/integration/us2-inserimento.test.ts`,
  `test/integration/us3-scheda.test.ts`, `test/integration/us4-modifica.test.ts`,
  `postman/bot-compleanni.postman_collection.json` non sono [P] tra loro.
- Test di integrazione: D1 locale, `FakeTelegram`, helper `say`/`press`/`send` di
  `test/helpers/send.ts` (+ `shareContact`, T007), `makeDeps({ now })`, seed con `insertPerson` di
  `test/helpers/db.ts`. Solo dati sintetici (principio V).

---

## Phase 1: Dominio — BR-25 (Foundational)

**Purpose**: normalizzazione del numero da contatto, pura e separata da BR-15 (research R-03).

**⚠️ CRITICAL**: blocca le fasi 3 e 4.

- [X] T001 Scrivere in `test/unit/phone.test.ts` un `describe("BR-25, BR-15, SC-005: normalizeContactPhone")` con `it.each` tabellare dei casi di research R-03: `393331234567` → `+393331234567`; `333 1234567` → `+393331234567`; `+41 79 123 45 67` → `+41791234567`; `0041791234567` → `+41791234567`; `(02) 1234-5678` → `+390212345678`; `3933312345678` → `+3933312345678` (Q1); `0212345678x12` → `+021234567812` (Q2); `12345678` → `{ ok: false, reason: "invalid" }`; `+1234567` → `invalid`; `+1234567890123456` → `invalid`; `abc` → `invalid`; `""`, `"   "`, `undefined` → `{ ok: false, reason: "missing" }`. I test devono fallire (funzione assente).
- [X] T002 Aggiungere in `test/unit/phone.test.ts` il test di non regressione `it("FR-014, BR-15: normalizePhone non applica BR-25")`: `normalizePhone("393331234567")` resta `+39393331234567`; i casi BR-15 esistenti del file restano invariati e verdi.
- [X] T003 In `src/domain/phone.ts` estrarre la regola BR-15 in una costante privata del modulo `E164_RE = /^\+\d{8,15}$/` e farla usare da `normalizePhone` senza cambiarne il comportamento (T002 e i test esistenti verdi).
- [X] T004 In `src/domain/phone.ts` implementare ed esportare `normalizeContactPhone(raw: string | undefined): { ok: true; value: string } | { ok: false; reason: "missing" | "invalid" }` (BR-25, FR-009): `raw` assente o vuoto dopo `trim()` → `missing`; `plus = raw.trim().startsWith("+")`; `digits = raw.replace(/\D/g, "")`; regole nell'ordine: `plus` → `+digits`; `digits` inizia per `00` → `+` + resto; 9-10 cifre → `PHONE_DEFAULT_PREFIX + digits` (da `src/config.ts`); ≥ 11 cifre → `+digits`; altrimenti `invalid`; validazione finale con `E164_RE` (non valido → `invalid`). Nessun log. T001 verde.

**Checkpoint**: `npm test -- phone` verde; BR-25 e BR-15 coesistono con la stessa regex.

---

## Phase 2: Tipi Telegram, motore e router (Foundational)

**Purpose**: far arrivare il contatto al flusso giusto (research R-01, R-02; FR-011).

**⚠️ CRITICAL**: blocca le fasi 3 e 4.

- [X] T005 In `src/telegram/types.ts` aggiungere `export interface Contact { phone_number?: string; first_name?: string; last_name?: string; user_id?: number; vcard?: string }` con i commenti di research R-01 (`phone_number` opzionale per FR-009; gli altri campi ignorati, FR-008, V-08) e il campo `contact?: Contact` in `Message`.
- [X] T006 In `test/helpers/updates.ts` aggiungere `contactUpdate(fromId: number, phoneNumber?: string, extra?: Partial<Contact>): Update` sul modello di `photoUpdate` (chat privata, `contact: { first_name: "Contatto", ...(phoneNumber !== undefined ? { phone_number: phoneNumber } : {}), ...extra }`).
- [X] T007 In `test/helpers/send.ts` aggiungere `shareContact(deps: TestDeps, phone?: string, extra?: Partial<Contact>): Promise<Response>` che invia `contactUpdate(OWNER, phone, extra)` come fa `say` (dipende da T006).
- [X] T008 Scrivere in `test/integration/us2-inserimento.test.ts` un `describe("RF-01, FR-011: contatto fuori dallo step telefono")` con: contatto senza flusso attivo → `T.notUnderstood` e nessuna riga in `persons` (001 FR-025a, AFU §2 Out of scope); contatto allo step Nome di `/nuovo` → domanda del nome ripetuta, step invariato (US2-4); contatto in uno step di `/messaggio` → domanda dello step ripetuta con i suoi pulsanti; contatto da un estraneo → nessuna chiamata a Telegram (RF-30). Sono test di **regressione**: passano già oggi (senza flusso il router risponde `T.notUnderstood`, con un flusso `handleFlowText` riceve `text === undefined` e ripete la domanda, research R-02) e devono restare verdi dopo T009–T010.
- [X] T009 In `src/bot/flows/engine.ts` aggiungere a `Step` l'hook opzionale `onContact?(contact: Contact, state: ConversationState, ctx: Ctx): Promise<void>` e la funzione esportata `handleFlowContact(ctx, state, contact)`: step sconosciuto → stesso ramo di `handleFlowText` (`clear` + `T.notUnderstood`); `step.onContact` presente → lo chiama; altrimenti `repeatStep(ctx, state)` (FR-011, 001 FR-018b).
- [X] T010 In `src/bot/router.ts`, `routeMessage`: dopo i rami `msg.document` e `msg.photo` e prima dei comandi, ramo `if (msg.contact)`: con `state` → `handleFlowContact(ctx, state, msg.contact)`; senza → `reply(ctx, T.notUnderstood)`; poi `return`. Il controllo proprietario/chat privata resta prima (RF-30). T008 verde.

**Checkpoint**: un contatto non crea mai una persona e negli step esistenti ripete la domanda; `npm run typecheck` senza errori.

---

## Phase 3: User Story 2 — Telefono da contatto nell'inserimento (Priority: P1) 🎯 MVP

**Goal**: allo step Telefono di `/nuovo` si condivide un contatto, il bot propone il numero BR-25 e
chiede conferma con Sì / Correggi (RF-01, BR-25, V-08, D-24; FR-007…FR-011).

**Independent Test**: `/nuovo` fino al telefono, condividere contatti `393331234567`, `333 1234567`,
`+41 79 123 45 67`, `0041791234567` e `12345`; premere Sì e Correggi; verificare `persons.phone`.

### Tests for User Story 2 ⚠️

- [X] T011 [US2] Scrivere in `test/integration/us2-inserimento.test.ts` un `describe("RF-01, BR-25, V-08: telefono da contatto in /nuovo")` con: US2-1 contatto `393331234567` → `📱 +393331234567, giusto?` con pulsanti `f:<flowId>:y` [Sì] e `f:<flowId>:c` [Correggi]; Sì → domanda Instagram; completato il flusso, `persons.phone = "+393331234567"`; US2-2 contatto `333 1234567` → propone `+393331234567`; US2-3 Correggi → domanda del telefono, `conversation_state.step = "telefono"`, `pendingPhone` assente nei dati, nessun telefono salvato; US2-5 contatto `12345` → `T.invalidPhone` seguito dalla domanda del telefono, step invariato; edge contatto senza `phone_number` → `Questo contatto non ha un numero di telefono` seguito dalla domanda del telefono (FR-009, Q3).
- [X] T012 [US2] Aggiungere in `test/integration/us2-inserimento.test.ts`: US2-7 contatto con `first_name: "Altro"` e `user_id: 999` → dopo Sì e Salva, nome e `telegram` della persona sono quelli scritti nel flusso (FR-008); edge durante la conferma un secondo contatto e il testo `+39 333 7654321` → conferma ripetuta, `pendingPhone` invariato (Q4, FR-011); edge Sì premuto dopo `/annulla` → `Questa azione non è più disponibile` (001 FR-018c); FR-016 stato `nuovo` scritto a mano in `conversation_state` allo step `telefono` senza `pendingPhone` (come prima del rilascio) → il contatto porta alla conferma; SC-004 in ogni test di contatto `persons` non cambia prima di Sì; V-08 contatto con `phone_number: "393331234567"` e `vcard` che contiene `TEL:+41791234567` → la conferma propone solo `+393331234567`.

### Implementation for User Story 2

- [X] T013 [US2] In `src/texts.ts` aggiungere le chiavi nuove (research R-08): `confirmPhone: (n: string) => \`📱 ${n}, giusto?\`` (FR-010) e `contactWithoutPhone: "Questo contatto non ha un numero di telefono"` (FR-009, Q3), vicino a `confirmDate` e `invalidPhone`.
- [X] T014 [US2] In `src/bot/flows/steps.ts` aggiungere `export interface WithPendingPhone { pendingPhone?: string }` e `phoneConfirmStep(opts: { correctStep: string; onConfirm: (phone: string, state: ConversationState, ctx: Ctx) => Promise<void> }): Step` modellato su `dateConfirmStep`: `kind: "buttons"`, `actions: ["y", "c"]`, prompt `T.confirmPhone(pendingPhone)` con `[[flowButton(state, T.btnYes, "y"), flowButton(state, T.btnFix, "c")]]` e **nessun** Annulla; `c` o `pendingPhone` assente → `goTo(ctx, state, opts.correctStep, datiSenzaPendingPhone)`; `y` → `opts.onConfirm(pendingPhone, …)`. Nessun `onContact` (FR-011, Q4) (FR-010, R-04).
- [X] T015 [US2] In `src/bot/flows/steps.ts` aggiungere `phoneContactHandler(confirmStep: string): NonNullable<Step["onContact"]>` comune ai due flussi: `normalizeContactPhone(contact.phone_number)`; `missing` → `repeatStep(ctx, state, T.contactWithoutPhone)`; `invalid` → `repeatStep(ctx, state, T.invalidPhone)`; `ok` → `goTo(ctx, state, confirmStep, { ...state.data, pendingPhone: value })`. Legge solo `phone_number` (FR-008, V-08); nessun log del numero (FR-009, R-04). Dipende da T004, T009, T014.
- [X] T016 [US2] In `src/bot/flows/nuovo.ts`: `NuovoData` acquisisce `pendingPhone?: string`; lo step `telefono` diventa `{ ...optionalField(T.askPhone, validatePhone, (d, v) => ({ ...d, phone: v }), "instagram"), onContact: phoneContactHandler("telefono_conferma") }` (Salta invariato, FR-007); nuovo step `telefono_conferma: phoneConfirmStep({ correctStep: "telefono", onConfirm: (phone, state, ctx) => goTo(ctx, state, "instagram", { ...restoSenzaPendingPhone, phone }) })` (FR-010, RF-01). T011 e T012 verdi.

**Checkpoint**: US2 completa e verificabile da sola; i test esistenti di `/nuovo` restano verdi (testo della domanda ancora invariato).

---

## Phase 4: User Story 3 — Telefono da contatto nella modifica (Priority: P2)

**Goal**: in Modifica → Telefono si condivide un contatto con le stesse regole di US2 (RF-04,
BR-25; FR-012).

**Independent Test**: da `/p_<id>` premere Modifica → Telefono, condividere un contatto, Sì o
Correggi; verificare che cambi solo `phone`.

### Tests for User Story 3 ⚠️

- [X] T017 [US3] Scrivere in `test/integration/us4-modifica.test.ts` un `describe("RF-04, BR-25: telefono da contatto in Modifica")` con: US3-1 Modifica → Telefono, contatto `333 1234567`, Sì → aggiornato solo `phone = "+393331234567"` (gli altri campi della riga `persons` invariati) e scheda rimostrata; US3-2 Correggi → domanda del telefono, step `valore` con `field = "p"`, `phone` salvato invariato; US3-3 Modifica → Instagram, contatto → domanda Instagram ripetuta; US3-4 Telefono → Svuota (test esistente, deve restare verde); edge numero confermato uguale a quello salvato → salvataggio e scheda; edge persona eliminata durante la conferma → `T.personNotFound` (via `savePatch`); FR-016 stato `modifica` scritto a mano allo step `valore` con `{ personId, field: "p", groups: { ids: [], pending: [] } }` e senza `pendingPhone` (come prima del rilascio) → il contatto porta alla conferma.

### Implementation for User Story 3

- [X] T018 [US3] In `src/bot/flows/modifica.ts`: `ModificaData` acquisisce `pendingPhone?: string`; allo step `valore` aggiungere `onContact`: se `data(state).field === "p"` → `phoneContactHandler("valore_conferma")`, altrimenti `repeatStep(ctx, state)` (US3-3); nuovo step `valore_conferma: phoneConfirmStep({ correctStep: "valore", onConfirm: (phone, state, ctx) => savePatch(ctx, state, { phone }) })`; con Correggi `field` resta `"p"`. Svuota (`z`) invariato (FR-012, 001 FR-015). T017 verde.

**Checkpoint**: US2 e US3 funzionano; i test esistenti di Modifica restano verdi.

---

## Phase 5: User Story 1 — Pulsanti di contatto nella scheda (Priority: P1)

**Goal**: la tastiera della scheda ha la riga [WhatsApp] [Instagram] [Telegram] (WhatsApp senza
testo), poi [Segna fatto], poi [Modifica] [Elimina]; nessun "Copia messaggio" (RF-03, RF-11, D-27;
FR-002…FR-006).

**Independent Test**: aprire `/p_<id>` con persone con tutti, alcuni o nessun contatto, con e senza
occorrenza in sospeso; verificare ordine e URL dei pulsanti.

### Tests for User Story 1 ⚠️

- [X] T019 [P] [US1] Scrivere in `test/unit/username.test.ts` un `describe("FR-002, Q5: username validi per il link")`: `isInstagramLinkable` vero per `marco.rossi`, `m_r`, 30 caratteri; falso per `marco rossi`, `màrco`, 31 caratteri, `""`; `isTelegramLinkable` vero per `mrossi`, 32 caratteri; falso per `abc`, `marco.rossi`, 33 caratteri, `màrco1`.
- [X] T020 [P] [US1] Scrivere in `test/unit/promemoria.test.ts`: `describe("RF-11, FR-004, D-27: contactLinks")` — `contactLinks(p, null)` → WhatsApp `https://wa.me/393331234567` **senza** `?text=`; `contactLinks(p, "Auguri!")` → con `?text=Auguri!` codificato; Instagram `https://ig.me/m/<u>`, Telegram `https://t.me/<u>`; username non validi omessi; nessun contatto → `[]`; `it("FR-006: etichette senza icone")` su `T.btnWhatsApp`, `T.btnInstagram`, `T.btnTelegram`, `T.btnCopy` (nessun carattere emoji); `it("FR-005, FR-017: renderGiorno/renderRecupero invariati")` — tastiere con WhatsApp `?text=` e Copia messaggio come prima, salvo i pulsanti con username non valido assenti (FR-002).
- [X] T021 [P] [US1] Scrivere in `test/unit/scheda.test.ts` un `describe("RF-03, FR-002, FR-005: schedaKeyboard")` con la nuova firma `schedaKeyboard(personId, contacts, hasPending)`: tutti i contatti + pending → righe `[WhatsApp, Instagram, Telegram]`, `[Segna fatto]`, `[Modifica, Elimina]`; nessun contatto → prima riga `[Modifica, Elimina]`; solo telefono → riga `[WhatsApp]`; URL esatti (WhatsApp senza `?text=`); nessun pulsante `copy_text`.
- [X] T022 [P] [US1] Scrivere in `test/integration/us3-scheda.test.ts` un `describe("RF-03, RF-11: tastiera della scheda v1.1")` con: US1-1 telefono + Instagram → tastiera `[WhatsApp, Instagram]` sopra `[Modifica, Elimina]` (l'assenza degli username nel testo è in T034); US1-2 con occorrenza aperta l'URL WhatsApp della scheda non ha `?text=`; US1-3 nessun contatto → prima riga `[Modifica, Elimina]`; US1-4 occorrenza *saltato* di 3 giorni fa + tutti i contatti → contatti → Segna fatto → Modifica/Elimina; US1-5 nessun `copy_text`; US1-6 dopo `p:f` (`editMessageText`) e dopo Modifica → Instagram → Svuota la tastiera ha la riga contatti aggiornata; FR-003 `/cerca` con un solo risultato e Salva in `/nuovo` mostrano la stessa tastiera; FR-015 i pulsanti `p:m`, `p:x`, `p:f` di una scheda senza riga contatti funzionano; edge username non valido salvato (`marco rossi`) → pulsante Instagram assente, poi Modifica → Instagram `marco.rossi` → pulsante presente.
- [X] T023 [P] [US1] Aggiungere in `test/integration/us1-reminder.test.ts`: US1-7 regressione — reminder del giorno di una persona con telefono: WhatsApp con `?text=` e "Copia messaggio" presenti (RF-11); edge username Telegram `abc` salvato → pulsante Telegram assente nel reminder (FR-002, Q5).

### Implementation for User Story 1

- [X] T024 [P] [US1] In `src/domain/username.ts` aggiungere ed esportare `isInstagramLinkable(u: string): boolean` (`/^[A-Za-z0-9._]{1,30}$/`) e `isTelegramLinkable(u: string): boolean` (`/^[A-Za-z0-9_]{5,32}$/`); `normalizeUsername` invariata (FR-002, FR-014, R-07). T019 verde.
- [X] T025 [US1] In `src/bot/promemoria.ts` estrarre da `contactRows` ed esportare `export type ContactFields = Pick<ReminderPerson, "phone" | "instagram" | "telegram">` e `contactLinks(p: ContactFields, greeting: string | null): InlineKeyboardButton[]`: WhatsApp `https://wa.me/<cifre>` + `?text=${encodeURIComponent(greeting)}` solo se `greeting !== null`; Instagram/Telegram solo se `isInstagramLinkable`/`isTelegramLinkable`. `contactRows(d, layout)` usa `contactLinks(d.person, d.greeting)` + Copia messaggio, output invariato per username validi (FR-004, FR-005, R-05). Dipende da T024. T020 verde.
- [X] T026 [US1] In `src/bot/scheda.ts` cambiare `schedaKeyboard` in `schedaKeyboard(personId: number, contacts: ContactFields, hasPending = false)` con le righe nell'ordine di FR-002: `contactLinks(contacts, null)` (riga vuota scartata da `keyboard()`), `[Segna fatto]` se `hasPending`, `[Modifica] [Elimina]`; aggiornare il commento (RNF-14 → RF-03, FR-002). `showScheda` e `markDone` passano `data.person` (FR-003). Nessuna icona nuova sui pulsanti: `T.btnEdit`, `T.btnDelete`, `T.btnMarkDone` restano come oggi (le icone del mockup §5.6 sono del ciclo stile RNF-19, fuori perimetro). Dipende da T025. T021 e T022 verdi.
- [X] T027 [US1] Verificare con `grep` che `schedaKeyboard` non sia chiamata altrove in `src/` oltre a `showScheda` e `markDone` in `src/bot/scheda.ts` (FR-003, plan "Dettaglio: tastiera della scheda"); se lo è, passare `data.person` anche lì.
- [X] T028 [US1] Eseguire `npm test -- us1-reminder promemoria` e verificare T023 verde (nessuna regressione dei promemoria).
- [X] T029 [US1] Adattare i test esistenti alla nuova tastiera della scheda (R-05): in `test/unit/scheda.test.ts` le chiamate `schedaKeyboard(12)` e `schedaKeyboard(12, true)` (righe ~75-76) prendono la nuova firma con contatti vuoti `{ phone: null, instagram: null, telegram: null }`, con le stesse attese; in `test/integration/us4-modifica.test.ts:52` l'attesa diventa `["Instagram", "Telegram", "Modifica", "Elimina"]` (RF-03, FR-002; la persona ha `telegram: "mrossi"` e `instagram: "nuovo.user"`). Poi eseguire `npm test` completo: ogni altra attesa sulla tastiera della scheda di persone con contatti si adatta qui.

**Checkpoint**: US1, US2, US3 funzionano; `npm test` verde.

---

## Phase 6: Testi e test esistenti aggiornati

**Purpose**: testi rivisti della scheda e dello step telefono (FR-001, FR-007, FR-012; research R-08)
e allineamento dei test MVP che li verificano (SC-001).

- [X] T030 In `src/bot/scheda.ts`, `schedaLines`: la riga contatti contiene solo `T.schedaPhone(p.phone)` se presente; rimuovere gli usi di `T.schedaInstagram`/`T.schedaTelegram` (RF-03, V-04, FR-001, mockup AFU §5.6). Il riepilogo `renderRiepilogo` eredita il nuovo testo (spec Assumptions). Le altre righe restano come oggi: nessuna icona nuova (👤, 🎂 del mockup §5.6 sono del ciclo stile RNF-19, fuori perimetro).
- [X] T031 In `src/texts.ts`: `askPhone` → `"📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎"` (FR-007, §5.2); `editAsk.p` → `"Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎"` (FR-012, plan "Scelte di piano" 1); rimuovere `schedaInstagram` e `schedaTelegram` (FR-001). Dipende da T030.
- [X] T032 [P] Aggiornare `test/unit/scheda.test.ts`: la riga attesa `"📱 +393331234567 · IG @marco.rossi · TG @mrossi"` (~riga 29) diventa `"📱 +393331234567"`; aggiungere `it("RF-03, FR-001: persona con soli username → nessuna riga contatti nel testo")` e `it("FR-001: renderRiepilogo senza username")`.
- [X] T033 [P] Aggiornare `test/integration/us2-inserimento.test.ts`: l'attesa `"Telefono? (con prefisso, es. +39 333 1234567)"` (~riga 56) diventa `T.askPhone` nel nuovo testo; aggiungere `it("RF-01, §5.2: US2-6 la domanda del telefono suggerisce di condividere il contatto")` (`toContain("condividi il contatto")`).
- [X] T034 [P] Aggiornare `test/integration/us3-scheda.test.ts`: aggiungere a US1-1 (T022) l'attesa che il testo della scheda contenga `📱 +39…` e **non** contenga `IG @`, `TG @` né gli username (RF-03, FR-001); stesso controllo su una persona con soli username (edge "Persona con solo username").
- [X] T035 [P] Aggiornare `test/integration/us4-modifica.test.ts`: l'attesa `toContain("IG @nuovo.user")` (~riga 51) diventa la presenza del pulsante Instagram con URL `https://ig.me/m/nuovo.user` nella tastiera della scheda e l'assenza di `IG @` nel testo (RF-03, RF-04; la riga 52 è già adattata in T029); aggiungere `it("RF-04, FR-012: Modifica → Telefono suggerisce il contatto")` sul nuovo `editAsk.p`.
- [X] T036 Eseguire `npm run typecheck` e `npm test`: nessun riferimento residuo a `schedaInstagram`/`schedaTelegram`, tutti i test verdi.

**Checkpoint**: testi conformi ai mockup §5.2 e §5.6; test MVP e v1.1 verdi.

---

## Phase 7: Smoke Postman e gate di chiusura

**Purpose**: collection di smoke test aggiornata (research R-11, non gate) e gate di quickstart.md §5.

- [X] T037 In `postman/bot-compleanni.postman_collection.json` aggiungere le richieste con `message.contact` (contratto §1): cartella "12 · /nuovo completo" — contatto `393331234567` allo step telefono → conferma `📱 +393331234567, giusto?`, Sì → domanda Instagram; contatto senza `phone_number` → `Questo contatto non ha un numero di telefono`; contatto `12345` → numero non valido; Correggi → domanda del telefono; cartella "14 · Modifica (p:m)" — Telefono → contatto → Sì → scheda con il nuovo numero (controllo su D1); cartella "02 · Comandi base" — contatto fuori flusso → "Non ho capito…"; cartella "11 · Scheda e pulsanti senza stato" — controlli sul testo senza `IG @`/`TG @` e sulla tastiera (riga contatti, WhatsApp senza `?text=`, ordine Segna fatto); aggiornare le attese esistenti della domanda del telefono. Se serve una persona con username non valido, aggiungerla a `postman/seed-smoke.sql` con un id della serie 92xx libero. Portare `info.version` e la riga "Versione" della descrizione a `2.2.0` (RF-01, RF-03, RF-04, RF-11, BR-25).
- [X] T038 In `postman/README.md` aggiungere la voce di Changelog `2.2.0` (2026-10-29, feature 006: cartelle toccate, numero totale di richieste, eventuali righe nuove del seed). Dipende da T037.
- [X] T039 Eseguire i gate di quickstart.md §5: `npm run typecheck` senza errori, `npm test` verde (compresi `schema.test.ts` invariato, FR-013, e `privacy-log.test.ts`, principio V), `npm run bench` senza regressioni su `bench/liste.bench.ts` (principio II, R-10).
- [X] T040 Verificare che ogni riga delle tabelle di quickstart.md §2–§3 abbia un test che ne cita l'ID (US1-1…US1-7, US2-1…US2-7, US3-1…US3-4, edge, FR-003, FR-015, FR-016, SC-004) e che nessun nuovo `log(...)` contenga numero, nome o vCard del contatto (principio V, XI).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Dominio BR-25)**: nessuna dipendenza; blocca 3 e 4.
- **Phase 2 (Tipi, motore, router)**: nessuna dipendenza da Phase 1 sul codice, ma eseguita dopo per
  l'ordine richiesto; blocca 3 e 4.
- **Phase 3 (US2)**: dopo 1 e 2.
- **Phase 4 (US3)**: dopo 3 (riusa `phoneConfirmStep`, `phoneContactHandler` e le chiavi di T013).
- **Phase 5 (US1)**: indipendente da 1–4 sul codice (tocca solo `username.ts`, `promemoria.ts`,
  `scheda.ts`); eseguita dopo per l'ordine richiesto.
- **Phase 6 (Testi e test esistenti)**: dopo 3, 4 e 5 (T034 estende i test di T022; T033 e T035
  stanno negli stessi file di T011/T017).
- **Phase 7 (Postman e gate)**: dopo 6.

### User Story Dependencies

- **US2 (P1)**: dipende solo dalle fasi 1–2.
- **US3 (P2)**: dipende da US2 per gli helper comuni di `steps.ts` e i testi nuovi; verificabile da
  sola (T017).
- **US1 (P1)**: nessuna dipendenza da US2/US3; verificabile da sola (T019–T023).

### Within Each Phase

- Test prima dell'implementazione, e devono fallire.
- `phone.ts` → `steps.ts` → `nuovo.ts`/`modifica.ts`; `username.ts` → `promemoria.ts` → `scheda.ts`.
- `scheda.ts` (T030) prima di `texts.ts` (T031): la rimozione delle chiavi richiede che non siano più usate.

---

## Parallel Opportunities

Solo task su file diversi e senza dipendenze da task incompleti:

- **Phase 5, test**: T019 (`username.test.ts`), T020 (`promemoria.test.ts`), T021
  (`scheda.test.ts`), T022 (`us3-scheda.test.ts`), T023 (`us1-reminder.test.ts`) in parallelo.
- **Phase 5, implementazione**: T024 (`username.ts`) può partire insieme ai test; T025 → T026 sono in
  sequenza.
- **Phase 6, test**: T032, T033, T034, T035 in parallelo (quattro file diversi), dopo T030–T031.

Nessun [P] nelle fasi 1–4: ogni task dipende dal precedente o condivide il file
(`phone.test.ts`/`phone.ts`, `engine.ts` → `router.ts`, `steps.ts`, `us2-inserimento.test.ts`).

### Parallel Example: User Story 1

```text
Task: "T019 [US1] Test isInstagramLinkable/isTelegramLinkable in test/unit/username.test.ts"
Task: "T020 [US1] Test contactLinks ed etichette in test/unit/promemoria.test.ts"
Task: "T021 [US1] Test schedaKeyboard nuova firma in test/unit/scheda.test.ts"
Task: "T022 [US1] Test tastiera della scheda in test/integration/us3-scheda.test.ts"
Task: "T023 [US1] Regressione reminder in test/integration/us1-reminder.test.ts"
Task: "T024 [US1] isInstagramLinkable/isTelegramLinkable in src/domain/username.ts"
```

### Parallel Example: Phase 6

```text
Task: "T032 Aggiornare test/unit/scheda.test.ts"
Task: "T033 Aggiornare test/integration/us2-inserimento.test.ts"
Task: "T034 Aggiornare test/integration/us3-scheda.test.ts"
Task: "T035 Aggiornare test/integration/us4-modifica.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 2)

1. Phase 1: BR-25 con i test tabellari.
2. Phase 2: contatto instradato (fuori flusso "Non ho capito", altri step domanda ripetuta).
3. Phase 3: `/nuovo` accetta il contatto con la conferma.
4. **STOP e VALIDA**: T011, T012 verdi; prova manuale con 📎 → Contatto.

### Incremental Delivery

1. Fasi 1–3 → telefono da contatto in `/nuovo` (MVP).
2. Fase 4 → stessa scorciatoia in Modifica → Telefono.
3. Fase 5 → pulsanti di contatto nella scheda.
4. Fase 6 → testi definitivi (§5.2, §5.6) e test MVP allineati.
5. Fase 7 → Postman 2.2.0 e gate; deploy con `scripts/deploy.ps1` invariato (nessuna migration).

---

## Notes

- [P] = file diversi, nessuna dipendenza da task incompleti.
- Ogni test cita l'ID AFU/FR nel nome (principio XI).
- Commit dopo ogni fase (messaggi senza attribuzioni, regole globali del proprietario).
- Nessuna conversione dei dati in produzione: telefoni e username restano identici (SC-006).
