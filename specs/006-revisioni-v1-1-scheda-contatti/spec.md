# Feature Specification: Revisioni v1.1 — Scheda e contatti

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-1-scheda-contatti\". Fonte unica: docs/AFU.md v1.1, sezioni \"Registro modifiche\" e \"Impatto della versione 1.1\", area Scheda e contatti: RF-03, RF-11, RF-01, RF-04, BR-25, V-08 (REV-005, REV-002). Il bot è già implementato (specs da 001 a 005): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione. Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.1 (fonte di verità funzionale): Registro modifiche (REV-002, REV-005), "Impatto della versione 1.1", testi v1.1 di RF-01, RF-03, RF-04, RF-11, BR-25, V-08, decisioni D-24 e D-27, mockup §5.2 e §5.6. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica), 002 (promemoria-esiti) e 003 (viste-ricerche); tutto ciò che non è citato qui resta come definito in quelle spec.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-005 | Pulsanti di contatto nella scheda | RF-03, RF-11 (§5.6, D-27) |
| REV-002 | Telefono da contatto condiviso | RF-01, RF-04, BR-25, V-08 (§5.2, D-24) |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 001 | FR-011, User Story 3 (esempio) | Username Instagram e Telegram fuori dal testo della scheda; i contatti presenti diventano pulsanti; il telefono resta nel testo | RF-03, V-04 |
| 003 | FR-017 | "Segna fatto" si colloca tra la riga dei contatti e [Modifica] [Elimina] | RF-03 |
| 002 | FR-026, FR-029 | I pulsanti di contatto si usano anche nella scheda: lì WhatsApp apre la chat senza testo e "Copia messaggio" non c'è | RF-11, D-27 |
| 002 | FR-026 | I pulsanti Instagram e Telegram non compaiono, anche nei promemoria, se lo username salvato non rispetta il formato del link (chiarimento Q5): interpretazione di "contatto presente" di RF-11 | RF-11 |
| 001 | FR-001, FR-009, User Story 1 (esempio) | Allo step Telefono si può condividere un contatto, con normalizzazione BR-25 e conferma | RF-01, BR-25, V-08, D-24 |
| 001 | FR-014, FR-016 | In Modifica → Telefono si può condividere un contatto, con le stesse regole | RF-04, BR-25 |
| 001 | FR-018b | Un contatto condiviso fuori dallo step Telefono è ignorato e il bot ripete la domanda dello step | RF-01 |

**Fuori da questa feature**: creazione di una persona da un contatto condiviso e import da vCard o rubrica (AFU §2, Out of scope); le altre revisioni v1.1 (REV-001 guida di stile RNF-19, REV-003 e REV-004 gruppi, REV-006, REV-007 stato e statistiche). I promemoria (reminder, recupero, `/oggi`) restano come definiti in spec 002 e 003, salvo l'omissione dei pulsanti con username non validi (FR-002).

## Clarifications

### Session 2026-10-29

- Q: Un numero da contatto di 11+ cifre senza "+" né "00" che inizia per 3 (es. `3933312345678`) segue BR-25 così com'è o serve una regola italiana apposta? → A: BR-25 così com'è: si antepone "+", si valida con BR-15 e si chiede conferma; un numero sbagliato si scarta con Correggi (D-24).
- Q: Un numero da contatto con lettere o estensione (es. `0212345678x12`) va ripulito togliendo tutti i caratteri non cifra o troncato alla prima lettera? → A: Caso mai visto in pratica: nessuna regola apposta; vale FR-009 com'è (si scartano tutti i caratteri non cifra, poi BR-25 e conferma).
- Q: Un contatto condiviso senza numero (`phone_number` vuoto o assente) dà il messaggio di numero non valido o uno specifico? → A: Messaggio specifico ("Questo contatto non ha un numero di telefono"), poi il bot ripete la domanda del telefono.
- Q: Durante la conferma "📱 <numero>, giusto?" un secondo contatto o un numero scritto sostituiscono la proposta? → A: No: qualsiasi messaggio (testo o contatto) è ignorato e il bot ripete la conferma con Sì / Correggi; per cambiare numero si usa Correggi.
- Q: Username Instagram/Telegram già salvati con caratteri non validi per `ig.me`/`t.me`: pulsante mostrato, omesso, o omesso con username nel testo? → A: Pulsante omesso se lo username non rispetta il formato (Instagram: lettere, cifre, `.` `_`, max 30; Telegram: lettere, cifre, `_`, 5-32); lo username resta salvato invariato e non compare nel testo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pulsanti di contatto nella scheda (Priority: P1)

Il proprietario apre la scheda di una persona in qualsiasi periodo dell'anno e la contatta con un tocco su WhatsApp, Instagram o Telegram, senza dover copiare username dal testo. Il numero di telefono resta nel testo per chiamarlo o copiarlo.

**Why this priority**: la scheda si apre tutto l'anno (D-27) ed è il punto da cui si raggiunge una persona fuori dai promemoria; oggi gli username sono solo testo.

**Independent Test**: con persone che hanno tutti i contatti, solo alcuni o nessuno, aprire `/p_<id>` e verificare testo, ordine dei pulsanti e destinazione dei pulsanti di contatto; ripetere con un'occorrenza da segnare (RF-21) e con un'occorrenza aperta oggi.

**Esempio (AFU §5.6)**:

```
👤 Marco Rossi — "Marchino"
🎂 14/03/1994 · compie 33 anni tra 137 giorni
Priorità: alta · Gruppi: Beach tennis, Lavoro
📱 +39 333 1234567
Messaggio: standard
Storico: 2025 fatto · 2024 saltato

[WhatsApp] [Instagram] [Telegram]
[✏️ Modifica] [🗑 Elimina]
```

Se c'è un'occorrenza da segnare (RF-21), [Segna fatto] compare tra la riga dei contatti e [✏️ Modifica] [🗑 Elimina].

**Acceptance Scenarios**:

1. **Given** che Marco ha telefono e Instagram ma non Telegram, **When** apro la sua scheda, **Then** vedo il numero nel testo, i pulsanti [WhatsApp] [Instagram] sopra [Modifica] [Elimina], e nessuno username nel testo. *(RF-03)*
2. **Given** che premo WhatsApp nella scheda, **Then** si apre la chat con Marco senza testo precompilato, anche se c'è un'occorrenza aperta. *(RF-03, RF-11, D-27)*
3. **Given** che una persona non ha contatti, **When** apro la scheda, **Then** la riga dei contatti non compare. *(RF-03)*
4. **Given** che Marco ha un'occorrenza *saltato* di 3 giorni fa e tutti i contatti, **When** apro la scheda, **Then** vedo nell'ordine la riga [WhatsApp] [Instagram] [Telegram], poi [Segna fatto], poi [Modifica] [Elimina]. *(RF-03, RF-21)*
5. **Given** la scheda di una persona, **Then** il pulsante "Copia messaggio" non compare. *(RF-11)*
6. **Given** che dalla scheda premo Segna fatto, oppure modifico un campo, **When** la scheda viene ridisegnata, **Then** ha la stessa tastiera, con la riga dei contatti aggiornata ai contatti presenti. *(RF-03)*
7. **Given** che Marco ha telefono, **When** ricevo il suo reminder, **Then** WhatsApp apre la chat con il messaggio di auguri già scritto e "Copia messaggio" è presente, come prima. *(RF-11)*

---

### User Story 2 - Telefono da contatto condiviso nell'inserimento (Priority: P1)

Durante `/nuovo`, allo step Telefono, il proprietario invece di scrivere il numero condivide il contatto della persona dalla rubrica (📎 → Contatto). Il bot propone il numero normalizzato e chiede conferma prima di usarlo.

**Why this priority**: fa risparmiare tempo nell'inserimento senza creare la persona dal contatto (D-24); la conferma evita numeri salvati sbagliati in silenzio (V-08).

**Independent Test**: eseguire `/nuovo` e allo step Telefono condividere contatti con numeri `393331234567`, `333 1234567`, `+41 79 123 45 67`, `0041791234567` e un numero non valido; premere Sì e Correggi; condividere un contatto in altri step.

**Flusso di esempio (AFU §5.2)**:

```
Bot: 📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)
     oppure condividi il contatto 📎                   [⏭ Salta]
Tu:  [condivide il contatto di Marco]
Bot: 📱 +393331234567, giusto?                        [Sì] [Correggi]
Bot: 📸 Username Instagram?                           [⏭ Salta]
```

**Acceptance Scenarios**:

1. **Given** che sono allo step Telefono, **When** condivido il contatto di Marco con numero `393331234567`, **Then** il bot chiede "📱 +393331234567, giusto?" e, se premo Sì, passa allo step Instagram con quel numero. *(RF-01, BR-25)*
2. **Given** che il contatto ha il numero `333 1234567`, **When** lo condivido, **Then** il bot propone `+393331234567`. *(RF-01, BR-25)*
3. **Given** che premo Correggi, **Then** il bot ripete la domanda del telefono e il numero non viene salvato. *(RF-01)*
4. **Given** che sono allo step Nome, **When** condivido un contatto, **Then** il bot lo ignora e ripete la domanda del nome. *(RF-01)*
5. **Given** che il numero normalizzato non è valido per BR-15, **When** condivido il contatto, **Then** il bot lo segnala e ripete la domanda del telefono. *(RF-01, BR-15, BR-25)*
6. **Given** che sono allo step Telefono, **Then** la domanda suggerisce anche di condividere il contatto. *(RF-01, §5.2)*
7. **Given** che il contatto condiviso ha un nome diverso da quello inserito e un utente Telegram associato, **When** confermo il numero, **Then** nome, username Telegram e gli altri dati della persona restano quelli inseriti nel flusso. *(RF-01, V-08)*

---

### User Story 3 - Telefono da contatto condiviso nella modifica (Priority: P2)

Dalla scheda, con Modifica → Telefono, il proprietario aggiorna il numero condividendo un contatto, con le stesse regole dell'inserimento.

**Why this priority**: estende la stessa scorciatoia alla correzione di un dato esistente; il valore principale è già dato dalla User Story 2.

**Independent Test**: da una scheda, premere Modifica → Telefono, condividere un contatto, confermare o correggere; verificare che cambi solo il telefono.

**Acceptance Scenarios**:

1. **Given** che premo Modifica → Telefono e condivido un contatto, **When** confermo il numero proposto, **Then** viene aggiornato solo il telefono e rivedo la scheda. *(RF-04, BR-25)*
2. **Given** che premo Modifica → Telefono, condivido un contatto e premo Correggi, **Then** il bot ripete la domanda del telefono e il telefono salvato non cambia. *(RF-04)*
3. **Given** che premo Modifica → Instagram, **When** condivido un contatto, **Then** il bot lo ignora e ripete la domanda dell'username Instagram. *(RF-01, RF-04)*
4. **Given** che premo Modifica → Telefono → Svuota, **When** confermo, **Then** il telefono viene rimosso, come prima. *(RF-04)*

---

### Edge Cases

- Numero del contatto con "+" iniziale (es. `+41 79 123 45 67`): si tengono solo le cifre e il "+" e si propone `+41791234567`. *(BR-25)*
- Numero con "00" iniziale (es. `0041791234567`): "00" diventa "+", si propone `+41791234567`. *(BR-25)*
- Numero di 9 o 10 cifre senza prefisso (es. `333 1234567`): nazionale, si propone `+39` davanti. *(BR-25)*
- Numero di 11 o più cifre senza "+" né "00" (es. `393331234567`): già internazionale, si antepone "+". *(BR-25, V-08)*
- Numero di 11 o più cifre che inizia per 3 con cifre in eccesso (es. `3933312345678`): nessuna regola italiana apposta; si propone `+3933312345678` se valido per BR-15, e il proprietario lo scarta con Correggi. *(BR-25, D-24)*
- Numero con caratteri diversi da cifre (spazi, trattini, parentesi, punti, e anche lettere o indicazioni di estensione): vengono tutti scartati prima delle regole di BR-25; non c'è gestione apposta delle estensioni, caso non riscontrato nell'uso reale. Un eventuale numero risultante sbagliato si scarta con Correggi. *(BR-25, D-24)*
- Numero che dopo BR-25 non rispetta BR-15 ("+" seguito da 8-15 cifre; spec 001, FR-009), oppure di meno di 9 cifre senza "+" né "00": il bot segnala che il numero non è valido e ripete la domanda del telefono; non salva nulla. *(BR-15, BR-25)*
- Contatto senza numero (`phone_number` vuoto o assente): il bot risponde "Questo contatto non ha un numero di telefono" e ripete la domanda del telefono; non salva nulla. *(V-08)*
- Contatto con più numeri in rubrica: si usa solo il numero principale che arriva con il contatto; gli altri numeri non sono considerati. *(V-08)*
- Contatto condiviso (anche un secondo contatto diverso) mentre il bot chiede la conferma "📱 <numero>, giusto?": ignorato, non sostituisce la proposta; il bot ripete la domanda di conferma con Sì / Correggi. *(RF-01; spec 001, FR-018b)*
- Testo scritto mentre il bot chiede la conferma del numero, anche un numero valido: ignorato, non viene salvato; il bot ripete la domanda con Sì / Correggi. Per cambiare numero si usa Correggi. *(spec 001, FR-018b)*
- Contatto condiviso in uno step di qualsiasi altro flusso guidato (nome, data, gruppi, priorità, messaggio, menu di Modifica, `/messaggio`, gruppi, import): ignorato, il bot ripete la domanda di quello step. *(RF-01)*
- Contatto condiviso fuori da qualsiasi flusso guidato: trattato come un messaggio non riconosciuto ("Non ho capito. Scrivi /aiuto per l'elenco dei comandi", spec 001, FR-025a); nessuna persona viene creata. *(AFU §2, Out of scope)*
- Sì o Correggi premuti su una conferma di un flusso scaduto, annullato o già concluso: "Questa azione non è più disponibile" (spec 001, FR-018c). *(A-04)*
- Numero confermato da contatto uguale a quello già salvato, in Modifica: il salvataggio avviene come per un numero scritto a mano e il bot rimostra la scheda. *(RF-04)*
- Persona con solo telefono: la scheda mostra il numero nel testo e il solo pulsante [WhatsApp]. *(RF-03, RF-11)*
- Persona con solo username Instagram e/o Telegram: nessun numero nel testo, pulsanti [Instagram] e/o [Telegram]; gli username non compaiono nel testo. *(RF-03)*
- Username Instagram o Telegram salvato in un formato non valido per il link (es. `marco rossi`, `màrco`, Telegram `abc`): il relativo pulsante non compare, né nella scheda né nei promemoria; lo username resta salvato invariato e non compare nel testo; il pulsante compare quando lo username viene corretto con Modifica. *(RF-03, RF-11, BR-16)*
- Riepilogo prima di Salva nell'inserimento guidato: mostra la scheda nel nuovo formato del testo (spec 001, FR-003). *(RF-03)*

## Requirements *(mandatory)*

### Functional Requirements

**Scheda persona** *(modifica spec 001 FR-011 e spec 003 FR-017)*

- **FR-001** *(RF-03, V-04; modifica 001 FR-011)*: Il testo della scheda MUST NOT contenere gli username di Instagram e Telegram. Il telefono, se presente, MUST restare nel testo nella forma salvata (spec 001, FR-011), dove Telegram lo rende cliccabile per chiamare o copiarlo. Il resto del contenuto resta quello di spec 001 FR-011 e spec 002 FR-034; il layout segue il mockup AFU §5.6.
- **FR-002** *(RF-03, RF-11; modifica 001 FR-011 e 003 FR-017)*: La tastiera della scheda MUST contenere, in quest'ordine:
  - la riga dei contatti [WhatsApp] [Instagram] [Telegram], con i soli pulsanti dei contatti presenti (telefono per WhatsApp, username Instagram, username Telegram); senza contatti la riga MUST NOT comparire;
  - [Segna fatto], solo quando previsto da RF-21 (spec 003, FR-017, invariato nelle condizioni);
  - [Modifica] [Elimina].

  Un username è "presente" ai fini dei pulsanti solo se rispetta il formato del link: Instagram lettere, cifre, `.` e `_`, al massimo 30 caratteri; Telegram lettere, cifre e `_`, da 5 a 32 caratteri. Altrimenti il pulsante MUST NOT comparire, nella scheda come nei promemoria (spec 002, FR-026).
- **FR-003** *(RF-03)*: La stessa tastiera di FR-002 MUST essere usata ogni volta che la scheda viene mostrata o ridisegnata: `/p_<id>`, apertura diretta da `/cerca` con un solo risultato, dopo il salvataggio di una persona, dopo Segna fatto e dopo una modifica. La riga dei contatti MUST riflettere i contatti presenti al momento in cui la scheda viene mostrata.

**Pulsanti di contatto** *(modifica spec 002 FR-026 e FR-029)*

- **FR-004** *(RF-11, D-27; modifica 002 FR-026)*: Nella scheda il pulsante WhatsApp MUST aprire la chat con il numero della persona (formato internazionale, spec 002 FR-027) senza testo precompilato, anche se la persona ha un'occorrenza aperta. I pulsanti Instagram e Telegram MUST aprire la chat come nei promemoria (spec 002, FR-026).
- **FR-005** *(RF-11; modifica 002 FR-026 e FR-029)*: Nella scheda il pulsante "Copia messaggio" MUST NOT comparire. Il testo precompilato di WhatsApp e "Copia messaggio" restano solo nei promemoria (reminder, recupero, `/oggi`), con il comportamento invariato di spec 002 (FR-026…FR-029) e spec 003 (FR-006).
- **FR-006** *(RF-11, RNF-19)*: Le etichette dei pulsanti di contatto (WhatsApp, Instagram, Telegram, Copia messaggio) MUST NOT avere icone, sia nella scheda sia nei promemoria.

**Telefono da contatto condiviso** *(modifica spec 001 FR-001, FR-009, FR-014, FR-016, FR-018b)*

- **FR-007** *(RF-01, V-08; modifica 001 FR-001)*: Allo step Telefono dell'inserimento guidato il bot MUST accettare, oltre al numero scritto, un contatto condiviso dalla rubrica (📎 → Contatto). La domanda dello step MUST suggerire anche questa possibilità (mockup §5.2). Il pulsante [Salta] resta.
- **FR-008** *(RF-01, V-08, D-24)*: Del contatto condiviso il bot MUST usare solo il numero principale che arriva con il contatto; nome, vCard e utente Telegram del contatto MUST essere ignorati e MUST NOT modificare alcun campo della persona.
- **FR-009** *(BR-25, BR-15; modifica 001 FR-009)*: Il numero del contatto MUST essere normalizzato così: si tengono solo le cifre e l'eventuale "+" iniziale; poi
  - con "+" iniziale il numero si prende così com'è;
  - con "00" iniziale, "00" diventa "+";
  - con 9-10 cifre il numero è nazionale e si antepone `+39`;
  - con 11 cifre o più il numero è già internazionale e si antepone "+".

  Il risultato MUST essere validato con la regola di spec 001 FR-009 (BR-15). Un numero non valido, o non coperto da nessuna delle regole (meno di 9 cifre senza "+" né "00"), MUST essere segnalato e il bot MUST ripetere la domanda del telefono senza salvare nulla. Un contatto senza numero (`phone_number` vuoto o assente) MUST essere segnalato con un messaggio specifico ("Questo contatto non ha un numero di telefono"), distinto da quello del numero non valido, seguito dalla stessa domanda del telefono.
- **FR-010** *(RF-01, D-24)*: Per un numero valido il bot MUST chiedere sempre conferma con "📱 <numero>, giusto?", con il numero nella forma che verrà salvata, e i pulsanti Sì / Correggi. Sì MUST usare il numero per il campo Telefono e passare allo step successivo (Instagram); Correggi MUST ripetere la domanda del telefono senza usare il numero. Un numero da contatto MUST NOT essere salvato senza Sì.
- **FR-011** *(RF-01; modifica 001 FR-018b)*: Un contatto condiviso in qualsiasi step diverso dalla domanda del telefono (compresa la conferma di FR-010 e gli step di altri flussi guidati) MUST essere ignorato e il bot MUST ripetere la domanda di quello step con i suoi pulsanti. Fuori da qualsiasi flusso guidato il contatto MUST essere trattato come un messaggio non riconosciuto (spec 001, FR-025a) e MUST NOT creare una persona.
- **FR-012** *(RF-04, BR-25; modifica 001 FR-014, FR-016)*: In Modifica → Telefono il bot MUST accettare un contatto condiviso con le stesse regole di FR-008…FR-011. Con Sì MUST essere aggiornato solo il telefono e il bot MUST rimostrare la scheda (FR-003); con Correggi MUST ripetere la domanda del telefono e il telefono salvato MUST NOT cambiare. "Svuota" resta invariato (spec 001, FR-015).

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.1")*

- **FR-013**: Il rilascio MUST NOT richiedere nuove entità, modifiche di struttura o conversioni dei dati esistenti.
- **FR-014** *(RF-03, BR-15, BR-16)*: Telefoni e username Instagram e Telegram già salvati MUST restare invariati: gli username non compaiono più nel testo della scheda ma restano salvati e alimentano i pulsanti di contatto della scheda e dei promemoria; uno username in formato non valido per il link resta salvato ma non genera il pulsante (FR-002) e MUST NOT essere corretto o cancellato automaticamente. I numeri già salvati MUST NOT essere rinormalizzati con BR-25, che vale solo per i numeri da contatto condiviso.
- **FR-015**: Le schede e i promemoria già inviati prima del rilascio MUST NOT essere aggiornati. I pulsanti delle schede inviate prima del rilascio (Modifica, Elimina, Segna fatto) MUST continuare a funzionare come oggi; quando una di queste schede viene ridisegnata (dopo Segna fatto o una modifica), MUST usare il nuovo formato (FR-001…FR-003).
- **FR-016** *(RF-01, RF-04)*: Un flusso di inserimento o di modifica già in corso al momento del rilascio MUST proseguire senza interruzioni; dallo step Telefono in poi vale FR-007…FR-012.
- **FR-017** *(RF-11)*: Il messaggio di auguri di default e i messaggi personalizzati MUST NOT essere modificati.

### Key Entities *(include if feature involves data)*

- **Persona** *(AFU §8, spec 001)*: nessun nuovo attributo. Il telefono ottenuto da un contatto condiviso è salvato nello stesso campo e nello stesso formato internazionale del telefono scritto a mano.
- **Contatto condiviso** *(AFU V-08)*: messaggio con cui il proprietario invia un contatto della rubrica; ne conta solo il numero principale. Non è salvato.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-01, RF-03, RF-04, RF-11, BR-25)*: Il 100% dei criteri di accettazione Dato/Quando/Allora v1.1 dei requisiti inclusi è verificato da almeno un test; i criteri MVP degli stessi requisiti continuano a passare.
- **SC-002** *(RF-03, RF-11)*: Dalla scheda il proprietario apre la chat WhatsApp, Instagram o Telegram di una persona con un solo tocco, per ogni contatto presente.
- **SC-003** *(RF-01, RF-04, BR-25)*: Lo step Telefono si completa con un contatto condiviso in due interazioni (condivisione e Sì).
- **SC-004** *(D-24, V-08)*: Nessun numero proveniente da un contatto condiviso viene salvato senza la conferma esplicita del proprietario.
- **SC-005** *(BR-25)*: Per i casi di esempio di BR-25 (`393331234567`, `333 1234567`, `+41 79 123 45 67`, `0041791234567`) il numero proposto è quello atteso nel 100% dei casi.
- **SC-006** *(Impatto v1.1)*: Dopo il rilascio, il 100% delle persone in produzione mantiene telefono e username identici a prima.

## Assumptions

- Le spec 001, 002 e 003 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto vale questa spec (AFU v1.1).
- Un numero di meno di 9 cifre senza "+" né "00" non è coperto da BR-25 ed è trattato come non valido, perché non è possibile stabilire il prefisso.
- Correggi ripete la stessa domanda dello step Telefono (che accetta anche un altro contatto o il numero scritto), come "Telefono?" nei criteri di RF-01.
- Il riepilogo di fine inserimento (spec 001, FR-003) usa il testo della scheda di FR-001; i pulsanti restano Salva / Annulla.
- Le condizioni di comparsa di [Segna fatto] restano quelle di spec 003 FR-017; cambia solo la posizione nella tastiera.
- I testi della scheda e della domanda del telefono seguono i mockup §5.6 e §5.2; l'applicazione della guida di stile RNF-19 agli altri testi è fuori da questa feature.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
