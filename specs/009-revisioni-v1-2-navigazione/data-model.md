# Data model — Revisioni v1.2: Navigazione

**Feature**: 009-revisioni-v1-2-navigazione | **AFU**: "Impatto della versione 1.2", §Modello dati;
§8; glossario (Senza gruppo, Pulsante di passo successivo)

## Schema D1

**Nessuna modifica.** Nessuna nuova tabella, colonna, indice o migration (FR-025; AFU v1.2:
"Nessuna nuova entità, nessun nuovo attributo, nessuna migration"). `migrations/` resta con
`0001_schema_iniziale.sql` e `0002_indice_retry.sql`.

Tabelle **lette** dalla feature (mai scritte da codice nuovo):

| Tabella | Colonne usate | Per |
|---|---|---|
| `persons` | `id`, `full_name`, `nickname`, `birth_day`, `birth_month`, `birth_year` | scheda "Senza gruppo", conteggio N, sezione Età |
| `person_groups` | `person_id` (PK `(person_id, group_id)`) | `NOT EXISTS` delle persone senza appartenenze |
| `groups` | `id`, `name` | elenco gruppi (invariato) |
| `occurrences` | `year`, `status` | esistenza dello storico chiuso dell'anno precedente (`/anno`) |

## Entità calcolate (non salvate)

### Senza gruppo *(RF-07, RF-19, D-31)*

- **Definizione**: insieme delle persone `p` per cui `NOT EXISTS (SELECT 1 FROM person_groups pg
  WHERE pg.person_id = p.id)`.
- **Attributi calcolati**: `n` (conteggio), lista delle persone (colonne di lista di 003).
- **Non ha**: id, nome salvato, Rinomina, Elimina, ricerca per nome, presenza in export/backup.
- **Distinta** da un eventuale gruppo reale `groups.name = 'Senza gruppo'` (FR-005, FR-027): nessun
  confronto sul nome nel codice.
- **Validità**: calcolata al tocco; il numero sul pulsante non conta (FR-008).

Statement (in `src/db/groups.ts`):

| Nome | SQL (forma) | Righe |
|---|---|---|
| `ungroupedCountStatement` | `SELECT COUNT(*) AS n FROM persons p WHERE NOT EXISTS (…)` | 1 |
| `ungroupedPersonsStatement` | `SELECT <LIST_PERSON_COLUMNS> FROM persons p WHERE NOT EXISTS (…)` | ≤ 200 |

Tipo applicativo: `GroupListData = { groups: GroupWithCount[]; ungrouped: number }`, prodotto da
`readGroupList(db)` (batch [`listWithCountsStatement`, `ungroupedCountStatement`]) e dalle batch
che già leggono i gruppi (ricerca, eliminazione: research R-02).

### Età attuale *(RF-32, BR-03 per `/statistiche`, BR-04, BR-02)*

- **Input**: `birth_day`, `birth_month`, `birth_year` della persona; `today` in Europe/Rome
  (iniettato, `toLocal(deps.now())`).
- **Validità dell'anno**: `MIN_BIRTH_YEAR (1900) ≤ birth_year ≤ today.year`; altrimenti la persona
  conta come "senza anno di nascita" (FR-026a), dato invariato.
- **Regola**: `today.year − birth_year`, meno 1 se `today` < data effettiva del compleanno di
  quest'anno (`effectiveDate`: 29/02 → 28/02 negli anni non bisestili); risultato minimo 0.
- **Fasce**: `0-9`, `10-19`, …, `70-79`, `80+` (età ≥ 80, comprese ≥ 120).
- **Età media**: `Math.round(Σ età / n)`, solo con n ≥ 1.

Statement (quinta della batch di `src/db/statistiche.ts`):

| Nome | SQL | Righe |
|---|---|---|
| (5ª di `statisticheReadStatements`) | `SELECT birth_day, birth_month, birth_year FROM persons WHERE birth_year IS NOT NULL` | ≤ 200 |

Tipo: `StatsBirthRow = { birth_day: number; birth_month: number; birth_year: number }`;
`StatisticheData` riceve `births: readonly StatsBirthRow[]` e `today: LocalDate`.

### Storico dell'anno precedente *(RF-22)*

- **Definizione**: `EXISTS (SELECT 1 FROM occurrences WHERE year = <anno mostrato − 1> AND status <>
  'aperta')`.
- Quarta statement di `yearStatements` (`src/db/viste.ts`), stessa batch.

### Pulsante di passo successivo *(RNF-14)*

Non è un dato: è un `InlineKeyboardButton` con `callback_data` senza stato
([contracts/callback-data.md](contracts/callback-data.md)). Massimo 2 per vista, sempre in fondo,
sull'ultimo messaggio; mai sulle righe delle persone.

## Stati e transizioni

Nessuna transizione nuova sui dati. Sul flusso guidato: ogni nuovo pulsante (`g2:l`, `g2:s`,
`s:u`, `s:m`, `s:y`, `s:n`) **sostituisce** il flusso in corso, come i pulsanti senza stato
esistenti (`clear` nel router) e come il comando corrispondente (001 FR-018).

## Dati in produzione

| Dato | Trattamento |
|---|---|
| Persone senza anno di nascita | escluse dall'Età, contate nel richiamo (FR-026); invariate |
| Persone con anno fuori da BR-02 | contate come senza anno nell'Età (FR-026a); invariate |
| Gruppo reale "Senza gruppo" | invariato, elencato come gli altri (FR-027) |
| Export, backup, ripristino | invariati; il gruppo virtuale non esiste in `groups` (FR-028) |
| Messaggi già inviati | non aggiornati; i loro pulsanti (`g2:*`, `s:*`, `p:*`, `f:*`) funzionano come oggi (FR-029, FR-030) |
