# Contratto — Formato delle liste e divisione dei messaggi

Requisiti: FR-001, FR-001a, FR-002…FR-005, AFU §4.4, §5.7, RNF-14, RNF-16. Modulo puro
`src/bot/liste.ts` (nessun import di `cloudflare:*`, così il benchmark gira in Node).

## Riga

```text
┌──────────────── entità code (monospazio) ────────────────┐  ┌ bot_command ┐
<Ggg> <gg/mm>  <nome>[ (<età>)]<spazi>[  <esito><spazi>]     /p_<id>
```

Ogni riga porta esattamente due entità, che non si sovrappongono: `code` sulla parte sinistra e
`bot_command` esattamente su `/p_<id>` (offset e lunghezza del comando), così il comando è
toccabile senza dipendere dal riconoscimento automatico di Telegram. Tra la fine del `code` e
`/p_<id>` ci sono due spazi, fuori da entrambe le entità.

| Campo | Regola |
|---|---|
| `Ggg` | `WEEKDAYS_IT[getUTCDay()]` della data effettiva della riga: `Dom Lun Mar Mer Gio Ven Sab` |
| `gg/mm` | giorno e mese di **nascita** con due cifre (`29/02` resta tale, BR-04) |
| `nome` | `nickname ?? full_name` |
| `età` | solo con `birth_year` noto; quale età: [research R-04](../research.md#r-04--età-e-anno-di-riferimento-per-vista) |
| colonna "nome (età)" | riempita con spazi fino a `W` = più lungo della lista intera (in code point), con tetto `LIST_NAME_COLUMN_MAX = 20`; oltre il tetto la riga sfora, senza troncamenti |
| `esito` | solo in `/scaduti`: `saltato`, `non confermato`, `in attesa`, riempito a 14 |
| `/p_<id>` | comando toccabile che apre la scheda (RNF-14), coperto dall'entità `bot_command`, **mai** dentro il `code` |

Esempi (oggi = mercoledì 28/10/2026; `[…]` = parte in monospazio):

```text
[Ven 30/10  Anna (28)   ]  /p_4
[Gio 12/11  Giulia      ]  /p_9
[Dom 29/02  Leo (22)    ]  /p_40     ← nato il 29/02/2005; 2027 non bisestile: giorno della settimana del 28/02

Ultimi 7 giorni, non fatti

[Sab 24/10  Marco (32)  saltato       ]  /p_12
[Mar 27/10  Sara        in attesa     ]  /p_31
```

Esempio §5.7 come appare in Telegram:

```text
Prossimi 30 giorni (Famiglia)

Ven 30/10  Anna (28)    /p_4
Lun 02/11  Luca (35)    /p_17
Gio 12/11  Giulia       /p_9
```

## Invio con entità

- `TelegramApi.sendMessage(chatId, text, keyboard?, entities?)`: `entities` è un array
  `{ type: "code" | "bot_command"; offset: number; length: number }` (tipo `MessageEntity` in
  `src/telegram/types.ts`), inviato come campo `entities` della Bot API.
- **Nessun `parse_mode`**: i nomi non si escapano; offset e lunghezze in unità UTF-16, cioè
  `String.length` in TypeScript.
- Intestazioni e righe di sezione (`/anno`) sono testo semplice, senza entità.

## Struttura del messaggio

```text
<intestazione>
                         ← riga vuota
<riga>
<riga>
…
```

- Nessuna tastiera inline su nessun messaggio di lista (FR-004, SC-005).
- Ordinamento: [research R-03](../research.md#r-03--ordinamento-fr-002-fr-015-fr-016-fr-019).
- `/anno` è un messaggio a sezioni: righe di conteggio, riga vuota, sezione "Saltati:" con le
  righe, riga vuota, sezione delle serie con le righe. La larghezza `W` è calcolata sull'insieme
  delle righe del messaggio a sezioni.

## Divisione (`splitMessage`)

```ts
interface ListLine { text: string; entities: MessageEntity[] }   // offset relativi alla riga
interface OutMessage { text: string; entities: MessageEntity[] } // offset relativi al messaggio
function splitMessage(lines: readonly ListLine[]): OutMessage[]
```

- Riempimento greedy: si aggiungono righe intere unite da `\n` finché il testo resta
  `≤ MESSAGE_MAX_LENGTH` (4096, `String.length`) **e** le righe con entità sono
  `≤ LIST_MAX_LINES_PER_MESSAGE` (45 righe = 90 entità, limite prudenziale da verificare con il
  bot reale, research R-05).
- Una riga non viene mai spezzata; le righe vuote all'inizio di un messaggio di continuazione si
  scartano; gli offset delle entità vengono traslati alla posizione della riga nel messaggio.
- L'intestazione sta solo nel primo messaggio; `W` è la stessa in tutti i messaggi della lista.
- I messaggi si inviano in sequenza con `sendMessage`, senza pause (research R-01, R-06).
- Costanti in `src/config.ts`: `MESSAGE_MAX_LENGTH`, `LIST_MAX_LINES_PER_MESSAGE`,
  `LIST_NAME_COLUMN_MAX`.

Proprietà verificate dai test unitari: concatenazione dei messaggi = testo originale (a meno delle
righe vuote scartate); ogni messaggio `≤ 4096` e `≤ 45` righe con entità; ogni riga intera in un
solo messaggio; per ogni riga il `code` copre esattamente la parte sinistra e mai `/p_<id>`, il
`bot_command` copre esattamente `/p_<id>`; 200 righe con nickname di 60 caratteri ed emoji producono messaggi e offset validi.
