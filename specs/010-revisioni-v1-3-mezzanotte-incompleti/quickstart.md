# Quickstart — validazione di Revisioni v1.3: Mezzanotte e profili incompleti

**Feature**: 010-revisioni-v1-3-mezzanotte-incompleti | Riferimenti: [plan.md](plan.md),
[contracts/viste-v13.md](contracts/viste-v13.md),
[contracts/callback-data.md](contracts/callback-data.md),
[contracts/testi-v13.md](contracts/testi-v13.md), [data-model.md](data-model.md),
[research.md](research.md)

## Prerequisiti

- Node e dipendenze installate (`npm ci`); nessuna dipendenza nuova.
- Per lo smoke: `.dev.vars` con token, ID del proprietario e secret (mai nel repository), Postman e
  `scripts/smoke-postman.ps1` come per la 2.5.0 (`postman/README.md`).
- **Nessuna migration** da applicare (data-model.md).

## 1. Gate automatici

```powershell
npm run typecheck   # strict, 0 errori
npm test            # tutti i test, compresi quelli nuovi v1.3
npm run bench       # ciclo.bench.ts e liste.bench.ts entro le soglie
```

Atteso:

- `test/unit/schedule.test.ts`: `planTargets(T, 0)` = un solo target `giorno` con `ref 0`;
  `SLOT_HOURS = [0, 9, 13, 18, 21]`; `selectNew` alle 00:00 ammette solo Alta, creata prima delle
  00:00:00 (23:30 del giorno prima sì; 00:00:00 e 00:30 no); 29/02 al 28/02/2027 e al 29/02/2028;
  date dei cambi d'ora (research R-04).
- `test/unit/time.test.ts`: 23:00Z in inverno e 22:00Z in estate → ora locale 0, anche il 29/03 e il
  25/10/2026.
- `test/unit/stato.test.ts` e `testi.test.ts`: `formatClock(0, 0) = "00:00"`, `(9, 0) = "9:00"`,
  `(1, 0) = "1:00"`, `(0, 37) = "00:37"`; "reminder delle 00:00"; nessun "0:00" isolato (SC-004).
- `test/unit/incomplete.test.ts` (nuovo): `parseIncompleteArg` (5 parole, maiuscole, `""` → menu,
  varianti e più parole → unknown), `isMissing` (`null`, `""`, `"  "` → true; `"x"`, `1990` → false),
  `matchesFilter` per i 5 filtri (Marco con solo Instagram → telefono e telegram sì, contatti no),
  `incompleteAllHave` per filtro.
- Integrazione: ogni criterio Dato/Quando/Allora v1.3 di RF-10, RF-50, RF-32 e RNF-19 ha un test con
  l'ID nel nome (tabella "Copertura" di plan.md).
- `test/integration/ciclo-budget.test.ts`: 00:00 con 200 Alta = 43 subrequest, 160 in coda.
- `test/integration/viste-budget.test.ts`: percorsi `/incomplete` e `s:i` entro la tabella R-13.
- Bench: "00:00, 200 Alta" e "`/incomplete telefono`, 200 persone" entro le soglie dei file.

## 2. Smoke manuale in Telegram (wrangler dev + Postman 2.6.0)

Avvio come per la 2.5.0, poi Runner sull'intera collection; la nuova cartella
**"22 · Mezzanotte e profili incompleti v1.3"** (prima della pulizia, che diventa "23 · Pulizia").
Il seed (`postman/seed-smoke.sql`) deve avere almeno una persona senza telefono, una con solo
Instagram, una senza anno, una con `instagram = '  '` e una persona Alta.

| # | Richiesta | Atteso nella chat del proprietario |
|---|---|---|
| 1 | `/incomplete` | "📝 Profili incompleti / Quale dato manca?" con 5 pulsanti e conteggi del seed, due per riga |
| 2 | tocco `s:i:1` | nuovo messaggio "📝 Senza telefono · N persone", righe `/p_<id>` per prossimo compleanno, nessun pulsante |
| 3 | `/incomplete Anno` | lista "📝 Senza anno di nascita · …" (argomento con maiuscola) |
| 4 | `/incomplete email` | errore ❌ e, a seguire, il menu dei filtri |
| 5 | `/statistiche` | invariata, con [📝 Profili incompleti] in fondo; "Senza contatti" = conteggio "Nessun contatto" del passo 1 |
| 6 | tocco `s:i` | nuovo messaggio identico al passo 1; `/statistiche` invariata |
| 7 | tocchi malformati `s:i:0`, `s:i:6` | "❌ Questa azione non è più disponibile." (popup), nessun messaggio |
| 8 | `/aiuto` | riga `/incomplete [campo]` dopo `/anno` |
| 9 | pulsante di un estraneo (`s:i:1`) | 200 silenzioso, nessuna risposta |

Lo slot delle 00:00 non si verifica nello smoke (serve il cron): è coperto dai test d'integrazione con
`scheduledAt` iniettato. In locale, facoltativo: `wrangler dev --test-scheduled` e
`curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"` con l'orologio del seed predisposto.

## 3. Verifiche sui dati

- Prima e dopo lo smoke: `SELECT phone, instagram, telegram, birth_year FROM persons` invariati
  (nessuna normalizzazione dei valori vuoti, FR-024).
- `SELECT kind, ref, COUNT(*) FROM deliveries GROUP BY kind, ref` dopo i test di ciclo: righe
  `('giorno', 0)` distinte da `('giorno', 9)`; nessuna riga per Media o Bassa con `ref 0`.
- Log del Worker: nessun nome, nickname, username, telefono o data; solo codici e conteggi (le nuove
  viste non aggiungono log).
