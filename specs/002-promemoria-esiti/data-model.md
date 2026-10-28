# Data model — 002 Promemoria ed esiti

**Fonte**: AFU §7, §8 · **Schema di base**: [data-model 001](../001-fondamenta-anagrafica/data-model.md)
e `migrations/0001_schema_iniziale.sql`.

Le tabelle `occurrences`, `deliveries` e `settings` esistono già dalla migration 0001: questa
feature non cambia colonne né vincoli. Aggiunge un indice (migration `0002`) e fissa la semantica
dei valori. Convenzioni come nella feature 001 (istanti ISO UTC, date locali `YYYY-MM-DD`).

---

## Migration 0002 — `migrations/0002_indice_retry.sql`

```sql
-- Ricerca dei retry della giornata a ogni esecuzione oraria (research R-08).
CREATE INDEX idx_deliveries_retry ON deliveries(local_date, status);
```

Nessuna altra modifica di schema.

## occurrences — Occorrenza *(RF-14, BR-03…BR-08, BR-11, BR-13, §7)*

Colonne invariate. Regole di scrittura introdotte da questa feature:

| Regola | Dove | Dettaglio |
|---|---|---|
| Nascita | ciclo orario, batch di reclamo | `INSERT OR IGNORE` alla prima esecuzione con un invio previsto per `(persona, anno)` e solo se la persona esiste (research R-04). `year` = anno della data effettiva (BR-05); `effective_date` con la regola del 29/02 (BR-04) |
| Unicità | DB | `ux_occurrences_person_year` (BR-06, FR-010) |
| Età | calcolata | `year − persons.birth_year`, mai salvata (BR-03) |
| Annullamento per cambio data | flusso Modifica, batch del campo Data | `DELETE … WHERE person_id = ? AND status = 'aperta'` solo se cambiano giorno o mese (BR-13, research R-04); la cascata rimuove gli invii |

### Stati e transizioni *(AFU §7, spec FR-014)*

```
                   Fatto (pre: —, giorno, recupero)
          ┌──────────────────────────────────────────► fatto ◄──────────────┐
          │                                                                 │ Fatto sul recupero
 aperta ──┤  Salta quest'anno (pre, giorno) / Saltato (recupero)            │ entro D+7 (BR-08)
          ├──────────────────────────────────────────► saltato ─────────────┤
          │                                                                 │
          └── ciclo orario con effective_date ≤ oggi−2 ──► non_confermato ──┘
```

| Da | A | Evento | Condizione nell'UPDATE |
|---|---|---|---|
| `aperta` | `fatto` | `o:f` su reminder o recupero | `status = 'aperta'` |
| `aperta` | `saltato` | `o:s` su pre-reminder, reminder o recupero | `status = 'aperta'` |
| `aperta` | `non_confermato` | ciclo orario (fine di D+1) | `status = 'aperta' AND effective_date ≤ T−2` |
| `saltato`, `non_confermato` | `fatto` | `o:f` su un **recupero** | `effective_date ≥ T−7` (T = data locale del tocco) |
| `fatto` | — | — | finale (BR-08) |

`outcome_at` = `now` di ogni transizione (anche della correzione).

## deliveries — Invio *(N-02, N-03, AFU §8)*

Colonne invariate. Valori:

| Colonna | Valori |
|---|---|
| `kind` | `pre` (pre-reminder), `giorno` (reminder del giorno), `recupero` |
| `ref` | `pre`: giorni prima (7, 2, 1); `giorno`: ora dello slot (9, 13, 18, 21); `recupero`: 13 (`RECOVERY_HOUR`) |
| `status` | `in_invio`, `inviato`, `fallito`, `abbandonato` — semantica in [research R-08](research.md#r-08--stati-dellinvio-e-garanzia-al-massimo-una-volta-n-02-n-03) |
| `attempts` | numero di invii tentati; `0` con `fallito` = in coda per il tetto di invii (research R-05) |
| `local_date` | data locale dell'esecuzione che ha creato la riga; i retry valgono solo per `local_date = oggi` |
| `sent_at` | `now` dopo la conferma di Telegram |
| `telegram_message_id` | ID del messaggio inviato (AFU §8). L'aggiornamento dopo Fatto/Salta usa comunque il `message_id` del callback |
| `last_error_code` | solo il codice numerico di Telegram (principio V) |

Unicità `(occurrence_id, kind, ref)` (indice `ux_deliveries_unique`, N-02): è il database a
impedire il doppio invio, anche con esecuzioni sovrapposte.

### Ciclo di vita

```
(nessuna riga) ──reclamo entro il tetto──► in_invio ──ok──► inviato
       │                                     │
       │                                     └──errore Telegram──► fallito (attempts ≥ 1)
       └──oltre il tetto──► fallito (attempts = 0)                      │
                                 ▲                                      │
                                 └───── retry stessa giornata ◄─────────┘
                                       (fallito → in_invio, attempts + 1;
                                        solo se l'occorrenza è aperta, altrimenti abbandonato)
fallito con local_date < oggi ──► abbandonato
in_invio non concluso ──► resta in_invio: mai ritentato (al massimo una volta)
```

## settings — Impostazioni *(RF-15, A-06)*

| `key` | `value` | Scritto da |
|---|---|---|
| `default_message` | messaggio di auguri di default, ≤ 256 caratteri con `{nome}` contato 60 (FR-035) | `/messaggio`, dopo conferma |

Riga assente → `DEFAULT_BIRTHDAY_MESSAGE` di `src/config.ts` (principio VIII).

## persons — modifiche di validazione *(FR-035)*

Nessuna modifica di schema. `custom_message` passa al limite applicativo di 256 caratteri con
`{nome}` contato 60 (prima 500). Valori più lunghi già salvati: nessuna migrazione; "Copia
messaggio" non compare per quella persona finché il messaggio non viene accorciato (spec
Assumptions).

## conversation_state — nuovo flusso

`flow = 'messaggio'` (aggiunto a `FLOW_NAMES`, nessun CHECK da cambiare). `data`:
`{ text?: string }` (testo in attesa di conferma). Step: `testo`, `conferma`
([contracts/messaggio.md](contracts/messaggio.md)).

## Profilo di priorità *(AFU §7)*

Invariato, in `src/config.ts` (`PRIORITY_PROFILES`, `PRE_REMINDER_HOUR`, `RECOVERY_HOUR`).
Nuove costanti dello stesso file: `MAX_SENDS_PER_RUN = 40`, `SEND_INTERVAL_MS = 1000`,
`OUTCOME_CORRECTION_DAYS = 7` (A-05), `TEXT_LIMITS.customMessage = 256`,
`TEXT_LIMITS.greetingNamePlaceholder = 60`.

## Viste di lettura usate dal ciclo orario *(non tabelle)*

**Candidato** (una riga per persona con data effettiva tra le date di interesse, o con un retry):
`id`, `full_name`, `nickname`, `birth_day`, `birth_month`, `birth_year`, `phone`, `instagram`,
`telegram`, `priority`, `custom_message`, `created_at`, `group_names` (`group_concat` con
separatore `char(31)`, riordinati in TypeScript come nella scheda).

**Occorrenza del candidato**: `id`, `person_id`, `year`, `effective_date`, `status`, più
`has_day_send` (esiste un invio `giorno` `inviato`/`in_invio`, per BR-11) — anni `T−1…T+1`;
l'anno `Y−1` fornisce "L'anno scorso" (BR-09).

**Retry**: righe `deliveries` con `local_date = oggi` e `status = 'fallito'`, con
`occurrence_id`, `kind`, `ref` e `person_id`.
