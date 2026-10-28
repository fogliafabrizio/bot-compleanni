# Feature Specification: Fondamenta e anagrafica

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Feature \"fondamenta-anagrafica\". Fonte unica: docs/AFU.md. Includi esattamente questi requisiti con i loro criteri di accettazione: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-28, RF-29, RF-30, e le regole BR-01, BR-02, BR-14, BR-15, BR-16, BR-17, RNF-02, RNF-03, RNF-04, RNF-05, RNF-13, RNF-14, RNF-15. Usa i flussi di esempio dei paragrafi 5.2 e 5.6 e i comandi del paragrafo 5.1 che riguardano questi requisiti. Nella scheda (RF-03) lo storico esiti per ora è vuoto: arriverà con la feature dei promemoria. Riporta gli ID AFU su ogni requisito. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.0 (fonte di verità funzionale). Ogni requisito riporta l'ID AFU corrispondente.

## Perimetro

**Requisiti AFU inclusi**: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-28, RF-29, RF-30; BR-01, BR-02, BR-14, BR-15, BR-16, BR-17; RNF-02, RNF-03, RNF-04, RNF-05, RNF-13, RNF-14, RNF-15. Aggiunta per decisione del proprietario (chiarimento 2026-10-28): A-04.

**Comandi inclusi (da AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/start` | Benvenuto e azioni rapide | RF-28 |
| `/aiuto` | Elenco comandi | RF-28 |
| `/nuovo` | Aggiungi persona (guidato) | RF-01 |
| `/p_<id>` | Apri scheda | RF-03 |
| `/gruppi` | Gestione gruppi | RF-07 |
| `/annulla` | Interrompe un flusso guidato | RF-06 |
| `/id` | Mostra il proprio ID Telegram | RF-29 |

**Fuori da questa feature**: tutti gli altri requisiti dell'AFU (promemoria, esiti, viste, import/export, backup). In particolare lo storico esiti nella scheda (RF-03, alimentato da RF-14) resta vuoto fino alla feature dei promemoria.

## Clarifications

### Session 2026-10-28

- Q: Durante un flusso guidato, se arriva un altro comando (es. `/gruppi`, `/p_12`), cosa fa il bot? → A: Il nuovo comando annulla il flusso in corso senza salvare nulla, poi viene eseguito.
- Q: Quali numeri di telefono accetta il bot? → A: Si rimuovono spazi, punti e trattini; `+` o `00` iniziale indicano un prefisso già presente (`00` → `+`), altrimenti si antepone +39; dopo il `+` solo cifre, da 8 a 15; altrimenti rifiuto con ripetizione dell'esempio.
- Q: Se la modifica di nome o data rende una persona uguale a un'altra (stesso nome e data), il bot avvisa? → A: Sì, avviso di possibile duplicato e conferma esplicita prima di salvare, come nell'inserimento.
- Q: Cosa risponde il bot a `/p_<id>` con un id inesistente (es. persona eliminata)? → A: "Persona non trovata".
- Q: Come compare lo storico nella scheda quando non ci sono esiti? → A: La riga "Storico" non compare finché non c'è almeno un esito.
- Q: Un flusso guidato abbandonato deve scadere dopo 24 ore (A-04)? → A: Sì: dopo 24 ore scade senza salvare nulla, in silenzio; il messaggio successivo è trattato come fuori da qualsiasi flusso. A-04 entra nel perimetro per decisione del proprietario.
- Q: Fuori da un flusso guidato, cosa risponde il bot a testo libero o a un comando inesistente? → A: "Non ho capito. Scrivi /aiuto per l'elenco dei comandi".
- Q: Cosa fa il bot se si preme un pulsante di un messaggio vecchio (flusso scaduto/annullato, persona eliminata)? → A: Non esegue nulla e risponde "Questa azione non è più disponibile"; se la persona non esiste più, "Persona non trovata".
- Q: In uno step a pulsanti (es. Priorità, Sì / Correggi), cosa fa il bot se si scrive testo invece di premere? → A: Ignora il testo e ripete la domanda dello step con i suoi pulsanti.
- Q: Quali limiti per i testi inseriti (nome, nickname, gruppo, messaggio) e per i valori vuoti? → A: Spazi iniziali/finali rimossi; vuoto rifiutato; massimi: nome e nickname 60 caratteri, gruppo 30, messaggio 500; oltre il limite rifiuto con indicazione del massimo e ripetizione della domanda.
- Q: Nel guidato la priorità si può non scegliere? → A: No: lo step mostra Alta / Media ✓ / Bassa con Media preselezionata e si conferma con un tocco; "default Media" vale per il valore iniziale del database e per l'import (BR-21).
- Q: Un gruppo creato con "Nuovo gruppo" durante un flusso guidato viene salvato subito? → A: No: appare creato e già selezionato, ma viene scritto solo al salvataggio finale; se il flusso viene annullato, scade o è interrotto da un altro comando, il gruppo non esiste (risolve il conflitto RF-08 / RF-06).
- Q: Durante un flusso guidato, cosa succede con un comando inesistente (es. `/annula`)? → A: Il flusso non viene interrotto: il bot risponde "Non ho capito. Scrivi /aiuto per l'elenco dei comandi" e ripete la domanda dello step corrente.
- Q: "Stessa data" ai fini del duplicato (BR-14) considera l'anno? → A: Giorno e mese devono coincidere; l'anno deve coincidere solo se è presente in entrambe le date. Quindi `14/03` e `14/03/1994` sono un possibile duplicato, `14/03/1994` e `14/03/1995` no. La stessa regola varrà per l'import.
- Q: Come si mostra il telefono nella scheda? → A: Nella forma salvata, senza spazi (es. `+393331234567`), che Telegram rende cliccabile (V-04); gli spazi nell'esempio AFU §5.6 sono solo illustrativi.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accesso riservato al proprietario (Priority: P1)

Solo il proprietario, identificato dal suo ID Telegram numerico, può usare il bot. Chiunque altro può soltanto chiedere il proprio ID con `/id`; ogni altra richiesta viene ignorata in silenzio. Le richieste che non arrivano davvero da Telegram vengono scartate.

**Why this priority**: senza questa protezione nessun'altra funzione può essere esposta, perché il bot conserva dati personali di terzi.

**Independent Test**: inviare `/id` e un altro comando da un utente estraneo, e una richiesta senza token segreto; verificare risposte e assenza di salvataggi.

**Acceptance Scenarios**:

1. **Given** un utente qualsiasi (proprietario o estraneo), **When** invia `/id`, **Then** il bot risponde con il suo ID Telegram numerico. *(RF-29)*
2. **Given** un utente diverso dal proprietario scrive al bot, **When** invia un qualsiasi comando diverso da `/id`, **Then** il bot non risponde e non salva nulla. *(RF-30, RNF-02)*
3. **Given** una richiesta al webhook senza il token segreto corretto (anche se contiene l'ID del proprietario), **When** arriva, **Then** viene scartata senza effetti. *(RNF-03)*

---

### User Story 2 - Inserimento guidato di una persona (Priority: P1)

Il proprietario aggiunge una persona rispondendo a un campo alla volta, con conferma della data e un riepilogo finale da salvare o annullare.

**Why this priority**: è l'operazione base dell'anagrafica; senza persone il bot non ha dati.

**Independent Test**: eseguire `/nuovo` seguendo il flusso §5.2 e verificare che la persona sia salvata e che compaia la sua scheda.

**Flusso di esempio (AFU §5.2)**:

```
Tu:  /nuovo
Bot: Nome completo?                                   [Annulla]
Tu:  Marco Rossi
Bot: Nickname? (come lo chiami nei messaggi)          [Salta]
Tu:  Marchino
Bot: Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno
Tu:  14/03/1994
Bot: 14 marzo 1994, giusto?                           [Sì] [Correggi]
Bot: Telefono? (con prefisso, es. +39 333 1234567)    [Salta]
Bot: Username Instagram?                              [Salta]
Bot: Username Telegram?                               [Salta]
Bot: Gruppi?        [☐ Famiglia] [☑ Beach tennis] [☐ Lavoro]
                    [➕ Nuovo gruppo] [Fine]
Bot: Priorità?      [Alta] [Media ✓] [Bassa]
Bot: Messaggio di auguri personalizzato? Se salti uso quello standard.  [Salta]
Bot: Riepilogo: … (scheda)                            [Salva] [Annulla]
```

**Acceptance Scenarios**:

1. **Given** che avvio "Aggiungi persona", **When** rispondo a tutti i campi obbligatori e salto gli opzionali, **Then** la persona viene salvata con priorità Media e il bot mostra la scheda. *(RF-01)*
2. **Given** che esiste già una persona con stesso nome e stessa data, **When** confermo il salvataggio, **Then** il bot avvisa del possibile duplicato e chiede conferma esplicita. *(RF-01, BR-14)*
3. **Given** che scrivo `14/03/1994`, **When** invio, **Then** il bot chiede "14 marzo 1994, giusto?" con Sì / Correggi. *(RF-02)*
4. **Given** che scrivo `31/04` o `14-3-94`, **When** invio, **Then** il bot rifiuta la data e ripete il formato atteso. *(RF-02, BR-01)*
5. **Given** che scrivo `29/02/1995` (anno non bisestile), **When** invio, **Then** il bot rifiuta la data. *(RF-02)*
6. **Given** che scrivo `29/02` senza anno, **When** invio, **Then** la data viene accettata. *(RF-02)*
7. **Given** che scrivo una data con anno futuro o precedente al 1900, **When** invio, **Then** il bot rifiuta la data. *(BR-02)*
8. **Given** che sono nello step Gruppi, **When** premo "Nuovo gruppo" e scrivo "Beach tennis", **Then** il gruppo viene creato e risulta già selezionato. *(RF-08)*
9. **Given** che sono in un flusso guidato, **When** scrivo `/annulla` o premo Annulla, **Then** il flusso si interrompe senza salvare nulla. *(RF-06)*
10. **Given** che sono a metà di `/nuovo`, **When** invio `/gruppi`, **Then** l'inserimento si interrompe senza salvare nulla e il bot mostra l'elenco dei gruppi. *(RF-06, chiarimento 2026-10-28)*

---

### User Story 3 - Scheda persona (Priority: P2)

Il proprietario apre la scheda di una persona toccando il comando `/p_<id>` e vede tutti i suoi dati, con i pulsanti Modifica ed Elimina.

**Why this priority**: è il punto di accesso per consultare, modificare ed eliminare una persona.

**Independent Test**: dopo aver inserito una persona, inviare `/p_<id>` e verificare contenuto e pulsanti.

**Esempio (AFU §5.6)** — in questa feature la riga "Storico" non compare, perché non ci sono esiti:

```
Marco Rossi — "Marchino"
14/03/1994 · compie 33 anni tra 137 giorni
Priorità: alta · Gruppi: Beach tennis, Lavoro
📱 +39 333 1234567 · IG @marco.rossi · TG @mrossi
Messaggio: standard
Storico: 2025 fatto · 2024 saltato

[Modifica] [Elimina]
```

**Acceptance Scenarios**:

1. **Given** che tocco `/p_12` in una lista, **When** il bot risponde, **Then** vedo la scheda della persona 12 con i pulsanti Modifica ed Elimina. *(RF-03)*
2. **Given** che l'anno di nascita non è noto, **When** apro la scheda, **Then** l'età non compare. *(RF-03)*
3. **Given** una persona appena inserita, **When** apro la scheda, **Then** la riga "Storico" non compare (nessun esito registrato in questa feature). *(RF-03, chiarimento 2026-10-28)*
4. **Given** che la persona 12 è stata eliminata, **When** tocco `/p_12`, **Then** il bot risponde "Persona non trovata". *(RF-03, chiarimento 2026-10-28)*

---

### User Story 4 - Modifica per campo (Priority: P2)

Il proprietario corregge un singolo campo dalla scheda, senza ripetere tutto l'inserimento.

**Why this priority**: le correzioni sono frequenti dopo l'inserimento; rifare il guidato sarebbe troppo lento.

**Independent Test**: dalla scheda, modificare un campo e svuotarne uno opzionale; verificare che cambi solo quel campo.

**Acceptance Scenarios**:

1. **Given** che sono nella scheda, **When** premo Modifica → Instagram e invio un nuovo username, **Then** viene aggiornato solo quel campo e rivedo la scheda. *(RF-04)*
2. **Given** che premo Modifica → Telefono → Svuota, **When** confermo, **Then** il telefono viene rimosso. *(RF-04)*
3. **Given** che esiste "Marco Rossi" nato il 14/03/1994 e modifico il nome di un'altra persona nata il 14/03/1994 in "marco rossi", **When** invio il nuovo nome, **Then** il bot avvisa del possibile duplicato e salva solo dopo conferma esplicita. *(RF-04, BR-14, chiarimento 2026-10-28)*

---

### User Story 5 - Eliminazione persona (Priority: P3)

Il proprietario elimina una persona, previa conferma.

**Why this priority**: necessaria ma meno frequente delle altre operazioni.

**Independent Test**: premere Elimina sulla scheda, confermare o annullare, verificare lo stato dei dati.

**Acceptance Scenarios**:

1. **Given** che premo Elimina, **When** il bot chiede "Eliminare Marco Rossi? Perderai anche lo storico" e premo Sì, **Then** persona, associazioni ai gruppi, occorrenze e storico vengono eliminati. *(RF-05, RNF-05)*
2. **Given** che premo Elimina, **When** premo Annulla, **Then** non cambia nulla. *(RF-05)*

---

### User Story 6 - Gestione gruppi (Priority: P3)

Il proprietario elenca, crea, rinomina ed elimina i gruppi con `/gruppi`.

**Why this priority**: i gruppi si possono già creare al volo nell'inserimento (RF-08); la gestione completa serve per riordinare.

**Independent Test**: con `/gruppi` creare, rinominare ed eliminare gruppi e verificare l'effetto sulle persone associate.

**Acceptance Scenarios**:

1. **Given** che esiste "Famiglia", **When** provo a creare "famiglia", **Then** il bot rifiuta per nome duplicato. *(RF-07, BR-17)*
2. **Given** che rinomino "Lavoro" in "Ufficio", **Then** tutte le persone associate mostrano "Ufficio". *(RF-07)*
3. **Given** che elimino un gruppo con 8 persone, **When** il bot chiede conferma indicando "8 persone perderanno questa etichetta" e confermo, **Then** il gruppo viene eliminato e le persone restano. *(RF-07, RNF-05)*

---

### User Story 7 - Benvenuto e aiuto (Priority: P3)

Il proprietario avvia il bot con `/start` e consulta i comandi con `/aiuto`.

**Why this priority**: orienta l'utente, ma le funzioni sono raggiungibili anche direttamente dai comandi.

**Independent Test**: inviare `/start` e `/aiuto` e verificare messaggi e pulsanti.

**Acceptance Scenarios**:

1. **Given** il proprietario, **When** invia `/start`, **Then** riceve un benvenuto con i pulsanti Aggiungi persona · Comandi; il pulsante Scarica modello CSV non compare finché non arriva RF-23. *(RF-28)*
2. **Given** il proprietario, **When** invia `/aiuto`, **Then** riceve l'elenco dei comandi con una riga di descrizione ciascuno. *(RF-28)*
3. **Given** il proprietario fuori da un flusso guidato, **When** invia "ciao" o `/pippo`, **Then** il bot risponde "Non ho capito. Scrivi /aiuto per l'elenco dei comandi". *(RF-28, RNF-13, chiarimento 2026-10-28)*

---

### Edge Cases

- Data in formato diverso da `gg/mm/aaaa` o `gg/mm` (es. `14-3-94`), o giorno inesistente (es. `31/04`): rifiutata con ripetizione del formato atteso. *(BR-01, RF-02)*
- `29/02` con anno non bisestile: rifiutata; `29/02` senza anno: accettata. *(RF-02)*
- Anno futuro o anteriore al 1900: rifiutato. *(BR-02)*
- Telefono inserito senza prefisso: salvato con +39. *(BR-15)*
- Telefono con `00` iniziale (es. `0041 79 123 45 67`): salvato come `+41791234567`; telefono con lettere o con meno di 8 / più di 15 cifre dopo il `+`: rifiutato. *(BR-15, chiarimento 2026-10-28)*
- Username Instagram o Telegram inserito con `@`: salvato senza `@`. *(BR-16)*
- Persona con stesso nome (maiuscole/minuscole ignorate) e stessa data di una esistente: avviso di possibile duplicato e conferma esplicita. Una data senza anno coincide con qualsiasi data con lo stesso giorno e mese (es. `14/03` e `14/03/1994`). *(BR-14, chiarimento 2026-10-28)*
- Nome di gruppo uguale a uno esistente a meno di maiuscole/minuscole, in creazione o rinomina: rifiutato. *(BR-17)*
- Comando diverso da `/id` da un utente estraneo, anche durante un flusso guidato del proprietario: nessuna risposta, nessun salvataggio. *(RF-30, RNF-02)*
- Richiesta con l'ID del proprietario ma senza token segreto corretto: scartata. *(RNF-03)*
- Flusso guidato abbandonato da più di 24 ore: scaduto senza salvare; il messaggio successivo non viene interpretato come risposta allo step rimasto in sospeso. *(A-04, chiarimento 2026-10-28)*
- Pulsante premuto su un messaggio vecchio (es. "Salva" di un inserimento scaduto o annullato, "Elimina" sulla scheda di una persona già eliminata): nessuna azione; risposta "Questa azione non è più disponibile" o "Persona non trovata". *(RF-05, RF-06, A-04, chiarimento 2026-10-28)*
- Nome vuoto o di soli spazi, oppure testo oltre il limite (nome/nickname 60, gruppo 30, messaggio 500 caratteri): rifiutato con indicazione del massimo e ripetizione della domanda. *(RF-01, RF-04, RF-07, chiarimento 2026-10-28)*
- Testo scritto in uno step a pulsanti (es. "alta" allo step Priorità): ignorato; il bot ripete la domanda con i pulsanti. *(RNF-13, chiarimento 2026-10-28)*

## Requirements *(mandatory)*

### Functional Requirements

**Anagrafica persone**

- **FR-001** *(RF-01)*: Il sistema MUST permettere l'inserimento guidato di una persona (comando `/nuovo` o pulsante "Aggiungi persona"), un campo alla volta, nell'ordine: nome completo*, nickname, data*, telefono, Instagram, Telegram, gruppi, priorità, messaggio personalizzato (* = obbligatorio).
- **FR-002** *(RF-01)*: I campi opzionali MUST offrire il pulsante "Salta"; la priorità, se non scelta, MUST valere Media.
- **FR-003** *(RF-01)*: Al termine il sistema MUST mostrare un riepilogo con Salva / Annulla; dopo il salvataggio MUST mostrare la scheda della persona.
- **FR-004** *(RF-01, BR-14)*: Al salvataggio, se esiste già una persona con lo stesso nome completo (senza distinzione tra maiuscole e minuscole) e la stessa data (stesso giorno e mese; anno uguale se presente in entrambe, chiarimento 2026-10-28), il sistema MUST avvisare del possibile duplicato e chiedere conferma esplicita prima di salvare. Per l'import la regola BR-14 prevede che la riga sia saltata, anche per duplicati interni allo stesso file: si applica con la feature dell'import.
- **FR-005** *(RF-02, BR-01)*: Il sistema MUST accettare la data solo nei formati `gg/mm/aaaa` o `gg/mm` (anno sconosciuto) e rifiutare qualsiasi altro formato o data inesistente, ripetendo il formato atteso. Il formato vale sia nel bot sia nel CSV.
- **FR-006** *(RF-02)*: Il sistema MUST rifiutare `29/02` con un anno non bisestile e accettare `29/02` senza anno.
- **FR-007** *(BR-02)*: L'anno, se presente, MUST NOT essere futuro né precedente al 1900.
- **FR-008** *(RF-02)*: Per ogni data valida il sistema MUST rispondere con la data interpretata in forma estesa (es. "14 marzo 1994, giusto?") e i pulsanti Sì / Correggi; Correggi MUST richiedere di nuovo la data.
- **FR-009** *(BR-15)*: Il telefono MUST essere salvato in formato internazionale; se inserito senza prefisso si assume +39. Normalizzazione e validazione: si rimuovono spazi, punti e trattini; un `+` o `00` iniziale indica un prefisso già presente (`00` diventa `+`), altrimenti si antepone `+39`; il risultato MUST essere `+` seguito da sole cifre, da 8 a 15. In caso contrario il bot rifiuta il valore e ripete l'esempio di formato.
- **FR-010** *(BR-16)*: Gli username Instagram e Telegram MUST essere salvati senza `@`; se presente viene rimosso.
- **FR-010a** *(RF-01, RF-04, RF-07)*: Per nome completo, nickname, nome di gruppo e messaggio personalizzato il sistema MUST rimuovere gli spazi iniziali e finali e rifiutare un valore vuoto. Lunghezze massime: nome completo 60 caratteri, nickname 60, nome di gruppo 30, messaggio personalizzato 500 (portato a 256 dalla feature 002, FR-035, per il limite del pulsante "Copia messaggio"). Un valore oltre il limite MUST essere rifiutato indicando il massimo e ripetendo la domanda.
- **FR-011** *(RF-03)*: Il comando `/p_<id>` MUST mostrare la scheda: nome e nickname, data di nascita, età che compirà e giorni mancanti, priorità, gruppi, contatti presenti, messaggio personalizzato (se presente), storico esiti per anno; pulsanti Modifica ed Elimina. Il layout segue l'esempio AFU §5.6; il telefono è mostrato in forma internazionale senza spazi.
- **FR-012** *(RF-03)*: Se l'anno di nascita non è noto, la scheda MUST NOT mostrare l'età.
- **FR-012a** *(RF-03)*: Se `/p_<id>` non corrisponde a nessuna persona, il sistema MUST rispondere "Persona non trovata".
- **FR-013** *(RF-03)*: La riga "Storico" della scheda MUST comparire solo se la persona ha almeno un esito. In questa feature non esistono esiti, quindi la riga non compare; lo storico sarà alimentato dalla feature dei promemoria (RF-14).
- **FR-014** *(RF-04)*: Il pulsante Modifica MUST aprire un menù di pulsanti: Nome · Nickname · Data · Telefono · Instagram · Telegram · Gruppi · Priorità · Messaggio. Il sistema MUST chiedere solo il campo scelto, salvarlo e rimostrare la scheda.
- **FR-015** *(RF-04)*: Per i campi opzionali la modifica MUST offrire anche "Svuota", che rimuove il valore del campo.
- **FR-016** *(RF-04, RF-02, BR-01, BR-02, BR-15, BR-16)*: I valori inseriti in modifica MUST rispettare le stesse regole di validazione e normalizzazione dell'inserimento.
- **FR-016a** *(RF-04, BR-14)*: Se la modifica del nome o della data rende la persona un duplicato di un'altra (stesso nome completo senza distinzione tra maiuscole e minuscole e stessa data, con la regola di FR-004), il sistema MUST avvisare del possibile duplicato e chiedere conferma esplicita prima di salvare.
- **FR-017** *(RF-05, RNF-05)*: Il pulsante Elimina MUST chiedere conferma con il testo "Eliminare <nome completo>? Perderai anche lo storico" e pulsanti Sì / Annulla. Con Sì MUST eliminare persona, associazioni ai gruppi, occorrenze e storico; con Annulla nulla cambia.
- **FR-018** *(RF-06)*: In qualunque flusso guidato, `/annulla` o il pulsante Annulla MUST interrompere il flusso senza salvare nulla. Qualsiasi altro comando esistente ricevuto durante un flusso guidato MUST interrompere il flusso allo stesso modo e poi essere eseguito. Un comando inesistente MUST NOT interrompere il flusso: il sistema risponde "Non ho capito. Scrivi /aiuto per l'elenco dei comandi" e ripete la domanda dello step corrente.
- **FR-018a** *(A-04)*: Un flusso guidato senza interazioni per 24 ore MUST scadere senza salvare nulla e senza messaggi; il messaggio successivo MUST essere trattato come fuori da qualsiasi flusso.
- **FR-018b** *(RNF-13)*: In uno step che si risponde con pulsanti (es. Priorità, Sì / Correggi, Gruppi, Salva / Annulla), un testo libero diverso da un comando MUST essere ignorato e il sistema MUST ripetere la domanda dello step con i suoi pulsanti.
- **FR-018c** *(RF-05, RF-06, A-04)*: Se viene premuto un pulsante di un messaggio non più valido (flusso scaduto, annullato o già concluso), il sistema MUST NOT eseguire alcuna azione e MUST rispondere "Questa azione non è più disponibile"; se il pulsante riguarda una persona che non esiste più, MUST rispondere "Persona non trovata".

**Gruppi**

- **FR-019** *(RF-07)*: Il comando `/gruppi` MUST elencare i gruppi con il numero di persone di ciascuno e permettere di crearne, rinominarne ed eliminarne.
- **FR-020** *(RF-07, BR-17)*: Il nome di un gruppo MUST essere univoco senza distinzione tra maiuscole e minuscole; creazioni o rinomine che violano la regola MUST essere rifiutate.
- **FR-021** *(RF-07)*: La rinomina di un gruppo MUST riflettersi su tutte le persone associate.
- **FR-022** *(RF-07, RNF-05)*: L'eliminazione di un gruppo MUST chiedere conferma indicando quante persone perderanno l'etichetta (es. "8 persone perderanno questa etichetta"); confermando, il gruppo viene eliminato e le persone restano.
- **FR-023** *(RF-08)*: Nello step Gruppi (inserimento o modifica) il sistema MUST mostrare i gruppi esistenti come pulsanti a selezione multipla (attiva/disattiva), più "➕ Nuovo gruppo" e "Fine". Un gruppo creato con "Nuovo gruppo" MUST risultare già selezionato. Il gruppo viene salvato solo insieme alla persona (o alla modifica); se il flusso non si conclude, non viene creato.

**Accesso e avvio**

- **FR-024** *(RF-28)*: `/start` MUST mostrare un benvenuto con i pulsanti Aggiungi persona · Comandi. Il pulsante "Scarica modello CSV" previsto da RF-28 dipende da RF-23 (`/modello`), fuori da questa feature: MUST NOT comparire finché RF-23 non viene implementato (decisione del proprietario, 2026-10-28).
- **FR-025** *(RF-28)*: `/aiuto` MUST elencare i comandi con una riga di descrizione ciascuno.
- **FR-025a** *(RF-28, RNF-13)*: Al proprietario che, fuori da un flusso guidato, invia testo libero o un comando inesistente, il sistema MUST rispondere "Non ho capito. Scrivi /aiuto per l'elenco dei comandi".
- **FR-026** *(RF-29)*: `/id` MUST rispondere a chiunque con il suo ID Telegram numerico.
- **FR-027** *(RF-30, RNF-02)*: Il sistema MUST eseguire comandi solo per l'ID Telegram numerico (non lo username) del proprietario. Con qualsiasi altro mittente MUST NOT rispondere né salvare nulla, salvo `/id`.
- **FR-028** *(RNF-03)*: Il sistema MUST scartare qualsiasi richiesta al webhook che non contenga il token segreto corretto, registrato su Telegram e allegato da Telegram a ogni chiamata. Whitelist e token segreto servono entrambi.
- **FR-029** *(RNF-04)*: Token del bot, ID del proprietario e token segreto del webhook MUST essere gestiti come segreti della piattaforma e MUST NOT comparire nel codice o nel repository.

**Usabilità**

- **FR-030** *(RNF-13)*: L'interazione MUST essere il più possibile guidata: nessuna sintassi da ricordare oltre al formato della data.
- **FR-031** *(RNF-14)*: I pulsanti MUST essere usati solo per le azioni; la navigazione verso le schede MUST usare i comandi `/p_<id>` nel testo.
- **FR-032** *(RNF-15)*: Tutti i testi del bot MUST essere raccolti in un unico punto.

### Key Entities *(include if feature involves data)*

- **Persona** *(AFU §8)*: nome completo, nickname (opz.), giorno, mese, anno (opz.), telefono (opz., formato internazionale), username Instagram (opz.), username Telegram (opz.), priorità (Alta/Media/Bassa, default Media), messaggio personalizzato (opz.), data creazione, data ultima modifica.
- **Gruppo** *(AFU §8)*: nome univoco senza distinzione tra maiuscole e minuscole.
- **Appartenenza** *(AFU §8)*: relazione molti-a-molti tra Persona e Gruppo.
- **Occorrenza** *(AFU §8)*: il compleanno di una persona in un dato anno con il suo esito. In questa feature non ne vengono create; è citata perché l'eliminazione di una persona deve rimuovere anche occorrenze e storico (RF-05) e la scheda mostra lo storico (RF-03).
- **Stato conversazione** *(AFU §8)*: flusso guidato in corso (inserimento, modifica, gestione gruppi), step corrente, dati parziali, scadenza (24 ore dall'ultima interazione, A-04).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-01…08, RF-28…30)*: Il 100% dei criteri di accettazione Dato/Quando/Allora dei requisiti inclusi è verificato da almeno un test.
- **SC-002** *(RF-30, RNF-02, RNF-03)*: Il 100% delle richieste di mittenti estranei (diverse da `/id`) e delle richieste senza token segreto corretto non produce né risposte né modifiche ai dati.
- **SC-003** *(RF-02, BR-01, BR-02)*: Il 100% delle date fuori formato, inesistenti o con anno fuori intervallo viene rifiutato; il 100% di quelle valide viene confermato con la data interpretata.
- **SC-004** *(RF-01, RNF-13)*: Il proprietario inserisce una persona con i soli campi obbligatori senza consultare istruzioni oltre al formato della data mostrato dal bot.
- **SC-005** *(RF-04)*: La correzione di un singolo campo richiede al massimo tre interazioni dalla scheda (Modifica → campo → nuovo valore o Svuota).
- **SC-006** *(RNF-04)*: Nessun segreto (token del bot, ID del proprietario, token del webhook) è presente nel repository.

## Assumptions

- L'età "che compirà" e i giorni mancanti si calcolano rispetto al prossimo compleanno, con età = anno del prossimo compleanno − anno di nascita (coerente con BR-03). Esempio (AFU §5.6): il 28/10/2026, per una persona nata il 14/03/1994, la scheda mostra "compie 33 anni tra 137 giorni".
- Per una persona nata il 29/02, i giorni mancanti negli anni non bisestili si contano verso il 28/02 (data effettiva, glossario AFU e BR-04).
- In assenza di messaggio personalizzato la scheda mostra "Messaggio: standard", come nell'esempio AFU §5.6.
- `/aiuto` elenca i comandi disponibili in questa feature (tabella del Perimetro); gli altri comandi di §5.1 si aggiungeranno con le rispettive feature.
- Rinominare un gruppo cambiando solo maiuscole/minuscole del proprio nome (es. "lavoro" → "Lavoro") è consentito, perché non crea un duplicato di un altro gruppo.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
