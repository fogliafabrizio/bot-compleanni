# Quickstart: Revisioni v1.1 — Stato e statistiche

Guida di verifica. Dettagli in [data-model.md](data-model.md) e [contracts/](contracts/).

## Prerequisiti

- `npm install`; nessuna migration nuova (`npx wrangler d1 migrations list` invariato).
- Test con D1 locale e fake Telegram (now iniettato, nessuna rete reale).

## Comandi

```bash
npm run typecheck          # strict, nessun errore
npm test                   # unit + integration, tutti verdi (anche 001–006)
npm run bench              # ciclo orario, /stato, /statistiche entro 10 ms CPU
```

## Mappa criteri → test

| ID | Criterio | Test |
|---|---|---|
| RF-31 / US1-1 | cron regolare, 3 reminder oggi → ora corrente e "3 inviati, 0 falliti, 0 abbandonati" | `test/integration/v11-stato.test.ts` |
| RF-31 / US1-2 | abbandonato di ieri nella riga 7 giorni con nome | `v11-stato.test.ts` |
| RF-31 / US1-3 | nessuna esecuzione → "mai registrato" | `v11-stato.test.ts` |
| RF-31 / US1-4 | nessun backup mensile → "mai registrato" | `v11-stato.test.ts` |
| RF-31 / US1-5 | ultimo backup fallito (Telegram) → data, ora, ❌ | `v11-stato.test.ts`, `us3-backup-mensile.test.ts` |
| RF-31 / US1-6 | errore webhook + 2 in coda | `v11-stato.test.ts` |
| RF-31 / US1-7 | `getWebhookInfo` in errore → solo riga webhook "non disponibile" | `v11-stato.test.ts` |
| RF-31 / casi limite | data se non oggi; `in_invio` corrente escluso e vecchio abbandonato; `fallito` di ieri abbandonato; tipi pre/reminder/recupero nel dettaglio; persona eliminata; `/oggi`/`/backup`/avviso non contati; backup ⚠️ esito sconosciuto; errore non Telegram → ❌ e non ritentato; `/backup` non tocca la riga | `v11-stato.test.ts`, `test/unit/stato.test.ts` |
| N-06 / US2-1…5 | buco 14→19, regolare, prima esecuzione, nessun secondo avviso, nessun recupero slot | `test/integration/v11-buco-cron.test.ts` |
| N-06 / casi limite | esattamente 2 h; mezzanotte e più giorni; cambio d'ora (due versi); avviso fallito non ritentato e ora aggiornata; riesecuzione stessa ora; esecuzione tardiva; guasto durante gli invii; avviso prima dei promemoria e fuori tetto | `v11-buco-cron.test.ts`, `test/unit/stato.test.ts` (`detectGap`, testo) |
| RF-32 / US3-1…4 | 112 persone; senza storico; persona in 2 gruppi; marzo a 0 | `test/integration/v11-statistiche.test.ts` |
| RF-32 / casi limite | rubrica vuota; nessun gruppo; gruppo vuoto; priorità a 0; "Senza gruppo N" solo se > 0; 29/02 in febbraio; anno con sole aperte escluso; anno a 0%; barra minima 1 blocco | `v11-statistiche.test.ts`, `test/unit/statistiche.test.ts` |
| §8 / FR-002, FR-003, FR-022 | backup senza chiavi tecniche; ripristino non le tocca; file con chiavi tecniche accettato; backup pre-rilascio ripristinabile | `us2-backup.test.ts`, `us2-ripristino.test.ts`, `test/unit/backup.test.ts` |
| §5.1 / FR-016 | `/aiuto` e `BOT_COMMANDS` con `/statistiche`, `/stato`; menu aggiornato dal cron | `us7-start-aiuto.test.ts`, `menu-comandi.test.ts` |
| RNF-08 / FR-018 | nessun dato personale nei log di avviso, stato, webhook | `test/unit/privacy-log.test.ts` |
| RNF-17 / FR-017 | subrequest ≤ 50 (caso peggiore 48), CPU ≤ 10 ms | `ciclo-budget.test.ts`, `viste-budget.test.ts`, `bench/ciclo.bench.ts`, `bench/stato.bench.ts` |
| 001 FR-018, FR-027 | comandi nuovi interrompono i flussi; nessuna risposta a non proprietari | `v11-stato.test.ts`, `v11-statistiche.test.ts` |

## Verifica manuale dopo il deploy (produzione)

1. Subito dopo il deploy: `/stato` → "Ultimo controllo orario: mai registrato", "Ultimo backup
   mensile: mai registrato"; webhook "nessun errore, 0 update in coda".
2. Dopo la prima esecuzione oraria: `/stato` mostra l'ora piena appena trascorsa; nessun avviso di
   buco ricevuto; il menu dei comandi di Telegram contiene `/statistiche` e `/stato`.
3. `/statistiche`: totali coerenti con `/anno` e con le liste; 12 righe di istogramma.
4. `/backup`: il JSON contiene in `settings` solo `default_message`.
5. Il 1° del mese dopo le 9:00: `/stato` mostra il backup mensile con ✅.
