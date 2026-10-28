<!--
Sync Impact Report
- Versione: (template non compilato) → 1.0.0
- Principi: creati ex novo I–XII (il template ne prevedeva 5; il progetto ne richiede 12)
  I. Costo zero
  II. Limiti del piano Free come vincoli di progetto
  III. Semplicità prima di tutto (YAGNI)
  IV. Sicurezza
  V. Privacy
  VI. Tempo e fuso orario
  VII. Affidabilità degli invii
  VIII. Centralizzazione
  IX. Pronto per il multi-utente, ma mono-proprietario
  X. Qualità e test
  XI. Tracciabilità verso l'AFU
  XII. Interfaccia in italiano
- Sezioni aggiunte: Fonte di verità e vincoli di piattaforma; Flusso di sviluppo e quality gate;
  Governance
- Sezioni rimosse: nessuna
- Template dipendenti: non modificati (leggono la constitution a runtime)
- TODO differiti: nessuno
-->

# Constitution di bot-compleanni

## Core Principles

### I. Costo zero

- Il progetto MUST usare esclusivamente il piano Free di Cloudflare (Workers, D1, un solo Cron
  Trigger orario) e la Telegram Bot API.
- KV, Queues, Durable Objects, R2 e qualsiasi altro servizio Cloudflare a pagamento o non
  elencato sopra sono VIETATI.
- Qualsiasi servizio esterno (API di terze parti, database, logging, monitoraggio, CDN di
  librerie a runtime) è VIETATO.

Motivazione: RNF-01. Il bot è uno strumento personale che non deve generare alcun costo.

### II. Limiti del piano Free come vincoli di progetto

- Ogni invocazione (webhook o cron) MUST restare entro **10 ms di CPU**, inclusi l'import di
  200 righe, la generazione del backup e il ciclo orario (RNF-17, V-02).
- Ogni invocazione MUST restare entro **50 subrequest**: ogni chiamata a Telegram e ogni
  chiamata a D1 conta. Le scritture multiple su D1 MUST usare `D1.batch`.
- Il progetto MUST usare **un solo** Cron Trigger, in UTC, a granularità oraria (N-01, N-05,
  V-01).
- Piani e task che toccano il ciclo orario, l'import, l'export o il backup MUST includere una
  stima del numero di subrequest e del costo CPU nel caso peggiore (circa 200 persone, RNF-16).

Motivazione: superare questi limiti significa errori in produzione o la necessità di un piano a
pagamento, in contrasto con il principio I.

### III. Semplicità prima di tutto (YAGNI)

- TypeScript in modalità `strict` è obbligatorio.
- Nessun framework per il bot: il client della Bot API MUST essere un modulo leggero basato su
  `fetch`.
- Le dipendenze di runtime MUST essere minime; ogni dipendenza aggiunta (runtime o sviluppo)
  MUST essere giustificata per iscritto nel piano (cosa risolve, perché non basta il codice
  proprio, impatto su CPU e dimensione del bundle).
- Non si implementa nulla che non sia richiesto dall'AFU per la release in corso.

Motivazione: meno codice e meno dipendenze significano meno CPU, meno superficie d'attacco e
manutenzione più semplice.

### IV. Sicurezza

- Il webhook MUST rifiutare ogni richiesta priva dell'header
  `X-Telegram-Bot-Api-Secret-Token` corretto (RNF-03).
- Il bot MUST eseguire comandi solo per l'ID Telegram numerico del proprietario (RNF-02,
  RF-30). Unica eccezione: `/id` (RF-29).
- Con qualsiasi altro mittente il bot MUST ignorare in silenzio la richiesta: nessuna risposta
  (salvo `/id`), nessun salvataggio.
- Token del bot, ID del proprietario e secret del webhook MUST essere gestiti solo come secret
  della piattaforma o in `.dev.vars` (escluso dal repository); MUST NOT comparire nel codice,
  nei test, nei fixture o nella cronologia git (RNF-04).
- Le operazioni distruttive MUST chiedere conferma; il ripristino MUST chiedere una doppia
  conferma (RNF-05).

Motivazione: il webhook è un URL pubblico; whitelist e token segreto proteggono due aspetti
diversi e servono entrambi (D-18).

### V. Privacy

- I log MUST NOT contenere dati personali: telefoni, messaggi, nomi, nickname, username, date
  di nascita (RNF-08, in forma più restrittiva). Si possono loggare solo identificativi interni,
  codici di errore e conteggi.
- Nessuna telemetria e nessun invio di dati a soggetti diversi da Telegram e Cloudflare
  (RNF-07).
- Backup ed export MUST essere consegnati solo nella chat del proprietario (RNF-09).

Motivazione: il bot conserva dati personali di terzi; l'uso personale rientra nell'esenzione
domestica del GDPR solo se i dati restano confinati (RNF-06).

### VI. Tempo e fuso orario

- Tutta la logica di date e orari MUST operare in **Europe/Rome**, con passaggio automatico tra
  ora solare e legale (BR-24, A-01).
- Il cron gira in UTC; la conversione all'ora locale MUST avvenire in un unico punto del codice.
- Il "now" MUST essere sempre iniettabile: nessuna funzione di dominio legge direttamente
  l'orologio di sistema.
- Casi limite obbligatori da coprire con test: 29 febbraio (BR-04), occorrenze a cavallo
  d'anno (BR-05), cambio d'ora.

Motivazione: errori di fuso orario producono promemoria nel giorno o nell'ora sbagliati; il now
iniettabile rende verificabile ogni scenario temporale.

### VII. Affidabilità degli invii

- Ogni promemoria MUST essere idempotente: al massimo un invio per (persona, anno, tipo, slot),
  anche se il cron viene rieseguito (N-02). L'unicità MUST essere garantita a livello di
  database, non solo dalla logica applicativa.
- Un errore su una singola persona MUST NOT bloccare gli invii alle altre (RNF-12).
- Retry entro la stessa giornata e abbandono successivo come da N-03; nessun recupero degli slot
  persi per malfunzionamenti (N-04).

Motivazione: il valore del bot dipende dal ricevere ogni promemoria una e una sola volta.

### VIII. Centralizzazione

Ciascuno dei seguenti elementi MUST essere definito in un unico punto del codice:

- testi del bot (RNF-15);
- fuso orario;
- orari degli slot;
- profili di priorità (giorni dei pre-reminder e slot del giorno);
- messaggio di auguri di default iniziale (A-06).

Nessun altro modulo può duplicare questi valori. Motivazione: RNF-18 e D-20, per rendere la v2
configurabile (RF-40) senza riscritture.

### IX. Pronto per il multi-utente, ma mono-proprietario

- L'istanza è mono-proprietario: il multi-utente è fuori perimetro (D-19) e MUST NOT essere
  implementato.
- Il modello dati MUST NOT contenere scelte che impediscano di aggiungere in futuro un
  identificativo del proprietario (es. vincoli di unicità globali non estendibili, singleton
  impliciti non documentati).

Motivazione: AFU §8, note al modello dati.

### X. Qualità e test

- I test MUST usare Vitest con `@cloudflare/vitest-pool-workers`.
- Ogni requisito RF e ogni criterio di accettazione (Dato/Quando/Allora) dell'AFU incluso nella
  feature MUST avere almeno un test che lo verifica.
- Una feature MUST NOT essere considerata chiusa finché tutti i test non passano.
- I test MUST NOT dipendere dall'orologio reale né dalla rete reale: now iniettato e chiamate a
  Telegram simulate.

Motivazione: la verifica automatica è l'unica garanzia che l'implementazione rispetti l'AFU.

### XI. Tracciabilità verso l'AFU

- Spec, piani, task e test MUST riportare gli ID dell'AFU a cui si riferiscono (RF-xx, BR-xx,
  RNF-xx, N-xx, V-xx).
- I nomi o le descrizioni dei test MUST citare l'ID del requisito verificato.

Motivazione: permette di verificare in ogni momento la copertura dell'AFU e di individuare
codice senza requisito.

### XII. Interfaccia in italiano

- Tutti i testi rivolti all'utente (messaggi, pulsanti, comandi, errori) MUST essere in
  italiano.
- La constitution, le spec, i piani, i task e ogni altro documento di progetto MUST essere
  scritti in italiano.

Motivazione: il proprietario è italofono; il multilingua è un'idea futura (RF-51).

## Fonte di verità e vincoli di piattaforma

- `docs/AFU.md` è la **fonte di verità funzionale**. Nessuna spec, piano o task può introdurre
  funzionalità non presenti nell'AFU.
- In caso di conflitto tra AFU e qualunque altro documento (spec, piano, task, codice) vince
  l'AFU, e il conflitto MUST essere segnalato esplicitamente all'utente, non risolto in
  silenzio.
- Le funzionalità marcate v2 o Futuro nell'AFU MUST NOT essere implementate in una feature MVP,
  salvo decisione esplicita del proprietario registrata nella spec.
- Stack ammesso: Cloudflare Workers (TypeScript), D1, un Cron Trigger, Telegram Bot API via
  webhook.
- I vincoli V-01…V-07 dell'AFU sono vincoli di progetto: una spec che li violi è non valida.

## Flusso di sviluppo e quality gate

- Ogni feature segue il flusso spec-kit: specify → (clarify) → plan → tasks → (analyze) →
  implement.
- Il *Constitution Check* del piano MUST verificare esplicitamente i principi I–XII; ogni
  deviazione MUST essere documentata nella tabella di complessità con motivazione, altrimenti il
  piano è respinto.
- Gate di chiusura di una feature:
  1. tutti i test passano;
  2. ogni RF e ogni criterio Dato/Quando/Allora coinvolto ha almeno un test (principio X);
  3. nessun segreto nel repository e nessun dato personale nei log (principi IV e V);
  4. stima CPU e subrequest entro i limiti per i flussi critici (principio II);
  5. typecheck `strict` senza errori.

## Governance

- Questa constitution prevale su qualunque altra pratica o convenzione di progetto; in materia
  funzionale prevale l'AFU.
- Gli emendamenti richiedono: proposta motivata, aggiornamento di questo file con Sync Impact
  Report, approvazione del proprietario del progetto.
- Versionamento semantico:
  - MAJOR: rimozione o ridefinizione incompatibile di un principio;
  - MINOR: nuovo principio o sezione, oppure ampliamento sostanziale delle regole;
  - PATCH: chiarimenti, riformulazioni, correzioni non semantiche.
- Ogni piano (`/speckit-plan`) e ogni analisi (`/speckit-analyze`) MUST verificare la
  conformità a questa constitution; le violazioni dei principi sono sempre di gravità CRITICA.

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
