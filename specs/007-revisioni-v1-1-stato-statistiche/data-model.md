# Data model: Revisioni v1.1 — Stato e statistiche

**Feature**: `007-revisioni-v1-1-stato-statistiche` | **Data**: 2026-10-29

**Nessuna migration.** Schema di `migrations/0001_schema_iniziale.sql` e `0002_indice_retry.sql`
invariato: `settings` è chiave/valore (`key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT
NOT NULL`) e accoglie le chiavi nuove senza modifiche; nessun indice nuovo (research R-07).

## Impostazioni (`settings`) — modifica spec 002 Key Entities, AFU §8

| Chiave | Tipo di dato | Valore | Scritta da | Letta da | Nel backup |
|---|---|---|---|---|---|
| `default_message` | utente (invariata) | testo del messaggio di default | `/messaggio`, ripristino | ciclo orario, `/messaggio`, backup | **sì** |
| `bot_commands` | tecnica (005, invariata) | hash di `BOT_COMMANDS` | `src/cron/comandi.ts` | `src/cron/comandi.ts` | no |
| `auto_backup` | tecnica (004) | `AAAA-MM:<stato>`, stato ∈ `in_invio`, `inviato`, `fallito`, **`errore`** (nuovo) | `src/cron/backup-mensile.ts` | `src/cron/backup-mensile.ts` (reclamo) | no |
| **`cron_last_run`** | tecnica (N-06, RF-31) | ISO 8601 UTC dell'ora piena prevista dell'ultima esecuzione, es. `2026-10-29T14:00:00.000Z` | `src/cron/hourly.ts` (batch di lettura) | `src/cron/hourly.ts` (buco), `/stato` | no |
| **`auto_backup_last`** | tecnica (RF-31) | JSON `{"at":"<ISO UTC>","esito":"in_invio"\|"riuscito"\|"non_riuscito"}` | `src/cron/backup-mensile.ts` | `/stato` | no |

**Regole**

- Riga assente = "non registrato" → `/stato` mostra "mai registrato/a" (FR-001, FR-011).
- `cron_last_run` non torna mai indietro (`WHERE excluded.value > settings.value`, research R-02).
- `auto_backup_last.at` è l'istante del reclamo del tentativo, identico nelle due scritture
  (`in_invio`, poi esito); `esito = in_invio` letto da `/stato` = "esito sconosciuto" ⚠️.
- `auto_backup = AAAA-MM:errore` (errore non Telegram intercettato): come `inviato` e `in_invio`,
  blocca altri tentativi nello stesso mese (004 FR-023, chiarimento 2026-10-29); `fallito` resta
  l'unico stato ritentato (004 FR-023a).
- Le chiavi tecniche **non entrano** nel file di backup e il ripristino **non le modifica**
  (research R-06): backup e ripristino operano solo su `default_message`.
- Valori di `/stato` mostrati all'utente; nei log mai valori, solo nomi di evento, codici e
  conteggi (principio V).

**Transizioni di `auto_backup_last`** (per tentativo mensile):

```text
(assente) ──reclamo──▶ in_invio ──sendDocument ok──▶ riuscito
                          │──TelegramError / altro errore──▶ non_riuscito
                          └──interruzione──▶ (resta in_invio: ⚠️ esito sconosciuto)
tentativo successivo (solo dopo fallito, ore seguenti) ──reclamo──▶ in_invio …
```

## Invio (`deliveries`) — nessuna colonna nuova

Uso di `sent_at` esteso (research R-04):

| Stato | `sent_at` prima | `sent_at` da questa feature |
|---|---|---|
| `in_invio` | `NULL` | istante del reclamo (`nowIso`) |
| `inviato` | istante di invio | invariato |
| `fallito` | `NULL` | `NULL` (azzerato nell'esito di errore) |
| `abbandonato` | come prima del passaggio | invariato |

Classificazione per `/stato` (finestra `local_date ∈ [oggi − 6, oggi]`):

| Condizione | Conteggio |
|---|---|
| `status = 'inviato'` | inviati |
| `status = 'fallito' AND local_date = oggi` | falliti (in attesa di nuovo tentativo) |
| `status = 'abbandonato'` | abbandonati |
| `status = 'fallito' AND local_date < oggi` | abbandonati (giornata conclusa, N-03) |
| `status = 'in_invio' AND NOT (sent_at >= hourStartIso)` | abbandonati (esito sconosciuto) |
| `status = 'in_invio' AND sent_at >= hourStartIso` | non contati (esecuzione in corso) |

`hourStartIso` = ora piena di `now` in UTC (`toIso(floorToHour(now))`): è corrente solo un invio
reclamato nell'ora in corso, anche con il cron fermo (research R-04).

Righe in produzione: `in_invio` anteriori al deploy hanno `sent_at NULL` → abbandonati; nessuna
conversione (FR-021).

## Persona, Gruppo, Appartenenza, Occorrenza — invariate

Lette da `/statistiche` con aggregati SQL (research R-08):

- **Persona**: totale; per `priority`; `birth_year IS NULL`; nessun contatto =
  `phone IS NULL AND instagram IS NULL AND telegram IS NULL`; senza gruppo = nessuna riga in
  `person_groups`; per `birth_month`.
- **Gruppo + Appartenenza**: conteggio per gruppo con `LEFT JOIN` (gruppi vuoti a 0); una persona
  in più gruppi conta in ciascuno.
- **Occorrenza**: per `year`, `fatto` su chiuse (`status <> 'aperta'`); anni con sole aperte
  esclusi.

## Dati in produzione

- `cron_last_run` e `auto_backup_last` assenti al deploy; nascono alla prima esecuzione oraria e
  al primo tentativo di backup mensile dopo il deploy. Prima esecuzione: nessun avviso (FR-020).
- `auto_backup` già presente: formato invariato, nessuna conversione.
- Persone, gruppi, occorrenze, invii, messaggi: nessuna scrittura dovuta al rilascio (SC-006).
