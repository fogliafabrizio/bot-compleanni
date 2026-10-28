# Feature Specification: Import, export e backup

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Feature \"import-export-backup\". Fonte unica: docs/AFU.md. Includi: RF-23, RF-24, RF-25, RF-26, RF-27, le regole BR-18…BR-23 (e BR-14 per i duplicati in import), il flusso 5.8, RNF-05 (doppia conferma del ripristino), RNF-09, RNF-11 e il vincolo V-07. Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.0 (fonte di verità funzionale). Ogni requisito riporta l'ID AFU corrispondente.

## Perimetro

**Requisiti AFU inclusi**: RF-23, RF-24, RF-25, RF-26, RF-27; BR-18, BR-19, BR-20, BR-21, BR-22, BR-23; BR-14 limitatamente ai duplicati in import; RNF-05 limitatamente alla doppia conferma del ripristino; RNF-09; RNF-11; V-07. Flusso di esempio: §5.8.

**Comandi inclusi (da AFU §5.1)**:

| Comando | Funzione | RF |
|---|---|---|
| `/modello` | Scarica il modello CSV | RF-23 |
| `/export` | Esporta CSV | RF-25 |
| `/backup` | Backup JSON | RF-26 |
| `/ripristina` | Ripristino da JSON | RF-26 |

L'import (RF-24) non ha un comando: parte quando il proprietario invia un file CSV al bot.

**Invii programmati inclusi (da AFU §7)**: backup automatico, 1° del mese alle 9:00 (RF-27, A-03).

**Dipendenze**: riusa le regole di validazione e normalizzazione dell'anagrafica (feature 001: FR-004 per la definizione di duplicato, FR-005…FR-007 per la data, FR-009 per il telefono, FR-010 per gli username, FR-010a per lunghezze e spazi, FR-020 per l'unicità dei gruppi), il limite del messaggio personalizzato (feature 002, FR-035), le regole sui promemoria di persone inserite a ridosso del compleanno (feature 002, FR-017, FR-018), l'esecuzione oraria unica e il fuso Europe/Rome (feature 002, FR-002, FR-003), la gestione dei flussi guidati e dei pulsanti non più validi (feature 001, FR-018, FR-018a, FR-018c) e la whitelist (feature 001, FR-027).

**Fuori da questa feature**: tutti gli altri requisiti dell'AFU. In particolare il pulsante "Scarica modello CSV" di `/start` (RF-28), che la feature 001 (FR-024) ha rinviato all'arrivo di RF-23, non è incluso: RF-28 non è nel perimetro richiesto.

## Clarifications

### Session 2026-10-28

- Q: Dove va la legenda del modello e cosa succede alla riga d'esempio se resta nel file? → A: La legenda va nel messaggio che accompagna il file; il CSV contiene solo intestazioni e riga d'esempio. La riga d'esempio usa una persona riconoscibile e l'import la salta sempre.
- Q: Un valore non valido in un campo opzionale scarta l'intera riga? → A: Sì: la riga va tra gli errori, con il motivo, e non viene importata.
- Q: Dopo il ripristino di un backup vecchio, cosa succede alle occorrenze aperte il cui D+1 è già passato? → A: Diventano *non confermato*, senza messaggi; quelle con D o D+1 oggi restano aperte e seguono solo i promemoria futuri.
- Q: L'import ha un numero massimo di righe per file? → A: Sì, 500 righe di dati: un file più lungo è rifiutato per intero, indicando il massimo e invitando a dividerlo.
- Q: Se il backup automatico delle 9:00 del 1° del mese non parte, il bot riprova e fino a quando? → A: Riprova a ogni esecuzione oraria successiva finché l'invio riesce, anche nei giorni seguenti, sempre al massimo una volta per mese.
- Q: Modello ed export usano `;` o `,` come separatore? → A: `;` con codifica UTF-8 con BOM, così si aprono in colonne con Excel in italiano; l'import accetta entrambi.

### Session 2026-10-29

Decisioni del proprietario sulle interpretazioni segnalate in fase di piano (plan.md).

- Q: Oltre al limite di 20 MB di Telegram, serve un tetto più basso sui file ricevuti? → A: Sì, 1 MB per CSV e JSON, per restare nei 10 ms di CPU (RNF-17); copre 500 righe e un backup con circa 200 persone e 20 anni di storico. *(FR-026)*
- Q: In che forma si esporta il telefono? → A: In formato internazionale con uno spazio dopo il prefisso (`+39 3331234567`), così Excel lo tratta come testo; l'import rimuove lo spazio e il reimport resta identico. *(FR-016, Assumptions)*
- Q: L'intestazione deve contenere tutte le colonne? → A: No: obbligatorie solo `nome` e `data`; le colonne opzionali assenti valgono vuote. Le intestazioni si riconoscono anche con maiuscole e accenti diversi (`Priorità` = `priorita`). *(FR-001)*
- Q: Alla prima installazione a metà mese il backup del mese viene inviato? → A: Sì, alla prima esecuzione oraria, come effetto del recupero di FR-023a. *(FR-023a)*
- Q: Se il backup mensile resta bloccato a metà invio per un guasto della piattaforma, si ritenta? → A: No, prevale "al massimo una volta per mese" (FR-023), come per i promemoria (N-02); il recupero di FR-023a vale per gli errori di Telegram e le esecuzioni orarie non avvenute. *(FR-023, FR-023a)*
- Q: Come resta l'anteprima entro i limiti di Telegram e di subrequest (RNF-17, V-02) con file pieni di errori o di gruppi nuovi? → A: I valori citati negli errori sono accorciati a 30 caratteri con "…", ogni campo dà al massimo un motivo, i gruppi da creare vanno a capo ogni 10 nomi e l'anteprima occupa al massimo 30 messaggi: oltre, l'elenco si interrompe indicando quante righe non sono mostrate; i conteggi restano completi. *(FR-008, FR-010, Assumptions)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Onboarding con import CSV (Priority: P1)

Il proprietario scarica il modello con `/modello`, lo compila sul PC con le persone della sua agenda cartacea e lo invia al bot. Il bot valida tutte le righe e mostra un'anteprima con persone nuove, duplicati, errori e gruppi da creare; nulla viene salvato finché il proprietario non preme Importa.

**Why this priority**: è il canale di onboarding di oltre 100 persone (D-14): senza import il bot non sostituisce l'agenda.

**Independent Test**: inviare `/modello`, poi un CSV con righe valide, duplicate (con persone già presenti e interne al file), con errori e con gruppi nuovi; verificare anteprima, Annulla e Importa.

**Flusso di esempio (AFU §5.8)**:

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

**Acceptance Scenarios**:

1. **Given** che scrivo `/modello`, **Then** ricevo il file CSV modello con intestazioni, una riga d'esempio compilata e una legenda dei formati. *(RF-23)*
2. **Given** un file con 112 righe di cui 3 con data non valida e 5 duplicate, **When** lo invio, **Then** vedo "104 nuove, 5 duplicati (saltati), 3 errori: riga 12 data non valida…" e nulla viene salvato finché non premo Importa. *(RF-24)*
3. **Given** che premo Importa, **Then** vengono salvate solo le righe valide e non duplicate, vengono creati i gruppi mancanti e il bot conferma "Importate N persone, creati M gruppi". *(RF-24, BR-23, §5.8)*
4. **Given** che premo Annulla sull'anteprima, **Then** non viene salvato nulla. *(RF-24)*
5. **Given** che il file usa `;` come separatore (Excel in italiano), **Then** viene letto correttamente come un file con `,`. *(RF-24, BR-19)*
6. **Given** che una riga ha nome e data uguali a una persona già presente (nome senza distinzione tra maiuscole e minuscole), **Then** l'anteprima la conta tra i duplicati e la riga viene saltata. *(BR-14)*
7. **Given** che due righe dello stesso file hanno nome e data uguali, **Then** la prima è una persona nuova e la seconda un duplicato saltato. *(BR-14)*
8. **Given** che una riga indica i gruppi `Famiglia|Beach tennis` e "Beach tennis" non esiste, **Then** l'anteprima elenca "Beach tennis" tra i gruppi da creare e, dopo Importa, la persona appartiene a entrambi i gruppi. *(BR-20, BR-23)*
9. **Given** che una riga ha `priorita` vuota, **Then** la persona viene importata con priorità Media; con `ALTA` viene importata con priorità Alta. *(BR-21)*
10. **Given** un file salvato da Excel come "CSV UTF-8" (con BOM) contenente nomi accentati, **Then** intestazioni e nomi vengono letti correttamente. *(BR-22)*
11. **Given** che compilo il modello senza cancellare la riga d'esempio, **When** lo invio, **Then** la riga d'esempio non viene importata e l'anteprima indica che è stata ignorata. *(RF-23, chiarimento 2026-10-28)*
12. **Given** una riga con nome e data validi ma telefono "333abc", **Then** l'anteprima la conta tra gli errori ("riga N telefono non valido") e con Importa non viene salvata. *(RF-24, chiarimento 2026-10-28)*

---

### User Story 2 - Backup e ripristino (Priority: P1)

Il proprietario scrive `/backup` e riceve in chat un file JSON con tutti i dati. In caso di necessità scrive `/ripristina`, invia un file di backup e, dopo una doppia conferma, i dati attuali vengono sostituiti integralmente da quelli del backup.

**Why this priority**: è l'unica protezione contro la perdita dei dati, compreso lo storico degli esiti (RNF-11, D-15).

**Independent Test**: con persone, gruppi, occorrenze con esiti e un messaggio di default personalizzato, eseguire `/backup`, modificare i dati, eseguire `/ripristina` con il file ottenuto e verificare che i dati tornino identici; ripetere con file non validi e con Annulla a ciascuna conferma.

**Acceptance Scenarios**:

1. **Given** che scrivo `/backup`, **Then** ricevo nella chat un file JSON completo: persone, gruppi, associazioni, occorrenze e storico, impostazioni (messaggio di default). *(RF-26, RNF-09)*
2. **Given** che invio un backup valido e confermo due volte, **Then** i dati attuali vengono sostituiti e il bot mostra un riepilogo di cosa è stato ripristinato. *(RF-26, RNF-05)*
3. **Given** che il file non è un backup valido, **Then** il ripristino viene rifiutato e i dati restano invariati. *(RF-26)*
4. **Given** che dopo il primo o il secondo messaggio di conferma premo Annulla, **Then** i dati restano invariati. *(RF-26, RNF-05)*
5. **Given** un backup prodotto da `/backup` e un ripristino da quel file, **Then** persone, gruppi, associazioni, esiti per anno e messaggio di default coincidono con quelli al momento del backup, e i comandi `/p_<id>` aprono le stesse persone. *(RNF-11)*
6. **Given** un backup del 01/11 in cui l'occorrenza di Anna del 05/11 è aperta, **When** lo ripristino il 20/11, **Then** l'occorrenza diventa *non confermato* e non ricevo alcun messaggio per Anna. *(RF-26, chiarimento 2026-10-28)*

---

### User Story 3 - Backup automatico mensile (Priority: P2)

Il 1° di ogni mese alle 9:00 il proprietario riceve in chat il file di backup JSON, senza doverlo chiedere.

**Why this priority**: garantisce una copia recente anche se il proprietario si dimentica di fare il backup.

**Independent Test**: simulare l'esecuzione oraria del 1° del mese alle 9:00 e in altri orari e giorni; verificare un solo invio, ripristinabile con `/ripristina`.

**Acceptance Scenarios**:

1. **Given** che è il 1° del mese, **When** sono le 9:00, **Then** ricevo il file di backup JSON in chat. *(RF-27)*
2. **Given** che l'esecuzione oraria delle 9:00 del 1° del mese viene ripetuta, **Then** il backup del mese viene inviato una sola volta. *(RF-27, RNF-11)*
3. **Given** che l'invio delle 9:00 del 1° fallisce e Telegram torna disponibile il 2 alle 14:00, **Then** ricevo il backup del mese all'esecuzione delle 14:00 del 2, una sola volta. *(RF-27, chiarimento 2026-10-28)*
4. **Given** il file del backup mensile, **When** lo uso con `/ripristina`, **Then** il ripristino riesce come con un backup su richiesta. *(RNF-11)*

---

### User Story 4 - Export CSV (Priority: P3)

Il proprietario scrive `/export` e riceve un CSV con tutte le persone, nello stesso formato del modello, leggibile e modificabile al PC e reimportabile.

**Why this priority**: utile per consultare o correggere i dati al PC, ma il backup JSON copre già la protezione dei dati.

**Independent Test**: con persone che usano tutti i campi (compresi 29/02, anno sconosciuto, più gruppi), eseguire `/export`, svuotare i dati e reimportare il file: le persone tornano identiche, senza errori.

**Acceptance Scenarios**:

1. **Given** che scrivo `/export`, **Then** ricevo nella chat un CSV con lo stesso formato del modello, una riga per persona, senza lo storico. *(RF-25, RNF-09)*
2. **Given** il CSV ottenuto da `/export`, **When** lo invio al bot su un'istanza senza persone, **Then** l'anteprima mostra tutte le righe come nuove, senza errori. *(RF-25)*
3. **Given** il CSV ottenuto da `/export`, **When** lo invio al bot sulla stessa istanza, **Then** tutte le righe risultano duplicati. *(RF-25, BR-14)*

---

### Edge Cases

- File CSV con 501 righe di dati: rifiutato per intero con l'indicazione del massimo (500) e l'invito a dividerlo; con 500 righe l'anteprima viene mostrata. *(RF-24, FR-008a)*
- File CSV vuoto o con le sole intestazioni: il bot dice che non ci sono righe da importare e non mostra Importa. *(RF-24)*
- Intestazioni mancanti, sconosciute o con colonne obbligatorie assenti (`nome`, `data`): il file viene rifiutato indicando le colonne attese; nulla viene salvato. *(BR-18)*
- Intestazioni in ordine diverso o con maiuscole diverse: vengono riconosciute per nome. *(BR-18)*
- Valori tra virgolette che contengono il separatore (es. un messaggio con `,` o `;`) o le virgolette stesse: vengono letti come un unico valore. *(BR-19)*
- Righe completamente vuote: vengono ignorate, senza contare come errori. *(RF-24)*
- Riga con data `29/02` senza anno o con anno bisestile: valida; `29/02/1995`: errore. *(BR-01, feature 001 FR-006)*
- Gruppo indicato con maiuscole diverse da uno esistente (es. `famiglia` con "Famiglia" presente): viene associato al gruppo esistente e non compare tra i gruppi da creare. *(BR-17, BR-23)*
- Due righe che indicano lo stesso gruppo nuovo con maiuscole diverse (`Calcetto`, `calcetto`): viene creato un solo gruppo, con la grafia della prima occorrenza. *(BR-17, BR-23)*
- Cella gruppi con elementi vuoti o ripetuti (`Famiglia||famiglia`): gli elementi vuoti sono ignorati e i ripetuti contano una volta. *(BR-20)*
- Un gruppo che compare solo in righe con errori o duplicate: non viene creato e non compare tra i gruppi da creare. *(BR-23)*
- File con codifica diversa da UTF-8 (caratteri non leggibili): il file viene rifiutato indicando di salvarlo come "CSV UTF-8". *(BR-22)*
- File inviato che non è un CSV (es. immagine, PDF): il bot non avvia l'import e indica di inviare un file `.csv`. *(RF-24)*
- File oltre il limite di ricezione di Telegram (20 MB): il bot segnala che il file è troppo grande; con i volumi previsti non accade. *(V-07)*
- Importa premuto dopo che, dall'anteprima, sono state aggiunte persone che rendono duplicate alcune righe: i duplicati vengono ricontrollati al momento dell'import e saltati; il messaggio finale riporta i numeri effettivi. *(BR-14)*
- Importa o Annulla premuti su un'anteprima già conclusa o scaduta: nessuna azione, il bot risponde "Questa azione non è più disponibile". *(feature 001, FR-018c)*
- Persona importata il giorno del suo compleanno o a ridosso: valgono le regole dei promemoria per le persone appena inserite (nessun invio retroattivo, solo slot futuri). *(feature 002, FR-017, FR-018)*
- `/ripristina` seguito da un messaggio che non è un file: il bot ripete che attende un file JSON di backup; `/annulla` interrompe. *(RF-26, RF-06)*
- File JSON di backup inviato senza aver scritto `/ripristina`: non avvia alcun ripristino; il bot indica di usare `/ripristina`. *(RF-26, RNF-05)*
- Backup con struttura corretta ma dati incoerenti (es. un'associazione verso un gruppo inesistente, una data non valida, due gruppi con lo stesso nome): il ripristino viene rifiutato e i dati restano invariati. *(RF-26)*
- Errore durante la sostituzione dei dati: nessuna sostituzione parziale; i dati restano quelli precedenti al ripristino. *(RF-26, RNF-11)*
- Backup o export con zero persone: il file viene comunque inviato. *(RF-25, RF-26, RF-27)*
- Un utente diverso dal proprietario invia un file CSV o JSON, o scrive `/modello`, `/export`, `/backup`, `/ripristina`: nessuna risposta, nessun salvataggio, nessun file inviato. *(RNF-09, feature 001 FR-027)*

## Requirements *(mandatory)*

### Functional Requirements

**Formato CSV**

- **FR-001** *(BR-18)*: Il formato CSV MUST avere le colonne `nome; nickname; data; telefono; instagram; telegram; gruppi; priorita; messaggio`, con una riga di intestazione. `nome` e `data` sono obbligatori; le altre colonne possono essere vuote. Nei file importati le colonne opzionali possono mancare dall'intestazione (valgono vuote) e le intestazioni MUST essere riconosciute senza distinzione di maiuscole e accenti (chiarimento 2026-10-29).
- **FR-002** *(BR-19)*: Il separatore di colonna MUST essere riconosciuto automaticamente tra `,` e `;`; i due tipi di file MUST produrre lo stesso risultato.
- **FR-003** *(BR-20)*: Più gruppi nella stessa cella MUST essere separati da `|`.
- **FR-004** *(BR-21)*: `priorita` MUST accettare `alta`, `media`, `bassa` senza distinzione tra maiuscole e minuscole; se vuota MUST valere `media`.
- **FR-005** *(BR-22)*: I file MUST essere letti in codifica UTF-8, con o senza BOM.
- **FR-005a** *(BR-19, BR-22, chiarimento 2026-10-28)*: I file prodotti dal bot (modello ed export) MUST usare `;` come separatore di colonna e la codifica UTF-8 con BOM.
- **FR-006** *(BR-01, BR-15, BR-16, BR-17)*: Ogni valore MUST rispettare le stesse regole di validazione e normalizzazione dell'inserimento guidato: formato e validità della data (feature 001, FR-005…FR-007), telefono in formato internazionale con +39 di default (FR-009), username senza `@` (FR-010), spazi rimossi e lunghezze massime (FR-010a), messaggio personalizzato entro 256 caratteri (feature 002, FR-035).

**`/modello`**

- **FR-007** *(RF-23)*: `/modello` MUST inviare il file CSV modello con le intestazioni di FR-001, una riga d'esempio compilata e una legenda dei formati (data, telefono, username, gruppi separati da `|`, priorità). La legenda MUST stare nel messaggio che accompagna il file; il file MUST contenere solo l'intestazione e la riga d'esempio (chiarimento 2026-10-28).
- **FR-007a** *(RF-23, RF-24, chiarimento 2026-10-28)*: La riga d'esempio MUST usare una persona chiaramente fittizia e riconoscibile. All'import, una riga con lo stesso nome completo e la stessa data della riga d'esempio (confronto come in FR-011) MUST essere sempre saltata, senza contare tra nuove, duplicati o errori; l'anteprima MUST indicare che la riga d'esempio è stata ignorata.

**Import CSV**

- **FR-008** *(RF-24)*: Quando il proprietario invia un file CSV, il sistema MUST validare tutte le righe e mostrare un'anteprima con: numero di persone nuove; duplicati saltati (nome e data di ciascuno); errori con numero di riga e motivo; gruppi che verranno creati; pulsanti Importa / Annulla (§5.8). Prima di Importa MUST NOT essere salvato nulla.
- **FR-008a** *(RF-24, RNF-16, chiarimento 2026-10-28)*: Un file con più di 500 righe di dati (intestazione e righe vuote escluse) MUST essere rifiutato per intero, senza anteprima e senza salvare nulla, indicando il massimo di 500 righe e invitando a dividere il file.
- **FR-009** *(RF-24)*: Il numero di riga degli errori MUST corrispondere alla riga del file come la vede il proprietario in un foglio di calcolo (intestazione = riga 1).
- **FR-010** *(RF-24, chiarimento 2026-10-28)*: Una riga con almeno un valore non valido, in un campo obbligatorio o opzionale (es. telefono "333abc", priorità "altissima", gruppo oltre 30 caratteri), MUST essere contata tra gli errori, con il numero di riga e il motivo, e MUST NOT essere importata. Se una riga ha più valori non validi, l'anteprima MUST riportarli tutti.
- **FR-011** *(BR-14)*: Una riga MUST essere un duplicato se ha lo stesso nome completo (senza distinzione tra maiuscole e minuscole) e la stessa data di una persona già presente (regola della feature 001, FR-004) o di una riga precedente dello stesso file. I duplicati MUST essere saltati, senza conferma.
- **FR-012** *(BR-23)*: I gruppi indicati che non esistono (confronto senza distinzione tra maiuscole e minuscole) MUST essere elencati nell'anteprima e creati automaticamente con Importa. Sono creati solo i gruppi usati da almeno una riga importata.
- **FR-013** *(RF-24)*: Con Importa il sistema MUST salvare solo le righe valide e non duplicate, creare i gruppi mancanti e rispondere "Importate N persone, creati M gruppi" (§5.8). L'import MUST essere tutto o niente: in caso di errore durante il salvataggio non resta salvata nessuna riga. Le persone importate hanno le stesse caratteristiche di quelle inserite con il guidato.
- **FR-014** *(RF-24)*: Con Annulla, o se l'anteprima scade (24 ore, come i flussi guidati), MUST NOT essere salvato nulla.
- **FR-015** *(RF-24)*: Se il file non contiene righe valide e non duplicate, l'anteprima MUST mostrare duplicati ed errori senza il pulsante Importa.

**`/export`**

- **FR-016** *(RF-25)*: `/export` MUST inviare un CSV con lo stesso formato del modello (FR-001…FR-005), una riga per persona, reimportabile senza errori. Il file MUST NOT contenere lo storico. La data MUST essere esportata come registrata (`gg/mm/aaaa`, o `gg/mm` se l'anno è sconosciuto; 29/02 resta 29/02).

**Backup e ripristino**

- **FR-017** *(RF-26)*: `/backup` MUST inviare un file JSON completo con: persone, gruppi, associazioni, occorrenze e storico, impostazioni (messaggio di default).
- **FR-018** *(RF-26)*: `/ripristina` MUST attendere un file JSON. Il sistema MUST verificare che il file sia un backup valido e coerente prima di chiedere conferma; un file non valido MUST essere rifiutato indicandone il motivo, con i dati invariati.
- **FR-019** *(RF-26, RNF-05)*: Il ripristino MUST richiedere una doppia conferma: un primo messaggio con il contenuto del backup e i dati attuali che verranno sostituiti (numero di persone, gruppi, occorrenze) e pulsanti Continua / Annulla; un secondo messaggio che avverte che l'operazione è irreversibile, con pulsanti "Sì, ripristina" / Annulla. Solo dopo la seconda conferma i dati possono essere sostituiti.
- **FR-020** *(RF-26, RNF-11)*: Il ripristino MUST sostituire integralmente tutti i dati (persone, gruppi, associazioni, occorrenze e storico, impostazioni) con quelli del backup, in modo tutto o niente, mantenendo gli identificativi delle persone. Al termine il bot MUST mostrare un riepilogo di cosa è stato ripristinato (numero di persone, gruppi, occorrenze, messaggio di default).
- **FR-020a** *(RF-26, §7 stati dell'occorrenza, BR-10, chiarimento 2026-10-28)*: Al termine del ripristino, le occorrenze aperte la cui giornata D+1 è già conclusa MUST diventare *non confermato*, senza inviare alcun messaggio. Le occorrenze aperte con D o D+1 uguale a oggi MUST restare aperte e ricevere solo i promemoria il cui orario non è ancora passato (nessun invio retroattivo).
- **FR-021** *(RF-26)*: Un flusso di ripristino in corso MUST poter essere interrotto con `/annulla` o Annulla senza modificare i dati, e MUST scadere dopo 24 ore senza interazioni (feature 001, FR-018, FR-018a).

**Backup automatico mensile**

- **FR-022** *(RF-27, A-03)*: Il 1° di ogni mese alle 9:00 (ora locale) il sistema MUST inviare nella chat del proprietario lo stesso file di backup di `/backup`.
- **FR-023** *(RF-27, RNF-11)*: Il backup automatico MUST essere inviato al massimo una volta per mese, anche se l'esecuzione oraria viene ripetuta.
- **FR-023a** *(RF-27, RNF-11, chiarimento 2026-10-28)*: Se il backup del mese non è stato consegnato alle 9:00 del 1° (errore di Telegram o esecuzione oraria non avvenuta), il sistema MUST ritentarlo a ogni esecuzione oraria successiva, anche nei giorni seguenti, finché l'invio riesce; resta valido FR-023. Alla prima installazione a metà mese il backup del mese corrente è inviato alla prima esecuzione oraria; un invio rimasto a metà per un guasto della piattaforma non viene ritentato (chiarimento 2026-10-29).

**Riservatezza e affidabilità**

- **FR-024** *(RNF-09)*: I file di backup, export e modello MUST essere consegnati solo nella chat del proprietario; MUST NOT essere inviati ad altri né resi disponibili tramite link.
- **FR-025** *(RNF-11)*: Ogni backup (su richiesta o automatico) MUST essere ripristinabile integralmente con `/ripristina`.
- **FR-026** *(V-07)*: I file ricevuti oltre il limite di Telegram per i bot (20 MB) MUST essere rifiutati con un messaggio; per restare nei limiti di CPU (RNF-17) MUST essere rifiutati con un messaggio anche i file oltre 1 MB (chiarimento 2026-10-29); i file inviati dal bot restano entro il limite di 50 MB per i volumi previsti (circa 200 persone).

### Key Entities *(include if feature involves data)*

- **File CSV** *(BR-18…BR-22)*: righe di persone nel formato di FR-001; usato da modello, import ed export.
- **Anteprima di import** *(RF-24, §5.8)*: risultato della validazione di un file (nuove, duplicati, errori, gruppi da creare), in attesa di Importa o Annulla; conservata come stato della conversazione (AFU §8).
- **File di backup** *(RF-26)*: copia completa di persone, gruppi, appartenenze, occorrenze con esiti e impostazioni (AFU §8).
- **Persona, Gruppo, Appartenenza, Occorrenza, Impostazioni** *(AFU §8, feature 001 e 002)*: create dall'import (persone, gruppi, appartenenze), lette da export e backup, sostituite dal ripristino.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RF-23…27)*: Il 100% dei criteri di accettazione Dato/Quando/Allora dei requisiti inclusi è verificato da almeno un test.
- **SC-002** *(RF-24, D-14)*: Il proprietario porta nel bot oltre 100 persone dalla propria agenda con un solo file e un solo tocco su Importa.
- **SC-003** *(RF-24)*: Con un file di 200 righe, il 100% delle righe con errori è segnalato nell'anteprima con numero di riga e motivo, e nessuna riga è salvata prima di Importa.
- **SC-004** *(RF-25)*: Export seguito da import su un'istanza vuota riproduce il 100% delle persone con tutti i loro campi e gruppi, con zero errori.
- **SC-005** *(RF-26, RNF-11)*: Backup seguito da ripristino riproduce il 100% dei dati (persone, gruppi, associazioni, esiti per anno, messaggio di default).
- **SC-006** *(RF-26)*: Il 100% dei file non validi viene rifiutato senza alcuna modifica ai dati.
- **SC-007** *(RF-27)*: In 12 mesi il proprietario riceve esattamente 12 backup automatici, uno il 1° di ogni mese.

## Assumptions

- Nell'export il telefono è nel formato internazionale salvato con uno spazio dopo il prefisso (`+39 3331234567`, chiarimento 2026-10-29), gli username senza `@`, i gruppi separati da `|`, la priorità in minuscolo e il messaggio solo se personalizzato (vuoto se la persona usa il default).
- Nell'anteprima i duplicati e gli errori sono elencati tutti, con i valori citati accorciati a 30 caratteri e un solo motivo per campo; se il testo supera la lunghezza di un messaggio Telegram è diviso in più messaggi, con i pulsanti nell'ultimo, fino a un massimo di 30 messaggi: oltre, l'elenco si interrompe indicando quante righe non sono mostrate (chiarimento 2026-10-29).
- L'invio di un file CSV avvia l'import in qualunque momento; se è in corso un flusso guidato, il flusso si interrompe senza salvare, come con un comando (feature 001, FR-018).
- Il file di backup contiene una versione del formato; un file con una versione non riconosciuta è considerato non valido.
- Il registro degli invii dei promemoria non fa parte del backup (AFU RF-26 non lo elenca); dopo un ripristino i promemoria il cui orario è già passato non vengono inviati retroattivamente (BR-10).
- I nomi dei file contengono la data (es. `compleanni-backup-2026-11-01.json`, `compleanni-export-2026-10-28.csv`).
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
