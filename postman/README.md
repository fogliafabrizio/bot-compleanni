# Test locali con Postman

Collection: `bot-compleanni.postman_collection.json` (versione in `info.version`, vedi
[Changelog](#changelog)). Environment di esempio: `locale.postman_environment.json`. Dati di
prova: `seed-smoke.sql`. File da inviare al bot: `fixtures/`. Servizio di supporto: `helper.mjs`.

## Come funziona

Postman simula Telegram: invia al webhook locale degli `Update` finti del proprietario. Il Worker
risponde **sempre 200 vuoto**. **Le risposte del bot arrivano nella tua chat Telegram**, perché in
locale il Worker chiama la Bot API reale con il token di `.dev.vars`. Nella tab *Docs* di ogni
richiesta trovi la risposta attesa.

Oltre al codice HTTP, i test controllano il **D1 locale** tramite l'helper (`helper.mjs`, porta
8788): flusso e step attivi, campi salvati, esiti delle occorrenze. L'helper serve anche a:

- leggere il `flow_id` del flusso guidato in corso. Lo script di collection lo mette in
  `{{flowId}}` prima di ogni richiesta che lo usa, così Postman può "premere" i pulsanti dei flussi
  (`f:<flowId>:<azione>`);
- caricare i file di `fixtures/` nella tua chat (didascalia `📎 File di prova Postman: …`) e
  restituire il `file_id`, da mettere nell'update finto con il documento;
- rieseguire il seed (cartelle 00 e 21).

L'helper accetta solo `SELECT` e ascolta solo su `127.0.0.1`.

Il webhook di produzione non cambia. I messaggi che scrivi dall'app Telegram, e i tocchi sui
pulsanti, vanno al Worker in produzione, non a quello locale.

## Avvio

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-postman.ps1
```

Lo script applica migration e seed al D1 locale e crea `locale.local.postman_environment.json` con
secret e id presi da `.dev.vars` (il file è ignorato da git). Poi avvia `wrangler dev
--test-scheduled` in una nuova finestra e l'helper in quella corrente.

In Postman importa la collection e `locale.local.postman_environment.json`, seleziona l'environment
e lancia il **Runner sull'intera collection**, oppure le cartelle **in ordine**. Ogni cartella
parte dallo stato lasciato dalle precedenti. Per ricominciare basta la cartella 00.

Senza lo script: `npx wrangler d1 migrations apply birthday-bot-db --local`,
`npx wrangler dev --test-scheduled`, `node postman/helper.mjs`, e nell'environment compila
`webhookSecret` e `ownerId` **solo nel *Current value***.

## Dati di prova (date relative a oggi)

| Id | Persona | Compleanno | Gruppo | Occorrenze |
|---|---|---|---|---|
| 9001 | Marco Rossi "Marchino", 1994, 📱 | oggi | Smoke Lavoro | 9101 oggi *aperta*; 9102 anno scorso *fatto* |
| 9002 | Anna Bianchi, senza anno | oggi + 5 | Smoke Famiglia, 👨‍👩‍👧 Smoke Casa | — |
| 9003 | Nicolò Verdi, 1990 | oggi + 40 | Smoke Casa Rossi | — |
| 9004 | Luca Neri, 2000 | oggi − 3 | Smoke Lavoro | 9103 *saltato*; 9104 anno prima *saltato* |
| 9005 | Sara Gialli, senza anno | oggi − 2 | — | 9105 *aperta* |
| 9006 | Paolo Blu, 1985 | oggi − 5 | — | 9106 *non confermato* |

Invii dei promemoria (per `o:f` / `o:s`): 9301 recupero di Sara, 9302 recupero di Paolo, 9303
pre-reminder di Sara.

Il seed cancella e ricrea solo questi dati, più le persone e i gruppi con "postman" nel nome
(creati dalla collection), e azzera lo stato dei flussi guidati. Se nel DB locale hai altre persone,
compaiono anche nelle liste: le attese valgono per i soli dati di prova.

## Cartelle

| Cartella | Cosa prova |
|---|---|
| 00 Preparazione | Helper attivo, seed |
| 01 Sicurezza | 401, 401, 405, 404, 400; estraneo, gruppo, callback di un estraneo, /id da estraneo: nessun messaggio |
| 02 Comandi base | /start, /aiuto, /id, testo libero, comando inesistente, /annulla a vuoto, foto |
| 03–09 Viste | /oggi e Fatto, /prossimi (anche con scelta del gruppo `g2:p`), /cerca, /gruppi <nome> e /gruppo, /mese, /anno, /scaduti e Segna fatto |
| 10 Esiti | `o:f`/`o:s` su recupero e pre-reminder, correzione entro D+7, cron dell'ora attuale |
| 11 Scheda | /p_<id>, pulsanti `s:h`, `s:n`, `p:x`, `p:m` su persona inesistente |
| 12 /nuovo | Tutti gli step con errori, Correggi, gruppi esistenti e nuovi, priorità, salvataggio |
| 13 Interruzioni | Possibile duplicato e Salva comunque; comandi, /id, foto e pulsanti vecchi durante un flusso |
| 14 Modifica | Ogni campo, Svuota, data con conferma, gruppi |
| 15 Elimina | Conferma, persona eliminata |
| 16 Gruppi | Elenco a pulsanti, crea (`g2:n`, nome doppio, lungo o senza lettere), scheda (`g2:o`), rinomina dalla scheda (anche solo maiuscole, hash vecchio), elimina dalla scheda con e senza membri, pulsanti vecchi `g:r` e `f:…:sg` |
| 17 /messaggio | Troppo lungo, anteprima, conferma, ripristino del messaggio standard |
| 18 File in uscita | /modello, /export, /backup |
| 19 Import CSV | Anteprima, Importa, duplicati, separatore `,` e BOM, intestazione, vuoto, Latin-1, .txt, .json, file troppo grandi, download fallito |
| 20 /ripristina | Attesa del file, JSON rotti, due conferme, ripristino. ⚠️ **Sostituisce tutto il D1 locale** |
| 21 Pulizia | Seed |

## Limiti noti

- **Ogni pulsante da Postman produce anche "Si è verificato un errore, riprova"** in chat.
  `callback_query.id` è finto, quindi `answerCallbackQuery` fallisce. L'azione è già stata eseguita:
  i test sul D1 lo confermano. Nel terminale di wrangler compare `handler_error` con `error_code`
  400. Per lo stesso motivo il popup del pulsante (es. "Persona non trovata") non si vede.
- I callback delle cartelle 10–20 non hanno `message`, quindi il bot non modifica il messaggio
  premuto: risponde con un messaggio nuovo (es. `Gruppi?` aggiornato). Quelli di 03 e 09 hanno un
  `message_id` finto e `editMessageText` fallisce. Le modifiche ai messaggi si provano solo su
  Telegram, dopo il deploy.
- Il pulsante **Annulla** dei flussi non funziona da Postman: risponde al callback prima di chiudere
  il flusso e quella chiamata fallisce. Le cartelle usano `/annulla`.
- **La cartella 20 cancella tutto il D1 locale**, compresi i tuoi dati non di prova, e lo
  sostituisce con `fixtures/backup-ok.json`. La 21 rimette solo i dati di prova.
- I pulsanti dei gruppi (`g2:<azione>:<id>:<hash>`) contengono l'hash del nome: nelle richieste si
  scrive `{{hash:<nome esatto>}}` e lo script di collection lo calcola con `nameHash` (stesso
  algoritmo di `src/domain/text.ts`). Il gruppo 9203 ha l'hash fisso `1ol49qr`.
- "Cron ora" senza promemoria né backup da inviare registra anche il menu dei comandi
  (`setMyCommands`) sul bot di `.dev.vars`, la prima volta e a ogni cambio del menu.
- La richiesta "Cron ora" della cartella 10 usa l'ora attuale: invia promemoria solo alle 9, 13, 18
  e 21 (ora di Roma). Serve `wrangler dev --test-scheduled`.
- Nei primi giorni di gennaio le occorrenze "passate" del seed cadono nell'anno precedente: `/anno`
  senza argomento mostrerà zeri.

## Changelog

- **2.1.0** (2026-10-29): feature 005 (gruppi v1.1), 229 richieste. Cartelle aggiornate: 02
  (`/aiuto` con `/gruppi [nome]`, senza `/gruppo`), 04 (`/prossimi 7 casa` con scelta `g2:p`,
  gruppo inesistente con elenco a pulsanti), 06 → "06 · /gruppi <nome> (RF-19, BR-26)", 16 →
  "16 · Gruppi (/gruppi, g2:*)" (Rinomina ed Elimina dalla scheda, FR-006a, pulsanti vecchi).
  Seed: gruppi 9203 "👨‍👩‍👧 Smoke Casa" e 9204 "Smoke Casa Rossi". Script di collection: `nameHash`
  e `{{hash:<nome>}}`.
- **2.0.0** (2026-10-29): collection completa per le feature 001–004, 226 richieste. Aggiunti
  helper (`helper.mjs`), controlli sul D1, `{{flowId}}` automatico, file di prova (`fixtures/`),
  invii 9301–9303 nel seed, cartelle 00, 02, 10–21 e casi nuovi in 01. Cartelle 03–09 = vecchie
  02–08.
- **1.0.0** (2026-10-28): prima versione. Sicurezza del webhook, `/aiuto` e i comandi della
  feature 003 (`/oggi`, `/prossimi`, `/cerca`, `/gruppo`, `/mese`, `/anno`, `/scaduti`, "Segna
  fatto").

Quando modifichi la collection in Postman, riesportala in formato v2.1 sullo stesso file, aumenta
`info.version` (e la riga "Versione" nella descrizione) e aggiungi una voce qui.
