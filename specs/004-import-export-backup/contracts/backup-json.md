# Contratto — File di backup JSON (versione 1)

Riferimenti: RF-26, RF-27, RNF-09, RNF-11; FR-017…FR-025 della spec. Codice:
`src/domain/backup.ts` (costruzione e `parseBackup`), `src/db/backup.ts` (lettura e batch di
ripristino). Nome del file: `compleanni-backup-AAAA-MM-GG.json` (data locale). MIME
`application/json`, UTF-8 senza BOM, JSON compatto.

## Schema

```jsonc
{
  "format": "bot-compleanni-backup",      // costante
  "version": 1,                           // BACKUP_FORMAT_VERSION in config.ts
  "created_at": "2026-11-01T08:00:00.000Z",
  "persons": [
    {
      "id": 12,
      "full_name": "Marco Rossi",
      "nickname": null,
      "birth_day": 14, "birth_month": 3, "birth_year": 1985,   // birth_year può essere null
      "phone": "+393331234567",           // null o E.164
      "instagram": null, "telegram": "marcorossi",              // senza @
      "priority": "media",                // alta | media | bassa
      "custom_message": null,             // null = usa il default
      "created_at": "…", "updated_at": "…"
    }
  ],
  "groups": [ { "id": 3, "name": "Famiglia" } ],
  "person_groups": [ { "person_id": 12, "group_id": 3 } ],
  "occurrences": [
    {
      "id": 40, "person_id": 12, "year": 2026,
      "effective_date": "2026-03-14",
      "status": "fatto",                  // aperta | fatto | saltato | non_confermato
      "outcome_at": "…",                  // null se aperta
      "created_at": "…"
    }
  ],
  "settings": { "default_message": null } // null = messaggio di default iniziale (A-06)
}
```

Liste ordinate per `id` (per `person_id, group_id` le appartenenze). Non contiene
`full_name_norm`, `name_norm` (ricalcolati), `deliveries`, `conversation_state`, né la chiave
`auto_backup` (research R-08).

## Validazione (`parseBackup`) — rifiuto al primo errore *(FR-018, SC-006)*

| Controllo | Messaggio all'utente (`texts.ts`) |
|---|---|
| file non decodificabile in UTF-8 o non JSON | `Il file non è un JSON valido.` |
| `format` diverso o campi principali mancanti | `Il file non è un backup di questo bot.` |
| `version` ≠ 1 | `Versione del backup non supportata (<v>).` |
| tipo o valore di un campo non valido (stesse regole del guidato: nome, lunghezze, data, telefono, username, priorità, messaggi, nomi di gruppo; `status`; `effective_date` reale) | `Backup non valido: <entità> <id>, campo <campo>.` |
| id ripetuto in una lista | `Backup non valido: <entità> <id> ripetuta.` |
| due gruppi con lo stesso nome (senza maiuscole) | `Backup non valido: gruppi con lo stesso nome.` |
| appartenenza o occorrenza verso persona/gruppo assente | `Backup non valido: riferimento a <entità> <id> inesistente.` |
| due occorrenze per la stessa persona e anno | `Backup non valido: occorrenze ripetute per la persona <id>.` |

I messaggi contengono solo id e nomi di campo, mai valori personali. Dopo il messaggio il flusso
resta allo step `file`: si può inviare un altro file o annullare.

## Ripristino — semantica *(FR-020, FR-020a, RNF-11)*

Una sola `db.batch` (transazione), con la guardia del flusso `ripristina` su ogni statement:

1. `DELETE FROM persons` (cascade: `person_groups`, `occurrences`, `deliveries`);
   `DELETE FROM groups`; `DELETE FROM settings WHERE key = 'default_message'`.
2. `INSERT` da `json_each` di `groups`, `persons`, `person_groups`, `occurrences`, mantenendo
   gli `id`; `full_name_norm` e `name_norm` calcolati con `normKey`.
3. `INSERT` di `default_message` se non `null`.
4. `UPDATE occurrences SET status = 'non_confermato', outcome_at = <now> WHERE status = 'aperta'
   AND effective_date <= <oggi − 2>` (D+1 concluso; stessa regola del ciclo orario).
5. `DELETE` dello stato del flusso.

Garanzie:

- tutto o niente: un errore in qualunque statement lascia i dati precedenti;
- `/p_<id>` del backup apre la stessa persona; gli id nuovi creati dopo restano maggiori di tutti
  quelli mai usati (nessun azzeramento di `sqlite_sequence`);
- nessun messaggio inviato per le occorrenze chiuse al punto 4; le occorrenze aperte con D o D+1
  oggi ricevono solo i promemoria il cui orario non è passato (`deliveries` vuota, il ciclo
  orario pianifica solo l'ora corrente);
- `auto_backup` non cambia: il ripristino non provoca un nuovo backup mensile.

**Proprietà verificata dai test** (SC-005, FR-025): `ripristina(backup(D))` produce persone
(con id), gruppi, appartenenze, occorrenze con esiti e messaggio di default identici a `D`, sia
per il backup di `/backup` sia per quello mensile.
