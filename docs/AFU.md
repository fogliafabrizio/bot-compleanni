# AFU — Bot Telegram Compleanni

**Analisi Funzionale** · versione 1.3 · 06/11/2026
Committente e unico utente MVP: Fabrizio

## Registro modifiche

| Versione | REV | Decisione | Requisiti |
|---|---|---|---|
| 1.3 | REV-012 — Slot delle 00:00 per la priorità Alta | Accettata con modifiche | Modificati il glossario "Slot", i profili di priorità (§7), RF-10 (slot delle 00:00 per Alta) e RNF-19 (la mezzanotte si scrive "00:00" in reminder, `/stato` e avviso di buco N-06). Aggiornata D-02. Aggiunte le alternative scartate "Attendere RF-40", "Pre-reminder di −1 giorno alle 23:00" e "Slot delle 00:00 solo per chi ha telefono o Telegram". |
| 1.3 | REV-013 — Profili incompleti | Accettata con modifiche | RF-50 anticipato dalle idee future e allargato ai singoli campi: `/incomplete [campo]` con filtri a pulsanti. Modificati RF-28, RF-32 ([📝 Profili incompleti] in fondo a `/statistiche`), RNF-14 (filtri a pulsanti e nuovo punto di passo successivo) e RNF-19. Aggiornati glossario, §5.1, §5.7, §5.11, nuovo mockup §5.13 e roadmap. Aggiunta D-34. L'alternativa scartata "Vista delle schede incomplete anticipata nella v1.1" è superata; aggiunte quattro alternative scartate (combinazioni e filtro per gruppo, conteggi cliccabili, gruppi nella riga, "Senza gruppo" tra i filtri). |
| 1.2 | REV-008 — Pulsante Indietro dalla scheda gruppo | Accettata con modifiche | Modificati RF-07, RF-19 e RNF-14: [⬅️ Tutti i gruppi] sulla scheda gruppo, sempre con un nuovo messaggio. Aggiornati il mockup §5.9 e l'alternativa scartata "Navigazione sul posto nella scheda gruppo". Aggiunta D-30. |
| 1.2 | REV-009 — Voce "Senza gruppo" nell'elenco gruppi | Accettata con modifiche | Modificati RF-07, RF-19 e RF-32: voce virtuale [Senza gruppo (N)] e scheda "Senza gruppo", conteggio in `/statistiche`. Aggiornati glossario, mockup §5.9 e §5.11. Aggiunte D-31 e l'alternativa scartata "Gruppo reale «Senza gruppo» o accesso testuale". |
| 1.2 | REV-010 — Distribuzione per età in `/statistiche` | Accettata con modifiche | Modificati RF-32 (sezione 🧑 Età per decadi con età media) e BR-03 (età attuale in `/statistiche`). Aggiornato il mockup §5.11. Aggiunte D-32 e l'alternativa scartata "Nomi della persona più giovane e più anziana". |
| 1.2 | REV-011 — Navigazione più guidata | Accettata con modifiche | Modificati RNF-14 e RNF-19 (pulsanti di passo successivo), RF-01 ([➕ Aggiungi un'altra persona] dopo il salvataggio), RF-17 ([Prossimi 90 giorni]), RF-20 (scorrimento dei mesi) e RF-22 (scorrimento degli anni). Aggiornati i mockup §5.2 e §5.7. Aggiunte D-33 e le alternative scartate "Tastiera di risposta persistente", "Indietro di uno step nei flussi guidati" e "Apri scheda dopo il salvataggio" (decisione del proprietario, 29/10/2026). |
| 1.2 | — | — | Corretto il riferimento di RF-14 a `/anno` (RF-22, non RF-21). |
| 1.1 | REV-001 — Tono più caldo ed emoji | Accettata con modifiche | Aggiunto RNF-19 (guida di stile). Aggiornati tutti i mockup di §5. |
| 1.1 | REV-002 — Telefono da contatto condiviso | Accettata con modifiche | Modificati RF-01 e RF-04. Aggiunti BR-25 e V-08. Aggiornati §2 Out of scope, mockup §5.2 e l'alternativa scartata "Contatto condiviso da Telegram". |
| 1.1 | REV-003 — `/gruppi` con pulsanti e scheda gruppo | Accettata con modifiche | Modificati RF-07, RF-19 e RNF-14. Aggiunti V-09 e l'idea futura RF-52. Aggiornati §5.1, i nuovi mockup §5.9 e l'alternativa scartata "Pulsanti per navigare le liste". |
| 1.1 | REV-004 — Ricerca morbida del gruppo | Accettata con modifiche | Modificati RF-17 e RF-19. Aggiunto BR-26, con la chiave di almeno 2 caratteri per i nomi dei gruppi (decisione del proprietario, 29/10/2026). |
| 1.1 | REV-005 — Pulsanti di contatto nella scheda | Accettata con modifiche | Modificati RF-03 e RF-11. Aggiornato il mockup §5.6. |
| 1.1 | REV-006 — Chiusura di PA-01 | Accettata | PA-01 chiuso come verificato. |
| 1.1 | REV-007 — Stato e statistiche | Accettata con modifiche | Aggiunti RF-31 (`/stato`), RF-32 (`/statistiche`) e N-06 (avviso di buco del cron). Aggiornati §8 (Impostazioni), §5.1 e i mockup §5.10-5.12. Nel mockup §5.10 la riga degli ultimi 7 giorni riporta anche i falliti, come chiede RF-31, e "mai registrato" è uniforme (decisione del proprietario, 29/10/2026). |
| 1.1 | — | — | Aggiunte le decisioni D-23…D-29 e le alternative scartate emerse dall'analisi (priorità "Silenziosa", anticipo di RF-50, onomastici e anniversari). |
| 1.0 | — | — | Prima versione (MVP). |

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
| **Scheduler** | Il Cron Trigger orario, che genera pre-reminder, reminder, recuperi, passaggi di stato, backup mensili e avvisi di buco del cron (N-06). |
| **Telegram** | Recapita i messaggi al bot via webhook e invia i messaggi del bot. |

### In scope (MVP)
- Anagrafica persone con contatti, gruppi, priorità e messaggio di auguri personalizzato
- Gestione gruppi
- Pre-reminder, reminder del giorno e recupero del giorno dopo, secondo profili di priorità
- Esiti annuali (fatto / saltato / non confermato) e storico
- Viste: oggi, prossimi, ricerca, gruppo, mese, scaduti, riepilogo annuale
- Import CSV, export CSV, backup/ripristino JSON, backup automatico mensile
- Sicurezza: whitelist del proprietario e verifica della provenienza delle chiamate al webhook

### In scope (v1.1)
- Scheda gruppo e ricerca dei gruppi per parte del nome (`/gruppi [nome]`)
- Pulsanti di contatto nella scheda persona
- Telefono acquisito da un contatto condiviso, nello step Telefono
- Comandi `/stato` e `/statistiche`, avviso automatico di buco del cron
- Guida di stile dei testi: tono caldo e sobrio, emoji coerenti

### In scope (v1.2)
- Ritorno all'elenco gruppi dalla scheda gruppo e voce "Senza gruppo" per le persone non classificate
- Distribuzione per età in `/statistiche`
- Pulsanti di passo successivo nelle viste (`/mese`, `/anno`, `/prossimi`) e dopo il salvataggio di una persona

### In scope (v1.3)
- Reminder del giorno alle 00:00 per le persone con priorità Alta
- Profili incompleti: `/incomplete` con un filtro per ogni dato mancante, raggiungibile anche da `/statistiche`

### In scope (v2)
- Configurabilità esterna (fuso orario, slot, profili), README e guida all'installazione, script di setup, pubblicazione del repository con licenza MIT

### Out of scope
- **Multi-utente** (più proprietari sulla stessa istanza). Il modello dati non deve impedirlo in futuro.
- Invio automatico degli auguri alla persona: il bot prepara, l'utente invia.
- Gestione regali, note libere, email e indirizzi.
- Import da vCard o rubrica e creazione di una persona a partire da un contatto condiviso. *(v1.1)* Il contatto condiviso è ammesso solo come scorciatoia per il campo Telefono (RF-01, RF-04).
- Integrazioni con calendari esterni.

## 3. Glossario

| Termine | Definizione |
|---|---|
| **Persona** | Una scheda anagrafica con data di compleanno. |
| **Gruppo** | Etichetta creata dall'utente (es. Famiglia, Lavoro, Beach tennis), assegnabile a più persone. Una persona può avere più gruppi. |
| **Priorità** | Alta / Media / Bassa. Determina quanti promemoria si ricevono. Default: Media. |
| **Profilo di priorità** | Insieme di regole (pre-reminder e slot del giorno) associato a una priorità. |
| **Slot** *(modificato in v1.3)* | Orario fisso, in ora locale, in cui può partire un reminder del giorno: 00:00 (solo priorità Alta), 9:00, 13:00, 18:00, 21:00. |
| **Pre-reminder** | Promemoria informativo inviato N giorni prima del compleanno, alle 13:00. |
| **Reminder del giorno** | Promemoria inviato nel giorno del compleanno, negli slot previsti dal profilo. |
| **Recupero** | Unico promemoria inviato il giorno dopo il compleanno, alle 13:00, se l'occorrenza è ancora aperta. |
| **Occorrenza** | Il compleanno di una persona in un dato anno, con il suo esito. |
| **Data effettiva** | Il giorno in cui cade l'occorrenza: coincide con la data di nascita, tranne il 29/02 negli anni non bisestili (→ 28/02). |
| **Esito** | Stato finale dell'occorrenza: *fatto*, *saltato*, *non confermato*. |
| **Messaggio di auguri** | Testo precompilato per scrivere alla persona. Esiste un default globale, sostituibile per singola persona. |
| **Comando persona** | Il comando `/p_<id>` mostrato nelle liste: toccandolo si apre la scheda della persona. |
| **Scheda gruppo** *(v1.1, modificata in v1.2)* | Messaggio con nome del gruppo, numero di persone, lista delle persone e pulsanti Rinomina / Elimina e Tutti i gruppi (RF-19). |
| **Senza gruppo** *(v1.2)* | Gruppo virtuale che raccoglie le persone senza alcun gruppo. È calcolato al momento, non è un gruppo salvato: non si rinomina, non si elimina, non si cerca per nome e non compare in export e backup (RF-07, RF-19). |
| **Pulsante di passo successivo** *(v1.2)* | Pulsante in fondo a una vista che porta a una vista vicina (mese o anno accanto, finestra più ampia, elenco gruppi, nuovo inserimento). Manda sempre un nuovo messaggio (RNF-14). |
| **Profilo incompleto** *(v1.3)* | Scheda persona a cui manca almeno uno tra telefono, username Instagram, username Telegram e anno di nascita. Si elenca con `/incomplete` (RF-50). Non ha legami con il profilo di priorità. |

## 4. Requisiti funzionali

> Priorità: **MVP** · **v2** · **Futuro**

### 4.1 Anagrafica persone

**RF-01 — Inserimento guidato di una persona** · MVP · modificato in v1.1 e v1.2
Il bot raccoglie i dati un campo alla volta. I campi opzionali hanno il pulsante "Salta". Ordine: nome completo*, nickname, data*, telefono, Instagram, Telegram, gruppi, priorità, messaggio personalizzato. Alla fine mostra un riepilogo con Salva / Annulla.
- *Dato* che avvio "Aggiungi persona", *quando* rispondo a tutti i campi obbligatori e salto gli opzionali, *allora* la persona viene salvata con priorità Media e il bot mostra la scheda.
- *Dato* che esiste già una persona con stesso nome e stessa data, *quando* confermo il salvataggio, *allora* il bot avvisa del possibile duplicato e chiede conferma esplicita.

*(v1.1)* **Telefono da contatto condiviso.** Allo step Telefono, oltre a scrivere il numero, si può condividere un contatto dalla rubrica (📎 → Contatto). Il bot prende il numero principale del contatto, lo normalizza (BR-25) e chiede sempre conferma: "📱 <numero>, giusto?" con Sì / Correggi. Sì passa allo step successivo; Correggi ripete la domanda testuale. Nome, vCard e utente Telegram del contatto vengono ignorati. Un contatto inviato in un altro step viene ignorato e il bot ripete la domanda di quello step. La domanda dello step suggerisce anche questa possibilità.
- *Dato* che sono allo step Telefono, *quando* condivido il contatto di Marco con numero `393331234567`, *allora* il bot chiede "📱 +393331234567, giusto?" e, se premo Sì, passa allo step Instagram con quel numero.
- *Dato* che il contatto ha il numero `333 1234567`, *quando* lo condivido, *allora* il bot propone `+393331234567`.
- *Dato* che premo Correggi, *allora* il bot ripete "Telefono?" e il numero non viene salvato.
- *Dato* che sono allo step Nome, *quando* condivido un contatto, *allora* il bot lo ignora e ripete la domanda del nome.
- *Dato* che il numero normalizzato non è valido per BR-15, *quando* condivido il contatto, *allora* il bot lo segnala e ripete la domanda testuale.

*(v1.2)* **Aggiungi un'altra persona.** Dopo il salvataggio la conferma sta in testa alla scheda, nello stesso messaggio (RNF-19). In quel messaggio, e solo lì, sotto i pulsanti della scheda (RF-03) compare [➕ Aggiungi un'altra persona] su una riga a sé: avvia un nuovo inserimento guidato, come `/nuovo`. Non c'è un pulsante "Apri scheda", perché la scheda è già il messaggio di conferma.
- *(v1.2)* *Dato* che salvo Marco, *quando* il bot conferma, *allora* vedo "🎉 Fatto! Marchino è in rubrica." in testa alla scheda e, in fondo, [➕ Aggiungi un'altra persona].
- *(v1.2)* *Dato* che premo [➕ Aggiungi un'altra persona], *allora* il bot chiede il nome della nuova persona, come dopo `/nuovo`.
- *(v1.2)* *Dato* che apro la scheda di Marco con `/p_<id>` o la ridisegno dopo una modifica, *allora* [➕ Aggiungi un'altra persona] non compare.
- *(v1.2)* *Dato* che è in corso un altro flusso guidato, *quando* premo [➕ Aggiungi un'altra persona] su una conferma precedente, *allora* il pulsante si comporta come `/nuovo` in quella situazione.

**RF-02 — Inserimento e validazione della data** · MVP
Unico formato ammesso: `gg/mm/aaaa`, oppure `gg/mm` se l'anno è sconosciuto. Il bot risponde sempre con la data interpretata da confermare.
- *Dato* che scrivo `14/03/1994`, *quando* invio, *allora* il bot chiede "14 marzo 1994, giusto?" con Sì / Correggi.
- *Dato* che scrivo `31/04` o `14-3-94`, *quando* invio, *allora* il bot rifiuta la data e ripete il formato atteso.
- *Dato* che scrivo `29/02/1995` (anno non bisestile), *quando* invio, *allora* il bot rifiuta la data.
- *Dato* che scrivo `29/02` senza anno, *quando* invio, *allora* la data viene accettata.

**RF-03 — Scheda persona** · MVP · modificato in v1.1
Il comando `/p_<id>` mostra: nome e nickname, data di nascita, età che compirà e giorni mancanti, priorità, gruppi, telefono (se presente), messaggio personalizzato (se presente), storico esiti per anno.
*(v1.1)* Gli username di Instagram e Telegram non compaiono più nel testo. I contatti presenti diventano pulsanti (RF-11). Il telefono resta nel testo perché si possa chiamare o copiare (V-04).
Pulsanti, in quest'ordine:
- riga dei contatti: [WhatsApp] [Instagram] [Telegram], solo per i contatti presenti;
- [Segna fatto], se previsto da RF-21;
- [Modifica] [Elimina].

La stessa tastiera si usa quando la scheda viene ridisegnata dopo Segna fatto o dopo una modifica.
- *Dato* che tocco `/p_12` in una lista, *quando* il bot risponde, *allora* vedo la scheda della persona 12 con i pulsanti Modifica ed Elimina.
- *Dato* che l'anno di nascita non è noto, *quando* apro la scheda, *allora* l'età non compare.
- *(v1.1)* *Dato* che Marco ha telefono e Instagram ma non Telegram, *quando* apro la sua scheda, *allora* vedo il numero nel testo, i pulsanti [WhatsApp] [Instagram] sopra [Modifica] [Elimina], e nessuno username nel testo.
- *(v1.1)* *Dato* che premo WhatsApp nella scheda, *allora* si apre la chat con Marco senza testo precompilato, anche se c'è un'occorrenza aperta.
- *(v1.1)* *Dato* che una persona non ha contatti, *quando* apro la scheda, *allora* la riga dei contatti non compare.

**RF-04 — Modifica per campo** · MVP · modificato in v1.1
Modifica apre un menù di pulsanti: Nome · Nickname · Data · Telefono · Instagram · Telegram · Gruppi · Priorità · Messaggio. Il bot chiede solo il campo scelto, salva e rimostra la scheda. I campi opzionali hanno anche "Svuota". *(v1.1)* In Modifica → Telefono si può anche condividere un contatto, con le stesse regole di RF-01 (BR-25 e conferma).
- *(v1.1)* *Dato* che premo Modifica → Telefono e condivido un contatto, *quando* confermo il numero proposto, *allora* viene aggiornato solo il telefono e rivedo la scheda.
- *Dato* che sono nella scheda, *quando* premo Modifica → Instagram e invio un nuovo username, *allora* viene aggiornato solo quel campo e rivedo la scheda.
- *Dato* che premo Modifica → Telefono → Svuota, *quando* confermo, *allora* il telefono viene rimosso.

**RF-05 — Eliminazione persona** · MVP
- *Dato* che premo Elimina, *quando* il bot chiede "Eliminare Marco Rossi? Perderai anche lo storico" e premo Sì, *allora* persona, associazioni ai gruppi, occorrenze e storico vengono eliminati.
- *Dato* che premo Annulla, *allora* non cambia nulla.

**RF-06 — Annullamento dei flussi guidati** · MVP
- *Dato* che sono in un flusso guidato, *quando* scrivo `/annulla` o premo Annulla, *allora* il flusso si interrompe senza salvare nulla.

### 4.2 Gruppi

**RF-07 — Gestione gruppi** · MVP · modificato in v1.1 e v1.2
Il comando `/gruppi` elenca i gruppi con il numero di persone e permette di crearne, rinominarne ed eliminarne. Il nome è univoco senza distinzione tra maiuscole e minuscole.
*(v1.1)* `/gruppi` senza argomento (o l'alias `/gruppo`) mostra l'elenco gruppi come pulsanti, uno per gruppo, nella forma "Famiglia (8)":
- ordine alfabetico, su due colonne, più [➕ Nuovo gruppo];
- il tocco su un gruppo manda un nuovo messaggio con la scheda gruppo (RF-19), senza navigazione sul posto; *(v1.2)* dalla scheda si torna all'elenco con [⬅️ Tutti i gruppi] (RF-19);
- Rinomina ed Elimina si avviano dalla scheda gruppo, già sul gruppo scelto, senza il passaggio "Quale gruppo?";
- oltre 60 gruppi l'elenco è testuale, con l'invito a scrivere `/gruppi <nome>`;
- senza gruppi, il bot lo dice e mostra solo [➕ Nuovo gruppo]; *(v1.2)* più [Senza gruppo (N)] se ci sono persone.

*(v1.2)* **Voce "Senza gruppo".** Se ci sono persone senza alcun gruppo (N > 0), l'elenco mostra il pulsante [Senza gruppo (N)], senza emoji, su una riga a sé tra i gruppi e [➕ Nuovo gruppo]. Il tocco manda un nuovo messaggio con la scheda "Senza gruppo" (RF-19). Se N = 0 la voce non compare. Oltre 60 gruppi, con l'elenco testuale, [Senza gruppo (N)] resta come pulsante, insieme a [➕ Nuovo gruppo]. Non è un gruppo salvato: non entra nel limite dei 60 gruppi, non si cerca con `/gruppi <nome>` né con il filtro di `/prossimi`, e non va in export e backup.
- *(v1.1)* *Dato* che ho i gruppi Famiglia (8) e Lavoro (5), *quando* scrivo `/gruppi`, *allora* vedo i pulsanti [Famiglia (8)] [Lavoro (5)] e [➕ Nuovo gruppo].
- *(v1.1)* *Dato* che tocco [Famiglia (8)], *allora* ricevo un nuovo messaggio con la scheda gruppo di Famiglia.
- *(v1.1)* *Dato* che dalla scheda gruppo premo Rinomina, *allora* il bot chiede direttamente il nuovo nome di quel gruppo.
- *(v1.1)* *Dato* che premo un gruppo eliminato o rinominato nel frattempo, *allora* il bot segnala che il gruppo non esiste più e mostra l'elenco aggiornato.
- *Dato* che esiste "Famiglia", *quando* provo a creare "famiglia", *allora* il bot rifiuta per nome duplicato.
- *Dato* che rinomino "Lavoro" in "Ufficio", *allora* tutte le persone associate mostrano "Ufficio".
- *Dato* che elimino un gruppo con 8 persone, *quando* il bot chiede conferma indicando "8 persone perderanno questa etichetta" e confermo, *allora* il gruppo viene eliminato e le persone restano.
- *(v1.2)* *Dato* che 12 persone non hanno gruppi, *quando* scrivo `/gruppi`, *allora* sotto i gruppi vedo [Senza gruppo (12)] su una riga a sé, sopra [➕ Nuovo gruppo].
- *(v1.2)* *Dato* che tutte le persone hanno almeno un gruppo, *quando* scrivo `/gruppi`, *allora* la voce "Senza gruppo" non compare.
- *(v1.2)* *Dato* che non ho gruppi e ho 30 persone, *quando* scrivo `/gruppi`, *allora* il bot dice che non ci sono gruppi e mostra [Senza gruppo (30)] e [➕ Nuovo gruppo].
- *(v1.2)* *Dato* che ho più di 60 gruppi e 5 persone senza gruppo, *quando* scrivo `/gruppi`, *allora* vedo l'elenco testuale e i pulsanti [Senza gruppo (5)] e [➕ Nuovo gruppo].
- *(v1.2)* *Dato* che esiste un gruppo reale chiamato "Senza gruppo", *allora* compare tra i gruppi come gli altri, distinto dalla voce virtuale, che resta sulla sua riga.

**RF-08 — Assegnazione gruppi con creazione al volo** · MVP
Nello step Gruppi (inserimento o modifica) il bot mostra i gruppi esistenti come pulsanti a selezione multipla (attiva/disattiva), più "➕ Nuovo gruppo" e "Fine".
- *Dato* che sono nello step Gruppi, *quando* premo "Nuovo gruppo" e scrivo "Beach tennis", *allora* il gruppo viene creato e risulta già selezionato.

### 4.3 Promemoria

**RF-09 — Pre-reminder** · MVP
Inviati alle 13:00 dei giorni previsti dal profilo (vedi §7). Sono informativi e hanno il solo pulsante "Salta quest'anno".
- *Dato* che Marco ha priorità Alta e compie gli anni il 14/03, *quando* sono le 13:00 del 07/03, *allora* ricevo "Tra 7 giorni: compleanno di Marco (32 anni) — 14/03".
- *Dato* che premo "Salta quest'anno" su un pre-reminder, *allora* l'occorrenza diventa *saltato* e non riceverò altri pre-reminder, reminder o recuperi per quest'anno.

**RF-10 — Reminder del giorno** · MVP · modificato in v1.3
Un messaggio **per persona** in ogni slot previsto dal profilo, finché l'occorrenza è aperta. Contenuto: nickname e nome completo (se diversi), età (se l'anno è noto), gruppi, esito dell'anno precedente (solo *fatto* o *saltato*), pulsanti di contatto (RF-11), Fatto, Salta quest'anno.
- *Dato* che due persone compiono gli anni lo stesso giorno, *quando* scatta lo slot, *allora* ricevo due messaggi separati, ciascuno con i propri pulsanti.
- *Dato* che l'anno scorso l'occorrenza era *non confermato*, *quando* ricevo il reminder, *allora* la riga "L'anno scorso" non compare.

*(v1.3)* **Slot delle 00:00.** Per le persone con priorità Alta il primo reminder del giorno parte alle 00:00 della data effettiva, in ora locale (§7), per fare gli auguri allo scoccare del compleanno. È uno slot a tutti gli effetti: suona come gli altri reminder, ha lo stesso contenuto e gli stessi pulsanti, vale l'idempotenza (N-02), il nuovo tentativo entro la giornata anche nelle ore notturne (N-03), e compare in `/stato` (RF-31). Media e Bassa non cambiano.
- *(v1.3)* *Dato* che Marco ha priorità Alta e compie gli anni il 14/03, *quando* sono le 00:00 del 14/03, *allora* ricevo il reminder del giorno con notifica sonora, i pulsanti di contatto, Fatto e Salta quest'anno.
- *(v1.3)* *Dato* che premo Fatto sul reminder delle 00:00, *allora* non ricevo gli slot delle 9:00, 13:00, 18:00 e 21:00 né il recupero (BR-07).
- *(v1.3)* *Dato* che non chiudo il reminder delle 00:00, *allora* alle 9:00 ricevo il reminder successivo, come oggi.
- *(v1.3)* *Dato* che Anna ha priorità Media, *quando* è il giorno del suo compleanno, *allora* alle 00:00 non parte nulla e il primo reminder arriva alle 9:00.
- *(v1.3)* *Dato* che l'invio delle 00:00 fallisce per un errore di Telegram, *allora* viene ritentato alle 1:00 e alle esecuzioni successive della stessa giornata (N-03).
- *(v1.3)* *Dato* che inserisco una persona con priorità Alta alle 10:00 del giorno del suo compleanno, *allora* lo slot delle 00:00 non parte (BR-10, BR-11).
- *(v1.3)* *Dato* che Anna ha priorità Alta ed è nata il 29/02, *quando* l'anno non è bisestile, *allora* il reminder delle 00:00 parte alle 00:00 del 28/02 (BR-04).

**RF-11 — Pulsanti di contatto** · MVP · modificato in v1.1
Compaiono solo per i contatti presenti nella scheda. *(v1.1)* Si usano nei promemoria (reminder, recupero, `/oggi`) e nella scheda persona (RF-03). Il testo precompilato di WhatsApp e il pulsante Copia messaggio valgono solo nei promemoria. Nella scheda WhatsApp apre la chat vuota (`wa.me/<numero>`) e Copia messaggio non c'è. Le etichette dei pulsanti di contatto non hanno icone (RNF-19).
| Pulsante | Destinazione | Testo precompilato |
|---|---|---|
| WhatsApp | `wa.me/<numero>?text=<messaggio>` | Sì |
| Instagram | `ig.me/m/<username>` | No (non supportato) |
| Telegram | `t.me/<username>` | No (non supportato) |
| Copia messaggio | Copia il messaggio di auguri negli appunti | — |
Il numero di telefono compare nel testo del reminder: Telegram lo rende cliccabile per chiamare o copiarlo (vedi §10, vincolo V-04).
- *Dato* che Marco ha solo telefono e Instagram, *quando* ricevo il reminder, *allora* vedo WhatsApp, Instagram e Copia messaggio, ma non Telegram.
- *Dato* che premo WhatsApp, *allora* si apre la chat con Marco e il messaggio di auguri già scritto, senza età.
- *Dato* che una persona non ha telefono (mai inserito o svuotato con Modifica), *quando* ricevo il reminder, *allora* il pulsante WhatsApp non compare.

**RF-12 — Chiusura: Fatto / Salta quest'anno** · MVP
- *Dato* che premo Fatto su un reminder, *allora* l'occorrenza diventa *fatto*, non ricevo altri slot né il recupero, e il messaggio si aggiorna mostrando "✅ Fatto" (i pulsanti di contatto restano).
- *Dato* che premo Salta quest'anno, *allora* l'occorrenza diventa *saltato*, con gli stessi effetti.

**RF-13 — Recupero del giorno dopo** · MVP
Vale per tutte le priorità. Se a fine giornata l'occorrenza è aperta, il giorno dopo alle 13:00 arriva "Ieri era il compleanno di X, hai fatto gli auguri?" con Fatto / Saltato e i pulsanti di contatto.
- *Dato* che non ho chiuso l'occorrenza, *quando* sono le 13:00 del giorno dopo, *allora* ricevo il recupero, una sola volta.
- *Dato* che non rispondo al recupero, *quando* termina il giorno dopo, *allora* l'occorrenza diventa *non confermato* senza ulteriori messaggi.

**RF-14 — Storico esiti** · MVP
Ogni occorrenza conserva il suo esito per anno. Lo storico è visibile nella scheda e alimenta "L'anno scorso" (RF-10) e `/anno` (RF-22).

**RF-15 — Messaggio di auguri** · MVP
Esiste un messaggio di default globale con segnaposto `{nome}` (sostituito dal nickname, o dal nome se il nickname manca). Si modifica con `/messaggio`. Ogni persona può avere un messaggio personalizzato che sostituisce il default.
- *Dato* che il default è "Tanti auguri {nome}! 🎉" e Marco ha nickname "Marchino", *quando* premo WhatsApp, *allora* il testo è "Tanti auguri Marchino! 🎉".
- *Dato* che Anna ha un messaggio personalizzato, *quando* premo WhatsApp sul suo reminder, *allora* viene usato il suo messaggio e non il default.
- *Dato* che uso `/messaggio` e invio un nuovo testo, *allora* il bot mostra un'anteprima con un nome d'esempio e chiede conferma.

### 4.4 Viste e ricerche

Tutte le liste di persone sono testuali (l'elenco gruppi a pulsanti di RF-07 non è una lista di persone, RNF-14): una riga per persona con giorno della settimana, data, nickname (o nome), età che compirà (se nota) e comando `/p_<id>`. Ordinamento per prossimo compleanno.

**RF-16 — `/oggi`** · MVP
- *Dato* che oggi ci sono compleanni, *quando* scrivo `/oggi`, *allora* ricevo per ciascuno lo stesso messaggio del reminder del giorno, con i suoi pulsanti e lo stato attuale.
- *Dato* che oggi non ci sono compleanni, *allora* il bot lo dice e indica il prossimo.

**RF-17 — `/prossimi [giorni] [gruppo]`** · MVP · modificato in v1.1 e v1.2
Default 30 giorni, massimo 366. Filtro per gruppo opzionale. *(v1.1)* Il gruppo si cerca con la stessa regola di `/gruppi <nome>` (BR-26).
*(v1.2)* Se la finestra è sotto i 90 giorni, in fondo alla lista compare il pulsante di passo successivo [Prossimi 90 giorni] (RNF-14): manda un nuovo messaggio con la stessa vista su 90 giorni, con lo stesso filtro di gruppo. Il pulsante compare anche quando la lista è vuota.
- *(v1.2)* *Dato* che scrivo `/prossimi`, *allora* in fondo alla lista dei 30 giorni vedo [Prossimi 90 giorni] e il tocco mi manda la lista dei prossimi 90 giorni.
- *(v1.2)* *Dato* che scrivo `/prossimi 7 famiglia`, *quando* premo [Prossimi 90 giorni], *allora* vedo i prossimi 90 giorni del solo gruppo Famiglia.
- *(v1.2)* *Dato* che scrivo `/prossimi 120`, *allora* il pulsante non compare.
- *(v1.2)* *Dato* che il gruppo del filtro è stato eliminato nel frattempo, *quando* premo [Prossimi 90 giorni], *allora* il bot si comporta come con un gruppo che non esiste.
- *Dato* che scrivo `/prossimi 7 famiglia`, *allora* vedo i compleanni dei prossimi 7 giorni delle persone del gruppo Famiglia.
- *(v1.1)* *Dato* che il gruppo si chiama "👨‍👩‍👧 Famiglia", *quando* scrivo `/prossimi 7 fam`, *allora* vedo la lista filtrata su quel gruppo.
- *(v1.1)* *Dato* che "fam" corrisponde a "Famiglia" e "Famiglia Rossi", *quando* scrivo `/prossimi 7 fam`, *allora* il bot mostra un pulsante per ciascun gruppo; il tocco rilancia la lista dei prossimi 7 giorni filtrata su quel gruppo.
- *Dato* che il gruppo indicato non esiste, *allora* il bot lo segnala ed elenca i gruppi esistenti. *(v1.1)* L'elenco è quello a pulsanti di RF-07.

**RF-18 — `/cerca <testo>`** · MVP
Ricerca per parte del nome o del nickname, senza distinzione tra maiuscole e minuscole.
- *Dato* che un solo risultato corrisponde, *allora* il bot apre direttamente la scheda.
- *Dato* che corrispondono più risultati, *allora* il bot mostra la lista.

**RF-19 — `/gruppi <nome>` e scheda gruppo** · MVP · modificato in v1.1 e v1.2
- *Dato* che scrivo `/gruppo lavoro`, *allora* vedo tutte le persone del gruppo, ordinate per prossimo compleanno.

*(v1.1)* `/gruppi <testo>` e `/gruppo <testo>` sono lo stesso comando: `/gruppo` resta accettato come alias, ma nel menu e in `/aiuto` compare solo `/gruppi [nome]`. Il testo si cerca come parte del nome del gruppo, secondo BR-26.
- Un solo gruppo trovato, oppure una corrispondenza esatta: si apre la scheda gruppo.
- Più gruppi trovati e nessuna corrispondenza esatta: un pulsante per ogni gruppo trovato; il tocco apre la scheda gruppo.
- Nessun gruppo trovato: il bot lo segnala e mostra l'elenco gruppi di RF-07.
- Senza argomento: l'elenco gruppi di RF-07.

La **scheda gruppo** contiene:
- titolo con il nome del gruppo e il numero di persone;
- la lista delle persone nel formato §5.7, ordinata per prossimo compleanno, con i comandi `/p_<id>`;
- i pulsanti [✏️ Rinomina] [🗑 Elimina], che agiscono su quel gruppo. Se la lista è spezzata in più messaggi, i pulsanti stanno sull'ultimo;
- *(v1.2)* sotto, su una riga a sé, il pulsante [⬅️ Tutti i gruppi], che manda un nuovo messaggio con l'elenco gruppi, come `/gruppi` senza argomento (RF-07: pulsanti fino a 60 gruppi, oltre elenco testuale). Se la lista è spezzata, sta sull'ultimo messaggio con gli altri pulsanti. La scheda resta in chat così com'era.

*(v1.2)* La **scheda "Senza gruppo"** si apre solo dal pulsante [Senza gruppo (N)] dell'elenco (RF-07) e ha lo stesso formato della scheda gruppo: titolo "Senza gruppo" con il numero di persone, lista §5.7 ordinata per prossimo compleanno con i comandi `/p_<id>`. Non ha Rinomina ed Elimina: ha il solo [⬅️ Tutti i gruppi]. Per dare un gruppo a una persona si usa la scheda persona (Modifica → Gruppi, RF-04, RF-08); la gestione dei membri dalla scheda resta un'idea futura (RF-52).

Valgono BR-17 e la conferma dell'eliminazione con il conteggio delle persone (RF-07, RNF-05).
- *(v1.1)* *Dato* che il gruppo si chiama "👨‍👩‍👧 Famiglia", *quando* scrivo `/gruppi fam`, *allora* si apre la sua scheda gruppo.
- *(v1.1)* *Dato* che esistono "Lavoro" e "Lavoro ex", *quando* scrivo `/gruppi lavoro`, *allora* si apre direttamente "Lavoro" (la corrispondenza esatta vince).
- *(v1.1)* *Dato* che "fam" corrisponde a "Famiglia" e "Famiglia Rossi", *quando* scrivo `/gruppi fam`, *allora* vedo due pulsanti e il tocco apre la scheda del gruppo scelto.
- *(v1.1)* *Dato* che il gruppo non ha persone, *quando* apro la scheda gruppo, *allora* vedo il nome, "0 persone" e i pulsanti Rinomina ed Elimina. *(v1.2)* Sotto c'è anche [⬅️ Tutti i gruppi].
- *(v1.2)* *Dato* che sono nella scheda gruppo di Famiglia, *quando* premo [⬅️ Tutti i gruppi], *allora* ricevo un nuovo messaggio con l'elenco gruppi a pulsanti, e la scheda di Famiglia resta in chat.
- *(v1.2)* *Dato* che la scheda gruppo è spezzata in due messaggi, *allora* [✏️ Rinomina] [🗑 Elimina] e [⬅️ Tutti i gruppi] stanno sul secondo.
- *(v1.2)* *Dato* che ho più di 60 gruppi, *quando* premo [⬅️ Tutti i gruppi], *allora* ricevo l'elenco testuale con l'invito a scrivere `/gruppi <nome>`.
- *(v1.2)* *Dato* che 12 persone non hanno gruppi, *quando* premo [Senza gruppo (12)], *allora* vedo "Senza gruppo · 12 persone", la loro lista per prossimo compleanno con `/p_<id>` e il solo pulsante [⬅️ Tutti i gruppi].
- *(v1.2)* *Dato* che nel frattempo ho dato un gruppo a tutte le persone, *quando* premo [Senza gruppo (N)] su un elenco precedente, *allora* il bot dice che ora tutte le persone hanno un gruppo e mostra l'elenco gruppi aggiornato.
- *(v1.2)* *Dato* che scrivo `/gruppi senza`, *allora* il testo si cerca solo tra i gruppi salvati (BR-26) e la scheda "Senza gruppo" non si apre.

**RF-20 — `/mese [mese]`** · MVP · modificato in v1.2
Default: mese corrente. Il mese si indica per nome ("marzo") o per numero.
*(v1.2)* In fondo alla vista compaiono i pulsanti di passo successivo [◀️ <mese precedente>] [<mese successivo> ▶️] (RNF-14), con il nome del mese per esteso. Ognuno manda un nuovo messaggio con `/mese` di quel mese. Lo scorrimento è circolare: prima di gennaio viene dicembre e dopo dicembre viene gennaio. I pulsanti compaiono anche se il mese mostrato non ha compleanni. Il pulsante porta solo il mese: l'anno di riferimento (età e intestazione) segue la regola di `/mese`, cioè anno corrente per il mese corrente e i successivi, anno prossimo per i mesi già passati.
- *Dato* che scrivo `/mese marzo`, *allora* vedo tutti i compleanni di marzo ordinati per giorno.
- *(v1.2)* *Dato* che scrivo `/mese marzo`, *allora* in fondo vedo [◀️ Febbraio] [Aprile ▶️], e il tocco su [Aprile ▶️] mi manda la vista di aprile.
- *(v1.2)* *Dato* che scrivo `/mese dicembre`, *allora* vedo [◀️ Novembre] [Gennaio ▶️].
- *(v1.2)* *Dato* che scrivo `/mese gennaio`, *allora* vedo [◀️ Dicembre] [Febbraio ▶️].
- *(v1.2)* *Dato* che oggi è il 29/10/2026 e scrivo `/mese`, *quando* premo [◀️ Settembre], *allora* vedo settembre 2027, con le età che si compiranno in quell'anno.

**RF-21 — `/scaduti`** · MVP
Compleanni degli ultimi 7 giorni con esito diverso da *fatto*. Dalla scheda, per un'occorrenza degli ultimi 7 giorni non *fatto*, è disponibile il pulsante "Segna fatto".
- *Dato* che sono stato in vacanza, *quando* scrivo `/scaduti`, *allora* vedo chi ho saltato o non confermato e posso aprirne la scheda per segnarlo come fatto.

**RF-22 — `/anno [anno]`** · MVP · modificato in v1.2
Riepilogo dell'anno (default: corrente): numero di occorrenze *fatto*, *saltato*, *non confermato*; elenco dei saltati; persone saltate per 2 o più anni consecutivi.
*(v1.2)* In fondo al riepilogo compaiono i pulsanti di passo successivo (RNF-14), ognuno con un nuovo messaggio con `/anno` di quell'anno:
- [◀️ <anno − 1>], solo se l'anno precedente ha almeno un'occorrenza nello storico;
- [<anno + 1> ▶️], solo se l'anno mostrato è precedente all'anno corrente (Europe/Rome).

Se nessuna delle due condizioni vale, non compare alcun pulsante.
- *(v1.2)* *Dato* che siamo nel 2026 e ho uno storico dal 2025, *quando* scrivo `/anno`, *allora* vedo solo [◀️ 2025].
- *(v1.2)* *Dato* che premo [◀️ 2025] e il 2024 non ha storico, *allora* vedo il riepilogo del 2025 con il solo [2026 ▶️].
- *(v1.2)* *Dato* che siamo nel primo anno d'uso e non c'è storico precedente, *quando* scrivo `/anno`, *allora* non compare alcun pulsante.
- *(v1.2)* *Dato* che scrivo `/anno 2023`, anno senza storico, e il 2022 non ha storico, *allora* vedo il riepilogo vuoto con il solo [2024 ▶️].

**RF-50 — `/incomplete [campo]`: profili incompleti** · v1.3 (anticipato dalle idee future e allargato ai singoli campi)
Elenca le persone a cui manca un dato, per completarne la scheda con Modifica (RF-04). I filtri sono separati e si usano uno alla volta:

| Filtro (pulsante) | Argomento | Persone elencate |
|---|---|---|
| Telefono | `telefono` | senza telefono |
| Instagram | `instagram` | senza username Instagram |
| Telegram | `telegram` | senza username Telegram |
| Anno di nascita | `anno` | senza anno di nascita (giorno e mese sono sempre presenti, BR-18) |
| Nessun contatto | `contatti` | senza telefono, senza Instagram e senza Telegram: la stessa definizione del conteggio "Senza contatti" di RF-32 |

- **Senza argomento** il bot mostra l'intestazione "📝 Profili incompleti" e un pulsante per filtro, nell'ordine della tabella, con il numero di persone: "Telefono (41)". I filtri con 0 persone compaiono comunque. Il tocco manda un nuovo messaggio con la lista di quel filtro (RNF-14); il messaggio con i pulsanti resta com'era.
- **Con argomento** (senza distinzione tra maiuscole e minuscole) il bot manda subito la lista. Con un argomento non riconosciuto lo segnala e mostra i pulsanti dei filtri.
- **Lista**: intestazione con il filtro e il numero di persone ("📝 Senza telefono · 41 persone"), righe nel formato §5.7 con il comando `/p_<id>`, ordinate per prossimo compleanno, così si completa prima chi festeggia a breve. Nella riga non compaiono i gruppi. Se la lista è lunga, si spezza in più messaggi. Non ci sono pulsanti sulle righe né pulsanti di passo successivo.
- **Lista vuota**: il bot conferma che il dato è presente per tutti ("✅ Tutte le persone hanno il telefono."). Se la rubrica è vuota, dice che non ci sono persone.
- Conteggi e liste si calcolano al momento: un pulsante premuto su un messaggio vecchio mostra la lista con i dati attuali.
- *(v1.3)* *Dato* che 41 persone non hanno il telefono, *quando* scrivo `/incomplete`, *allora* vedo i 5 pulsanti con i rispettivi conteggi, tra cui [Telefono (41)].
- *(v1.3)* *Dato* che premo [Telefono (41)], *allora* ricevo un nuovo messaggio "📝 Senza telefono · 41 persone" con le righe ordinate per prossimo compleanno e i comandi `/p_<id>`.
- *(v1.3)* *Dato* che scrivo `/incomplete instagram`, *allora* ricevo subito la lista delle persone senza username Instagram, senza passare dai pulsanti.
- *(v1.3)* *Dato* che scrivo `/incomplete Anno`, *allora* ricevo la lista delle persone senza anno di nascita.
- *(v1.3)* *Dato* che scrivo `/incomplete email`, *allora* il bot segnala che il filtro non esiste e mostra i pulsanti dei filtri.
- *(v1.3)* *Dato* che Marco ha l'Instagram ma non il telefono né il Telegram, *allora* compare nelle liste Telefono e Telegram ma non in Nessun contatto.
- *(v1.3)* *Dato* che tutte le persone hanno il telefono, *quando* premo [Telefono (0)], *allora* il bot risponde "✅ Tutte le persone hanno il telefono.".
- *(v1.3)* *Dato* che apro `/p_<id>` da una lista e aggiungo il telefono con Modifica, *quando* riscrivo `/incomplete telefono`, *allora* quella persona non compare più.
- *(v1.3)* *Dato* che la lista supera la lunghezza di un messaggio Telegram, *allora* è spezzata in più messaggi, come le altre liste.

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

**RF-28 — `/start` e `/aiuto`** · MVP · modificato in v1.3
`/start` mostra un benvenuto con i pulsanti: Aggiungi persona · Scarica modello CSV · Comandi. `/aiuto` elenca i comandi con una riga di descrizione ciascuno.
*(v1.3)* `/incomplete [campo]` (RF-50) compare in `/aiuto` e nel menu dei comandi, tra le viste. I pulsanti di `/start` non cambiano.

**RF-29 — `/id`** · MVP
Risponde a **chiunque** con il suo ID Telegram numerico. Serve per configurare la whitelist.

**RF-30 — Whitelist del proprietario** · MVP
- *Dato* che un utente diverso dal proprietario scrive al bot, *quando* invia un qualsiasi comando diverso da `/id`, *allora* il bot non risponde e non salva nulla.

### 4.7 Stato e statistiche *(v1.1)*

**RF-31 — `/stato`** · v1.1
Mostra lo stato di salute del bot:
- ora dell'ultima esecuzione del cron;
- invii di oggi e degli ultimi 7 giorni, divisi in inviati, falliti (in attesa di nuovo tentativo) e abbandonati, con nome e tipo di promemoria per ogni abbandonato;
- data ed esito dell'ultimo backup mensile;
- stato del webhook letto da Telegram: data e testo dell'ultimo errore, numero di update in coda.

Se un valore non è ancora stato registrato, compare "mai registrato". Se la lettura dello stato del webhook non riesce, il resto viene mostrato comunque, con la sola riga del webhook segnata come non disponibile.
- *Dato* che il cron gira regolarmente e oggi sono partiti 3 reminder, *quando* scrivo `/stato`, *allora* vedo l'ultima esecuzione dell'ora corrente e "Oggi: 3 inviati, 0 falliti, 0 abbandonati".
- *Dato* che un reminder di ieri è stato abbandonato dopo i tentativi (N-03), *quando* scrivo `/stato`, *allora* lo vedo nella riga degli ultimi 7 giorni con il nome della persona.
- *Dato* che il bot è appena stato aggiornato e il cron non ha ancora girato, *quando* scrivo `/stato`, *allora* l'ultimo controllo orario risulta "mai registrato".

**RF-32 — `/statistiche`** · v1.1 · modificato in v1.2 e v1.3
Mostra cifre sintetiche sulla rubrica e sull'andamento. Per il dettaglio di un singolo anno resta `/anno` (RF-22).
- totale persone, con la suddivisione per priorità e per gruppo (una persona in più gruppi conta in ciascuno); *(v1.2)* in fondo alla riga dei gruppi, "Senza gruppo N" con il numero di persone senza alcun gruppo;
- compleanni per mese, come istogramma testuale di 12 righe;
- *(v1.2)* distribuzione per età (sezione "🧑 Età"), subito dopo l'istogramma per mese;
- numero di persone senza anno di nascita e numero di persone senza alcun contatto (solo conteggi, senza elenchi);
- percentuale di *fatto* sul totale delle occorrenze chiuse, per ciascun anno con storico, dal più recente.

*(v1.2)* **Sezione Età.** Conta solo le persone con l'anno di nascita. L'età è quella attuale, cioè gli anni compiuti all'ultimo compleanno alla data di oggi in Europe/Rome (BR-03); per chi è nato il 29/02, negli anni non bisestili il compleanno si considera compiuto il 28/02 (BR-04).
- Istogramma testuale per decadi (0-9, 10-19, …, 70-79), più una fascia finale unica "80+".
- Le righe vanno dalla decade più bassa alla più alta tra quelle con almeno una persona; le decadi vuote intermedie compaiono con 0.
- In fondo alla sezione: "Età media: N anni", arrotondata all'intero più vicino (0,5 per eccesso), e il richiamo al numero di persone senza anno di nascita, escluse dal calcolo.
- Se nessuna persona ha l'anno di nascita, la sezione dice che l'età non è disponibile.
- Solo conteggi: niente nomi della persona più giovane o più anziana.
- *Dato* che ho 112 persone, *quando* scrivo `/statistiche`, *allora* vedo il totale, le suddivisioni per priorità, per gruppo e per mese, i conteggi delle schede senza anno e senza contatti, e la percentuale di *fatto* per anno.
- *Dato* che non c'è ancora uno storico, *quando* scrivo `/statistiche`, *allora* la sezione sull'andamento dice che non ci sono ancora anni con esiti.
- *(v1.2)* *Dato* che 12 persone non hanno gruppi, *quando* scrivo `/statistiche`, *allora* la riga dei gruppi termina con "Senza gruppo 12".
- *(v1.2)* *Dato* che ho persone di 8, 34, 37 e 52 anni, *quando* scrivo `/statistiche`, *allora* la sezione Età mostra 0-9 1, 10-19 0, 20-29 0, 30-39 2, 40-49 0, 50-59 1 e "Età media: 33 anni".
- *(v1.2)* *Dato* che oggi è il 29/10/2026 e Marco è nato il 14/03/1994, *allora* conta come 32 anni, nella decade 30-39.
- *(v1.2)* *Dato* che oggi è il 10/03/2026 e Marco è nato il 14/03/1994, *allora* conta come 31 anni, perché il compleanno di quest'anno non è ancora passato.
- *(v1.2)* *Dato* che Anna è nata il 29/02/2000 e oggi è il 28/02/2026, *allora* conta come 26 anni (BR-04).
- *(v1.2)* *Dato* che ho persone di 83 e 91 anni, *allora* entrambe stanno nella fascia "80+".
- *(v1.2)* *Dato* che 23 persone non hanno l'anno di nascita, *allora* sono escluse dall'istogramma e dall'età media, e la sezione lo richiama.
- *(v1.2)* *Dato* che nessuna persona ha l'anno di nascita, *allora* la sezione Età dice che l'età non è disponibile.

*(v1.3)* **Profili incompleti.** In fondo al messaggio compare il pulsante di passo successivo [📝 Profili incompleti] (RNF-14): manda un nuovo messaggio con i pulsanti dei filtri di `/incomplete` (RF-50). I conteggi "Senza anno di nascita" e "Senza contatti" restano testo, senza elenchi né pulsanti.
- *(v1.3)* *Dato* che scrivo `/statistiche`, *allora* in fondo vedo [📝 Profili incompleti] e il tocco mi manda i pulsanti dei filtri, come `/incomplete`.
- *(v1.3)* *Dato* che la rubrica è vuota, *allora* il pulsante compare comunque e i filtri mostrano 0.

### 4.8 Evoluzioni

**RF-40 — Configurabilità esterna** · v2: fuso orario, orari degli slot e profili di priorità modificabili senza toccare il codice.
**RF-41 — README e guida all'installazione** · v2 (vedi §12).
**RF-42 — Script di setup** PowerShell e Bash per la creazione del database, dei segreti e la registrazione del webhook · v2.
**RF-43 — Pubblicazione del repository** con licenza MIT · v2.
*(v1.3)* RF-50 (Vista schede incomplete) è stato anticipato nella v1.3 come `/incomplete [campo]`: vedi §4.4.
**RF-51 — Multilingua completo** · Futuro.
**RF-52 — Gestione dei membri dalla scheda gruppo** (aggiungere o togliere persone da un gruppo partendo dalla scheda gruppo) · Futuro *(v1.1)*. Oggi si fa dalla scheda persona (RF-08).

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
| `/gruppi [nome]` *(v1.1)* | Senza nome: elenco gruppi a pulsanti, *(v1.2)* con la voce "Senza gruppo". Con nome: ricerca e scheda gruppo. Alias accettato: `/gruppo` | RF-07, RF-19 |
| `/scaduti` | Ultimi 7 giorni non fatti | RF-21 |
| `/anno [anno]` | Riepilogo annuale | RF-22 |
| `/incomplete [campo]` *(v1.3)* | Profili incompleti: senza campo, pulsanti dei filtri con i conteggi; con campo (`telefono`, `instagram`, `telegram`, `anno`, `contatti`), la lista | RF-50 |
| `/statistiche` *(v1.1)* | Statistiche della rubrica e andamento | RF-32 |
| `/stato` *(v1.1)* | Salute di cron, invii, backup e webhook | RF-31 |
| `/messaggio` | Modifica messaggio di default | RF-15 |
| `/modello` | Scarica il modello CSV | RF-23 |
| `/export` | Esporta CSV | RF-25 |
| `/backup` | Backup JSON | RF-26 |
| `/ripristina` | Ripristino da JSON | RF-26 |
| `/annulla` | Interrompe un flusso guidato | RF-06 |
| `/id` | Mostra il proprio ID Telegram | RF-29 |

*(v1.1)* Tutti i mockup seguono la guida di stile RNF-19. Sono indicativi del tono e della struttura: i testi definitivi stanno nel punto unico dei testi (RNF-15).

### 5.2 Inserimento persona (esempio) *(v1.1, modificato in v1.2)*
```
Tu:  /nuovo
Bot: 👤 Come si chiama? Nome e cognome                [Annulla]
Tu:  Marco Rossi
Bot: 💬 Come lo chiami nei messaggi? (nickname)       [⏭ Salta]
Tu:  Marchino
Bot: 🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno
Tu:  14/03/1994
Bot: 14 marzo 1994, giusto?                           [Sì] [Correggi]
Bot: 📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)
     oppure condividi il contatto 📎                   [⏭ Salta]
Tu:  [condivide il contatto di Marco]
Bot: 📱 +393331234567, giusto?                        [Sì] [Correggi]
Bot: 📸 Username Instagram?                           [⏭ Salta]
Bot: ✈️ Username Telegram?                            [⏭ Salta]
Bot: 👥 Gruppi?     [☐ Famiglia] [☑ Beach tennis] [☐ Lavoro]
                    [➕ Nuovo gruppo] [Fine]
Bot: ⭐ Priorità?   [Alta] [Media ✓] [Bassa]
Bot: ✍️ Messaggio di auguri personalizzato? Se salti uso quello standard.  [⏭ Salta]
Bot: 📋 Riepilogo: … (scheda)                         [Salva] [Annulla]
Tu:  [Salva]
Bot: 🎉 Fatto! Marchino è in rubrica.

     👤 Marco Rossi — "Marchino"
     … (scheda, §5.6)
     [WhatsApp] [Instagram]
     [✏️ Modifica] [🗑 Elimina]
     [➕ Aggiungi un'altra persona]
```
*(v1.2)* [➕ Aggiungi un'altra persona] compare solo in questo messaggio, non quando la scheda si apre con `/p_<id>` (RF-01).

### 5.3 Reminder del giorno *(v1.1)*
```
🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni!
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

### 5.6 Scheda *(v1.1)*
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

### 5.7 Liste (`/prossimi`, `/mese`, `/gruppi <nome>`, `/cerca`, `/incomplete`) *(v1.1, modificato in v1.2 e v1.3)*
```
📆 Prossimi 30 giorni (Famiglia)

Gio 30/10  Anna (28)      /p_4
Dom 02/11  Luca (35)      /p_17
Mer 12/11  Giulia         /p_9

[Prossimi 90 giorni]
```
In `/mese` le righe sono raggruppate per settimana o in ordine di giorno; nelle altre viste la lista è continua. Le emoji stanno solo nell'intestazione, mai nelle righe (RNF-19).

*(v1.2)* Pulsanti di passo successivo (RNF-14), sempre in fondo e mai sulle righe delle persone:
```
🗓 Compleanni di marzo 2027
…
[◀️ Febbraio] [Aprile ▶️]

🗂 Riepilogo 2025
…
[2026 ▶️]
```
`/cerca` non ha pulsanti di passo successivo. *(v1.3)* Nemmeno le liste di `/incomplete` (§5.13).

### 5.8 Import CSV *(v1.1)*
```
Tu:  [invia compleanni.csv]
Bot: 📥 Anteprima import
     104 persone nuove
     5 duplicati (saltati): Marco Rossi 14/03, …
     ⚠️ 3 errori: riga 12 data "31/04" non valida; riga 40 nome mancante; …
     Gruppi da creare: Calcetto, Università
     [Importa] [Annulla]
Tu:  [Importa]
Bot: 🎉 Importate 104 persone, creati 2 gruppi.
```

### 5.9 Elenco gruppi e scheda gruppo *(v1.1, modificato in v1.2)*
```
Tu:  /gruppi
Bot: 👥 I tuoi gruppi
     [Beach tennis (6)]  [Famiglia (8)]
     [Lavoro (5)]        [Università (12)]
     [Senza gruppo (12)]
     [➕ Nuovo gruppo]
Tu:  [Famiglia (8)]
Bot: 👥 Famiglia · 8 persone

     Gio 30/10  Anna (28)      /p_4
     Dom 02/11  Luca (35)      /p_17
     …
     [✏️ Rinomina] [🗑 Elimina]
     [⬅️ Tutti i gruppi]
Tu:  [⬅️ Tutti i gruppi]
Bot: 👥 I tuoi gruppi
     … (nuovo messaggio con l'elenco)
Tu:  [Senza gruppo (12)]
Bot: 👥 Senza gruppo · 12 persone

     Sab 01/11  Paolo (41)     /p_23
     …
     [⬅️ Tutti i gruppi]

Tu:  /gruppi fam
Bot: 🔍 Più gruppi corrispondono a «fam»:
     [Famiglia (8)] [Famiglia Rossi (3)]
```

### 5.10 Stato *(v1.1)*
```
Tu:  /stato
Bot: 🩺 Stato del bot
     ⏱ Ultimo controllo orario: oggi alle 15:00
     📨 Oggi: 3 inviati, 0 falliti, 0 abbandonati
     📨 Ultimi 7 giorni: 21 inviati, 0 falliti, 1 abbandonato
        – Luca, reminder delle 18:00 del 25/10
     💾 Ultimo backup mensile: 01/10 alle 9:00 ✅
     🔗 Webhook: nessun errore, 0 update in coda
```

### 5.11 Statistiche *(v1.1, modificato in v1.2 e v1.3)*
```
Tu:  /statistiche
Bot: 📊 Statistiche
     112 persone · Alta 18 · Media 70 · Bassa 24
     Gruppi: Famiglia 8 · Lavoro 5 · Beach tennis 6 · … · Senza gruppo 12
     Senza anno di nascita: 23 · Senza contatti: 41

     🎂 Compleanni per mese
     Gen ████████  11
     Feb █████      7
     …

     🧑 Età
     0-9   ██         3
     10-19 █          2
     20-29 ██████    14
     30-39 ████████  21
     …
     80+   █          1
     Età media: 41 anni · senza anno di nascita: 23

     ✅ Auguri fatti: 2026 87% · 2025 81%

     [📝 Profili incompleti]
```

### 5.12 Avviso di buco del cron *(v1.1)*
```
⚠️ Il controllo orario non è girato dalle 14:00 alle 19:00 di oggi:
alcuni promemoria potrebbero essere andati persi. Controlla /oggi e /scaduti.
```

### 5.13 Profili incompleti *(v1.3)*
```
Tu:  /incomplete            (oppure [📝 Profili incompleti] da /statistiche)
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

Tu:  /incomplete telefono   (stessa lista, senza passare dai pulsanti)

Tu:  /incomplete anno
Bot: ✅ Tutte le persone hanno l'anno di nascita.
```
Le righe hanno il formato §5.7, senza gruppi. I pulsanti dei filtri sono senza emoji, come quelli dei gruppi (RNF-19).

## 6. Regole di business e casi limite

### Date ed età
- **BR-01** Formato unico `gg/mm/aaaa` o `gg/mm`; vale sia nel bot sia nel CSV.
- **BR-02** L'anno, se presente, non può essere futuro né precedente al 1900.
- **BR-03** Età = anno dell'occorrenza − anno di nascita. Mostrata solo all'utente, **mai** nel messaggio di auguri. *(v1.2)* Eccezione: in `/statistiche` (RF-32) si usa l'età attuale, cioè gli anni compiuti alla data di oggi (anno corrente − anno di nascita, meno uno se il compleanno di quest'anno non è ancora passato, con BR-04 per il 29/02).
- **BR-04 29 febbraio**: la data registrata e mostrata resta **29/02** ovunque (scheda, liste, export). Negli anni non bisestili la data effettiva è il **28/02**; il reminder riporta "(compleanno il 29/02)". I pre-reminder si contano a ritroso dalla data effettiva.
- **BR-05** Un'occorrenza appartiene all'anno del compleanno, anche se i suoi pre-reminder cadono nell'anno precedente (es. compleanno il 02/01, pre-reminder −7 il 26/12).

### Occorrenze ed esiti
- **BR-06** Ogni persona ha al massimo un'occorrenza per anno.
- **BR-07** Il primo Fatto o Salta chiude l'occorrenza e annulla tutti i promemoria successivi, recupero compreso.
- **BR-08** Un esito *saltato* o *non confermato* può essere corretto in *fatto* entro 7 giorni dalla data effettiva (pulsanti del recupero, scheda, `/scaduti`). *Fatto* non torna indietro.
- **BR-09** "L'anno scorso" nel reminder compare solo se l'esito precedente è *fatto* o *saltato*; *non confermato* non genera alcun avviso, per evitare falsi allarmi.

### Inserimenti e modifiche a ridosso del compleanno
- **BR-10** I promemoria il cui orario è già passato al momento dell'inserimento non vengono inviati retroattivamente.
- **BR-11** Se una persona viene inserita il giorno del compleanno, partono solo gli slot ancora futuri. In questo caso il recupero parte solo se nella giornata è stato inviato almeno un reminder. Per le persone inserite prima, il recupero parte anche se nessun reminder del giorno è stato inviato per un malfunzionamento (N-04).
- **BR-12** Cambiare priorità durante un'occorrenza aperta vale solo per i promemoria futuri.
- **BR-13** Cambiare la data di nascita annulla l'occorrenza aperta dell'anno corrente (se non ancora chiusa); quella nuova segue la nuova data.

### Dati e duplicati
- **BR-14** Duplicato = stesso nome completo (senza distinzione tra maiuscole e minuscole) e stessa data. Nel guidato: avviso e conferma. Nell'import: riga saltata. Vale anche per i duplicati interni allo stesso file.
- **BR-15** Il telefono è salvato in formato internazionale. Senza prefisso si assume +39.
- **BR-16** Gli username di Instagram e Telegram si salvano senza `@` (se presente viene rimosso).
- **BR-17** Nomi dei gruppi univoci senza distinzione tra maiuscole e minuscole.
- **BR-25** *(v1.1)* **Numero da contatto condiviso.** Si tengono solo le cifre e l'eventuale "+" iniziale. Poi:
  - con "+" iniziale il numero si prende così com'è;
  - con "00" iniziale, "00" diventa "+";
  - con 9-10 cifre il numero è nazionale e si antepone +39;
  - con 11 cifre o più il numero è già internazionale e si antepone "+".

  Il risultato va validato con BR-15 e confermato dall'utente (RF-01).
- **BR-26** *(v1.1)* **Ricerca dei gruppi** (`/gruppi <nome>`, filtro di `/prossimi`). Testo cercato e nomi dei gruppi si confrontano con una chiave che ignora maiuscole, accenti ed emoji e compatta gli spazi: "famiglia" corrisponde esattamente a "👨‍👩‍👧 Famiglia". Il testo si cerca in qualsiasi parte del nome, come in `/cerca`. Una corrispondenza esatta della chiave vince sulle parziali. La chiave si calcola al momento e non modifica i nomi salvati; l'unicità resta quella di BR-17. La chiave contiene solo lettere senza accenti, in minuscolo, e cifre: ogni altro carattere (emoji, anche composte, bandiere, simboli, punteggiatura) diventa uno spazio. Il nome di un gruppo deve avere una chiave di almeno 2 caratteri: la regola vale in creazione (`/gruppi`, al volo nell'inserimento o nella modifica, import CSV) e in rinomina; i gruppi già esistenti che non la rispettano restano invariati e si adeguano alla prossima rinomina; il ripristino da backup non la applica.

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
| **Alta** *(modificata in v1.3)* | −7, −2, −1 giorni | 00:00 · 9:00 · 13:00 · 18:00 · 21:00 | D+1 alle 13:00 |
| **Media** | −1 giorno | 9:00 · 13:00 · 18:00 | D+1 alle 13:00 |
| **Bassa** | nessuno | 9:00 · 18:00 | D+1 alle 13:00 |

Nell'MVP profili e slot sono costanti definite in un unico punto; in v2 diventano configurabili (RF-40).
*(v1.3)* Lo slot delle 00:00 vale solo per la priorità Alta ed è il primo reminder del giorno del compleanno (RF-10). Il cambio d'ora avviene alle 2-3 di notte e non lo tocca (BR-24).

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
| Avviso di buco del cron *(v1.1)* | Alla prima esecuzione dopo un'interruzione di oltre 2 ore (N-06) |

### Regole di invio
- **N-01** Un solo Cron Trigger orario gestisce tutti gli invii. A ogni esecuzione il bot calcola l'ora locale e invia ciò che è previsto per quell'ora.
- **N-02 Idempotenza**: ogni promemoria (persona, anno, tipo, slot) viene inviato al massimo una volta, anche se il cron viene rieseguito.
- **N-03** Se un invio fallisce per un errore di Telegram, viene ritentato all'esecuzione successiva, ma solo entro la stessa giornata; poi viene abbandonato.
- **N-04** Uno slot saltato per un malfunzionamento della piattaforma non viene recuperato. Il recupero del giorno dopo e `/oggi` fanno da rete di sicurezza.
- **N-05** Granularità: ore piene. Non sono possibili orari come 9:30.
- **N-06** *(v1.1)* **Avviso di buco del cron.** A ogni esecuzione il cron registra la propria ora. Se trova un'ora registrata più vecchia di 2 ore, invia un solo avviso con l'intervallo scoperto e l'invito a controllare `/oggi` e `/scaduti` (§5.12). Poi aggiorna l'ora. Se non c'è ancora un'ora registrata (prima esecuzione dopo il deploy), l'avviso non parte. Gli slot persi non vengono recuperati (N-04).
  - *Dato* che il cron ha girato alle 14:00 e poi di nuovo solo alle 19:00, *quando* gira alle 19:00, *allora* ricevo un avviso che indica il buco tra le 14:00 e le 19:00.
  - *Dato* che il cron gira ogni ora regolarmente, *allora* nessun avviso parte.

## 8. Modello dati concettuale

| Entità | Attributi principali |
|---|---|
| **Persona** | id, nome completo, nickname (opz.), giorno, mese, anno (opz.), telefono (opz.), username Instagram (opz.), username Telegram (opz.), priorità, messaggio personalizzato (opz.), data creazione, data ultima modifica |
| **Gruppo** | id, nome (univoco) |
| **Appartenenza** | persona, gruppo — relazione molti-a-molti |
| **Occorrenza** | id, persona, anno, data effettiva, stato (aperta / fatto / saltato / non confermato), data e ora dell'esito |
| **Invio** | occorrenza, tipo (pre-reminder / reminder / recupero), riferimento (giorni prima o slot), data e ora, esito dell'invio, id del messaggio Telegram |
| **Impostazioni** | messaggio di auguri di default; *(v1.1)* dati tecnici: ora dell'ultima esecuzione del cron (N-06, RF-31), data ed esito dell'ultimo backup mensile (RF-31). I dati tecnici non entrano nel backup e il ripristino non li modifica. |
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
- **RNF-14** Pulsanti solo per le azioni; la navigazione nelle liste usa i comandi `/p_<id>` nel testo. *(v1.1)* Eccezione: i gruppi, che sono pochi, si scelgono con pulsanti (elenco gruppi di RF-07, scelta tra più gruppi trovati in RF-17 e RF-19). Le liste di persone restano senza pulsanti.
  *(v1.2)* **Pulsanti di passo successivo.** Una vista può terminare con al massimo 2 pulsanti di navigazione verso viste vicine, per il passo più probabile. Ognuno manda sempre un nuovo messaggio: il messaggio di partenza resta com'era, senza navigazione sul posto. Non ci sono mai pulsanti sulle righe delle persone. Si applicano a: `/mese` (RF-20), `/anno` (RF-22), `/prossimi` (RF-17), scheda gruppo e scheda "Senza gruppo" ([⬅️ Tutti i gruppi], RF-19), conferma del salvataggio di una persona (RF-01) e, *(v1.3)*, `/statistiche` ([📝 Profili incompleti], RF-32). Nuovi punti vanno decisi con una revisione dell'AFU.
  *(v1.3)* **Filtri dei profili incompleti.** Anche i 5 filtri di `/incomplete` (RF-50), pochi e fissi, si scelgono con pulsanti, come i gruppi. Le liste che ne risultano restano testuali, senza pulsanti.
  - *Dato* che apro una delle viste elencate, *allora* in fondo trovo al più 2 pulsanti di passo successivo, oltre agli eventuali pulsanti di azione già previsti.
  - *Dato* che premo un pulsante di passo successivo, *allora* ricevo un nuovo messaggio e quello precedente non cambia.
- **RNF-15** Testi del bot raccolti in un unico punto, per facilitarne modifica e traduzione futura.
- **RNF-19** *(v1.1)* **Guida di stile dei testi.** Il tono è caldo, personale e sobrio, senza diventare verboso. Valgono anche per le funzionalità future.
  - Un'emoji "di sezione" all'inizio di titoli e intestazioni (es. 🎂, 📅, 📆, 👥, 📊), mai dentro le righe delle liste, per non rompere l'allineamento.
  - 👋 nel benvenuto; 🎉 o ✅ nelle conferme di successo.
  - ⚠️ negli avvisi e ❌ negli errori.
  - Un'icona per campo nelle domande dei flussi guidati.
  - Icone solo sui pulsanti di azione (✏️ Modifica, 🗑 Elimina, ⏭ Salta, ➕ Nuovo gruppo…). I pulsanti di contatto (WhatsApp, Instagram, Telegram, Copia messaggio) restano senza icona, per non essere troncati su mobile.
  - *(v1.2)* Pulsanti di passo successivo (RNF-14): ◀️ e ▶️ per scorrere mesi e anni, con la freccia verso l'esterno ([◀️ Febbraio] [Aprile ▶️]); ⬅️ per tornare a un elenco ([⬅️ Tutti i gruppi]); ➕ per avviare un nuovo inserimento ([➕ Aggiungi un'altra persona]); nessuna icona sull'allargamento della finestra ([Prossimi 90 giorni]). La voce [Senza gruppo (N)] è senza emoji, come i pulsanti dei gruppi.
  - *(v1.3)* 📝 per i profili incompleti, nell'intestazione di `/incomplete` e sul pulsante [📝 Profili incompleti] di `/statistiche`. I pulsanti dei filtri ([Telefono (N)] …) sono senza emoji, come quelli dei gruppi.
  - *(v1.3)* **Orari.** Le ore piene si scrivono H:MM (9:00, 13:00, 18:00); la mezzanotte si scrive sempre "00:00", mai "0:00". La regola vale ovunque compaia un orario: reminder, `/stato` (ultimo controllo orario, invii abbandonati) e avviso di buco del cron (N-06).
    - *Dato* che il reminder delle 00:00 di Marco è stato abbandonato, *quando* scrivo `/stato`, *allora* leggo "Marco, reminder delle 00:00 del 14/03".
    - *Dato* che il cron non ha girato tra le 23:00 e le 2:00, *allora* l'avviso di buco indica "dalle 23:00 alle 2:00".
  - Nessuna emoji legata a priorità o gruppo.
  - Esclusi: il messaggio di auguri di default (A-06) e i messaggi personalizzati, che sono dati dell'utente.
  - *Dato* che salvo una persona, *allora* la conferma contiene un'emoji di successo e il nome della persona.
  - *Dato* che apro una lista, *allora* l'emoji compare solo nell'intestazione.

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
- **V-08** *(v1.1)* Un contatto condiviso porta un solo numero, quello principale scelto da Telegram, spesso senza "+". Gli altri numeri stanno solo nella vCard, che può mancare. Il pulsante "condividi contatto" della tastiera di Telegram condivide solo il contatto dell'utente stesso, quindi non è utilizzabile: si condivide da 📎 → Contatto.
- **V-09** *(v1.1)* Una tastiera inline ha al massimo 100 pulsanti: per questo l'elenco gruppi a pulsanti è limitato a 60 gruppi (RF-07). *(v1.2)* Con [Senza gruppo (N)] e [➕ Nuovo gruppo] si arriva al più a 62 pulsanti.

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
| D-02 *(modificata in v1.3)* | Orari fissi a ore piene (9, 13, 18, 21; *(v1.3)* più 0 per la sola priorità Alta) e pre-reminder alle 13 | Compatibile con il cron orario; alle 13 c'è il tempo per leggere. *(v1.3)* Le 00:00 permettono gli auguri allo scoccare del compleanno alle persone più importanti; un Fatto a mezzanotte chiude tutti gli slot successivi (BR-07). |
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
| D-23 *(v1.1)* | Guida di stile con tono caldo ma sobrio (RNF-19) | Una regola stabile vale anche per le feature future; il livello sobrio rispetta l'allineamento delle liste e la larghezza dei pulsanti. |
| D-24 *(v1.1)* | Contatto condiviso solo come scorciatoia per il telefono, sempre con conferma | Fa risparmiare tempo senza creare la persona dal contatto; la conferma neutralizza i numeri senza "+" (V-08). |
| D-25 *(v1.1)* | Un solo concetto di "scheda gruppo", raggiungibile da elenco, ricerca e scelta tra più gruppi; `/gruppi` e `/gruppo` unificati | Evita tre modi diversi di aprire un gruppo. |
| D-26 *(v1.1)* | Ricerca dei gruppi per parte del nome, ignorando emoji e accenti, con priorità alla corrispondenza esatta | Con le emoji nei nomi la ricerca esatta era inutilizzabile; si allinea a `/cerca`. |
| D-27 *(v1.1)* | Nella scheda persona WhatsApp apre la chat vuota; il telefono resta nel testo | La scheda si apre tutto l'anno; il numero nel testo è l'unico modo di chiamare (V-04). |
| D-28 *(v1.1)* | `/stato` su richiesta più l'avviso di buco rilevato a posteriori (N-06) | Un cron fermo non può avvisare da solo; il buco si segnala alla ripartenza. |
| D-29 *(v1.1)* | `/statistiche` separato da `/anno`, con solo conteggi | Poche cifre utili, senza duplicare il riepilogo annuale. |
| D-30 *(v1.2)* | [⬅️ Tutti i gruppi] sulla scheda gruppo, con un nuovo messaggio | Si torna all'elenco senza riscrivere il comando, restando coerenti con `/p_<id>`. La scheda persona resta senza Indietro, perché `/p_<id>` è testo e non sa da dove si arriva. |
| D-31 *(v1.2)* | "Senza gruppo" come gruppo virtuale calcolato, raggiungibile solo dal pulsante dell'elenco | Non va tenuto allineato, non finisce in export e backup, e non entra in conflitto con un gruppo reale con lo stesso nome (BR-17, BR-26). |
| D-32 *(v1.2)* | Età in `/statistiche` per decadi, età attuale, con età media e senza nomi | Fasce neutre senza configurazione; la statistica fotografa oggi, mentre l'età che si compirà resta per le liste; RF-32 resta "solo conteggi". |
| D-33 *(v1.2)* | Navigazione guidata con al massimo 2 pulsanti di passo successivo per vista (RNF-14) | Rende verificabile la "navigazione più guidata" senza arrivare a un muro di pulsanti. |
| D-34 *(v1.3)* | Profili incompleti con 5 filtri singoli e fissi, scelti a pulsanti da `/incomplete` o da `/statistiche`, con liste §5.7 | Con i dati reali è lo strumento per completare le schede, soprattutto i telefoni che abilitano WhatsApp (RF-11). I filtri singoli bastano: "Nessun contatto" copre il caso peggiore. `/statistiche` resta "solo conteggi" e ci porta con un solo pulsante. |

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
| Creare una persona da un contatto condiviso di Telegram *(riformulata in v1.1)* | Troppo lento per l'onboarding. Il contatto è ammesso solo come scorciatoia per il telefono (RF-01, D-24). |
| Pulsanti per navigare le liste di persone *(riformulata in v1.1)* | Muro di pulsanti e paginazione oltre 30 elementi. Non vale per i gruppi, che sono pochi (RNF-14). |
| Stile dei testi sobrio o giocoso a scelta nelle impostazioni *(v1.1)* | Eccessivo per un uso personale; basta una guida di stile unica. |
| Emoji per priorità o per gruppo *(v1.1)* | Rumore visivo, senza un'informazione in più. |
| Numero da contatto preso senza conferma *(v1.1)* | Un numero senza "+" verrebbe salvato sbagliato in silenzio (V-08). |
| Navigazione sul posto (modifica del messaggio) nella scheda gruppo *(v1.1, riformulata in v1.2)* | Coerenza con `/p_<id>`, che manda sempre un nuovo messaggio; si rompe con le schede spezzate in più messaggi e toglie dalla chat la scheda che si stava guardando, senza vantaggi di costo. L'Indietro con un nuovo messaggio è invece adottato (D-30). |
| Gruppo reale «Senza gruppo» o accesso testuale (`/gruppi senza`, filtro di `/prossimi`) *(v1.2)* | Un gruppo reale andrebbe tenuto allineato a ogni modifica e finirebbe in export e backup; l'accesso testuale creerebbe conflitti con un gruppo reale con lo stesso nome (BR-17, BR-26). |
| Nomi della persona più giovane e più anziana in `/statistiche` *(v1.2)* | RF-32 resta "solo conteggi". |
| Tastiera di risposta persistente con le azioni più usate *(v1.2)* | Doppia il menu dei comandi e occupa stabilmente lo schermo. |
| Indietro di uno step nei flussi guidati *(v1.2)* | I flussi sono brevi, esistono `/annulla` e Modifica per campo; effort alto per un beneficio scarso. |
| Pulsante "Apri scheda" dopo il salvataggio di una persona *(v1.2)* | La conferma sta già in testa alla scheda (RF-01). |
| WhatsApp con auguri precompilati e Copia messaggio nella scheda *(v1.1)* | La scheda si usa tutto l'anno; per gli auguri ci sono reminder, recupero e `/oggi`. |
| Username di Instagram e Telegram nell'etichetta dei pulsanti *(v1.1)* | Con tre pulsanti su una riga verrebbero troncati su mobile. |
| Priorità "Silenziosa" (nessun promemoria, solo nelle liste) *(v1.1)* | Non necessaria all'utente. |
| Vista delle schede incomplete anticipata nella v1.1 *(v1.1, superata in v1.3)* | Non necessaria allora; restava tra le idee future (RF-50). *(v1.3)* Superata: RF-50 è anticipato su richiesta del proprietario (D-34). |
| Attendere RF-40 per aggiungere le 00:00 al profilo Alta *(v1.3)* | La richiesta serve subito e basta cambiare il profilo di default, già centralizzato (RNF-18). |
| Pre-reminder di −1 giorno spostato alle 23:00 al posto dello slot delle 00:00 *(v1.3)* | Non dà i pulsanti Fatto e Salta del giorno stesso. |
| Slot delle 00:00 solo per chi ha telefono o Telegram *(v1.3)* | Più complesso, senza un beneficio reale: il profilo resta uguale per tutte le persone Alta. |
| Combinazioni di filtri e filtro per gruppo in `/incomplete` *(v1.3)* | Complessità alta per un uso raro; "Nessun contatto" copre il caso peggiore. |
| Conteggi di `/statistiche` cliccabili *(v1.3)* | RF-32 resta "solo conteggi" e coprirebbe solo anno e contatti; basta un pulsante di passo successivo verso `/incomplete`. |
| Gruppi nella riga della lista di `/incomplete` *(v1.3)* | Righe più lunghe e liste spezzate prima; per completare la scheda basta `/p_<id>`. |
| "Senza gruppo" tra i filtri di `/incomplete` *(v1.3)* | Esiste già nell'elenco gruppi (RF-07, RF-19). |
| Onomastici e anniversari *(v1.1)* | Allargherebbero il dominio a ricorrenze generiche, fuori dall'obiettivo. |
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

### v1.1
- Gruppi: elenco a pulsanti, scheda gruppo, ricerca per parte del nome, `/gruppi [nome]` con alias `/gruppo` (RF-07, RF-17, RF-19, BR-26, RNF-14)
- Scheda persona con pulsanti di contatto (RF-03, RF-11)
- Telefono da contatto condiviso (RF-01, RF-04, BR-25, V-08)
- `/stato`, `/statistiche`, avviso di buco del cron (RF-31, RF-32, N-06)
- Guida di stile dei testi (RNF-19)

### v1.2
- Gruppi: [⬅️ Tutti i gruppi] sulla scheda gruppo, voce e scheda "Senza gruppo" (RF-07, RF-19, V-09)
- `/statistiche`: conteggio "Senza gruppo" e distribuzione per età (RF-32, BR-03)
- Pulsanti di passo successivo in `/mese`, `/anno`, `/prossimi` e dopo il salvataggio di una persona (RNF-14, RNF-19, RF-01, RF-17, RF-20, RF-22)

### v1.3
- Reminder del giorno alle 00:00 per la priorità Alta e regola di scrittura della mezzanotte (RF-10, §7, RNF-19, D-02)
- Profili incompleti: `/incomplete [campo]` e pulsante da `/statistiche` (RF-50, RF-32, RF-28, RNF-14, RNF-19)

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
- Multilingua completo (RF-51)
- Gestione dei membri dalla scheda gruppo (RF-52)
- Riepilogo annuale inviato in automatico il 31/12

## 13. Punti aperti

Nessun punto aperto bloccante.

Punti chiusi:
- **PA-01** ~~Il comportamento del numero cliccabile nel testo (V-04) va verificato sui client Telegram usati (Android, iOS, desktop).~~ *(v1.1)* **Chiuso: verificato.** Il numero nel testo è cliccabile sui client in uso; il pulsante "Chiama" tramite una pagina del Worker non serve.

## Impatto della versione 1.3

### Requisiti cambiati per area
- **Anagrafica e gruppi** (feature 001, 005): nessuna modifica. I profili incompleti si completano con la Modifica per campo già esistente (RF-04).
- **Promemoria** (feature 002):
  - RF-10 e §7: slot delle 00:00 nel profilo Alta, primo reminder del giorno, con N-02, N-03 e BR-11 invariati;
  - glossario "Slot" e D-02 aggiornati.
- **Viste** (feature 003, 007, 009):
  - RF-50: nuovo comando `/incomplete [campo]` con 5 filtri a pulsanti e liste §5.7;
  - RF-32: pulsante [📝 Profili incompleti] in fondo a `/statistiche`;
  - RF-28 e §5.1: `/incomplete` in `/aiuto` e nel menu dei comandi.
- **Import, export e backup** (feature 004): nessuna modifica.
- **Trasversale** (feature 008, 009): RNF-14 (filtri a pulsanti e nuovo punto di passo successivo in `/statistiche`), RNF-19 (icona 📝 e regola "00:00" per la mezzanotte in reminder, `/stato` e N-06); i nuovi testi entrano nel punto unico dei testi (RNF-15).

### Modello dati
- Nessuna nuova entità, nessun nuovo attributo, nessuna migration.
- Lo slot delle 00:00 è un nuovo valore del riferimento dell'Invio (slot 0), già ammesso; l'idempotenza (N-02) lo distingue dagli altri slot.
- I profili incompleti si calcolano dai campi facoltativi già presenti (telefono, Instagram, Telegram, anno di nascita).
- Dati esistenti in produzione:
  - nessuna conversione;
  - le persone con priorità Alta ricevono lo slot delle 00:00 dal primo compleanno successivo al deploy; le occorrenze già aperte al momento del deploy ricevono solo gli slot ancora futuri (BR-10);
  - gli invii già registrati non cambiano; in `/stato` l'orario della mezzanotte compare come "00:00" anche per i dati già registrati;
  - i profili incompleti lavorano subito sui dati attuali; i messaggi di `/statistiche` già inviati restano senza il nuovo pulsante.

### Ordine di realizzazione consigliato
Un solo ciclo, perché nessuna modifica tocca il modello dati e i due punti sono indipendenti:
1. **Slot delle 00:00**: §7, RF-10, D-02 e la regola "00:00" di RNF-19 (reminder, `/stato`, N-06). Effort S.
2. **Profili incompleti**: RF-50, RF-32, RF-28, RNF-14 e l'icona 📝 di RNF-19. Effort M.

## Impatto della versione 1.2

### Requisiti cambiati per area
- **Anagrafica e gruppi** (feature 001, 005):
  - RF-01: [➕ Aggiungi un'altra persona] nella conferma del salvataggio;
  - RF-07: voce [Senza gruppo (N)] nell'elenco gruppi, anche senza gruppi e oltre i 60 gruppi; V-09 aggiornato.
- **Promemoria** (feature 002): nessuna modifica.
- **Viste** (feature 003, 005, 007):
  - RF-19: [⬅️ Tutti i gruppi] sulla scheda gruppo e nuova scheda "Senza gruppo";
  - RF-17: [Prossimi 90 giorni] con il filtro di gruppo mantenuto;
  - RF-20: [◀️ mese] [mese ▶️] circolari;
  - RF-22: [◀️ anno] e [anno ▶️] condizionati allo storico e all'anno corrente;
  - RF-32 e BR-03: conteggio "Senza gruppo" (già mostrato, ora nel requisito) e sezione 🧑 Età con età attuale ed età media.
- **Import, export e backup** (feature 004): nessuna modifica; il gruppo virtuale "Senza gruppo" non entra in export e backup.
- **Trasversale** (feature 008): RNF-14 (principio dei pulsanti di passo successivo) e RNF-19 (icone ◀️ ▶️ ⬅️ ➕); i nuovi testi entrano nel punto unico dei testi (RNF-15) e nel suo inventario.

### Modello dati
- Nessuna nuova entità, nessun nuovo attributo, nessuna migration.
- "Senza gruppo" si calcola dalle persone senza appartenenze; l'età dall'anno di nascita già presente.
- Dati esistenti in produzione:
  - nessuna conversione;
  - le persone senza anno di nascita restano escluse dalla sezione Età e contate a parte;
  - un eventuale gruppo reale di nome "Senza gruppo" resta invariato e distinto dalla voce virtuale;
  - i messaggi già inviati (schede gruppo, liste, conferme) restano senza i nuovi pulsanti.

### Ordine di realizzazione consigliato
Un solo ciclo, perché nessuna modifica tocca il modello dati e ogni punto ha effort piccolo:
1. **Gruppi**: RF-07, RF-19, V-09 ([⬅️ Tutti i gruppi], voce e scheda "Senza gruppo").
2. **Statistiche**: RF-32, BR-03 (riusa il conteggio "Senza gruppo" del punto 1).
3. **Pulsanti di passo successivo**: RNF-14, RNF-19, RF-20, RF-22, RF-17, RF-01.

## Impatto della versione 1.1

### Requisiti cambiati per area
- **Anagrafica e gruppi** (feature 001):
  - RF-01 e RF-04: telefono da contatto condiviso, con BR-25 e V-08;
  - RF-03: pulsanti di contatto nella scheda, username fuori dal testo;
  - RF-07: elenco gruppi a pulsanti, Rinomina ed Elimina dalla scheda gruppo, V-09;
  - RNF-14: eccezione per i gruppi.
- **Promemoria** (feature 002):
  - RF-11: i pulsanti di contatto si usano anche nella scheda, senza testo precompilato;
  - N-06: avviso di buco del cron, con registrazione dell'ora di ogni esecuzione.
- **Viste** (feature 003):
  - RF-19: `/gruppi [nome]`, scheda gruppo, alias `/gruppo`;
  - RF-17: filtro gruppo con la ricerca di BR-26;
  - nuovi RF-31 `/stato` e RF-32 `/statistiche`.
- **Import, export e backup** (feature 004):
  - il backup mensile registra data ed esito, per RF-31;
  - backup e ripristino escludono i dati tecnici delle impostazioni.
- **Trasversale**: RNF-19, guida di stile su tutti i testi e mockup §5; tocca tutte le feature.

### Modello dati
- Nessuna nuova entità e nessuna migration di struttura prevista. Le Impostazioni ricevono nuovi dati tecnici: ultima esecuzione del cron, ultimo backup mensile ed esito.
- Dati esistenti in produzione:
  - nessuna conversione;
  - i dati tecnici nascono vuoti: `/stato` mostra "mai registrato" e N-06 non scatta fino alla prima esecuzione dopo il deploy;
  - i nomi dei gruppi non cambiano, perché la chiave di BR-26 si calcola al momento;
  - i gruppi il cui nome ha una chiave di meno di 2 caratteri restano invariati e raggiungibili dall'elenco; la regola di BR-26 si applica loro solo alla rinomina;
  - il messaggio di auguri di default e i messaggi personalizzati non vengono toccati;
  - i messaggi già inviati restano con il testo vecchio;
  - lo storico di invii e occorrenze è già utilizzabile da `/stato` e `/statistiche`.

### Ordine di realizzazione consigliato
1. **Gruppi**: RF-07, RF-17, RF-19, BR-26, RNF-14, V-09. È la priorità più alta, perché oggi `/gruppo` è inutilizzabile con le emoji.
2. **Scheda e contatti**: RF-03, RF-11, RF-01, RF-04, BR-25, V-08.
3. **Stato e statistiche**: RF-31, RF-32, N-06.
4. **Guida di stile**: RNF-19 e mockup §5. Va per ultima, così copre anche i testi nuovi dei cicli precedenti.
