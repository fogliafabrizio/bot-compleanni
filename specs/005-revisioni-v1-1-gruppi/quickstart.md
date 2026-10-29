# Quickstart — Validazione delle revisioni v1.1, Gruppi

**Feature**: `005-revisioni-v1-1-gruppi` | Contratti: [contracts/](contracts/) | Modello: [data-model.md](data-model.md) | Decisioni: [research.md](research.md)

## 1. Prerequisiti e comandi

Come per 001–004: `npm install`, nessun secret reale nei test, now iniettato e Telegram simulato.

```powershell
npm run typecheck   # strict, zero errori (gate 5)
npm test            # unit + integrazione (pool workers, D1 locale)
npm run bench       # CPU di groupKey/findGroups e della scheda con 200 persone (principio II)
```

Nessuna migration nuova: `npm test` applica le migration esistenti (FR-015).

## 2. Test unitari

| Cosa | Atteso | ID | File |
|---|---|---|---|
| `groupKey` sui casi della tabella di research R-02 (ZWJ, colori della pelle, bandiere, tag, ★, keycap, `U+FE0F`, accenti NFC/NFD, maiuscole, trattini, spazi multipli, cifre, solo emoji) | chiavi attese | BR-26, FR-006 | `unit/text.test.ts` |
| `hasValidGroupKey`: "🏖", "★★", "🏖 X" no; "U2", "★ Bar" sì | | FR-006a | `unit/text.test.ts` |
| `nameHash`: deterministico, base 36 ≤ 7 caratteri, diverso per "Famiglia"/"famiglia"; valore fisso di riferimento (usato anche dalla collection Postman) | | FR-005 | `unit/text.test.ts` |
| `findGroups`: esatta vince sulle parziali; più esatte → `many`; chiave vuota → `empty`; gruppo con chiave vuota mai trovato | | BR-26, FR-007, FR-016 | `unit/viste-parse.test.ts` |
| `sortGroups`: "👨‍👩‍👧 Famiglia" accanto a "Famiglia", ordine per chiave poi nome poi id | | FR-001 | `unit/viste-parse.test.ts` |
| `parseUpcomingArgs`: `fam` → 30 + "fam"; `2024 calcetto` → errore; `30 2024 calcetto` → 30 + "2024 calcetto" | | FR-011a | `unit/viste-parse.test.ts` |
| `g2:*` round-trip, caso peggiore ≤ 64 byte; `g:n`, `g:r`, `g:x` → `null` | | FR-017, V-09 | `unit/callback-data.test.ts` |
| import: gruppo nuovo con chiave < 2 → riga non valida con motivo; esistente → associato | | FR-006a, 004 FR-006 | `unit/import.test.ts` |

## 3. Test di integrazione — un test per ogni criterio Dato/Quando/Allora v1.1

Nuovo file per RF-19/BR-26 e RF-07 v1.1; RF-17 nel file di 003 esistente.

| # | Criterio (spec) | Atteso | ID | File |
|---|---|---|---|---|
| 1 | US1-1 `/gruppi fam` con "👨‍👩‍👧 Famiglia" unico | scheda | RF-19, BR-26 | `integration/v11-gruppi-ricerca.test.ts` |
| 2 | US1-2 `/gruppi famiglia` con "👨‍👩‍👧 Famiglia" e "Famiglia Rossi" | scheda di "👨‍👩‍👧 Famiglia" | RF-19, BR-26 | idem |
| 3 | US1-3 `/gruppi fam` con "Famiglia" e "Famiglia Rossi" → tocco | due pulsanti `g2:o`; il tocco apre la scheda | RF-19, RNF-14 | idem |
| 4 | US1-4 `/gruppi UNIVERSITA` | scheda di "Università" | BR-26 | idem |
| 5 | US1-5 `/gruppi xyz` | avviso + elenco a pulsanti | RF-19 | idem |
| 6 | US1-6 `/gruppo lavoro` = `/gruppi lavoro` | messaggi identici | RF-19 | idem |
| 7 | US1-7 `/aiuto` e menu | `/gruppi [nome]` presente, `/gruppo` assente; `BOT_COMMANDS` senza `gruppo` | RF-19, §5.1 | `integration/us7-start-aiuto.test.ts`, `integration/menu-comandi.test.ts` |
| 8 | US2-1 `/gruppi` con Famiglia (8) e Lavoro (5) | [Famiglia (8)] [Lavoro (5)] + [➕ Nuovo gruppo] | RF-07 | `integration/us6-gruppi.test.ts` (aggiornato) |
| 9 | US2-2 tocco su [Famiglia (8)] | nuovo messaggio, nessun `editMessage*`, nessun Indietro | RF-07, RF-19 | idem |
| 10 | US2-3 contenuto della scheda | titolo `👥 Famiglia · 8 persone`, righe di 003 per prossimo compleanno, [✏️ Rinomina] [🗑 Elimina] | RF-19 | idem |
| 11 | US2-4 Rinomina dalla scheda | domanda diretta senza "Quale gruppo?"; conferma + scheda aggiornata | RF-07 | idem |
| 12 | US2-5 Elimina dalla scheda con 8 persone | "8 persone perderanno questa etichetta"; Sì → gruppo eliminato, persone intatte, elenco aggiornato | RF-07, RNF-05 | idem |
| 13 | US2-6 tocco su gruppo eliminato / rinominato (anche solo maiuscole) | "Il gruppo non esiste più." + elenco; DB invariato | RF-07, FR-005 | idem |
| 14 | US2-7 nessun gruppo | testo dedicato + solo [➕ Nuovo gruppo] | RF-07 | idem |
| 15 | US2-8 61 gruppi / 60 gruppi | testuale con invito / pulsanti | RF-07, V-09 | idem |
| 16 | US3-1 `/prossimi 7 fam`, unico | lista filtrata 7 giorni | RF-17, BR-26 | `integration/us2-prossimi.test.ts` (aggiornato) |
| 17 | US3-2 `/prossimi 7 fam`, due gruppi → tocco | pulsanti `g2:p`; il tocco dà la lista con N = 7 | RF-17, RNF-14 | idem |
| 18 | US3-3 `/prossimi 7 xyz` | avviso + elenco a pulsanti | RF-17 | idem |
| 19 | US3-4 `/prossimi fam` | lista 30 giorni filtrata | RF-17 | idem |
| 20 | US3-5 `/prossimi 2024 calcetto`, poi `/prossimi 30 2024 calcetto` | errore 1–366; lista filtrata | RF-17 | idem |

Casi limite (stessi file): scheda divisa con i pulsanti sull'ultimo messaggio; scheda vuota con
pulsanti; due gruppi con la stessa chiave → scelta; testo di sola emoji → elenco (e `/prossimi`
senza filtro); creazione/rinomina "🏖", "★★", "🏖 X" rifiutata, "U2" e "★ Bar" ammessi (anche in
`newGroupStep` di `/nuovo`); gruppo esistente di sole emoji nell'elenco e rinominabile solo con
nome conforme; rinomina con nome di un altro gruppo o > 30 rifiutata; pulsanti `g:r`, `g:x`, `g:n`
e `f:<flowId>:sg:<id>` di prima del rilascio → "Questa azione non è più disponibile", DB invariato.

**Criteri MVP che devono continuare a passare** (SC-001): BR-17 e FR-010a in creazione e
rinomina, FR-022 singolare/plurale, Annulla, RF-06 (`/gruppi` interrompe `/nuovo`), RF-19 gruppo
vuoto, FR-010 di `/prossimi` con maiuscole.

**Budget** (principio II): `integration/budget.test.ts` — `/gruppi`, `/gruppi <testo>`, tocco
`g2:o` con 200 persone (scheda divisa), Rinomina; `integration/viste-budget.test.ts` —
`/prossimi 30 <testo>`; `integration/ciclo-budget.test.ts` — cron con 40 invii + backup mensile +
menu cambiato ≤ 50 subrequest (il passo del menu viene saltato).

## 4. Test esistenti da aggiornare

| File | Perché |
|---|---|
| `integration/us6-gruppi.test.ts` (US6 di 001) | elenco a pulsanti; Rinomina/Elimina partono dalla scheda (niente `g:r`/`g:x` né "Quale gruppo?"); il test FR-018c diventa FR-005/FR-017 |
| `integration/us5-gruppo-mese.test.ts` (003) | `/gruppo Lavoro` → scheda gruppo (titolo `👥 Lavoro · …` invece di `Gruppo Lavoro`, tastiera); `/gruppo` vuoto → elenco gruppi invece della sintassi; inesistente → avviso + elenco a pulsanti; gruppo vuoto → scheda con 0 persone |
| `integration/us2-prossimi.test.ts` (003) | FR-010: gruppo inesistente → avviso + elenco a pulsanti invece di "Gruppi esistenti: …" |
| `integration/us7-start-aiuto.test.ts` | nuova riga `/gruppi [nome]`, niente `/gruppo` |
| `integration/budget.test.ts` | misura di `/gruppi` con 20 gruppi |
| `unit/callback-data.test.ts` | `g:n`, `g:r`, `g:x` escono dal round-trip ed entrano tra i rifiutati |
| `integration/us2-inserimento.test.ts`, `us6-modifiche.test.ts` | se verificano l'elenco di `/gruppi` dopo la creazione al volo |

## 5. Smoke manuale con Postman (in locale)

```powershell
scripts/smoke-postman.ps1     # wrangler dev + helper + seed
```

Runner sulla collection 2.1.0 (research R-13), in ordine. Controlli nella chat Telegram:

1. **02** `/aiuto`: riga `/gruppi [nome]`, nessuna `/gruppo`.
2. **04** `/prossimi 7 smoke casa` → scelta tra "👨‍👩‍👧 Smoke Casa" e "Smoke Casa Rossi";
   `g2:p` → lista 7 giorni; `/prossimi 7 inesistente` → avviso + elenco a pulsanti.
3. **06** `/gruppi smoke lavoro` → scheda; `/gruppo smoke lavoro` → identica; `/gruppi casa` →
   scelta; `/gruppi pippo` → avviso + elenco; `/gruppi` → elenco a pulsanti.
4. **16** `g2:n` → crea "Postman Amici"; "🏖" → rifiutato; `g2:o` → scheda; `g2:r` → rinomina
   (DB: `name` aggiornato) e scheda nuova; `g2:r` con hash vecchio → "Il gruppo non esiste più.";
   `g2:x` → conferma → Sì (DB: gruppo assente, persone presenti); `g:r` e `f:{{flowId}}:sg:…` →
   "Questa azione non è più disponibile".

## 6. Dopo il deploy

- `scripts/deploy.ps1` come sempre (test, migration — nessuna nuova —, deploy).
- Entro un'ora (primo cron senza invii) il menu comandi mostra `/gruppi` senza `/gruppo`;
  verificabile in `settings` con `SELECT value FROM settings WHERE key = 'bot_commands'`.
- In produzione: `/gruppi` dà l'elenco a pulsanti con i nomi invariati (SC-006); un vecchio
  messaggio `/gruppi` risponde "Questa azione non è più disponibile".
