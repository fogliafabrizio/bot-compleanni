# AFU — Bot Telegram Compleanni

**Analisi Funzionale** · versione 1.0 · 28/10/2026
Committente e unico utente MVP: Fabrizio

---

## 1. Obiettivo e contesto

Un bot Telegram personale che conserva i compleanni delle persone importanti e ricorda all'utente di fare gli auguri. L'insistenza dei promemoria è proporzionata alla priorità della persona. Ogni promemoria permette di scrivere alla persona con un tocco (WhatsApp con testo precompilato, Instagram, Telegram) e di chiudere il promemoria indicando l'esito.

Oggi le date sono annotate a mano su un'agenda cartacea: il bot deve sostituirla. L'onboarding iniziale (oltre 100 persone) avviene tramite import CSV.

Il progetto deve avere **costo zero**. Architettura prevista: Cloudflare Workers (TypeScript, webhook) + D1 (SQLite) + un Cron Trigger orario, sul piano free.

In v2 il progetto diventa un repository pubblico, che chiunque può installare come proprio bot personale.

## 2. Attori e perimetro

### Attori
| Attore | Descrizione |
|---|---|
| **Proprietario** | L'unico utente autorizzato, identificato dal suo ID Telegram. Usa tutte le funzioni. |
| **Utente estraneo** | Chiunque altro scriva al bot. Può usare solo `/id`; tutto il resto viene ignorato in silenzio. |
| **Scheduler** | Il Cron Trigger orario, che genera pre-reminder, reminder, recuperi, passaggi di stato e backup mensili. |
| **Telegram** | Recapita i messaggi al bot via webhook e invia i messaggi del bot. |

### In scope (MVP)
- Anagrafica persone con contatti, gruppi, priorità e messaggio di auguri personalizzato
- Gestione gruppi
- Pre-reminder, reminder del giorno e recupero del giorno dopo, secondo profili di priorità
- Esiti annuali (fatto / saltato / non confermato) e storico
- Viste: oggi, prossimi, ricerca, gruppo, mese, scaduti, riepilogo annuale
- Import CSV, export CSV, backup/ripristino JSON, backup automatico mensile
- Sicurezza: whitelist del proprietario e verifica della provenienza delle chiamate al webhook

### In scope (v2)
- Configurabilità esterna (fuso orario, slot, profili), README e guida all'installazione, script di setup, pubblicazione del repository con licenza MIT

### Out of scope
- **Multi-utente** (più proprietari sulla stessa istanza). Il modello dati non deve impedirlo in futuro.
- Invio automatico degli auguri alla persona: il bot prepara, l'utente invia.
- Gestione regali, note libere, email e indirizzi.
- Import da vCard o rubrica e aggiunta tramite contatto condiviso.
- Integrazioni con calendari esterni.

## 3. Glossario

| Termine | Definizione |
|---|---|
| **Persona** | Una scheda anagrafica con data di compleanno. |
| **Gruppo** | Etichetta creata dall'utente (es. Famiglia, Lavoro, Beach tennis), assegnabile a più persone. Una persona può avere più gruppi. |
| **Priorità** | Alta / Media / Bassa. Determina quanti promemoria si ricevono. Default: Media. |
| **Profilo di priorità** | Insieme di regole (pre-reminder e slot del giorno) associato a una priorità. |
| **Slot** | Orario fisso, in ora locale, in cui può partire un reminder del giorno: 9:00, 13:00, 18:00, 21:00. |
| **Pre-reminder** | Promemoria informativo inviato N giorni prima del compleanno, alle 13:00. |
| **Reminder del giorno** | Promemoria inviato nel giorno del compleanno, negli slot previsti dal profilo. |
| **Recupero** | Unico promemoria inviato il giorno dopo il compleanno, alle 13:00, se l'occorrenza è ancora aperta. |
| **Occorrenza** | Il compleanno di una persona in un dato anno, con il suo esito. |
| **Data effettiva** | Il giorno in cui cade l'occorrenza: coincide con la data di nascita, tranne il 29/02 negli anni non bisestili (→ 28/02). |
| **Esito** | Stato finale dell'occorrenza: *fatto*, *saltato*, *non confermato*. |
| **Messaggio di auguri** | Testo precompilato per scrivere alla persona. Esiste un default globale, sostituibile per singola persona. |
| **Comando persona** | Il comando `/p_<id>` mostrato nelle liste: toccandolo si apre la scheda della persona. |

## 4. Requisiti funzionali

> Priorità: **MVP** · **v2** · **Futuro**

### 4.1 Anagrafica persone

**RF-01 — Inserimento guidato di una persona** · MVP
Il bot raccoglie i dati un campo alla volta. I campi opzionali hanno il pulsante "Salta". Ordine: nome completo*, nickname, data*, telefono, Instagram, Telegram, gruppi, priorità, messaggio personalizzato. Alla fine mostra un riepilogo con Salva / Annulla.
- *Dato* che avvio "Aggiungi persona", *quando* rispondo a tutti i campi obbligatori e salto gli opzionali, *allora* la persona viene salvata con priorità Media e il bot mostra la scheda.
- *Dato* che esiste già una persona con stesso nome e stessa data, *quando* confermo il salvataggio, *allora* il bot avvisa del possibile duplicato e chiede conferma esplicita.

**RF-02 — Inserimento e validazione della data** · MVP
Unico formato ammesso: `gg/mm/aaaa`, oppure `gg/mm` se l'anno è sconosciuto. Il bot risponde sempre con la data interpretata da confermare.
- *Dato* che scrivo `14/03/1994`, *quando* invio, *allora* il bot chiede "14 marzo 1994, giusto?" con Sì / Correggi.
- *Dato* che scrivo `31/04` o `14-3-94`, *quando* invio, *allora* il bot rifiuta la data e ripete il formato atteso.
- *Dato* che scrivo `29/02/1995` (anno non bisestile), *quando* invio, *allora* il bot rifiuta la data.
- *Dato* che scrivo `29/02` senza anno, *quando* invio, *allora* la data viene accettata.

**RF-03 — Scheda persona** · MVP
Il comando `/p_<id>` mostra: nome e nickname, data di nascita, età che compirà e giorni mancanti, priorità, gruppi, contatti presenti, messaggio personalizzato (se presente), storico esiti per anno. Pulsanti: Modifica, Elimina.
- *Dato* che tocco `/p_12` in una lista, *quando* il bot risponde, *allora* vedo la scheda della persona 12 con i pulsanti Modifica ed Elimina.
- *Dato* che l'anno di nascita non è noto, *quando* apro la scheda, *allora* l'età non compare.

**RF-04 — Modifica per campo** · MVP
Modifica apre un menù di pulsanti: Nome · Nickname · Data · Telefono · Instagram · Telegram · Gruppi · Priorità · Messaggio. Il bot chiede solo il campo scelto, salva e rimostra la scheda. I campi opzionali hanno anche "Svuota".
- *Dato* che sono nella scheda, *quando* premo Modifica → Instagram e invio un nuovo username, *allora* viene aggiornato solo quel campo e rivedo la scheda.
- *Dato* che premo Modifica → Telefono → Svuota, *quando* confermo, *allora* il telefono viene rimosso e il pulsante WhatsApp sparisce dai reminder.

**RF-05 — Eliminazione persona** · MVP
- *Dato* che premo Elimina, *quando* il bot chiede "Eliminare Marco Rossi? Perderai anche lo storico" e premo Sì, *allora* persona, associazioni ai gruppi, occorrenze e storico vengono eliminati.
- *Dato* che premo Annulla, *allora* non cambia nulla.

**RF-06 — Annullamento dei flussi guidati** · MVP
- *Dato* che sono in un flusso guidato, *quando* scrivo `/annulla` o premo Annulla, *allora* il flusso si interrompe senza salvare nulla.

### 4.2 Gruppi

**RF-07 — Gestione gruppi** · MVP
Il comando `/gruppi` elenca i gruppi con il numero di persone e permette di crearne, rinominarne ed eliminarne. Il nome è univoco senza distinzione tra maiuscole e minuscole.
- *Dato* che esiste "Famiglia", *quando* provo a creare "famiglia", *allora* il bot rifiuta per nome duplicato.
- *Dato* che rinomino "Lavoro" in "Ufficio", *allora* tutte le persone associate mostrano "Ufficio".
- *Dato* che elimino un gruppo con 8 persone, *quando* il bot chiede conferma indicando "8 persone perderanno questa etichetta" e confermo, *allora* il gruppo viene eliminato e le persone restano.

**RF-08 — Assegnazione gruppi con creazione al volo** · MVP
Nello step Gruppi (inserimento o modifica) il bot mostra i gruppi esistenti come pulsanti a selezione multipla (attiva/disattiva), più "➕ Nuovo gruppo" e "Fine".
- *Dato* che sono nello step Gruppi, *quando* premo "Nuovo gruppo" e scrivo "Beach tennis", *allora* il gruppo viene creato e risulta già selezionato.

### 4.3 Promemoria

**RF-09 — Pre-reminder** · MVP
Inviati alle 13:00 dei giorni previsti dal profilo (vedi §7). Sono informativi e hanno il solo pulsante "Salta quest'anno".
- *Dato* che Marco ha priorità Alta e compie gli anni il 14/03, *quando* sono le 13:00 del 07/03, *allora* ricevo "Tra 7 giorni: compleanno di Marco (32 anni) — 14/03".
- *Dato* che premo "Salta quest'anno" su un pre-reminder, *allora* l'occorrenza diventa *saltato* e non riceverò altri pre-reminder, reminder o recuperi per quest'anno.

**RF-10 — Reminder del giorno** · MVP
Un messaggio **per persona** in ogni slot previsto dal profilo, finché l'occorrenza è aperta. Contenuto: nickname e nome completo (se diversi), età (se l'anno è noto), gruppi, esito dell'anno precedente (solo *fatto* o *saltato*), pulsanti di contatto (RF-11), Fatto, Salta quest'anno.
- *Dato* che due persone compiono gli anni lo stesso giorno, *quando* scatta lo slot, *allora* ricevo due messaggi separati, ciascuno con i propri pulsanti.
- *Dato* che l'anno scorso l'occorrenza era *non confermato*, *quando* ricevo il reminder, *allora* la riga "L'anno scorso" non compare.

**RF-11 — Pulsanti di contatto** · MVP
Compaiono solo per i contatti presenti nella scheda.
| Pulsante | Destinazione | Testo precompilato |
|---|---|---|
| WhatsApp | `wa.me/<numero>?text=<messaggio>` | Sì |
| Instagram | `ig.me/m/<username>` | No (non supportato) |
| Telegram | `t.me/<username>` | No (non supportato) |
| Copia messaggio | Copia il messaggio di auguri negli appunti | — |
Il numero di telefono compare nel testo del reminder: Telegram lo rende cliccabile per chiamare o copiarlo (vedi §10, vincolo V-04).
- *Dato* che Marco ha solo telefono e Instagram, *quando* ricevo il reminder, *allora* vedo WhatsApp, Instagram e Copia messaggio, ma non Telegram.
- *Dato* che premo WhatsApp, *allora* si apre la chat con Marco e il messaggio di auguri già scritto, senza età.

**RF-12 — Chiusura: Fatto / Salta quest'anno** · MVP
- *Dato* che premo Fatto su un reminder, *allora* l'occorrenza diventa *fatto*, non ricevo altri slot né il recupero, e il messaggio si aggiorna mostrando "✅ Fatto" (i pulsanti di contatto restano).
- *Dato* che premo Salta quest'anno, *allora* l'occorrenza diventa *saltato*, con gli stessi effetti.

**RF-13 — Recupero del giorno dopo** · MVP
Vale per tutte le priorità. Se a fine giornata l'occorrenza è aperta, il giorno dopo alle 13:00 arriva "Ieri era il compleanno di X, hai fatto gli auguri?" con Fatto / Saltato e i pulsanti di contatto.
- *Dato* che non ho chiuso l'occorrenza, *quando* sono le 13:00 del giorno dopo, *allora* ricevo il recupero, una sola volta.
- *Dato* che non rispondo al recupero, *quando* termina il giorno dopo, *allora* l'occorrenza diventa *non confermato* senza ulteriori messaggi.

**RF-14 — Storico esiti** · MVP
Ogni occorrenza conserva il suo esito per anno. Lo storico è visibile nella scheda e alimenta "L'anno scorso" (RF-10) e `/anno` (RF-21).

**RF-15 — Messaggio di auguri** · MVP
Esiste un messaggio di default globale con segnaposto `{nome}` (sostituito dal nickname, o dal nome se il nickname manca). Si modifica con `/messaggio`. Ogni persona può avere un messaggio personalizzato che sostituisce il default.
- *Dato* che il default è "Tanti auguri {nome}! 🎉" e Marco ha nickname "Marchino", *quando* premo WhatsApp, *allora* il testo è "Tanti auguri Marchino! 🎉".
- *Dato* che Anna ha un messaggio personalizzato, *quando* premo WhatsApp sul suo reminder, *allora* viene usato il suo messaggio e non il default.
- *Dato* che uso `/messaggio` e invio un nuovo testo, *allora* il bot mostra un'anteprima con un nome d'esempio e chiede conferma.

### 4.4 Viste e ricerche

Tutte le liste sono testuali: una riga per persona con giorno della settimana, data, nickname (o nome), età che compirà (se nota) e comando `/p_<id>`. Ordinamento per prossimo compleanno.

**RF-16 — `/oggi`** · MVP
- *Dato* che oggi ci sono compleanni, *quando* scrivo `/oggi`, *allora* ricevo per ciascuno lo stesso messaggio del reminder del giorno, con i suoi pulsanti e lo stato attuale.
- *Dato* che oggi non ci sono compleanni, *allora* il bot lo dice e indica il prossimo.

**RF-17 — `/prossimi [giorni] [gruppo]`** · MVP
Default 30 giorni, massimo 366. Filtro per gruppo opzionale.
- *Dato* che scrivo `/prossimi 7 famiglia`, *allora* vedo i compleanni dei prossimi 7 giorni delle persone del gruppo Famiglia.
- *Dato* che il gruppo indicato non esiste, *allora* il bot lo segnala ed elenca i gruppi esistenti.

**RF-18 — `/cerca <testo>`** · MVP
Ricerca per parte del nome o del nickname, senza distinzione tra maiuscole e minuscole.
- *Dato* che un solo risultato corrisponde, *allora* il bot apre direttamente la scheda.
- *Dato* che corrispondono più risultati, *allora* il bot mostra la lista.

**RF-19 — `/gruppo <nome>`** · MVP
- *Dato* che scrivo `/gruppo lavoro`, *allora* vedo tutte le persone del gruppo, ordinate per prossimo compleanno.

**RF-20 — `/mese [mese]`** · MVP
Default: mese corrente. Il mese si indica per nome ("marzo") o per numero.
- *Dato* che scrivo `/mese marzo`, *allora* vedo tutti i compleanni di marzo ordinati per giorno.

**RF-21 — `/scaduti`** · MVP
Compleanni degli ultimi 7 giorni con esito diverso da *fatto*. Dalla scheda, per un'occorrenza degli ultimi 7 giorni non *fatto*, è disponibile il pulsante "Segna fatto".
- *Dato* che sono stato in vacanza, *quando* scrivo `/scaduti`, *allora* vedo chi ho saltato o non confermato e posso aprirne la scheda per segnarlo come fatto.

**RF-22 — `/anno [anno]`** · MVP
Riepilogo dell'anno (default: corrente): numero di occorrenze *fatto*, *saltato*, *non confermato*; elenco dei saltati; persone saltate per 2 o più anni consecutivi.

### 4.5 Import, export e backup

**RF-23 — `/modello`** · MVP
Il bot invia il file CSV modello con intestazioni, una riga d'esempio compilata e una legenda dei formati.

**RF-24 — Import CSV con anteprima** · MVP
L'utente invia un file CSV al bot. Il bot valida tutte le righe e mostra un'anteprima: righe nuove, duplicati, errori (con numero di riga e motivo), gruppi che verranno creati. Pulsanti: Importa / Annulla.
- *Dato* un file con 112 righe di cui 3 con data non valida e 5 duplicate, *quando* lo invio, *allora* vedo "104 nuove, 5 duplicati (saltati), 3 errori: riga 12 data non valida…" e nulla viene salvato finché non premo Importa.
- *Dato* che premo Importa, *allora* vengono salvate solo le righe valide e non duplicate, e vengono creati i gruppi mancanti.
- *Dato* che il file usa `;` come separatore (Excel in italiano), *allora* viene letto correttamente come un file con `,`.

**RF-25 — `/export`** · MVP
Il bot invia un CSV con lo stesso formato del modello, reimportabile. Non contiene lo storico.

**RF-26 — `/backup` e `/ripristina`** · MVP
`/backup` invia un file JSON completo: persone, gruppi, associazioni, occorrenze e storico, impostazioni (messaggio di default). `/ripristina` attende un file JSON e, dopo **doppia conferma**, sostituisce tutti i dati.
- *Dato* che invio un backup valido e confermo due volte, *allora* i dati attuali vengono sostituiti e il bot mostra un riepilogo di cosa è stato ripristinato.
- *Dato* che il file non è un backup valido, *allora* il ripristino viene rifiutato e i dati restano invariati.

**RF-27 — Backup automatico mensile** · MVP
- *Dato* che è il 1° del mese, *quando* sono le 9:00, *allora* ricevo il file di backup JSON in chat.

### 4.6 Accesso e avvio

**RF-28 — `/start` e `/aiuto`** · MVP
`/start` mostra un benvenuto con i pulsanti: Aggiungi persona · Scarica modello CSV · Comandi. `/aiuto` elenca i comandi con una riga di descrizione ciascuno.

**RF-29 — `/id`** · MVP
Risponde a **chiunque** con il suo ID Telegram numerico. Serve per configurare la whitelist.

**RF-30 — Whitelist del proprietario** · MVP
- *Dato* che un utente diverso dal proprietario scrive al bot, *quando* invia un qualsiasi comando diverso da `/id`, *allora* il bot non risponde e non salva nulla.

### 4.7 Evoluzioni

**RF-40 — Configurabilità esterna** · v2: fuso orario, orari degli slot e profili di priorità modificabili senza toccare il codice.
**RF-41 — README e guida all'installazione** · v2 (vedi §12).
**RF-42 — Script di setup** PowerShell e Bash per la creazione del database, dei segreti e la registrazione del webhook · v2.
**RF-43 — Pubblicazione del repository** con licenza MIT · v2.
**RF-50 — Vista schede incomplete** (persone senza telefono o contatti) · Futuro.
**RF-51 — Multilingua completo** · Futuro.

## 5. Flussi utente e conversazioni

### 5.1 Comandi
| Comando | Funzione | RF |
|---|---|---|
| `/start` | Benvenuto e azioni rapide | RF-28 |
| `/aiuto` | Elenco comandi | RF-28 |
| `/nuovo` | Aggiungi persona (guidato) | RF-01 |
| `/p_<id>` | Apri scheda | RF-03 |
| `/cerca <testo>` | Ricerca | RF-18 |
| `/oggi` | Compleanni di oggi | RF-16 |
| `/prossimi [giorni] [gruppo]` | Prossimi compleanni | RF-17 |
| `/mese [mese]` | Compleanni del mese | RF-20 |
| `/gruppo <nome>` | Persone di un gruppo | RF-19 |
| `/gruppi` | Gestione gruppi | RF-07 |
| `/scaduti` | Ultimi 7 giorni non fatti | RF-21 |
| `/anno [anno]` | Riepilogo annuale | RF-22 |
| `/messaggio` | Modifica messaggio di default | RF-15 |
| `/modello` | Scarica il modello CSV | RF-23 |
| `/export` | Esporta CSV | RF-25 |
| `/backup` | Backup JSON | RF-26 |
| `/ripristina` | Ripristino da JSON | RF-26 |
| `/annulla` | Interrompe un flusso guidato | RF-06 |
| `/id` | Mostra il proprio ID Telegram | RF-29 |

### 5.2 Inserimento persona (esempio)
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

### 5.3 Reminder del giorno
```
🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni
Gruppi: Beach tennis
📱 +39 333 1234567
L'anno scorso: fatto ✅

[WhatsApp] [Instagram] [Telegram]
[Copia messaggio]
[Fatto ✅] [Salta quest'anno]
```

### 5.4 Pre-reminder
```
📅 Tra 7 giorni: compleanno di Marchino (32 anni) — 14/03
[Salta quest'anno]
```

### 5.5 Recupero
```
⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?
[WhatsApp] [Instagram] [Telegram] [Copia messaggio]
[Fatto ✅] [Saltato]
```

### 5.6 Scheda
```
Marco Rossi — "Marchino"
14/03/1994 · compie 32 anni tra 137 giorni
Priorità: alta · Gruppi: Beach tennis, Lavoro
📱 +39 333 1234567 · IG @marco.rossi · TG @mrossi
Messaggio: standard
Storico: 2025 fatto · 2024 saltato

[Modifica] [Elimina]
```

### 5.7 Liste (`/prossimi`, `/gruppo`, `/cerca`)
```
Prossimi 30 giorni (Famiglia)

Gio 30/10  Anna (28)      /p_4
Dom 02/11  Luca (35)      /p_17
Mer 12/11  Giulia         /p_9
```
In `/mese` le righe sono raggruppate per settimana o in ordine di giorno; nelle altre viste la lista è continua.

### 5.8 Import CSV
```
Tu:  [invia compleanni.csv]
Bot: Anteprima import
     104 persone nuove
     5 duplicati (saltati): Marco Rossi 14/03, …
     3 errori: riga 12 data "31/04" non valida; riga 40 nome mancante; …
     Gruppi da creare: Calcetto, Università
     [Importa] [Annulla]
Tu:  [Importa]
Bot: Importate 104 persone, creati 2 gruppi.
```

## 6. Regole di business e casi limite

### Date ed età
- **BR-01** Formato unico `gg/mm/aaaa` o `gg/mm`; vale sia nel bot sia nel CSV.
- **BR-02** L'anno, se presente, non può essere futuro né precedente al 1900.
- **BR-03** Età = anno dell'occorrenza − anno di nascita. Mostrata solo all'utente, **mai** nel messaggio di auguri.
- **BR-04 29 febbraio**: la data registrata e mostrata resta **29/02** ovunque (scheda, liste, export). Negli anni non bisestili la data effettiva è il **28/02**; il reminder riporta "(compleanno il 29/02)". I pre-reminder si contano a ritroso dalla data effettiva.
- **BR-05** Un'occorrenza appartiene all'anno del compleanno, anche se i suoi pre-reminder cadono nell'anno precedente (es. compleanno il 02/01, pre-reminder −7 il 26/12).

### Occorrenze ed esiti
- **BR-06** Ogni persona ha al massimo un'occorrenza per anno.
- **BR-07** Il primo Fatto o Salta chiude l'occorrenza e annulla tutti i promemoria successivi, recupero compreso.
- **BR-08** Un esito *saltato* o *non confermato* può essere corretto in *fatto* entro 7 giorni dalla data effettiva (pulsanti del recupero, scheda, `/scaduti`). *Fatto* non torna indietro.
- **BR-09** "L'anno scorso" nel reminder compare solo se l'esito precedente è *fatto* o *saltato*; *non confermato* non genera alcun avviso, per evitare falsi allarmi.

### Inserimenti e modifiche a ridosso del compleanno
- **BR-10** I promemoria il cui orario è già passato al momento dell'inserimento non vengono inviati retroattivamente.
- **BR-11** Se una persona viene inserita il giorno del compleanno, partono solo gli slot ancora futuri. Il recupero parte solo se nella giornata è stato inviato almeno un reminder.
- **BR-12** Cambiare priorità durante un'occorrenza aperta vale solo per i promemoria futuri.
- **BR-13** Cambiare la data di nascita annulla l'occorrenza aperta dell'anno corrente (se non ancora chiusa); quella nuova segue la nuova data.

### Dati e duplicati
- **BR-14** Duplicato = stesso nome completo (senza distinzione tra maiuscole e minuscole) e stessa data. Nel guidato: avviso e conferma. Nell'import: riga saltata. Vale anche per i duplicati interni allo stesso file.
- **BR-15** Il telefono è salvato in formato internazionale. Senza prefisso si assume +39.
- **BR-16** Gli username di Instagram e Telegram si salvano senza `@` (se presente viene rimosso).
- **BR-17** Nomi dei gruppi univoci senza distinzione tra maiuscole e minuscole.

### Import CSV
- **BR-18** Colonne: `nome; nickname; data; telefono; instagram; telegram; gruppi; priorita; messaggio`. Obbligatori: `nome`, `data`.
- **BR-19** Separatore di colonna `,` oppure `;`, riconosciuto automaticamente.
- **BR-20** Più gruppi nella stessa cella sono separati da `|` (es. `Famiglia|Beach tennis`), per non entrare in conflitto con il separatore di colonna.
- **BR-21** `priorita` accetta `alta`, `media`, `bassa` (senza distinzione tra maiuscole e minuscole); se vuota vale `media`.
- **BR-22** Codifica UTF-8 (con o senza BOM, come produce Excel con "CSV UTF-8").
- **BR-23** I gruppi assenti vengono creati in automatico e elencati nell'anteprima.

### Fuso orario
- **BR-24** Tutti gli orari sono in ora locale **Europe/Rome**, con passaggio automatico tra ora solare e legale. Il cambio d'ora avviene di notte e non tocca gli slot.

## 7. Notifiche e reminder

### Profili di priorità
| Priorità | Pre-reminder (alle 13:00) | Giorno stesso (slot) | Recupero |
|---|---|---|---|
| **Alta** | −7, −2, −1 giorni | 9:00 · 13:00 · 18:00 · 21:00 | D+1 alle 13:00 |
| **Media** | −1 giorno | 9:00 · 13:00 · 18:00 | D+1 alle 13:00 |
| **Bassa** | nessuno | 9:00 · 18:00 | D+1 alle 13:00 |

Nell'MVP profili e slot sono costanti definite in un unico punto; in v2 diventano configurabili (RF-40).

### Stati dell'occorrenza
```
            pre-reminder / slot del giorno
 aperta ──────────────────────────────────┐
   │  Fatto ──────────────► fatto         │
   │  Salta quest'anno ───► saltato       │
   │                                      ▼
   └── fine giorno D senza esito ─► recupero D+1 alle 13:00
                                     │ Fatto  ► fatto
                                     │ Saltato ► saltato
                                     └ fine giorno D+1 ► non confermato
```
Entro D+7, *saltato* e *non confermato* possono passare a *fatto* (BR-08).

### Altri invii programmati
| Invio | Quando |
|---|---|
| Backup automatico | 1° del mese alle 9:00 |

### Regole di invio
- **N-01** Un solo Cron Trigger orario gestisce tutti gli invii. A ogni esecuzione il bot calcola l'ora locale e invia ciò che è previsto per quell'ora.
- **N-02 Idempotenza**: ogni promemoria (persona, anno, tipo, slot) viene inviato al massimo una volta, anche se il cron viene rieseguito.
- **N-03** Se un invio fallisce per un errore di Telegram, viene ritentato all'esecuzione successiva, ma solo entro la stessa giornata; poi viene abbandonato.
- **N-04** Uno slot saltato per un malfunzionamento della piattaforma non viene recuperato. Il recupero del giorno dopo e `/oggi` fanno da rete di sicurezza.
- **N-05** Granularità: ore piene. Non sono possibili orari come 9:30.

## 8. Modello dati concettuale

| Entità | Attributi principali |
|---|---|
| **Persona** | id, nome completo, nickname (opz.), giorno, mese, anno (opz.), telefono (opz.), username Instagram (opz.), username Telegram (opz.), priorità, messaggio personalizzato (opz.), data creazione, data ultima modifica |
| **Gruppo** | id, nome (univoco) |
| **Appartenenza** | persona, gruppo — relazione molti-a-molti |
| **Occorrenza** | id, persona, anno, data effettiva, stato (aperta / fatto / saltato / non confermato), data e ora dell'esito |
| **Invio** | occorrenza, tipo (pre-reminder / reminder / recupero), riferimento (giorni prima o slot), data e ora, esito dell'invio, id del messaggio Telegram |
| **Impostazioni** | messaggio di auguri di default |
| **Stato conversazione** | flusso in corso (inserimento, modifica, import…), step corrente, dati parziali, scadenza |
| **Profilo di priorità** | priorità, giorni dei pre-reminder, slot del giorno — costante nell'MVP, entità configurabile in v2 |

Note:
- L'identificativo del proprietario non è un attributo nell'MVP (istanza mono-utente), ma il modello non deve impedire di aggiungerlo per un futuro multi-utente.
- Lo stato conversazione deve essere persistito, perché il Worker non conserva memoria tra una richiesta e l'altra. I flussi rimasti a metà scadono dopo 24 ore.

## 9. Requisiti non funzionali

### Costo
- **RNF-01** Costo zero: solo piani gratuiti di Cloudflare (Workers, D1, Cron Triggers) e Telegram Bot API. Nessun servizio esterno a pagamento.

### Sicurezza
- **RNF-02 Whitelist**: il bot esegue comandi solo per il proprio ID Telegram (numero, non username). Con qualsiasi altro mittente non risponde e non salva nulla, salvo `/id`.
- **RNF-03 Verifica della provenienza**: il webhook è un URL pubblico e chiunque potrebbe inviargli una richiesta falsa con dentro l'ID del proprietario, aggirando la whitelist. Il webhook viene quindi registrato su Telegram con un **token segreto**: Telegram lo allega in un header (`X-Telegram-Bot-Api-Secret-Token`) a ogni chiamata, e il Worker scarta qualsiasi richiesta senza il token corretto. La whitelist verifica *chi dice di essere* il mittente; il token segreto verifica che la richiesta *arrivi davvero da Telegram*. Servono entrambi.
- **RNF-04 Segreti**: token del bot, ID del proprietario e token segreto del webhook sono gestiti come segreti della piattaforma, **mai** scritti nel codice o nel repository.
- **RNF-05** Le operazioni distruttive (eliminazione persona o gruppo, ripristino) richiedono conferma; il ripristino richiede una doppia conferma.

### Privacy
- **RNF-06** Il bot conserva dati personali di terzi (nomi, date, telefoni, username). Per uso strettamente personale ricade nell'esenzione del GDPR per le attività domestiche; l'apertura ad altri utenti (fuori perimetro) richiederebbe una nuova valutazione.
- **RNF-07** Nessuna telemetria e nessun invio di dati a terzi diversi da Telegram e Cloudflare.
- **RNF-08** I log non contengono dati personali in chiaro (telefoni, messaggi).
- **RNF-09** I file di backup ed export contengono dati personali e vengono consegnati solo nella chat del proprietario.

### Affidabilità
- **RNF-10** Idempotenza degli invii (N-02) e retry nella giornata (N-03).
- **RNF-11** Backup automatico mensile più backup su richiesta, ripristinabili integralmente.
- **RNF-12** Un errore su una singola persona durante l'esecuzione del cron non blocca gli invii alle altre.

### Usabilità
- **RNF-13** Interazione il più possibile guidata: nessuna sintassi da ricordare oltre al formato della data.
- **RNF-14** Pulsanti solo per le azioni; la navigazione nelle liste usa i comandi `/p_<id>` nel testo.
- **RNF-15** Testi del bot raccolti in un unico punto, per facilitarne modifica e traduzione futura.

### Prestazioni e volumi
- **RNF-16** Dimensionamento: circa 100-200 persone. Liste senza paginazione entro questi volumi.
- **RNF-17** Ogni invocazione deve stare entro **10 ms di CPU** (piano free): import di 200 righe, generazione del backup e ciclo orario devono restare entro il limite. Il tempo di attesa delle chiamate a Telegram non conta come CPU.

### Manutenibilità e riuso
- **RNF-18** Fuso orario, slot, profili e testi centralizzati già nell'MVP, così che in v2 diventino configurabili senza riscritture.

## 10. Vincoli e assunzioni

### Vincoli di piattaforma
- **V-01** Cron Trigger in UTC, granularità minima oraria, massimo 5 cron per account Cloudflare. Il bot ne usa **uno**.
- **V-02** Limite di 10 ms di CPU per invocazione sul piano free.
- **V-03** Telegram non offre ai bot un selettore di date: la data si inserisce come testo.
- **V-04** I pulsanti inline di Telegram accettano solo link `https://` e `tg://`. **Non è possibile** creare pulsanti "Chiama" (`tel:`) o "SMS" (`sms:`). Il numero di telefono viene mostrato nel testo del messaggio, dove Telegram lo rende cliccabile (chiama/copia). L'SMS con testo precompilato non è realizzabile.
- **V-05** I link di Instagram (`ig.me/m/`) e Telegram (`t.me/`) aprono la chat ma non accettano testo precompilato: per questi canali c'è il pulsante "Copia messaggio".
- **V-06** Il link WhatsApp funziona solo con il numero in formato internazionale.
- **V-07** Limiti sui file Telegram (20 MB in ricezione dal bot, 50 MB in invio): irrilevanti per i volumi previsti.

### Assunzioni
- **A-01** Un solo utente per istanza; fuso orario Europe/Rome.
- **A-02** Prefisso telefonico di default +39.
- **A-03** Backup automatico alle 9:00 del 1° del mese.
- **A-04** I flussi guidati lasciati a metà scadono dopo 24 ore.
- **A-05** La correzione di un esito in *fatto* è consentita entro 7 giorni.
- **A-06** Messaggio di auguri di default iniziale: "Tanti auguri {nome}! 🎉".
- **A-07** Gli anni di nascita accettati vanno dal 1900 all'anno corrente.

## 11. Decisioni prese e alternative scartate

### Decisioni
| # | Decisione | Motivazione |
|---|---|---|
| D-01 | Profili di priorità condivisi (Alta/Media/Bassa) invece di regole per persona | Una sola configurazione da mantenere; cambiare un profilo aggiorna tutti. |
| D-02 | Orari fissi a ore piene (9, 13, 18, 21) e pre-reminder alle 13 | Compatibile con il cron orario; alle 13 c'è il tempo per leggere. |
| D-03 | Un messaggio separato per ogni persona | Ogni messaggio ha i pulsanti di una sola persona. |
| D-04 | Due esiti espliciti (Fatto, Salta) più *non confermato* | Lo storico distingue le scelte dalle dimenticanze ed evita falsi allarmi. |
| D-05 | Un solo recupero il giorno dopo, poi silenzio | Rete di sicurezza senza diventare spam. |
| D-06 | Pre-reminder solo informativi, con "Salta quest'anno" | Servono a sapere, non a fare; "Salta" evita messaggi inutili. |
| D-07 | Gruppi come entità create dall'utente | Evita duplicati da testo libero ("Famiglia" / "fam"). |
| D-08 | Età solo nei messaggi all'utente | Il messaggio di auguri resta generico. |
| D-09 | Messaggio di default globale modificabile, con override per persona | Flessibilità senza costringere a compilarlo. |
| D-10 | Inserimento e modifica guidati; modifica tramite menù per campo | Nessuna sintassi da ricordare; correzioni in un tocco. |
| D-11 | Formato data unico `gg/mm/aaaa` (o `gg/mm`) con conferma | Coerente tra bot e CSV; veloce da copiare dall'agenda. |
| D-12 | Liste testuali con comandi `/p_<id>` | Compatte e senza paginazione con oltre 100 persone. |
| D-13 | Viste `/mese`, `/scaduti`, `/anno` già nell'MVP | Basso costo, alto valore d'uso. |
| D-14 | Import CSV come canale di onboarding | Le date sono su agenda cartacea; il CSV si compila comodamente dal PC. |
| D-15 | Export CSV e backup JSON separati, più backup mensile automatico | Il CSV si legge e modifica; il JSON contiene tutto ed è ripristinabile. |
| D-16 | Gruppi mancanti nel CSV creati in automatico | Onboarding in un solo passaggio. |
| D-17 | 29/02 mostrato sempre come tale, festeggiato il 28/02 negli anni non bisestili | La data di nascita resta corretta; il reminder cade nello stesso mese. |
| D-18 | Whitelist dell'ID più token segreto sul webhook | Doppia protezione: identità del mittente e provenienza della richiesta. |
| D-19 | Multi-utente fuori perimetro | Semplicità e privacy (esenzione domestica). |
| D-20 | Segreti, testi, fuso, slot e profili centralizzati già nell'MVP | Rende la v2 configurabile senza riscritture, a costo quasi nullo. |
| D-21 | Repository pubblico in v2, licenza MIT | Prima funziona per l'autore, poi diventa riusabile. |
| D-22 | Separatore `|` per i gruppi nel CSV | Evita il conflitto con il `;` usato come separatore di colonna. |

### Alternative scartate
| Alternativa | Motivo |
|---|---|
| Canale preferito per persona | Non utile all'utente. |
| Note libere | Non verrebbero compilate. |
| Email e indirizzo | Nessuna azione utile il giorno del compleanno. |
| Configurazione dei reminder per persona | Ingestibile oltre poche persone. |
| Pulsante "Regalo preso" | I pre-reminder servono solo a sapere. |
| Messaggio unico per più compleanni nello stesso giorno | I pulsanti devono riferirsi a una sola persona. |
| Ricerca per età o segno zodiacale | Nessun uso reale. |
| Import vCard / Google Contatti | L'utente non usa Google per i contatti. |
| Contatto condiviso da Telegram | Troppo lento per l'onboarding. |
| Pulsanti per navigare le liste | Muro di pulsanti e paginazione oltre 30 elementi. |
| Rifare tutto il guidato per modificare | Troppi passaggi per correggere un campo. |
| Più formati di data accettati | L'utente preferisce un formato unico. |
| Calendario a pulsanti per la data | Scomodo per scegliere l'anno di nascita. |
| Pulsanti "Chiama" e "SMS" | Non supportati dai pulsanti inline di Telegram (V-04). |
| Più recuperi dopo il compleanno | Diventerebbe spam. |

## 12. Roadmap

### MVP
- Anagrafica guidata, scheda, modifica per campo, eliminazione (RF-01…06)
- Gruppi (RF-07, RF-08)
- Pre-reminder, reminder, pulsanti, chiusura, recupero, storico, messaggio di auguri (RF-09…15)
- Viste `/oggi`, `/prossimi`, `/cerca`, `/gruppo`, `/mese`, `/scaduti`, `/anno` (RF-16…22)
- Modello, import, export, backup, ripristino, backup mensile (RF-23…27)
- `/start`, `/aiuto`, `/id`, whitelist, token segreto del webhook (RF-28…30, RNF-02…04)
- Centralizzazione di testi, segreti, fuso, slot e profili (RNF-15, RNF-18)

### v2
- Configurabilità esterna di fuso orario, slot e profili (RF-40)
- README con guida completa (RF-41), basata sul percorso seguito dall'autore:
  1. creazione del bot con @BotFather e recupero del token
  2. recupero del proprio ID con `/id` o @userinfobot
  3. account Cloudflare gratuito, creazione del database, impostazione dei segreti, deploy
  4. registrazione del webhook con token segreto
  5. primo `/start` e import del CSV
  6. limiti noti (5 cron per account, 10 ms di CPU)
- Script di setup PowerShell e Bash (RF-42)
- Pubblicazione del repository con licenza MIT (RF-43)

### Idee future
- Vista delle schede incomplete (RF-50)
- Multilingua completo (RF-51)
- Riepilogo annuale inviato in automatico il 31/12

## 13. Punti aperti

Nessun punto aperto bloccante.

Da confermare in fase di sviluppo:
- **PA-01** Il comportamento del numero cliccabile nel testo (V-04) va verificato sui client Telegram usati (Android, iOS, desktop). Se non soddisfacente, l'alternativa è un pulsante "Chiama" che punta a una pagina `https://` del Worker che reindirizza a `tel:`: fattibilità da verificare, perché espone un endpoint pubblico in più.
