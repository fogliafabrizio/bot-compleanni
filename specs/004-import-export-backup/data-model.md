# Data Model: Import, export e backup

**Feature**: `004-import-export-backup` | **Data**: 2026-10-28 | **Research**: [research.md](research.md)

**Nessuna migration.** Lo schema di `migrations/0001_schema_iniziale.sql` copre già tutto: la
feature scrive su `persons`, `groups`, `person_groups` (import), sostituisce tutte le tabelle di
dominio (ripristino), usa una chiave nuova di `settings` (backup mensile) e due flussi nuovi in
`conversation_state` (colonna `flow` senza `CHECK`, valori validati da `FLOW_NAMES`).

## Tabelle esistenti: uso in questa feature

| Tabella | Import (Importa) | Export | Backup | Ripristino |
|---|---|---|---|---|
| `persons` | INSERT (N righe) | lettura | lettura | DELETE + INSERT con id |
| `groups` | INSERT OR IGNORE (gruppi da creare) | lettura | lettura | DELETE + INSERT con id |
| `person_groups` | INSERT OR IGNORE | lettura | lettura | cascade + INSERT |
| `occurrences` | — | — | lettura | cascade + INSERT con id; chiusura delle aperte con D+1 concluso |
| `deliveries` | — | — | **esclusa** | cascade (svuotata) |
| `settings` `default_message` | — | — | lettura | DELETE + INSERT se presente |
| `settings` `auto_backup` | — | — | reclamo/esito del backup mensile | **non toccata** |
| `conversation_state` | stato `import`, consumato | — | — | stato `ripristina`, consumato |

## Chiave nuova di `settings`: `auto_backup` *(RF-27, FR-023, FR-023a)*

| Campo | Valore |
|---|---|
| `key` | `auto_backup` |
| `value` | `AAAA-MM:<stato>`, es. `2026-11:inviato` |
| `updated_at` | ISO UTC dell'ultima scrittura |

Stati (stesse parole di `deliveries.status`, research R-11):

```text
(assente | mese precedente | AAAA-MM:fallito) --reclamo (dovuto)--> AAAA-MM:in_invio
AAAA-MM:in_invio --sendDocument ok--> AAAA-MM:inviato
AAAA-MM:in_invio --errore Telegram--> AAAA-MM:fallito   (ritentato all'ora successiva)
AAAA-MM:in_invio --guasto tra reclamo ed esito--> resta in_invio (nessun nuovo invio nel mese)
```

L'unicità per mese è garantita dallo statement di reclamo (`ON CONFLICT … WHERE`), non dalla
logica applicativa (principio VII). Una sola riga per istanza: in un futuro multi-utente la
chiave diventerebbe per proprietario come `default_message` (principio IX).

## Flussi nuovi in `conversation_state` *(FR-014, FR-019, FR-021)*

`FLOW_NAMES` diventa `["nuovo", "modifica", "elimina", "gruppi", "messaggio", "import",
"ripristina"]`. Scadenza 24 ore e `flow_id` come gli altri flussi.

### Flusso `import`, step `anteprima`

`data` (JSON):

```ts
interface ImportState {
  rows: ImportRow[];          // righe valide e non duplicate al momento dell'anteprima
  preview: {                  // per il riepilogo breve di repeatStep
    newCount: number;
    duplicateCount: number;
    errorCount: number;
    exampleSkipped: boolean;
    groupsToCreate: string[]; // grafia della prima occorrenza
  };
}

interface ImportRow {
  line: number;               // numero di riga del foglio (FR-009)
  fullName: string;
  fullNameNorm: string;       // normKey(fullName)
  nickname: string | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  phone: string | null;       // E.164
  instagram: string | null;   // senza @
  telegram: string | null;    // senza @
  priority: "alta" | "media" | "bassa";
  customMessage: string | null;
  groups: { name: string; nameNorm: string }[]; // già senza vuoti e ripetuti
}
```

Dimensione: ≤ 500 righe × ~250 byte ≈ 125 KB (limite D1 di riga: 2 MB).

### Flusso `ripristina`, step `file` → `conferma1` → `conferma2`

```text
/ripristina ──► file ──(JSON valido)──► conferma1 ──Continua──► conferma2 ──Sì, ripristina──► batch ► (stato consumato)
                 │  (JSON non valido: motivo, resta in file)      │                    │
                 └─────────── Annulla / /annulla / altro comando / CSV / 24 h ──────────┴──► (stato cancellato, dati invariati)
```

`data`: `{}` allo step `file`; dagli step di conferma `{ backup: Backup }` (forma normalizzata
sotto, ~250 KB con 200 persone e 2000 occorrenze).

## Entità logiche (non tabelle)

### File CSV *(BR-18…BR-22, FR-001…FR-006)*

Formato completo in [contracts/csv.md](contracts/csv.md). Righe del file → per ciascuna uno tra:

| Esito della riga | Condizione | Conta in |
|---|---|---|
| vuota | tutte le celle vuote | niente (ma numerata) |
| esempio | valida e uguale alla riga d'esempio (FR-007a) | "riga d'esempio ignorata" |
| errore | almeno un valore non valido (FR-010) | errori, con tutti i motivi |
| duplicato | duplicato di una persona esistente o di una riga precedente valida (FR-011) | duplicati |
| nuova | altrimenti | nuove → `ImportRow` |

### Anteprima di import *(RF-24, §5.8)*

Risultato puro di `buildPreview(records, existingKeys, existingGroups, today)`:
`{ rows: ImportRow[]; duplicates: {line, fullName, date}[]; errors: {line, reasons[]}[];
exampleSkipped; groupsToCreate[] }`. È ricalcolata a Importa sulle `rows` salvate (research R-06).

### Backup *(RF-26, FR-017, FR-020)*

Schema JSON v1 in [contracts/backup-json.md](contracts/backup-json.md). Forma normalizzata dopo
la validazione (`parseBackup`): le stesse liste del file con `full_name_norm` e `name_norm`
aggiunti, pronte per i parametri `json_each` del ripristino.

Regole di coerenza (validazione, research R-09):

- `persons[].id`, `groups[].id`, `occurrences[].id` interi positivi e unici nella propria lista;
- `normKey(groups[].name)` unico;
- `person_groups` riferisce persone e gruppi presenti, coppie uniche;
- `occurrences[].person_id` presente, `(person_id, year)` unico;
- valori delle persone validi con le regole del guidato (R-04); `status` in
  `aperta|fatto|saltato|non_confermato`; `effective_date` data reale `AAAA-MM-GG`;
- `settings.default_message` `null` o messaggio valido (FR-035 di 002).

### Riepiloghi

- **Conteggi per la prima conferma** (FR-019): persone, gruppi, occorrenze del backup e dei
  dati attuali (`SELECT COUNT(*)` ×3 in una batch).
- **Riepilogo finale** (FR-020): persone, gruppi, occorrenze ripristinate e messaggio di default
  (personalizzato o standard).
