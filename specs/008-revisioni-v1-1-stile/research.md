# Research: Revisioni v1.1 — Guida di stile

**Feature**: 008-revisioni-v1-1-stile | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

Nessun `NEEDS CLARIFICATION` aperto nel Technical Context: le cinque domande della sessione di
clarify (tipi di testo, mappa delle icone, pulsanti con icona, limiti del tono, documenti) hanno
chiuso le scelte di contenuto. Le decisioni qui sotto riguardano **come** applicarle al codice
esistente (001–007) senza cambiare comportamento.

## R-01 — Dove intervenire: solo `src/texts.ts`, più un cablaggio minimo in 5 punti

**Decision**: tutti i testi nuovi e rivisti stanno in `src/texts.ts` (RNF-15, constitution VIII).
Fuori da quel file cambiano solo **argomenti e nomi di chiave nei punti di chiamata**, dove un
testo richiesto dalla spec oggi non esiste o è composto fuori da `texts.ts`:

| File | Oggi | Dopo | Motivo |
|---|---|---|---|
| `src/bot/scheda.ts` `schedaLines` | titolo `p.fullName` o `T.schedaNickname(...)`; riga data composta con `` `${formatShort(...)} · ${when}` `` | `T.schedaTitle(fullName, nickname)` e `T.schedaDate(data, when)` | FR-011: 👤 e 🎂 nella scheda; la composizione della riga torna in `texts.ts` |
| `src/bot/scheda.ts` `showScheda` | parametro `prefix?: string`, oggi mai usato | parametro `confirm?: (name: string) => string`; il nome è `nickname ?? fullName` della scheda appena letta | FR-008: conferma con il nome nello stesso messaggio della scheda (006 FR-003), senza query in più |
| `src/bot/flows/nuovo.ts` `save` | `showScheda(ctx, id)` | `showScheda(ctx, id, T.personSaved)` | FR-008, criterio di RNF-19 |
| `src/bot/flows/modifica.ts` (2 punti: campi e gruppi) | `showScheda(ctx, id)` | `showScheda(ctx, id, T.personUpdated)` | FR-004, US3 scenario 1 ("modifica") |
| `src/bot/flows/elimina.ts` | `reply(ctx, T.personDeleted)` | `reply(ctx, T.personDeleted(data(state).name))` | FR-001a: la conferma nomina l'oggetto |

Nessuna query, nessun ramo, nessuna tastiera e nessun `callback_data` cambia: il numero di
messaggi e di subrequest resta identico (la conferma viaggia nello stesso `sendMessage` della
scheda). `src/telegram/keyboard.ts` e i codec dei callback non si toccano.

**Rationale**: è il minimo indispensabile per FR-008 e FR-011; il parametro `prefix` di
`showScheda` esiste già e non ha chiamanti, quindi cambiarne il tipo non altera altri flussi.
Passare una funzione invece di una stringa evita di rileggere la persona in `nuovo.ts`/`modifica.ts`
solo per conoscerne il nome.

**Alternatives considered**:
- messaggio di conferma separato prima della scheda: +1 subrequest per salvataggio e due messaggi
  dove il mockup §5.2 ne mostra uno; scartata;
- calcolare il nome in `nuovo.ts` da `d.nickname ?? d.fullName`: funziona per l'inserimento ma
  non per la Modifica dei gruppi, dove lo stato non ha il nome; scartata per uniformità.

## R-02 — Emoji di sezione delle viste senza mockup

**Decision** (FR-002, FR-014; scelta lasciata alla progettazione dalle Assumptions della spec):

| Sezione | Emoji | Note |
|---|---|---|
| `/oggi` (riassunto, vuoto, "altri") | 🎂 | stessa sezione del reminder (§5.3) |
| `/prossimi` | 📆 | da §5.7 |
| `/mese` | 🗓 | calendario, distinto da 📆 e da 📅 (pre-reminder) |
| `/cerca` | 🔍 | coerente con la ricerca dei gruppi (§5.9) |
| `/scaduti` | ⏳ | "in sospeso"; ⏰ resta al recupero (§5.5) |
| `/anno` | 🗂 | riepilogo d'archivio; 📊 resta a `/statistiche` (§5.11) |
| `/aiuto` | 📖 | |
| `/gruppi`, scheda gruppo, nome di un gruppo | 👥 | da §5.9 |
| Scheda persona | 👤 (titolo), 🎂 (data) | da §5.6 |
| Riepilogo prima del salvataggio | 📋 | da §5.2 |
| Anteprima import | 📥 | da §5.8 |
| Modello CSV | 📄 | didascalia |
| Export | 📤 | didascalia; simmetrico a 📥 |
| Backup (richiesta e mensile), ripristino | 💾 | coerente con la riga 💾 di `/stato` (§5.10) |
| `/messaggio` | ✍️ | icona del campo messaggio (§5.2) |

**Rationale**: una sola emoji per sezione (FR-002) e nessuna emoji riusata per due sezioni
diverse, salvo 🎂 (reminder e `/oggi` sono la stessa sezione, "compleanni di oggi"; la riga data
della scheda e la domanda della data sono lo stesso campo) e 👥 (gruppi ovunque).

**Alternatives considered**: 📅 per `/mese` (già del pre-reminder, si confonderebbe); 📊 per
`/anno` (già di `/statistiche`); 📈 (suggerisce un andamento che `/anno` non mostra).

## R-03 — Casi di classificazione non ovvi

**Decision**:
- `groupNoMatch` («Nessun gruppo corrisponde a …»): **vista vuota** della ricerca gruppi → 🔍, non
  ❌. È seguito dall'elenco dei gruppi a pulsanti, quindi è un esito di ricerca, non un rifiuto.
  "Persona o gruppo non trovato" di FR-004 resta per `personNotFound` e `groupGone` (oggetto
  sparito tra un tocco e l'altro).
- `groupCardEmpty`: **frammento** (sta sotto il titolo 👥 della scheda gruppo) → nessuna emoji.
- `noGroups`: è il primo e unico testo di `/gruppi` senza gruppi → **vista vuota** → 👥.
- `notUnderstood`: **errore** (FR-004, "comando non capito") → ❌.
- `cancelled`, `nothingToCancel`, `searchUsage`, `groupsTypeName`, `sendCsv`, `useRipristina`,
  `yourId`: **informativi**, senza emoji.
- `becameDuplicates` e `nothingImported`: **avvisi** ⚠️ (l'import prosegue o termina senza danni);
  `becameDuplicates` è la prima riga di un messaggio che contiene anche `imported` (🎉).
- `previewShort` (promemoria dell'anteprima in attesa): **titolo** della stessa sezione → 📥.
- `restoreConfirm1` e `restoreConfirm2`: richieste di conferma del ripristino → ⚠️ (FR-016).
- `confirmDate`: domanda di conferma senza icona, come §5.2 ("14 marzo 1994, giusto?");
  `confirmPhone` mantiene 📱 come §5.2. Il mockup prevale (FR-001).
- `greetingAsk`, `greetingPreview`: domande del flusso `/messaggio` → ✍️ (FR-007).
- `restoreAsk`, `waitingBackupFile`: attesa del file di ripristino → 💾 (FR-007).
- `actionUnavailable`, `personNotFound`: usati anche come toast di `answerCallbackQuery`; la ❌
  vale anche lì (limite di 200 caratteri ampiamente rispettato).

## R-04 — Punto esclamativo nel reminder

**Decision**: `reminderTitle` termina con "!" come §5.3 ("…, compie 32 anni!"), anche senza età o
con la nota del 29/02.

**Rationale**: FR-001a limita "!" a benvenuto e conferme di successo, ma FR-001 dice che dove esiste
un mockup il testo ne segue tono e struttura; SC-002 chiede la coincidenza col mockup. È l'unica
eccezione al vincolo e va segnalata nell'inventario.

**Alternatives considered**: niente "!" nel reminder (viola SC-002).

## R-05 — Testi esclusi dalla revisione

**Decision**: restano **fuori** dalla guida, byte per byte:
- `DEFAULT_BIRTHDAY_MESSAGE` in `src/config.ts` ("Tanti auguri {nome}! 🎉", A-06): non è in
  `texts.ts`, non si tocca;
- i messaggi personalizzati e il default impostato con `/messaggio` (dati in D1);
- `CSV_EXAMPLE_ROW` (riga d'esempio del modello, riconosciuta all'import, 004 FR-007a), le
  intestazioni `CSV_COLUMNS`, il nome dei file e il formato JSON del backup;
- nomi, nickname e nomi dei gruppi (dati dell'utente);
- i testi di stato dopo un esito (`outcomeDone` "✅ Fatto", `outcomeSkipped`, `skippedThisYear`;
  edge case della spec), gli indicatori `selected` (✓) e `groupToggle` (☐/☑);
- `BOT_COMMANDS` (menu di Telegram, §5.1, senza emoji) e le righe dei comandi di `/aiuto`;
- i testi di `/stato`, `/statistiche` e dell'avviso di buco (già come §5.10-§5.12, FR-018).

Il segnaposto `{nome}` e l'anteprima di `/messaggio` mostrano il testo salvato tra « », senza
modifiche: cambia solo la cornice del bot (FR-006).

## R-06 — Lunghezza dei messaggi lunghi (limite 4096 di `sendMessage`, 1024 delle didascalie)

**Decision**: nessun intervento sulla logica di divisione; verifica numerica qui e con un test.

| Messaggio | Come viene inviato | Oggi | Dopo (stima) | Esito |
|---|---|---|---|---|
| `/aiuto` (`T.help`) | un solo `sendMessage`, non diviso | ≈ 940 caratteri, 23 righe | ≈ 945 (riga di intestazione "📖 Ecco cosa posso fare:") | ✅ < 4096, margine ≈ 3150 |
| Anteprima import | `splitMessage` (≤ 4096 e ≤ 45 righe con entità per messaggio) e al massimo `PREVIEW_MAX_MESSAGES` = 30 messaggi | variabile, fino a 200 righe d'errore | +2 caratteri UTF-16 per 📥 e per ⚠️ (solo intestazioni) | ✅ la divisione già conta la lunghezza reale; l'emoji compare solo nel primo messaggio |
| `/stato` | `sendLines` → `splitMessage` | 7 righe fisse + 1 riga per abbandonato (7 giorni) | invariato (FR-018) | ✅ |
| `/statistiche` | `sendLines` → `splitMessage` | ≈ 25 righe + gruppi in una riga | invariato (FR-018) | ✅; la riga dei gruppi è già spezzata da `splitMessage` a righe intere |
| Liste (`/prossimi`, `/mese`, `/cerca`, `/scaduti`, `/anno`, scheda gruppo) | `sendList` → `splitMessage` | — | +2 per l'emoji d'intestazione | ✅ |
| Didascalia `/modello` (`templateCaption`) | `sendDocument`, limite 1024 | ≈ 650 | ≈ 690 | ✅ < 1024 |
| Didascalie export e backup | `sendDocument` | < 120 | < 140 | ✅ |
| Toast `answerCallbackQuery` | limite 200 | ≤ 45 | ≤ 60 | ✅ |

`MESSAGE_MAX_LENGTH` confronta `string.length` (unità UTF-16): ogni emoji conta 2, come la conta
Telegram, quindi la stima è prudente. Il test `test/unit/testi.test.ts` (R-08) verifica
`T.help.length < MESSAGE_MAX_LENGTH` e `T.templateCaption.length <= DOCUMENT_CAPTION_MAX_LENGTH`.

## R-07 — Dati in produzione e migration

**Decision**: **nessuna migration** (restano `0001_schema_iniziale.sql` e `0002_indice_retry.sql`),
nessuna conversione, nessuna chiave nuova in `settings`.
- Il messaggio di default e i personalizzati non vengono letti né scritti dal rilascio (FR-020).
- I messaggi già inviati restano col testo vecchio: il bot non riscrive messaggi passati; i loro
  pulsanti funzionano perché `callback_data` è invariato (FR-022). Quando un tocco su un vecchio
  reminder provoca `editMessageText`, il testo ricostruito usa il formato nuovo: è il
  comportamento già previsto da 002 (il messaggio viene rigenerato), non una conversione di dati.
- Un flusso guidato in corso (riga in `conversation_state`) prosegue: lo stato contiene campi e
  step, non testi; il prossimo prompt usa i testi nuovi (FR-023). Un'anteprima import in attesa
  idem.
- Backup creati prima del rilascio restano ripristinabili: formato JSON invariato (FR-016, FR-020).

## R-08 — Strategia dei test

**Decision**:
1. **Asserzioni sulle costanti**: nei test di integrazione e unità che oggi duplicano un testo del
   bot, l'atteso diventa la chiave di `T` (`toBe(T.askFullName)`, `toContain(T.summaryTitle)`,
   `tap(deps, T.btnSkip)`, `T.personSaved("Marchino")`). Così un ritocco futuro dei testi non
   rompe i test di comportamento.
2. **Letterali solo dove il letterale è il requisito**: i test dei mockup (SC-002) e dei due
   criteri di RNF-19 confrontano il testo atteso scritto per esteso (es.
   `"🎉 Fatto! Marchino è in rubrica."`, `"📆 Prossimi 30 giorni (Famiglia)"`), altrimenti il test
   sarebbe tautologico. Stanno in un solo file nuovo, `test/integration/v11-stile.test.ts`.
3. **Inventario eseguibile** (FR-004a, SC-001): `test/unit/testi.test.ts` contiene la mappa
   chiave → tipo di [contracts/testi.md](contracts/testi.md) e verifica: ogni chiave di `T` è
   classificata (100%); titoli e viste vuote iniziano con un'emoji (`\p{Extended_Pictographic}`);
   errori con ❌, avvisi con ⚠️, conferme contengono 🎉 o ✅; informativi senza 🎉/✅/⚠️/❌;
   pulsanti con icona solo nell'elenco chiuso di FR-009; pulsanti di contatto invariati e senza
   emoji (SC-004); nessuna emoji in `formatListLine`, `groupLine`, `previewDuplicateLine`,
   `previewErrorLine`, `statoAbandoned` e nelle righe di `help` e della legenda (FR-003);
   `DEFAULT_BIRTHDAY_MESSAGE` e `CSV_EXAMPLE_ROW` invariati (FR-006, FR-020).
4. I test di comportamento esistenti non cambiano logica né scenari (SC-006).

**Rationale**: la richiesta del proprietario ("preferire asserzioni che usano le costanti") e la
constitution X (ogni criterio ha un test) convivono: le costanti per il comportamento, i letterali
per i mockup.

## R-09 — Smoke Postman

**Decision**: la collection non contiene asserzioni automatiche sui testi del bot (le risposte del
Worker sono sempre `200` vuoto; i 626 `pm.test` controllano codici HTTP e stato di D1 via
`postman/helper.mjs`). I testi compaiono solo nelle **descrizioni "Atteso: …"** (≈ 178
richieste), da verificare a occhio nella chat. Si aggiornano quelle descrizioni ai testi nuovi
(es. `Prossimi 30 giorni` → `📆 Prossimi 30 giorni`, "Modifica/Elimina" → "✏️ Modifica/🗑 Elimina",
"Non ho capito…" → "❌ Non ho capito…") e la versione passa a **2.4.0** con la nota "feature 008:
guida di stile". Nessuna richiesta, nessun `callback_data` e nessun `pm.test` cambia; i tocchi
simulati usano `callback_data`, non le etichette.

**Alternatives considered**: aggiungere asserzioni sui testi via Bot API: impossibile senza
leggere la chat reale; fuori perimetro.
