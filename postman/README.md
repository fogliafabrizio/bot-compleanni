# Smoke test locali con Postman

Collection: `bot-compleanni.postman_collection.json` (versione in `info.version`, vedi
[Changelog](#changelog)). Environment di esempio: `locale.postman_environment.json`. Dati di
prova: `seed-smoke.sql`.

## Come funziona

Postman simula Telegram: invia al webhook locale degli `Update` finti del proprietario. Il Worker
risponde **sempre 200 vuoto**, quindi Postman controlla solo il codice HTTP. **Le risposte del bot
arrivano nella tua chat Telegram**, perché in locale il Worker chiama la Bot API reale con il token
di `.dev.vars`. Ogni richiesta ha nella descrizione (tab *Docs*) la risposta attesa.

Il webhook di produzione non cambia. I messaggi che scrivi dall'app Telegram, e i tocchi sui
pulsanti, vanno al Worker in produzione, non a quello locale.

## Preparazione (una volta per sessione)

```powershell
npx wrangler d1 migrations apply birthday-bot-db --local
npx wrangler d1 execute birthday-bot-db --local --file postman/seed-smoke.sql
npx wrangler dev
```

1. In Postman importa la collection e l'environment, poi seleziona l'environment
   **bot-compleanni locale**.
2. Imposta **solo nel *Current value*** (mai nell'*Initial value*, che finisce nel file):
   - `webhookSecret` = il valore di `WEBHOOK_SECRET` in `.dev.vars`;
   - `ownerId` = il valore di `OWNER_TELEGRAM_ID` in `.dev.vars` (numero, senza virgolette).
3. Lancia le cartelle **in ordine** (Runner o una richiesta alla volta), con la chat del bot
   aperta su Telegram.

Per ricominciare da capo basta rieseguire il seed: tocca solo le persone 9001–9006, i gruppi
9201–9202 e le loro occorrenze. Non esportare l'environment con i valori compilati, e non
committarlo.

## Dati di prova (date relative a oggi)

| Id | Persona | Compleanno | Gruppo | Occorrenze |
|---|---|---|---|---|
| 9001 | Marco Rossi "Marchino", 1994, 📱 | oggi | Smoke Lavoro | 9101 oggi *aperta*; 9102 anno scorso *fatto* |
| 9002 | Anna Bianchi, senza anno | oggi + 5 | Smoke Famiglia | — |
| 9003 | Nicolò Verdi, 1990 | oggi + 40 | — | — |
| 9004 | Luca Neri, 2000 | oggi − 3 | Smoke Lavoro | 9103 *saltato*; 9104 anno prima *saltato* |
| 9005 | Sara Gialli, senza anno | oggi − 2 | — | 9105 *aperta* |
| 9006 | Paolo Blu, 1985 | oggi − 5 | — | 9106 *non confermato* |

Se nel DB locale hai altre persone, compaiono anche nelle liste: le attese sopra valgono per i
soli dati di prova.

## Checklist rapida

| Cartella | Cosa guardare in chat |
|---|---|
| 00 Sicurezza | Nessun messaggio. Postman: 401, 401, 405, 404, 400, 200 |
| 01 /aiuto | I 7 comandi nuovi prima di `/annulla` |
| 02 /oggi | Reminder di Marchino con Fatto/Salta; dopo `t:f:9101`, `/oggi` mostra `✅ Fatto` |
| 03 /prossimi | Colonne allineate in monospazio, `/p_<id>` toccabili, filtro gruppo, errori 0/400 |
| 04 /cerca | `nicolo` e `NICOLÒ` aprono la scheda; `i` dà una lista; `zzz` nessun risultato |
| 05 /gruppo | Marco poi Luca; sintassi ed elenco gruppi |
| 06 /mese | Mese corrente; `marzo` = `3`; `marzzo` / `13` errore |
| 07 /anno | Conteggi 1/1/1; Luca in "Saltati" e nella serie; anno futuro e `20x5` errore |
| 08 /scaduti | Paolo, Luca, Sara con esito; "Segna fatto" su Luca lo toglie dall'elenco |

Controlla anche, a vista, che le colonne siano allineate e che toccando un `/p_<id>` si apra la
scheda: sono i task T053 e, in piccolo, T016a. Per T016a completo (≥ 45 righe in un messaggio)
servono almeno 46 persone: `/prossimi 366` deve arrivare in 2 messaggi con tutti i comandi
toccabili.

## Limiti noti

- **Pulsanti (`t:f`, `p:f`) da Postman**: `callback_query.id` e `message_id` sono finti, quindi
  `editMessageText` e `answerCallbackQuery` falliscono. In chat arriva "Si è verificato un errore,
  riprova" e nel terminale di wrangler compare `handler_error` con `error_code` 400. La scrittura su
  D1 avviene prima: l'effetto si verifica con la richiesta che segue (`/oggi`, `/p_9004`,
  `/scaduti`). L'aggiornamento del messaggio premuto si prova solo su Telegram, dopo il deploy.
- Nei primi giorni di gennaio le occorrenze "passate" del seed cadono nell'anno precedente: `/anno`
  senza argomento mostrerà zeri.
- Il ciclo orario (cron) non gira con `wrangler dev`.

## Changelog

- **1.0.0** (2026-10-28): prima versione. Sicurezza del webhook, `/aiuto` e i comandi della
  feature 003 (`/oggi`, `/prossimi`, `/cerca`, `/gruppo`, `/mese`, `/anno`, `/scaduti`, "Segna
  fatto").

Quando modifichi la collection in Postman, riesportala in formato v2.1 sullo stesso file, aumenta
`info.version` (e la riga "Versione" nella descrizione) e aggiungi una voce qui.
