# Feature Specification: Revisioni v1.2 — Navigazione

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-2-navigazione\". Fonte unica: docs/AFU.md v1.2, sezioni \"Registro modifiche\" e \"Impatto della versione 1.2\", aree Gruppi (RF-07, V-09, RF-19), Statistiche (RF-32, BR-03) e Pulsanti di passo successivo (RNF-14, RNF-19, RF-20, RF-22, RF-17, RF-01) (REV-008, REV-009, REV-010, REV-011). Il bot è già implementato (specs da 001 a 008): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione (nessuna conversione, persone senza anno di nascita, eventuale gruppo reale \"Senza gruppo\", messaggi già inviati senza i nuovi pulsanti). Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.2 (fonte di verità funzionale): Registro modifiche (REV-008…REV-011), "Impatto della versione 1.2", testi v1.2 di RF-01, RF-07, RF-17, RF-19, RF-20, RF-22, RF-32, BR-03, RNF-14, RNF-19, V-09, glossario (Scheda gruppo, Senza gruppo, Pulsante di passo successivo), §5.1, decisioni D-30…D-33, alternative scartate v1.2, mockup §5.2, §5.7, §5.9 e §5.11. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica), 003 (viste-ricerche), 005 (revisioni-v1-1-gruppi), 006 (revisioni-v1-1-scheda-contatti), 007 (revisioni-v1-1-stato-statistiche) e 008 (revisioni-v1-1-stile); tutto ciò che non è citato qui resta come definito in quelle spec. Le spec 002 (promemoria) e 004 (import, export e backup) non cambiano.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-008 | Pulsante Indietro dalla scheda gruppo | RF-07, RF-19, RNF-14, D-30 |
| REV-009 | Voce "Senza gruppo" nell'elenco gruppi | RF-07, RF-19, RF-32, V-09, §5.1, D-31 |
| REV-010 | Distribuzione per età in `/statistiche` | RF-32, BR-03, D-32 |
| REV-011 | Navigazione più guidata | RNF-14, RNF-19, RF-01, RF-17, RF-20, RF-22, D-33 |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 005 | FR-002, FR-008 | La scheda gruppo ha [⬅️ Tutti i gruppi], che manda un nuovo messaggio con l'elenco gruppi | RF-19, RF-07, D-30 |
| 005 | FR-001, FR-003, FR-004 | L'elenco gruppi mostra [Senza gruppo (N)] se ci sono persone senza gruppo, anche senza gruppi e oltre i 60 gruppi | RF-07, D-31 |
| 005 | FR-005 | Un [Senza gruppo (N)] premuto quando tutte le persone hanno un gruppo lo segnala e mostra l'elenco aggiornato | RF-19 |
| 005 | FR-013 | La tastiera dell'elenco gruppi arriva al più a 62 pulsanti | V-09 |
| 005 | FR-012; 001 FR-031; 003 FR-004 | Pulsanti di passo successivo ammessi in fondo a viste elencate, al massimo 2 per vista | RNF-14, D-33 |
| 005 | FR-014 | La descrizione di `/gruppi [nome]` in `/aiuto` cita la voce "Senza gruppo" | §5.1 |
| 001 | FR-003; 006 FR-003; 008 FR-008 | La conferma del salvataggio ha [➕ Aggiungi un'altra persona] | RF-01 |
| 003 | FR-009 | `/prossimi` sotto i 90 giorni ha [Prossimi 90 giorni] | RF-17 |
| 003 | FR-015 | `/mese` ha [◀️ <mese precedente>] [<mese successivo> ▶️], circolari | RF-20 |
| 003 | FR-019 | `/anno` ha [◀️ <anno − 1>] e [<anno + 1> ▶️], condizionati | RF-22 |
| 007 | FR-013 | `/statistiche` ha la sezione 🧑 Età, dopo l'istogramma per mese | RF-32, BR-03, D-32 |
| 008 | FR-009 | Nuove icone ammesse: ◀️ ▶️ ⬅️ ➕ sui pulsanti di passo successivo | RNF-19 |
| 008 | FR-004a | I nuovi testi entrano nel punto unico dei testi e nel suo inventario | RNF-15, RNF-19 |

**Fuori da questa feature** (alternative scartate v1.2): gruppo reale «Senza gruppo» o accesso testuale (`/gruppi senza`, filtro di `/prossimi`); nomi della persona più giovane e più anziana in `/statistiche`; tastiera di risposta persistente; Indietro di uno step nei flussi guidati; pulsante "Apri scheda" dopo il salvataggio; Indietro nella scheda persona (D-30); pulsanti di passo successivo in `/cerca` e in viste non elencate in RNF-14; navigazione sul posto (modifica del messaggio); gestione dei membri dalla scheda gruppo (RF-52, idea futura).

## Clarifications

### Session 2026-10-29

- Q: I nuovi pulsanti dei gruppi ([⬅️ Tutti i gruppi], [Senza gruppo (N)]) usano l'ambito "g2" con azioni nuove o un ambito nuovo? → A: Restano nell'ambito "g2", con due azioni nuove senza campi; le azioni "g2" esistenti non cambiano e tutti i pulsanti "g2" già in chat continuano a funzionare.
- Q: [➕ Aggiungi un'altra persona] resta valido dopo la fine del flusso che l'ha prodotto, e cosa fa se premuto più volte? → A: Sempre valido, non legato al flusso; ogni tocco equivale a `/nuovo`: interrompe senza salvare l'eventuale flusso guidato in corso (anche un inserimento avviato da un tocco precedente) e ricomincia dal nome.
- Q: [Senza gruppo (N)] premuto su un elenco vecchio quando la rubrica è diventata vuota: quale messaggio? → A: Lo stesso di FR-008 (avviso "tutte le persone hanno un gruppo" e poi l'elenco gruppi aggiornato); conta solo che N attuale sia 0.
- Q: Per [◀️ <anno − 1>] di `/anno`, cosa conta come "almeno un'occorrenza nello storico"? → A: Solo le occorrenze chiuse (*fatto*, *saltato*, *non confermato*) di quell'anno; quelle ancora aperte non contano.
- Q: Nella sezione 🧑 Età, come si trattano età oltre i 120 anni e anni di nascita fuori da BR-02 già presenti? → A: Età ≥ 120 (anni 1900–1906, ammessi da BR-02) in "80+" e nella media; anni fuori da BR-02 (futuri o precedenti al 1900) contati come "senza anno di nascita", senza modificare il dato.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ritorno all'elenco dalla scheda gruppo (Priority: P1)

Dalla scheda di un gruppo il proprietario torna all'elenco gruppi con un pulsante, senza riscrivere `/gruppi`, e passa a un altro gruppo.

**Why this priority**: è il punto 1 dell'ordine di realizzazione consigliato e rende il percorso elenco → scheda → elenco percorribile solo con i pulsanti (D-30).

**Independent Test**: con alcuni gruppi, aprire una scheda gruppo (da elenco, da `/gruppi <nome>`, dopo una rinomina), premere [⬅️ Tutti i gruppi] e verificare il nuovo messaggio con l'elenco e la scheda di partenza invariata; ripetere con una scheda spezzata in più messaggi e con più di 60 gruppi.

**Esempio (AFU §5.9)**:

```
👥 Famiglia · 8 persone

Gio 30/10  Anna (28)      /p_4
Dom 02/11  Luca (35)      /p_17
…
[✏️ Rinomina] [🗑 Elimina]
[⬅️ Tutti i gruppi]
```

**Acceptance Scenarios**:

1. **Given** che sono nella scheda gruppo di Famiglia, **When** premo [⬅️ Tutti i gruppi], **Then** ricevo un nuovo messaggio con l'elenco gruppi a pulsanti, e la scheda di Famiglia resta in chat. *(RF-19)*
2. **Given** che la scheda gruppo è spezzata in due messaggi, **Then** [✏️ Rinomina] [🗑 Elimina] e [⬅️ Tutti i gruppi] stanno sul secondo. *(RF-19)*
3. **Given** che ho più di 60 gruppi, **When** premo [⬅️ Tutti i gruppi], **Then** ricevo l'elenco testuale con l'invito a scrivere `/gruppi <nome>`. *(RF-19)*
4. **Given** che il gruppo non ha persone, **When** apro la scheda gruppo, **Then** vedo il nome, "0 persone", i pulsanti Rinomina ed Elimina e, sotto, [⬅️ Tutti i gruppi]. *(RF-19)*

---

### User Story 2 - Voce e scheda "Senza gruppo" (Priority: P1)

Il proprietario vede nell'elenco gruppi quante persone non hanno ancora un gruppo e, con un tocco, apre la loro lista per classificarle dalla scheda persona.

**Why this priority**: punto 1 dell'ordine di realizzazione; rende visibili le persone non classificate, che oggi non si raggiungono da nessuna vista (D-31).

**Independent Test**: con una rubrica in cui alcune persone non hanno gruppi, scrivere `/gruppi` e verificare la voce; premerla e verificare la scheda; ripetere con tutte le persone in un gruppo, senza gruppi, con più di 60 gruppi e con un gruppo reale chiamato "Senza gruppo".

**Esempio (AFU §5.9)**:

```
👥 I tuoi gruppi
[Beach tennis (6)]  [Famiglia (8)]
[Lavoro (5)]        [Università (12)]
[Senza gruppo (12)]
[➕ Nuovo gruppo]

👥 Senza gruppo · 12 persone

Sab 01/11  Paolo (41)     /p_23
…
[⬅️ Tutti i gruppi]
```

**Acceptance Scenarios**:

1. **Given** che 12 persone non hanno gruppi, **When** scrivo `/gruppi`, **Then** sotto i gruppi vedo [Senza gruppo (12)] su una riga a sé, sopra [➕ Nuovo gruppo]. *(RF-07)*
2. **Given** che tutte le persone hanno almeno un gruppo, **When** scrivo `/gruppi`, **Then** la voce "Senza gruppo" non compare. *(RF-07)*
3. **Given** che non ho gruppi e ho 30 persone, **When** scrivo `/gruppi`, **Then** il bot dice che non ci sono gruppi e mostra [Senza gruppo (30)] e [➕ Nuovo gruppo]. *(RF-07)*
4. **Given** che ho più di 60 gruppi e 5 persone senza gruppo, **When** scrivo `/gruppi`, **Then** vedo l'elenco testuale e i pulsanti [Senza gruppo (5)] e [➕ Nuovo gruppo]. *(RF-07, V-09)*
5. **Given** che esiste un gruppo reale chiamato "Senza gruppo", **Then** compare tra i gruppi come gli altri, distinto dalla voce virtuale, che resta sulla sua riga. *(RF-07, D-31)*
6. **Given** che 12 persone non hanno gruppi, **When** premo [Senza gruppo (12)], **Then** vedo "Senza gruppo · 12 persone", la loro lista per prossimo compleanno con `/p_<id>` e il solo pulsante [⬅️ Tutti i gruppi]. *(RF-19)*
7. **Given** che nel frattempo ho dato un gruppo a tutte le persone, **When** premo [Senza gruppo (N)] su un elenco precedente, **Then** il bot dice che ora tutte le persone hanno un gruppo e mostra l'elenco gruppi aggiornato. *(RF-19)*
8. **Given** che scrivo `/gruppi senza`, **Then** il testo si cerca solo tra i gruppi salvati (BR-26) e la scheda "Senza gruppo" non si apre. *(RF-19, D-31)*

---

### User Story 3 - Distribuzione per età in `/statistiche` (Priority: P2)

Il proprietario vede in `/statistiche` come si distribuiscono per decadi le età attuali delle persone della rubrica, con l'età media.

**Why this priority**: punto 2 dell'ordine di realizzazione; informativo, non tocca promemoria né navigazione.

**Independent Test**: con persone di età e date di nascita note (compreso un 29/02 e chi deve ancora compiere gli anni quest'anno) e persone senza anno, fissare la data di oggi, scrivere `/statistiche` e verificare righe, conteggi ed età media; ripetere senza alcun anno di nascita.

**Esempio (AFU §5.11)**:

```
🧑 Età
0-9   ██         3
10-19 █          2
20-29 ██████    14
30-39 ████████  21
…
80+   █          1
Età media: 41 anni · senza anno di nascita: 23
```

**Acceptance Scenarios**:

1. **Given** che ho persone di 8, 34, 37 e 52 anni, **When** scrivo `/statistiche`, **Then** la sezione Età mostra 0-9 1, 10-19 0, 20-29 0, 30-39 2, 40-49 0, 50-59 1 e "Età media: 33 anni". *(RF-32)*
2. **Given** che oggi è il 29/10/2026 e Marco è nato il 14/03/1994, **Then** conta come 32 anni, nella decade 30-39. *(RF-32, BR-03)*
3. **Given** che oggi è il 10/03/2026 e Marco è nato il 14/03/1994, **Then** conta come 31 anni, perché il compleanno di quest'anno non è ancora passato. *(RF-32, BR-03)*
4. **Given** che Anna è nata il 29/02/2000 e oggi è il 28/02/2026, **Then** conta come 26 anni. *(RF-32, BR-04)*
5. **Given** che ho persone di 83 e 91 anni, **Then** entrambe stanno nella fascia "80+". *(RF-32)*
6. **Given** che 23 persone non hanno l'anno di nascita, **Then** sono escluse dall'istogramma e dall'età media, e la sezione lo richiama. *(RF-32)*
7. **Given** che nessuna persona ha l'anno di nascita, **Then** la sezione Età dice che l'età non è disponibile. *(RF-32)*
8. **Given** che 12 persone non hanno gruppi, **When** scrivo `/statistiche`, **Then** la riga dei gruppi termina con "Senza gruppo 12". *(RF-32; comportamento già presente in spec 007, FR-013)*

---

### User Story 4 - Scorrere mesi e anni (Priority: P2)

Da `/mese` e da `/anno` il proprietario passa al mese o all'anno accanto con un pulsante, senza riscrivere il comando.

**Why this priority**: punto 3 dell'ordine di realizzazione; è il passo più probabile dopo queste viste (D-33).

**Independent Test**: scrivere `/mese` per diversi mesi (compresi gennaio, dicembre e un mese già passato) e verificare etichette, circolarità, anno di riferimento e nuovo messaggio; scrivere `/anno` con storici diversi e verificare quali pulsanti compaiono.

**Esempio (AFU §5.7)**:

```
🗓 Compleanni di marzo 2027
…
[◀️ Febbraio] [Aprile ▶️]

🗂 Riepilogo 2025
…
[2026 ▶️]
```

**Acceptance Scenarios**:

1. **Given** che scrivo `/mese marzo`, **Then** in fondo vedo [◀️ Febbraio] [Aprile ▶️], e il tocco su [Aprile ▶️] mi manda la vista di aprile. *(RF-20)*
2. **Given** che scrivo `/mese dicembre`, **Then** vedo [◀️ Novembre] [Gennaio ▶️]. *(RF-20)*
3. **Given** che scrivo `/mese gennaio`, **Then** vedo [◀️ Dicembre] [Febbraio ▶️]. *(RF-20)*
4. **Given** che oggi è il 29/10/2026 e scrivo `/mese`, **When** premo [◀️ Settembre], **Then** vedo settembre 2027, con le età che si compiranno in quell'anno. *(RF-20)*
5. **Given** che siamo nel 2026 e ho uno storico dal 2025, **When** scrivo `/anno`, **Then** vedo solo [◀️ 2025]. *(RF-22)*
6. **Given** che premo [◀️ 2025] e il 2024 non ha storico, **Then** vedo il riepilogo del 2025 con il solo [2026 ▶️]. *(RF-22)*
7. **Given** che siamo nel primo anno d'uso e non c'è storico precedente, **When** scrivo `/anno`, **Then** non compare alcun pulsante. *(RF-22)*
8. **Given** che scrivo `/anno 2023`, anno senza storico, e il 2022 non ha storico, **Then** vedo il riepilogo vuoto con il solo [2024 ▶️]. *(RF-22)*
9. **Given** che premo un pulsante di passo successivo, **Then** ricevo un nuovo messaggio e quello precedente non cambia. *(RNF-14)*

---

### User Story 5 - Allargare `/prossimi` a 90 giorni (Priority: P3)

Da una lista `/prossimi` breve il proprietario allarga la finestra a 90 giorni con un pulsante, mantenendo il filtro di gruppo.

**Why this priority**: punto 3 dell'ordine di realizzazione; comodità su una vista già completa.

**Independent Test**: scrivere `/prossimi` con e senza giorni e gruppo, verificare la presenza del pulsante sotto i 90 giorni, premerlo e verificare la lista a 90 giorni con lo stesso filtro; ripetere con lista vuota e con il gruppo eliminato nel frattempo.

**Acceptance Scenarios**:

1. **Given** che scrivo `/prossimi`, **Then** in fondo alla lista dei 30 giorni vedo [Prossimi 90 giorni] e il tocco mi manda la lista dei prossimi 90 giorni. *(RF-17)*
2. **Given** che scrivo `/prossimi 7 famiglia`, **When** premo [Prossimi 90 giorni], **Then** vedo i prossimi 90 giorni del solo gruppo Famiglia. *(RF-17)*
3. **Given** che scrivo `/prossimi 120`, **Then** il pulsante non compare. *(RF-17)*
4. **Given** che il gruppo del filtro è stato eliminato nel frattempo, **When** premo [Prossimi 90 giorni], **Then** il bot si comporta come con un gruppo che non esiste. *(RF-17)*
5. **Given** che nei prossimi 30 giorni non ci sono compleanni, **When** scrivo `/prossimi`, **Then** vedo la lista vuota e il pulsante [Prossimi 90 giorni]. *(RF-17)*

---

### User Story 6 - Aggiungere un'altra persona dopo il salvataggio (Priority: P3)

Dopo aver salvato una persona, il proprietario avvia subito un nuovo inserimento con un pulsante, senza scrivere `/nuovo`.

**Why this priority**: punto 3 dell'ordine di realizzazione; velocizza l'inserimento di più persone di seguito.

**Independent Test**: completare un inserimento guidato, verificare il pulsante nella conferma e il nuovo inserimento al tocco; aprire la stessa scheda con `/p_<id>` e dopo una modifica e verificare che il pulsante non compaia.

**Esempio (AFU §5.2)**:

```
🎉 Fatto! Marchino è in rubrica.

👤 Marco Rossi — "Marchino"
… (scheda, §5.6)
[WhatsApp] [Instagram]
[✏️ Modifica] [🗑 Elimina]
[➕ Aggiungi un'altra persona]
```

**Acceptance Scenarios**:

1. **Given** che salvo Marco, **When** il bot conferma, **Then** vedo "🎉 Fatto! Marchino è in rubrica." in testa alla scheda e, in fondo, [➕ Aggiungi un'altra persona]. *(RF-01)*
2. **Given** che premo [➕ Aggiungi un'altra persona], **Then** il bot chiede il nome della nuova persona, come dopo `/nuovo`. *(RF-01)*
3. **Given** che apro la scheda di Marco con `/p_<id>` o la ridisegno dopo una modifica, **Then** [➕ Aggiungi un'altra persona] non compare. *(RF-01)*
4. **Given** che è in corso un altro flusso guidato, **When** premo [➕ Aggiungi un'altra persona] su una conferma precedente, **Then** il pulsante si comporta come `/nuovo` in quella situazione: il flusso in corso si interrompe senza salvare e il bot chiede il nome della nuova persona. *(RF-01)*
5. **Given** che ho premuto [➕ Aggiungi un'altra persona] e ho già risposto al nome, **When** lo premo di nuovo, **Then** l'inserimento in corso si interrompe senza salvare e il bot chiede di nuovo il nome. *(RF-01)*

---

### Edge Cases

- Scheda gruppo mostrata dopo una rinomina (spec 005, FR-009) o aperta da `/gruppi <nome>` o dalla scelta tra più gruppi: ha [⬅️ Tutti i gruppi] come ogni scheda gruppo. *(RF-19)*
- [⬅️ Tutti i gruppi] premuto su una scheda di un gruppo eliminato o rinominato nel frattempo: mostra l'elenco gruppi attuale, senza avvisi, perché non agisce su quel gruppo. *(RF-19)*
- [⬅️ Tutti i gruppi] premuto quando non esistono più gruppi: mostra l'elenco vuoto di spec 005 FR-004, con [Senza gruppo (N)] se ci sono persone. *(RF-07)*
- Rubrica vuota senza gruppi: `/gruppi` mostra solo [➕ Nuovo gruppo]; la voce "Senza gruppo" non compare (N = 0). *(RF-07)*
- [Senza gruppo (N)] premuto quando il numero è cambiato ma resta maggiore di 0: si apre la scheda "Senza gruppo" con il numero e la lista attuali. *(RF-19)*
- [Senza gruppo (N)] premuto su un elenco vecchio quando la rubrica è diventata vuota: avviso di FR-008 ("tutte le persone hanno un gruppo") e poi l'elenco gruppi aggiornato. *(RF-19)*
- Scheda "Senza gruppo" spezzata in più messaggi: [⬅️ Tutti i gruppi] sta sull'ultimo. *(RF-19)*
- Persona eliminata o a cui è stato dato un gruppo dopo l'apertura della scheda "Senza gruppo": la scheda già inviata resta com'era; `/p_<id>` di una persona eliminata risponde come oggi (spec 001, FR-012a). *(RF-19)*
- Gruppo reale "Senza gruppo": la sua scheda ha Rinomina, Elimina e [⬅️ Tutti i gruppi] come ogni gruppo; si trova con `/gruppi senza` e con il filtro di `/prossimi`; in `/statistiche` compare tra i gruppi, distinto dalla voce "Senza gruppo N" in fondo alla riga. *(RF-07, RF-19, RF-32, D-31)*
- Il nome "Senza gruppo" non è riservato: creare o rinominare un gruppo reale con quel nome resta ammesso secondo spec 001 FR-020 e spec 005 FR-006a. *(D-31, BR-17)*
- `/prossimi` con più gruppi candidati (spec 005, FR-011): la lista ottenuta col tocco su un gruppo ha [Prossimi 90 giorni] se N < 90, con quel gruppo. *(RF-17)*
- `/prossimi 89` mostra il pulsante; `/prossimi 90` no. *(RF-17)*
- `/prossimi` con gruppo inesistente, giorni fuori da 1–366 o argomenti non validi: nessuna lista, nessun pulsante di passo successivo. *(RF-17)*
- Lista di `/prossimi` o `/mese` spezzata in più messaggi (spec 003, FR-005): i pulsanti di passo successivo stanno sull'ultimo messaggio. *(RNF-14)*
- `/mese` con un mese non valido: il bot lo segnala come oggi (spec 003, FR-015), senza pulsanti. *(RF-20)*
- Mese senza compleanni: la vista vuota mostra comunque [◀️ …] [… ▶️]. *(RF-20)*
- Pulsante di `/mese` premuto in un giorno successivo, a cavallo di un cambio di mese o d'anno: l'anno di riferimento si calcola al momento del tocco con la regola di spec 003 FR-015. *(RF-20)*
- Pulsante di `/anno` premuto dopo che è cambiato l'anno corrente o lo storico: la vista mostrata e i suoi pulsanti si calcolano al momento del tocco; un anno diventato futuro non è possibile, perché gli anni crescono. *(RF-22)*
- Anno precedente con sole occorrenze ancora aperte (es. compleanno di fine dicembre non ancora chiuso a inizio gennaio): [◀️ <anno − 1>] non compare finché non se ne chiude almeno una. *(RF-22)*
- `/anno` con un anno non valido o futuro: il bot lo segnala come oggi (spec 003), senza pulsanti. *(RF-22)*
- [➕ Aggiungi un'altra persona] dopo "Salva comunque" sul possibile duplicato (spec 001, FR-004): compare come dopo ogni salvataggio. *(RF-01)*
- Scheda dopo Segna fatto, dopo una modifica di campo o aperta da `/cerca` con un solo risultato: senza [➕ Aggiungi un'altra persona] (spec 006, FR-003). *(RF-01)*
- [➕ Aggiungi un'altra persona] premuto quando la persona appena salvata è stata eliminata nel frattempo: avvia comunque un nuovo inserimento. *(RF-01)*
- Persona nata quest'anno (anno di nascita uguale all'anno corrente) con il compleanno non ancora passato: conta come 0 anni, nella decade 0-9. *(RF-32, BR-03)*
- Tutte le persone con l'anno di nascita: la sezione Età non richiama le persone senza anno. *(RF-32)*
- Età media con valore a metà (es. 32,5): arrotondata per eccesso (33). *(RF-32)*
- Rubrica vuota: la sezione Età dice che l'età non è disponibile. *(RF-32)*
- Persona nata nel 1900 (126 anni nel 2026): conta in "80+" e nell'età media. *(RF-32, BR-02)*
- Persona con anno di nascita fuori da BR-02 già presente in produzione: conta tra le persone senza anno di nascita. *(RF-32, BR-02)*
- Persona in più gruppi: conta una sola volta nella sezione Età. *(RF-32)*
- Pulsante di passo successivo premuto durante un flusso guidato: si comporta come il comando corrispondente in quella situazione (spec 001, FR-018). *(RNF-14)*
- Pulsante di passo successivo premuto da un utente diverso dal proprietario: nessuna risposta (spec 001, FR-027). *(RF-30)*

## Requirements *(mandatory)*

### Functional Requirements

**Scheda gruppo e ritorno all'elenco** *(modifica spec 005 FR-002, FR-008)*

- **FR-001** *(RF-19, RF-07, D-30; modifica 005 FR-002, FR-008)*: Ogni scheda gruppo MUST mostrare, sotto [✏️ Rinomina] [🗑 Elimina] e su una riga a sé, il pulsante [⬅️ Tutti i gruppi]. Se la scheda è spezzata in più messaggi, MUST stare sull'ultimo, con gli altri pulsanti. Decade il divieto di pulsante Indietro di spec 005 FR-002.
- **FR-002** *(RF-19, RNF-14)*: [⬅️ Tutti i gruppi] MUST inviare un nuovo messaggio con l'elenco gruppi attuale, come `/gruppi` senza argomento (spec 005 FR-001, FR-003, FR-004, con FR-004 di questa spec): pulsanti fino a 60 gruppi, oltre elenco testuale. La scheda di partenza MUST NOT essere modificata.

**Voce e scheda "Senza gruppo"** *(modifica spec 005 FR-001, FR-003, FR-004, FR-005, FR-007, FR-011, FR-013)*

- **FR-003** *(RF-07, D-31)*: "Senza gruppo" MUST essere un gruppo virtuale calcolato al momento, che raccoglie le persone senza alcuna appartenenza. MUST NOT essere salvato come gruppo, rinominato, eliminato, né cercato con `/gruppi <nome>` o con il filtro di `/prossimi` (spec 005, FR-007, FR-011 invariati: il testo si cerca solo tra i gruppi salvati).
- **FR-004** *(RF-07; modifica 005 FR-001, FR-003, FR-004)*: Se N > 0 persone non hanno alcun gruppo, l'elenco gruppi MUST mostrare il pulsante [Senza gruppo (N)], senza emoji, su una riga a sé tra i gruppi e [➕ Nuovo gruppo]. Con N = 0 la voce MUST NOT comparire. La voce MUST comparire anche:
  - senza gruppi, dopo il messaggio che non ci sono gruppi, insieme a [➕ Nuovo gruppo] (modifica 005 FR-004);
  - oltre i 60 gruppi, come pulsante sotto l'elenco testuale, insieme a [➕ Nuovo gruppo] (modifica 005 FR-003).
- **FR-005** *(RF-07, D-31)*: Un gruppo reale di nome "Senza gruppo" MUST comparire tra i gruppi come gli altri, nell'ordine alfabetico, distinto dalla voce virtuale, che resta sulla sua riga. Il nome MUST NOT essere riservato.
- **FR-006** *(V-09; modifica 005 FR-013)*: La voce virtuale MUST NOT contare nel limite dei 60 gruppi; con [Senza gruppo (N)] e [➕ Nuovo gruppo] la tastiera dell'elenco MUST contenere al più 62 pulsanti.
- **FR-007** *(RF-19)*: Il tocco su [Senza gruppo (N)] MUST inviare un nuovo messaggio con la scheda "Senza gruppo", nello stesso formato della scheda gruppo (spec 005, FR-008): titolo "Senza gruppo" con il numero attuale di persone, come "👥 Senza gruppo · 12 persone"; lista delle persone senza gruppo nel formato delle liste, ordinata per prossimo compleanno, con i comandi `/p_<id>`; il solo pulsante [⬅️ Tutti i gruppi] (FR-001, FR-002), senza Rinomina ed Elimina. La scheda MUST aprirsi solo da questo pulsante.
- **FR-008** *(RF-19; modifica 005 FR-005)*: Se al tocco su [Senza gruppo (N)] tutte le persone hanno un gruppo, il bot MUST dire che ora tutte le persone hanno un gruppo e mostrare l'elenco gruppi aggiornato. Se il numero è cambiato ma resta maggiore di 0, MUST aprire la scheda con i dati attuali. Il numero N scritto sul pulsante MUST NOT contare: vale solo il numero calcolato al tocco. Con N attuale 0 vale l'avviso sopra anche se la rubrica è vuota, seguito dall'elenco gruppi aggiornato (vuoto, con il solo [➕ Nuovo gruppo] se non ci sono gruppi).
- **FR-009** *(§5.1; modifica 005 FR-014)*: In `/aiuto` la descrizione di `/gruppi [nome]` MUST indicare che l'elenco gruppi a pulsanti comprende la voce "Senza gruppo", come §5.1.

**Sezione Età di `/statistiche`** *(modifica spec 007 FR-013)*

- **FR-010** *(RF-32, D-32; modifica 007 FR-013)*: `/statistiche` MUST mostrare, subito dopo l'istogramma dei compleanni per mese, la sezione "🧑 Età" con il layout del mockup AFU §5.11. Le altre sezioni di spec 007 FR-013, compresa "Senza gruppo N" in fondo alla riga dei gruppi, restano invariate.
- **FR-011** *(BR-03, BR-04; modifica la regola dell'età per la sola `/statistiche`)*: L'età della sezione MUST essere l'età attuale: anno corrente − anno di nascita, meno uno se il compleanno di quest'anno non è ancora passato alla data di oggi in Europe/Rome. Per chi è nato il 29/02, negli anni non bisestili il compleanno si considera compiuto il 28/02. Tutte le altre viste MUST continuare a usare l'età che si compirà (BR-03).
- **FR-012** *(RF-32)*: La sezione MUST contare solo le persone con l'anno di nascita e MUST mostrare un istogramma testuale per decadi (0-9, 10-19, …, 70-79) più una fascia finale unica "80+". Le righe MUST andare dalla fascia più bassa alla più alta tra quelle con almeno una persona; le fasce vuote intermedie MUST comparire con 0.
- **FR-013** *(RF-32)*: In fondo alla sezione MUST comparire "Età media: N anni", media delle età attuali arrotondata all'intero più vicino (0,5 per eccesso), seguita dal richiamo al numero di persone senza anno di nascita, escluse dal calcolo.
- **FR-014** *(RF-32)*: Se nessuna persona ha l'anno di nascita, la sezione MUST dire che l'età non è disponibile, senza istogramma né età media.
- **FR-015** *(RF-32, D-32)*: La sezione MUST contenere solo conteggi: MUST NOT mostrare nomi di persone (né la più giovane né la più anziana).

**Pulsanti di passo successivo** *(modifica spec 005 FR-012, 001 FR-031, 003 FR-004)*

- **FR-016** *(RNF-14, D-33; modifica 005 FR-012, 001 FR-031, 003 FR-004)*: Oltre all'eccezione dei gruppi, sono ammessi pulsanti di passo successivo: in fondo a una vista, al massimo 2 per vista, oltre agli eventuali pulsanti di azione già previsti. Si applicano solo a `/mese` (FR-019), `/anno` (FR-020), `/prossimi` (FR-018), scheda gruppo e scheda "Senza gruppo" (FR-001, FR-007) e conferma del salvataggio di una persona (FR-021). Le righe delle persone MUST NOT avere pulsanti; `/cerca` MUST NOT averne.
- **FR-017** *(RNF-14)*: Ogni pulsante di passo successivo MUST inviare un nuovo messaggio; il messaggio di partenza MUST NOT essere modificato. Se la vista è spezzata in più messaggi, i pulsanti MUST stare sull'ultimo. La vista di arrivo MUST essere calcolata al momento del tocco.
- **FR-018** *(RF-17; modifica 003 FR-009)*: Se la finestra di `/prossimi` è inferiore a 90 giorni, in fondo alla lista MUST comparire [Prossimi 90 giorni], anche quando la lista è vuota. Il tocco MUST mostrare la stessa vista su 90 giorni con lo stesso filtro di gruppo, compreso il gruppo scelto tra più candidati (spec 005, FR-011). Se il gruppo del filtro non esiste più, il bot MUST comportarsi come con un gruppo che non esiste (spec 005, FR-011). Con 90 giorni o più il pulsante MUST NOT comparire.
- **FR-019** *(RF-20; modifica 003 FR-015)*: In fondo alla vista `/mese` MUST comparire [◀️ <mese precedente>] [<mese successivo> ▶️], con il nome del mese per esteso, anche se il mese non ha compleanni. Lo scorrimento MUST essere circolare (prima di gennaio dicembre, dopo dicembre gennaio). Il tocco MUST mostrare `/mese` di quel mese; il pulsante porta solo il mese e l'anno di riferimento segue la regola di spec 003 FR-015 (invariata).
- **FR-020** *(RF-22; modifica 003 FR-019)*: In fondo al riepilogo `/anno` MUST comparire [◀️ <anno − 1>] solo se l'anno precedente a quello mostrato ha almeno un'occorrenza chiusa (*fatto*, *saltato* o *non confermato*) nello storico, calcolata al momento in cui si mostra la vista; le occorrenze ancora aperte MUST NOT contare, come nei conteggi di spec 003 FR-019; e [<anno + 1> ▶️] solo se l'anno mostrato è precedente all'anno corrente (Europe/Rome). Se nessuna delle due condizioni vale, MUST NOT comparire alcun pulsante. Il tocco MUST mostrare `/anno` di quell'anno.
- **FR-021** *(RF-01; modifica 001 FR-003, 006 FR-003, 008 FR-008)*: Nel messaggio che segue il salvataggio di una persona (conferma in testa alla scheda), e solo lì, sotto i pulsanti della scheda (spec 006, FR-002) MUST comparire [➕ Aggiungi un'altra persona] su una riga a sé. Il pulsante MUST NOT comparire quando la scheda è aperta con `/p_<id>`, da `/cerca`, o ridisegnata dopo una modifica o Segna fatto. MUST NOT esserci un pulsante "Apri scheda".
- **FR-022** *(RF-01)*: [➕ Aggiungi un'altra persona] MUST avviare un nuovo inserimento guidato come `/nuovo`, anche quando è in corso un altro flusso guidato (spec 001, FR-018): il flusso in corso MUST essere interrotto senza salvare nulla, come per qualsiasi altro comando, e il nuovo inserimento ricomincia dal nome. Il pulsante MUST NOT essere legato al flusso di salvataggio che lo ha prodotto (non vale spec 001 FR-018c): resta valido nel tempo, anche dopo l'eliminazione della persona salvata, e ogni tocco, ripetuto o no, avvia un nuovo inserimento da capo, interrompendo anche quello avviato da un tocco precedente.

**Icone e testi** *(modifica spec 008 FR-009, FR-004a)*

- **FR-023** *(RNF-19; modifica 008 FR-009)*: L'elenco chiuso delle icone dei pulsanti di spec 008 FR-009 MUST includere: ◀️ e ▶️ per scorrere mesi e anni, con la freccia verso l'esterno ([◀️ Febbraio] [Aprile ▶️], [◀️ 2025] [2027 ▶️]); ⬅️ per tornare a un elenco ([⬅️ Tutti i gruppi]); ➕ per avviare un nuovo inserimento ([➕ Aggiungi un'altra persona]). [Prossimi 90 giorni] e [Senza gruppo (N)] MUST NOT avere icone.
- **FR-024** *(RNF-15, RNF-19; modifica 008 FR-004a)*: Tutti i nuovi testi (pulsanti, titolo della scheda "Senza gruppo", avviso "tutte le persone hanno un gruppo", sezione Età e suoi testi, descrizione in `/aiuto`) MUST stare nel punto unico dei testi ed essere classificati nel suo inventario con la regola del loro tipo.

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.2")*

- **FR-025**: Il rilascio MUST NOT richiedere nuove entità, nuovi attributi o conversioni dei dati esistenti. "Senza gruppo" si calcola dalle persone senza appartenenze; l'età dall'anno di nascita già presente.
- **FR-026** *(RF-32)*: Le persone già presenti senza anno di nascita MUST restare escluse dalla sezione Età e contate a parte (FR-013); i loro dati MUST NOT essere modificati.
- **FR-026a** *(RF-32, BR-02)*: Le età di 120 anni o più (anni di nascita ammessi da BR-02, dal 1900) MUST contare nella fascia "80+" e nell'età media. Una persona con un anno di nascita fuori da BR-02 (futuro o precedente al 1900), eventualmente già presente in produzione, MUST essere trattata nella sezione Età come senza anno di nascita: esclusa da istogramma ed età media e contata nel richiamo; il dato MUST NOT essere modificato. Ogni persona MUST contare una sola volta, indipendentemente dal numero dei suoi gruppi.
- **FR-027** *(RF-07, D-31)*: Un gruppo reale di nome "Senza gruppo" già presente MUST restare invariato (nome, appartenenze, export e backup) e distinto dalla voce virtuale (FR-005).
- **FR-028** *(Impatto v1.2; spec 004 invariata)*: Il gruppo virtuale MUST NOT entrare in export e backup; export, backup e ripristino MUST restare come in spec 004.
- **FR-029** *(RNF-14)*: I messaggi già inviati prima del rilascio (schede gruppo, elenchi gruppi, liste, riepiloghi, conferme di salvataggio) MUST NOT essere aggiornati: restano senza i nuovi pulsanti, e i loro pulsanti esistenti MUST continuare a funzionare come oggi.
- **FR-030** *(RNF-14, FR-029; modifica 005 FR-005)*: [⬅️ Tutti i gruppi] e [Senza gruppo (N)] MUST aggiungersi ai pulsanti dei gruppi di spec 005 senza cambiarne la versione (ambito "g2" del contratto dei pulsanti di spec 005), come due azioni nuove che non portano né il gruppo né il suo nome. I pulsanti dei gruppi esistenti (Nuovo, apri, rinomina, elimina, `/prossimi` di un gruppo) MUST NOT cambiare forma né significato: quelli dell'elenco gruppi, della scheda gruppo e della scelta tra più gruppi già inviati MUST continuare a funzionare, e le viste che aprono, calcolate al tocco, contengono i nuovi pulsanti.

### Key Entities *(include if feature involves data)*

- **Senza gruppo** *(AFU glossario, D-31)*: gruppo virtuale, non salvato, calcolato al momento come insieme delle persone senza alcuna Appartenenza; ha un numero di persone e una scheda, ma non un nome salvato, né Rinomina ed Elimina.
- **Pulsante di passo successivo** *(AFU glossario, RNF-14)*: pulsante in fondo a una vista che porta a una vista vicina con un nuovo messaggio; non è un dato salvato.
- **Persona, Gruppo, Appartenenza, Occorrenza** *(AFU §8, spec 001 e 002)*: nessun nuovo attributo; lette per la voce "Senza gruppo", la sezione Età e le condizioni dei pulsanti di `/anno`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-01, RF-07, RF-17, RF-19, RF-20, RF-22, RF-32, RNF-14)*: Il 100% dei criteri di accettazione Dato/Quando/Allora v1.2 dei requisiti inclusi è verificato da almeno un test; i criteri delle spec 001-008 continuano a passare, salvo quelli esplicitamente modificati qui.
- **SC-002** *(RF-07, RF-19)*: Dall'elenco gruppi il proprietario apre una scheda gruppo, torna all'elenco e apre un'altra scheda (o la scheda "Senza gruppo") con soli tocchi, senza scrivere comandi.
- **SC-003** *(RNF-14, D-33)*: Nessuna vista mostra più di 2 pulsanti di passo successivo, e nessuna riga di persona ha pulsanti.
- **SC-004** *(RF-20, RF-22)*: Dai 12 mesi di `/mese` si percorre l'intero anno in entrambe le direzioni con i soli pulsanti; da `/anno` si raggiungono con i soli pulsanti tutti gli anni consecutivi con storico fino all'anno corrente.
- **SC-005** *(RF-32)*: I conteggi per decade e l'età media della sezione Età coincidono al 100% con quelli calcolati a mano su una rubrica di prova con date di oggi diverse.
- **SC-006** *(Impatto v1.2)*: Dopo il rilascio, il 100% dei dati in produzione (persone, gruppi, appartenenze, occorrenze, messaggi già inviati) resta identico a prima.

## Assumptions

- Le spec 001-008 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto vale questa spec (AFU v1.2).
- [Prossimi 90 giorni] con il gruppo del filtro rinominato nel frattempo segue la stessa regola dei pulsanti di gruppo (spec 005, FR-005): vale come gruppo che non esiste più.
- In `/statistiche`, senza alcun gruppo la riga dei gruppi resta come in spec 007 (lo dice, senza "Senza gruppo N"): l'AFU v1.2 descrive il conteggio come "già mostrato, ora nel requisito".
- Il richiamo alle persone senza anno di nascita nella sezione Età compare solo se ce n'è almeno una; con 0 resta solo "Età media: N anni".
- Una persona con età attuale negativa (nata quest'anno, con la data di nascita successiva a oggi, ammessa da BR-02) conta come 0 anni.
- Le barre della sezione Età seguono la stessa regola dell'istogramma per mese di spec 007 (larghezza massima fissa per la fascia più numerosa, almeno un blocco per una fascia non vuota).
- Il nome del mese dei pulsanti di `/mese` è quello italiano con l'iniziale maiuscola, come nel mockup (Febbraio, Aprile).
- I testi seguono i mockup §5.2, §5.7, §5.9 e §5.11; i testi definitivi stanno nel punto unico dei testi (RNF-15).
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
