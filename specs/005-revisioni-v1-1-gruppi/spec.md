# Feature Specification: Revisioni v1.1 — Gruppi

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-1-gruppi\". Fonte unica: docs/AFU.md v1.1, sezioni \"Registro modifiche\" e \"Impatto della versione 1.1\", area Gruppi: RF-07, RF-17, RF-19, BR-26, RNF-14, V-09 (REV-003, REV-004). Il bot è già implementato (specs da 001 a 004): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione. Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.1 (fonte di verità funzionale): Registro modifiche (REV-003, REV-004), "Impatto della versione 1.1", testi v1.1 di RF-07, RF-17, RF-19, BR-26, RNF-14, V-09 e mockup §5.9. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica) e 003 (viste-ricerche); tutto ciò che non è citato qui resta come definito in quelle spec.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-003 | `/gruppi` con pulsanti e scheda gruppo | RF-07, RF-19, RNF-14, V-09 (§5.1, §5.9) |
| REV-004 | Ricerca morbida del gruppo | RF-17, RF-19, BR-26 |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 001 | FR-019, User Story 6 | `/gruppi` senza argomento mostra l'elenco gruppi a pulsanti; Rinomina ed Elimina partono dalla scheda gruppo | RF-07, V-09 |
| 001 | FR-010a, FR-020, FR-023 | Il nome di un gruppo deve avere una chiave BR-26 di almeno 2 caratteri (chiarimento 2026-10-29) | BR-26, BR-17 |
| 004 | FR-006 | Un gruppo da creare con chiave di meno di 2 caratteri rende la riga non valida (chiarimento 2026-10-29) | BR-26, BR-23 |
| 001 | FR-031 | Eccezione a "pulsanti solo per le azioni" per la scelta dei gruppi | RNF-14 |
| 001 | FR-025, tabella comandi | `/aiuto` e menu mostrano `/gruppi [nome]`; `/gruppo` non compare più | RF-19, §5.1 |
| 003 | FR-004, SC-005 | Le liste di persone restano senza pulsanti; l'elenco e la scelta dei gruppi no | RNF-14 |
| 003 | FR-010 | Filtro gruppo di `/prossimi` con la ricerca di BR-26 e scelta a pulsanti | RF-17, BR-26 |
| 003 | FR-014, tabella comandi, casi limite di `/gruppo` | `/gruppi <testo>` (alias `/gruppo`) cerca per parte del nome e apre la scheda gruppo | RF-19, BR-26 |

**Comando dopo la revisione (AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/gruppi [nome]` | Senza nome: elenco gruppi a pulsanti. Con nome: ricerca e scheda gruppo. Alias accettato: `/gruppo` | RF-07, RF-19 |

**Fuori da questa feature**: RF-52 (gestione dei membri dalla scheda gruppo, idea futura); le altre revisioni v1.1 (REV-001, REV-002, REV-005, REV-006, REV-007: scheda e contatti, stato e statistiche, guida di stile RNF-19). L'assegnazione dei gruppi a una persona resta quella di RF-08 (spec 001, FR-023).

## Clarifications

### Session 2026-10-29

- Q: Quando il bot calcola la chiave di ricerca di BR-26, quali caratteri del nome del gruppo e del testo cercato deve scartare? → A: Si tengono solo lettere (senza accenti, in minuscolo) e cifre; ogni altro carattere (emoji semplici e composte con ZWJ, colori della pelle, bandiere, simboli come ★, punteggiatura) diventa uno spazio, poi gli spazi si compattano.
- Q: Se un gruppo ha un nome fatto solo di emoji o simboli (chiave vuota), come deve comportarsi il bot? → A: Il nome di un gruppo MUST avere una chiave di almeno 2 caratteri (lettere o cifre), in creazione (anche al volo e da import CSV) e in rinomina; i gruppi già in produzione fuori regola restano invariati, raggiungibili dall'elenco, e la regola si applica solo quando vengono rinominati (decisione del proprietario, riportata in AFU v1.1, BR-26).
- Q: In `/prossimi`, quando il primo argomento è un numero, va sempre letto come numero di giorni, anche se esiste un gruppo il cui nome inizia con un numero? → A: Sì: un primo argomento di sole cifre è sempre il numero di giorni (fuori da 1–366 è un errore); tutto il resto è il testo del gruppo, cifre comprese; senza numero i giorni sono 30; il pulsante di scelta tra più gruppi conserva N.
- Q: Un pulsante di gruppo toccato dopo che il gruppo è stato rinominato apre il gruppo con il nome nuovo o dice che non esiste più? E i pulsanti dei messaggi `/gruppi` precedenti al deploy? → A: Il pulsante vale solo se il gruppo esiste ancora con lo stesso nome; se è stato eliminato o rinominato, il bot dice che il gruppo non esiste più e mostra l'elenco aggiornato, senza modificare nulla. I pulsanti dei messaggi precedenti al deploy rispondono "Questa azione non è più disponibile".
- Q: Dopo Rinomina o Elimina dalla scheda gruppo, cosa manda il bot oltre alla conferma? → A: Rinomina: conferma più un nuovo messaggio con la scheda gruppo aggiornata (nome nuovo). Elimina: conferma più l'elenco gruppi aggiornato. La vecchia scheda non viene modificata.
- Q: La conferma di Rinomina o Elimina è un messaggio separato? → A: No: è la prima riga del messaggio con la scheda aggiornata (Rinomina) o con l'elenco aggiornato (Elimina).
- Q: Quando si aggiorna il menu dei comandi su Telegram? → A: Automaticamente, senza passi manuali, alla prima esecuzione oraria dopo il deploy in cui non partono promemoria né il backup mensile.
- Q: La regola dei 2 caratteri (FR-006a) vale anche per il ripristino da backup? → A: No: il backup riporta dati già esistenti, che FR-016 lascia invariati.
- Q: Cosa succede a un flusso `/gruppi` aperto al momento del rilascio, compresa una creazione in corso? → A: Si interrompe e va ripreso da `/gruppi` (FR-017).
- Q: La ricerca può leggere in una sola volta tutte le appartenenze, anche quando l'esito è una scelta tra più gruppi? → A: Sì, per avere una sola lettura dal database in ogni caso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ricerca morbida del gruppo (Priority: P1)

Il proprietario scrive `/gruppi` (o `/gruppo`) seguito da una parte del nome di un gruppo, senza preoccuparsi di emoji, accenti o maiuscole, e arriva alla scheda gruppo. Se il testo corrisponde a più gruppi, sceglie con un pulsante.

**Why this priority**: è la revisione più urgente: oggi `/gruppo` è inutilizzabile con i gruppi che hanno emoji nel nome (AFU, "Ordine di realizzazione consigliato").

**Independent Test**: con i gruppi "👨‍👩‍👧 Famiglia", "Famiglia Rossi", "Lavoro" e "Università", inviare `/gruppi fam`, `/gruppi famiglia`, `/gruppo lavoro`, `/gruppi universita`, `/gruppi xyz` e verificare scheda, pulsanti di scelta e messaggi.

**Flusso di esempio (AFU §5.9)**:

```
Tu:  /gruppi fam
Bot: 🔍 Più gruppi corrispondono a «fam»:
     [Famiglia (8)] [Famiglia Rossi (3)]
```

**Acceptance Scenarios**:

1. **Given** che il gruppo si chiama "👨‍👩‍👧 Famiglia" ed è l'unico che contiene "fam", **When** scrivo `/gruppi fam`, **Then** si apre la sua scheda gruppo. *(RF-19, BR-26)*
2. **Given** i gruppi "👨‍👩‍👧 Famiglia" e "Famiglia Rossi", **When** scrivo `/gruppi famiglia`, **Then** si apre la scheda di "👨‍👩‍👧 Famiglia", perché la corrispondenza esatta della chiave vince sulle parziali. *(RF-19, BR-26)*
3. **Given** i gruppi "Famiglia" e "Famiglia Rossi", **When** scrivo `/gruppi fam`, **Then** il bot mostra un pulsante per ciascun gruppo trovato e il tocco apre la scheda gruppo. *(RF-19, RNF-14, §5.9)*
4. **Given** il gruppo "Università", **When** scrivo `/gruppi UNIVERSITA`, **Then** si apre la sua scheda gruppo. *(BR-26)*
5. **Given** che nessun gruppo contiene "xyz", **When** scrivo `/gruppi xyz`, **Then** il bot lo segnala e mostra l'elenco gruppi a pulsanti di RF-07. *(RF-19)*
6. **Given** il gruppo "Lavoro", **When** scrivo `/gruppo lavoro`, **Then** il risultato è identico a `/gruppi lavoro`. *(RF-19)*
7. **Given** il proprietario, **When** apre `/aiuto` o il menu dei comandi, **Then** vede `/gruppi [nome]` e non vede `/gruppo`. *(RF-19, §5.1)*

---

### User Story 2 - Elenco gruppi a pulsanti e scheda gruppo (Priority: P1)

Il proprietario scrive `/gruppi` e vede i gruppi come pulsanti con il numero di persone. Toccandone uno riceve la scheda gruppo, con la lista delle persone e i pulsanti Rinomina ed Elimina, che agiscono direttamente su quel gruppo.

**Why this priority**: è il punto d'ingresso unico ai gruppi (D-25): elenco, ricerca e scelta portano tutti alla stessa scheda gruppo.

**Independent Test**: con i gruppi Famiglia (8) e Lavoro (5), inviare `/gruppi`, toccare un gruppo, usare Rinomina ed Elimina dalla scheda; ripetere senza gruppi e con più di 60 gruppi.

**Flusso di esempio (AFU §5.9)**:

```
Tu:  /gruppi
Bot: 👥 I tuoi gruppi
     [Beach tennis (6)]  [Famiglia (8)]
     [Lavoro (5)]        [Università (12)]
     [➕ Nuovo gruppo]
Tu:  [Famiglia (8)]
Bot: 👥 Famiglia · 8 persone

     Gio 30/10  Anna (28)      /p_4
     Dom 02/11  Luca (35)      /p_17
     …
     [✏️ Rinomina] [🗑 Elimina]
```

**Acceptance Scenarios**:

1. **Given** che ho i gruppi Famiglia (8) e Lavoro (5), **When** scrivo `/gruppi`, **Then** vedo i pulsanti [Famiglia (8)] [Lavoro (5)] e [➕ Nuovo gruppo]. *(RF-07)*
2. **Given** che tocco [Famiglia (8)], **Then** ricevo un nuovo messaggio con la scheda gruppo di Famiglia; il messaggio dell'elenco resta com'è e non c'è un pulsante Indietro. *(RF-07, RF-19)*
3. **Given** la scheda gruppo di Famiglia, **Then** vedo il titolo con nome e numero di persone, le persone nel formato delle liste ordinate per prossimo compleanno con i comandi `/p_<id>`, e i pulsanti [✏️ Rinomina] [🗑 Elimina]. *(RF-19)*
4. **Given** che dalla scheda gruppo premo Rinomina, **Then** il bot chiede direttamente il nuovo nome di quel gruppo, senza chiedere "Quale gruppo?"; **When** scrivo un nome valido, **Then** il bot conferma e invia la scheda gruppo aggiornata con il nome nuovo. *(RF-07, chiarimento 2026-10-29)*
5. **Given** che dalla scheda gruppo di un gruppo con 8 persone premo Elimina, **When** il bot chiede conferma indicando "8 persone perderanno questa etichetta" e confermo, **Then** il gruppo viene eliminato, le persone restano e il bot mostra l'elenco gruppi aggiornato. *(RF-07, RNF-05, chiarimento 2026-10-29)*
6. **Given** che premo un gruppo eliminato o rinominato nel frattempo, **Then** il bot segnala che il gruppo non esiste più e mostra l'elenco aggiornato. *(RF-07)*
7. **Given** che non ho gruppi, **When** scrivo `/gruppi`, **Then** il bot lo dice e mostra solo [➕ Nuovo gruppo]. *(RF-07)*
8. **Given** che ho più di 60 gruppi, **When** scrivo `/gruppi`, **Then** l'elenco è testuale, con l'invito a scrivere `/gruppi <nome>`. *(RF-07, V-09)*

---

### User Story 3 - Filtro gruppo di `/prossimi` con la ricerca morbida (Priority: P2)

Il proprietario filtra `/prossimi` per gruppo scrivendo una parte del nome, con la stessa regola di `/gruppi <nome>`.

**Why this priority**: estende la ricerca di BR-26 a una vista che già esiste; il valore principale (raggiungere il gruppo) è già dato dalla User Story 1.

**Independent Test**: con i gruppi "👨‍👩‍👧 Famiglia" e "Famiglia Rossi", inviare `/prossimi 7 fam`, `/prossimi 7 famiglia`, `/prossimi 7 xyz` e verificare lista, pulsanti di scelta e messaggi.

**Acceptance Scenarios**:

1. **Given** che il gruppo si chiama "👨‍👩‍👧 Famiglia" ed è l'unico che contiene "fam", **When** scrivo `/prossimi 7 fam`, **Then** vedo la lista dei prossimi 7 giorni filtrata su quel gruppo. *(RF-17, BR-26)*
2. **Given** che "fam" corrisponde a "Famiglia" e "Famiglia Rossi", **When** scrivo `/prossimi 7 fam`, **Then** il bot mostra un pulsante per ciascun gruppo; il tocco rilancia la lista dei prossimi 7 giorni filtrata su quel gruppo. *(RF-17, RNF-14)*
3. **Given** che il gruppo indicato non esiste, **When** scrivo `/prossimi 7 xyz`, **Then** il bot lo segnala e mostra l'elenco gruppi a pulsanti di RF-07. *(RF-17)*
4. **Given** che "fam" corrisponde solo a "👨‍👩‍👧 Famiglia", **When** scrivo `/prossimi fam`, **Then** vedo la lista dei prossimi 30 giorni filtrata su quel gruppo. *(RF-17, chiarimento 2026-10-29)*
5. **Given** il gruppo "2024 Calcetto", **When** scrivo `/prossimi 2024 calcetto`, **Then** il bot segnala che i giorni vanno da 1 a 366; **When** scrivo `/prossimi 30 2024 calcetto`, **Then** vedo la lista filtrata su quel gruppo. *(RF-17, chiarimento 2026-10-29)*

---

### Edge Cases

- Gruppo eliminato o rinominato tra la visualizzazione di un pulsante (elenco, scelta tra più gruppi, Rinomina, Elimina) e il tocco: il bot segnala che il gruppo non esiste più, mostra l'elenco aggiornato e non modifica nulla; vale anche se il gruppo rinominato esiste con un altro nome. *(RF-07, FR-005)*
- Scheda gruppo la cui lista supera la lunghezza di un messaggio: la lista è spezzata in più messaggi (spec 003, FR-005) e i pulsanti [✏️ Rinomina] [🗑 Elimina] stanno sull'ultimo. *(RF-19)*
- Scheda di un gruppo senza persone: il titolo indica 0 persone, il bot dice che nel gruppo non ci sono persone e mostra comunque [✏️ Rinomina] [🗑 Elimina]. *(RF-19, spec 003 casi limite)*
- Esattamente 60 gruppi: elenco a pulsanti; 61 o più: elenco testuale. *(V-09)*
- Due gruppi esistenti con la stessa chiave di ricerca (es. "Famiglia" e "👨‍👩‍👧 Famiglia", entrambi ammessi da BR-17) e testo che corrisponde esattamente a entrambi: il bot mostra un pulsante per ciascuno dei due. *(BR-26, BR-17)*
- Testo di ricerca che, ridotto a chiave, resta vuoto (es. solo emoji): trattato come `/gruppi` senza argomento, quindi elenco gruppi di RF-07; in `/prossimi` il filtro non si applica. *(BR-26)*
- Creazione o rinomina di un gruppo con nome "🏖", "★★" o "🏖 X" (chiave di meno di 2 caratteri): rifiutata con l'indicazione della regola e ripetizione della domanda; "U2" e "★ Bar" sono ammessi. *(FR-006a, chiarimento 2026-10-29)*
- Riga del CSV che indica un gruppo nuovo con chiave di meno di 2 caratteri: la riga è scartata con il motivo, come per gli altri valori non validi; un gruppo già esistente con quel nome viene invece associato normalmente. *(FR-006a; spec 004, FR-006)*
- Gruppo già in produzione il cui nome è composto solo da emoji: resta invariato, non è trovabile con la ricerca per testo e resta raggiungibile dall'elenco gruppi; per rinominarlo serve un nome conforme a FR-006a. *(BR-26, FR-016)*
- Rinomina dalla scheda con un nome già usato da un altro gruppo (senza distinzione tra maiuscole e minuscole) o fuori dai limiti di lunghezza: rifiutato come oggi. *(BR-17; spec 001, FR-010a, FR-020)*
- Pulsante di un messaggio `/gruppi` inviato prima del rilascio (vecchio formato, compresi i passaggi "Quale gruppo?" di Rinomina ed Elimina): il bot risponde "Questa azione non è più disponibile" e non modifica nessun gruppo. *(FR-017, chiarimento 2026-10-29)*

## Requirements *(mandatory)*

### Functional Requirements

**Elenco gruppi** *(modifica spec 001, FR-019)*

- **FR-001** *(RF-07; modifica 001 FR-019)*: `/gruppi` senza argomento (o `/gruppo` senza argomento) MUST mostrare l'elenco gruppi come pulsanti, uno per gruppo, con etichetta "<nome> (<numero di persone>)", in ordine alfabetico, su due colonne, più il pulsante [➕ Nuovo gruppo], che avvia la creazione di un gruppo come oggi. Sostituisce, in spec 003, la risposta "sintassi del comando" di `/gruppo` senza argomento.
- **FR-002** *(RF-07, RF-19)*: Il tocco su un gruppo dell'elenco MUST inviare un nuovo messaggio con la scheda gruppo (FR-008); il messaggio dell'elenco MUST NOT essere modificato e MUST NOT esserci un pulsante Indietro.
- **FR-003** *(RF-07, V-09)*: Con più di 60 gruppi l'elenco MUST essere testuale (una riga per gruppo, "<nome> (<numero di persone>)", in ordine alfabetico) con l'invito a scrivere `/gruppi <nome>`.
- **FR-004** *(RF-07)*: Senza gruppi, il bot MUST dirlo e mostrare solo [➕ Nuovo gruppo].
- **FR-005** *(RF-07; chiarimento 2026-10-29)*: Ogni pulsante di gruppo (elenco, scelta tra più gruppi in `/gruppi` e `/prossimi`, Rinomina ed Elimina della scheda) MUST agire solo se il gruppo esiste ancora con lo stesso nome mostrato quando il pulsante è stato inviato. Se il gruppo è stato eliminato o rinominato nel frattempo, il bot MUST segnalare che il gruppo non esiste più, mostrare l'elenco aggiornato (FR-001…FR-004) e MUST NOT modificare alcun gruppo.

**Ricerca del gruppo** *(modifica spec 003, FR-014)*

- **FR-006** *(BR-26)*: Testo cercato e nomi dei gruppi MUST essere confrontati con una chiave che ignora maiuscole, accenti ed emoji e compatta gli spazi ("famiglia" corrisponde esattamente a "👨‍👩‍👧 Famiglia"). La chiave MUST contenere solo lettere senza accenti, in minuscolo, e cifre: ogni altro carattere (emoji semplici e composte con ZWJ, colori della pelle, bandiere, simboli come ★, punteggiatura) MUST diventare uno spazio; poi gli spazi consecutivi MUST essere compattati e quelli iniziali e finali rimossi ("beach-tennis" corrisponde esattamente a "Beach tennis"; "★ Calcetto 🇮🇹" ha chiave "calcetto") (chiarimento 2026-10-29).
- **FR-006a** *(BR-26, BR-17; modifica 001 FR-010a, FR-020, FR-023 e 004 FR-006; chiarimento 2026-10-29)*: Il nome di un gruppo MUST avere una chiave (FR-006) di almeno 2 caratteri. La regola MUST valere in ogni creazione ([➕ Nuovo gruppo] di `/gruppi`, creazione al volo dello step Gruppi, gruppi creati dall'import CSV) e in ogni rinomina; nel guidato un nome non conforme MUST essere rifiutato indicando la regola e ripetendo la domanda; nell'import la riga MUST essere scartata con il motivo. Restano valide le altre regole (unicità BR-17, massimo 30 caratteri). Regola di BR-26 (AFU v1.1, REV-004). Il testo MUST essere cercato in qualsiasi parte del nome. Una corrispondenza esatta della chiave MUST vincere sulle corrispondenze parziali. La chiave MUST essere calcolata al momento della ricerca e MUST NOT modificare i nomi salvati.
- **FR-007** *(RF-19; modifica 003 FR-014)*: `/gruppi <testo>` e `/gruppo <testo>` MUST essere lo stesso comando e cercare il gruppo secondo FR-006:
  - un solo gruppo trovato, oppure una sola corrispondenza esatta: si apre la scheda gruppo (FR-008);
  - più gruppi trovati e nessuna corrispondenza esatta (o più corrispondenze esatte): un pulsante per ogni gruppo candidato, con etichetta "<nome> (<numero di persone>)"; il tocco apre la scheda gruppo;
  - nessun gruppo trovato: il bot lo segnala e mostra l'elenco gruppi (FR-001…FR-004).

**Scheda gruppo** *(nuova; modifica spec 001 FR-019 e spec 003 FR-014)*

- **FR-008** *(RF-19)*: La scheda gruppo MUST contenere: titolo con il nome del gruppo e il numero di persone; la lista delle persone nel formato delle liste (spec 003, FR-001, FR-001a, FR-005), ordinata per prossimo compleanno, con i comandi `/p_<id>`; i pulsanti [✏️ Rinomina] [🗑 Elimina]. Se la lista è spezzata in più messaggi, i pulsanti MUST stare sull'ultimo.
- **FR-009** *(RF-07; modifica 001 FR-019)*: Rinomina dalla scheda gruppo MUST chiedere direttamente il nuovo nome di quel gruppo, senza il passaggio "Quale gruppo?". Restano valide le regole di spec 001 FR-010a, FR-020 e FR-021. Dopo la rinomina il bot MUST confermare e inviare un nuovo messaggio con la scheda gruppo aggiornata (FR-008); la scheda precedente MUST NOT essere modificata (chiarimento 2026-10-29).
- **FR-010** *(RF-07, RNF-05; modifica 001 FR-019)*: Elimina dalla scheda gruppo MUST agire su quel gruppo, senza il passaggio "Quale gruppo?", con la conferma che indica quante persone perderanno l'etichetta (spec 001, FR-022, invariato). Dopo l'eliminazione il bot MUST confermare e mostrare l'elenco gruppi aggiornato (FR-001…FR-004); la scheda precedente MUST NOT essere modificata (chiarimento 2026-10-29).

**Filtro gruppo di `/prossimi`** *(modifica spec 003, FR-010)*

- **FR-011** *(RF-17, BR-26; modifica 003 FR-010)*: Il filtro per gruppo di `/prossimi [giorni] [gruppo]` MUST cercare il gruppo secondo FR-006, con gli stessi esiti di FR-007, salvo che:
  - con un gruppo individuato si mostra la lista dei prossimi N giorni filtrata su quel gruppo (spec 003, FR-009);
  - con più gruppi candidati, il tocco su un pulsante rilancia la lista dei prossimi N giorni, con lo stesso N, filtrata su quel gruppo;
  - con nessun gruppo trovato, il bot lo segnala e mostra l'elenco gruppi a pulsanti (FR-001…FR-004).

  Restano invariati gli altri comportamenti di spec 003 (FR-009, FR-011).
- **FR-011a** *(RF-17; conferma l'assunzione di spec 003 sugli argomenti posizionali; chiarimento 2026-10-29)*: Un primo argomento composto solo da cifre MUST essere sempre letto come numero di giorni (fuori da 1–366 si applica spec 003, FR-011); tutto il testo che segue, cifre comprese, MUST essere il testo del gruppo. Senza primo argomento numerico, i giorni MUST essere 30 e tutto il testo è il gruppo (`/prossimi fam` = 30 giorni, gruppo "fam"). Per un gruppo il cui nome inizia con un numero si indicano prima i giorni (`/prossimi 30 2024 calcetto`).

**Pulsanti e navigazione** *(modifica spec 001 FR-031 e spec 003 FR-004)*

- **FR-012** *(RNF-14; modifica 001 FR-031 e 003 FR-004)*: I pulsanti MUST restare riservati alle azioni, con una sola eccezione: i gruppi si scelgono con pulsanti (elenco gruppi di FR-001, scelta tra più gruppi di FR-007 e FR-011). Le liste di persone, scheda gruppo compresa, MUST NOT contenere pulsanti di navigazione: si naviga con i comandi `/p_<id>`.
- **FR-013** *(V-09)*: Ogni tastiera di scelta dei gruppi (FR-001, FR-007, FR-011) MUST contenere al massimo 60 pulsanti di gruppo; oltre, il bot MUST mostrare i gruppi come elenco testuale (FR-003).

**Comandi** *(modifica spec 001 FR-025 e tabelle comandi di 001 e 003)*

- **FR-014** *(RF-19, §5.1)*: `/aiuto` e il menu dei comandi registrato su Telegram MUST mostrare solo `/gruppi [nome]`, con la descrizione di §5.1; `/gruppo` MUST NOT comparire in nessuno dei due, ma MUST restare accettato come alias, con e senza argomento, con lo stesso comportamento di `/gruppi`. Il menu MUST essere aggiornato automaticamente dopo il rilascio, senza passi manuali, alla prima esecuzione oraria in cui non partono promemoria né il backup mensile (chiarimento 2026-10-29).

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.1")*

- **FR-015**: Il rilascio MUST NOT richiedere nuove entità, modifiche di struttura o conversioni dei dati esistenti.
- **FR-016** *(BR-26, BR-17)*: I nomi dei gruppi esistenti MUST restare invariati, comprese emoji, accenti e maiuscole; le associazioni persona-gruppo MUST restare invariate. L'unicità dei nomi resta quella di BR-17: gruppi esistenti che differiscono solo per emoji o accenti restano entrambi validi. I gruppi esistenti che non rispettano FR-006a MUST restare invariati e utilizzabili; la regola si applica loro solo alla prossima rinomina.
- **FR-017**: I messaggi già inviati prima del rilascio MUST NOT essere aggiornati. Ogni pulsante di un messaggio `/gruppi` inviato prima del rilascio (vecchio formato, compresa la scelta "Quale gruppo?" di Rinomina ed Elimina) MUST rispondere "Questa azione non è più disponibile" senza modificare alcun gruppo (chiarimento 2026-10-29).

### Key Entities *(include if feature involves data)*

- **Gruppo** *(AFU §8, spec 001)*: nessun nuovo attributo. La chiave di ricerca di BR-26 è derivata dal nome al momento e non è salvata.
- **Scheda gruppo** *(AFU §3, glossario v1.1)*: messaggio con nome del gruppo, numero di persone, lista delle persone e pulsanti Rinomina / Elimina. È una vista, non un dato.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-07, RF-17, RF-19, BR-26)*: Il 100% dei criteri di accettazione Dato/Quando/Allora v1.1 dei requisiti inclusi è verificato da almeno un test; i criteri MVP degli stessi requisiti continuano a passare.
- **SC-002** *(BR-26)*: Per ogni gruppo il cui nome contiene emoji o accenti e la cui chiave ha almeno 2 caratteri (FR-006a), il proprietario apre la scheda gruppo con un solo comando, scrivendo una parte del nome senza emoji, accenti né maiuscole (o con un tocco in più se il testo corrisponde a più gruppi).
- **SC-003** *(RF-07, RF-19)*: Da `/gruppi` alla scheda di un gruppo serve un tocco; Rinomina richiede al massimo due interazioni dalla scheda (Rinomina → nuovo nome).
- **SC-004** *(RNF-14)*: Nessuna lista di persone contiene pulsanti di navigazione; i pulsanti compaiono solo per le azioni e per la scelta dei gruppi.
- **SC-005** *(V-09)*: Con 60 gruppi l'elenco è a pulsanti; con 61 è testuale.
- **SC-006** *(Impatto v1.1)*: Dopo il rilascio, il 100% dei gruppi esistenti in produzione mantiene nome e persone associate identici a prima.

## Assumptions

- Le spec 001, 003 e 004 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto vale questa spec (AFU v1.1).
- L'ordine alfabetico dell'elenco gruppi usa la stessa chiave di BR-26, così le emoji iniziali non spostano i gruppi in fondo o in cima.
- Con più corrispondenze esatte (possibili tra gruppi esistenti che differiscono solo per emoji o accenti) il bot fa scegliere tra quelle, perché RF-19 prevede l'apertura diretta solo per una corrispondenza univoca.
- Il limite di 60 di V-09 vale anche per la scelta tra più gruppi trovati: oltre, elenco testuale dei gruppi candidati.
- Un testo di ricerca che ridotto a chiave resta vuoto equivale a nessun testo.
- [➕ Nuovo gruppo] avvia lo stesso flusso di creazione già esistente (spec 001, FR-019, FR-020); dopo la creazione il comportamento resta quello attuale.
- I testi dei messaggi seguono i mockup §5.9; la revisione complessiva dello stile (RNF-19) è fuori da questa feature.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
