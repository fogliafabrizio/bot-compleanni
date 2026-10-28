# Data model — 003 Viste e ricerche

**Nessuna modifica allo schema e nessuna migration.** La feature legge le tabelle della
migration 0001 ([data-model 001](../001-fondamenta-anagrafica/data-model.md),
[data-model 002](../002-promemoria-esiti/data-model.md)) e scrive solo su `occurrences`.

## Entità usate

| Entità (AFU §8) | Tabella | Uso in questa feature |
|---|---|---|
| Persona | `persons` | lettura: `id`, `full_name`, `nickname`, `birth_day`, `birth_month`, `birth_year` per le liste; tutti i campi per `/oggi` e la scheda |
| Gruppo | `groups`, `person_groups` | lettura: ricerca per `name_norm` (`/prossimi`, `/gruppo`), elenco dei gruppi esistenti, nomi dei gruppi nel reminder di `/oggi` |
| Occorrenza | `occurrences` | lettura: `/oggi`, `/scaduti`, `/anno`, scheda; scrittura: vedi sotto |
| Impostazioni | `settings` | lettura di `default_message` per il messaggio di `/oggi` |
| Invio | `deliveries` | **non** letta né scritta: i messaggi di `/oggi` non sono slot (FR-007) |

## Scritture su `occurrences`

| Origine | Statement | Condizione | Requisito |
|---|---|---|---|
| `/oggi` | `INSERT OR IGNORE (person_id, year, effective_date, 'aperta', created_at)` | persone con data effettiva = oggi; l'indice unico `(person_id, year)` scarta quelle esistenti. Se resta aperta, il ciclo orario la chiude a `non_confermato` a D+2 come ogni altra occorrenza (anche per una persona senza reminder programmati): voluto | FR-006, research R-06 |
| `t:f:<occId>` | `UPDATE … SET status = 'fatto', outcome_at = now` | `id = ? AND status = 'aperta'` | FR-007, BR-07 |
| `t:s:<occId>` | `UPDATE … SET status = 'saltato', outcome_at = now` | `id = ? AND status = 'aperta'` | FR-007, BR-07 |
| `p:f:<personId>` | `UPDATE … SET status = 'fatto', outcome_at = now` | `person_id = ? AND status <> 'fatto' AND effective_date BETWEEN oggi−7 AND ieri` | FR-017, FR-018, BR-08 |

Transizioni di stato (estende il diagramma di 002, nessuno stato nuovo):

```text
aperta ──Fatto (reminder, /oggi, recupero, Segna fatto)──▶ fatto        (definitivo, BR-08)
aperta ──Salta (pre, reminder, /oggi, recupero)─────────▶ saltato
aperta ──fine D+1 (ciclo orario)────────────────────────▶ non_confermato
saltato | non_confermato ──Fatto dal recupero o Segna fatto, entro D+7──▶ fatto
```

## Proiezioni di lettura (nuove)

```ts
// Riga di una lista anagrafica (§5.7).
interface ListPersonRow {
  id: number;
  full_name: string;
  nickname: string | null;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
}

// Riga di una lista storica (/scaduti, /anno): persona + occorrenza.
interface ListOccurrenceRow extends ListPersonRow {
  occurrence_id: number;
  year: number;
  effective_date: string;        // YYYY-MM-DD
  status: "aperta" | "saltato" | "non_confermato" | "fatto";
}

// Conteggi di /anno.
interface YearCounts { fatto: number; saltato: number; non_confermato: number }

// Dati del reminder di /oggi: PersonRowLike (002) + occorrenza.
interface TodayRow extends PersonRowLike {
  id: number;
  occurrence_id: number;
  year: number;
  status: OccurrenceStatus;
  last_year_status: OccurrenceStatus | null;
  default_message: string | null;
}

// Occorrenza in sospeso della scheda (al più una per persona).
interface PendingOccurrence { id: number; year: number; effective_date: string; status: OccurrenceStatus }
```

## Query (riassunto; SQL definitivo in fase di implementazione)

| Funzione (file) | Query | Indice |
|---|---|---|
| `groupLookupStatements(db, nameNorm)` (`src/db/viste.ts`) | `SELECT id, name FROM groups WHERE name_norm = ?`; persone del gruppo via `person_groups` con sottoquery su `name_norm`; elenco dei gruppi | `ux_groups_name_norm`, `idx_person_groups_group` |
| `listPersonsStatement(db, month?)` (`src/db/viste.ts`) | campi di `ListPersonRow` da `persons`, opzionale `WHERE birth_month = ?` | scansione (≤ 200 righe) |
| `overdueStatement(db, from, to)` (`src/db/viste.ts`) | `occurrences` con `effective_date BETWEEN ? AND ? AND status <> 'fatto'` JOIN `persons` (`/scaduti`) | `idx_occurrences_date` |
| `yearStatements(db, Y)` (`src/db/viste.ts`) | `SELECT status, COUNT(*) … WHERE year = ? AND status <> 'aperta' GROUP BY status`; saltati di Y; saltati di Y con `prev.year = Y−1` saltato | scansione / `ux_occurrences_person_year` sul join |
| `todayStatements(db, { pairs, year, effectiveDate, nowIso })` (`src/db/viste.ts`) | `INSERT OR IGNORE … SELECT FROM persons WHERE (birth_month, birth_day) IN coppie`; `SELECT` dati reminder + `GROUP_NAMES_SQL` + esito dell'anno prima + default | `ux_occurrences_person_year` |
| `applyTodayOutcome(db, { occurrenceId, action, nowIso })` (`src/db/oggi.ts`) | `UPDATE … WHERE id = ? AND status = 'aperta'` + `SELECT` dei campi di `TodayRow` | PK |
| `schedaStatements(db, personId, { from, to })` (`src/db/persons.ts`) | persona, gruppi, storico e, come quarto statement, l'occorrenza in sospeso (`effective_date BETWEEN ? AND ? AND status <> 'fatto'`) in una batch | PK, `ux_occurrences_person_year` |
| `markDoneStatement(db, personId, { from, to, nowIso })` (`src/db/persons.ts`) | `UPDATE … SET status = 'fatto' WHERE person_id = ? AND status <> 'fatto' AND effective_date BETWEEN ? AND ?` | `ux_occurrences_person_year` |

## Validazioni (dai requisiti)

| Input | Regola | Errore | Requisito |
|---|---|---|---|
| giorni di `/prossimi` | intero 1–366, default 30 | intervallo ammesso | FR-011 |
| gruppo | `normKey(nome)` = `groups.name_norm` | gruppo inesistente + elenco gruppi | FR-010, FR-014 |
| mese | nome italiano (case-insensitive) o 1–12, default corrente | formati ammessi | FR-015 |
| anno | 4 cifre, `MIN_BIRTH_YEAR` ≤ Y ≤ anno corrente, default corrente | anno non valido | FR-019 |
| testo di `/cerca` | non vuoto dopo `trim` | sintassi | FR-012 |

## Principio IX

Nessuna nuova tabella né vincolo: tutte le query restano filtrabili in futuro per un ID
proprietario.
