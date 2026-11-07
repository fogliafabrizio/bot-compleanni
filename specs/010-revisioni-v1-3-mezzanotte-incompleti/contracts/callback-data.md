# Contratto — `callback_data` dei pulsanti v1.3

*(RF-50, RF-32, RNF-14, FR-009, FR-010, FR-015, FR-016, FR-025; research R-09)*

Estende il [contratto di 009](../../009-revisioni-v1-2-navigazione/contracts/callback-data.md)
(ambito `s` senza stato). Regole generali invariate: 1–64 **byte** UTF-8, campi ASCII separati da
`:`, mai testo dell'utente; encoder e decoder in `src/telegram/keyboard.ts`; un dato che non rispetta
il formato vale come pulsante non più valido. **Nessun nuovo ambito, nessuna nuova versione; decoder
invariato.**

## Ambito `s` — una azione nuova `i`

```
s:<azione>[:<id>]      id = \d{1,15}   (forma di 001, invariata)
```

| `callback_data` | Pulsante | Dove | Validazione al tocco | Azione |
|---|---|---|---|---|
| `s:i` *(nuovo)* | 📝 Profili incompleti | `/statistiche` (ultimo messaggio, anche con rubrica vuota) | id assente | Nuovo messaggio identico a `/incomplete` senza argomento: intestazione, domanda e 5 pulsanti con i conteggi al tocco (FR-016) |
| `s:i:1` *(nuovo)* | Telefono (N) | Menu di `/incomplete` | 1 ≤ id ≤ 5 | Lista "Senza telefono" con i dati al tocco (FR-010) |
| `s:i:2` *(nuovo)* | Instagram (N) | idem | idem | Lista "Senza Instagram" |
| `s:i:3` *(nuovo)* | Telegram (N) | idem | idem | Lista "Senza Telegram" |
| `s:i:4` *(nuovo)* | Anno di nascita (N) | idem | idem | Lista "Senza anno di nascita" |
| `s:i:5` *(nuovo)* | Nessun contatto (N) | idem | idem | Lista "Nessun contatto" |
| `s:n`, `s:h`, `s:u`, `s:m:<n>`, `s:y:<aaaa>` | — | — | — | **invariati** |

Il codice è quello di `INCOMPLETE_FILTERS` ([data-model.md](../data-model.md)); il numero N sul
pulsante è solo un'etichetta e non entra nel dato.

Gestore in `STATIC_CALLBACKS` (`src/bot/router.ts`):

```ts
"s:i": (ctx, id) => showIncompleteFromButton(ctx, id),   // src/bot/incomplete.ts
```

`showIncompleteFromButton`: `id === undefined` → `sendIncompleteMenu`; `filterByCode(id)` trovato →
`sendIncompleteList`; altrimenti `answerCallback(ctx, T.actionUnavailable)` e nessun messaggio.

Come ogni pulsante `s:*`, il tocco esegue `clear` del flusso in corso prima del gestore (001 FR-018;
edge case "pulsante premuto durante un flusso guidato"). Il messaggio con i pulsanti non si modifica
(nessun `editMessage*`, FR-010, FR-016).

## Ordine della validazione

1. `decodeCallback` → `null` (formato, es. `s:i:x`, `s:i:1:2`, `s:i:` , id di 16 cifre) →
   "❌ Questa azione non è più disponibile.";
2. mittente diverso dal proprietario → nessuna risposta (invariato, RF-30);
3. `s:i:<id>` con id fuori da 1…5 (`s:i:0`, `s:i:6`, `s:i:999999999999999`) → "❌ Questa azione non
   è più disponibile.";
4. altrimenti l'azione, con conteggi e lista calcolati al momento del tocco (RF-50: pulsante vecchio →
   dati attuali).

Nota: come per `s:m:<mese>` di 009, `ID_RE` accetta zeri iniziali (`s:i:01` = filtro 1); è innocuo
perché il bot non li produce mai.

## Lunghezze

| Esempio | Byte |
|---|---|
| `s:i` | 3 |
| `s:i:5` | 5 |
| Caso peggiore ammesso dal decoder (`s:i:` + 15 cifre) | 19 |

Test: `test/unit/callback-data.test.ts` — round-trip di `s:i` e `s:i:1…5`, ≤ 64 byte su tutta la
tastiera del menu e su quella di `/statistiche`; in `test/integration/v13-incomplete.test.ts` il
rifiuto di `s:i:0`, `s:i:6`, `s:i:1:2`, `s:i:x` con "Questa azione non è più disponibile".

## Pulsanti già in chat (FR-025)

Tutti i `callback_data` di 001-009 restano validi con lo stesso significato. I messaggi di
`/statistiche` inviati prima del rilascio restano senza [📝 Profili incompleti] (nessun aggiornamento).
