# Quickstart: validare la guida di stile

**Feature**: 008-revisioni-v1-1-stile | **Riferimenti**: [contracts/testi.md](contracts/testi.md),
[research.md](research.md)

## Prerequisiti

- dipendenze installate (`npm ci`), `.dev.vars` con token, ID proprietario e secret (solo per lo
  smoke manuale);
- nessuna migration da applicare.

## 1. Controlli automatici

```powershell
npm run typecheck      # strict, nessun errore
npm test               # tutta la suite Vitest (pool workers)
```

Esito atteso:
- `test/unit/testi.test.ts`: 100% delle chiavi di `T` classificate; regole per tipo rispettate;
  nessuna emoji nelle righe; `/aiuto` < 4096 e didascalia del modello ≤ 1024; default A-06 e riga
  d'esempio invariati (SC-001, SC-003, SC-004, SC-005);
- `test/integration/v11-stile.test.ts`: mockup §5.2 (domande, "⏭ Salta", "🎉 Fatto! Marchino è in
  rubrica." seguita dalla scheda), §5.3, §5.6 (👤, 🎂, "✏️ Modifica", "🗑 Elimina"), §5.7
  ("📆 Prossimi 30 giorni (Famiglia)" e righe senza emoji), §5.8 ("📥 Anteprima import", "⚠️ N
  errori:", "🎉 Importate…"), §5.9 (SC-002);
- tutti gli altri test di 001–007 verdi con le asserzioni riscritte sulle costanti di `T` (SC-006).

## 2. Verifica della mancata modifica di logica

```powershell
git diff --stat main -- src
```

Atteso: `src/texts.ts` più i soli 4 file di cablaggio di research R-01 (`src/bot/scheda.ts`,
`src/bot/flows/nuovo.ts`, `src/bot/flows/modifica.ts`, `src/bot/flows/elimina.ts`); nessuna
modifica a `src/telegram/keyboard.ts`, `src/db/`, `src/domain/`, `migrations/`.

## 3. Smoke Postman (manuale, chat reale)

1. `scripts/smoke-postman.ps1`, poi Runner sulla collection **2.4.0**, in ordine.
2. Tutti i `pm.test` verdi (codici HTTP e D1: nessuno cambia con questa feature).
3. Confrontare a occhio in chat i messaggi con le descrizioni "Atteso: …" aggiornate, in
   particolare: `/start` (👋), `/aiuto` (📖), `/prossimi` (📆, righe allineate senza emoji),
   inserimento guidato completo (icone per campo, ⏭ Salta, 🎉 conferma + scheda 👤/🎂),
   eliminazione (⚠️ conferma, ✅ Ho eliminato …), import con errori (📥, ⚠️, 🎉), `/backup` (💾),
   `/messaggio` (il testo salvato tra « » identico, comprese le sue emoji).

## 4. Dati in produzione (dopo il deploy)

- `/messaggio`: il messaggio attuale mostrato tra « » è identico a prima del deploy.
- Un reminder inviato prima del deploy: testo invariato; "Fatto ✅" funziona.
- `/stato` e `/statistiche`: identici a prima (FR-018).
