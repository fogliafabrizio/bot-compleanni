# Revisioni — bot-compleanni

## Da analizzare
<!-- note grezze, una per riga: le analizza /triage senza argomenti -->

## Bug
<!-- voci BUG-xxx: si correggono con /fix-bug BUG-xxx -->

## Per l'analista
<!-- voci REV-xxx da portare nella chat dell'analista funzionale per l'AFU successiva -->

### REV-012 — Slot delle 00:00 per le persone con priorità Alta
- Tipo: Modifica
- Data: 06/11/2026
- Segnalazione originale: "Ciao! Per le persone con Alta priorità sarebbe carino mettere l'alert anche alle 00:00 del compleanno! Cosi posso fare gli auguri in tempo."
- Requisiti AFU coinvolti: §7 Profili di priorità (Alta: slot 9 · 13 · 18 · 21), Glossario "Slot" (§3), RF-10, D-02, N-03, N-05, RNF-18, RF-40 (v2) — feature 002
- Comportamento attuale: il bot rispetta l'AFU. Per Alta il primo promemoria del giorno parte alle 9:00 (`src/config.ts:5` `SLOT_HOURS = [9, 13, 18, 21]`, `src/config.ts:12` `alta.slots = [9, 13, 18, 21]`). `planTargets` (`src/domain/schedule.ts:72`) crea il target "giorno" solo per le ore in `SLOT_HOURS`, quindi alle 00:00 non parte nulla. L'ultimo avviso prima del compleanno è il pre-reminder di −1 giorno alle 13:00.
- Comportamento desiderato: per le persone con priorità Alta, un reminder del giorno anche alle 00:00 (ora locale Europe/Rome) del compleanno, con lo stesso contenuto e gli stessi pulsanti di RF-10 (contatti, Fatto, Salta quest'anno). Media e Bassa restano invariate.
- Impatto tecnico:
  - Feature e spec toccate: 002 (promemoria). Il codice cambia in due righe di `src/config.ts`: aggiungere 0 a `SLOT_HOURS` e al profilo `alta`. Lo scheduler è già guidato dai profili (RNF-18, D-20). Da aggiornare i test di 002 sul profilo Alta e sui target per ora.
  - Modello dati / migration: no. `deliveries.ref` è un INTEGER senza CHECK (`migrations/0001_schema_iniziale.sql:60`), e l'indice univoco (occorrenza, tipo, ref) distingue già lo slot 0 dagli altri.
  - Dati già presenti in produzione: nessuna migrazione. Dal deploy in poi, le persone con priorità Alta ricevono lo slot delle 00:00 dal primo compleanno successivo.
  - Compatibilità con i vincoli: ok per costo zero, 10 ms di CPU e 50 subrequest (un'esecuzione oraria in più con invii, già limitata da `splitByCap`). Il cron UTC gira comunque ogni ora (alle 22:00 o 23:00 UTC = 00:00 locale) e il cambio d'ora avviene alle 2-3 di notte, quindi non tocca le 00:00 (BR-24). Punti da decidere:
    - con N-03, un invio delle 00:00 fallito verrebbe ritentato alle 01:00, 02:00… cioè con notifiche in piena notte;
    - BR-11: chi viene inserito il giorno stesso non riceve mai lo slot delle 00:00, perché è già passato (comportamento coerente, nessun cambio);
    - `/stato` mostra l'ultimo invio come "reminder delle 0:00" (`src/texts.ts:337` usa `${ref}:00`): andrebbe formattato "00:00" (BR/guida di stile).
  - Effort stimato: S
- Priorità suggerita: media — è un miglioramento d'uso a basso costo e senza rischi sui dati, ma il bot oggi funziona come previsto e c'è il pre-reminder del giorno prima.
- Domande aperte per l'analista:
  1. Lo slot delle 00:00 si aggiunge agli altri quattro (5 reminder in tutto per Alta) o sostituisce quello delle 9:00, che arriverebbe poche ore dopo?
  2. ~~Il reminder delle 00:00 deve suonare o partire silenzioso?~~ **Risposta del proprietario (06/11/2026):** deve suonare, come gli altri reminder.
  3. ~~Se l'invio delle 00:00 fallisce, va ritentato di notte (N-03)?~~ **Risposta del proprietario (06/11/2026):** sì, va bene anche in piena notte ("al massimo il telefono è silenzioso se dormo"). N-03 resta invariata e non serve una fascia di silenzio.
  4. Va rivista D-02 ("orari fissi 9, 13, 18, 21"), il glossario "Slot" e la tabella §7: confermare che 00:00 diventa uno slot a tutti gli effetti (conta in `/stato`, idempotenza N-02, ecc.).
- Alternative possibili:
  - Aspettare RF-40 (v2, configurabilità di slot e profili): l'utente potrebbe aggiungere le 00:00 al profilo Alta da solo, senza cambiare l'AFU del profilo di default.
  - Spostare il pre-reminder di −1 giorno dalle 13:00 alle 23:00 (avviso "tra un'ora"): non serve uno slot notturno, ma non dà i pulsanti Fatto del giorno stesso.
  - Slot delle 00:00 solo per chi ha il telefono o Telegram (gli auguri a mezzanotte si fanno in chat): più complesso, sconsigliato.

## Chiuse
<!-- voci risolte, confluite in una nuova AFU, già previste o non problemi -->
- REV-001 — Tono più caldo: più emoji nei messaggi del bot → Accettata con modifiche (AFU v1.1)
- REV-002 — Recuperare il telefono da un contatto condiviso nello step Telefono → Accettata con modifiche (AFU v1.1)
- REV-003 — /gruppi con un pulsante per gruppo e scheda del gruppo → Accettata con modifiche (AFU v1.1)
- REV-004 — Ricerca "morbida" del gruppo in /gruppo (e /prossimi) e /gruppo senza nome con i pulsanti → Accettata con modifiche (AFU v1.1)
- REV-005 — Pulsanti di contatto (WhatsApp, Instagram, Telegram) nella scheda persona → Accettata con modifiche (AFU v1.1)
- REV-006 — Chiusura di PA-01: il numero nel testo è cliccabile → Accettata (AFU v1.1)
- REV-007 — Comandi di stato (salute di cron, promemoria e backup) e statistiche → Accettata con modifiche (AFU v1.1)
- REV-008 — Pulsante Indietro per tornare all'elenco gruppi → Accettata con modifiche (AFU v1.2)
- REV-009 — Voce "Senza gruppo" nell'elenco gruppi per le persone non classificate → Accettata con modifiche (AFU v1.2)
- REV-010 — Distribuzione per età in /statistiche → Accettata con modifiche (AFU v1.2)
- REV-011 — Navigazione più guidata: pulsanti di "passo successivo" nei vicoli ciechi → Accettata con modifiche (AFU v1.2)
