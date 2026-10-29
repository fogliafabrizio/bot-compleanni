# Data model — Revisioni v1.1, Gruppi (feature 005)

**Nessuna migration** (FR-015, research R-12). Lo schema di `migrations/0001_schema_iniziale.sql` e
`0002_indice_retry.sql` resta invariato.

## Tabelle esistenti usate

### `groups` (spec 001, AFU §8) — invariata

| Colonna | Uso in 005 |
|---|---|
| `id` | identifica il gruppo nei pulsanti `g2` (contracts/callback-data.md) |
| `name` | nome mostrato, **mai riscritto** (FR-016); base di `groupKey` (BR-26) e di `nameHash` (FR-005) |
| `name_norm` | `normKey(name)` = `trim().toLowerCase()`; resta la chiave dell'unicità BR-17 (indice unico). **Non** è la chiave di ricerca |

Due gruppi con la stessa chiave BR-26 ma `name_norm` diverso ("Famiglia" e "👨‍👩‍👧 Famiglia")
restano entrambi validi (BR-17): la ricerca li propone come scelta (spec, casi limite).

### `person_groups` — invariata

Letta per conteggi (`COUNT(pg.person_id)`) e per le persone della scheda e del filtro di
`/prossimi`. La cascata su `DELETE FROM groups` rimuove le appartenenze, le persone restano
(001 FR-022, invariato).

### `persons` — invariata

Solo le colonne delle liste (`LIST_PERSON_COLUMNS` di `src/db/viste.ts`).

### `settings` — nuova riga, nessuna modifica di struttura

| `key` | `value` | Scritta da |
|---|---|---|
| `bot_commands` | `nameHash(JSON.stringify(BOT_COMMANDS))` del menu registrato | `syncBotCommands` del cron (research R-10) |

Riga assente = menu mai sincronizzato → al primo cron utile si chiama `setMyCommands`.

### `conversation_state` — invariata

Il flusso `gruppi` cambia solo step e dati (research R-05):

| Step | Tipo | Dati (`data`) | Azioni di flusso |
|---|---|---|---|
| `crea` | testo | `{}` | `a` |
| `rinomina` | testo | `{ groupId, groupName }` | `a` |
| `elimina` | pulsanti | `{ groupId, groupName }` | `y`, `a` |

Stati salvati con gli step vecchi (`nome`, `scelta`, `conferma`) non trovano lo step: testo →
stato cancellato e "Non ho capito"; pulsante → "Questa azione non è più disponibile" (FR-017).

## Valori derivati (non salvati)

### Chiave di ricerca — `groupKey(name)` (BR-26, FR-006)

Pura, in `src/domain/text.ts`. Keycap → spazio; `searchKey` (NFD, senza `\p{M}`, minuscolo);
non `\p{L}`/`\p{Nd}` → spazio; spazi compattati e tolti ai bordi. Dettagli e casi in research R-02.

### Validità del nome — `hasValidGroupKey(name)` (FR-006a)

`groupKey(name).length >= GROUP_KEY_MIN_LENGTH` (2, `src/config.ts`). Applicata in creazione
(flusso `gruppi` step `crea`, `newGroupStep` di `nuovo`/`modifica`, import CSV per i gruppi da
creare) e in rinomina. **Non** applicata ai gruppi esistenti né al ripristino da backup (FR-016).

Regole complete del nome di un gruppo dopo la feature:

| Regola | Fonte | Dove |
|---|---|---|
| non vuoto dopo `trim` | 001 FR-010a | `cleanText` |
| ≤ 30 code point | 001 FR-010a | `cleanText`, `TEXT_LIMITS.groupName` |
| chiave BR-26 ≥ 2 caratteri | **005 FR-006a** | `hasValidGroupKey` |
| `name_norm` unico (escluso sé stesso in rinomina) | BR-17 | `existsNorm` + indice unico |

### Hash del nome — `nameHash(s)` (FR-005)

FNV-1a 32 bit sulle unità UTF-16, in base 36 (1–7 caratteri). Nei pulsanti `g2` lega il pulsante
al nome esatto mostrato; usato anche per la riga `settings.bot_commands`.

### Esito della ricerca — `findGroups(groups, query)` (FR-007, FR-011)

```ts
type GroupSearch<G> =
  | { kind: "empty" }               // chiave del testo vuota → come senza testo
  | { kind: "one"; group: G }       // un solo trovato o una sola corrispondenza esatta
  | { kind: "many"; groups: G[] }   // candidati ordinati con sortGroups
  | { kind: "none" };
```

### Vista "Scheda gruppo" (FR-008)

Non è un dato: gruppo (`id`, `name`), numero di persone, righe di lista di 003. Contratto in
[contracts/gruppi.md](contracts/gruppi.md).

## Transizioni

```
/gruppi ──► Elenco ──tap g2:o──► Scheda ──g2:r──► flusso gruppi/rinomina ──nome valido──► Scheda aggiornata
   │            │                   │                                        └─nome non valido─► stessa domanda
   │            └─g2:n──► flusso gruppi/crea ──► Elenco (con conferma)
   │                                └─g2:x──► flusso gruppi/elimina ──Sì──► Elenco (con conferma)
/gruppi <t> ──► one: Scheda | many: Scelta ──tap g2:o──► Scheda | none: avviso + Elenco | empty: Elenco
/prossimi [N] <t> ──► one: lista N giorni | many: Scelta ──tap g2:p──► lista N giorni | none: avviso + Elenco | empty: senza filtro

Ogni tap g2:{o,p,r,x} con gruppo eliminato o rinominato ──► "Il gruppo non esiste più." + Elenco
Ogni tap g:* o f:<id>:sg (pre-rilascio) ──► "Questa azione non è più disponibile"
```
