# Contract: scheda persona e telefono da contatto (feature 006)

Modifica `specs/001-fondamenta-anagrafica/contracts/comandi.md` (scheda) e
`specs/001-fondamenta-anagrafica/contracts/flussi.md` (step telefono). Dove c'è contrasto vale
questo contratto.

## 1. Messaggio in ingresso con contatto

```json
{
  "update_id": 1,
  "message": {
    "message_id": 10,
    "from": { "id": <owner> },
    "chat": { "id": <owner>, "type": "private" },
    "contact": { "phone_number": "393331234567", "first_name": "Marco", "user_id": 123 }
  }
}
```

| Contesto | Risposta |
|---|---|
| Mittente non proprietario o chat non privata | Nessuna (RF-30) |
| Nessun flusso attivo | `Non ho capito. Scrivi /aiuto per l'elenco dei comandi` (001 FR-025a) |
| `nuovo.telefono` o `modifica.valore` con campo Telefono, numero valido | `📱 <E.164>, giusto?` + [Sì] [Correggi] |
| Idem, numero non valido (BR-25 → BR-15) | `T.invalidPhone` + domanda del telefono con i suoi pulsanti |
| Idem, `phone_number` vuoto/assente | `Questo contatto non ha un numero di telefono` + domanda del telefono |
| Qualsiasi altro step (anche le conferme) | Domanda dello step ripetuta con i suoi pulsanti |

Nome, `user_id` e `vcard` del contatto non producono effetti.

## 2. Domande dello step telefono

- `/nuovo`: `📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)` / `oppure condividi il
  contatto 📎` + [Salta] (`T.btnSkip`, invariato).
- Modifica → Telefono: `Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)` /
  `oppure condividi il contatto 📎` + [Svuota] [Annulla].

## 3. Conferma (`telefono_conferma`, `valore_conferma`)

- Testo: `📱 <numero>, giusto?`, numero nella forma che verrà salvata.
- Pulsanti: `f:<flowId>:y` [Sì], `f:<flowId>:c` [Correggi].
- Sì → `nuovo`: domanda Instagram; `modifica`: solo `phone` aggiornato, scheda rimostrata.
- Correggi → domanda del telefono (§2), nulla salvato.
- Pulsanti di un flusso scaduto/annullato/concluso → `Questa azione non è più disponibile`
  (001 FR-018c).

## 4. Scheda persona

### Testo (AFU §5.6)

```
<nome>[ — "<nickname>"]
<data> · <età/giorni>
Priorità: <p>[ · Gruppi: <g1, g2>]
[📱 <telefono salvato>]
Messaggio: standard | "<messaggio>"
[Storico: <anno> <esito> · …]
```

Gli username Instagram e Telegram **non** compaiono più (FR-001). Il riepilogo di `/nuovo` usa lo
stesso testo preceduto dal titolo, con [Salva] [Annulla].

### Tastiera (FR-002, FR-003)

Righe, nell'ordine, omettendo quelle vuote:

1. `[WhatsApp] [Instagram] [Telegram]` — solo i contatti presenti (data-model, "Regole di
   presenza"); pulsanti URL:
   - WhatsApp `https://wa.me/<cifre senza +>` **senza** `?text=` (D-27, FR-004);
   - Instagram `https://ig.me/m/<username>`; Telegram `https://t.me/<username>`.
2. `[Segna fatto]` → `p:f:<id>` solo con occorrenza in sospeso (003 FR-017).
3. `[Modifica]` → `p:m:<id>`, `[Elimina]` → `p:x:<id>`.

Mai "Copia messaggio" (FR-005). Etichette senza icone (FR-006).

Vale per: `/p_<id>`, `/cerca` con un risultato, dopo Salva in `/nuovo`, dopo ogni modifica,
dopo Segna fatto (`editMessageText`).

## 5. Promemoria (invariati salvo FR-002)

Reminder, recupero e `/oggi` mantengono WhatsApp con `?text=<auguri>` e "Copia messaggio"
(002 FR-026…FR-029). Unica differenza: i pulsanti Instagram/Telegram con username non valido per
il link non compaiono.

## 6. Callback data

Nessun formato nuovo. `p:*`, `o:*`, `t:*`, `g2:*`, `f:*` invariati; le azioni di flusso `y` e `c`
sono già ammesse da `ACTION_RE`.
