# Quickstart — Validazione di import, export e backup

**Feature**: `004-import-export-backup` | Contratti: [contracts/](contracts/) | Modello: [data-model.md](data-model.md)

## 1. Prerequisiti e comandi

Come per 001–003: Node e dipendenze installate (`npm install`), nessun secret reale nei test.

```powershell
npm run typecheck   # strict, zero errori (gate 5)
npm test            # unit + integrazione nel pool workers con D1 locale e Telegram simulato
npm run bench       # CPU delle parti pure: soglia 3 ms per iterazione (principio II)
```

Nessuna migration nuova: `npm test` applica le migration esistenti.

## 2. Scenari automatici (ogni test cita l'ID AFU nel nome)

| # | Scenario | Atteso | ID | File di test |
|---|---|---|---|---|
| 1 | `/modello` | documento CSV con BOM, `;`, intestazione + riga d'esempio; caption = legenda ≤ 1024 | RF-23, FR-007 | `integration/us1-modello.test.ts` |
| 2 | CSV di 112 righe: 3 date non valide, 5 duplicati | anteprima "104 persone nuove", "5 duplicati", "3 errori" con righe; tabelle invariate | RF-24, §5.8 | `integration/us1-import.test.ts` |
| 3 | Importa | 104 persone, gruppi mancanti creati, "Importate 104 persone, creati 2 gruppi."; tastiera rimossa | RF-24, BR-23 | idem |
| 4 | Annulla; anteprima scaduta (now + 24 h); Importa ripremuto | nulla salvato; "Questa azione non è più disponibile" | RF-24, FR-014 | idem |
| 5 | stesso file con `,` e con `;` | stessa anteprima | BR-19 | `unit/csv.test.ts` + idem |
| 6 | duplicato di persona esistente (maiuscole diverse) e duplicato interno | saltati, il primo interno è nuovo | BR-14 | `unit/import.test.ts` |
| 7 | `Famiglia\|Beach tennis` con solo Famiglia esistente; `famiglia`; `Calcetto`/`calcetto`; `Famiglia\|\|famiglia`; gruppo solo in righe errate | un gruppo da creare con la prima grafia; nessun gruppo da righe errate | BR-17, BR-20, BR-23 | idem |
| 8 | `priorita` vuota / `ALTA` / `altissima` | media / alta / errore | BR-21, FR-010 | idem |
| 9 | file Excel "CSV UTF-8" con BOM e accenti; file ANSI | letto correttamente; rifiutato con invito a "CSV UTF-8" | BR-22 | `unit/csv.test.ts` |
| 10 | riga d'esempio lasciata nel file | non importata, "Riga d'esempio ignorata" | FR-007a | `integration/us1-import.test.ts` |
| 11 | telefono "333abc"; più errori nella stessa riga | riga tra gli errori con tutti i motivi | FR-010 | `unit/import.test.ts` |
| 12 | 500 / 501 righe; file vuoto; solo intestazione; righe vuote | anteprima / rifiuto con massimo; "nessuna riga"; vuote ignorate ma numerate | FR-008a, FR-009 | idem |
| 13 | intestazioni in altro ordine, maiuscole, `Priorità`; colonna sconosciuta; `data` assente | riconosciute; rifiuto con colonne attese | BR-18 | idem |
| 14 | valori tra virgolette con `;`, `,`, `""` e a capo | un solo valore; numero di riga del foglio | BR-19, FR-009 | `unit/csv.test.ts` |
| 15 | nessuna riga importabile | anteprima senza pulsanti, nessuno stato | FR-015 | `integration/us1-import.test.ts` |
| 16 | persona aggiunta con `/nuovo` dopo l'anteprima, poi Importa | riga saltata, numeri effettivi nel messaggio | BR-14 | idem |
| 17 | errore forzato nella batch di Importa | nessuna persona né gruppo salvato | FR-013 | idem |
| 18 | import il giorno del compleanno di una riga, poi cron dell'ora corrente e passata | nessun invio retroattivo, solo slot futuri | 002 FR-017/018 | idem |
| 19 | documento `.pdf`; `.json` senza `/ripristina`; `file_size` 21 MB; 2 MB | messaggi di contracts/comandi.md, nessuna chiamata `getFile` per i troppo grandi | RF-24, V-07, R-01 | `integration/documenti.test.ts` |
| 20 | CSV inviato durante un flusso `nuovo` o `ripristina` | flusso annullato in silenzio, anteprima | R-13 | idem |
| 21 | estraneo invia CSV/JSON o i 4 comandi | nessuna chiamata Telegram né D1 di scrittura | RNF-09 | `integration/us1-accesso.test.ts` (esteso) |
| 22 | `/backup` con persone, gruppi, esiti, default personalizzato | JSON completo conforme a contracts/backup-json.md | RF-26, FR-017 | `integration/us2-backup.test.ts` |
| 23 | `/ripristina` + backup valido + Continua + Sì | dati sostituiti, riepilogo; `/p_<id>` apre le stesse persone | RF-26, RNF-05, RNF-11 | `integration/us2-ripristino.test.ts` |
| 24 | round-trip: backup → modifiche → ripristino | dati identici al backup (SC-005) | RNF-11 | idem |
| 25 | Annulla a `conferma1` e a `conferma2`; `/annulla`; 24 h | dati invariati | RNF-05, FR-021 | idem |
| 26 | file non JSON, `format` errato, `version` 2, gruppo inesistente, data non valida, gruppi omonimi, occorrenze ripetute | rifiuto con motivo, dati invariati, resta in `file` | RF-26, SC-006 | `unit/backup.test.ts` + idem |
| 27 | errore forzato nella batch di ripristino | dati precedenti intatti | FR-020 | idem |
| 28 | backup del 01/11 con occorrenza aperta del 05/11 ripristinato il 20/11; altra con D = oggi | prima `non_confermato` senza messaggi; seconda aperta, solo slot futuri | FR-020a | idem |
| 29 | cron 1° del mese 9:00 (ora locale, con scheduledTime UTC in ora solare e legale) | un `sendDocument` al proprietario, `auto_backup = AAAA-MM:inviato` | RF-27, FR-022 | `integration/us3-backup-mensile.test.ts` |
| 30 | stessa esecuzione ripetuta; 1° alle 8:00; 1° alle 10:00 dopo l'invio | nessun altro invio | FR-023 | idem |
| 31 | errore Telegram il 1° alle 9:00, ok il 2 alle 14:00 | invio il 2 alle 14:00, uno solo | FR-023a | idem |
| 32 | backup mensile usato con `/ripristina` | ripristino riuscito | RNF-11, FR-025 | idem |
| 33 | `/export` con 29/02, anno sconosciuto, più gruppi, messaggio personalizzato e no | CSV conforme; telefono `+39 …` | RF-25, FR-016 | `integration/us4-export.test.ts` |
| 34 | export → svuota → import; export → import sulla stessa istanza | tutte nuove, zero errori, campi identici; tutte duplicate | RF-25, SC-004 | idem |
| 35 | export e backup con zero persone | file inviato | RF-25, RF-26 | idem / `us2-backup` |

## 3. Budget (principio II)

| Verifica | Come | Soglia |
|---|---|---|
| Subrequest invio CSV 500 righe, Importa, `/ripristina` (ogni passo), `/backup`, `/export` | `integration/import-budget.test.ts` con contatore D1 + Telegram | valori di research R-12, ≤ 50 |
| Cron del 1° alle 9:00 con 40 invii di promemoria + backup | `integration/ciclo-budget.test.ts` esteso | ≤ 47 |
| CPU import 200 e 500 righe, backup 200 persone + 2000 occorrenze, validazione backup, export | `bench/import-backup.bench.ts` (Node) | < 3 ms per iterazione |

Dopo il deploy: nessun `exceededCpu` né errore di subrequest nelle *Metrics* del Worker.

## 4. Verifica manuale con il bot reale (opzionale)

1. `npm run dev` con `.dev.vars` e webhook di sviluppo (come in 001).
2. `/modello` → aprire il file con Excel in italiano: colonne separate, accenti corretti.
   Compilare 3 righe (una data `gg/mm`, colonna formattata come Testo), salvare come
   "CSV UTF-8", inviarlo: anteprima corretta, Importa.
3. `/export` → aprire in Excel: telefono intero con `+`; risalvare e reinviare: tutte duplicate.
4. `/backup` → `/ripristina` con il file → Continua → Sì, ripristina: riepilogo coerente.
