# Contratto — Webhook HTTP e handler del Worker

*(RNF-02, RNF-03, RNF-04, RF-29, RF-30)*

## Entrypoint (`src/index.ts`)

| Handler | Comportamento in questa feature |
|---|---|
| `fetch` | Unica route `POST /webhook` (sotto) |
| `scheduled` | Cron `0 * * * *` (UTC) dichiarato in `wrangler.jsonc`; handler **vuoto** (nessuna lettura D1, nessuna chiamata Telegram). Verrà riempito dalla feature promemoria |

## `POST /webhook`

**Richiesta** (da Telegram): `Content-Type: application/json`, header
`X-Telegram-Bot-Api-Secret-Token: <WEBHOOK_SECRET>`, body = oggetto
[Update](https://core.telegram.org/bots/api#update). Tipi di update gestiti: `message`
(testo), `callback_query`. Gli altri sono ignorati con `200`. La registrazione del webhook
(`allowed_updates: ["message","callback_query"]`) è fatta da `scripts/setup-bot.ps1`.

**Risposte**

| Caso | Stato | Effetti |
|---|---|---|
| Path ≠ `/webhook` | `404` | Nessuno |
| Metodo ≠ `POST` su `/webhook` | `405` | Nessuno |
| Header segreto assente o errato (anche se l'update contiene l'ID del proprietario) | `401`, corpo vuoto | Nessuno: body non letto, nessun accesso a D1 o Telegram (RNF-03) |
| Body non JSON | `400` | Nessuno |
| Update valido, mittente estraneo, testo diverso da `/id` | `200` | Nessuno: nessuna chiamata a Telegram, nessuna query D1 (RF-30, RNF-02) |
| Update valido, `/id` da chiunque | `200` | `sendMessage` con l'ID numerico del mittente (RF-29) |
| Update valido del proprietario in chat privata | `200` | Gestione come da [comandi.md](comandi.md) e [flussi.md](flussi.md) |
| Update del proprietario fuori da una chat privata (salvo `/id`) | `200` | Nessuno |
| Errore interno durante la gestione | `200` | Log con solo codice; solo se il mittente è il proprietario in chat privata: tentativo di inviare "Si è verificato un errore, riprova"; altrimenti nessuna risposta |

Il confronto del token segreto è a tempo costante.

## Variabili e secret (`Env`)

| Nome | Tipo | Dove | Note |
|---|---|---|---|
| `DB` | D1Database | `wrangler.jsonc` (`database_name: "birthday-bot-db"`, `database_id: "REPLACE_ME"`, `migrations_dir: "migrations"`) | `REPLACE_ME` sostituito da `setup-bot.ps1` |
| `TELEGRAM_BOT_TOKEN` | secret | `wrangler secret put` / `.dev.vars` | Mai nel codice o nel repository (RNF-04) |
| `OWNER_TELEGRAM_ID` | secret | idem | ID numerico come stringa; confrontato con `String(from.id)` |
| `WEBHOOK_SECRET` | secret | idem | Generato da `setup-bot.ps1` e registrato con `setWebhook` |

Nel repository c'è solo `.dev.vars.example` con i nomi delle variabili e valori vuoti.

## Chiamate in uscita verso la Bot API (`src/telegram/client.ts`)

`POST https://api.telegram.org/bot<TOKEN>/<metodo>`, body JSON. Testo semplice, nessun
`parse_mode`.

| Metodo | Uso |
|---|---|
| `sendMessage` | `chat_id`, `text`, `reply_markup?: { inline_keyboard }` |
| `editMessageReplyMarkup` | Aggiorna la tastiera dello step Gruppi dopo ogni attiva/disattiva |
| `answerCallbackQuery` | Sempre, per ogni callback del proprietario; con `text` per "Questa azione non è più disponibile" e "Persona non trovata" |

Risposta con `ok: false` o stato HTTP ≠ 200 → eccezione con il solo `error_code`.

## Budget per update (principio II)

| Risorsa | Caso tipico | Caso peggiore (Salva con gruppi nuovi) | Limite |
|---|---|---|---|
| Subrequest D1 | 2–3 (stato + lettura + scrittura) | ~6 (stato, gruppi, duplicati, batch, rilettura scheda) | 50 |
| Subrequest Telegram | 1–2 | 3 (`answerCallbackQuery`, `sendMessage` riepilogo/esito, `sendMessage` scheda) | 50 |
| CPU | < 1 ms | ~1–2 ms (parsing JSON, render scheda, `Intl`) | 10 ms |
