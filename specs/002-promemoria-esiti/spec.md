# Feature Specification: Promemoria ed esiti

**Feature Branch**: `002-promemoria-esiti`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Feature \"promemoria-esiti\". Fonte unica: docs/AFU.md. Includi: RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, le regole BR-03…BR-13 e BR-24, l'intero paragrafo 7 (profili, stati dell'occorrenza, backup automatico escluso perché appartiene alla feature 004, regole N-01…N-05), i vincoli V-04, V-05, V-06, i flussi 5.3, 5.4, 5.5, e RNF-10, RNF-12, RNF-17. Completa lo storico nella scheda (RF-03). Il pulsante \"Copia messaggio\" usa il pulsante inline nativo di Telegram per copiare testo negli appunti. Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.0 (fonte di verità funzionale). Ogni requisito riporta l'ID AFU corrispondente.

## Perimetro

**Requisiti AFU inclusi**: RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15; RF-03 limitatamente allo storico esiti nella scheda; BR-03, BR-04, BR-05, BR-06, BR-07, BR-08, BR-09, BR-10, BR-11, BR-12, BR-13, BR-24; §7 (profili di priorità, stati dell'occorrenza, regole N-01…N-05); V-04, V-05, V-06; RNF-10, RNF-12, RNF-17. Flussi di esempio: §5.3, §5.4, §5.5.

**Comandi inclusi (da AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/messaggio` | Modifica messaggio di default | RF-15 |

**Decisione del proprietario (2026-10-28)**: il pulsante "Copia messaggio" (RF-11) è il pulsante inline nativo di Telegram che copia un testo negli appunti. Non è un link, quindi è compatibile con V-04.

**Fuori da questa feature**:
- Backup automatico mensile (§7 "Altri invii programmati", RF-27): feature 004.
- `/oggi` (RF-16), citato da N-04 come rete di sicurezza, e `/scaduti` con il pulsante "Segna fatto" della scheda (RF-21), citati da BR-08 come canali di correzione dell'esito: arrivano con la feature delle viste. In questa feature la correzione BR-08 avviene dai pulsanti del recupero.
- `/anno` (RF-22), che leggerà lo storico prodotto da RF-14.
- Configurabilità dei profili e degli slot (RF-40, v2).

## Clarifications

### Session 2026-10-28

- Q: Il pulsante nativo di copia di Telegram accetta al massimo 256 caratteri, mentre la feature 001 ammette messaggi personalizzati fino a 500. Come si risolve? → A: Limite di 256 caratteri sia per il messaggio personalizzato sia per il default di `/messaggio`; FR-010a della feature 001 passa da 500 a 256.
- Q: Se nel giorno D non è partito nessun reminder per un guasto della piattaforma o per errori di Telegram, il recupero va inviato? → A: Sì. La condizione di BR-11 ("almeno un reminder inviato") vale solo per le persone inserite il giorno stesso del compleanno; negli altri casi il recupero parte comunque (N-04). BR-11 è stata annotata nell'AFU.
- Q: Quando un'occorrenza viene chiusa da un messaggio, cosa succede agli altri messaggi della stessa occorrenza che hanno ancora i pulsanti di chiusura? → A: Si aggiorna solo il messaggio premuto; gli altri restano invariati. Fatto o Salta premuti su di essi non cambiano l'esito (salvo la correzione BR-08 dal recupero) e il bot risponde "Questa azione non è più disponibile".
- Q: Il recupero mostra nel testo il numero di telefono della persona, come il reminder del giorno? → A: Sì: se la persona ha un telefono, il recupero mostra la riga "📱 <numero>" (V-04).
- Q: Quando si preme "Salta quest'anno" su un pre-reminder, il messaggio si aggiorna? → A: Sì: mostra "Saltato quest'anno" e il pulsante viene rimosso.
- Q: Se in una stessa ora sono previsti più messaggi di quanti un'esecuzione possa inviare entro il limite di 50 subrequest, cosa succede? → A: Al massimo 40 invii per esecuzione; gli eccedenti restano registrati e partono alle esecuzioni successive della stessa giornata, come i retry (N-03). Con ~200 persone il caso realistico peggiore (~25 messaggi) non raggiunge il tetto.
- Q: BR-13 parla di "occorrenza aperta dell'anno corrente": quali occorrenze annulla un cambio di data? → A: Tutte le occorrenze aperte della persona, compresa quella dell'anno successivo già nata da un pre-reminder di dicembre. Si applica solo se cambiano giorno o mese, non se cambia solo l'anno.
- Q: Se un'esecuzione si interrompe dopo aver inviato un messaggio ma prima di averlo registrato, il messaggio va ritentato? → A: No. Si preferisce perdere un messaggio piuttosto che duplicarlo (N-02 prevale su N-03); il recupero del giorno dopo fa da rete di sicurezza.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reminder del giorno con contatto in un tocco (Priority: P1)

Il giorno del compleanno il proprietario riceve, negli slot previsti dalla priorità della persona, un messaggio per persona con i dati utili e i pulsanti per scriverle subito (WhatsApp con testo precompilato, Instagram, Telegram, Copia messaggio) e per chiudere il promemoria con Fatto o Salta quest'anno.

**Why this priority**: è lo scopo principale del bot: ricordare il compleanno nel giorno giusto e rendere immediato fare gli auguri.

**Independent Test**: con una persona che compie gli anni oggi, simulare l'esecuzione oraria agli orari degli slot e verificare messaggi, contenuto, pulsanti e chiusura.

**Flusso di esempio (AFU §5.3)**:

```
🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni
Gruppi: Beach tennis
📱 +39 333 1234567
L'anno scorso: fatto ✅

[WhatsApp] [Instagram] [Telegram]
[Copia messaggio]
[Fatto ✅] [Salta quest'anno]
```

**Acceptance Scenarios**:

1. **Given** che due persone compiono gli anni lo stesso giorno, **When** scatta lo slot, **Then** ricevo due messaggi separati, ciascuno con i propri pulsanti. *(RF-10)*
2. **Given** che l'anno scorso l'occorrenza era *non confermato*, **When** ricevo il reminder, **Then** la riga "L'anno scorso" non compare. *(RF-10, BR-09)*
3. **Given** che Marco ha solo telefono e Instagram, **When** ricevo il reminder, **Then** vedo WhatsApp, Instagram e Copia messaggio, ma non Telegram. *(RF-11)*
4. **Given** che premo WhatsApp, **Then** si apre la chat con Marco e il messaggio di auguri già scritto, senza età. *(RF-11, BR-03)*
5. **Given** che una persona non ha telefono (mai inserito o svuotato con Modifica), **When** ricevo il reminder, **Then** il pulsante WhatsApp non compare. *(RF-11)*
6. **Given** che premo Copia messaggio, **Then** il messaggio di auguri della persona viene copiato negli appunti, senza aprire link. *(RF-11, V-05, decisione 2026-10-28)*
7. **Given** che premo Fatto su un reminder, **Then** l'occorrenza diventa *fatto*, non ricevo altri slot né il recupero, e il messaggio si aggiorna mostrando "✅ Fatto" (i pulsanti di contatto restano). *(RF-12, BR-07)*
8. **Given** che premo Salta quest'anno su un reminder, **Then** l'occorrenza diventa *saltato*, con gli stessi effetti. *(RF-12, BR-07)*
9. **Given** una persona con priorità Media che compie gli anni oggi, **When** l'occorrenza resta aperta, **Then** ricevo il reminder alle 9:00, alle 13:00 e alle 18:00, e nessuno alle 21:00. *(§7)*

---

### User Story 2 - Recupero del giorno dopo ed esito finale (Priority: P1)

Se il proprietario non ha chiuso l'occorrenza entro la fine del giorno del compleanno, il giorno dopo alle 13:00 riceve un unico recupero con i pulsanti di contatto e Fatto / Saltato. Se non risponde, a fine giornata l'occorrenza diventa *non confermato*, senza altri messaggi.

**Why this priority**: è la rete di sicurezza contro le dimenticanze e chiude ogni occorrenza con un esito.

**Independent Test**: lasciare aperta un'occorrenza, simulare le esecuzioni orarie del giorno dopo e verificare un solo recupero e il passaggio a *non confermato* a fine giornata.

**Flusso di esempio (AFU §5.5)**:

```
⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?
[WhatsApp] [Instagram] [Telegram] [Copia messaggio]
[Fatto ✅] [Saltato]
```

**Acceptance Scenarios**:

1. **Given** che non ho chiuso l'occorrenza, **When** sono le 13:00 del giorno dopo, **Then** ricevo il recupero, una sola volta. *(RF-13, D-05)*
2. **Given** che non rispondo al recupero, **When** termina il giorno dopo, **Then** l'occorrenza diventa *non confermato* senza ulteriori messaggi. *(RF-13)*
3. **Given** che premo Fatto sul recupero, **Then** l'occorrenza diventa *fatto*. *(§7)*
4. **Given** che premo Saltato sul recupero, **Then** l'occorrenza diventa *saltato*. *(§7)*
5. **Given** un'occorrenza *saltato* o *non confermato* la cui data effettiva risale a non più di 7 giorni fa, **When** premo Fatto sul suo recupero, **Then** l'occorrenza diventa *fatto*. *(BR-08)*
6. **Given** un'occorrenza *fatto*, **When** premo Saltato su un suo messaggio, **Then** l'esito resta *fatto* e il bot risponde "Questa azione non è più disponibile". *(BR-08, chiarimento 2026-10-28)*
7. **Given** che una persona viene inserita il giorno del compleanno dopo l'ultimo slot del suo profilo, **When** arriva il giorno dopo, **Then** non ricevo il recupero. *(BR-11)*
8. **Given** una persona inserita prima del giorno del compleanno, i cui reminder del giorno D non sono partiti per un guasto della piattaforma o per errori di Telegram, **When** sono le 13:00 del giorno dopo e l'occorrenza è aperta, **Then** ricevo il recupero. *(BR-11, N-04, chiarimento 2026-10-28)*

---

### User Story 3 - Pre-reminder informativi (Priority: P2)

Nei giorni che precedono il compleanno, secondo la priorità, il proprietario riceve alle 13:00 un avviso informativo con il solo pulsante "Salta quest'anno".

**Why this priority**: serve a sapere in anticipo; non è indispensabile per fare gli auguri il giorno stesso.

**Independent Test**: con persone di priorità Alta, Media e Bassa, simulare le esecuzioni delle 13:00 nei giorni precedenti il compleanno e verificare quali pre-reminder arrivano.

**Flusso di esempio (AFU §5.4)**:

```
📅 Tra 7 giorni: compleanno di Marchino (32 anni) — 14/03
[Salta quest'anno]
```

**Acceptance Scenarios**:

1. **Given** che Marco ha priorità Alta e compie gli anni il 14/03, **When** sono le 13:00 del 07/03, **Then** ricevo "Tra 7 giorni: compleanno di Marco (32 anni) — 14/03". *(RF-09, §7)*
2. **Given** che premo "Salta quest'anno" su un pre-reminder, **Then** l'occorrenza diventa *saltato* e non riceverò altri pre-reminder, reminder o recuperi per quest'anno; il messaggio mostra "Saltato quest'anno" senza più pulsanti. *(RF-09, BR-07, chiarimento 2026-10-28)*
3. **Given** una persona con priorità Bassa, **When** si avvicina il compleanno, **Then** non ricevo alcun pre-reminder. *(§7)*
4. **Given** una persona con compleanno il 02/01 e priorità Alta, **When** sono le 13:00 del 26/12, **Then** ricevo il pre-reminder −7, che appartiene all'occorrenza dell'anno nuovo, con l'età calcolata su quell'anno. *(BR-05, BR-03)*

---

### User Story 4 - Messaggio di auguri (Priority: P2)

Il proprietario imposta con `/messaggio` il messaggio di auguri di default, con il segnaposto `{nome}`; ogni persona può avere un messaggio personalizzato che lo sostituisce. Il messaggio è quello precompilato in WhatsApp e quello copiato da "Copia messaggio".

**Why this priority**: personalizza gli auguri, ma esiste già un default iniziale funzionante.

**Independent Test**: cambiare il default con `/messaggio`, poi verificare il testo usato dai pulsanti WhatsApp e Copia messaggio per una persona senza e una con messaggio personalizzato.

**Acceptance Scenarios**:

1. **Given** che il default è "Tanti auguri {nome}! 🎉" e Marco ha nickname "Marchino", **When** premo WhatsApp, **Then** il testo è "Tanti auguri Marchino! 🎉". *(RF-15)*
2. **Given** che Anna ha un messaggio personalizzato, **When** premo WhatsApp sul suo reminder, **Then** viene usato il suo messaggio e non il default. *(RF-15)*
3. **Given** che uso `/messaggio` e invio un nuovo testo, **Then** il bot mostra un'anteprima con un nome d'esempio e chiede conferma. *(RF-15)*
4. **Given** una persona senza nickname, **When** viene composto il messaggio di default, **Then** `{nome}` è sostituito dal nome completo. *(RF-15)*

---

### User Story 5 - Storico esiti nella scheda (Priority: P3)

La scheda della persona mostra l'esito di ogni anno; lo stesso storico alimenta la riga "L'anno scorso" del reminder.

**Why this priority**: dà memoria nel tempo, ma non serve a ricevere i promemoria.

**Independent Test**: creare occorrenze chiuse in anni diversi e verificare la riga "Storico" della scheda e la riga "L'anno scorso" del reminder.

**Acceptance Scenarios**:

1. **Given** una persona con esito *fatto* nel 2025 e *saltato* nel 2024, **When** apro la scheda, **Then** vedo "Storico: 2025 fatto · 2024 saltato". *(RF-03, RF-14, AFU §5.6)*
2. **Given** una persona senza alcun esito, **When** apro la scheda, **Then** la riga "Storico" non compare. *(RF-03, feature 001 FR-013)*
3. **Given** che l'anno scorso l'esito era *saltato*, **When** ricevo il reminder di quest'anno, **Then** vedo la riga "L'anno scorso: saltato". *(RF-10, RF-14, BR-09)*

---

### User Story 6 - Modifiche a ridosso del compleanno (Priority: P3)

Inserimenti e modifiche della persona vicino al compleanno producono solo i promemoria ancora futuri, senza invii retroattivi.

**Why this priority**: casi limite meno frequenti, ma necessari per non ricevere promemoria sbagliati.

**Independent Test**: inserire o modificare persone in momenti diversi rispetto agli slot e verificare quali promemoria partono.

**Acceptance Scenarios**:

1. **Given** che inserisco alle 10:30 una persona con priorità Media che compie gli anni oggi, **When** proseguono le esecuzioni orarie, **Then** ricevo i reminder delle 13:00 e delle 18:00, e non quello delle 9:00. *(BR-10, BR-11)*
2. **Given** un'occorrenza aperta di una persona con priorità Media, **When** alle 10:00 del giorno del compleanno cambio la priorità in Alta, **Then** ricevo i reminder delle 13:00, 18:00 e 21:00 secondo il profilo Alta. *(BR-12)*
3. **Given** un'occorrenza aperta dell'anno corrente, **When** cambio la data di nascita, **Then** l'occorrenza aperta viene annullata e i promemoria seguono la nuova data. *(BR-13)*

---

### Edge Cases

- 29 febbraio in un anno non bisestile: la data effettiva è il 28/02; il reminder riporta "(compleanno il 29/02)"; i pre-reminder si contano a ritroso dal 28/02; scheda e pre-reminder mostrano sempre 29/02. *(BR-04)*
- Anno di nascita sconosciuto: l'età non compare nel reminder né nel pre-reminder. *(BR-03, RF-10)*
- L'età compare solo nei messaggi al proprietario, **mai** nel messaggio di auguri (WhatsApp e Copia messaggio). *(BR-03)*
- Pre-reminder di dicembre per un compleanno di gennaio: appartiene all'occorrenza dell'anno del compleanno. *(BR-05)*
- Fatto o Salta premuto su più messaggi della stessa occorrenza: vale solo il primo e si aggiorna solo il messaggio premuto; sugli altri messaggi la pressione non cambia l'esito e il bot risponde "Questa azione non è più disponibile" (salvo la correzione in *fatto* di BR-08 dai pulsanti del recupero). *(BR-07, BR-08, chiarimento 2026-10-28)*
- Correzione in *fatto* oltre i 7 giorni dalla data effettiva: non eseguita; il bot risponde "Questa azione non è più disponibile". *(BR-08, feature 001 FR-018c)*
- Pulsante di un promemoria premuto dopo l'eliminazione della persona: "Persona non trovata". *(feature 001 FR-018c)*
- Esecuzione oraria ripetuta nella stessa ora: nessun promemoria duplicato. *(N-02)*
- Invio fallito per un errore di Telegram: ritentato alle esecuzioni successive dello stesso giorno, poi abbandonato. *(N-03)*
- Esecuzione oraria saltata per un malfunzionamento della piattaforma: lo slot perso non viene recuperato. *(N-04)*
- Errore su una persona durante l'esecuzione oraria: gli invii alle altre persone proseguono. *(RNF-12)*
- Cambio tra ora solare e legale: gli slot restano alle stesse ore locali. *(BR-24)*
- Cambio di data di nascita verso una data già passata nell'anno corrente: nessun promemoria retroattivo per quest'anno. *(BR-13, BR-10)*
- Cambio di data di nascita quando l'occorrenza dell'anno corrente è già chiusa: l'esito resta e non nasce una seconda occorrenza nello stesso anno. *(BR-13, BR-06)*
- Persona senza gruppi: la riga "Gruppi" del reminder non compare. Persona senza telefono: la riga del numero non compare, né nel reminder né nel recupero. *(RF-10, RF-11, chiarimento 2026-10-28)*
- Reminder, pre-reminder e recupero previsti alla stessa ora (es. 13:00): arrivano tutti, come messaggi separati. *(D-03)*
- Messaggio di auguri (personalizzato o default) oltre il limite di FR-035: rifiutato con indicazione del massimo e ripetizione della domanda. *(RF-15, chiarimento 2026-10-28)*
- Nessun reminder inviato nel giorno D per un malfunzionamento della piattaforma o per errori di Telegram, per una persona inserita prima del giorno D: il recupero parte comunque. *(BR-11, N-04, chiarimento 2026-10-28)*

## Requirements *(mandatory)*

### Functional Requirements

**Profili e pianificazione**

- **FR-001** *(§7, D-01)*: I promemoria MUST seguire i profili di priorità:

  | Priorità | Pre-reminder (alle 13:00) | Giorno stesso (slot) | Recupero |
  |---|---|---|---|
  | **Alta** | −7, −2, −1 giorni | 9:00 · 13:00 · 18:00 · 21:00 | D+1 alle 13:00 |
  | **Media** | −1 giorno | 9:00 · 13:00 · 18:00 | D+1 alle 13:00 |
  | **Bassa** | nessuno | 9:00 · 18:00 | D+1 alle 13:00 |

  Profili e slot MUST essere costanti definite in un unico punto (in v2 diventano configurabili, RF-40).
- **FR-002** *(BR-24)*: Tutti gli orari MUST essere in ora locale Europe/Rome, con passaggio automatico tra ora solare e legale; il cambio d'ora non sposta gli slot.
- **FR-003** *(N-01)*: Un'unica esecuzione programmata oraria MUST gestire tutti gli invii: a ogni esecuzione il sistema calcola l'ora locale e invia ciò che è previsto per quell'ora. Se in un'ora sono previsti più di 40 invii, gli eccedenti partono alle esecuzioni successive della stessa giornata (chiarimento 2026-10-28).
- **FR-004** *(N-05)*: Gli orari dei promemoria MUST essere a ore piene.
- **FR-005** *(N-02, RNF-10)*: Ogni promemoria, identificato da (persona, anno, tipo, slot o giorni prima), MUST essere inviato al massimo una volta, anche se l'esecuzione oraria viene ripetuta.
- **FR-006** *(N-03, RNF-10)*: Un invio fallito per un errore di Telegram MUST essere ritentato alle esecuzioni successive solo entro la stessa giornata; poi MUST essere abbandonato. Un invio con esito sconosciuto (esecuzione interrotta tra l'invio e la sua registrazione) MUST NOT essere ritentato (chiarimento 2026-10-28).
- **FR-007** *(N-04)*: Uno slot non eseguito per un malfunzionamento della piattaforma MUST NOT essere recuperato.
- **FR-008** *(RNF-12)*: Un errore su una singola persona durante l'esecuzione oraria MUST NOT impedire gli invii alle altre.
- **FR-009** *(RNF-17)*: Ogni esecuzione oraria e ogni risposta del bot di questa feature MUST restare entro 10 ms di CPU con circa 200 persone (RNF-16); il tempo di attesa delle chiamate a Telegram non conta.

**Occorrenze, date ed età**

- **FR-010** *(BR-06)*: Ogni persona MUST avere al massimo un'occorrenza per anno.
- **FR-011** *(BR-05)*: Un'occorrenza MUST appartenere all'anno del compleanno, anche se i suoi pre-reminder cadono nell'anno precedente.
- **FR-012** *(BR-04)*: Per una persona nata il 29/02, negli anni non bisestili la data effettiva MUST essere il 28/02; la data mostrata MUST restare 29/02 ovunque; il reminder MUST riportare "(compleanno il 29/02)"; i pre-reminder MUST contarsi a ritroso dalla data effettiva.
- **FR-013** *(BR-03, D-08)*: L'età MUST essere calcolata come anno dell'occorrenza − anno di nascita, MUST comparire solo nei messaggi al proprietario e solo se l'anno di nascita è noto, e MUST NOT comparire nel messaggio di auguri.
- **FR-014** *(§7, stati dell'occorrenza)*: Un'occorrenza MUST trovarsi in uno di questi stati: *aperta*, *fatto*, *saltato*, *non confermato*. Transizioni ammesse:
  - *aperta* → *fatto* con Fatto (reminder o recupero);
  - *aperta* → *saltato* con "Salta quest'anno" (pre-reminder o reminder) o Saltato (recupero);
  - *aperta* → *non confermato* alla fine del giorno D+1 senza esito;
  - *saltato* o *non confermato* → *fatto* entro D+7 (FR-016).
  Il sistema MUST registrare data e ora dell'esito.
- **FR-015** *(BR-07)*: Il primo Fatto o Salta MUST chiudere l'occorrenza e annullare tutti i promemoria successivi, recupero compreso. Alla chiusura MUST aggiornarsi solo il messaggio premuto; gli altri messaggi già inviati per la stessa occorrenza restano invariati. Un Fatto o Salta premuto dopo la chiusura MUST NOT cambiare l'esito, salvo FR-016, e il sistema MUST rispondere "Questa azione non è più disponibile" (chiarimento 2026-10-28).
- **FR-016** *(BR-08)*: Un esito *saltato* o *non confermato* MUST poter essere corretto in *fatto* entro 7 giorni dalla data effettiva, con il pulsante Fatto del recupero. *Fatto* MUST NOT tornare indietro. Oltre i 7 giorni il pulsante MUST rispondere "Questa azione non è più disponibile". La correzione da scheda e `/scaduti` arriva con RF-21.
- **FR-017** *(BR-10)*: I promemoria il cui orario è già passato al momento dell'inserimento della persona MUST NOT essere inviati retroattivamente.
- **FR-018** *(BR-11, N-04)*: Se una persona viene inserita il giorno del compleanno, MUST partire solo gli slot ancora futuri, e il recupero MUST partire solo se nella giornata è stato inviato almeno un reminder. Per le persone inserite prima del giorno del compleanno il recupero MUST partire anche se nel giorno D nessun reminder è stato inviato (chiarimento 2026-10-28).
- **FR-019** *(BR-12)*: Il cambio di priorità durante un'occorrenza aperta MUST valere solo per i promemoria futuri.
- **FR-020** *(BR-13)*: Il cambio della data di nascita MUST annullare l'occorrenza aperta dell'anno corrente, se non ancora chiusa; la nuova occorrenza MUST seguire la nuova data, nel rispetto di FR-010 e FR-017. L'annullamento riguarda tutte le occorrenze aperte della persona e avviene solo se cambiano giorno o mese (chiarimento 2026-10-28).

**Pre-reminder**

- **FR-021** *(RF-09, D-06)*: Il sistema MUST inviare i pre-reminder alle 13:00 dei giorni previsti dal profilo, per le occorrenze aperte. Testo come AFU §5.4: "📅 Tra N giorni: compleanno di <nickname o nome> (<età> anni) — <gg/mm>", con l'età solo se nota. Il pre-reminder MUST avere il solo pulsante "Salta quest'anno".
- **FR-022** *(RF-09)*: "Salta quest'anno" sul pre-reminder MUST rendere l'occorrenza *saltato*: per quell'anno non partono altri pre-reminder, reminder o recuperi. Il messaggio premuto MUST aggiornarsi mostrando "Saltato quest'anno", senza più pulsanti (chiarimento 2026-10-28).

**Reminder del giorno**

- **FR-023** *(RF-10, D-03)*: Nel giorno della data effettiva, in ogni slot previsto dal profilo e finché l'occorrenza è aperta, il sistema MUST inviare **un messaggio per persona**.
- **FR-024** *(RF-10, AFU §5.3)*: Il reminder MUST contenere: nickname e nome completo (se diversi; altrimenti solo il nome), età (se l'anno è noto), gruppi (se presenti), numero di telefono nel testo (se presente, V-04), "L'anno scorso" (FR-033), i pulsanti di contatto (FR-026) e i pulsanti "Fatto ✅" e "Salta quest'anno".
- **FR-025** *(RF-12)*: Fatto sul reminder MUST rendere l'occorrenza *fatto*; Salta quest'anno MUST renderla *saltato*. In entrambi i casi non partono altri slot né il recupero, e il messaggio premuto MUST aggiornarsi mostrando l'esito ("✅ Fatto" o l'equivalente per *saltato*), mantenendo i pulsanti di contatto.

**Pulsanti di contatto**

- **FR-026** *(RF-11)*: I pulsanti di contatto MUST comparire solo per i contatti presenti nella scheda:

  | Pulsante | Comportamento | Testo precompilato |
  |---|---|---|
  | WhatsApp | apre la chat WhatsApp con il numero della persona | Sì, il messaggio di auguri |
  | Instagram | apre la chat Instagram con lo username | No (V-05) |
  | Telegram | apre la chat Telegram con lo username | No (V-05) |
  | Copia messaggio | copia il messaggio di auguri negli appunti | — |

  "Copia messaggio" MUST comparire sempre, perché il messaggio di auguri esiste sempre (default o personalizzato).
- **FR-027** *(V-06)*: Il pulsante WhatsApp MUST usare il numero in formato internazionale.
- **FR-028** *(V-04)*: I pulsanti di contatto MUST essere solo link `https://` o `tg://`, oppure il pulsante nativo di copia; MUST NOT esistere pulsanti "Chiama" o "SMS". Il numero di telefono MUST comparire nel testo del messaggio, dove Telegram lo rende cliccabile.
- **FR-029** *(RF-11, decisione 2026-10-28)*: "Copia messaggio" MUST essere il pulsante inline nativo di Telegram che copia un testo negli appunti; il testo copiato MUST essere il messaggio di auguri della persona (FR-031), senza età.

**Recupero**

- **FR-030** *(RF-13, D-05)*: Per tutte le priorità, se a fine giornata l'occorrenza è ancora aperta, il giorno dopo alle 13:00 il sistema MUST inviare un unico recupero: "⏰ Ieri era il compleanno di <nickname> (<nome completo>). Hai fatto gli auguri?" (AFU §5.5), con il numero di telefono nel testo se presente ("📱 <numero>", V-04, chiarimento 2026-10-28), i pulsanti di contatto e Fatto ✅ / Saltato. Se il recupero resta senza risposta, a fine del giorno dopo l'occorrenza MUST diventare *non confermato* senza ulteriori messaggi. Dopo un esito, il messaggio del recupero MUST aggiornarsi mostrandolo, mantenendo i pulsanti di contatto e, se l'esito è *saltato* o *non confermato*, il pulsante Fatto per la correzione di FR-016.

**Messaggio di auguri**

- **FR-031** *(RF-15, D-09)*: Il messaggio di auguri di una persona MUST essere il suo messaggio personalizzato, se presente, altrimenti il default globale. Il segnaposto `{nome}` MUST essere sostituito dal nickname o, se manca, dal nome completo.
- **FR-032** *(RF-15, A-06)*: Il comando `/messaggio` MUST permettere di modificare il default globale (valore iniziale "Tanti auguri {nome}! 🎉"): il proprietario invia il nuovo testo, il bot mostra un'anteprima con un nome d'esempio e chiede conferma; il default cambia solo dopo la conferma. Il flusso segue le regole dei flussi guidati della feature 001 (annullamento, scadenza, testo negli step a pulsanti).
- **FR-035** *(RF-15, RF-11, chiarimento 2026-10-28)*: Il messaggio personalizzato (inserimento e modifica) e il messaggio di default (`/messaggio`) MUST avere al massimo 256 caratteri, così che il messaggio composto rientri nel limite del pulsante nativo di copia. Nel conteggio ogni `{nome}` vale 60 caratteri, la lunghezza massima di nickname e nome completo (feature 001, FR-010a), in modo che il testo composto non superi mai 256 caratteri. Spazi iniziali e finali sono rimossi e il valore vuoto è rifiutato; un valore oltre il limite MUST essere rifiutato indicando il massimo e ripetendo la domanda. Questo requisito sostituisce il limite di 500 caratteri di FR-010a della feature 001.

**Storico esiti**

- **FR-033** *(RF-14, RF-10, BR-09)*: Ogni occorrenza MUST conservare il suo esito per anno. La riga "L'anno scorso" del reminder MUST comparire solo se l'esito dell'anno precedente è *fatto* ("fatto ✅") o *saltato*; con *non confermato* o senza occorrenza precedente MUST NOT comparire.
- **FR-034** *(RF-03, RF-14, AFU §5.6)*: La scheda della persona MUST mostrare la riga "Storico" con gli esiti definitivi (*fatto*, *saltato*, *non confermato*), un anno per voce, dal più recente (es. "Storico: 2025 fatto · 2024 saltato"). Le occorrenze *aperte* MUST NOT comparire. Senza esiti la riga MUST NOT comparire (feature 001, FR-013).

### Key Entities *(include if feature involves data)*

- **Occorrenza** *(AFU §8)*: persona, anno, data effettiva, stato (aperta / fatto / saltato / non confermato), data e ora dell'esito. Al massimo una per persona e anno (BR-06).
- **Invio** *(AFU §8)*: occorrenza, tipo (pre-reminder / reminder / recupero), riferimento (giorni prima o slot), data e ora, esito dell'invio, riferimento al messaggio inviato (serve ad aggiornarlo dopo Fatto/Salta). Unico per (persona, anno, tipo, riferimento) (N-02).
- **Impostazioni** *(AFU §8)*: messaggio di auguri di default.
- **Profilo di priorità** *(AFU §8)*: priorità, giorni dei pre-reminder, slot del giorno; costante in questa feature.
- **Persona** *(AFU §8, feature 001)*: usata in lettura (nome, nickname, data, contatti, gruppi, priorità, messaggio personalizzato); le modifiche di priorità e data producono gli effetti di BR-12 e BR-13.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-09…15)*: Il 100% dei criteri di accettazione Dato/Quando/Allora dei requisiti inclusi è verificato da almeno un test.
- **SC-002** *(N-02, RNF-10)*: Ripetendo l'esecuzione oraria più volte nella stessa ora, ogni promemoria arriva esattamente una volta.
- **SC-003** *(§7)*: Per ogni priorità, il numero di messaggi ricevuti per un'occorrenza lasciata senza risposta corrisponde al profilo: Alta 3 pre-reminder + 4 reminder + 1 recupero; Media 1 + 3 + 1; Bassa 0 + 2 + 1.
- **SC-004** *(BR-07, D-05)*: Dopo Fatto o Salta non arriva più alcun promemoria per quell'occorrenza; dopo il recupero non arriva più alcun messaggio.
- **SC-005** *(RF-11, RF-15)*: Dal reminder il proprietario apre la chat WhatsApp con il messaggio di auguri già scritto con un solo tocco.
- **SC-006** *(RNF-12)*: Un errore su una persona non riduce il numero di promemoria ricevuti per le altre persone nella stessa esecuzione.
- **SC-007** *(RNF-17)*: L'esecuzione oraria con circa 200 persone resta entro 10 ms di CPU. Verifica: stima e benchmark delle parti di calcolo prima del rilascio (piano, research R-09); conferma finale dalla pagina Metrics della dashboard Cloudflare dopo il deploy (p99 CPU dei cron < 7 ms, nessun `exceededCpu`). Nel pool di test di Workers l'orologio è fermo durante l'esecuzione, quindi la CPU non si può misurare con un test automatico.
- **SC-008** *(BR-24, BR-04, BR-05)*: I promemoria arrivano all'ora locale corretta nei giorni del cambio d'ora, il 28/02 degli anni non bisestili per i nati il 29/02, e a cavallo d'anno.

## Assumptions

- Un'occorrenza nasce solo per compleanni la cui data effettiva non precede l'inserimento della persona: per i compleanni già passati al momento dell'inserimento non si crea un'occorrenza, quindi lo storico non riceve esiti *non confermato* per anni in cui la persona non era nel bot (coerente con BR-10).
- "Fine giornata" significa la mezzanotte in ora locale Europe/Rome.
- "Entro 7 giorni dalla data effettiva" comprende l'intero giorno D+7 (A-05).
- Il pre-reminder −1 usa la forma singolare: "Tra 1 giorno".
- Il segnaposto `{nome}` si sostituisce anche nei messaggi personalizzati.
- L'età nel pre-reminder è quella che la persona compirà nell'occorrenza (BR-03, BR-05).
- Il numero di telefono nel testo del reminder è mostrato nella forma salvata, senza spazi, come nella scheda (feature 001, chiarimento 2026-10-28); gli spazi nell'esempio AFU §5.3 sono illustrativi.
- Per *saltato* il messaggio aggiornato mostra "Saltato" al posto di "✅ Fatto".
- Eventuali messaggi personalizzati già salvati con la feature 001 oltre i 256 caratteri (limite FR-035) non sono previsti, perché l'uso reale inizia con l'import; se presenti, "Copia messaggio" non compare per quella persona finché il messaggio non viene accorciato.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
