# Contratto — `callback_data` (aggiunte della feature 002)

Estende il [contratto 001](../../001-fondamenta-anagrafica/contracts/callback-data.md); stesso
formato, stesso encoder/decoder (`src/telegram/keyboard.ts`), limite 64 byte.

## Nuovo ambito senza stato `o` (esiti dei promemoria)

| `callback_data` | Pulsante | Dove | Azione |
|---|---|---|---|
| `o:f:<deliveryId>` | Fatto ✅ | reminder, recupero | occorrenza → `fatto`; dal recupero anche correzione BR-08 |
| `o:s:<deliveryId>` | Salta quest'anno / Saltato | pre-reminder, reminder, recupero | occorrenza → `saltato` |

- `deliveryId` = `deliveries.id` (`RETURNING` della fase di reclamo, research R-10).
- Differenza dagli ambiti `s`, `p`, `g`: un pulsante `o:` **non** annulla il flusso guidato in
  corso (research R-11). Il router lo gestisce prima di `routeStatic`.
- Validità: sempre interpretabile; l'effetto dipende dallo stato dell'occorrenza
  ([promemoria.md](promemoria.md#risposte-ai-tocchi)).
- Lunghezza massima: `o:f:` + 15 cifre = 19 byte.

## Pulsanti di flusso del flusso `messaggio`

Riusano le azioni esistenti `f:<flowId>:a` (Annulla) e `f:<flowId>:y` (Conferma).
Nessuna nuova azione.
