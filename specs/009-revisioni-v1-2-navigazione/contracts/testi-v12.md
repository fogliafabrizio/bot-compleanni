# Contratto — testi nuovi e modificati v1.2 (`src/texts.ts`)

**Requisiti**: RNF-15, RNF-19, FR-009, FR-023, FR-024 | Estende
[contracts/testi.md di 008](../../008-revisioni-v1-1-stile/contracts/testi.md) (tipi e regole
R1…R7 invariati).

Ogni chiave nuova entra in `INVENTARIO` di `test/unit/testi.test.ts` con il tipo indicato. I testi
seguono i mockup AFU §5.2, §5.7, §5.9, §5.11; dove il mockup non dà il testo, la formulazione segue
R1 (tono di 008).

## Costanti

| Nome | Valore | Note |
|---|---|---|
| `MONTHS_CAP` *(nuova)* | `MONTHS_IT` con l'iniziale maiuscola (Gennaio…Dicembre) | come `MONTHS_SHORT`; etichette dei pulsanti di `/mese` |
| `AGE_BUCKET_LABELS` *(nuova)* | `["0-9", "10-19", …, "70-79", "80+"]` | 9 etichette della sezione Età |

## Gruppi (RF-07, RF-19)

| Chiave | Tipo | Testo | Regola |
|---|---|---|---|
| `btnAllGroups` *(nuova)* | PA | ⬅️ Tutti i gruppi | R6, R7 §5.9, FR-023 |
| `btnUngrouped(n)` *(nuova)* | PA | Senza gruppo ({n}) | R6, senza emoji (FR-023) |
| `ungroupedCardTitle(n)` *(nuova)* | T | 👥 Senza gruppo · 1 persona / {n} persone | R2, R7 §5.9; stessa forma di `groupCardTitle` |
| `allGrouped` *(nuova)* | I | Ora tutte le persone hanno un gruppo. | R1; seguito dall'elenco gruppi (FR-008) |
| `help` (riga `/gruppi [nome]`) *(modificata)* | T | /gruppi [nome] — elenco gruppi a pulsanti, con la voce "Senza gruppo"; con un nome cerca il gruppo e apre la scheda | §5.1, FR-009 |

## Viste (RF-17, RF-20, RF-22)

| Chiave | Tipo | Testo | Regola |
|---|---|---|---|
| `btnUpcomingWide` *(nuova)* | PA | Prossimi 90 giorni | R6, senza icona (FR-023); 90 = `UPCOMING_WIDE_DAYS` |
| `btnPrevMonth(name)` *(nuova)* | PA | ◀️ {name} | R6, freccia verso l'esterno |
| `btnNextMonth(name)` *(nuova)* | PA | {name} ▶️ | R6 |
| `btnPrevYear(y)` *(nuova)* | PA | ◀️ {y} | R6 |
| `btnNextYear(y)` *(nuova)* | PA | {y} ▶️ | R6 |

## Inserimento (RF-01)

| Chiave | Tipo | Testo | Regola |
|---|---|---|---|
| `btnAddAnother` *(nuova)* | PA | ➕ Aggiungi un'altra persona | R6, R7 §5.2 |
| `personSaved` | C | 🎉 Fatto! {name} è in rubrica. | invariato |

## Statistiche (RF-32)

| Chiave | Tipo | Testo | Regola |
|---|---|---|---|
| `statsAgeTitle` *(nuova)* | T | 🧑 Età | R2, R7 §5.11 |
| `statsAgeRow(label, bar, n, width)` *(nuova)* | R | `{label padEnd 5} {bar padEnd STATS_BAR_WIDTH} {n padStart width}` | R3 (nessuna emoji), monospazio |
| `statsAgeAverage(avg, without)` *(nuova)* | F | Età media: {avg} anni · senza anno di nascita: {without} — con `without = 0` solo "Età media: {avg} anni"; `avg = 1` → "1 anno" | R7 §5.11, FR-013 |
| `statsAgeUnavailable` *(nuova)* | I | Età non disponibile: nessuna persona ha l'anno di nascita. | R1, FR-014 |
| `statsNoGroup(n)` | F | Senza gruppo {n} | invariato (007) |

## Icone dei pulsanti (FR-023)

L'elenco chiuso di 008 FR-009 si estende con ◀️ ▶️ ⬅️ ➕ (➕ era già usata da `btnNewGroup`).
Test: `test/integration/v11-stile.test.ts` (elenco chiuso) e `test/unit/testi.test.ts` (regola R6
per tipo PA): [Prossimi 90 giorni] e [Senza gruppo (N)] **senza** emoji.
