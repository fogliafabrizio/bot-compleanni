---
name: fix-bug
description: Corregge un bug del bot compleanni già classificato con /triage (ID BUG-xxx in docs/REVISIONI.md), con test di regressione, branch dedicato e commit. Da lanciare solo su richiesta esplicita dell'utente.
argument-hint: BUG-xxx [note aggiuntive]
disable-model-invocation: true
---

Correggi un bug del progetto "bot-compleanni". Rispondi in italiano.

Contesto: l'MVP è online con dati reali in produzione. Ogni correzione deve essere minima, testata e reversibile.

## Input

$ARGUMENTS

- Se contiene un ID `BUG-xxx`, leggi la sua voce in `docs/REVISIONI.md`, sezione "## Bug": contiene già analisi, causa, correzione proposta e test da aggiungere.
- Se non contiene un ID ma una descrizione, **non correggere subito**: fai prima l'analisi come la skill `/triage` (requisiti, verifica nel codice, classificazione) e registra il bug in `docs/REVISIONI.md`. Se risulta una MODIFICA, una NUOVA FUNZIONALITÀ, GIÀ PREVISTO o NON È UN PROBLEMA, fermati: spiega perché e indica il percorso giusto (analista e nuova AFU). Questa skill corregge solo bug.
- Se l'ID non esiste o la voce è già "Risolto", dimmelo e fermati.

## Regole

- **L'AFU (`docs/AFU.md`) è la fonte di verità e non va modificato.** Se scopri che per correggere bisognerebbe cambiare un requisito, non è un bug: fermati, riclassifica la voce come REV in "## Per l'analista" e spiegami perché.
- Rispetta `.specify/memory/constitution.md`: costo zero, massimo 10 ms di CPU e 50 subrequest per invocazione, orari in Europe/Rome, nessun dato personale nei log, segreti mai nel codice.
- Correzione **minima**: tocca solo quello che serve al bug. Niente refactoring, niente migliorie "già che ci sono" (se ne vedi, segnalale alla fine come possibili nuove note per `/triage`).
- Non fare deploy e non fare merge su `main` senza il mio ok esplicito.

## Procedimento

1. **Punto di partenza pulito.** Controlla `git status`: se ci sono modifiche non committate, fermati e chiedimi cosa farne. Poi passa su `main`, aggiorna con `git pull` e crea il branch `fix/BUG-xxx-<slug>`.
2. **Rileggi l'analisi.** Verifica che causa e correzione proposta nella voce siano ancora valide sul codice attuale (il codice può essere cambiato dopo il triage). Se non lo sono, aggiorna la voce e spiegami cosa è cambiato.
3. **Piano e conferma.** Mostrami in breve: file che toccherai, approccio, test di regressione. Se la correzione:
   - richiede una **migration** o modifica **dati già salvati** (persone, gruppi, occorrenze, invii, impostazioni),
   - cambia il comportamento dello **scheduler** dei promemoria,
   - tocca **sicurezza** (whitelist, secret del webhook),

   dimmelo esplicitamente e **aspetta la mia conferma** prima di procedere. Negli altri casi procedi.
4. **Prima il test.** Scrivi il test di regressione che riproduce il bug, con l'ID del bug e del requisito nel nome o nella descrizione (es. `BUG-003 / RF-02: rifiuta 31/04`). Lancialo e verifica che **fallisca** per il motivo giusto. Se passa già, il bug non è riprodotto: fermati e dimmelo.
5. **Correggi.** Applica la correzione minima. Per i bug di orari e promemoria usa il "now" iniettabile per coprire anche i casi limite collegati (cambio ora legale, 29/02, cambio d'anno, doppia esecuzione del cron) se il bug li tocca.
6. **Verifica tutto.** Lancia l'intera suite (`npm test`): deve essere tutta verde, non solo il nuovo test. Lancia anche il controllo dei tipi se il progetto lo prevede (es. `npx tsc --noEmit`) e `npx wrangler deploy --dry-run` per verificare che il Worker si compili.
7. **Migration (solo se servono).** Crea una nuova migration in `migrations/` (mai modificare quelle già applicate), provala in locale con `npx wrangler d1 migrations apply birthday-bot-db --local` e verifica che i dati esistenti restino coerenti.
8. **Commit** sul branch con messaggio `fix(<area>): <descrizione> [BUG-xxx, RF-xx]`.
9. **Aggiorna `docs/REVISIONI.md`**: nella voce del bug metti `Stato: Risolto (branch fix/BUG-xxx-<slug>, in attesa di merge e deploy)` e aggiungi una riga "Correzione applicata" con file toccati e test aggiunto. Committa anche questo.
10. **Riepilogo e prossimi passi.** Dimmi:
    - cosa hai cambiato e perché (file e righe principali);
    - il test aggiunto;
    - se ci sono migration o impatti sui dati;
    - eventuali effetti già prodotti dal bug che richiedono un intervento manuale (es. occorrenze con stato sbagliato);
    - altre cose notate ma non toccate, da passare a `/triage`.

    Poi chiedimi se fare il **merge su `main` e il push**. Dopo il merge ricordami:
    1. `/backup` dal bot su Telegram, se ci sono migration o modifiche ai dati;
    2. `powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1`;
    3. la prova su Telegram con i passi di "Come riprodurlo";
    4. di spostare la voce in "## Chiuse" quando la correzione è verificata in produzione.