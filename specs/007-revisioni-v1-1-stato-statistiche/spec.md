# Feature Specification: Revisioni v1.1 — Stato e statistiche

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-1-stato-statistiche\". Fonte unica: docs/AFU.md v1.1, sezioni \"Registro modifiche\" e \"Impatto della versione 1.1\", area Stato e statistiche: RF-31, RF-32, N-06 e i dati tecnici delle Impostazioni in §8 (REV-007). Il bot è già implementato (specs da 001 a 006): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione (dati tecnici vuoti al primo deploy, esclusione da backup e ripristino). Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.1 (fonte di verità funzionale): Registro modifiche (REV-007), "Impatto della versione 1.1", testi v1.1 di RF-31, RF-32, N-06, §2 (attore Scheduler), §5.1, §7 (Altri invii programmati), §8 (Impostazioni), decisioni D-28 e D-29, mockup §5.10, §5.11 e §5.12. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica), 002 (promemoria-esiti), 003 (viste-ricerche), 004 (import-export-backup) e 005 (revisioni-v1-1-gruppi); tutto ciò che non è citato qui resta come definito in quelle spec.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-007 | Stato e statistiche | RF-31, RF-32, N-06, §8 Impostazioni (dati tecnici), §5.1, §5.10-5.12, D-28, D-29 |

**Comandi aggiunti (da AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/statistiche` | Statistiche della rubrica e andamento | RF-32 |
| `/stato` | Salute di cron, invii, backup e webhook | RF-31 |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 002 | FR-003 | A ogni esecuzione oraria il sistema registra l'ora dell'esecuzione | N-06, RF-31, §8 |
| 002 | FR-007 | Lo slot perso resta non recuperato, ma alla ripartenza dopo un'interruzione di oltre 2 ore parte un avviso di buco | N-06, D-28 |
| 002 | Key Entities (Impostazioni) | Le Impostazioni ricevono i dati tecnici: ultima esecuzione del cron, data ed esito dell'ultimo backup mensile | §8 |
| 003 | Perimetro (comandi), FR-019 | Nuovi comandi `/stato` e `/statistiche`; `/anno` resta il dettaglio del singolo anno | RF-31, RF-32, D-29 |
| 004 | FR-022, FR-023a | Ogni tentativo di backup mensile registra data ed esito | RF-31, §8 |
| 004 | FR-017, FR-025 | Il backup (su richiesta e mensile) non contiene i dati tecnici | §8 |
| 004 | FR-018, FR-020 | Il ripristino non modifica i dati tecnici | §8 |
| 001 | FR-025; 005 FR-014 | `/aiuto` e il menu dei comandi mostrano `/statistiche` e `/stato` | §5.1 |

**Fuori da questa feature**: le altre revisioni v1.1 (REV-001 guida di stile RNF-19, REV-002 e REV-005 scheda e contatti, REV-003 e REV-004 gruppi, REV-006); il recupero degli slot persi durante un buco del cron (resta escluso da N-04); RF-50 "schede incomplete" (`/statistiche` dà solo conteggi, senza elenchi).

## Clarifications

### Session 2026-10-29

- Q: Quale ora registra il ciclo come "ultima esecuzione", e quando, se l'esecuzione può fallire a metà? → A: l'ora piena prevista dell'esecuzione, registrata all'inizio del ciclo insieme al controllo del buco, prima degli invii; un'esecuzione che fallisce dopo resta registrata.
- Q: Come si misura la soglia "più di 2 ore" al cambio d'ora: ore reali trascorse o differenza dell'orologio locale? → A: ore reali trascorse tra le due ore piene previste; l'avviso parte da 3 ore reali in su; gli orari dell'avviso sono mostrati in ora locale Europe/Rome.
- Q: Nella stessa esecuzione l'avviso va prima o dopo i promemoria, e cosa succede se Telegram lo rifiuta? → A: prima dei promemoria dell'ora, fuori dal limite di invii per esecuzione; un solo tentativo, se fallisce si perde e gli invii proseguono.
- Q: Come si mostrano in `/stato` gli invii rimasti "in invio" (promemoria e backup mensile)? → A: promemoria "in invio" di un'esecuzione precedente contati tra gli abbandonati, quelli dell'ora corrente non contati; backup mensile rimasto "in invio" mostrato con data, ora ed "esito sconosciuto" ⚠️; ogni errore intercettato del backup mensile, anche non di Telegram, registrato come ❌ non riuscito.
- Q: In `/statistiche` si mostrano le priorità con zero persone e si contano le persone senza gruppo? → A: le tre priorità sempre, anche a 0; in fondo alla riga dei gruppi "Senza gruppo N", solo se N > 0.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stato di salute del bot (Priority: P1)

Il proprietario scrive `/stato` per sapere se il bot sta funzionando: quando ha girato l'ultima volta il controllo orario, quanti promemoria sono partiti, falliti o abbandonati, com'è andato l'ultimo backup mensile e se Telegram segnala errori sul webhook.

**Why this priority**: un cron fermo non può avvisare da solo (D-28); `/stato` è l'unico modo per verificare su richiesta che i promemoria stiano partendo.

**Independent Test**: con uno storico di invii noto (inviati, falliti, abbandonati, oggi e nei giorni precedenti), un backup mensile registrato e uno no, e con la lettura del webhook riuscita e non riuscita, scrivere `/stato` e verificare ogni riga.

**Esempio (AFU §5.10)**:

```
🩺 Stato del bot
⏱ Ultimo controllo orario: oggi alle 15:00
📨 Oggi: 3 inviati, 0 falliti, 0 abbandonati
📨 Ultimi 7 giorni: 21 inviati, 0 falliti, 1 abbandonato
   – Luca, reminder delle 18:00 del 25/10
💾 Ultimo backup mensile: 01/10 alle 9:00 ✅
🔗 Webhook: nessun errore, 0 update in coda
```

**Acceptance Scenarios**:

1. **Given** che il cron gira regolarmente e oggi sono partiti 3 reminder, **When** scrivo `/stato`, **Then** vedo l'ultima esecuzione dell'ora corrente e "Oggi: 3 inviati, 0 falliti, 0 abbandonati". *(RF-31)*
2. **Given** che un reminder di ieri è stato abbandonato dopo i tentativi (N-03), **When** scrivo `/stato`, **Then** lo vedo nella riga degli ultimi 7 giorni con il nome della persona. *(RF-31)*
3. **Given** che il bot è appena stato aggiornato e il cron non ha ancora girato, **When** scrivo `/stato`, **Then** l'ultimo controllo orario risulta "mai registrato". *(RF-31)*
4. **Given** che dopo il rilascio non c'è ancora stato un backup mensile, **When** scrivo `/stato`, **Then** la riga del backup mensile riporta "mai registrato". *(RF-31, §8)*
5. **Given** che l'ultimo tentativo di backup mensile è fallito per un errore di Telegram, **When** scrivo `/stato`, **Then** vedo la data e l'ora del tentativo con l'esito negativo. *(RF-31)*
6. **Given** che Telegram riporta un errore recente sul webhook e 2 update in coda, **When** scrivo `/stato`, **Then** la riga del webhook mostra data e testo dell'ultimo errore e "2 update in coda". *(RF-31)*
7. **Given** che la lettura dello stato del webhook da Telegram non riesce, **When** scrivo `/stato`, **Then** vedo tutte le altre righe e la sola riga del webhook segnata come non disponibile. *(RF-31)*

---

### User Story 2 - Avviso di buco del cron (Priority: P1)

Se il controllo orario si ferma per più di 2 ore, alla ripartenza il bot avvisa il proprietario dell'intervallo scoperto e lo invita a controllare `/oggi` e `/scaduti`, perché alcuni promemoria potrebbero essere andati persi.

**Why this priority**: è l'unico segnale automatico di un malfunzionamento della piattaforma; senza, uno slot perso (N-04) passa inosservato.

**Independent Test**: simulare esecuzioni orarie con un'ultima ora registrata alle 14:00 e la successiva alle 15:00, alle 16:00 e alle 19:00; simulare la prima esecuzione senza ora registrata; verificare quando parte l'avviso e il suo testo.

**Esempio (AFU §5.12)**:

```
⚠️ Il controllo orario non è girato dalle 14:00 alle 19:00 di oggi:
alcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.
```

**Acceptance Scenarios**:

1. **Given** che il cron ha girato alle 14:00 e poi di nuovo solo alle 19:00, **When** gira alle 19:00, **Then** ricevo un avviso che indica il buco tra le 14:00 e le 19:00. *(N-06)*
2. **Given** che il cron gira ogni ora regolarmente, **Then** nessun avviso parte. *(N-06)*
3. **Given** che non c'è ancora un'ora registrata (prima esecuzione dopo il deploy), **When** il cron gira, **Then** l'avviso non parte e l'ora viene registrata. *(N-06, §8)*
4. **Given** che è partito l'avviso alle 19:00, **When** il cron gira alle 20:00, **Then** non parte un secondo avviso. *(N-06)*
5. **Given** che dopo un buco il cron riparte, **Then** gli slot persi non vengono inviati; partono solo gli invii previsti per l'ora corrente, i ritentativi della giornata e il recupero del backup mensile, come prima. *(N-06, N-04)*

---

### User Story 3 - Statistiche della rubrica (Priority: P2)

Il proprietario scrive `/statistiche` per avere poche cifre sulla rubrica (quante persone, per priorità, per gruppo, per mese, quante schede senza anno o senza contatti) e sull'andamento degli auguri fatti anno per anno.

**Why this priority**: utile ma non critico per il funzionamento dei promemoria; il dettaglio di un anno resta in `/anno` (D-29).

**Independent Test**: con una rubrica di composizione nota (priorità, gruppi, mesi, persone senza anno e senza contatti) e uno storico su più anni, scrivere `/statistiche` e verificare ogni cifra; ripetere senza storico e con rubrica vuota.

**Esempio (AFU §5.11)**:

```
📊 Statistiche
112 persone · Alta 18 · Media 70 · Bassa 24
Gruppi: Famiglia 8 · Lavoro 5 · Beach tennis 6 · …
Senza anno di nascita: 23 · Senza contatti: 41

🎂 Compleanni per mese
Gen ████████  11
Feb █████      7
…
✅ Auguri fatti: 2026 87% · 2025 81%
```

**Acceptance Scenarios**:

1. **Given** che ho 112 persone, **When** scrivo `/statistiche`, **Then** vedo il totale, le suddivisioni per priorità, per gruppo e per mese, i conteggi delle schede senza anno e senza contatti, e la percentuale di *fatto* per anno. *(RF-32)*
2. **Given** che non c'è ancora uno storico, **When** scrivo `/statistiche`, **Then** la sezione sull'andamento dice che non ci sono ancora anni con esiti. *(RF-32)*
3. **Given** che Marco è nei gruppi Famiglia e Lavoro, **When** scrivo `/statistiche`, **Then** Marco è contato sia in Famiglia sia in Lavoro, e una sola volta nel totale. *(RF-32)*
4. **Given** che a marzo non compie gli anni nessuno, **When** scrivo `/statistiche`, **Then** l'istogramma ha comunque 12 righe e la riga di marzo ha conteggio 0. *(RF-32)*

---

### Edge Cases

- Ultima esecuzione del cron di un giorno diverso da oggi: la riga di `/stato` riporta anche la data. *(RF-31)*
- Esecuzione oraria in corso mentre arriva `/stato`: vale l'ultima ora registrata in quel momento; i promemoria di quell'esecuzione ancora "in invio" non sono contati. *(RF-31)*
- Nessun abbandonato negli ultimi 7 giorni: nessuna riga di dettaglio sotto il conteggio. *(RF-31)*
- Abbandonato di un pre-reminder o di un recupero: la riga di dettaglio riporta il tipo del promemoria (pre-reminder con i giorni prima, reminder con lo slot, recupero) e la data. *(RF-31)*
- Invio rimasto con esito sconosciuto (esecuzione interrotta tra l'invio e la registrazione, spec 002 FR-006): non viene ritentato ed è contato tra gli abbandonati. *(RF-31, N-03)*
- Invio fallito di una giornata conclusa: è già abbandonato (spec 002, FR-006) e compare tra gli abbandonati, non tra i falliti. *(RF-31, N-03)*
- Persona eliminata (spec 001, FR-017): i suoi invii non compaiono più in `/stato`, come il resto dello storico. *(RF-31)*
- `/oggi`, `/backup`, backup mensile e avviso di buco non sono promemoria e non entrano nei conteggi degli invii. *(RF-31; spec 003, FR-007)*
- Backup mensile ritentato più volte (spec 004, FR-023a): `/stato` mostra l'ultimo tentativo, con la sua data e il suo esito. `/backup` su richiesta non modifica la riga. *(RF-31)*
- Webhook senza errori registrati da Telegram: "nessun errore" con il numero di update in coda. *(RF-31)*
- Buco di esattamente 2 ore (es. esecuzioni alle 14:00 e alle 16:00, saltata quella delle 15:00): nessun avviso; l'avviso parte solo oltre le 2 ore. *(N-06)*
- Buco a cavallo della mezzanotte o di più giorni: l'avviso indica inizio e fine con le rispettive date. *(N-06)*
- Buco a cavallo del cambio d'ora: la soglia si misura in ore reali, quindi le esecuzioni regolari non danno avvisi (passaggio all'ora legale 1:00 → 3:00 locali = 1 ora reale; ritorno all'ora solare con le 2:00 ripetute = 1 ora reale tra le due). L'intervallo è indicato in ora locale Europe/Rome (spec 002, FR-002). *(N-06)*
- Invio dell'avviso di buco fallito per un errore di Telegram: non viene ritentato; l'ora viene aggiornata comunque. *(N-06)*
- Esecuzione oraria ripetuta nella stessa ora: non genera un avviso, perché l'ora registrata è recente. *(N-06, N-02)*
- Esecuzione partita ma interrotta durante gli invii: l'ora è già registrata, quindi all'esecuzione successiva non parte l'avviso; gli invii rimasti con esito sconosciuto compaiono in `/stato` tra gli abbandonati (FR-010), quelli mai reclamati non sono recuperati (N-04). *(N-06, RF-31)*
- Rubrica vuota: `/statistiche` mostra 0 persone, i conteggi a zero, l'istogramma con 12 righe a zero e la sezione sull'andamento senza anni. *(RF-32)*
- Nessun gruppo: la riga dei gruppi lo dice al posto dell'elenco (senza la voce "Senza gruppo"). *(RF-32)*
- Gruppo senza persone: compare con 0. *(RF-32)*
- Priorità senza persone (es. nessuna Alta): compare con 0. *(RF-32)*
- Persone senza alcun gruppo: contate in "Senza gruppo N" in fondo alla riga dei gruppi; con N = 0 la voce non compare. *(RF-32)*
- Persona nata il 29/02: conta in febbraio. *(RF-32, BR-04)*
- Anno con sole occorrenze aperte: non compare nell'andamento, perché non ha occorrenze chiuse. *(RF-32)*
- Anno con occorrenze tutte *saltato* o *non confermato*: compare con 0%. *(RF-32)*
- `/stato` o `/statistiche` durante un flusso guidato: interrompono il flusso e vengono eseguiti, come ogni comando esistente (spec 001, FR-018). *(§5.1)*
- `/stato` o `/statistiche` da un utente diverso dal proprietario: nessuna risposta (spec 001, FR-027). *(RF-30)*
- Ripristino di un backup creato prima del rilascio: avviene come prima; i dati tecnici restano quelli attuali. *(§8)*

## Requirements *(mandatory)*

### Functional Requirements

**Dati tecnici delle Impostazioni** *(modifica spec 002 Key Entities, spec 004 FR-017, FR-018, FR-020, FR-025)*

- **FR-001** *(§8, N-06, RF-31)*: Le Impostazioni MUST conservare, oltre al messaggio di default, i dati tecnici: ora dell'ultima esecuzione del cron; data, ora ed esito dell'ultimo backup mensile. Ciascun dato MUST poter essere "non registrato".
- **FR-002** *(§8; modifica 004 FR-017, FR-025)*: I file di backup, su richiesta (`/backup`) e mensili, MUST NOT contenere i dati tecnici.
- **FR-003** *(§8; modifica 004 FR-018, FR-020)*: Il ripristino MUST NOT modificare i dati tecnici: sostituisce le impostazioni limitatamente al messaggio di default. Un file di backup che contenesse dati tecnici MUST essere accettato come prima, ignorandoli.

**Registrazione dell'esecuzione oraria e avviso di buco** *(modifica spec 002 FR-003, FR-007)*

- **FR-004** *(N-06; modifica 002 FR-003)*: A ogni esecuzione oraria il sistema MUST registrare come ultima esecuzione del cron l'ora piena prevista dell'esecuzione (non l'istante reale di avvio). La registrazione MUST avvenire all'inizio del ciclo, insieme al controllo di FR-005 e prima degli invii; un'esecuzione che fallisce dopo la registrazione (es. guasto durante gli invii) MUST restare registrata e MUST NOT generare un avviso all'esecuzione successiva.
- **FR-005** *(N-06, D-28; modifica 002 FR-007)*: A ogni esecuzione oraria, se tra l'ora registrata e l'ora piena prevista dell'esecuzione corrente sono trascorse più di 2 ore reali (cioè almeno 3, misurate indipendentemente dal cambio d'ora), il sistema MUST inviare al proprietario un solo avviso con l'intervallo scoperto (dall'ora registrata all'ora corrente) e l'invito a controllare `/oggi` e `/scaduti`, come nel mockup AFU §5.12. Se non c'è un'ora registrata, l'avviso MUST NOT partire.
- **FR-006** *(N-06)*: L'intervallo dell'avviso MUST essere espresso in ora locale (spec 002, FR-002), con "di oggi" quando inizio e fine cadono oggi e con le date quando cadono in giorni diversi.
- **FR-007** *(N-06, N-04)*: L'avviso MUST NOT recuperare gli slot persi né modificare la pianificazione: gli invii dell'esecuzione restano quelli di spec 002 e del backup mensile (spec 004, FR-023a). L'avviso MUST essere inviato prima dei promemoria della stessa esecuzione e MUST NOT contare nel limite di invii per esecuzione. Un errore nell'invio dell'avviso MUST NOT impedire gli altri invii (spec 002, FR-008) e l'avviso MUST NOT essere ritentato: va perso, e l'ora registrata (FR-004) resta aggiornata.

**Backup mensile** *(modifica spec 004 FR-022, FR-023a)*

- **FR-008** *(RF-31; modifica 004 FR-022, FR-023a)*: Ogni tentativo di invio del backup mensile MUST registrare data, ora ed esito (riuscito o non riuscito), sostituendo il dato precedente. Ogni errore intercettato durante il tentativo, di Telegram o di altra natura (es. generazione del file), MUST essere registrato come non riuscito; la ripetizione del tentativo resta quella di spec 004 FR-023a. Se il tentativo si interrompe prima di registrare l'esito, `/stato` MUST mostrarne data e ora con "esito sconosciuto" ⚠️. Il backup su richiesta (`/backup`) MUST NOT modificare il dato.

**`/stato`** *(nuovo comando; modifica spec 003 Perimetro)*

- **FR-009** *(RF-31)*: `/stato` MUST mostrare, nell'ordine e con il layout del mockup AFU §5.10:
  - l'ora dell'ultima esecuzione del cron, con la data se non è di oggi;
  - gli invii di oggi e quelli degli ultimi 7 giorni, ciascuno con il numero di inviati, falliti (in attesa di nuovo tentativo) e abbandonati;
  - sotto la riga degli ultimi 7 giorni, una riga per ogni abbandonato con nickname (o nome completo se manca), tipo di promemoria con il riferimento (giorni prima o slot) e data;
  - data, ora ed esito dell'ultimo backup mensile;
  - lo stato del webhook letto da Telegram: data e testo dell'ultimo errore, oppure "nessun errore", e numero di update in coda.
- **FR-010** *(RF-31)*: Gli invii contati sono i promemoria registrati (pre-reminder, reminder, recupero; spec 002, Key Entities). Gli ultimi 7 giorni MUST comprendere oggi e i 6 giorni precedenti. Un invio con esito sconosciuto (spec 002, FR-006), cioè rimasto "in invio" da un'esecuzione di un'ora precedente, MUST essere contato tra gli abbandonati; un invio "in invio" dell'ora corrente (esecuzione in corso) MUST NOT essere contato.
- **FR-011** *(RF-31, §8)*: Un dato non ancora registrato (ultima esecuzione del cron, ultimo backup mensile) MUST comparire come "mai registrato".
- **FR-012** *(RF-31)*: Se la lettura dello stato del webhook da Telegram non riesce, `/stato` MUST mostrare comunque tutte le altre righe, con la sola riga del webhook segnata come non disponibile.

**`/statistiche`** *(nuovo comando; modifica spec 003 Perimetro e FR-019)*

- **FR-013** *(RF-32, D-29)*: `/statistiche` MUST mostrare, con il layout del mockup AFU §5.11:
  - il totale delle persone, con la suddivisione per priorità (Alta, Media, Bassa), dove le tre priorità compaiono sempre, anche con 0;
  - la suddivisione per gruppo, con tutti i gruppi in ordine alfabetico (come l'elenco gruppi, spec 005 FR-001), dove una persona in più gruppi conta in ciascuno; in fondo alla riga, "Senza gruppo N" con il numero di persone senza alcun gruppo, solo se N > 0;
  - il numero di persone senza anno di nascita e il numero di persone senza alcun contatto (né telefono, né username Instagram, né username Telegram), solo come conteggi, senza elenchi;
  - i compleanni per mese, come istogramma testuale di 12 righe (da gennaio a dicembre), ciascuna con il mese abbreviato, una barra proporzionale al conteggio e il conteggio;
  - la percentuale di *fatto* sul totale delle occorrenze chiuse (*fatto*, *saltato*, *non confermato*), per ciascun anno con almeno un'occorrenza chiusa, dal più recente, arrotondata all'intero.
- **FR-014** *(RF-32)*: Senza anni con occorrenze chiuse, la sezione sull'andamento MUST dire che non ci sono ancora anni con esiti.
- **FR-015** *(RF-32, D-29)*: `/statistiche` MUST NOT duplicare il riepilogo di `/anno` (spec 003, FR-019, invariato): nessun elenco di persone.

**Comandi e vincoli comuni** *(modifica spec 001 FR-025 e spec 005 FR-014)*

- **FR-016** *(§5.1; modifica 001 FR-025 e 005 FR-014)*: `/aiuto` e il menu dei comandi registrato su Telegram MUST includere `/statistiche` e `/stato` con le descrizioni di §5.1. Il menu MUST essere aggiornato dopo il rilascio senza passi manuali, con il meccanismo di spec 005 FR-014.
- **FR-017** *(RNF-17, RNF-16)*: `/stato`, `/statistiche` e l'esecuzione oraria con la registrazione e l'avviso MUST restare entro 10 ms di CPU con circa 200 persone e il relativo storico; l'attesa della lettura dello stato del webhook da Telegram non conta.
- **FR-018** *(RNF-08)*: L'avviso di buco e i dati tecnici MUST NOT comportare log con dati personali in chiaro.

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.1")*

- **FR-019**: Il rilascio MUST NOT richiedere nuove entità, modifiche di struttura delle entità esistenti o conversioni dei dati esistenti; le Impostazioni ricevono solo i nuovi dati tecnici (FR-001).
- **FR-020** *(§8, N-06, RF-31)*: Al primo deploy i dati tecnici MUST nascere vuoti: `/stato` mostra "mai registrato" per l'ultima esecuzione del cron fino alla prima esecuzione oraria dopo il deploy e per l'ultimo backup mensile fino al primo tentativo di backup mensile dopo il deploy; l'avviso di FR-005 MUST NOT partire alla prima esecuzione dopo il deploy.
- **FR-021** *(RF-31, RF-32)*: Lo storico di invii e occorrenze già presente MUST essere usato da `/stato` e `/statistiche` così com'è, senza conversioni: gli invii dei 7 giorni precedenti il rilascio compaiono nei conteggi.
- **FR-022** *(§8)*: I backup creati prima del rilascio MUST restare ripristinabili come prima (spec 004, FR-025), senza effetti sui dati tecnici (FR-003).
- **FR-023**: Il messaggio di auguri di default, i messaggi personalizzati e i messaggi già inviati MUST NOT essere modificati.

### Key Entities *(include if feature involves data)*

- **Impostazioni** *(AFU §8; modifica spec 002 Key Entities)*: messaggio di auguri di default; dati tecnici: ora dell'ultima esecuzione del cron; data, ora ed esito dell'ultimo backup mensile. I dati tecnici nascono vuoti, non entrano nel backup e il ripristino non li modifica.
- **Invio** *(AFU §8, spec 002)*: nessun nuovo attributo; letto da `/stato` per data, tipo, riferimento ed esito.
- **Persona, Gruppo, Appartenenza, Occorrenza** *(AFU §8, spec 001 e 002)*: nessun nuovo attributo; lette da `/statistiche`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-31, RF-32, N-06)*: Il 100% dei criteri di accettazione Dato/Quando/Allora dei requisiti inclusi è verificato da almeno un test; i criteri delle spec 001-006 continuano a passare.
- **SC-002** *(RF-31)*: Con un solo comando il proprietario sa se il controllo orario, gli invii, il backup mensile e il webhook funzionano, anche quando la lettura del webhook non riesce.
- **SC-003** *(N-06)*: Ogni interruzione del controllo orario di oltre 2 ore produce esattamente un avviso alla prima esecuzione successiva; con esecuzioni regolari non parte nessun avviso.
- **SC-004** *(RF-32)*: Le cifre di `/statistiche` coincidono al 100% con i conteggi calcolati a mano su una rubrica di prova.
- **SC-005** *(§8)*: Dopo un ripristino i dati tecnici sono identici a prima, e nessun file di backup li contiene.
- **SC-006** *(Impatto v1.1)*: Dopo il rilascio, il 100% dei dati in produzione (persone, gruppi, occorrenze, invii, messaggi) resta identico a prima.

## Assumptions

- Le spec 001-006 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto vale questa spec (AFU v1.1).
- "Più vecchia di 2 ore" si valuta sulle ore piene previste delle esecuzioni (N-05), in ore reali trascorse: 14:00 → 16:00 non dà avviso, 14:00 → 17:00 sì; i ritardi di pochi minuti della piattaforma non generano avvisi.
- L'avviso di buco è un singolo tentativo: se Telegram lo rifiuta non viene ritentato, per non ripeterlo alle esecuzioni successive; `/stato` resta il controllo su richiesta.
- "Ultimi 7 giorni" in `/stato` comprende oggi (oggi e i 6 giorni precedenti); i conteggi delle due righe si sovrappongono per la giornata di oggi.
- Un invio con esito sconosciuto è contato tra gli abbandonati, perché non viene ritentato e il proprietario deve verificarlo con `/oggi` o `/scaduti`.
- L'esito del backup mensile è "riuscito" o "non riuscito"; la riga di `/stato` usa ✅ e ❌ come nel mockup e nella guida di stile (RNF-19), e ⚠️ "esito sconosciuto" per un tentativo interrotto prima della registrazione.
- L'istogramma ha una larghezza massima fissa, assegnata al mese con più compleanni; un mese con almeno un compleanno ha almeno un blocco, un mese senza compleanni ha la barra vuota.
- I testi seguono i mockup §5.10-5.12; l'applicazione della guida di stile RNF-19 agli altri testi è fuori da questa feature.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
