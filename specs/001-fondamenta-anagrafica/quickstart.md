# Quickstart — validazione della feature 001

Guida per verificare che la feature funzioni. Dettagli in [contracts/](contracts/) e
[data-model.md](data-model.md).

## Prerequisiti

- Node.js LTS e `npm`.
- Per la prova reale: bot creato con @BotFather e account Cloudflare (piano Free).
- Nessun segreto nel repository: in locale i valori stanno in `.dev.vars` (escluso da Git),
  copiato da `.dev.vars.example`.

## 1. Installazione e controlli statici

```powershell
npm install
npm run types        # wrangler types → worker-configuration.d.ts
npm run typecheck    # tsc --noEmit, strict: atteso 0 errori (gate 5)
```

## 2. Test automatici (gate 1 e 2)

```powershell
npm test             # vitest run, pool workers, D1 locale con migration applicate
```

Atteso: tutti verdi. I nomi dei test citano gli ID AFU; verificare che compaiano almeno:
RF-01…RF-08, RF-28, RF-29, RF-30, BR-01, BR-02, BR-14…BR-17, RNF-02, RNF-03, RNF-05, A-04.

Scenari chiave coperti (dalla spec):

| Scenario | Esito atteso |
|---|---|
| Richiesta senza header segreto (US1-3) | `401`, nessuna chiamata Telegram, nessuna riga scritta |
| `/id` da estraneo (US1-1) | Risposta con il suo ID |
| `/nuovo` da estraneo (US1-2) | Nessuna chiamata Telegram, nessuna riga scritta |
| Flusso §5.2 completo (US2) | Persona salvata, priorità Media se non scelta, scheda inviata |
| `31/04`, `14-3-94`, `29/02/1995`, anno 1899, anno 2027 con now 28/10/2026 | Rifiuto con formato ripetuto |
| `29/02` senza anno | Accettata |
| Duplicato nome/data (US2-2, US4-3) | Avviso e conferma esplicita |
| Nuovo gruppo nello step Gruppi + Annulla | Nessun gruppo creato (R-12) |
| Doppio "Salva" | Una sola persona |
| `/gruppi` durante `/nuovo` (US2-10) | Nessun salvataggio, elenco gruppi mostrato |
| Scheda now 28/10/2026, nascita 14/03/1994 | "compie 33 anni tra 137 giorni", nessuna riga Storico |
| `/p_<id>` di persona eliminata | "Persona non trovata" |
| Elimina → Sì | Persona, appartenenze, occorrenze, invii rimossi |
| Gruppo con 8 persone → Elimina | Testo "8 persone perderanno questa etichetta"; persone intatte |
| Stato con ultima interazione 24 h fa | Messaggio successivo trattato come fuori flusso, nessun avviso |
| Pulsante di flusso scaduto/annullato | "Questa azione non è più disponibile", nessun effetto |
| Ogni tastiera generata | `callback_data` ≤ 64 byte |

## 3. Prova locale del webhook (facoltativa)

```powershell
npx wrangler d1 migrations apply birthday-bot-db --local
npx wrangler dev
```

In un altro terminale (PowerShell), verifica di RNF-03:

```powershell
# senza header → atteso 401
curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:8787/webhook -H "Content-Type: application/json" -d "{}"
```

Con l'header corretto e un update finto del proprietario il Worker chiamerebbe la Bot API reale
con il token di `.dev.vars`: per la prova end-to-end usare il deploy (punto 4).

## 4. Prova reale su Telegram

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-bot.ps1   # primo deploy
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1      # deploy successivi
```

Poi su Telegram, dall'account del proprietario:

1. `/start` → benvenuto con `[Aggiungi persona] [Comandi]`.
2. `/nuovo` → seguire il flusso §5.2; al termine compare la scheda con `/p_<id>`.
3. Toccare `/p_<id>` → scheda; `Modifica → Instagram`, poi `Modifica → Telefono → Svuota`.
4. `/gruppi` → crea, rinomina, elimina un gruppo.
5. Da un secondo account: `/id` risponde, `/start` e `/nuovo` non producono risposta.

Controllare con `npx wrangler tail` che i log contengano solo codici, mai nomi, telefoni o testi
(principio V).
