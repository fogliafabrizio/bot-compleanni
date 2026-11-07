# Contratto — viste e tastiere v1.3

*(RF-10, RF-31, RF-32, RF-50, RNF-14, RNF-19, N-06; AFU §5.10, §5.11, §5.12, §5.13)*

Testi esatti in [testi-v13.md](testi-v13.md); `callback_data` in [callback-data.md](callback-data.md).

## 1. `/incomplete` senza argomento (FR-009)

Un messaggio, tastiera inline di 5 pulsanti, due per riga, "Nessun contatto" da solo sull'ultima:

```
📝 Profili incompleti
Quale dato manca?
[Telefono (41)]        [Instagram (60)]
[Telegram (80)]        [Anno di nascita (23)]
[Nessun contatto (30)]
```

- conteggi da `incompleteCountsStatement` al momento; 0 compare ("Telegram (0)"); rubrica vuota → 5
  pulsanti con 0;
- stessa risposta per il tocco `s:i` da `/statistiche` (nuovo messaggio).

## 2. `/incomplete <campo>` e tocco `s:i:<n>` (FR-010…FR-013)

| Caso | Risposta |
|---|---|
| Argomento valido (case-insensitive, spazi ai bordi ignorati, `@nomebot` ammesso) o tocco valido, N ≥ 1 | Lista: primo messaggio "📝 Senza telefono · 41 persone", riga vuota, righe §5.7; divisione con `splitMessage` (intestazione solo nel primo, righe intere); **nessuna tastiera** su alcun messaggio |
| N = 0 con persone in rubrica | Un messaggio di conferma, es. "✅ Tutte le persone hanno il telefono." |
| Rubrica vuota | Un messaggio "📝 La rubrica è vuota: non ci sono persone." (stesso testo per tutti i filtri) |
| Argomento non riconosciuto (`email`, `telefoni`, `ig`, `contatto`, `telefono famiglia`) | Messaggio di errore `T.incompleteUnknown`, poi il menu del punto 1 (nuovo messaggio) |

Riga della lista (§5.7, `formatRows` → `formatListLine`): `<Ggg> <gg/mm>  <nome (età)>  /p_<id>`;
età assente se manca l'anno (`NULL`, vuoto o soli spazi, `isMissing`); con un anno anomalo già in
produzione (fuori da BR-02) l'età si mostra come nelle altre liste (spec 003 FR-001); **nessun gruppo**,
nessun esito.
Ordine: `sortByNextBirthday(persone, oggi)` — prossimo compleanno (oggi compreso), poi nome, poi id.

## 3. `/statistiche` (FR-016, FR-017)

Messaggio invariato rispetto a 009, salvo:

- `Senza anno di nascita: X · Senza contatti: Y` contano anche vuoti e spazi (stessa regola dei filtri);
- tastiera `[[📝 Profili incompleti]]` → `s:i` sull'**ultimo** messaggio, anche con la rubrica vuota.

## 4. Orari della mezzanotte (FR-007, FR-023)

| Dove | Prima | Dopo |
|---|---|---|
| `/stato`, ultimo controllo orario | `⏱ Ultimo controllo orario: oggi alle 0:00` | `… oggi alle 00:00` |
| `/stato`, invio abbandonato dello slot 0 | — (slot inesistente) | `   – Marco, reminder delle 00:00 del 14/03` |
| `/stato`, invio abbandonato dello slot 9 | `reminder delle 9:00` | invariato |
| `/stato`, webhook con errore alle 0:37 | `ultimo errore oggi alle 0:37` | `… oggi alle 00:37` |
| Avviso di buco, 23:00 → 2:00 | `dalle 23:00 del 13/03 alle 2:00 del 14/03` | invariato |
| Avviso di buco, 21:00 → 00:00 | `dalle 21:00 alle 0:00 …` | `dalle 21:00 del 13/03 alle 00:00 del 14/03` |

Nessun testo del bot contiene più "0:00" come orario della mezzanotte (SC-004).

## 5. Reminder delle 00:00 (FR-003)

Identico agli altri reminder del giorno (`renderByKind("giorno", 0, …)`): stesso testo, pulsanti di
contatto, Fatto, Salta quest'anno; notifica sonora (nessun `disable_notification`).

## 6. `/aiuto` e menu dei comandi (FR-018)

Nuova riga dopo `/anno [anno]` e prima di `/statistiche` (ordine §5.1); nuova voce `incomplete` in
`BOT_COMMANDS` nella stessa posizione. `/start` invariato.
