# Data model — 001 Fondamenta e anagrafica

**Fonte**: AFU §8 · **Migration**: `migrations/0001_schema_iniziale.sql` (unica, completa).

Lo schema copre già tutte le entità di AFU §8, comprese quelle usate solo dalle feature
successive (occorrenze, invii, impostazioni), per non riscrivere le migration. Il profilo di
priorità resta una costante in `src/config.ts` (configurabile solo in v2, RF-40).

Convenzioni:

- Nomi di tabelle e colonne in inglese (codice), testi utente in italiano.
- Istanti in `TEXT` ISO 8601 UTC con millisecondi (`2026-10-28T10:00:00.000Z`): ordinabili
  lessicograficamente, leggibili nel backup JSON.
- Date di calendario in `TEXT` `YYYY-MM-DD` (ora locale Europe/Rome).
- `INTEGER PRIMARY KEY AUTOINCREMENT`: gli ID non vengono mai riusati dopo un'eliminazione.
- Chiavi esterne con `ON DELETE CASCADE` (D1 applica le chiavi esterne per impostazione predefinita).
- Unicità espresse come `CREATE UNIQUE INDEX` separati (non vincoli di colonna): in un futuro
  multi-utente si possono sostituire con indici che includono l'ID proprietario senza
  ricostruire le tabelle (principio IX).

---

## persons — Persona *(RF-01…RF-05, BR-14…BR-16)*

| Colonna | Tipo | Vincoli | Note |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | Usato in `/p_<id>` |
| `full_name` | TEXT | NOT NULL | Già ripulito dagli spazi ai bordi, 1–60 caratteri |
| `full_name_norm` | TEXT | NOT NULL | `trim` + minuscolo `it-IT`; per BR-14 |
| `nickname` | TEXT | NULL | 1–60 caratteri |
| `birth_day` | INTEGER | NOT NULL, CHECK 1–31 | |
| `birth_month` | INTEGER | NOT NULL, CHECK 1–12 | |
| `birth_year` | INTEGER | NULL, CHECK ≥ 1900 | NULL = anno non noto. Il limite "non futuro" dipende da `now` ed è applicato dal codice |
| `phone` | TEXT | NULL, CHECK `phone GLOB '+[0-9]*'` | E.164, `+` e 8–15 cifre (BR-15) |
| `instagram` | TEXT | NULL | Senza `@` (BR-16) |
| `telegram` | TEXT | NULL | Senza `@` (BR-16) |
| `priority` | TEXT | NOT NULL DEFAULT `'media'`, CHECK IN (`alta`,`media`,`bassa`) | |
| `custom_message` | TEXT | NULL | 1–500 caratteri; NULL = messaggio standard |
| `created_at` | TEXT | NOT NULL | |
| `updated_at` | TEXT | NOT NULL | Aggiornato a ogni modifica |

Indici: `idx_persons_dup (full_name_norm, birth_day, birth_month)` — **non unico**: un
duplicato è ammesso dopo conferma esplicita (BR-14).

Regola duplicato (BR-14, chiarimento 2026-10-28): stesso `full_name_norm`, `birth_day`,
`birth_month`; l'anno deve coincidere solo se presente in entrambe le date
(`(birth_year IS NULL OR ?1 IS NULL OR birth_year = ?1)`). Quindi `14/03` è duplicato di
`14/03/1994`, mentre `14/03/1994` non lo è di `14/03/1995`. In modifica si esclude la persona
stessa (`id <> ?`).

Validazione applicativa (oltre ai CHECK): data valida per il mese, `29/02` con anno solo se
bisestile, anno ≤ anno locale corrente (RF-02, BR-01, BR-02, A-07) — vedi research R-08.

## groups — Gruppo *(RF-07, RF-08, BR-17)*

| Colonna | Tipo | Vincoli | Note |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | Usato nei `callback_data` |
| `name` | TEXT | NOT NULL | Come scritto dall'utente, 1–30 caratteri |
| `name_norm` | TEXT | NOT NULL | `trim` + minuscolo `it-IT` |

Indici: `ux_groups_name_norm` UNIQUE su `name_norm` (BR-17, garantito anche dal DB).
Rinomina: aggiorna `name` e `name_norm`; consentita la sola variazione di maiuscole del proprio
nome (spec, Assumptions). Le persone vedono il nuovo nome perché la relazione è per ID (RF-07).

## person_groups — Appartenenza *(AFU §8)*

| Colonna | Tipo | Vincoli |
|---|---|---|
| `person_id` | INTEGER | NOT NULL, FK → `persons.id` ON DELETE CASCADE |
| `group_id` | INTEGER | NOT NULL, FK → `groups.id` ON DELETE CASCADE |

PK `(person_id, group_id)`; indice su `group_id` (conteggio persone per `/gruppi`, FR-019, e
messaggio "N persone perderanno questa etichetta", FR-022).

## occurrences — Occorrenza *(RF-14, BR-05…BR-08; usata dalla feature promemoria)*

| Colonna | Tipo | Vincoli | Note |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `person_id` | INTEGER | NOT NULL, FK → `persons.id` ON DELETE CASCADE | RF-05 |
| `year` | INTEGER | NOT NULL | Anno del compleanno (BR-05) |
| `effective_date` | TEXT | NOT NULL | `YYYY-MM-DD`; 28/02 per i nati il 29/02 negli anni non bisestili (BR-04) |
| `status` | TEXT | NOT NULL DEFAULT `'aperta'`, CHECK IN (`aperta`,`fatto`,`saltato`,`non_confermato`) | AFU §7 |
| `outcome_at` | TEXT | NULL | Data e ora dell'esito |
| `created_at` | TEXT | NOT NULL | |

Indici: `ux_occurrences_person_year` UNIQUE `(person_id, year)` (BR-06);
`idx_occurrences_date (effective_date)` per il ciclo orario.

Transizioni (AFU §7, implementate nella feature promemoria):
`aperta → fatto | saltato` (RF-12, BR-07); `aperta → non_confermato` (fine D+1, RF-13);
`saltato | non_confermato → fatto` entro D+7 (BR-08); `fatto` è finale.

In questa feature nessuna occorrenza viene creata: la scheda non mostra la riga "Storico"
finché non esiste almeno un'occorrenza con esito (FR-013); l'eliminazione della persona le
rimuove per cascata (FR-017).

## deliveries — Invio *(N-02, N-03; usata dalla feature promemoria)*

| Colonna | Tipo | Vincoli | Note |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `occurrence_id` | INTEGER | NOT NULL, FK → `occurrences.id` ON DELETE CASCADE | |
| `kind` | TEXT | NOT NULL, CHECK IN (`pre`,`giorno`,`recupero`) | pre-reminder / reminder / recupero |
| `ref` | INTEGER | NOT NULL | `pre`: giorni prima (7, 2, 1); `giorno`: ora dello slot (9, 13, 18, 21); `recupero`: 13 |
| `status` | TEXT | NOT NULL, CHECK IN (`in_invio`,`inviato`,`fallito`,`abbandonato`) | Esito dell'invio |
| `attempts` | INTEGER | NOT NULL DEFAULT 0 | Retry nella stessa giornata (N-03) |
| `local_date` | TEXT | NOT NULL | Giorno locale previsto dell'invio, per limitare i retry alla giornata |
| `sent_at` | TEXT | NULL | Data e ora dell'invio riuscito |
| `telegram_message_id` | INTEGER | NULL | Per aggiornare il messaggio ("✅ Fatto", RF-12) |
| `last_error_code` | INTEGER | NULL | Solo il codice di Telegram (nessun dato personale) |

Indici: `ux_deliveries_unique` UNIQUE `(occurrence_id, kind, ref)` — idempotenza garantita dal
database (N-02, principio VII).

## settings — Impostazioni *(RF-15, A-06)*

| Colonna | Tipo | Vincoli |
|---|---|---|
| `key` | TEXT | PK |
| `value` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |

Chiave documentata: `default_message` (messaggio di auguri di default, scritto da `/messaggio`
nella feature promemoria). La tabella nasce **vuota**: in assenza della riga vale
`DEFAULT_BIRTHDAY_MESSAGE` di `src/config.ts` (unico punto, principio VIII). Non è un singleton
implicito: è un archivio chiave-valore estendibile (es. aggiungendo l'ID proprietario alla chiave).

## conversation_state — Stato conversazione *(A-04, RF-06, AFU §8)*

| Colonna | Tipo | Vincoli | Note |
|---|---|---|---|
| `chat_id` | INTEGER | PK | Chat privata del proprietario (multi-utente pronto: una riga per chat) |
| `flow` | TEXT | NOT NULL | Nessun CHECK: i valori ammessi (`nuovo`, `modifica`, `elimina`, `gruppi` in questa feature) sono validati in TypeScript, così import, ripristino e messaggio delle feature successive non richiedono migration |
| `step` | TEXT | NOT NULL | Step corrente, vedi [contracts/flussi.md](contracts/flussi.md) |
| `flow_id` | TEXT | NOT NULL | 6 caratteri base36; incluso nei `callback_data` del flusso |
| `data` | TEXT | NOT NULL DEFAULT `'{}'` | JSON dei dati parziali (tipizzato per flusso nel codice) |
| `expires_at` | TEXT | NOT NULL | `now + 24 h`, rinnovato a ogni interazione (A-04) |
| `updated_at` | TEXT | NOT NULL | |

Ciclo di vita:

```
(nessuna riga) ──comando /nuovo, pulsante Modifica/Elimina, azione /gruppi──► attivo
attivo ──risposta valida──► attivo (step successivo, expires_at rinnovato)
attivo ──Salva/Conferma──► (riga cancellata nella stessa batch del salvataggio)
attivo ──/annulla, Annulla, altro comando──► (riga cancellata o sostituita, nulla salvato)
attivo ──expires_at ≤ now──► trattato come assente, cancellato in lettura, nessun messaggio
```

Contenuto di `data` per flusso (indicativo, definito in TypeScript come unione discriminata):

- `nuovo`: campi già raccolti della persona, `groupIds` selezionati, `pendingGroups` (nomi dei
  gruppi creati nel flusso, scritti solo al salvataggio, research R-12).
- `modifica`: `personId`, `field`, valore in attesa di conferma (data o duplicato), selezione
  gruppi e `pendingGroups` per il campo Gruppi.
- `elimina`: `personId`.
- `gruppi`: `action` (`nuovo`/`rinomina`/`elimina`), `groupId`.

## Profilo di priorità *(AFU §7, costante)*

Non è una tabella: in `src/config.ts`.

| Priorità | Pre-reminder (giorni prima, alle 13) | Slot del giorno | Recupero |
|---|---|---|---|
| `alta` | 7, 2, 1 | 9, 13, 18, 21 | D+1 alle 13 |
| `media` | 1 | 9, 13, 18 | D+1 alle 13 |
| `bassa` | — | 9, 18 | D+1 alle 13 |
