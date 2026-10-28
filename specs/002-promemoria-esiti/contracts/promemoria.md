# Contratto — Testi e tastiere dei promemoria

*(RF-09…RF-13, BR-03, BR-04, BR-09, V-04…V-06; AFU §5.3–§5.5)*

Testo semplice (nessun `parse_mode`, research R-05 di 001). Tutti i testi in `src/texts.ts`.
`<nome>` = nickname se presente, altrimenti nome completo. Righe tra `[ ]` solo se il dato
esiste. Telefono nella forma salvata (E.164 senza spazi).

## Pre-reminder (`pre`, RF-09, §5.4)

```
📅 Tra 7 giorni: compleanno di Marchino (32 anni) — 14/03
[Salta quest'anno]
```

- `Tra 1 giorno` al singolare; `(N anni)` solo con anno di nascita noto.
- Data `gg/mm` della data di nascita (29/02 resta 29/02, BR-04).
- Pulsante: `Salta quest'anno` → `o:s:<deliveryId>`.
- **Dopo Salta**: testo invariato + `\n\nSaltato quest'anno`; nessun pulsante.

## Reminder del giorno (`giorno`, RF-10, §5.3)

```
🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni[ (compleanno il 29/02)]
[Gruppi: Beach tennis]
[📱 +393331234567]
[L'anno scorso: fatto ✅ | L'anno scorso: saltato]

[WhatsApp] [Instagram] [Telegram]
[Copia messaggio]
[Fatto ✅] [Salta quest'anno]
```

- `(Marco Rossi)` solo se il nickname esiste ed è diverso dal nome; `, compie N anni` solo con
  anno noto; `(compleanno il 29/02)` solo per i nati il 29/02 negli anni non bisestili.
- Gruppi in ordine alfabetico (come la scheda), separati da `, `.
- "L'anno scorso" solo con esito `fatto`/`saltato` dell'anno precedente (BR-09).
- **Dopo Fatto**: testo + `\n\n✅ Fatto`; tastiera = sole righe di contatto.
- **Dopo Salta**: testo + `\n\nSaltato`; tastiera = sole righe di contatto.

## Recupero (`recupero`, RF-13, §5.5)

```
⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?
[📱 +393331234567]

[WhatsApp] [Instagram] [Telegram] [Copia messaggio]
[Fatto ✅] [Saltato]
```

- **Dopo Fatto** (anche correzione BR-08): testo + `\n\n✅ Fatto`; sole righe di contatto.
- **Dopo Saltato**: testo + `\n\nSaltato`; righe di contatto + `[Fatto ✅]` (correzione entro D+7).

## Pulsanti di contatto (RF-11)

| Pulsante | Condizione | Tipo | Valore |
|---|---|---|---|
| WhatsApp | telefono presente | `url` | `https://wa.me/<telefono senza +>?text=<encodeURIComponent(auguri)>` |
| Instagram | username presente | `url` | `https://ig.me/m/<encodeURIComponent(username)>` |
| Telegram | username presente | `url` | `https://t.me/<encodeURIComponent(username)>` |
| Copia messaggio | auguri composti ≤ 256 caratteri | `copy_text` | `{ text: auguri }` |

`auguri` = messaggio di auguri composto (research R-12), mai con l'età (BR-03).
Nessun pulsante `tel:` o `sms:` (V-04).

## Risposte ai tocchi

| Caso | Effetto | Risposta (`answerCallbackQuery`) |
|---|---|---|
| Esito applicato | `editMessageText` del messaggio premuto | nessun testo |
| Occorrenza già chiusa / correzione non ammessa / oltre D+7 | nessuno | "Questa azione non è più disponibile" |
| Invio inesistente (persona eliminata) | nessuno | "Persona non trovata" |

## Client Telegram — aggiunte

```ts
editMessageText(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboardMarkup): Promise<void>;
```

`InlineKeyboardButton = { text; callback_data } | { text; url } | { text; copy_text: { text } }`.
Una tastiera vuota (`inline_keyboard: []`) rimuove i pulsanti.

## Budget per tocco

1 batch D1 (UPDATE + SELECT) + `editMessageText` + `answerCallbackQuery` = **3 subrequest**.
