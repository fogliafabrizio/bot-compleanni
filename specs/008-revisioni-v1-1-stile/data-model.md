# Data Model: Revisioni v1.1 — Guida di stile

**Feature**: 008-revisioni-v1-1-stile | **Date**: 2026-10-29

## Database D1

**Nessuna modifica** (FR-019): nessuna entità, colonna, indice o chiave di `settings` nuova;
nessuna migration (restano `migrations/0001_schema_iniziale.sql` e `0002_indice_retry.sql`);
nessuna conversione.

| Dato in produzione | Trattamento | Requisito |
|---|---|---|
| `settings.default_message` (valore iniziale "Tanti auguri {nome}! 🎉" o quello di `/messaggio`) | non letto né scritto dal rilascio; mostrato tra « » esattamente com'è | FR-006, FR-020, A-06 |
| `persons.custom_message` | idem | FR-006, FR-020 |
| `persons.full_name`, `persons.nickname`, `groups.name` | invariati; mostrati senza emoji aggiunte o tolte, anche nelle righe di lista | FR-021, FR-003 |
| `conversation_state` (flussi in corso, anteprima import in attesa) | contiene step e campi, non testi: il flusso prosegue con i testi nuovi | FR-023 |
| `deliveries`, `occurrences`, storico | invariati | FR-019 |
| Messaggi Telegram già inviati | non riscritti; `callback_data` invariato, i pulsanti funzionano | FR-022 |
| File di backup JSON già prodotti | formato invariato, ripristinabili | FR-016, FR-020 |

## Catalogo dei testi (`src/texts.ts`)

L'unica "entità" toccata è il catalogo `T`. Ogni voce ha:

| Attributo | Valori | Fonte |
|---|---|---|
| chiave | nome della proprietà di `T` (anche annidata: `editAsk.n`, `rowReason.*`) | `src/texts.ts` |
| tipo | titolo/intestazione · domanda · conferma · avviso · errore · informativo · frammento · riga di lista · pulsante di azione · pulsante di contatto | FR-004a |
| regola | emoji obbligatoria/vietata per tipo, vincoli di tono FR-001a | FR-002…FR-010 |
| forma | stringa o funzione pura degli argomenti (nessun accesso a dati o orologio) | RNF-15 |

Regole di validazione (verificate da `test/unit/testi.test.ts`):
- titolo e vista vuota → primo carattere visibile è un'emoji (`\p{Extended_Pictographic}`), una sola
  in testa;
- domanda di flusso → inizia con l'icona della mappa chiusa di FR-007 (eccezione: `confirmDate`,
  senza icona come §5.2);
- conferma → contiene 🎉 o ✅; avviso → inizia con ⚠️; errore → inizia con ❌;
- informativo → nessuna di 🎉 ✅ ⚠️ ❌;
- riga di lista e frammento contenuto in una riga → nessuna emoji;
- pulsante di azione → icona solo per `btnEdit`, `btnRename`, `btnDelete`, `btnDeleteGroup`,
  `btnSkip`, `btnNewGroup`, `btnOutcomeDone`; pulsante di contatto → mai.

Chiavi cambiate di forma (cablaggio, research R-01):

| Chiave | Prima | Dopo |
|---|---|---|
| `schedaNickname(name, nickname)` | stringa con nickname | rimossa, sostituita da `schedaTitle(name, nickname: string \| null)` |
| `schedaDate(date, when)` | — | nuova |
| `personSaved(name)` | — | nuova |
| `personUpdated(name)` | — | nuova |
| `personDeleted` | stringa | funzione `(name: string)` |

Inventario completo e testi: [contracts/testi.md](contracts/testi.md).
