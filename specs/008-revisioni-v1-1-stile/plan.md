# Implementation Plan: Revisioni v1.1 — Guida di stile

**Branch**: `008-revisioni-v1-1-stile` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-revisioni-v1-1-stile/spec.md`

## Summary

Revisione REV-001 dell'AFU v1.1: guida di stile RNF-19 e mockup §5.2-§5.12 applicati a **tutti** i
testi del bot, compresi quelli delle feature 005-007. Cambiano solo i testi: tono caldo e sobrio,
emoji di sezione nelle intestazioni (mai nelle righe), 🎉/✅ nelle conferme, ⚠️ negli avvisi, ❌
negli errori, un'icona per campo nelle domande, icone solo sui pulsanti di azione dei mockup.

Approccio: **nessuna modifica di logica, nessuna dipendenza, nessuna migration, `callback_data`
invariati**.

- **Testi**: tutti in `src/texts.ts` (RNF-15); la revisione testo per testo, con chiave, testo
  attuale, testo nuovo e regola RNF-19 applicata, è in [contracts/testi.md](contracts/testi.md),
  che è anche l'inventario di FR-004a.
- **Cablaggio minimo** (research R-01): 4 file fuori da `texts.ts` cambiano solo argomenti o nomi
  di chiave, per tre testi che oggi non esistono o sono composti fuori dal catalogo: conferma del
  salvataggio e della modifica con il nome nello stesso messaggio della scheda (parametro di
  `showScheda` già esistente e mai usato), titolo 👤 e riga 🎂 della scheda, nome nella conferma di
  eliminazione. Stessi messaggi, stesse query, stesse subrequest.
- **Esclusi** (research R-05): messaggio di auguri di default (A-06,
  `DEFAULT_BIRTHDAY_MESSAGE` in `src/config.ts`), messaggi personalizzati, nomi, riga d'esempio e
  contenuto dei file, menu dei comandi, testi di `/stato`, `/statistiche` e avviso di buco.
- **Test**: asserzioni letterali sostituite dalle costanti di `T`; letterali solo nei test dei
  mockup; inventario eseguibile in `test/unit/testi.test.ts` (research R-08).
- **Postman**: solo le descrizioni "Atteso: …" e la versione (2.4.0); nessun `pm.test` controlla i
  testi del bot (research R-09).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001–007)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`)

**Storage**: D1 `birthday-bot-db`, schema e dati invariati ([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale e fake Telegram, `now` iniettato

**Target Platform**: Cloudflare Workers Free; webhook e un solo Cron Trigger orario invariati

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: CPU e subrequest invariate (stessi messaggi, testi più lunghi di pochi
caratteri; funzioni di testo pure)

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest (RNF-17, V-02); testi solo in `src/texts.ts`;
messaggi ≤ 4096 caratteri, didascalie ≤ 1024, toast ≤ 200; righe di lista senza emoji
(allineamento in colonna di 003 FR-001a)

**Scale/Scope**: ≈ 150 voci del catalogo `T` (≈ 95 riscritte, il resto verificato invariato);
4 file di cablaggio; ≈ 45 file di test con asserzioni sui testi; 1 collection Postman

## Constitution Check

*GATE: verificato prima della Phase 0 e ricontrollato dopo la Phase 1.*

| Principio | Esito | Note |
|---|---|---|
| I. Costo zero | ✅ | nessun servizio nuovo |
| II. Limiti Free | ✅ | nessuna subrequest né query in più: la conferma di salvataggio/modifica viaggia nello stesso `sendMessage` della scheda (R-01); CPU invariata (concatenazioni di stringhe) |
| III. Semplicità | ✅ | nessuna dipendenza; nessuna astrazione nuova; si riusa il parametro `prefix` di `showScheda` |
| IV. Sicurezza | ✅ | whitelist, secret, conferme distruttive e doppia conferma del ripristino invariate; cambiano solo i testi delle conferme |
| V. Privacy | ✅ | nessun log nuovo; i testi con nomi vanno solo nella chat del proprietario come oggi |
| VI. Tempo | ✅ | nessuna logica di date toccata |
| VII. Affidabilità | ✅ | idempotenza e retry invariati; `callback_data` invariati, i messaggi già inviati restano operativi |
| VIII. Centralizzazione | ✅ | tutti i testi in `src/texts.ts`; la riga data e il titolo della scheda, oggi composti in `scheda.ts`, rientrano nel catalogo (miglioramento); default A-06 resta solo in `src/config.ts` |
| IX. Mono-proprietario | ✅ | nessun impatto sul modello dati |
| X. Qualità e test | ✅ | ogni criterio di RNF-19 e di US1-US3 ha un test (R-08); suite completa e typecheck come gate |
| XI. Tracciabilità | ✅ | test nuovi citano RNF-19, FR-xxx e §5.x nel nome |
| XII. Italiano | ✅ | tutti i testi in italiano |

Nessuna violazione: la tabella di Complexity Tracking resta vuota.

## Progettazione

### 1. Revisione testo per testo

La tabella completa (chiave in `src/texts.ts`, tipo, testo attuale, testo nuovo, regola RNF-19
applicata) è in **[contracts/testi.md](contracts/testi.md)**, divisa per area. Sintesi delle regole
applicate:

| Regola RNF-19 | Applicazione | Esempi (chiave → testo nuovo) |
|---|---|---|
| Emoji di sezione in testa a titoli e viste vuote | scelte in research R-02 | `upcomingHeader` → "📆 Prossimi 30 giorni (Famiglia)"; `monthHeader` → "🗓 Compleanni di marzo 2027"; `previewTitle` → "📥 Anteprima import"; `help` → "📖 Ecco cosa posso fare:" |
| Mai emoji nelle righe | righe e loro frammenti invariati | `formatListLine`, `groupLine`, `previewErrorLine`, `statoAbandoned`, righe "•" del modello |
| 👋 nel benvenuto | `welcome` | "👋 Ciao! Sono il tuo bot dei compleanni: …" |
| 🎉/✅ nelle conferme | 🎉 per salvataggio e import (mockup), ✅ per le altre | `personSaved` → "🎉 Fatto! {name} è in rubrica."; `groupCreated` → "✅ Ho creato il gruppo {name}." |
| ⚠️ negli avvisi | duplicati, conferme distruttive, errori dell'anteprima | `possibleDuplicate`, `confirmDeletePerson`, `confirmDeleteGroup`, `previewErrors`, `restoreConfirm1` |
| ❌ negli errori | rifiuti di input e richieste impossibili | `invalidDate`, `notUnderstood`, `csvTooManyRows`, `backupNotJson` |
| Un'icona per campo | mappa chiusa di FR-007 | `askFullName` → "👤 Come si chiama? Nome e cognome"; `editAsk.i` → "📸 Nuovo username Instagram?" |
| Icone solo sui pulsanti di azione | elenco chiuso di FR-009 | `btnSkip` → "⏭ Salta"; `btnEdit` → "✏️ Modifica"; `btnDelete` → "🗑 Elimina"; pulsanti di contatto invariati |
| Tono caldo e sobrio (FR-001a) | "tu", prima persona, oggetto nominato, errori con rimedio | `personDeleted` → "✅ Ho eliminato {name}."; `groupExists` → "❌ Hai già un gruppo con questo nome: scegline un altro." |

Eccezione documentata: `reminderTitle` termina con "!" come il mockup §5.3 (research R-04).

### 2. Cablaggio fuori da `src/texts.ts` (research R-01)

| File | Modifica |
|---|---|
| `src/bot/scheda.ts` | `schedaLines` usa `T.schedaTitle(fullName, nickname)` e `T.schedaDate(data, when)`; `showScheda(ctx, id, confirm?: (name) => string)` antepone `confirm(nickname ?? fullName)` alla scheda con una riga vuota, come faceva `prefix` |
| `src/bot/flows/nuovo.ts` | `save`: `showScheda(ctx, id, T.personSaved)` |
| `src/bot/flows/modifica.ts` | i due `showScheda` dopo il salvataggio: `showScheda(ctx, id, T.personUpdated)` |
| `src/bot/flows/elimina.ts` | `reply(ctx, T.personDeleted(data(state).name))` |

Vincoli verificati: nessuna modifica a `src/telegram/keyboard.ts`, ai codec dei callback, a
`src/db/`, `src/domain/`, `src/cron/`, `migrations/`. `renderRiepilogo` eredita il
titolo 👤 dalla scheda sotto l'intestazione "📋 Riepilogo:".

### 3. Lunghezza dei messaggi lunghi (dettaglio in research R-06)

| Messaggio | Limite | Oggi | Dopo | Esito |
|---|---|---|---|---|
| `/aiuto` (un solo messaggio, non diviso) | 4096 | ≈ 940 | ≈ 945 | ✅ margine ≈ 3150 |
| Anteprima import | 4096 per messaggio, divisa da `splitMessage`, ≤ 30 messaggi | variabile | +2 unità UTF-16 sulle sole intestazioni | ✅ la divisione misura il testo reale; 📥 solo nel primo messaggio |
| `/stato` | 4096, `sendLines` | 7 righe + abbandonati | invariato | ✅ |
| `/statistiche` | 4096, `sendLines` | ≈ 25 righe | invariato | ✅ |
| Didascalia `/modello` | 1024 | ≈ 650 | ≈ 690 | ✅ |
| Didascalie export/backup | 1024 | < 120 | < 140 | ✅ |
| Toast dei callback | 200 | ≤ 45 | ≤ 60 | ✅ |

Il test `test/unit/testi.test.ts` fissa i limiti di `/aiuto` e della didascalia del modello; i
messaggi divisi sono già coperti dai test di `splitMessage` (003 FR-005).

### 4. Esclusioni esplicite

- **Messaggio di auguri di default (A-06)**: `DEFAULT_BIRTHDAY_MESSAGE` = "Tanti auguri {nome}! 🎉"
  in `src/config.ts` non si tocca; il valore in `settings` non viene letto né scritto dal rilascio.
- **Messaggi personalizzati** (`persons.custom_message`) e default impostato con `/messaggio`:
  mostrati tra « » esattamente come salvati in scheda, riepilogo, anteprima di `/messaggio`, testo
  precompilato di WhatsApp e "Copia messaggio" (FR-006).
- Nomi, nickname e nomi dei gruppi; `CSV_EXAMPLE_ROW`, `CSV_COLUMNS`, nomi dei file, formato del
  backup; `BOT_COMMANDS`; testi di stato dopo un esito; indicatori ☐/☑/✓; testi di 007.
- Un test verifica che `DEFAULT_BIRTHDAY_MESSAGE` e `CSV_EXAMPLE_ROW` restino identici (SC-005).

### 5. Migration e dati in produzione

- **Migration: nessuna.** Schema, indici e chiavi di `settings` invariati (FR-019).
- **Dati in produzione: nessun impatto.** Nessuna conversione; default e personalizzati intatti
  (FR-020); nomi intatti (FR-021).
- **Messaggi già inviati**: restano col testo vecchio, il bot non li riscrive; i pulsanti
  funzionano perché `callback_data` non cambia (FR-022). Se un tocco provoca un
  `editMessageText` che rigenera il testo (comportamento già previsto da 002), il testo rigenerato
  usa i testi nuovi.
- **Flussi in corso** al deploy: proseguono, i prompt successivi usano i testi nuovi (FR-023).
- **Rollback**: ridistribuire la versione precedente del Worker; nessun dato da ripristinare.

### 6. Test da aggiornare

Strategia (research R-08): **le asserzioni usano le costanti di `src/texts.ts`** (`T.askFullName`,
`T.summaryTitle`, `T.btnSkip`, `T.personSaved("Marchino")`…) invece di stringhe duplicate; i
letterali restano solo dove sono il requisito (mockup §5 e criteri di RNF-19).

| File | Asserzioni letterali sui testi (circa) | Note |
|---|---|---|
| `test/integration/us2-inserimento.test.ts` | 76 | domande, `tap(deps, "Salta")` → `T.btnSkip`, "Riepilogo:" |
| `test/integration/us6-gruppi.test.ts` | 32 | conferme dei gruppi, ⚠️ eliminazione |
| `test/integration/us4-modifica.test.ts` | 31 | `editAsk.*`, conferma `personUpdated` |
| `test/integration/us1-reminder.test.ts` | 22 | "!" del reminder (§5.3), domanda del nickname |
| `test/integration/us1-import.test.ts` | 20 | 📥, ⚠️ errori, 🎉 import, ❌ rifiuti |
| `test/integration/v11-stato.test.ts` | 19 | invariati (FR-018): solo verifica |
| `test/integration/us3-backup-mensile.test.ts` | 17 | 💾 didascalia |
| `test/integration/us2-ripristino.test.ts` | 16 | 💾 domanda, ⚠️ conferme, ✅, ❌ errori del backup |
| `test/integration/us1-oggi.test.ts` | 16 | 🎂 intestazioni di `/oggi` |
| `test/integration/us2-recupero.test.ts` | 14 | invariati (§5.5): solo verifica |
| `test/integration/documenti.test.ts` | 14 | ❌ file troppo grande / download |
| `test/integration/us4-messaggio.test.ts` | 12 | ✍️ domande, ✅ conferma, « testo » invariato |
| `test/integration/us2-prossimi.test.ts` | 12 | 📆 intestazione e vista vuota, ❌ giorni |
| `test/integration/v11-gruppi-ricerca.test.ts` | 11 | 🔍 nessuna corrispondenza |
| `test/integration/us3-scheda.test.ts` | 11 | 👤, 🎂, ✏️ Modifica, 🗑 Elimina |
| `test/integration/v11-buco-cron.test.ts`, `v11-statistiche.test.ts` | 9 + 8 | invariati: solo verifica |
| `test/integration/us4-scaduti.test.ts`, `us5-gruppo-mese.test.ts`, `us3-cerca.test.ts`, `us3-pre-reminder.test.ts`, `us5-eliminazione.test.ts`, `us5-storico.test.ts`, `us4-export.test.ts`, `us7-start-aiuto.test.ts` | 5–9 ciascuno | ⏳, 🗓, 🔍, ✅ Ho eliminato, 📤, 👋, 📖 |
| `test/integration/budget.test.ts`, `us1-modello.test.ts`, `us2-backup.test.ts`, `us6-anno.test.ts`, `us6-modifiche.test.ts`, `us1-accesso.test.ts`, `viste-budget.test.ts` | 1–5 ciascuno | `tap(deps, "Salta")`, 📄, 💾, 🗂, ❌ |
| `test/unit/promemoria.test.ts`, `statistiche.test.ts`, `stato.test.ts`, `backup.test.ts`, `liste.test.ts`, `scheda.test.ts`, `import.test.ts`, `greeting.test.ts` | 3–18 ciascuno | scheda 👤/🎂, ⚠️ errori anteprima, ❌ backup; gli altri solo verifica |

I conteggi sono quelli delle asserzioni con stringhe letterali (alcune riguardano dati, non testi
del bot, e restano). Il task di aggiornamento passa file per file: sostituire ogni testo del bot
con la chiave di `T`, lasciare i dati dell'utente letterali.

**Test nuovi**:
- `test/unit/testi.test.ts`: inventario eseguibile di [contracts/testi.md](contracts/testi.md)
  (chiave → tipo) e regole per tipo; righe senza emoji; pulsanti con icona solo dell'elenco chiuso;
  pulsanti di contatto invariati (SC-004); limiti di lunghezza; default A-06 e riga d'esempio
  invariati (FR-004a, SC-001, SC-003, SC-005).
- `test/integration/v11-stile.test.ts`: confronto letterale con i mockup §5.2, §5.3, §5.6, §5.7,
  §5.8, §5.9 e i due criteri di RNF-19 (SC-002); messaggio personalizzato con emoji mostrato
  identico nella scheda e in `/messaggio` (FR-006).

### 7. Smoke Postman

`postman/bot-compleanni.postman_collection.json` **non ha asserzioni automatiche sui testi del
bot**: il Worker risponde sempre `200` vuoto e i 626 `pm.test` controllano codici HTTP e D1. I
testi attesi stanno nelle ≈ 178 descrizioni "Atteso: …", da confrontare a occhio in chat.

- Aggiornare le descrizioni "Atteso: …" ai testi nuovi (es. `Prossimi 30 giorni` → `📆 Prossimi
  30 giorni`; `Non ho capito. Scrivi /aiuto per l'elenco dei comandi` → `❌ Non ho capito. Scrivi
  /aiuto per vedere cosa so fare.`; "Modifica/Elimina" → "✏️ Modifica/🗑 Elimina"; `Nessuna
  operazione da annullare` → `Non c'è nessuna operazione da annullare.`).
- Versione della collection 2.3.0 → **2.4.0** con "feature 001–008" nella descrizione; nota in
  `postman/README.md`.
- Nessuna richiesta, nessun `callback_data`, nessun `pm.test` e nessuna fixture cambia (le
  fixture CSV conservano la riga d'esempio invariata).

## Project Structure

### Documentation (this feature)

```text
specs/008-revisioni-v1-1-stile/
├── spec.md
├── plan.md              # questo file
├── research.md          # R-01…R-09
├── data-model.md        # nessuna modifica a D1; catalogo dei testi
├── quickstart.md        # validazione
├── contracts/
│   └── testi.md         # inventario e revisione testo per testo
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── texts.ts                 # revisione di tutto il catalogo T (+ schedaTitle, schedaDate,
│                            #   personSaved, personUpdated; personDeleted funzione)
└── bot/
    ├── scheda.ts            # cablaggio: titolo, riga data, conferma nello stesso messaggio
    └── flows/
        ├── nuovo.ts         # cablaggio: T.personSaved
        ├── modifica.ts      # cablaggio: T.personUpdated
        └── elimina.ts       # cablaggio: T.personDeleted(name)

test/
├── unit/testi.test.ts                 # nuovo: inventario e regole RNF-19
├── integration/v11-stile.test.ts      # nuovo: mockup §5
└── integration/*.test.ts, unit/*.test.ts  # asserzioni sulle costanti di T

postman/
├── bot-compleanni.postman_collection.json  # descrizioni "Atteso", versione 2.4.0
└── README.md
```

**Structure Decision**: progetto singolo invariato (come 001–007); nessun file sorgente nuovo.

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
