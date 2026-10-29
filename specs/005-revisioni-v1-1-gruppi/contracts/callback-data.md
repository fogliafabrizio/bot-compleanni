# Contratto — `callback_data` dei pulsanti di gruppo (v1.1)

*(RF-07, RF-17, RF-19, RNF-14, V-09, FR-005, FR-017; research R-04)*

Modifica il [contratto di 001](../../001-fondamenta-anagrafica/contracts/callback-data.md) e quello
di [003](../../003-viste-ricerche/contracts/callback-data.md). Regole generali invariate: 1–64
**byte**, campi ASCII separati da `:`, mai testo dell'utente; encoder e decoder in
`src/telegram/keyboard.ts`; un dato che non rispetta il formato vale come pulsante non più valido.

## Ambito `g2` — gruppi, senza stato

```
g2:<azione>[:<groupId>:<nameHash>[:<giorni>]]
```

- `groupId`: `\d{1,15}`; `nameHash`: `[0-9a-z]{1,7}` = `nameHash(groups.name)` al momento
  dell'invio; `giorni`: `\d{1,3}`, 1…`UPCOMING_MAX_DAYS`.
- Il prefisso `g2` è la **versione**: i pulsanti di prima del rilascio usano `g` e non sono più
  riconosciuti.
- Come ogni pulsante senza stato, il tocco sostituisce il flusso in corso (router, `clear`).

| `callback_data` | Pulsante | Dove | Azione |
|---|---|---|---|
| `g2:n` | ➕ Nuovo gruppo | Elenco gruppi | Avvia il flusso `gruppi`, step `crea` (RF-07) |
| `g2:o:<id>:<h>` | `<nome> (<n>)` | Elenco gruppi; scelta di `/gruppi <testo>` | Nuovo messaggio con la scheda gruppo (RF-19, FR-002) |
| `g2:r:<id>:<h>` | ✏️ Rinomina | Scheda gruppo (ultimo messaggio) | Flusso `gruppi`, step `rinomina`, su quel gruppo (FR-009) |
| `g2:x:<id>:<h>` | 🗑 Elimina | Scheda gruppo (ultimo messaggio) | Flusso `gruppi`, step `elimina`, su quel gruppo (FR-010) |
| `g2:p:<id>:<h>:<N>` | `<nome> (<n>)` | Scelta di `/prossimi [N] <testo>` | Lista dei prossimi N giorni filtrata sul gruppo (FR-011) |

**Validazione al tocco** (FR-005), nell'ordine:

1. formato non valido → `answerCallbackQuery` "Questa azione non è più disponibile";
2. `g2:o|r|x|p` con gruppo `id` inesistente **o** `nameHash(name) ≠ h` → nuovo messaggio
   `Il gruppo non esiste più.` + elenco gruppi aggiornato (contracts/gruppi.md), nessuna scrittura;
3. altrimenti l'azione.

Esempi: `g2:o:12:1x9k3pq` (16 byte); caso peggiore `g2:p:999999999999999:zzzzzzz:366` (32 byte).
Test: ogni tastiera generata ha `callback_data` ≤ 64 byte UTF-8 (`test/unit/callback-data.test.ts`).

## Pulsanti rimossi (FR-017)

| `callback_data` | Prima | Ora |
|---|---|---|
| `g:n`, `g:r`, `g:x` | Nuovo / Rinomina / Elimina di `/gruppi` (001) | `decodeCallback` → `null` → "Questa azione non è più disponibile", nessuna modifica |
| `f:<flowId>:sg:<groupId>` | "Quale gruppo?" di Rinomina ed Elimina (001) | step `scelta` rimosso → "Questa azione non è più disponibile" |
| `f:<flowId>:y` con flusso `gruppi` nello step `conferma` | Sì dell'eliminazione (001) | step rinominato in `elimina` → stessa risposta |

## Pulsanti di flusso del flusso `gruppi`

| Step | Pulsanti |
|---|---|
| `crea`, `rinomina` | Annulla (`f:<flowId>:a`) |
| `elimina` | Sì (`f:<flowId>:y`), Annulla (`f:<flowId>:a`) |

L'azione `sg` esce dalla tabella delle azioni di flusso di 001.
