# Implementation Plan: Revisioni v1.2 — Navigazione

**Branch**: `009-revisioni-v1-2-navigazione` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-revisioni-v1-2-navigazione/spec.md`

## Summary

Revisioni REV-008…REV-011 dell'AFU v1.2 sul bot già rilasciato (feature 001-008):
[⬅️ Tutti i gruppi] sulla scheda gruppo (RF-19, D-30), voce e scheda virtuale "Senza gruppo"
(RF-07, RF-19, V-09, D-31), sezione 🧑 Età in `/statistiche` con età attuale (RF-32, BR-03, D-32)
e pulsanti di passo successivo in `/mese`, `/anno`, `/prossimi` e nella conferma del salvataggio
(RNF-14, RNF-19, RF-01, RF-17, RF-20, RF-22, D-33).

Approccio:

- **Nessuna migration, nessuna dipendenza, nessuna conversione dei dati** (AFU "Impatto della
  versione 1.2", §Modello dati; FR-025). "Senza gruppo" ed età sono calcolati a ogni lettura;
  export, backup e ripristino non si toccano.
- **Nessuna subrequest in più** nei percorsi esistenti: ogni lettura nuova è una statement in più
  nella `D1.batch` già presente (`/gruppi`, ricerca gruppi, eliminazione gruppo, `/anno`,
  `/statistiche`). I tocchi nuovi costano al più 12 subrequest (research R-11).
- **`callback_data` compatibili**: nessun nuovo ambito; `g2:l` e `g2:s` nell'ambito `g2` (azioni
  senza campi, come `g2:n`), `s:u`, `s:m:<mese>`, `s:y:<anno>` nell'ambito senza stato `s`
  (decoder invariato), riuso di `g2:p:<id>:<h>:90` e di `s:n` (research R-01,
  [contracts/callback-data.md](contracts/callback-data.md)).
- **Logica nuova in funzioni pure** (`src/domain/viste.ts`, `src/domain/statistiche.ts`), testate
  a unità; i gestori in `src/bot/` costruiscono solo le tastiere.
- **Testi** solo in `src/texts.ts`, nell'inventario eseguibile ([contracts/testi-v12.md](contracts/testi-v12.md)).
- Il cron orario e i promemoria (spec 002) non cambiano.

## Technical Context

**Language/Version**: TypeScript (`strict`), target Cloudflare Workers (come 001-008)

**Primary Dependencies**: nessuna di runtime nuova; client Bot API proprio basato su `fetch`
(`src/telegram/client.ts`)

**Storage**: Cloudflare D1, schema invariato (`migrations/0001`, `0002`); sola lettura per la feature

**Testing**: Vitest + `@cloudflare/vitest-pool-workers` (`npm test`); bench Vitest in Node
(`npm run bench`); smoke Postman in locale (`postman/bot-compleanni.postman_collection.json`)

**Target Platform**: Cloudflare Workers piano Free, webhook Telegram; un solo Cron Trigger orario
(non toccato)

**Project Type**: bot Telegram (web-service serverless a progetto singolo)

**Performance Goals**: ogni invocazione ≤ 10 ms CPU; sezione Età su 200 persone < 0,1 ms;
`/statistiche` completa entro la soglia di `bench/stato.bench.ts`

**Constraints**: ≤ 50 subrequest per invocazione (caso peggiore della feature: 12); tastiera ≤ 100
pulsanti (V-09: al più 62); `callback_data` ≤ 64 byte (caso peggiore 31); Europe/Rome con now
iniettato; nessun dato personale nei log

**Scale/Scope**: ~200 persone, fino a 100+ gruppi, storico pluriennale di occorrenze; 13 moduli
`src/` toccati, nessun modulo nuovo

## Constitution Check

*GATE: verificato prima della Phase 0 e ricontrollato dopo la Phase 1.*

| Principio | Verifica | Esito |
|---|---|---|
| I. Costo zero | Solo Workers, D1, Bot API; nessun servizio nuovo | ✅ |
| II. Limiti Free | Nessuna subrequest in più nei percorsi esistenti; tocchi nuovi ≤ 12 (research R-11); CPU Età < 0,1 ms su 200 persone (R-07); cron non toccato. Stima presente anche se la feature non tocca ciclo orario, import, export e backup | ✅ |
| III. YAGNI | Nessuna dipendenza; nessun ambito `callback_data` nuovo; riuso di `s:n` e `g2:p`; solo ciò che l'AFU v1.2 chiede (alternative scartate della spec escluse) | ✅ |
| IV. Sicurezza | Router invariato: estranei ignorati prima del decoder; nuovi pulsanti senza stato validati al tocco; nessuna operazione distruttiva nuova | ✅ |
| V. Privacy | Nessun log nuovo; il `callback_data` non contiene mai testo dell'utente (solo id, hash, numeri) | ✅ |
| VI. Tempo | Età, mese di riferimento e anno corrente da `toLocal(deps.now())`; funzioni pure ricevono `today`; test su 29/02 (BR-04) e cambio d'anno (`/mese` a dicembre/gennaio, `/anno` corrente) | ✅ |
| VII. Affidabilità invii | Promemoria e cron non toccati | ✅ (n/a) |
| VIII. Centralizzazione | Testi solo in `src/texts.ts`; `UPCOMING_WIDE_DAYS = 90` in `src/config.ts`; `MONTHS_CAP` accanto a `MONTHS_SHORT` | ✅ |
| IX. Mono-proprietario | Nessuna scelta nel modello dati (nessuna modifica allo schema) | ✅ |
| X. Qualità e test | Almeno un test per ogni criterio Dato/Quando/Allora v1.2 di RF-01, RF-07, RF-17, RF-19, RF-20, RF-22, RF-32, RNF-14, RNF-19 (tabella "Copertura"); test senza orologio né rete reali | ✅ |
| XI. Tracciabilità | ID AFU in plan, contratti, nomi dei test | ✅ |
| XII. Italiano | Testi e documenti in italiano | ✅ |

Vincoli V-01…V-07 e V-09: nessuna violazione. Nessuna deviazione: tabella di complessità vuota.

**Ricontrollo post-design**: research, data model e contratti non introducono violazioni; il
caso peggiore di subrequest (tocco `s:y` con 200 saltati in serie: 12) e di pulsanti (62) è dentro
i limiti. ✅

## Moduli toccati

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/bot/gruppi.ts` | `renderGroupList` con `opts.ungrouped` → [Senza gruppo (N)] su riga a sé tra gruppi e ➕ (anche 0 gruppi e > 60); `showGroups` riceve `GroupListData`; `renderGroupCard` comune; scheda gruppo con [⬅️ Tutti i gruppi] sotto Rinomina/Elimina; nuove `showUngroupedCard`, `openUngrouped` (tocco `g2:s`), `showAllGroups` (tocco `g2:l`) | RF-07, RF-19, V-09, FR-001…FR-008 |
| `src/db/groups.ts` | `ungroupedCountStatement`, `ungroupedPersonsStatement`, `readGroupList` (batch [gruppi, conteggio]) | RF-07, RF-19, FR-003 |
| `src/db/viste.ts` | `groupSearchStatements` + conteggio senza gruppo; `yearStatements` + `EXISTS` dello storico chiuso di Y − 1 | RF-07, RF-22 |
| `src/domain/viste.ts` | `adjacentMonths`, `yearNavigation`, `canWidenUpcoming` (pure) | RF-17, RF-20, RF-22 |
| `src/bot/viste.ts` | `/prossimi` con [Prossimi 90 giorni] (`s:u` o `g2:p:…:90`), anche con lista vuota; `sendUpcoming` riceve `{id, name} \| null`; `/mese` con [◀️][▶️] anche vuota; `/anno` con pulsanti condizionati; gestori `showMeseFromButton`, `showAnnoFromButton`, `showProssimiWide` | RF-17, RF-20, RF-22, RNF-14 |
| `src/db/statistiche.ts` | quinta statement: `birth_day, birth_month, birth_year` con anno non nullo | RF-32 |
| `src/domain/statistiche.ts` | `isValidBirthYear`, `currentAge`, `ageBuckets`, `averageAge`, `ageSectionLines`; `histogramLines` generalizzata in `barLines`; sezione Età dopo l'istogramma per mese | RF-32, BR-03, BR-04, FR-010…FR-015, FR-026a |
| `src/bot/statistiche.ts` | passa `births` e `today` a `formatStatistiche` | RF-32 |
| `src/bot/scheda.ts` | `showScheda(ctx, id, confirm?, extraRows?)`: righe di tastiera in coda | RF-01, FR-021 |
| `src/bot/flows/nuovo.ts` | `save` passa `[[➕ Aggiungi un'altra persona → s:n]]` | RF-01, FR-021 |
| `src/bot/flows/steps.ts` | **verificato, nessuna modifica**: `duplicateStep` ("Salva comunque") chiama lo stesso `save` | RF-01 (edge case) |
| `src/bot/flows/gruppi.ts` | `handleGroupCallback` gestisce `l` e `s`; batch di `elimina` con il conteggio senza gruppo | RF-07, RF-19 |
| `src/bot/router.ts` | `STATIC_CALLBACKS`: `"s:u"`, `"s:m"`, `"s:y"` (con validazione dell'id) | RNF-14, FR-017…FR-020 |
| `src/telegram/keyboard.ts` | `GroupAction` + `"l" \| "s"`; `decodeGroup` ammette `l`, `s` solo senza campi; commento del contratto 009 | FR-030 |
| `src/texts.ts` | chiavi di [contracts/testi-v12.md](contracts/testi-v12.md); `MONTHS_CAP`, `AGE_BUCKET_LABELS`; riga `/gruppi` di `help` | RNF-15, RNF-19, FR-009, FR-023, FR-024 |
| `src/config.ts` | `UPCOMING_WIDE_DAYS = 90`; commento di `GROUP_BUTTONS_MAX` (62 ≤ 100) | RF-17, V-09 |

Non toccati: `src/cron/*`, `src/db/backup.ts`, `src/domain/backup.ts`, `src/bot/export.ts`,
`src/bot/import.ts`, `migrations/*`.

## Funzioni di dominio pure (test unitari)

| Funzione | Modulo | Casi minimi |
|---|---|---|
| `adjacentMonths(m)` | `domain/viste.ts` | 1 → {12, 2}; 3 → {2, 4}; 12 → {11, 1}; tutti i 12 mesi formano un ciclo in entrambe le direzioni (SC-004) |
| `yearNavigation(shown, current, prevHasHistory)` | `domain/viste.ts` | (2026, 2026, true) → prev 2025; (2026, 2026, false) → nessuno; (2025, 2026, false) → next 2026; (2023, 2026, false) → next 2024; (2025, 2026, true) → entrambi |
| `canWidenUpcoming(days)` | `domain/viste.ts` | 1, 30, 89 → true; 90, 120, 366 → false |
| `currentAge(d, m, y, today)` | `domain/statistiche.ts` | 14/03/1994 al 29/10/2026 = 32, al 10/03/2026 = 31, al 14/03/2026 = 32; 29/02/2000 al 28/02/2026 = 26, al 27/02/2026 = 25; nato il 30/12/2026 al 29/10/2026 = 0 |
| `isValidBirthYear(y, today)` | `domain/statistiche.ts` | 1899 → false; 1900 → true; anno corrente → true; anno + 1 → false |
| `ageBuckets(ages)` | `domain/statistiche.ts` | [8, 34, 37, 52] → 0-9 1, 10-19 0, 20-29 0, 30-39 2, 40-49 0, 50-59 1; [83, 91] → solo `80+` 2; [126] → `80+`; [] → nessuna riga |
| `averageAge(ages)` | `domain/statistiche.ts` | [8, 34, 37, 52] → 33 (32,75); [32, 33] → 33 (32,5 per eccesso); [30, 34] → 32 |
| `ageSectionLines(ages, without)` | `domain/statistiche.ts` | senza età → "non disponibile"; without = 0 → solo "Età media"; without = 23 → richiamo |

## `callback_data`

Dettaglio in [contracts/callback-data.md](contracts/callback-data.md). In sintesi:

| Pulsante | Dato | Byte max |
|---|---|---|
| ⬅️ Tutti i gruppi | `g2:l` | 4 |
| Senza gruppo (N) | `g2:s` | 4 |
| Prossimi 90 giorni, senza filtro | `s:u` | 3 |
| Prossimi 90 giorni, con gruppo | `g2:p:<id>:<nameHash>:90` (come 005) | 31 |
| ◀️ / ▶️ mese | `s:m:<1…12>` | 6 |
| ◀️ / ▶️ anno | `s:y:<aaaa>` | 8 |
| ➕ Aggiungi un'altra persona | `s:n` (come `/start`) | 3 |

Compatibilità con `g2` (005): forme di `n|o|r|x|p` invariate, nessun cambio di versione; tutti i
pulsanti già in chat continuano a funzionare. Pulsanti malformati (`g2:l:1`, `g2:s:5`, `s:u:5`,
`s:m`, `s:m:0`, `s:m:13`, `s:y`, `s:y:12`, `s:y:<anno futuro o < 1900>`) → "❌ Questa azione non è
più disponibile.". I pulsanti `g` di 001 restano non riconosciuti (005 FR-017).

## V-09

`renderGroupList`: ≤ 60 gruppi → al più 60 + [Senza gruppo (N)] + [➕ Nuovo gruppo] = **62**
pulsanti; > 60 gruppi → elenco testuale con l'invito `/gruppi <nome>` e i due pulsanti
[Senza gruppo (N)] (se N > 0) e [➕ Nuovo gruppo]. Test: 60 gruppi + N > 0 → 62 pulsanti; 61
gruppi + N > 0 → 2 pulsanti e righe testuali. [⬅️ Tutti i gruppi] mostra lo stesso elenco (anche
oltre 60).

## Migration e dati in produzione

- **Migration: non serve** (AFU "Impatto della versione 1.2", §Modello dati: "Nessuna nuova entità,
  nessun nuovo attributo, nessuna migration"; FR-025). Nessun file in `migrations/`.
- "Senza gruppo" è calcolato (`NOT EXISTS` su `person_groups`), **mai** scritto in `groups`, quindi
  mai in export e backup (FR-028); un gruppo reale con quel nome resta una riga come le altre
  (FR-027).
- Nessuna conversione: persone senza anno o con anno fuori da BR-02 restano invariate e contano
  come "senza anno" nella sola sezione Età (FR-026, FR-026a).
- Messaggi già inviati: non aggiornati (nessun `editMessage*`), pulsanti vecchi validi (FR-029).

## Query e subrequest

Dettaglio in research R-11 (caso peggiore 200 persone, flusso attivo).

| Percorso | Batch D1 | Subrequest D1 | Totale con Telegram |
|---|---|---|---|
| `/gruppi` | [gruppi con conteggio, conteggio senza gruppo] | 2 (stato + batch) | ≤ 5 |
| Scheda "Senza gruppo" (`g2:s`) | [persone senza gruppo, gruppi con conteggio] | 2 (clear + batch) | 8 (5 messaggi + answer) |
| [⬅️ Tutti i gruppi] (`g2:l`) | come `/gruppi` | 2 | ≤ 5 |
| `/anno` | [conteggi, saltati, saltati in serie, `EXISTS` Y − 1] | 2 | 11 (9 messaggi) |
| `/statistiche` | [persone, gruppi, mesi, anni, nascite] | 2 | 3 |

**CPU della sezione Età** (200 persone): un passaggio lineare + 9 righe, < 0,1 ms (research R-07);
misurato con un `bench` nuovo in `bench/stato.bench.ts`.

## Test

### Esistenti da aggiornare

| File | Modifica |
|---|---|
| `test/unit/callback-data.test.ts` | forme `g2:l`, `g2:s`, `s:u`, `s:m:<n>`, `s:y:<aaaa>`, `g2:p:…:90`; malformati; ≤ 64 byte su tutte le tastiere nuove |
| `test/unit/statistiche.test.ts` | `formatStatistiche` con `births`/`today`; posizione della sezione Età; funzioni dell'età |
| `test/unit/liste.test.ts` | `renderGroupList` con `ungrouped` (0 gruppi, ≤ 60, 60 → 62 pulsanti, > 60), scheda gruppo con [⬅️ Tutti i gruppi], scelta senza voce virtuale |
| `test/unit/testi.test.ts` | inventario con le chiavi nuove; regola R6 per ◀️ ▶️ ⬅️ ➕ e assenza di icone in `btnUpcomingWide`/`btnUngrouped` |
| `test/integration/us6-gruppi.test.ts` | elenco con la voce virtuale; tastiera della scheda con due righe |
| `test/integration/v11-gruppi-ricerca.test.ts` | elenco dopo "nessun gruppo corrisponde" con la voce; `/gruppi senza` non apre la scheda virtuale |
| `test/integration/v11-statistiche.test.ts` | messaggio con la sezione Età (righe in più) |
| `test/integration/us5-gruppo-mese.test.ts` | `/mese` con tastiera sull'ultimo messaggio, anche vuota |
| `test/integration/us6-anno.test.ts` | `/anno` con i pulsanti secondo lo storico |
| `test/integration/us2-prossimi.test.ts` | `/prossimi` < 90 con [Prossimi 90 giorni], anche vuota |
| `test/integration/us2-inserimento.test.ts` | conferma del salvataggio con la riga [➕ Aggiungi un'altra persona] |
| `test/integration/v11-stile.test.ts` | elenco chiuso delle icone dei pulsanti esteso |
| `test/integration/viste-budget.test.ts` | `expectCompleteList`: tastiera ammessa sull'ultimo messaggio per `/prossimi` < 90, `/mese`, `/anno`; nuovi casi `g2:s`, `g2:l`, `s:y`, `s:u` con 200 persone entro R-11 |

### Nuovi

| File | Contenuto |
|---|---|
| `test/unit/navigazione.test.ts` | `adjacentMonths`, `yearNavigation`, `canWidenUpcoming` |
| `test/integration/v12-gruppi.test.ts` | US1, US2 ed edge case gruppi |
| `test/integration/v12-statistiche.test.ts` | US3 ed edge case Età |
| `test/integration/v12-navigazione.test.ts` | US4, US5, US6, RNF-14 (nuovo messaggio, ≤ 2 pulsanti, flusso sostituito, estraneo ignorato) |

### Copertura dei criteri Dato/Quando/Allora v1.2 (almeno un test ciascuno)

| Requisito | Criteri (spec) | Test |
|---|---|---|
| RF-01 | US6 1-5; edge "Salva comunque", "persona eliminata", scheda da `/p_`, `/cerca`, modifica, Segna fatto | `v12-navigazione`, `us2-inserimento` |
| RF-07 | US2 1-5; edge rubrica vuota, nome non riservato | `v12-gruppi`, `liste` |
| RF-17 | US5 1-5; edge 89/90, scelta tra candidati, gruppo rinominato, argomenti non validi | `v12-navigazione`, `us2-prossimi`, `navigazione` |
| RF-19 | US1 1-4; US2 6-8; edge rinomina, gruppo eliminato, N cambiato, rubrica vuota, scheda spezzata | `v12-gruppi` |
| RF-20 | US4 1-4; edge mese vuoto, mese non valido, cambio d'anno al tocco | `v12-navigazione`, `navigazione`, `us5-gruppo-mese` |
| RF-22 | US4 5-8; edge solo occorrenze aperte, anno non valido, anno corrente cambiato | `v12-navigazione`, `navigazione`, `us6-anno` |
| RF-32 | US3 1-8; edge 0 anni, 32,5, rubrica vuota, 1900, anno fuori BR-02, più gruppi | `v12-statistiche`, `statistiche` |
| RNF-14 | US4 9; ≤ 2 pulsanti per vista; tastiera sull'ultimo messaggio; durante un flusso; estraneo | `v12-navigazione`, `viste-budget` |
| RNF-19 | icone ◀️ ▶️ ⬅️ ➕; nessuna icona su [Prossimi 90 giorni] e [Senza gruppo (N)] | `testi`, `v11-stile` |

### Bench e smoke

- `npm run bench`: `/statistiche` cambia costo (sezione Età) → nuovo `bench` "sezione Età, 200
  persone" e scenario `/statistiche` aggiornato in `bench/stato.bench.ts`; `/gruppi` con 100
  gruppi + voce virtuale in `bench/liste.bench.ts`. Soglie dei file invariate.
- Postman: collection **2.5.0** (descrizione: feature 001–009), cartella "21 · Navigazione v1.2"
  prima della pulizia (che diventa "22"), con le richieste di [quickstart.md](quickstart.md) §2;
  `postman/README.md` e seed aggiornati se mancano persone senza gruppo o storico dell'anno prima.

## Project Structure

### Documentation (this feature)

```text
specs/009-revisioni-v1-2-navigazione/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── callback-data.md # pulsanti nuovi e compatibilità g2
│   ├── viste-v12.md     # layout di viste e tastiere
│   └── testi-v12.md     # testi nuovi e inventario
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── config.ts                 # UPCOMING_WIDE_DAYS, commento V-09
├── texts.ts                  # testi v1.2, MONTHS_CAP, AGE_BUCKET_LABELS
├── telegram/keyboard.ts      # g2:l, g2:s
├── bot/
│   ├── router.ts             # s:u, s:m, s:y
│   ├── gruppi.ts             # elenco, scheda gruppo, scheda "Senza gruppo"
│   ├── viste.ts              # /prossimi, /mese, /anno
│   ├── scheda.ts             # righe extra della tastiera
│   ├── statistiche.ts
│   └── flows/{nuovo.ts, gruppi.ts}   # (steps.ts verificato, invariato)
├── db/{groups.ts, viste.ts, statistiche.ts}
└── domain/{viste.ts, statistiche.ts}

test/
├── unit/{navigazione.test.ts (nuovo), callback-data, statistiche, liste, testi}
└── integration/{v12-gruppi, v12-statistiche, v12-navigazione (nuovi), + 9 aggiornati}

bench/{stato.bench.ts, liste.bench.ts}
postman/bot-compleanni.postman_collection.json   # 2.5.0
```

**Structure Decision**: progetto singolo esistente; nessun modulo nuovo in `src/`, solo funzioni
nuove nei moduli di dominio, db e bot già presenti.

## Complexity Tracking

Nessuna violazione della constitution: tabella non necessaria.
