# Quickstart — validazione di Revisioni v1.2: Navigazione

**Feature**: 009-revisioni-v1-2-navigazione | Riferimenti: [plan.md](plan.md),
[contracts/viste-v12.md](contracts/viste-v12.md),
[contracts/callback-data.md](contracts/callback-data.md),
[contracts/testi-v12.md](contracts/testi-v12.md), [data-model.md](data-model.md)

## Prerequisiti

- Node e dipendenze installate (`npm ci`); nessuna dipendenza nuova.
- Per lo smoke: `.dev.vars` con token, ID del proprietario e secret (mai nel repository), Postman e
  `scripts/smoke-postman.ps1` come per la 2.4.0 (`postman/README.md`).
- **Nessuna migration** da applicare (data-model.md).

## 1. Gate automatici

```powershell
npm run typecheck   # strict, 0 errori
npm test            # tutti i test, compresi quelli nuovi v1.2
npm run bench       # stato.bench.ts e liste.bench.ts entro le soglie
```

Atteso:

- `test/unit/navigazione.test.ts` (nuovo): `adjacentMonths` circolare, `yearNavigation` sui 4 casi
  della tabella `/anno`, `canWidenUpcoming(89) = true`, `(90) = false`.
- `test/unit/statistiche.test.ts`: `currentAge` (29/10 e 10/03 per 14/03/1994; 29/02/2000 al
  28/02/2026 = 26; nato quest'anno dopo oggi = 0), `ageBuckets` (8, 34, 37, 52 → 6 righe con
  intermedie a 0; 83 e 91 → `80+`; 126 anni → `80+`), `averageAge` (32,5 → 33),
  `isValidBirthYear` (1899, anno futuro → false).
- `test/unit/callback-data.test.ts`: forme nuove ≤ 64 byte, round-trip, malformati → `null` o
  "non più disponibile".
- `test/unit/testi.test.ts`: tutte le chiavi nuove nell'inventario, regole per tipo rispettate.
- Integrazione: ogni scenario Dato/Quando/Allora v1.2 di RF-01, RF-07, RF-17, RF-19, RF-20, RF-22,
  RF-32, RNF-14 e RNF-19 ha un test con l'ID nel nome (tabella in plan.md, "Copertura").
- `test/integration/viste-budget.test.ts`: subrequest dei percorsi di research R-11 entro i valori
  della tabella.
- Bench: sezione Età su 200 persone < 0,1 ms; `/statistiche` completa entro la soglia del file
  (≤ 2 ms per iterazione).

## 2. Smoke manuale in Telegram (wrangler dev + Postman 2.5.0)

Avvio come per la 2.4.0, poi Runner sull'intera collection; la nuova cartella
**"21 · Navigazione v1.2"** (prima della pulizia, che diventa "22 · Pulizia") contiene le richieste
sotto. Il seed (`postman/seed-smoke.sql`) ha i gruppi 9201…9204: verificare che ci siano persone
senza gruppo e uno storico chiuso dell'anno precedente, e aggiungerli se mancano (vedi tasks).

| # | Richiesta | Atteso nella chat del proprietario |
|---|---|---|
| 1 | `/gruppi` | elenco con [Senza gruppo (N)] su una riga a sé sopra [➕ Nuovo gruppo] |
| 2 | tocco `g2:s` | "👥 Senza gruppo · N persone", righe `/p_<id>`, solo [⬅️ Tutti i gruppi] |
| 3 | tocco `g2:o:<id>:<h>` (Smoke Famiglia) | scheda con [✏️ Rinomina] [🗑 Elimina] / [⬅️ Tutti i gruppi] |
| 4 | tocco `g2:l` | nuovo messaggio con l'elenco gruppi; la scheda precedente invariata |
| 5 | `/prossimi` | lista 30 giorni con [Prossimi 90 giorni] |
| 6 | tocco `s:u` | lista dei prossimi 90 giorni, senza pulsante |
| 7 | `/prossimi 7 smoke famiglia` poi tocco `g2:p:<id>:<h>:90` | 90 giorni del solo gruppo |
| 8 | `/mese marzo` poi tocco `s:m:4` | [◀️ Febbraio] [Aprile ▶️]; poi la vista di aprile con [◀️ Marzo] [Maggio ▶️] |
| 9 | `/mese dicembre` | [◀️ Novembre] [Gennaio ▶️] |
| 10 | `/anno` poi tocco `s:y:<anno − 1>` | pulsanti secondo la tabella di contracts/viste-v12.md |
| 11 | `/statistiche` | sezione 🧑 Età dopo l'istogramma per mese, con "Età media" |
| 12 | `/nuovo` completo → conferma | "🎉 Fatto! … è in rubrica." con [➕ Aggiungi un'altra persona]; tocco `s:n` → domanda del nome |
| 13 | `/p_<id>` della persona appena salvata | scheda **senza** [➕ Aggiungi un'altra persona] |
| 14 | tocchi malformati `s:m:13`, `s:y`, `g2:l:1`, `s:u:5` | "❌ Questa azione non è più disponibile." (popup), nessun messaggio |
| 15 | pulsante di un estraneo (`g2:l`) | 200 silenzioso, nessuna risposta |

Ogni richiesta controlla anche, via `postman/helper.mjs`, che il flusso guidato attivo sia stato
annullato dove previsto (tocchi 2, 4, 6, 8, 10, 12).

## 3. Verifiche sui dati

- Dopo lo smoke: `SELECT COUNT(*) FROM groups WHERE name = 'Senza gruppo'` resta quello del seed
  (nessun gruppo creato dal codice).
- `/export` e `/backup`: nessuna traccia della voce virtuale (spec 004 invariata).
- Log del Worker (`wrangler dev`): nessun nome, nickname o data; solo codici e conteggi.
