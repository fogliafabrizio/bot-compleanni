# Quickstart — 003 Viste e ricerche

Guida di validazione. Prerequisiti, installazione e secret come nel
[quickstart 001](../001-fondamenta-anagrafica/quickstart.md); nessuna nuova migration.

## 1. Gate automatici

```powershell
npm run typecheck          # strict, nessun errore
npm test                   # pool workers: unit + integrazione
npm run bench              # include bench/liste.bench.ts (Node)
```

Esito atteso: tutti i test verdi; benchmark "liste, 200 persone" e "/cerca, 200 persone" sotto
2 ms per iterazione (research R-12).

## 2. Scenari coperti dai test

| File | Scenari | ID |
|---|---|---|
| `test/integration/us1-oggi.test.ts` | reminder per ogni compleanno di oggi con pulsanti; occorrenza già *fatto*; Fatto/Salta da `/oggi` senza slot né recupero e senza righe `deliveries`; nessun compleanno → prossimo (tutti quelli del giorno); nessuna persona; 29/02 il 28/02; tetto di 10 messaggi + lista; persona eliminata → "Persona non trovata" | RF-16, BR-07, FR-006…FR-008 |
| `test/integration/us2-prossimi.test.ts` | default 30, `7 famiglia`, `famiglia` senza numero, gruppo inesistente con elenco, 0/−3/400, oggi compreso e oggi+7 escluso, riga senza età, nessun risultato, maiuscole nel gruppo | RF-17, FR-009…FR-011 |
| `test/integration/us3-cerca.test.ts` | un risultato → scheda; più → lista ordinata; `MARCHINO`; `nicolo` ↔ `Nicolò`; nessun risultato; senza testo | RF-18, FR-012, FR-013 |
| `test/integration/us4-scaduti.test.ts` | saltato/non confermato/in attesa nella finestra, *fatto* e oggi−8 esclusi, oggi escluso; "Segna fatto" presente/assente, tocco → *fatto* + storico + pulsante sparito; ieri aperta → nessun recupero alle 13; tocco oltre D+7 o su *fatto* → "non più disponibile" | RF-21, BR-07, BR-08, FR-016…FR-018 |
| `test/integration/us5-gruppo-mese.test.ts` | `/gruppo lavoro`, gruppo inesistente, senza nome; `/mese marzo` = `/mese 3`, `/mese` corrente, `marzzo`/`13`; anno di riferimento (Sara 05/10 → "Lun 05/10  Sara (36)", marzo → 2027) | RF-19, RF-20, FR-014, FR-015 |
| `test/integration/us6-anno.test.ts` | conteggi 40/3/2 e saltati; serie Luca 2024–2025; Giulia non confermato→saltato esclusa; Paolo interrotto da *fatto*; default anno corrente; anno senza dati; anno futuro/non valido; aperte non conteggiate | RF-22, BR-09, FR-019 |
| `test/integration/viste-budget.test.ts` | 200 persone: `/prossimi 366` e `/gruppo` completi senza righe mancanti, messaggi ≤ 4096, nessuna tastiera; subrequest esatte ≤ 50 per `/oggi` con 15 compleanni e `/anno` nel caso peggiore | RNF-14, RNF-16, SC-002, SC-005, principio II |
| `test/unit/liste.test.ts` | `formatListLine` (con/senza età, esito, nickname/nome, 29/02; colonna a larghezza comune con tetto 20; entità `code` che esclude `/p_<id>`; offset UTF-16 con emoji e accenti), `splitMessage` (righe intere, ≤ 4096, ≤ 45 righe, offset traslati, righe vuote in testa) | FR-001, FR-001a, FR-003, FR-005 |
| `test/unit/telegram-client.test.ts` (esteso) | `entities` inviato nel body, nessun `parse_mode` | FR-001a |
| `test/unit/viste-parse.test.ts` | argomenti di `/prossimi`, `/mese`, `/anno`; `searchKey` | FR-009…FR-012, FR-015, FR-019 |
| `test/unit/callback-data.test.ts` (esteso) | `t:f`, `t:s`, `p:f` | contratto callback-data |

## 3. Prova manuale in locale

```powershell
npx wrangler dev
```

Con il webhook di sviluppo come in 001:

1. Inserisci 3 persone: una con compleanno **oggi**, una tra 5 giorni nel gruppo Famiglia senza
   anno di nascita, una di nome "Nicolò".
2. `/oggi` → il messaggio del reminder con Fatto ✅ e Salta quest'anno. Premi **Fatto ✅** → il
   messaggio mostra "✅ Fatto" con i soli contatti. `/oggi` di nuovo → stesso esito già chiuso.
3. `/prossimi 7 famiglia` → intestazione "Prossimi 7 giorni (Famiglia)", una riga senza età.
   `/prossimi` → data, nome ed età in monospazio con le colonne allineate; ogni `/p_<id>` si
   tocca e apre la scheda.
   `/prossimi 7 pippo` → gruppo inesistente con l'elenco dei gruppi. `/prossimi 400` → errore.
4. `/cerca nicolo` → si apre la scheda. `/cerca a` → lista.
5. `/mese` e `/mese 3` → intestazioni con l'anno di riferimento corretto.
6. Per `/scaduti` e "Segna fatto" porta un'occorrenza a *saltato* nel passato:
   `npx wrangler d1 execute birthday-bot-db --local --command "UPDATE occurrences SET effective_date = date('now','-3 day'), status = 'saltato' WHERE id = <id>"`
   → `/scaduti` mostra la riga "· saltato"; tocca `/p_<id>` → **Segna fatto** → la scheda si
   aggiorna con "<anno> fatto" e il pulsante sparisce.
7. `/anno` → riepilogo con il *fatto* appena registrato.

## 4. Dopo il deploy

*Metrics* del Worker: nessun `exceededCpu` sulle richieste webhook; con l'archivio reale,
`/prossimi 366` arriva completo in uno o più messaggi senza pulsanti.
