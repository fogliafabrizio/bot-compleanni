# Feature Specification: Revisioni v1.3 — Mezzanotte e profili incompleti

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-3-mezzanotte-incompleti\". Fonte unica: docs/AFU.md v1.3, sezioni \"Registro modifiche\" e \"Impatto della versione 1.3\", aree Promemoria (§7, RF-10, RNF-19 regola \"00:00\") e Viste (RF-50, RF-32, RF-28, RNF-14, RNF-19 icona 📝) (REV-012, REV-013). Il bot è già implementato (specs da 001 a 009): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione (nessuna conversione; lo slot delle 00:00 vale dal primo compleanno successivo al deploy, senza invii retroattivi per le occorrenze già aperte; invii già registrati invariati ma mostrati con \"00:00\" in /stato; profili incompleti calcolati sui dati attuali; messaggi di /statistiche già inviati senza il nuovo pulsante). Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.3 (fonte di verità funzionale): Registro modifiche (REV-012, REV-013), "Impatto della versione 1.3", testi v1.3 di glossario (Slot, Profilo incompleto), §7 (profili di priorità), RF-10, RF-28, RF-32, RF-50, RNF-14, RNF-19, §5.1, §5.7, §5.11, §5.13, decisioni D-02 e D-34, alternative scartate v1.3. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica), 002 (promemoria-esiti), 003 (viste-ricerche), 005 (revisioni-v1-1-gruppi), 007 (revisioni-v1-1-stato-statistiche), 008 (revisioni-v1-1-stile) e 009 (revisioni-v1-2-navigazione); tutto ciò che non è citato qui resta come definito in quelle spec. Le spec 004 (import, export e backup) e 006 (scheda e contatti) non cambiano.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-012 | Slot delle 00:00 per la priorità Alta | Glossario "Slot", §7, RF-10, RNF-19 (regola "00:00"), D-02 |
| REV-013 | Profili incompleti | RF-50, RF-32, RF-28, RNF-14, RNF-19 (icona 📝), glossario "Profilo incompleto", §5.1, §5.7, §5.11, §5.13, D-34 |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 002 | FR-001 | Il profilo Alta ha lo slot delle 00:00 come primo reminder del giorno | §7, RF-10, D-02 |
| 002 | FR-023 | Per la priorità Alta il primo reminder del giorno parte alle 00:00 della data effettiva | RF-10 |
| 002 | SC-003 | Alta lasciata senza risposta: 3 pre-reminder + 5 reminder + 1 recupero | §7 |
| 007 | FR-006, FR-009 | Gli orari di `/stato` e dell'avviso di buco scrivono la mezzanotte "00:00" | RNF-19 |
| 008 | FR-009 | Nuova icona 📝 sul pulsante [📝 Profili incompleti]; pulsanti dei filtri senza icona | RNF-19 |
| 008 | FR-002 | Nuova emoji di sezione 📝 per le intestazioni di `/incomplete` | RNF-19 |
| 008 | FR-004a | I nuovi testi entrano nel punto unico dei testi e nel suo inventario | RNF-15, RNF-19 |
| 005 | FR-012; 001 FR-031; 003 FR-004 | Seconda eccezione ai "pulsanti solo per le azioni": i 5 filtri di `/incomplete` | RNF-14 |
| 009 | FR-016 | Nuovo punto di passo successivo: `/statistiche` ([📝 Profili incompleti]) | RNF-14, RF-32 |
| 007 | FR-013 | `/statistiche` termina con [📝 Profili incompleti]; "Senza anno di nascita" e "Senza contatti" contano come mancanti anche i valori vuoti o di soli spazi | RF-32, RF-50 |
| 001 | FR-025; 007 FR-016 | `/aiuto` e il menu dei comandi includono `/incomplete [campo]` | RF-28, §5.1 |
| 003 | Perimetro, FR-001, FR-002, FR-005 | Nuova vista `/incomplete [campo]` con liste nel formato §5.7, senza gruppi | RF-50, §5.7, §5.13 |

**Fuori da questa feature** (alternative scartate v1.3): attendere RF-40 (profili configurabili) per aggiungere le 00:00; pre-reminder di −1 giorno alle 23:00 al posto dello slot delle 00:00; slot delle 00:00 solo per chi ha telefono o Telegram; combinazioni di filtri e filtro per gruppo in `/incomplete`; conteggi di `/statistiche` cliccabili; gruppi nella riga delle liste di `/incomplete`; "Senza gruppo" tra i filtri di `/incomplete`; pulsanti sulle righe e pulsanti di passo successivo nelle liste di `/incomplete`.

## Clarifications

### Session 2026-11-06

- Q: RNF-19 prescrive "H:MM", ma gli esempi v1.3 scrivono "01:00" e "02:00": come si scrivono le ore notturne diverse dalla mezzanotte? → A: Restano "H:MM" senza zero iniziale ("1:00", "2:00"), come oggi; cambia solo la mezzanotte, scritta "00:00". Gli esempi "01:00" e "02:00" dell'AFU vanno letti come "1:00" e "2:00". *(FR-007)*
- Q: Per una persona Alta inserita poco prima o poco dopo la mezzanotte del compleanno, cosa decide se lo slot delle 00:00 parte? → A: L'istante dello slot è le 00:00:00 della data effettiva: parte se la persona è stata creata prima di quell'istante (es. alle 23:30 del giorno prima; è inserita "prima", quindi il recupero vale anche senza reminder inviati); se è creata alle 00:00:00 o dopo non parte, anche se l'esecuzione delle 00:00 gira qualche secondo dopo. *(FR-004, BR-10)*
- Q: Oltre alle 5 parole esatte, `/incomplete` deve accettare varianti come `telefoni`, `ig` o `contatto`? → A: No: solo `telefono`, `instagram`, `telegram`, `anno`, `contatti` (senza distinzione tra maiuscole e minuscole); ogni variante è un argomento non riconosciuto (errore + pulsanti). `/incomplete@nomebot <campo>` vale come `/incomplete <campo>`. *(FR-011)*
- Q: Un telefono, username o anno salvato in produzione come testo vuoto o di soli spazi conta come dato mancante? → A: Sì, sia nei 5 filtri di `/incomplete` sia nei conteggi "Senza anno di nascita" e "Senza contatti" di `/statistiche`, con la stessa regola; nessuna conversione dei dati. *(FR-008, FR-017)*
- Q: Quando una lista di `/incomplete` è spezzata in più messaggi, l'intestazione deve stare solo sul primo messaggio? → A: Sì: intestazione solo sul primo; i successivi contengono solo righe intere, come le altre liste (spec 003 FR-005). *(FR-012)*
- Q: Se una persona Alta ha già ricevuto il reminder delle 00:00 e passa a Media alle 8:00 dello stesso giorno, cosa succede agli slot rimanenti? → A: Il reminder delle 00:00 resta registrato com'è; da quel momento valgono gli slot Media ancora futuri (9:00, 13:00, 18:00) e il recupero come oggi. *(FR-004, BR-12)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auguri allo scoccare della mezzanotte per le persone Alta (Priority: P1)

Per le persone con priorità Alta il proprietario riceve il reminder del giorno alle 00:00 della data effettiva, per fare gli auguri allo scoccare del compleanno; se lo chiude subito, non riceve gli altri slot.

**Why this priority**: è il punto 1 dell'ordine di realizzazione consigliato (effort S) e la richiesta che serve subito (D-02, alternativa scartata "Attendere RF-40").

**Independent Test**: con una persona Alta e una Media che compiono gli anni lo stesso giorno, simulare le esecuzioni orarie dalle 00:00 alle 21:00 e verificare l'invio delle 00:00 alla sola persona Alta, il suo contenuto, l'effetto di Fatto, il nuovo tentativo dopo un errore, e la riga in `/stato` di un invio abbandonato.

**Acceptance Scenarios**:

1. **Given** che Marco ha priorità Alta e compie gli anni il 14/03, **When** sono le 00:00 del 14/03, **Then** ricevo il reminder del giorno con notifica sonora, i pulsanti di contatto, Fatto e Salta quest'anno. *(RF-10)*
2. **Given** che premo Fatto sul reminder delle 00:00, **Then** non ricevo gli slot delle 9:00, 13:00, 18:00 e 21:00 né il recupero. *(RF-10, BR-07)*
3. **Given** che non chiudo il reminder delle 00:00, **Then** alle 9:00 ricevo il reminder successivo, come oggi. *(RF-10)*
4. **Given** che Anna ha priorità Media, **When** è il giorno del suo compleanno, **Then** alle 00:00 non parte nulla e il primo reminder arriva alle 9:00. *(RF-10, §7)*
5. **Given** che l'invio delle 00:00 fallisce per un errore di Telegram, **Then** viene ritentato alle 1:00 e alle esecuzioni successive della stessa giornata. *(RF-10, N-03)*
6. **Given** che inserisco una persona con priorità Alta alle 10:00 del giorno del suo compleanno, **Then** lo slot delle 00:00 non parte. *(RF-10, BR-10, BR-11)*
7. **Given** che Anna ha priorità Alta ed è nata il 29/02, **When** l'anno non è bisestile, **Then** il reminder delle 00:00 parte alle 00:00 del 28/02. *(RF-10, BR-04)*
8. **Given** che il reminder delle 00:00 di Marco è stato abbandonato, **When** scrivo `/stato`, **Then** leggo "Marco, reminder delle 00:00 del 14/03". *(RNF-19)*
9. **Given** che il cron non ha girato tra le 23:00 e le 02:00, **Then** l'avviso di buco indica "dalle 23:00 alle 2:00"; se un estremo è la mezzanotte, è scritto "00:00". *(RNF-19, N-06; formato chiarito il 2026-11-06)*

---

### User Story 2 - Elenco dei profili incompleti con `/incomplete` (Priority: P1)

Il proprietario vede quante persone non hanno ciascun dato facoltativo (telefono, Instagram, Telegram, anno di nascita, nessun contatto) e, con un tocco o un argomento, ne apre la lista per completare le schede, partendo da chi festeggia prima.

**Why this priority**: punto 2 dell'ordine di realizzazione (effort M); con i dati reali è lo strumento per completare le schede, soprattutto i telefoni che abilitano WhatsApp (D-34).

**Independent Test**: con una rubrica di prova in cui mancano dati diversi a persone diverse, scrivere `/incomplete` e verificare pulsanti e conteggi; premere ogni filtro e scrivere `/incomplete <campo>` con argomenti validi, in maiuscolo e non validi; verificare ordinamento, formato delle righe, lista vuota, rubrica vuota e spezzatura in più messaggi.

**Esempio (AFU §5.13)**:

```
Tu:  /incomplete
Bot: 📝 Profili incompleti
     Quale dato manca?
     [Telefono (41)]        [Instagram (60)]
     [Telegram (80)]        [Anno di nascita (23)]
     [Nessun contatto (30)]
Tu:  [Telefono (41)]
Bot: 📝 Senza telefono · 41 persone

     Ven 13/11  Anna (28)      /p_4
     Dom 22/11  Paolo (41)     /p_23
     Gio 03/12  Giulia         /p_9
     …
Tu:  /incomplete anno
Bot: ✅ Tutte le persone hanno l'anno di nascita.
```

**Acceptance Scenarios**:

1. **Given** che 41 persone non hanno il telefono, **When** scrivo `/incomplete`, **Then** vedo i 5 pulsanti con i rispettivi conteggi, tra cui [Telefono (41)]. *(RF-50)*
2. **Given** che premo [Telefono (41)], **Then** ricevo un nuovo messaggio "📝 Senza telefono · 41 persone" con le righe ordinate per prossimo compleanno e i comandi `/p_<id>`, e il messaggio con i pulsanti resta com'era. *(RF-50, RNF-14)*
3. **Given** che scrivo `/incomplete instagram`, **Then** ricevo subito la lista delle persone senza username Instagram, senza passare dai pulsanti. *(RF-50)*
4. **Given** che scrivo `/incomplete Anno`, **Then** ricevo la lista delle persone senza anno di nascita. *(RF-50)*
5. **Given** che scrivo `/incomplete email`, **Then** il bot segnala che il filtro non esiste e mostra i pulsanti dei filtri. *(RF-50)*
6. **Given** che Marco ha l'Instagram ma non il telefono né il Telegram, **Then** compare nelle liste Telefono e Telegram ma non in Nessun contatto. *(RF-50)*
7. **Given** che tutte le persone hanno il telefono, **When** premo [Telefono (0)], **Then** il bot risponde "✅ Tutte le persone hanno il telefono.". *(RF-50)*
8. **Given** che apro `/p_<id>` da una lista e aggiungo il telefono con Modifica, **When** riscrivo `/incomplete telefono`, **Then** quella persona non compare più. *(RF-50, RF-04)*
9. **Given** che la lista supera la lunghezza di un messaggio Telegram, **Then** è spezzata in più messaggi, come le altre liste. *(RF-50)*

---

### User Story 3 - Dai conteggi di `/statistiche` ai profili incompleti (Priority: P2)

Dai conteggi "Senza anno di nascita" e "Senza contatti" di `/statistiche` il proprietario raggiunge con un tocco i filtri dei profili incompleti, senza scrivere il comando; trova `/incomplete` anche in `/aiuto` e nel menu dei comandi.

**Why this priority**: punto 2 dell'ordine di realizzazione; rende scopribile la nuova vista lasciando `/statistiche` "solo conteggi" (D-34).

**Independent Test**: scrivere `/statistiche` con rubrica popolata e vuota, verificare il pulsante in fondo e il nuovo messaggio al tocco; scrivere `/aiuto` e verificare la riga di `/incomplete`; verificare il menu dei comandi dopo il rilascio.

**Acceptance Scenarios**:

1. **Given** che scrivo `/statistiche`, **Then** in fondo vedo [📝 Profili incompleti] e il tocco mi manda i pulsanti dei filtri, come `/incomplete`. *(RF-32, RNF-14)*
2. **Given** che la rubrica è vuota, **Then** il pulsante compare comunque e i filtri mostrano 0. *(RF-32)*
3. **Given** che scrivo `/statistiche`, **Then** i conteggi "Senza anno di nascita" e "Senza contatti" restano testo, senza elenchi né pulsanti. *(RF-32)*
4. **Given** che scrivo `/aiuto`, **Then** tra le viste trovo `/incomplete [campo]` con la descrizione di §5.1; i pulsanti di `/start` non cambiano. *(RF-28, §5.1)*

---

### Edge Cases

- Fatto o Salta quest'anno premuto su un pre-reminder o sul reminder delle 00:00: nessun altro slot della giornata né recupero, come per gli altri slot. *(RF-10, BR-07)*
- Cambio di priorità da Media ad Alta dopo le 00:00 del giorno del compleanno: lo slot delle 00:00 è già passato e non parte; valgono gli slot Alta futuri. Cambio da Alta a Media prima delle 00:00: lo slot delle 00:00 non parte. Cambio da Alta a Media dopo l'invio delle 00:00 (es. alle 8:00): l'invio delle 00:00 resta registrato; partono gli slot Media ancora futuri (9:00, 13:00, 18:00) e il recupero come oggi. *(BR-12; chiarito il 2026-11-06)*
- Esecuzione oraria delle 00:00 ripetuta: il reminder delle 00:00 arriva una sola volta (slot distinto dagli altri). *(N-02)*
- Esecuzione oraria delle 00:00 non avvenuta per un malfunzionamento della piattaforma: lo slot non si recupera; alle 9:00 parte il reminder successivo. *(N-04)*
- Invio delle 00:00 con esito sconosciuto (esecuzione interrotta tra invio e registrazione): non si ritenta, come oggi (spec 002, FR-006). *(N-03)*
- Più di 40 invii previsti alle 00:00: gli eccedenti partono alle esecuzioni successive della stessa giornata (spec 002, FR-003). *(N-01)*
- Recupero di una persona Alta con il solo reminder delle 00:00 inviato e poi abbandonati gli altri: il recupero segue le regole attuali (spec 002, FR-018, FR-030). *(BR-11)*
- Persona Alta inserita il giorno del compleanno alle 00:30 (o alle 00:00:00 o dopo, anche prima che giri l'esecuzione delle 00:00): lo slot delle 00:00 non parte; il recupero parte solo se un reminder della giornata è stato inviato. *(BR-10, BR-11; chiarito il 2026-11-06)*
- Persona Alta inserita la sera prima del compleanno dopo le 13:00 (es. alle 23:30): non riceve il pre-reminder di −1 giorno; l'occorrenza nasce con l'esecuzione delle 00:00 e lo slot delle 00:00 parte. È inserita prima del giorno del compleanno: il recupero segue spec 002 FR-018 per questo caso. *(BR-10, BR-11; chiarito il 2026-11-06)*
- Notte del cambio d'ora: avviene alle 2-3 e non tocca lo slot delle 00:00. *(BR-24)*
- `/oggi` premuto dopo l'invio delle 00:00: si comporta come oggi e non conta come slot (spec 003, FR-007). *(RF-16)*
- `/incomplete` con argomento seguito da altro testo o con più parole (es. `/incomplete telefono famiglia`): argomento non riconosciuto, il bot lo segnala e mostra i pulsanti. *(RF-50, D-34)*
- Argomento con maiuscole o spazi iniziali e finali (`/incomplete  TELEFONO `): riconosciuto. *(RF-50)*
- Argomento variante (`/incomplete telefoni`, `/incomplete ig`, `/incomplete contatto`): non riconosciuto, il bot lo segnala e mostra i pulsanti. *(RF-50; chiarito il 2026-11-06)*
- Filtro con 0 persone: il pulsante compare comunque, es. [Telegram (0)]. *(RF-50)*
- Telefono o username salvato come testo vuoto o di soli spazi (es. da un vecchio import o ripristino): la persona compare nella lista del filtro e, se le mancano tutti e tre i contatti, in Nessun contatto e nel conteggio "Senza contatti" di `/statistiche`; il dato salvato non viene modificato. *(RF-50, RF-32; chiarito il 2026-11-06)*
- Rubrica vuota: i 5 pulsanti compaiono con 0; il tocco su un filtro o `/incomplete <campo>` dice che non ci sono persone. *(RF-50)*
- Pulsante di un filtro premuto su un messaggio vecchio: la lista usa i dati attuali, anche se il numero sul pulsante è diverso. *(RF-50)*
- Persona eliminata dopo l'invio di una lista: la lista già inviata resta com'era; `/p_<id>` risponde come oggi (spec 001, FR-012a). *(RF-50)*
- Persona senza anno di nascita in una lista: la riga non ha l'età, come nel formato §5.7 (spec 003, FR-001). *(RF-50, §5.7)*
- Persona senza alcun gruppo: compare nelle liste come le altre; "Senza gruppo" non è un filtro. *(RF-50, D-34)*
- Lista di `/incomplete` spezzata in più messaggi: intestazione solo sul primo, nessun pulsante su alcun messaggio. *(RF-50, RNF-14; chiarito il 2026-11-06)*
- [📝 Profili incompleti] premuto durante un flusso guidato o un filtro premuto durante un flusso guidato: si comporta come il comando `/incomplete` in quella situazione (spec 001, FR-018). *(RNF-14)*
- `/incomplete` durante un flusso guidato: interrompe il flusso senza salvare, come ogni altro comando esistente (spec 001, FR-018). *(RF-50)*
- Pulsanti di `/incomplete` o di `/statistiche` premuti da un utente diverso dal proprietario: nessuna risposta (spec 001, FR-027). *(RF-30)*

## Requirements *(mandatory)*

### Functional Requirements

**Slot delle 00:00 per la priorità Alta** *(modifica spec 002 FR-001, FR-023, SC-003)*

- **FR-001** *(§7, RF-10, D-02, glossario "Slot"; modifica 002 FR-001)*: Il profilo di priorità Alta MUST avere come slot del giorno 00:00 · 9:00 · 13:00 · 18:00 · 21:00. I profili Media e Bassa e i pre-reminder e il recupero di tutti i profili MUST restare invariati. Lo slot MUST essere definito nello stesso punto unico delle altre costanti dei profili (spec 002 FR-001, RNF-18).
- **FR-002** *(RF-10; modifica 002 FR-023)*: Per le persone con priorità Alta, finché l'occorrenza è aperta, il primo reminder del giorno MUST partire alle 00:00 della data effettiva in ora locale Europe/Rome; per chi è nato il 29/02, negli anni non bisestili, alle 00:00 del 28/02 (BR-04).
- **FR-003** *(RF-10)*: Il reminder delle 00:00 MUST essere uno slot a tutti gli effetti: stesso contenuto e stessi pulsanti degli altri reminder (spec 002, FR-024, FR-026), notifica sonora come gli altri, stessi effetti di Fatto e Salta quest'anno (spec 002, FR-025: nessun altro slot né recupero).
- **FR-004** *(RF-10, N-02, N-03, BR-10, BR-11, BR-12, N-04; conferma 002 FR-005, FR-006, FR-007, FR-017, FR-018)*: Per lo slot delle 00:00 MUST valere senza eccezioni: l'idempotenza, con lo slot distinto dagli altri; il nuovo tentativo entro la stessa giornata, anche nelle ore notturne (dalle 1:00); nessun recupero di uno slot perso per malfunzionamento; nessun invio retroattivo per persone inserite o per priorità cambiate dopo le 00:00. L'istante dello slot MUST essere le 00:00:00 della data effettiva, non l'ora in cui gira l'esecuzione: lo slot parte solo per le persone create prima di quell'istante.
- **FR-005** *(RF-10, RF-31)*: Gli invii dello slot delle 00:00 MUST essere registrati e contati in `/stato` come gli altri reminder (spec 007, FR-009, FR-010).
- **FR-006** *(§7; modifica 002 SC-003)*: Un'occorrenza Alta lasciata senza risposta MUST produrre 3 pre-reminder, 5 reminder del giorno e 1 recupero.

**Scrittura della mezzanotte** *(modifica spec 007 FR-006, FR-009; spec 008 FR-018)*

- **FR-007** *(RNF-19; modifica 007 FR-006, FR-009)*: Ovunque compaia un orario (reminder, `/stato` per ultimo controllo orario e invii abbandonati, avviso di buco del cron), la mezzanotte MUST essere scritta "00:00", mai "0:00". Esempio: "Marco, reminder delle 00:00 del 14/03"; "Ultimo controllo orario: oggi alle 00:00". Le ore piene diverse dalla mezzanotte MUST restare nel formato "H:MM", senza zero iniziale, come oggi (es. "1:00", "2:00", "9:00"): l'avviso di buco tra le 23:00 e le 2:00 indica "dalle 23:00 alle 2:00".

**Profili incompleti: `/incomplete [campo]`** *(nuova vista; modifica spec 003 Perimetro)*

- **FR-008** *(RF-50, glossario "Profilo incompleto")*: Il sistema MUST offrire il comando `/incomplete [campo]` con 5 filtri fissi, separati e usati uno alla volta, in quest'ordine:

  | Filtro (pulsante) | Argomento | Persone elencate |
  |---|---|---|
  | Telefono | `telefono` | senza telefono |
  | Instagram | `instagram` | senza username Instagram |
  | Telegram | `telegram` | senza username Telegram |
  | Anno di nascita | `anno` | senza anno di nascita |
  | Nessun contatto | `contatti` | senza telefono, senza Instagram e senza Telegram (stessa definizione del conteggio "Senza contatti" di spec 007 FR-013) |

  Un dato MUST contare come mancante se è assente oppure salvato come testo vuoto o di soli spazi (dati anomali già in produzione); la stessa regola MUST valere per tutti i 5 filtri e per i conteggi di FR-017. Un profilo incompleto MUST NOT avere legami con la priorità. MUST NOT esistere combinazioni di filtri, filtri per gruppo o un filtro "Senza gruppo".
- **FR-009** *(RF-50, RNF-14, §5.13)*: Senza argomento il bot MUST mostrare l'intestazione "📝 Profili incompleti", la domanda "Quale dato manca?" e un pulsante per filtro, nell'ordine di FR-008, con il numero di persone calcolato al momento: "Telefono (41)". I filtri con 0 persone MUST comparire comunque.
- **FR-010** *(RF-50, RNF-14)*: Il tocco su un filtro MUST inviare un nuovo messaggio con la lista di quel filtro, calcolata con i dati attuali al momento del tocco (il numero sul pulsante non conta); il messaggio con i pulsanti MUST NOT essere modificato.
- **FR-011** *(RF-50)*: Con un argomento, senza distinzione tra maiuscole e minuscole, il bot MUST mandare subito la lista del filtro corrispondente. Gli argomenti validi MUST essere solo le 5 parole della colonna "Argomento" di FR-008: varianti, plurali e sinonimi (`telefoni`, `ig`, `contatto`) MUST essere trattati come non riconosciuti. La forma `/incomplete@nomebot <campo>` MUST valere come `/incomplete <campo>`. Con un argomento non riconosciuto MUST segnalarlo (errore, spec 008 FR-004) e mostrare i pulsanti dei filtri come in FR-009.
- **FR-012** *(RF-50, §5.7, §5.13; estende 003 FR-001, FR-002, FR-005)*: La lista MUST avere l'intestazione con il filtro e il numero di persone ("📝 Senza telefono · 41 persone") e le righe nel formato delle liste (spec 003, FR-001) con il comando `/p_<id>`, senza i gruppi, ordinate per prossimo compleanno a partire da oggi. Una lista lunga MUST essere spezzata in più messaggi come le altre liste (spec 003 FR-005): l'intestazione MUST stare solo sul primo messaggio e i successivi MUST contenere solo righe intere. La lista MUST NOT avere pulsanti sulle righe né pulsanti di passo successivo.
- **FR-013** *(RF-50)*: Se nessuna persona corrisponde al filtro, il bot MUST confermare che il dato è presente per tutti (conferma, spec 008 FR-004), es. "✅ Tutte le persone hanno il telefono.", "✅ Tutte le persone hanno l'anno di nascita.". Se la rubrica è vuota MUST dire invece che non ci sono persone.
- **FR-014** *(RF-50, RF-04)*: Il completamento di una scheda MUST avvenire con la Modifica per campo esistente (spec 001 FR-014, spec 006); `/incomplete` MUST NOT offrire altri modi di modifica.

**Navigazione** *(modifica spec 005 FR-012, 001 FR-031, 003 FR-004, 009 FR-016)*

- **FR-015** *(RNF-14; modifica 005 FR-012, 001 FR-031, 003 FR-004)*: Oltre ai gruppi, anche i 5 filtri di `/incomplete` MUST potersi scegliere con pulsanti. Le liste che ne risultano MUST restare testuali, senza pulsanti.
- **FR-016** *(RF-32, RNF-14; modifica 007 FR-013, 009 FR-016)*: In fondo al messaggio di `/statistiche` MUST comparire il pulsante di passo successivo [📝 Profili incompleti], anche con la rubrica vuota. Il tocco MUST inviare un nuovo messaggio identico a `/incomplete` senza argomento (FR-009); il messaggio di `/statistiche` MUST NOT essere modificato. Se `/statistiche` è spezzata in più messaggi, il pulsante MUST stare sull'ultimo. `/statistiche` si aggiunge ai punti di passo successivo di spec 009 FR-016, con al massimo 2 pulsanti per vista.
- **FR-017** *(RF-32, D-34; modifica 007 FR-013)*: I conteggi "Senza anno di nascita" e "Senza contatti" di `/statistiche` MUST restare testo, senza elenchi né pulsanti, e MUST usare la regola del dato mancante di FR-008 (valori vuoti o di soli spazi contano come mancanti), così da coincidere con i filtri Anno di nascita e Nessun contatto; le altre sezioni di spec 007 FR-013 e di spec 009 restano invariate.

**Comandi** *(modifica spec 001 FR-025, 007 FR-016)*

- **FR-018** *(RF-28, §5.1; modifica 001 FR-025, 007 FR-016)*: `/aiuto` e il menu dei comandi registrato su Telegram MUST includere `/incomplete [campo]` tra le viste, con la descrizione di §5.1. Il menu MUST essere aggiornato dopo il rilascio senza passi manuali, con il meccanismo di spec 005 FR-014. I pulsanti di `/start` MUST NOT cambiare.

**Icone e testi** *(modifica spec 008 FR-002, FR-009, FR-004a)*

- **FR-019** *(RNF-19; modifica 008 FR-002, FR-009)*: 📝 MUST essere l'emoji di sezione dei profili incompleti, nelle intestazioni di `/incomplete` e delle sue liste, e l'icona del pulsante [📝 Profili incompleti] di `/statistiche`. I pulsanti dei filtri ([Telefono (N)] …) MUST NOT avere emoji, come quelli dei gruppi.
- **FR-020** *(RNF-15, RNF-19; modifica 008 FR-004a)*: Tutti i nuovi testi (intestazioni, domanda, pulsanti, conferme di lista vuota, rubrica vuota, errore di argomento non riconosciuto, descrizione in `/aiuto`, nuova scrittura della mezzanotte) MUST stare nel punto unico dei testi ed essere classificati nel suo inventario con la regola del loro tipo.

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.3")*

- **FR-021**: Il rilascio MUST NOT richiedere nuove entità, nuovi attributi o conversioni dei dati esistenti. Lo slot delle 00:00 è un nuovo valore del riferimento dell'Invio (slot 0), già ammesso; i profili incompleti si calcolano dai campi facoltativi già presenti.
- **FR-022** *(RF-10, BR-10)*: Le persone con priorità Alta MUST ricevere lo slot delle 00:00 dal primo compleanno successivo al deploy. Per le occorrenze già aperte al momento del deploy (anche nel giorno del compleanno) MUST partire solo gli slot ancora futuri, senza invii retroattivi delle 00:00.
- **FR-023** *(RNF-19, RF-31)*: Gli invii già registrati MUST NOT essere modificati; in `/stato` gli orari della mezzanotte MUST comparire come "00:00" anche per i dati già registrati prima del rilascio (ultima esecuzione del cron, invii abbandonati).
- **FR-024** *(RF-50)*: I profili incompleti MUST lavorare subito sui dati attuali, senza preparazione dei dati.
- **FR-025** *(RF-32, RNF-14)*: I messaggi di `/statistiche` già inviati prima del rilascio MUST NOT essere aggiornati e restano senza il nuovo pulsante; i messaggi già inviati (reminder, `/stato`, avvisi) MUST NOT essere riscritti con il nuovo formato della mezzanotte.

### Key Entities *(include if feature involves data)*

- **Profilo di priorità** *(AFU §7, spec 002)*: costante; il profilo Alta acquisisce lo slot delle 00:00.
- **Invio** *(AFU §8, spec 002)*: nessun nuovo attributo; il riferimento "slot" assume anche il valore 0 (mezzanotte).
- **Profilo incompleto** *(AFU glossario)*: non è un dato salvato; è una Persona a cui manca almeno uno tra telefono, username Instagram, username Telegram e anno di nascita, calcolata al momento.
- **Persona** *(spec 001)*: nessun nuovo attributo; letta per i filtri di `/incomplete`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-10, RF-28, RF-32, RF-50, RNF-14, RNF-19)*: Il 100% dei criteri di accettazione Dato/Quando/Allora v1.3 dei requisiti inclusi è verificato da almeno un test; i criteri delle spec 001-009 continuano a passare, salvo quelli esplicitamente modificati qui.
- **SC-002** *(§7)*: Per un'occorrenza lasciata senza risposta, il numero di messaggi corrisponde al profilo: Alta 3 pre-reminder + 5 reminder + 1 recupero; Media 1 + 3 + 1; Bassa 0 + 2 + 1.
- **SC-003** *(RF-10, N-02)*: Ripetendo più volte l'esecuzione delle 00:00, ogni reminder delle 00:00 arriva esattamente una volta, e solo alle persone Alta.
- **SC-004** *(RNF-19)*: In nessun testo del bot compare "0:00" come orario della mezzanotte.
- **SC-005** *(RF-50)*: I conteggi dei 5 filtri e il contenuto delle liste coincidono al 100% con quelli calcolati a mano su una rubrica di prova; il conteggio "Nessun contatto" coincide con "Senza contatti" di `/statistiche`.
- **SC-006** *(RF-32, RF-50)*: Da `/statistiche` il proprietario arriva alla lista di un filtro con 2 tocchi, senza scrivere comandi.
- **SC-007** *(Impatto v1.3)*: Dopo il rilascio, il 100% dei dati in produzione (persone, occorrenze, invii registrati, messaggi già inviati) resta identico a prima.

## Assumptions

- Le spec 001-009 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto vale questa spec (AFU v1.3).
- Il testo del reminder non contiene oggi l'orario dello slot: la regola "00:00" vale per i reminder solo se e dove un orario compare nel loro testo.
- `/incomplete` accetta un solo argomento; spazi iniziali e finali sono ignorati, testo aggiuntivo rende l'argomento non riconosciuto.
- La lista "Anno di nascita" elenca le persone senza anno; le persone con un anno fuori da BR-02 già presenti in produzione restano fuori dalla lista (hanno un anno), a differenza della sezione Età di spec 009.
- I pulsanti dei filtri sono disposti due per riga come nel mockup §5.13, con "Nessun contatto" sull'ultima riga.
- I nuovi pulsanti di `/incomplete` e [📝 Profili incompleti] si aggiungono al contratto dei pulsanti senza cambiare forma o significato dei pulsanti esistenti; quelli già in chat continuano a funzionare.
- I testi seguono i mockup §5.1, §5.11 e §5.13; i testi definitivi stanno nel punto unico dei testi (RNF-15).
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
