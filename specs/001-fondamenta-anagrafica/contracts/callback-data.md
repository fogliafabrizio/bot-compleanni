# Contratto — `callback_data` dei pulsanti inline

*(RNF-14, FR-018c, research R-09, R-10)*

Vincolo Telegram: 1–64 **byte**. Formato: campi ASCII separati da `:`; solo codici brevi e ID
numerici, mai testo inserito dall'utente. Encoder e decoder in `src/telegram/keyboard.ts`;
un `callback_data` che non rispetta il formato è trattato come pulsante non più valido.

## Pulsanti senza stato

Validi in qualsiasi momento. Se un flusso è attivo, lo sostituiscono (come un comando, FR-018).

| `callback_data` | Pulsante | Dove | Azione |
|---|---|---|---|
| `s:n` | Aggiungi persona | `/start` | Avvia il flusso `nuovo` (RF-01) |
| `s:h` | Comandi | `/start` | Mostra il testo di `/aiuto` (RF-28) |
| `p:m:<personId>` | Modifica | Scheda | Avvia il flusso `modifica` con il menù dei campi (RF-04) |
| `p:x:<personId>` | Elimina | Scheda | Avvia il flusso `elimina` con la conferma (RF-05) |
| `g:n` | ➕ Nuovo gruppo | `/gruppi` | Avvia il flusso `gruppi`, azione crea (RF-07) |
| `g:r` | ✏️ Rinomina | `/gruppi` | Avvia il flusso `gruppi`, azione rinomina |
| `g:x` | 🗑 Elimina | `/gruppi` | Avvia il flusso `gruppi`, azione elimina |

`p:*` con persona inesistente → `answerCallbackQuery` "Persona non trovata", nessuna azione.

## Pulsanti di flusso

Formato `f:<flowId>:<azione>[:<arg>]`, `flowId` = 6 caratteri `[0-9a-z]`.
Se non esiste un flusso attivo (non scaduto) con lo stesso `flowId` → "Questa azione non è
più disponibile", nessuna azione. Se il flusso è attivo ma l'azione non appartiene allo step
corrente → stessa risposta.

| Azione | Arg | Significato |
|---|---|---|
| `a` | — | Annulla (RF-06) |
| `k` | — | Salta (campo opzionale, RF-01) |
| `y` | — | Sì (conferma data, conferma eliminazione) |
| `c` | — | Correggi (data, RF-02) |
| `t` | `<groupId>` o `n<indice>` | Attiva/disattiva un gruppo esistente o in attesa (RF-08) |
| `ng` | — | ➕ Nuovo gruppo nello step Gruppi (RF-08) |
| `d` | — | Fine (step Gruppi) |
| `pr` | `a` / `m` / `b` | Priorità Alta / Media / Bassa |
| `s` | — | Salva (riepilogo) |
| `sd` | — | Salva comunque (duplicato confermato, BR-14) |
| `e` | `n` `k` `d` `p` `i` `t` `g` `r` `m` | Campo scelto nel menù Modifica: Nome, nicKname, Data, telefono (Phone), Instagram, Telegram, Gruppi, pRiorità, Messaggio (RF-04) |
| `z` | — | Svuota il campo opzionale in modifica (RF-04) |
| `sg` | `<groupId>` | Scelta del gruppo da rinominare o eliminare (RF-07) |

Esempi: `f:k3x9q2:pr:m` (11 byte), `f:k3x9q2:t:4821` (15 byte), `p:m:123456` (10 byte).
Massimo atteso ≈ 25 byte. Test: ogni tastiera generata ha `callback_data` ≤ 64 byte UTF-8.
