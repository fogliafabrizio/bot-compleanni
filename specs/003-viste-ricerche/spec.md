# Feature Specification: Viste e ricerche

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Feature \"viste-ricerche\". Fonte unica: docs/AFU.md. Includi: RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, il formato delle liste del paragrafo 5.7, BR-08 per il pulsante \"Segna fatto\", RNF-14 e RNF-16. Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.0 (fonte di verità funzionale). Ogni requisito riporta l'ID AFU corrispondente.

## Perimetro

**Requisiti AFU inclusi**: RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22 (con l'introduzione di §4.4 sul formato delle liste); BR-08 limitatamente al pulsante "Segna fatto" della scheda e a `/scaduti`; RNF-14, RNF-16. Formato di esempio: §5.7.

**Comandi inclusi (da AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/oggi` | Compleanni di oggi | RF-16 |
| `/prossimi [giorni] [gruppo]` | Prossimi compleanni | RF-17 |
| `/cerca <testo>` | Ricerca | RF-18 |
| `/gruppo <nome>` | Persone di un gruppo | RF-19 |
| `/mese [mese]` | Compleanni del mese | RF-20 |
| `/scaduti` | Ultimi 7 giorni non fatti | RF-21 |
| `/anno [anno]` | Riepilogo annuale | RF-22 |

**Dipendenze**: riusa la scheda `/p_<id>` (feature 001, RF-03), il reminder del giorno con i suoi pulsanti, gli stati dell'occorrenza, lo storico e la regola del 29/02 (feature 002: FR-012, FR-014, FR-015, FR-016, FR-024…FR-029, FR-033, FR-034).

**Fuori da questa feature**: tutti gli altri requisiti dell'AFU (import/export, backup, configurazioni v2, RF-50 "schede incomplete").

## Clarifications

### Session 2026-10-28

- Q: Quali compleanni rientrano negli "ultimi 7 giorni" di `/scaduti` e di "Segna fatto"? → A: Data effettiva da oggi − 7 a ieri; esiti *saltato*, *non confermato* e occorrenze ancora aperte (quella di ieri, in attesa del recupero). I compleanni di oggi restano in `/oggi`.
- Q: `/cerca` ignora gli accenti? → A: Sì: la ricerca ignora accenti e maiuscole/minuscole ("nicolo" trova "Nicolò" e viceversa).
- Q: In `/anno`, cosa significa "saltata per 2 o più anni consecutivi"? → A: Solo esiti *saltato*, nell'anno richiesto e negli anni immediatamente precedenti; un *non confermato* (o un anno senza occorrenza) interrompe la serie.
- Q: In `/mese`, a quale anno si riferiscono giorno della settimana ed età? → A: Mese corrente e mesi futuri: anno corrente (per i giorni già passati, l'età compiuta). Mesi già conclusi: anno prossimo.
- Q: In `/prossimi`, i compleanni di oggi compaiono? → A: Sì: oggi compreso; `/prossimi 7` mostra oggi e i 6 giorni successivi.
- Q: `/oggi` con molti compleanni nello stesso giorno? → A: Al massimo 10 messaggi del reminder; le persone oltre la decima arrivano in un unico messaggio nel formato lista, con `/p_<id>` e senza pulsanti (decisione del proprietario in fase di piano, scostamento da RF-16 "per ciascuno").
- Q: In che ordine sono `/scaduti` e gli elenchi di `/anno`? → A: Per data dell'occorrenza, crescente (decisione del proprietario in fase di piano, eccezione a FR-002).
- Q: Le colonne delle liste vanno allineate come nell'esempio di §5.7? → A: Sì: data, nome ed età sono in monospazio e allineati in colonna; `/p_<id>` resta fuori dal monospazio, così è toccabile (decisione del proprietario in fase di piano).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compleanni di oggi (Priority: P1)

Il proprietario scrive `/oggi` e ritrova, per ogni persona che compie gli anni oggi, lo stesso messaggio del reminder del giorno, con i pulsanti di contatto e di chiusura e lo stato attuale dell'occorrenza. Se oggi non c'è nessun compleanno, il bot lo dice e indica il prossimo.

**Why this priority**: è la rete di sicurezza quotidiana: permette di agire anche se un reminder è stato perso o è finito in fondo alla chat.

**Independent Test**: con persone che compiono gli anni oggi (occorrenze aperte e chiuse) e in un giorno senza compleanni, inviare `/oggi` e verificare messaggi, pulsanti e stato.

**Acceptance Scenarios**:

1. **Given** che oggi ci sono compleanni, **When** scrivo `/oggi`, **Then** ricevo per ciascuno lo stesso messaggio del reminder del giorno, con i suoi pulsanti e lo stato attuale. *(RF-16)*
2. **Given** che l'occorrenza di oggi di Marco è già *fatto*, **When** scrivo `/oggi`, **Then** il suo messaggio mostra "✅ Fatto" con i soli pulsanti di contatto, come il reminder aggiornato. *(RF-16, BR-07)*
3. **Given** che premo Fatto sul messaggio di `/oggi` di un'occorrenza aperta, **Then** l'occorrenza diventa *fatto* con gli stessi effetti del reminder: nessun altro slot né recupero. *(RF-16, BR-07)*
4. **Given** che oggi non ci sono compleanni, **When** scrivo `/oggi`, **Then** il bot lo dice e indica il prossimo compleanno nel formato delle liste. *(RF-16, §5.7)*

---

### User Story 2 - Prossimi compleanni (Priority: P1)

Il proprietario scrive `/prossimi`, eventualmente con un numero di giorni e un gruppo, e riceve la lista dei compleanni in arrivo, ordinata per prossimo compleanno, nel formato di §5.7.

**Why this priority**: è la vista principale per organizzarsi in anticipo.

**Independent Test**: con persone in date diverse e in gruppi diversi, inviare `/prossimi`, `/prossimi 7`, `/prossimi 7 famiglia` e `/prossimi 7 inesistente` e verificare righe, ordine e messaggi.

**Flusso di esempio (AFU §5.7)**:

```
Prossimi 30 giorni (Famiglia)

Gio 30/10  Anna (28)      /p_4
Dom 02/11  Luca (35)      /p_17
Mer 12/11  Giulia         /p_9
```

**Acceptance Scenarios**:

1. **Given** che scrivo `/prossimi`, **Then** vedo i compleanni dei prossimi 30 giorni di tutte le persone, ordinati per prossimo compleanno. *(RF-17)*
2. **Given** che scrivo `/prossimi 7 famiglia`, **Then** vedo i compleanni dei prossimi 7 giorni delle persone del gruppo Famiglia. *(RF-17)*
3. **Given** che il gruppo indicato non esiste, **Then** il bot lo segnala ed elenca i gruppi esistenti. *(RF-17)*
4. **Given** che indico più di 366 giorni, **Then** il bot segnala che il massimo è 366 e non mostra la lista. *(RF-17)*
5. **Given** una persona senza anno di nascita, **When** compare nella lista, **Then** la riga non mostra l'età. *(§4.4, §5.7)*
6. **Given** che Anna compie gli anni oggi e Luca tra 7 giorni, **When** scrivo `/prossimi 7`, **Then** vedo Anna in cima e non vedo Luca. *(RF-17, chiarimento 2026-10-28)*

---

### User Story 3 - Ricerca e apertura della scheda (Priority: P1)

Il proprietario scrive `/cerca` con una parte del nome o del nickname. Con un solo risultato si apre direttamente la scheda; con più risultati riceve la lista.

**Why this priority**: è il modo più rapido per raggiungere una persona per consultarla o modificarla.

**Independent Test**: con persone dai nomi simili, cercare un testo che ne trova una, più di una e nessuna.

**Acceptance Scenarios**:

1. **Given** che un solo risultato corrisponde, **When** scrivo `/cerca marc`, **Then** il bot apre direttamente la scheda. *(RF-18)*
2. **Given** che corrispondono più risultati, **Then** il bot mostra la lista nel formato di §5.7, ordinata per prossimo compleanno. *(RF-18)*
3. **Given** che il testo è "MARCHINO", **Then** trova la persona con nickname "Marchino" (nessuna distinzione tra maiuscole e minuscole). *(RF-18)*
4. **Given** che nessuna persona corrisponde, **Then** il bot dice che non ci sono risultati. *(RF-18)*
5. **Given** una persona di nome "Nicolò", **When** scrivo `/cerca nicolo`, **Then** la trovo. *(RF-18, chiarimento 2026-10-28)*

---

### User Story 4 - Scaduti e "Segna fatto" (Priority: P2)

Il proprietario, dopo qualche giorno di assenza, scrive `/scaduti` e vede i compleanni degli ultimi 7 giorni con esito diverso da *fatto*. Aprendo la scheda trova il pulsante "Segna fatto" per correggere l'esito.

**Why this priority**: completa la correzione degli esiti prevista da BR-08, oggi possibile solo dal recupero.

**Independent Test**: con occorrenze *saltato*, *non confermato* e *fatto* negli ultimi 7 giorni e una *saltato* di 8 giorni fa, inviare `/scaduti`, aprire le schede e premere "Segna fatto".

**Acceptance Scenarios**:

1. **Given** che sono stato in vacanza, **When** scrivo `/scaduti`, **Then** vedo chi ho saltato o non confermato e posso aprirne la scheda per segnarlo come fatto. *(RF-21)*
2. **Given** un'occorrenza *saltato* di 3 giorni fa, **When** apro la scheda, **Then** vedo il pulsante "Segna fatto"; premendolo l'occorrenza diventa *fatto* e lo storico si aggiorna. *(RF-21, BR-08)*
3. **Given** un'occorrenza *fatto* negli ultimi 7 giorni, **Then** non compare in `/scaduti` e la scheda non mostra "Segna fatto". *(RF-21, BR-08)*
4. **Given** un'occorrenza *saltato* di 8 giorni fa, **Then** non compare in `/scaduti` e la scheda non mostra "Segna fatto". *(RF-21, BR-08)*
5. **Given** che nessuna occorrenza degli ultimi 7 giorni è diversa da *fatto*, **When** scrivo `/scaduti`, **Then** il bot dice che non c'è nulla in sospeso. *(RF-21)*
6. **Given** che l'occorrenza di ieri di Anna è ancora aperta, **When** scrivo `/scaduti`, **Then** Anna compare come "in attesa"; premendo "Segna fatto" dalla sua scheda l'occorrenza diventa *fatto* e il recupero non parte. *(RF-21, BR-07, chiarimento 2026-10-28)*
7. **Given** che oggi è il compleanno di Luca e l'occorrenza è aperta, **When** scrivo `/scaduti`, **Then** Luca non compare. *(RF-21, chiarimento 2026-10-28)*

---

### User Story 5 - Persone di un gruppo e compleanni del mese (Priority: P2)

Il proprietario consulta tutte le persone di un gruppo con `/gruppo <nome>` e i compleanni di un mese con `/mese [mese]`.

**Why this priority**: viste di consultazione utili ma meno frequenti di `/prossimi`.

**Independent Test**: con gruppi e compleanni in mesi diversi, inviare `/gruppo lavoro`, `/mese`, `/mese marzo`, `/mese 3` e varianti non valide.

**Acceptance Scenarios**:

1. **Given** che scrivo `/gruppo lavoro`, **Then** vedo tutte le persone del gruppo, ordinate per prossimo compleanno. *(RF-19)*
2. **Given** che il gruppo indicato non esiste, **Then** il bot lo segnala ed elenca i gruppi esistenti. *(RF-19, come RF-17)*
3. **Given** che scrivo `/mese marzo`, **Then** vedo tutti i compleanni di marzo ordinati per giorno. *(RF-20)*
4. **Given** che scrivo `/mese 3`, **Then** ottengo lo stesso risultato di `/mese marzo`. *(RF-20)*
5. **Given** che scrivo `/mese` senza argomenti, **Then** vedo i compleanni del mese corrente. *(RF-20)*
6. **Given** che oggi è il 28/10/2026 e Sara (nata il 05/10/1990) ha già compiuto gli anni, **When** scrivo `/mese ottobre`, **Then** la riga mostra "Lun 05/10  Sara (36)". *(RF-20, chiarimento 2026-10-28)*
7. **Given** che oggi è il 28/10/2026, **When** scrivo `/mese marzo`, **Then** giorno della settimana ed età si riferiscono a marzo 2027. *(RF-20, chiarimento 2026-10-28)*

---

### User Story 6 - Riepilogo dell'anno (Priority: P3)

Il proprietario scrive `/anno` (o `/anno 2025`) e riceve il riepilogo degli esiti: quanti *fatto*, *saltato* e *non confermato*, l'elenco dei saltati e le persone saltate per 2 o più anni consecutivi.

**Why this priority**: è una vista di bilancio, non serve all'operatività quotidiana.

**Independent Test**: con uno storico su più anni, inviare `/anno`, `/anno 2025` e un anno senza dati, e verificare conteggi ed elenchi.

**Acceptance Scenarios**:

1. **Given** che nel 2025 ho 40 *fatto*, 3 *saltato* e 2 *non confermato*, **When** scrivo `/anno 2025`, **Then** vedo i tre conteggi e l'elenco dei 3 saltati. *(RF-22)*
2. **Given** che Luca è *saltato* nel 2024 e nel 2025, **When** scrivo `/anno 2025`, **Then** Luca compare tra le persone saltate per 2 o più anni consecutivi. *(RF-22)*
3. **Given** che scrivo `/anno` senza argomenti, **Then** vedo il riepilogo dell'anno corrente. *(RF-22)*
4. **Given** che Giulia è *non confermato* nel 2024 e *saltato* nel 2025, **When** scrivo `/anno 2025`, **Then** Giulia è tra i saltati ma non tra le persone saltate per 2 o più anni consecutivi. *(RF-22, BR-09, chiarimento 2026-10-28)*
5. **Given** che Paolo è *saltato* nel 2023 e nel 2024 e *fatto* nel 2025, **When** scrivo `/anno 2025`, **Then** Paolo non compare tra le persone saltate per 2 o più anni consecutivi. *(RF-22, chiarimento 2026-10-28)*

---

### Edge Cases

- `/prossimi` con giorni non validi (0, negativi, oltre 366): il bot segnala l'intervallo ammesso (1–366) e non mostra la lista. *(RF-17)*
- `/prossimi famiglia` senza numero: il primo argomento non numerico è il gruppo, con i giorni al default di 30. *(RF-17)*
- `/prossimi`, `/gruppo`, `/mese` senza risultati: il bot dice che non ci sono compleanni nel periodo, nel gruppo o nel mese. *(RF-17, RF-19, RF-20)*
- `/gruppo` o `/cerca` senza argomento: il bot indica la sintassi del comando; `/gruppo` elenca anche i gruppi esistenti. *(RF-18, RF-19)*
- `/mese` con un mese non riconosciuto (es. "marzzo", "13"): il bot lo segnala e indica che il mese si scrive per nome o numero (1–12). *(RF-20)*
- `/anno` con un anno non valido o futuro: il bot lo segnala. Un anno valido senza esiti mostra conteggi a zero. *(RF-22)*
- Nessuna persona registrata: `/oggi` non indica alcun prossimo compleanno e lo dice. *(RF-16)*
- Più persone con il prossimo compleanno nello stesso giorno: `/oggi` le indica tutte. *(RF-16)*
- Persona nata il 29/02: nelle liste la data mostrata resta 29/02; negli anni non bisestili la posizione nell'ordinamento e il giorno della settimana sono quelli della data effettiva 28/02; `/oggi` la mostra il 28/02 con "(compleanno il 29/02)". *(feature 002, FR-012)*
- "Segna fatto" premuto dopo i 7 giorni dalla data effettiva, o su un'occorrenza già *fatto*: l'esito non cambia e il bot risponde "Questa azione non è più disponibile". *(BR-08, feature 002 FR-016)*
- `/oggi` o `/scaduti` riferiti a una persona eliminata nel frattempo: un pulsante premuto risponde "Persona non trovata". *(feature 001)*
- Lista con circa 200 persone che supera la lunghezza massima di un messaggio Telegram: la lista è divisa in più messaggi consecutivi, senza pulsanti di paginazione. *(RNF-16, RNF-14)*

## Requirements *(mandatory)*

### Functional Requirements

**Formato delle liste**

- **FR-001** *(§4.4, §5.7)*: Tutte le liste MUST essere testuali, con una riga per persona: giorno della settimana abbreviato, data `gg/mm`, nickname (o nome completo se manca), età che compirà tra parentesi (solo se l'anno di nascita è noto) e comando `/p_<id>`. Esempio: `Gio 30/10  Anna (28)      /p_4`.
- **FR-001a** *(§5.7, chiarimento 2026-10-28)*: Giorno della settimana, data, nome ed età MUST essere mostrati in monospazio e allineati in colonna; il comando `/p_<id>` MUST restare fuori dal monospazio, così resta toccabile.
- **FR-002** *(§4.4)*: Salvo diversa indicazione, le liste MUST essere ordinate per prossimo compleanno, a partire da oggi. `/scaduti` e gli elenchi di `/anno` MUST essere ordinati per data dell'occorrenza, crescente (chiarimento 2026-10-28).
- **FR-003** *(§5.7)*: Ogni lista MUST iniziare con un'intestazione che descrive la vista e gli eventuali filtri (es. "Prossimi 30 giorni (Famiglia)"), seguita da una riga vuota. In `/mese` le righe sono in ordine di giorno; nelle altre viste la lista è continua.
- **FR-004** *(RNF-14)*: Le liste MUST NOT contenere pulsanti; la navigazione verso le schede MUST usare i comandi `/p_<id>` nel testo. I pulsanti MUST essere usati solo per le azioni.
- **FR-005** *(RNF-16)*: Le liste MUST essere mostrate senza paginazione con circa 100-200 persone. Se una lista supera la lunghezza massima di un messaggio, MUST essere divisa in più messaggi consecutivi, ciascuno con righe intere.

**`/oggi`**

- **FR-006** *(RF-16)*: `/oggi` MUST inviare, per ogni persona con data effettiva oggi, lo stesso messaggio del reminder del giorno (feature 002, FR-024), con i pulsanti di contatto e, se l'occorrenza è aperta, Fatto ✅ e Salta quest'anno; se l'occorrenza è chiusa, il messaggio MUST mostrare l'esito come il reminder aggiornato (feature 002, FR-025).
- **FR-007** *(RF-16, BR-07)*: Fatto e Salta quest'anno premuti su un messaggio di `/oggi` MUST avere gli stessi effetti dei pulsanti del reminder. I messaggi di `/oggi` MUST NOT contare come slot inviati e MUST NOT modificare la pianificazione dei promemoria.
- **FR-007a** *(RF-16, chiarimento 2026-10-28)*: Con più di 10 compleanni oggi, `/oggi` MUST inviare i primi 10 come in FR-006 e le persone restanti in un unico messaggio nel formato di FR-001.
- **FR-008** *(RF-16)*: Se oggi non ci sono compleanni, `/oggi` MUST dirlo e indicare il prossimo compleanno (tutte le persone di quel giorno) nel formato di FR-001.

**`/prossimi`**

- **FR-009** *(RF-17)*: `/prossimi [giorni] [gruppo]` MUST mostrare i compleanni con data effettiva in un intervallo di N giorni che comprende oggi, da oggi a oggi + N − 1 (N = 30 di default, minimo 1, massimo 366), ordinati per prossimo compleanno (chiarimento 2026-10-28).
- **FR-010** *(RF-17)*: Il filtro per gruppo è opzionale; il nome del gruppo MUST essere confrontato senza distinzione tra maiuscole e minuscole. Se il gruppo non esiste, il bot MUST segnalarlo ed elencare i gruppi esistenti.
- **FR-011** *(RF-17)*: Un numero di giorni fuori dall'intervallo 1–366 MUST essere rifiutato indicando l'intervallo ammesso.

**`/cerca`**

- **FR-012** *(RF-18)*: `/cerca <testo>` MUST trovare le persone il cui nome completo o nickname contiene il testo, senza distinzione tra maiuscole e minuscole e ignorando gli accenti (chiarimento 2026-10-28).
- **FR-013** *(RF-18)*: Con un solo risultato il bot MUST aprire direttamente la scheda (come `/p_<id>`); con più risultati MUST mostrare la lista (FR-001…FR-003); senza risultati MUST dire che non ci sono risultati.

**`/gruppo`**

- **FR-014** *(RF-19)*: `/gruppo <nome>` MUST mostrare tutte le persone del gruppo, ordinate per prossimo compleanno. Il nome MUST essere confrontato senza distinzione tra maiuscole e minuscole; se il gruppo non esiste, il bot MUST segnalarlo ed elencare i gruppi esistenti.

**`/mese`**

- **FR-015** *(RF-20)*: `/mese [mese]` MUST mostrare tutti i compleanni del mese indicato, ordinati per giorno; senza argomento MUST usare il mese corrente. Il mese MUST essere accettato per nome italiano (senza distinzione tra maiuscole e minuscole) o per numero da 1 a 12; un valore diverso MUST essere rifiutato indicando i formati ammessi. Per il mese corrente e i mesi successivi dell'anno, giorno della settimana ed età MUST riferirsi all'anno corrente (per i giorni già passati, l'età compiuta); per i mesi già conclusi, all'anno prossimo (chiarimento 2026-10-28).

**`/scaduti` e "Segna fatto"**

- **FR-016** *(RF-21)*: `/scaduti` MUST mostrare, nel formato di FR-001, le occorrenze con data effettiva negli ultimi 7 giorni (da oggi − 7 a ieri) ed esito diverso da *fatto* (*saltato*, *non confermato* o ancora aperta, indicata come "in attesa"), con l'esito attuale indicato sulla riga; l'età è quella compiuta in quell'occorrenza. I compleanni di oggi MUST NOT comparire: restano in `/oggi` (chiarimento 2026-10-28).
- **FR-017** *(RF-21, BR-08)*: La scheda di una persona MUST mostrare il pulsante "Segna fatto" se ha un'occorrenza con data effettiva negli ultimi 7 giorni ed esito diverso da *fatto*. Premendolo, l'occorrenza MUST diventare *fatto*, la scheda MUST aggiornarsi (storico compreso) e il pulsante MUST scomparire. Se l'occorrenza era aperta, la chiusura annulla i promemoria successivi, recupero compreso (BR-07).
- **FR-018** *(BR-08)*: *Fatto* MUST NOT tornare indietro. "Segna fatto" premuto oltre i 7 giorni dalla data effettiva o su un'occorrenza già *fatto* MUST NOT cambiare l'esito e il bot MUST rispondere "Questa azione non è più disponibile".

**`/anno`**

- **FR-019** *(RF-22)*: `/anno [anno]` MUST mostrare, per l'anno indicato (default: corrente), il numero di occorrenze *fatto*, *saltato* e *non confermato*; l'elenco delle persone *saltato* nel formato di FR-001; l'elenco delle persone con esito *saltato* nell'anno indicato e nell'anno immediatamente precedente (serie di 2 o più anni consecutivi che termina nell'anno indicato); un *non confermato* o un anno senza occorrenza interrompe la serie (chiarimento 2026-10-28). Le occorrenze ancora aperte MUST NOT essere conteggiate.

### Key Entities *(include if feature involves data)*

- **Persona** *(AFU §8, feature 001)*: usata in lettura (nome, nickname, data di nascita, gruppi) per liste, ricerca e scheda.
- **Gruppo** *(AFU §8, feature 001)*: usato come filtro in `/prossimi` e `/gruppo`.
- **Occorrenza** *(AFU §8, feature 002)*: letta da `/oggi`, `/scaduti`, `/anno` e dalla scheda; modificata da "Segna fatto" e dai pulsanti di `/oggi`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-16…22)*: Il 100% dei criteri di accettazione Dato/Quando/Allora dei requisiti inclusi è verificato da almeno un test.
- **SC-002** *(RNF-16)*: Con 200 persone registrate, `/prossimi 366` e `/gruppo` restituiscono la lista completa, senza righe mancanti né paginazione.
- **SC-003** *(RF-18)*: Il proprietario raggiunge la scheda di una persona con un solo comando quando la ricerca dà un solo risultato, o con un tocco su `/p_<id>` dalla lista.
- **SC-004** *(RF-21, BR-08)*: Da `/scaduti` il proprietario corregge un esito in *fatto* in non più di due tocchi (`/p_<id>`, "Segna fatto").
- **SC-005** *(RNF-14)*: Nessuna lista contiene pulsanti.

## Assumptions

- La data e il giorno della settimana di ogni riga sono quelli del prossimo compleanno; l'età è quella che la persona compirà in quel compleanno. Fanno eccezione `/scaduti` (occorrenza passata, età compiuta) e `/mese` (FR-015).
- Tra le due opzioni di §5.7 per `/mese` (per settimana o in ordine di giorno) si adotta l'ordine di giorno, coerente con RF-20.
- In `/prossimi` gli argomenti sono posizionali: un primo argomento numerico è il numero di giorni, il resto è il nome del gruppo (che può contenere spazi).
- La finestra di `/scaduti` (FR-016) coincide con quella di BR-08, fino a D+7 compreso (feature 002).
- Il riepilogo di `/anno` usa le etichette dello storico (*fatto*, *saltato*, *non confermato*) già definite nella feature 002.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
