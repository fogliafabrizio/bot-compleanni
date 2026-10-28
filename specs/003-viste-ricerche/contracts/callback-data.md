# Contratto — `callback_data` (aggiunte della feature 003)

Estende i contratti [001](../../001-fondamenta-anagrafica/contracts/callback-data.md) e
[002](../../002-promemoria-esiti/contracts/callback-data.md); stesso formato, stesso
encoder/decoder (`src/telegram/keyboard.ts`), limite 64 byte.

## Nuovo ambito senza stato `t` (pulsanti dei messaggi di `/oggi`)

| `callback_data` | Pulsante | Azione | Requisito |
|---|---|---|---|
| `t:f:<occurrenceId>` | Fatto ✅ | occorrenza `aperta` → `fatto` | FR-007, BR-07 |
| `t:s:<occurrenceId>` | Salta quest'anno | occorrenza `aperta` → `saltato` | FR-007, BR-07 |

- `occurrenceId` = `occurrences.id` (creata o letta da `/oggi`, research R-06).
- Come `o:`, un pulsante `t:` **non** annulla il flusso guidato in corso; il router lo gestisce
  nello stesso ramo di `o:`, prima di `routeStatic`.
- Effetto con occorrenza non più `aperta` → "Questa azione non è più disponibile"; occorrenza
  inesistente (persona eliminata, cascata) → "Persona non trovata".
- Lunghezza massima: `t:f:` + 15 cifre = 19 byte.
- `Callback.scope` diventa `"s" | "p" | "g" | "o" | "t"`.

## Nuova azione nell'ambito `p` (scheda)

| `callback_data` | Pulsante | Azione | Requisito |
|---|---|---|---|
| `p:f:<personId>` | Segna fatto | occorrenza in sospeso (oggi−7…ieri, ≠ `fatto`) → `fatto` | FR-017, FR-018, BR-08 |

- Passa per `routeStatic`: persona inesistente → "Persona non trovata" (FR-018c di 001); come gli
  altri pulsanti della scheda annulla un flusso guidato in corso.
- Nessuna occorrenza aggiornata → "Questa azione non è più disponibile".
