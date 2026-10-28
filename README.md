# bot-compleanni

Bot Telegram personale per ricordare i compleanni.

- Stack: Cloudflare Workers (TypeScript) + D1 + Cron Trigger, costo zero.
- Metodo: spec-driven development con [spec-kit](https://github.com/github/spec-kit) e Claude Code.
- Analisi funzionale: docs/AFU.md
- Come procedere: docs/PROSSIMI_PASSI.md

## Sviluppo

```powershell
npm install          # dipendenze di sviluppo (wrangler, typescript, vitest, @cloudflare/vitest-plugin)
npm run types        # rigenera worker-configuration.d.ts dopo modifiche a wrangler.jsonc
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest nel runtime Workers, D1 locale, Telegram simulato
npm run dev          # wrangler dev (secret in .dev.vars, copiato da .dev.vars.example)
npm run bench        # benchmark CPU delle parti pure del ciclo orario (Node, soglia 3 ms)
```

## Comandi del bot

`/nuovo`, `/gruppi`, `/messaggio` (messaggio di auguri di default, con `{nome}`), `/annulla`,
`/id`, `/aiuto`, `/start`, `/p_<id>` (scheda della persona). Elenco completo con `/aiuto`.

## Ciclo orario dei promemoria

Un solo Cron Trigger (`0 * * * *`, UTC). A ogni esecuzione il Worker ricava l'ora locale
Europe/Rome da `scheduledTime` e invia solo ciò che è previsto per quell'ora (`src/config.ts`):

| Priorità | Pre-reminder (13:00) | Reminder del giorno | Recupero |
|---|---|---|---|
| Alta | −7, −2, −1 | 9 · 13 · 18 · 21 | D+1 alle 13 |
| Media | −1 | 9 · 13 · 18 | D+1 alle 13 |
| Bassa | — | 9 · 18 | D+1 alle 13 |

- Ogni invio è registrato prima di partire (indice unico): ripetere un'ora non duplica nulla.
- Un invio fallito si ritenta alle ore successive della stessa giornata, poi è abbandonato; uno
  slot non eseguito non viene recuperato.
- Al massimo 40 invii per esecuzione (`MAX_SENDS_PER_RUN`): gli eccedenti partono alle ore
  successive della giornata. Così un'esecuzione resta sotto 50 subrequest.
- A fine D+1 un'occorrenza senza risposta diventa *non confermato*; Fatto sul recupero la
  corregge entro D+7.

## Deploy

`scripts/deploy.ps1` esegue i test, applica **tutte** le migration (`0001`, `0002`, …) con
`wrangler d1 migrations apply birthday-bot-db --remote` e pubblica il Worker.

Dopo almeno 24 ore di esecuzioni: dashboard Cloudflare → Workers → `bot-compleanni` →
**Metrics**, CPU time delle invocazioni *Cron* con p99 < 7 ms e nessun `exceededCpu`; altrimenti
abbassare `MAX_SENDS_PER_RUN` (`specs/002-promemoria-esiti/quickstart.md` §4).

Validazione delle feature: `specs/001-fondamenta-anagrafica/quickstart.md`,
`specs/002-promemoria-esiti/quickstart.md`.
