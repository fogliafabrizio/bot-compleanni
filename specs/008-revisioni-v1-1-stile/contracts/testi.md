# Contratto: inventario e revisione dei testi (`src/texts.ts`)

**Feature**: 008-revisioni-v1-1-stile | **Requisiti**: RNF-19, RNF-15, A-06, D-23; spec FR-001…FR-018

È l'inventario richiesto da FR-004a e il riferimento dei test di SC-001
(`test/unit/testi.test.ts`, research R-08). Ogni chiave di `T` compare una volta.

**Tipi** (FR-004a): **T** titolo/intestazione o vista vuota · **D** domanda di flusso ·
**C** conferma · **A** avviso · **E** errore · **I** informativo · **F** frammento ·
**R** riga di lista · **PA** pulsante di azione · **PC** pulsante di contatto.

**Chiavi annidate**: ogni foglia di un oggetto di `T` è una chiave a sé, con la notazione a punto
(`editAsk.n`, `fieldLabels.r`, `rowReason.dateInvalid`, `outcome.fatto`, `lastYear.saltato`,
`listOutcome.aperta`, `statoBackupEsito.in_invio`). `prefisso.*` nelle tabelle vale come
abbreviazione: tutte le foglie con quel tipo.

**Chiavi a tipo misto**: `help` e `templateCaption` stanno in `INVENTARIO` come **T**, perché la regola
per tipo si applica alla prima riga. Le righe successive (R/I) sono verificate dai test dedicati di
T018 e T025.

**Regole** (colonna "Regola"): **R1** tono FR-001a (tu/prima persona, oggetto nominato, errori ≤ 2
frasi con rimedio, vuoti/informativi in una frase, niente cortesie, "!" solo benvenuto e successi,
al massimo una frase in più) · **R2** emoji di sezione in testa (FR-002, FR-014) · **R3** nessuna
emoji nelle righe (FR-003) · **R4** 🎉/✅ nelle conferme, ⚠️ avvisi, ❌ errori (FR-004) · **R5**
icona del campo (FR-007) · **R6** pulsanti (FR-009, FR-010) · **R7** mockup §5 (FR-001, SC-002) ·
**=** invariato (già conforme, verificato).

`{n}`, `{name}` ecc. indicano gli argomenti delle funzioni; il nome dei parametri resta quello di
oggi. Le chiavi **nuove** sono marcate *(nuova)*; `schedaNickname` è sostituita da `schedaTitle`.

## Comuni

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `actionUnavailable` | E | Questa azione non è più disponibile | ❌ Questa azione non è più disponibile. | R4, R1 |
| `personNotFound` | E | Persona non trovata | ❌ Non trovo questa persona: forse è stata eliminata. | R4, R1 |
| `notUnderstood` | E | Non ho capito. Scrivi /aiuto per l'elenco dei comandi | ❌ Non ho capito. Scrivi /aiuto per vedere cosa so fare. | R4, R1 |
| `cancelled` | I | Operazione annullata | Ok, ho annullato. | R1 |
| `nothingToCancel` | I | Nessuna operazione da annullare | Non c'è nessuna operazione da annullare. | R1 |
| `genericError` | E | Si è verificato un errore, riprova | ❌ Qualcosa è andato storto. Riprova tra poco. | R4, R1 |
| `btnCancel` | PA | Annulla | = | R6 |
| `btnSkip` | PA | Salta | ⏭ Salta | R6, R7 §5.2 |
| `btnYes` | PA | Sì | = | R6 |
| `btnFix` | PA | Correggi | = | R6 |
| `btnDone` | PA | Fine | = | R6 |
| `btnClear` | PA | Svuota | = | R6 |
| `yourId` | I | Il tuo ID Telegram è {id} | = | R1 |

## Inserimento guidato (001 FR-001…FR-003; 006)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `askFullName` | D | Nome completo? | 👤 Come si chiama? Nome e cognome | R5, R7 §5.2 |
| `askNickname` | D | Nickname? (come lo chiami nei messaggi) | 💬 Come lo chiami nei messaggi? (nickname) | R5, R7 §5.2 |
| `askBirthDate` | D | Data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno | 🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno | R5, R7 §5.2 |
| `confirmDate` | D | {s}, giusto? | = | R7 §5.2 (senza icona nel mockup) |
| `invalidDate` | E | Data non valida. Usa il formato gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994) | ❌ Data non valida. Usa gg/mm/aaaa, oppure gg/mm se non sai l'anno (es. 14/03/1994). | R4, R1 |
| `askPhone` | D | 📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)⏎oppure condividi il contatto 📎 | = | R5, R7 §5.2 |
| `invalidPhone` | E | Numero non valido. Scrivilo con il prefisso, es. +39 333 1234567 | ❌ Numero non valido. Scrivilo con il prefisso, es. +39 333 1234567 | R4 |
| `confirmPhone` | D | 📱 {n}, giusto? | = | R5, R7 §5.2 |
| `contactWithoutPhone` | E | Questo contatto non ha un numero di telefono | ❌ Questo contatto non ha un numero di telefono: scrivilo tu. | R4, R1 |
| `askInstagram` | D | Username Instagram? | 📸 Username Instagram? | R5, R7 §5.2 |
| `askTelegram` | D | Username Telegram? | ✈️ Username Telegram? | R5, R7 §5.2 |
| `askGroups` | D | Gruppi? | 👥 Gruppi? | R5, R7 §5.2 |
| `btnNewGroup` | PA | ➕ Nuovo gruppo | = | R6 |
| `askNewGroupName` | D | Nome del nuovo gruppo? | 👥 Come si chiama il nuovo gruppo? | R5, R1 |
| `groupExists` | E | Esiste già un gruppo con questo nome | ❌ Hai già un gruppo con questo nome: scegline un altro. | R4, R1 |
| `askPriority` | D | Priorità? | ⭐ Priorità? | R5, R7 §5.2 |
| `btnHigh` / `btnMedium` / `btnLow` | PA | Alta / Media / Bassa | = | R6 (scelte senza icona) |
| `selected` | F | {label} ✓ | = | indicatore di stato (spec, edge case) |
| `groupToggle` | F | ☐/☑ {name} | = | indicatore di stato |
| `askMessage` | D | Messaggio di auguri personalizzato? Se salti uso quello standard. | ✍️ Messaggio di auguri personalizzato? Se salti uso quello standard. | R5, R7 §5.2 |
| `summaryTitle` | T | Riepilogo: | 📋 Riepilogo: | R2, R7 §5.2 |
| `btnSave` / `btnSaveAnyway` | PA | Salva / Salva comunque | = | R6 |
| `possibleDuplicate` | A | Esiste già una persona di nome {name} con data {date}: possibile duplicato. Vuoi salvare comunque? | ⚠️ Hai già {name} con data {date}: potrebbe essere un duplicato. Vuoi salvarlo comunque? | R4, R1 |
| `tooLong` | E | Testo troppo lungo: massimo {max} caratteri | ❌ Testo troppo lungo: al massimo {max} caratteri. | R4 |
| `emptyValue` | E | Il valore non può essere vuoto | ❌ Il valore non può essere vuoto. | R4 |
| `personSaved` *(nuova)* | C | — (oggi solo la scheda) | 🎉 Fatto! {name} è in rubrica. | R4, R7 §5.2, criterio RNF-19 |

## Scheda persona (001 FR-011; 006 FR-001; §5.6)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `schedaTitle` *(sostituisce `schedaNickname`)* | T | {name} — "{nickname}" (senza nickname: solo il nome, composto in `scheda.ts`) | 👤 {name} — "{nickname}" · senza nickname: 👤 {name} | R2, R7 §5.6 |
| `schedaDate` *(nuova)* | F | {data} · {when} (composto in `scheda.ts`) | 🎂 {data} · {when} | R7 §5.6 |
| `schedaAge` / `schedaNoAge` | F | compie N anni tra M giorni / compleanno tra M giorni (oggi, domani) | = | R7 §5.6 |
| `schedaPriority` / `schedaGroups` | F | Priorità: {p} / Gruppi: {names} | = | FR-005 (nessuna emoji di priorità o gruppo) |
| `schedaPhone` | F | 📱 {phone} | = | R7 §5.6 |
| `schedaMessageStandard` / `schedaMessageCustom` | F | Messaggio: standard / Messaggio: "{m}" | = | FR-006 ({m} è dato dell'utente) |
| `schedaHistory` | F | Storico: {items} | = | R7 §5.6 |
| `outcome` | F | fatto / saltato / non confermato | = | — |
| `btnEdit` | PA | Modifica | ✏️ Modifica | R6, R7 §5.6 |
| `btnDelete` | PA | Elimina | 🗑 Elimina | R6, R7 §5.6 |

## Modifica (001 FR-014, FR-015)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `editWhichField` | D | Quale campo vuoi modificare? | ✏️ Quale campo vuoi modificare? | R5 |
| `fieldLabels.*` | PA | Nome, Nickname, Data, Telefono, Instagram, Telegram, Gruppi, Priorità, Messaggio | = | R6 (scelte di campo senza icona) |
| `editAsk.n` | D | Nuovo nome completo? | 👤 Nuovo nome completo? | R5 |
| `editAsk.k` | D | Nuovo nickname? | 💬 Nuovo nickname? | R5 |
| `editAsk.d` | D | Nuova data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno | 🎂 Nuova data di nascita? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno | R5 |
| `editAsk.p` | D | Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)⏎oppure condividi il contatto 📎 | 📱 Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)⏎oppure condividi il contatto 📎 | R5 |
| `editAsk.i` | D | Nuovo username Instagram? | 📸 Nuovo username Instagram? | R5 |
| `editAsk.t` | D | Nuovo username Telegram? | ✈️ Nuovo username Telegram? | R5 |
| `editAsk.m` | D | Nuovo messaggio di auguri personalizzato? | ✍️ Nuovo messaggio di auguri personalizzato? | R5 |
| `personUpdated` *(nuova)* | C | — (oggi solo la scheda) | ✅ Ho aggiornato {name}. | R4, R1 |

Gruppi e priorità in Modifica riusano `askGroups` e `askPriority` (stessa icona, FR-007).

## Eliminazione (001 FR-017, FR-018)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `confirmDeletePerson` | A | Eliminare {name}? Perderai anche lo storico | ⚠️ Vuoi eliminare {name}? Perderai anche il suo storico. | R4, R1 |
| `personDeleted` *(diventa funzione `(name)`)* | C | Persona eliminata | ✅ Ho eliminato {name}. | R4, R1 |

## Gruppi (005; §5.9)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `groupsTitle` | T | 👥 I tuoi gruppi | = | R7 §5.9 |
| `groupButton` | PA | {name} ({n}) | = | R6 (scelta di gruppo) |
| `groupLine` | R | {name} ({n}) | = | R3 |
| `groupsTypeName` | I | Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam | = | R1 |
| `groupCardTitle` | T | 👥 {name} · N persone | = | R7 §5.9 |
| `groupCardEmpty` | F | Nel gruppo non ci sono persone. | Nel gruppo non c'è ancora nessuno. | R1 (sotto il titolo 👥, research R-03) |
| `groupGone` | E | Il gruppo non esiste più. | ❌ Questo gruppo non esiste più. | R4 |
| `groupsMany` | T | 🔍 Più gruppi corrispondono a «{q}»: | = | R7 §5.9 |
| `groupNoMatch` | T (vista vuota) | Nessun gruppo corrisponde a «{q}». | 🔍 Nessun gruppo corrisponde a «{q}». | R2 (research R-03) |
| `groupKeyTooShort` | E | Il nome del gruppo deve contenere almeno 2 lettere o cifre | ❌ Il nome del gruppo deve avere almeno 2 lettere o cifre. | R4 |
| `noGroups` | T (vista vuota) | Non hai ancora nessun gruppo. | 👥 Non hai ancora nessun gruppo. | R2 |
| `btnRename` / `btnDeleteGroup` | PA | ✏️ Rinomina / 🗑 Elimina | = | R6, R7 §5.9 |
| `askRenameTo` | D | Nuovo nome per il gruppo {name}? | 👥 Nuovo nome per il gruppo {name}? | R5 |
| `confirmDeleteGroup` | A | Eliminare il gruppo {name}? Nessuna persona ha questa etichetta / 1 persona perderà… / N persone perderanno… | ⚠️ Vuoi eliminare il gruppo {name}? (seconda frase =) | R4, R1 |
| `groupCreated` | C | Gruppo {name} creato | ✅ Ho creato il gruppo {name}. | R4, R1 |
| `groupRenamed` | C | Gruppo rinominato in {name} | ✅ Ho rinominato il gruppo in {name}. | R4, R1 |
| `groupDeleted` | C | Gruppo {name} eliminato | ✅ Ho eliminato il gruppo {name}. | R4, R1 |

## Promemoria (002; §5.3-§5.5)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `reminderTitle` | T | 🎂 Oggi è il compleanno di {name} ({fullName}), compie N anni (compleanno il 29/02) | come oggi + "!" finale: 🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni! | R7 §5.3 (eccezione al "!" di R1, research R-04) |
| `reminderGroups` | F | Gruppi: {names} | = | R7 §5.3 |
| `reminderPhone` | F | 📱 {phone} | = | R7 §5.3 |
| `lastYear` | F | L'anno scorso: fatto ✅ / L'anno scorso: saltato | = | R7 §5.3 |
| `recoveryTitle` | T | ⏰ Ieri era il compleanno di {name} ({fullName}). Hai fatto gli auguri? | = | R7 §5.5 |
| `preReminder` | T | 📅 Tra N giorni: compleanno di {name} (N anni) — {ddmm} | = | R7 §5.4 |
| `btnWhatsApp` / `btnInstagram` / `btnTelegram` / `btnCopy` | PC | WhatsApp / Instagram / Telegram / Copia messaggio | = | R6, FR-010, SC-004 |
| `btnOutcomeDone` | PA | Fatto ✅ | = | R6, R7 §5.3 |
| `btnSkipYear` / `btnSkipped` | PA | Salta quest'anno / Saltato | = | R6 |
| `outcomeDone` / `outcomeSkipped` / `skippedThisYear` | F | ✅ Fatto / Saltato / Saltato quest'anno | = | edge case: stato dopo un esito |

## Viste e ricerche (003; §5.7)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `listOutcome` | F | in attesa / saltato / non confermato | = | R3 (dentro la riga) |
| `todayNone` | T | Oggi non ci sono compleanni. Il prossimo: | 🎂 Oggi non ci sono compleanni. Il prossimo: | R2 |
| `todayNoPersons` | T (vista vuota) | Oggi non ci sono compleanni e non hai ancora inserito nessuna persona. | 🎂 Oggi non ci sono compleanni e la rubrica è ancora vuota. | R2, R1 |
| `todayOthers` | T | Altri compleanni di oggi: | 🎂 Altri compleanni di oggi: | R2 |
| `upcomingHeader` | T | Prossimi N giorni ({group}) / Prossimo giorno | 📆 Prossimi N giorni ({group}) / 📆 Prossimo giorno | R2, R7 §5.7 |
| `upcomingNone` | T (vista vuota) | Nessun compleanno nei prossimi N giorni ({group}) | 📆 Nessun compleanno nei prossimi N giorni ({group}) | R2 |
| `upcomingDaysRange` | E | Il numero di giorni deve essere tra 1 e {max} | ❌ Il numero di giorni deve essere tra 1 e {max}. | R4 |
| `searchUsage` | I | Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco | = | R1 |
| `searchHeader` | T | Risultati per «{q}» | 🔍 Risultati per «{q}» | R2 |
| `searchNone` | T (vista vuota) | Nessun risultato per «{q}» | 🔍 Nessun risultato per «{q}» | R2 |
| `monthHeader` | T | Compleanni di {mese} {anno} | 🗓 Compleanni di {mese} {anno} | R2 |
| `monthNone` | T (vista vuota) | Nessun compleanno a {mese} | 🗓 Nessun compleanno a {mese} | R2 |
| `monthInvalid` | E | Mese non riconosciuto: scrivilo per nome (es. marzo) o per numero da 1 a 12 | ❌ Mese non riconosciuto: scrivilo per nome (es. marzo) o per numero da 1 a 12. | R4 |
| `btnMarkDone` | PA | Segna fatto | = | R6 |
| `overdueHeader` | T | Ultimi N giorni, non fatti | ⏳ Ultimi N giorni, non fatti | R2 |
| `overdueNone` | T (vista vuota) | Nessun compleanno in sospeso negli ultimi N giorni | ⏳ Nessun compleanno in sospeso negli ultimi N giorni | R2 |
| `yearHeader` | T | Riepilogo {y} | 🗂 Riepilogo {y} | R2 |
| `yearCounts` / `yearSkipped` / `yearStreak` / `yearNone` | F | Fatto: f, Saltato: s, Non confermato: n / Saltati: / Saltati per 2 o più anni di fila: / nessuno | = | R3 |
| `yearInvalid` | E | Anno non valido: scrivi un anno tra {min} e {max} | ❌ Anno non valido: scrivi un anno tra {min} e {max}. | R4 |

## `/statistiche`, avviso di buco, `/stato` (007; §5.10-§5.12)

Tutte le chiavi **invariate** (FR-018), verificate: `statsTitle` 📊 (T), `statsMonthsTitle` 🎂 (T
di sottosezione, §5.11), `statsDone` ✅ (F, §5.11), `statsPersons`, `statsGroup`, `statsNoGroup`,
`statsGroups`, `statsMissing`, `statsYear` (F/R, senza emoji); `gapAlert` ⚠️ (A, §5.12);
`statoTitle` 🩺 (T), `statoCron` ⏱, `statoToday`/`statoWeek` 📨, `statoBackup` 💾,
`statoWebhookOk`/`statoWebhookError`/`statoWebhookUnavailable` 🔗 (righe con icona di §5.10, edge
case della spec), `statoAbandoned` (R, senza emoji), `statoBackupEsito`, `statoKind`, `statoWhen`,
`statoAt`, `neverRecorded` (F).

## `/messaggio` (002 FR-032)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `greetingAsk` | D | Messaggio attuale: «{current}»⏎Scrivi il nuovo messaggio di auguri. Usa {nome} per il nome. | ✍️ Messaggio attuale: «{current}»⏎Scrivi il nuovo messaggio di auguri. Usa {nome} per il nome. | R5; {current} escluso (FR-006) |
| `greetingPreview` | D | Anteprima: «{text}»⏎Confermi? | ✍️ Anteprima: «{text}»⏎Confermi? | R5; {text} escluso (FR-006) |
| `greetingSaved` | C | Messaggio di auguri aggiornato | ✅ Ho aggiornato il messaggio di auguri. | R4, R1 |
| `greetingTooLong` | E | Il messaggio può avere al massimo {max} caratteri (ogni {nome} conta {perName}). | ❌ Il messaggio può avere al massimo {max} caratteri (ogni {nome} conta {perName}). | R4 |
| `sampleName` | F | Marco | = | — |
| `btnConfirm` | PA | Conferma | = | R6 |

## Documenti ricevuti, modello, import (004; §5.8)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `fileTooBigTelegram` | E | Il file è troppo grande: Telegram consente ai bot di ricevere file fino a 20 MB. | ❌ Il file è troppo grande: Telegram mi lascia ricevere file fino a 20 MB. | R4, R1 |
| `fileTooBig` | E | Il file è troppo grande (massimo N MB). | ❌ Il file è troppo grande: al massimo N MB. | R4 |
| `useRipristina` | I | Per ripristinare un backup usa /ripristina. | = | R1 |
| `sendCsv` | I | Per importare persone inviami un file .csv (usa /modello per il formato). | = | R1 |
| `downloadFailed` | E | Non sono riuscito a scaricare il file, riprova. | ❌ Non sono riuscito a scaricare il file. Riprova. | R4 |
| `waitingBackupFile` | D | Attendo un file JSON di backup. Usa /annulla per interrompere. | 💾 Aspetto il file JSON di backup. Usa /annulla per interrompere. | R5 (FR-007: attesa del file) |
| `templateCaption` (prima riga) | T | Modello per importare le persone. Compilalo al PC e rimandamelo qui. | 📄 Ecco il modello per importare le persone: compilalo al PC e rimandamelo qui. | R2, R1 |
| `templateCaption` (righe "•") | R | • nome e data sono obbligatori … • separatore ; oppure , — salva come "CSV UTF-8" | = | R3 (FR-016) |
| `csvNotUtf8` | E | Non riesco a leggere il file: salvalo da Excel come "CSV UTF-8" e rimandalo. | ❌ Non riesco a leggere il file: salvalo da Excel come "CSV UTF-8" e rimandalo. | R4 |
| `csvInvalidHeader` | E | Intestazione non valida. Colonne attese: … (obbligatorie: nome e data). | ❌ Intestazione non valida. Colonne attese: … (obbligatorie: nome e data). | R4 |
| `csvEmpty` | E | Il file non contiene righe da importare. | ❌ Il file non contiene righe da importare. | R4 |
| `csvTooManyRows` | E | Il file ha più di 200 righe: dividilo in più file da al massimo 200 righe. | ❌ Il file ha più di 200 righe: dividilo in file da al massimo 200 righe. | R4 |
| `rowReason.*` | F | nome mancante, data "…" non valida, … | = | R3 (dentro le righe d'errore) |
| `previewTitle` | T | Anteprima import | 📥 Anteprima import | R2, R7 §5.8 |
| `previewNew` / `previewExampleSkipped` / `previewDuplicates` / `previewGroups` / `previewTruncated` / `previewMoreGroups` | F | 1 persona nuova … / Riga d'esempio ignorata / N duplicati (saltati): / Gruppi da creare: … / …e altre N righe non mostrate (correggi il file e rimandalo). / e altri N | = | R7 §5.8 |
| `previewErrors` | A | N errori: | ⚠️ N errori: | R4, R7 §5.8 |
| `previewDuplicateLine` / `previewErrorLine` | R | • riga N: … | = | R3 |
| `previewShort` | T | Anteprima in attesa: N nuove, D duplicati, E errori. Gruppi da creare: … | 📥 Anteprima in attesa: N nuove, D duplicati, E errori. Gruppi da creare: … | R2 (research R-03) |
| `btnImport` | PA | Importa | = | R6 |
| `imported` | C | Importate N persone, creati M gruppi. | 🎉 Importate N persone, creati M gruppi. | R4, R7 §5.8 |
| `becameDuplicates` | A | N righe sono diventate duplicati e sono state saltate. | ⚠️ N righe sono diventate duplicati e le ho saltate. | R4, R1 |
| `nothingImported` | A | Nessuna persona importata: tutte le righe sono ora duplicati. | ⚠️ Non ho importato nessuno: tutte le righe ora sono duplicati. | R4, R1 |

**Nota §5.8**: nel mockup i duplicati e gli errori stanno sulla stessa riga dell'intestazione. Il bot
li mostra uno per riga ("• riga N: …", spec 004 FR-008) e la struttura resta questa, perché il
mockup è indicativo (nota §5.1) e cambiarla toccherebbe la logica dell'anteprima. Per §5.8, SC-002
verifica emoji, intestazioni, conferma ed etichette dei pulsanti.

## Export, backup, ripristino (004)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `exportCaption` | T | Export di N persone. | 📤 Ecco l'export: N persone. (1 persona al singolare) | R2, R1 |
| `backupCaption` (su richiesta e mensile) | T | Backup: N persone, M gruppi, K occorrenze. Per ripristinarlo usa /ripristina. | 💾 Backup: N persone, M gruppi, K occorrenze. Per ripristinarlo usa /ripristina. | R2 |
| `restoreAsk` | D | Inviami il file JSON di backup da ripristinare. | 💾 Inviami il file JSON di backup da ripristinare. | R5 |
| `restoreConfirm1` | A | Backup del {date}: …⏎Dati attuali che verranno sostituiti: … | ⚠️ Backup del {date}: …⏎Dati attuali che verranno sostituiti: … | R4 (FR-016) |
| `restoreConfirm2` | A | ⚠️ Attenzione: l'operazione è irreversibile. … Vuoi procedere? | = | R4 |
| `btnContinue` / `btnRestore` | PA | Continua / Sì, ripristina | = | R6 |
| `restoreDone` | C | Ripristino completato: …⏎Messaggio di auguri standard: … | ✅ Ripristino completato: …⏎Messaggio di auguri standard: … | R4 |
| `backupNotJson` | E | Il file non è un JSON valido. | ❌ Il file non è un JSON valido: mandami il file .json del backup. | R4, R1 |
| `backupWrongFormat` | E | Il file non è un backup di questo bot. | ❌ Il file non è un backup di questo bot. | R4 |
| `backupVersion` | E | Versione del backup non supportata ({v}). | ❌ Versione del backup non supportata ({v}). | R4 |
| `backupInvalidField` / `backupDuplicateId` / `backupInvalidSetting` / `backupDuplicateGroupName` / `backupMissingRef` / `backupDuplicateOccurrence` | E | Backup non valido: … | ❌ Backup non valido: … (resto =) | R4 |

## Benvenuto e aiuto (001 FR-024, FR-025)

| Chiave | Tipo | Testo attuale | Testo nuovo | Regola |
|---|---|---|---|---|
| `welcome` | C (benvenuto) | Ciao! Sono il tuo bot dei compleanni: tengo l'elenco … | 👋 Ciao! Sono il tuo bot dei compleanni: tengo l'elenco … (resto =) | RNF-19 👋 (eccezione alla regola C: 👋 al posto di 🎉/✅, FR-013) |
| `btnAddPerson` / `btnCommands` | PA | Aggiungi persona / Comandi | = | R6 |
| `help` (prima riga) | T | Comandi disponibili: | 📖 Ecco cosa posso fare: | R2, R1 |
| `help` (righe dei comandi e ultima riga) | R / I | /nuovo — … · Per importare persone inviami un file CSV. | = | R3 (FR-013) |

## Fuori da `T` (non modificati)

| Costante | File | Motivo |
|---|---|---|
| `DEFAULT_BIRTHDAY_MESSAGE` = "Tanti auguri {nome}! 🎉" | `src/config.ts` | A-06, FR-006, FR-020: dato dell'utente |
| `CSV_EXAMPLE_ROW` (compreso "Tanti auguri {nome}!") | `src/texts.ts` | 004 FR-007a: riga riconosciuta all'import |
| `MONTHS_IT`, `WEEKDAYS_IT`, `MONTHS_SHORT` | `src/texts.ts` | frammenti di righe e intestazioni |
| `BOT_COMMANDS` | `src/texts.ts` | §5.1: menu senza emoji |
