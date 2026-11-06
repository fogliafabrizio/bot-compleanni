# Contratto — `callback_data` dei pulsanti v1.2

*(RNF-14, RF-01, RF-07, RF-17, RF-19, RF-20, RF-22, FR-017…FR-022, FR-029, FR-030; research R-01)*

Estende il [contratto di 001](../../001-fondamenta-anagrafica/contracts/callback-data.md) (ambito
`s`) e quello di [005](../../005-revisioni-v1-1-gruppi/contracts/callback-data.md) (ambito `g2`).
Regole generali invariate: 1–64 **byte** UTF-8, campi ASCII separati da `:`, mai testo
dell'utente; encoder e decoder in `src/telegram/keyboard.ts`; un dato che non rispetta il formato
vale come pulsante non più valido. **Nessun nuovo ambito, nessuna nuova versione di `g2`.**

## Ambito `g2` — due azioni nuove senza campi

```
g2:<azione>[:<groupId>:<nameHash>[:<giorni>]]     (forma di 005, invariata)
```

| `callback_data` | Pulsante | Dove | Azione |
|---|---|---|---|
| `g2:l` *(nuovo)* | ⬅️ Tutti i gruppi | Scheda gruppo, scheda "Senza gruppo" (ultimo messaggio) | Nuovo messaggio con l'elenco gruppi attuale, come `/gruppi` (FR-002) |
| `g2:s` *(nuovo)* | Senza gruppo (N) | Elenco gruppi (a pulsanti, vuoto, oltre 60) | N attuale > 0 → scheda "Senza gruppo"; N = 0 → `T.allGrouped` + elenco aggiornato (FR-007, FR-008) |
| `g2:p:<id>:<h>:90` *(riuso)* | Prossimi 90 giorni | `/prossimi` con filtro di gruppo, N < 90 | Lista dei prossimi 90 giorni del gruppo; gruppo assente o hash diverso → `T.groupGone` + elenco (005 FR-005, FR-018) |
| `g2:n`, `g2:o`, `g2:r`, `g2:x`, `g2:p` | — | — | **invariati** (forma e significato, FR-030) |

Decoder: `n`, `l`, `s` ammessi **solo** senza campi (`fields.length === 1`); `GroupAction` diventa
`"n" | "o" | "r" | "x" | "p" | "l" | "s"`. `g2:l:1`, `g2:s:5`, `g2:s:5:abc` → `null`.

## Ambito `s` — senza stato, tre azioni nuove e un riuso

```
s:<azione>[:<id>]      id = \d{1,15}   (forma di 001, invariata; decoder invariato)
```

| `callback_data` | Pulsante | Dove | Validazione al tocco | Azione |
|---|---|---|---|---|
| `s:u` *(nuovo)* | Prossimi 90 giorni | `/prossimi` senza filtro, N < 90 | id assente | Lista dei prossimi 90 giorni di tutte le persone (FR-018) |
| `s:m:<mese>` *(nuovo)* | ◀️ \<Mese\> / \<Mese\> ▶️ | `/mese` (ultimo messaggio) | 1 ≤ mese ≤ 12 | Vista `/mese <mese>`, anno di riferimento al tocco (FR-019) |
| `s:y:<anno>` *(nuovo)* | ◀️ \<anno\> / \<anno\> ▶️ | `/anno` (ultimo messaggio) | `parseYear(String(anno), oggi)` ok: `MIN_BIRTH_YEAR` ≤ anno ≤ anno corrente | Vista `/anno <anno>` con i suoi pulsanti calcolati al tocco (FR-020) |
| `s:n` *(riuso)* | ➕ Aggiungi un'altra persona | Conferma del salvataggio (sotto i pulsanti della scheda) | nessuna | Come `/nuovo`: interrompe il flusso in corso senza salvare e chiede il nome (FR-022) |
| `s:h` | — | `/start` | — | invariato |

Gestori in `STATIC_CALLBACKS` (`src/bot/router.ts`): `"s:u"`, `"s:m"`, `"s:y"` accanto a
`"s:n"` e `"s:h"`. Validazione fallita → `answerCallback(ctx, T.actionUnavailable)`, nessun
messaggio. Come ogni pulsante `s:*`, il tocco esegue `clear` del flusso in corso prima del gestore
(001 FR-018; edge case "pulsante durante un flusso guidato").

## Ordine della validazione

1. `decodeCallback` → `null` (formato) → "❌ Questa azione non è più disponibile.";
2. mittente diverso dal proprietario → nessuna risposta (invariato, RF-30);
3. `s:u|m|y` con id mancante, in eccesso o fuori intervallo → "❌ Questa azione non è più
   disponibile.";
4. `g2:p:…:90` con gruppo assente o rinominato → `T.groupGone` + elenco gruppi (005);
5. altrimenti l'azione, con la vista calcolata al momento del tocco (FR-017).

## Lunghezze

| Esempio | Byte |
|---|---|
| `g2:l`, `g2:s` | 4 |
| `s:u`, `s:n` | 3 |
| `s:m:12` | 6 |
| `s:y:2026` | 8 |
| `g2:p:999999999999999:zzzzzzz:90` (caso peggiore) | 31 |

Test: `test/unit/callback-data.test.ts` — round-trip di ogni forma nuova, ≤ 64 byte, e rifiuto di
ciascuna forma malformata elencata sopra e in research R-01.

## Pulsanti già in chat (FR-029, FR-030)

Tutti i `callback_data` di 001-008 restano validi con lo stesso significato. I messaggi già inviati
non si aggiornano: non hanno i pulsanti nuovi, ma le viste che aprono, calcolate al tocco, li
contengono (es. `g2:o` di un elenco vecchio apre una scheda gruppo con [⬅️ Tutti i gruppi]).
