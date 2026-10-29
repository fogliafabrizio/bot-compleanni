# bot-compleanni

Bot Telegram personale per ricordare i compleanni. Tiene una rubrica di persone e gruppi, manda
promemoria a orari fissi in base alla priorità e registra se hai fatto gli auguri. Ha anche
import/export CSV e backup JSON.

- **Stack**: Cloudflare Workers (TypeScript) + D1 (SQLite) + Cron Trigger. Il piano gratuito
  di Cloudflare basta.
- **Un solo utente**: il bot risponde solo all'ID Telegram del proprietario (`OWNER_TELEGRAM_ID`).
- **Metodo**: spec-driven development con [spec-kit](https://github.com/github/spec-kit) e
  Claude Code. Specifiche delle feature in `specs/`.
- **Documentazione**: analisi funzionale in [docs/AFU.md](docs/AFU.md), problemi e revisioni in
  [docs/REVISIONI.md](docs/REVISIONI.md), test manuali con Postman in
  [postman/README.md](postman/README.md).

## Come funziona

```
Telegram ──POST /webhook──▶ Worker "bot-compleanni" ◀── Cron Trigger (ogni ora, UTC)
                                │
                                ▼
                     D1 "birthday-bot-db"
```

- **Webhook**: Telegram invia ogni messaggio a `https://<worker>.workers.dev/webhook`. Il Worker
  accetta solo `POST` con l'header `X-Telegram-Bot-Api-Secret-Token` uguale a `WEBHOOK_SECRET`
  (altrimenti risponde `401`). Ogni altro percorso risponde `404`.
- **Cron**: ogni ora il Worker manda i promemoria previsti per quell'ora, fa il backup mensile e
  aggiorna il menu dei comandi di Telegram se è cambiato.
- **Dati**: tutto è su D1. Lo schema si applica con le migration in `migrations/`.

## Prerequisiti

- [Node.js](https://nodejs.org/) LTS (con `npm`).
- Un account [Cloudflare](https://dash.cloudflare.com/sign-up). Il piano Free va bene e non
  serve un dominio: il Worker usa il sottodominio gratuito `*.workers.dev`.
- Un bot Telegram creato con [@BotFather](https://t.me/BotFather) (`/newbot`): ti dà il
  **token**.
- Il tuo **ID Telegram** numerico: scrivi a [@userinfobot](https://t.me/userinfobot).
- Windows con PowerShell per gli script in `scripts/`. Su altri sistemi esegui i comandi
  `wrangler` a mano (vedi [Setup manuale](#setup-manuale)).

## Installazione su Cloudflare

### Primo deploy (automatico)

> **Account Cloudflare nuovo?** `wrangler.jsonc` contiene il `database_id` del D1 già creato
> dall'autore. Se installi il bot sul tuo account, prima del setup sostituisci quel valore con
> `REPLACE_ME`: lo script creerà il database e scriverà il nuovo ID.

Dalla cartella del progetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-bot.ps1
```

Lo script:

1. esegue `npm install`;
2. fa il login a Cloudflare con `wrangler login` (si apre il browser), se non sei già loggato;
3. crea il database D1 `birthday-bot-db` e scrive il suo ID in `wrangler.jsonc`;
4. applica le migration sul database remoto;
5. pubblica il Worker e legge il suo URL `*.workers.dev`;
6. chiede token del bot e ID Telegram, genera un `WEBHOOK_SECRET` casuale e salva i tre valori
   come secret del Worker;
7. registra il webhook su Telegram (`setWebhook`) con il secret e mostra `getWebhookInfo`.

Alla fine apri il bot su Telegram e scrivi `/start`.

Se il deploy fallisce per il **sottodominio workers.dev mancante** (succede solo la prima volta
su un account nuovo), lancia `npx wrangler deploy`, rispondi `Y` alla registrazione del
sottodominio e rilancia lo script.

### Setup manuale

Gli stessi passi, senza script (vanno bene anche su macOS e Linux):

```powershell
npm install
npx wrangler login
npx wrangler d1 create birthday-bot-db         # copia il database_id in wrangler.jsonc
npx wrangler d1 migrations apply birthday-bot-db --remote
npx wrangler deploy                            # annota l'URL https://bot-compleanni.<account>.workers.dev
npx wrangler secret put TELEGRAM_BOT_TOKEN     # token di @BotFather
npx wrangler secret put OWNER_TELEGRAM_ID      # il tuo ID numerico
npx wrangler secret put WEBHOOK_SECRET         # una stringa casuale (A-Z, a-z, 0-9, _ e -)
```

Poi registra il webhook (sostituisci i tre valori):

```powershell
$token  = "<TOKEN>"
$url    = "https://bot-compleanni.<account>.workers.dev/webhook"
$secret = "<WEBHOOK_SECRET>"
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body @{
    url = $url; secret_token = $secret
    allowed_updates = '["message","callback_query"]'; drop_pending_updates = "true"
}
```

### Deploy successivi

Dopo ogni modifica su `main`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
```

Lo script esegue i test, applica **tutte** le migration non ancora applicate (`0001`, `0002`, …)
con `wrangler d1 migrations apply birthday-bot-db --remote` e pubblica il Worker con
`wrangler deploy`. Si ferma al primo errore. Se non sei su `main` chiede conferma.

Secret e webhook restano validi tra un deploy e l'altro: non serve reimpostarli.

### Secret

| Secret | Contenuto |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token del bot di @BotFather |
| `OWNER_TELEGRAM_ID` | ID Telegram numerico dell'unico utente autorizzato |
| `WEBHOOK_SECRET` | token che Telegram manda nell'header di ogni richiesta al webhook |

I secret non stanno mai in `wrangler.jsonc` né nel repository. Per vederli o cambiarli:

```powershell
npx wrangler secret list
npx wrangler secret put <NOME>
```

Se cambi `WEBHOOK_SECRET` o `TELEGRAM_BOT_TOKEN`, registra di nuovo il webhook con `setWebhook`
(vedi [Setup manuale](#setup-manuale)): altrimenti Telegram continua a usare il vecchio valore
e il Worker risponde `401`.

### Controlli dopo il deploy

- **Webhook**: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` deve mostrare l'URL giusto
  e nessun `last_error_message`. Dal bot, `/stato` riassume salute di cron, invii, backup e
  webhook.
- **Log in tempo reale**: `npx wrangler tail --format pretty`. Durante un'ora con invii compaiono
  righe `cron_run` con soli numeri (nei log non finiscono dati personali).
- **CPU del cron**: dopo almeno 24 ore, dashboard Cloudflare → **Workers & Pages** →
  `bot-compleanni` → **Metrics**. Le invocazioni *Cron* devono avere CPU time p99 < 7 ms e nessun
  `exceededCpu` (il piano Free concede 10 ms). Se sei oltre, abbassa `MAX_SENDS_PER_RUN` in
  `src/config.ts` e rifai il deploy (`specs/002-promemoria-esiti/quickstart.md` §4).
- **Cron Trigger**: nella stessa pagina, scheda **Settings** → **Triggers**, deve esserci
  `0 * * * *`.

### Dati su D1

- **Interrogare il database remoto**:
  `npx wrangler d1 execute birthday-bot-db --remote --command "SELECT COUNT(*) FROM ..."`.
- **Copia completa in SQL**: `npx wrangler d1 export birthday-bot-db --remote --output backup.sql`.
- **Backup dal bot**: `/backup` manda un JSON completo, `/ripristina` lo ricarica. Il cron ne
  manda uno in automatico il giorno 1 di ogni mese dalle 9:00.
- **Tornare indietro nel tempo**: D1 Time Travel ripristina il database a un momento recente
  (`npx wrangler d1 time-travel restore birthday-bot-db --timestamp <ISO 8601>`).

## Sviluppo in locale

Copia `.dev.vars.example` in `.dev.vars` e compila i tre secret (il file è ignorato da git).

```powershell
npm install          # dipendenze di sviluppo (wrangler, typescript, vitest, @cloudflare/vitest-plugin)
npm run types        # rigenera worker-configuration.d.ts dopo modifiche a wrangler.jsonc
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest nel runtime Workers, D1 locale, Telegram simulato
npm run dev          # wrangler dev con i secret di .dev.vars
npm run bench        # benchmark CPU delle parti pure: ciclo orario, liste, import/backup, stato (soglia 3 ms)
```

- Il D1 locale sta in `.wrangler/` e si prepara con
  `npx wrangler d1 migrations apply birthday-bot-db --local`.
- `npx wrangler dev --test-scheduled` permette di lanciare il cron a mano con
  `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"`.
- Il webhook di produzione non cambia: i messaggi che scrivi dall'app Telegram vanno sempre al
  Worker su Cloudflare. Per provare il Worker locale usa la collection Postman
  ([postman/README.md](postman/README.md)), che simula gli update di Telegram.

## Comandi del bot

| Comando | Cosa fa |
|---|---|
| `/nuovo` | aggiunge una persona, un campo alla volta |
| `/gruppi [nome]` | elenco dei gruppi; con un nome cerca il gruppo e apre la scheda |
| `/messaggio` | modifica il messaggio di auguri di default (con `{nome}`) |
| `/oggi` | compleanni di oggi |
| `/prossimi [giorni] [gruppo]` | prossimi compleanni |
| `/cerca <testo>` | cerca per nome o nickname |
| `/mese [mese]` | compleanni del mese |
| `/scaduti` | compleanni degli ultimi giorni non ancora fatti |
| `/anno [anno]` | riepilogo dell'anno |
| `/statistiche` | statistiche della rubrica e andamento |
| `/stato` | salute di cron, invii, backup e webhook |
| `/modello` | modello CSV per l'import |
| `/export` | esporta le persone in CSV |
| `/backup` · `/ripristina` | backup completo in JSON e ripristino |
| `/annulla` | interrompe l'operazione guidata in corso |
| `/id` · `/aiuto` · `/start` | ID Telegram, elenco dei comandi, benvenuto |
| `/p_<id>` | apre la scheda di una persona |

Per importare persone basta inviare al bot un file CSV. L'elenco aggiornato è sempre in `/aiuto`.

## Ciclo orario dei promemoria

Un solo Cron Trigger (`0 * * * *`, UTC). A ogni esecuzione il Worker ricava l'ora locale
Europe/Rome da `scheduledTime` e invia solo ciò che è previsto per quell'ora (`src/config.ts`).
L'ora legale è gestita in automatico.

| Priorità | Pre-reminder (alle 13) | Reminder del giorno | Recupero |
|---|---|---|---|
| Alta | −7, −2, −1 giorni | 9 · 13 · 18 · 21 | D+1 alle 13 |
| Media | −1 giorno | 9 · 13 · 18 | D+1 alle 13 |
| Bassa | — | 9 · 18 | D+1 alle 13 |

- Ogni invio è registrato prima di partire (indice unico): rieseguire un'ora non duplica nulla.
- Un invio fallito si ritenta alle ore successive della stessa giornata, poi è abbandonato. Uno
  slot non eseguito (per esempio un'ora in cui Cloudflare non ha lanciato il cron) non viene
  recuperato; `/stato` lo segnala.
- Al massimo 40 invii per esecuzione (`MAX_SENDS_PER_RUN`); gli eccedenti partono alle ore
  successive. Così un'esecuzione resta sotto il limite di 50 subrequest del piano Free.
- A fine D+1 un compleanno senza risposta diventa *non confermato*; il pulsante Fatto sul
  messaggio di recupero lo corregge entro D+7.

## Struttura del progetto

| Percorso | Contenuto |
|---|---|
| `src/` | codice del Worker: `index.ts` (entry point), `bot/` (webhook e comandi), `cron/`, `db/`, `domain/`, `telegram/`, `texts.ts` (tutti i testi) |
| `migrations/` | migration SQL di D1 |
| `test/`, `bench/` | test (unit e integrazione) e benchmark |
| `scripts/` | `setup-bot.ps1`, `deploy.ps1`, `smoke-postman.ps1` |
| `postman/` | collection per i test manuali in locale |
| `specs/`, `docs/` | specifiche delle feature, analisi funzionale e revisioni |
