# Data model — Revisioni v1.3: Mezzanotte e profili incompleti

**Feature**: 010-revisioni-v1-3-mezzanotte-incompleti | Fonte: AFU v1.3 §8 e "Impatto della versione
1.3 → Modello dati" | Research: [R-01](research.md#r-01--slot-delle-0000-un-solo-punto-di-verità-in-srcconfigts), [R-06](research.md#r-06--regola-del-dato-mancante-un-frammento-sql-e-un-predicato-puro), [R-12](research.md#r-12--dati-in-produzione-e-migration)

## Schema D1

**Invariato. Nessuna migration** (FR-021): nessuna nuova tabella, colonna, indice o vincolo; nessun
file in `migrations/`.

| Tabella | Uso nella feature | Note |
|---|---|---|
| `deliveries` | nuove righe `kind = 'giorno'`, `ref = 0` | `ref INTEGER NOT NULL` senza `CHECK`: 0 già ammesso; `ux_deliveries_unique (occurrence_id, kind, ref)` distingue lo slot 0 dagli altri (N-02); `local_date` = data effettiva, quindi retry dalle 1:00 e abbandono il giorno dopo come oggi |
| `occurrences` | invariata | un'occorrenza Alta può nascere con l'esecuzione delle 00:00 (primo target del giorno) |
| `persons` | sola lettura per `/incomplete` e `/statistiche` | `phone`, `instagram`, `telegram`, `birth_year` facoltativi; nessuna normalizzazione dei valori anomali |
| `settings` | `cron_last_run` delle 00:00 ora mostrato "00:00"; hash di `BOT_COMMANDS` cambia → menu aggiornato | nessuna chiave nuova |

## Costanti (non persistite)

### Profilo di priorità *(AFU §7, `src/config.ts`)*

| Profilo | Pre-reminder (giorni prima, alle 13:00) | Slot del giorno | Recupero |
|---|---|---|---|
| Alta | 7, 2, 1 | **0**, 9, 13, 18, 21 *(v1.3)* | D+1 alle 13:00 |
| Media | 1 | 9, 13, 18 | D+1 alle 13:00 |
| Bassa | — | 9, 18 | D+1 alle 13:00 |

`SLOT_HOURS` = unione ordinata degli slot dei profili = `[0, 9, 13, 18, 21]` (derivata, R-01).
Messaggi di un'occorrenza lasciata senza risposta: Alta 3 + 5 + 1, Media 1 + 3 + 1, Bassa 0 + 2 + 1
(SC-002).

### Filtro dei profili incompleti *(RF-50, `src/domain/incomplete.ts`)*

Costante ordinata `INCOMPLETE_FILTERS`; il codice è il campo `id` del `callback_data` `s:i:<codice>`.

| Codice | Chiave | Argomento | Etichetta pulsante | Persone elencate (dato mancante) |
|---|---|---|---|---|
| 1 | `telefono` | `telefono` | Telefono | `phone` |
| 2 | `instagram` | `instagram` | Instagram | `instagram` |
| 3 | `telegram` | `telegram` | Telegram | `telegram` |
| 4 | `anno` | `anno` | Anno di nascita | `birth_year` |
| 5 | `contatti` | `contatti` | Nessun contatto | `phone` **e** `instagram` **e** `telegram` |

**Dato mancante** (FR-008, FR-017): `NULL`, testo vuoto o di soli spazi.

- SQL: `NULLIF(TRIM(col), '') IS NULL` (unico frammento, `missingSql` in `src/db/incomplete.ts`),
  usato da `/incomplete` (conteggi) e da `/statistiche` (`senza_anno`, `senza_contatti`).
- TypeScript: `isMissing(v)` → `v === null || (typeof v === "string" && v.trim() === "")`; un numero
  non è mai mancante.

Proprietà verificate dai test (SC-005):

- `contatti(p)` ⇒ `telefono(p) ∧ instagram(p) ∧ telegram(p)`;
- conteggio del filtro `contatti` = "Senza contatti" di `/statistiche`; conteggio `anno` = "Senza anno
  di nascita";
- un anno presente ma fuori da BR-02 non è mancante (spec, Assumptions).

## Entità calcolate (mai salvate)

### Profilo incompleto *(glossario AFU v1.3)*

Persona per cui `matchesFilter(p, f)` è vero per almeno un filtro 1…4. Nessun legame con la priorità.

```ts
interface IncompletePerson extends ListPerson {   // ListPerson di src/domain/viste.ts
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
}
```

Letta da `incompletePersonsStatement` (colonne `LIST_PERSON_COLUMNS` + contatti); `birthYear` è già in
`ListPerson`, ma per `isMissing` si usa il valore grezzo della colonna (può essere `''` in produzione).

### Conteggi dei filtri

```ts
interface IncompleteCounts { total: number; telefono: number; instagram: number; telegram: number; anno: number; contatti: number }
```

Da `incompleteCountsStatement` (SUM su tabella vuota = `NULL` → 0). `total = 0` non cambia il menu
(5 pulsanti con 0, FR-009); cambia solo la risposta di una lista (rubrica vuota, FR-013).

## Transizioni

Nessuna transizione nuova. L'Invio dello slot 0 segue gli stati di 002: `in_invio → inviato`,
`in_invio → fallito → (retry stesso giorno) → inviato | abbandonato`; l'occorrenza segue
`aperta → fatto | saltato | non_confermato` (BR-07, BR-09).
