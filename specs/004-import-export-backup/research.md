# Research: Import, export e backup

**Feature**: `004-import-export-backup` | **Data**: 2026-10-28 | **Piano**: [plan.md](plan.md)

Architettura e stack di 001–003 invariati: Worker TypeScript `strict`, D1, client Bot API su
`fetch`, dipendenze e `now` iniettati, nessuna dipendenza nuova. Nessuna voce del Technical
Context è rimasta *NEEDS CLARIFICATION*; le decisioni sotto risolvono i punti aperti di
integrazione (ricezione e invio di file, formato del backup, atomicità, budget).

## Limiti di riferimento

| Limite | Valore | Dove pesa in questa feature |
|---|---|---|
| CPU per invocazione (webhook e cron) | 10 ms | Decodifica e parsing del CSV, validazione di 200–500 righe, costruzione e validazione del backup (R-03, R-04, R-08, R-12) |
| Subrequest per invocazione | 50; **una `db.batch()` conta come una sola query** (research R-07 di 002) | Import, ripristino e backup mensile usano una batch di scrittura ciascuno (R-07, R-09, R-11) |
| Parametri per statement D1 | 100 | Le righe da scrivere passano come **un solo parametro JSON** letto con `json_each` (R-07) |
| Dimensione di stringa/riga D1 | 2 MB | Stato della conversazione con anteprima o backup in attesa (R-06, R-09) |
| Download di file dalla Bot API | 20 MB (V-07) | Rifiuto prima di `getFile` (R-01) |
| Upload di documenti dalla Bot API | 50 MB (V-07) | Backup ed export sono < 1 MB con ~200 persone (R-08, R-10) |
| Didascalia di un documento (`caption`) | 1024 caratteri | Legenda di `/modello` (R-02) |

## R-01 — Ricezione dei file: `getFile` + download

- **Decisione**: un messaggio con `document` del proprietario in chat privata è gestito dal router
  (R-13). Il bot:
  1. controlla `document.file_size` (se presente): oltre 20 MB → messaggio "file troppo grande"
     (FR-026, V-07), nessuna chiamata; oltre il **tetto tecnico** `RECEIVED_FILE_MAX_BYTES`
     (1 MiB) → stesso messaggio con il limite effettivo;
  2. chiama `getFile(file_id)` → `file_path`;
  3. scarica `https://api.telegram.org/file/bot<token>/<file_path>` con `fetch`; ricontrolla la
     dimensione reale (`byteLength`) contro il tetto.
  Il client Telegram espone `getFile` e `downloadFile`; il token compare solo nell'URL costruito
  dal client, mai nei log (principi IV, V); un errore di download espone solo lo status
  (`TelegramError`).
- **Tipo di file**: si decide sull'estensione di `file_name` (minuscole): `.csv` → import;
  `.json` → ripristino (solo nel flusso `/ripristina`); altro → messaggio "invia un file .csv".
  Il `mime_type` dichiarato da Telegram non è affidabile (Excel/Windows producono
  `text/csv`, `application/vnd.ms-excel`, `text/comma-separated-values`…) e non si usa.
- **Tetto tecnico di 1 MiB** (approvato dal proprietario il 2026-10-29): il caso peggiore
  ammesso dalla spec è 500 righe × ~1 KB (nome 60, nickname 60, messaggio 256 caratteri, gruppi,
  caratteri multibyte) ≈ 0,5 MB; un backup con 200 persone e 20 anni di storico (~4000
  occorrenze) è ≈ 0,5 MB compatto. Un file di 20 MB richiederebbe decine di ms di CPU solo per la
  decodifica: il tetto serve a rispettare i 10 ms (principio II), non è una funzionalità nuova.
- **Subrequest**: 2 (getFile + download).
- **Alternative scartate**: scaricare senza controllare `file_size` (CPU e memoria esposte a file
  arbitrari); riconoscere il tipo dal contenuto (CSV e JSON sono entrambi testo, l'estensione è
  il segnale che il proprietario vede).

## R-02 — Invio dei file: `sendDocument` multipart

- **Decisione**: nuovo metodo `sendDocument(chatId, file, caption?)` del client, con
  `file = { name, content: Uint8Array, mimeType }`. Corpo `FormData` con `chat_id`, `document`
  (`Blob` + nome file) e `caption` opzionale; nessun `parse_mode`. È l'unico modo per
  consegnare un file generato senza ospitarlo altrove: niente URL né link (FR-024, RNF-09).
- **Nomi dei file** (Assumptions della spec): `compleanni-modello.csv`,
  `compleanni-export-AAAA-MM-GG.csv`, `compleanni-backup-AAAA-MM-GG.json`, con la data locale di
  `now()` (principio VI).
- **Legenda di `/modello`**: è la `caption` del documento (FR-007: "nel messaggio che accompagna
  il file"); un test unitario verifica che resti ≤ 1024 caratteri.
- **MIME**: `text/csv; charset=utf-8`, `application/json`.
- **Alternative scartate**: `InputFile` via URL (richiederebbe un link pubblico, vietato da
  FR-024); invio come testo nel messaggio (non è un file, limite 4096 caratteri).

## R-03 — Lettura del CSV: parser proprio, separatore automatico, UTF-8

- **Decisione**: parser RFC 4180 scritto a mano in `src/domain/csv.ts` (~70 righe, puro):
  macchina a stati carattere per carattere che gestisce campi tra virgolette con separatore,
  `""` come virgolette, a capo dentro le virgolette, terminatori `\r\n` e `\n`.
  - **Codifica** (BR-22, FR-005): `new TextDecoder("utf-8", { fatal: true })`; il BOM viene
    rimosso dal decoder. Una sequenza non UTF-8 (es. file ANSI con lettere accentate) lancia
    → file rifiutato con l'invito a salvare come "CSV UTF-8".
  - **Separatore** (BR-19, FR-002): si conta `;` e `,` **fuori dalle virgolette** nella prima
    riga non vuota (l'intestazione); vince il più frequente, a parità `;`. Il resto del file usa
    lo stesso separatore.
  - **Numero di riga** (FR-009): indice del record (1 = intestazione). Un campo con a capo tra
    virgolette resta una sola riga, come la mostra il foglio di calcolo. I record vuoti contano
    nella numerazione ma non sono né righe di dati né errori.
  - **Limite di righe** (FR-008a): il parser si ferma appena supera 500 record di dati non
    vuoti → file rifiutato per intero, senza validare il resto.
- **Motivazione**: nessuna libreria CSV serve in un parser di questa dimensione (principio III);
  costo lineare nei caratteri, ~0,3 ms per 50 KB.
- **Alternative scartate**: `papaparse` (dipendenza runtime di ~20 KB per un caso semplice);
  `split` per righe e separatori (rompe i valori tra virgolette, edge case della spec).

## R-04 — Validazione di intestazione e righe

- **Intestazione** (BR-18, FR-001): ogni cella si confronta con le colonne note dopo `trim`,
  minuscole e rimozione degli accenti (`searchKey` di 003), quindi `Priorità` = `priorita`.
  Colonna sconosciuta, colonna ripetuta o `nome`/`data` assenti → file rifiutato con l'elenco
  delle colonne attese. Le colonne **opzionali assenti** sono ammesse e valgono vuote
  (approvato dal proprietario il 2026-10-29). L'ordine è libero.
- **Celle in più**: un record con più celle dell'intestazione è un errore di riga ("colonne in
  più") solo se le celle in eccesso non sono vuote; celle mancanti in coda valgono vuote.
- **Valori** (FR-006, FR-010): si riusano le funzioni pure dell'inserimento guidato, senza
  duplicarle: `cleanText` con `TEXT_LIMITS` (nome, nickname, gruppi), `parseBirthDate` con
  `today = toLocal(now())`, `normalizePhone`, `normalizeUsername`, `validateGreeting`;
  `priorita` vuota → `DEFAULT_PRIORITY`, altrimenti `alta|media|bassa` senza maiuscole. Una
  riga accumula **tutti** i motivi di errore (FR-010); gli errori di riga non bloccano le
  altre. Ogni campo produce al massimo **un** motivo (per `gruppi` il primo elemento troppo
  lungo) e i valori citati nei motivi sono accorciati a `IMPORT_ERROR_VALUE_MAX` (30)
  caratteri con `…`: una riga d'errore resta sotto ~300 caratteri qualunque sia il file (R-12,
  chiarimento 2026-10-29).
- **Riga d'esempio** (FR-007a): definita una sola volta in `texts.ts` (`CSV_EXAMPLE_ROW`) e usata
  sia da `/modello` sia dall'import. Una riga valida con `normKey(nome)` e data uguali a quelle
  d'esempio è sempre saltata e segnalata a parte. Persona d'esempio: "Esempio Da Cancellare",
  `14/03/1990` (chiaramente fittizia).
- **Motivazione**: un'unica implementazione delle regole garantisce che CSV e bot accettino gli
  stessi valori (BR-01: "vale sia nel bot sia nel CSV").

## R-05 — Duplicati e gruppi da creare

- **Duplicati** (BR-14, FR-011): stessa regola di `findDuplicate` (001 FR-004): stesso
  `normKey(nome)`, giorno e mese; l'anno conta solo se presente in entrambe. Il confronto è in
  TypeScript contro le chiavi delle persone esistenti (una SELECT di `full_name_norm`,
  `birth_day`, `birth_month`, `birth_year`) e contro le righe **precedenti valide** dello stesso
  file. La prima riga vince, le successive sono duplicati saltati.
- **Conseguenza usata da R-07**: due righe importate con lo stesso nome, giorno e mese hanno
  per forza anni diversi ed entrambi presenti (altrimenti la seconda sarebbe un duplicato).
  Quindi `(full_name_norm, birth_day, birth_month, birth_year)` è unica tra le righe importate
  (con `IS` per confrontare il `NULL`).
- **Gruppi** (BR-17, BR-20, BR-23, FR-012): la cella si divide su `|`, ogni elemento passa per
  `cleanText(…, 30)`; elementi vuoti ignorati, ripetuti (per `normKey`) contati una volta.
  Un nome che corrisponde a un gruppo esistente usa quel gruppo; altrimenti è "da creare" con la
  grafia della **prima riga importata** che lo usa. I gruppi delle righe con errori o duplicate
  non contano.

## R-06 — Anteprima nello stato della conversazione

- **Decisione**: l'anteprima è un flusso guidato `import` del motore esistente (001), così
  scadenza a 24 ore, Annulla, `/annulla`, pulsanti di flusso non più validi e sostituzione da
  parte di un altro comando funzionano senza codice nuovo (FR-014, 001 FR-018…FR-018c).
  - `conversation_state.data` contiene **solo ciò che serve a Importa**: le righe da importare
    già normalizzate (con i nomi dei gruppi) e i conteggi dell'anteprima. Duplicati ed errori
    sono solo nel testo inviato. Con 500 righe da ~250 byte → ~125 KB, sotto i 2 MB di D1.
  - Step unico `anteprima` (`kind: "buttons"`, azione `i` = Importa; `a` = Annulla è del motore).
  - Il **primo invio** dell'anteprima è completo: testo diviso a righe intere con
    `splitMessage` di 003 se supera 4096 caratteri, pulsanti nell'ultimo messaggio (Assumptions).
    I gruppi da creare vanno a capo ogni `PREVIEW_GROUPS_PER_LINE` (10) nomi, così nessuna riga
    supera 4096 caratteri. L'anteprima occupa al massimo `PREVIEW_MAX_MESSAGES` (30) messaggi:
    se ne servirebbero di più, l'ultimo si chiude con `…e altre N righe non mostrate (correggi il
    file e rimandalo).` e porta i pulsanti; i conteggi in testa restano completi (chiarimento
    2026-10-29). Il tetto rende il budget indipendente dal contenuto del file (R-12).
    Se l'utente scrive testo durante l'attesa, `repeatStep` invia il **riepilogo breve** (numeri
    e gruppi da creare) con gli stessi pulsanti, non l'intera anteprima.
  - Nessuna riga importabile (FR-015) o file vuoto: si invia l'anteprima senza pulsanti e **non**
    si crea lo stato (l'eventuale flusso precedente è già stato annullato, R-13).
- **Ricontrollo a Importa** (edge case BR-14): una batch di lettura (chiavi delle persone,
  gruppi esistenti), poi la stessa funzione pura dell'anteprima ricalcola duplicati e gruppi da
  creare sulle righe salvate; il messaggio finale riporta i numeri effettivi.
- **Alternative scartate**: conservare il file (`file_id`) e riscaricarlo a Importa (2
  subrequest e parsing ripetuti, stato meno esplicito); tabella dedicata alle anteprime (nuova
  migration, contro il principio III).

## R-07 — Scrittura dell'import: una batch atomica con `json_each`

- **Decisione**: Importa esegue **una** `db.batch` (transazione D1: tutto o niente, FR-013):
  1. `INSERT OR IGNORE INTO groups (name, name_norm) SELECT … FROM json_each(?1) WHERE <guardia>`
     — gruppi da creare; `meta.changes` = M del messaggio finale.
  2. `INSERT INTO persons (…) SELECT json_extract(value, '$.…'), … FROM json_each(?1) WHERE
     <guardia>` — tutte le persone, `created_at = updated_at = now`; `meta.changes` = N.
  3. `INSERT OR IGNORE INTO person_groups (person_id, group_id) SELECT p.id, g.id FROM
     json_each(?1) r, json_each(r.value, '$.groups') gn JOIN groups g ON g.name_norm = gn.value
     JOIN persons p ON p.full_name_norm = … AND p.birth_day = … AND p.birth_month = … AND
     p.birth_year IS … WHERE p.id > (SELECT MAX(id) FROM persons) - ?2 AND <guardia>` — le N
     persone appena inserite sono le ultime N per id (AUTOINCREMENT, una sola transazione) e
     la chiave è unica tra loro (R-05).
  4. `consumeStatement` (DELETE dello stato del flusso, research R-11 di 001).
  Ogni statement ha la guardia `flowGuardSql` del flusso: un secondo tocco su Importa trova lo
  stato già consumato e non scrive nulla.
- **Perché `json_each`**: tre statement con un parametro ciascuno invece di ~70 INSERT multi-riga
  da ≤ 100 parametri; `JSON.stringify` di 500 righe < 0,2 ms. D1 supporta le funzioni JSON di
  SQLite. Il parametro JSON (~125 KB con 500 righe) non conta nei 100 KB di testo dello
  statement. *Ripiego*, se un test con D1 reale mostrasse un limite sul parametro: blocchi da 100
  righe nella stessa batch (resta una subrequest e resta atomica).
- **Persone importate come quelle del guidato** (FR-013): stesse colonne, `full_name_norm`
  calcolato con `normKey` in TypeScript, nessuna occorrenza creata in anticipo. Il ciclo orario
  applica da solo le regole delle persone appena inserite (002 FR-017, FR-018) perché legge
  `created_at`.
- **Alternative scartate**: un INSERT per persona con `SELECT MAX(id)` come nel guidato (fino a
  1000 statement nella batch: tempo D1 e CPU di preparazione inutili); id calcolati in
  TypeScript (richiede di leggere `sqlite_sequence`).

## R-08 — Formato del backup JSON (versione 1)

- **Decisione**: oggetto JSON compatto (nessuna indentazione), chiavi uguali alle colonne D1 per
  rendere diretto il ripristino con `json_extract`:
  `{ format: "bot-compleanni-backup", version: 1, created_at, persons[], groups[],
  person_groups[], occurrences[], settings: { default_message } }`. Schema completo in
  [contracts/backup-json.md](contracts/backup-json.md).
- **Esclusi**: `full_name_norm` e `name_norm` (derivati, ricalcolati al ripristino), `deliveries`
  (registro degli invii, non elencato da RF-26), `conversation_state`, la chiave operativa
  `auto_backup` di `settings` (R-11).
- **Generazione**: una batch di lettura con 5 SELECT (`ORDER BY id`), `JSON.stringify`,
  `TextEncoder`. 200 persone + 2000 occorrenze ≈ 250 KB, ~1 ms di CPU.
- **Versione**: `version` diversa da 1 → backup non valido (Assumptions della spec).
- **Alternative scartate**: chiavi in italiano (servirebbe una mappatura in più in entrambe le
  direzioni; il file non è pensato per essere letto a mano, quello è il CSV); JSON indentato
  (+50% di dimensione senza un requisito).

## R-09 — Validazione e ripristino

- **Validazione** (FR-018, edge case "dati incoerenti"): funzione pura
  `parseBackup(text, today)` in `src/domain/backup.ts`, eseguita **prima** di qualunque
  conferma. Controlla in ordine: JSON valido; `format` e `version`; tipi di ogni campo; regole
  dei valori come il guidato (R-04) — nome e lunghezze, data con `parseBirthDate`, telefono E.164,
  username senza `@`, priorità, messaggi con `validateGreeting`, nomi dei gruppi; unicità di
  `id` di persone, gruppi, occorrenze; unicità dei nomi dei gruppi per `normKey`; riferimenti
  di `person_groups` e `occurrences` esistenti; unicità `(person_id, year)`; `effective_date`
  `AAAA-MM-GG` valida; `status` ammesso. Il primo errore rifiuta il file con un motivo breve
  (contracts/backup-json.md).
- **Flusso `ripristina`** (FR-019, FR-021, RNF-05): step `file` (attesa del documento; un testo
  ripete "attendo un file JSON di backup") → `conferma1` (contenuto del backup e dati attuali,
  pulsanti Continua / Annulla) → `conferma2` (avviso di irreversibilità, "Sì, ripristina" /
  Annulla). Il backup validato e normalizzato è conservato in `conversation_state.data`
  (~250 KB) fino alla seconda conferma; scadenza, Annulla e `/annulla` dal motore.
- **Scrittura** (FR-020, FR-020a): **una** `db.batch` con guardia di flusso su ogni statement:
  1. `DELETE FROM persons` (cascade su `person_groups`, `occurrences`, `deliveries`),
     `DELETE FROM groups`, `DELETE FROM settings WHERE key = 'default_message'`;
  2. `INSERT` da `json_each` di gruppi, persone, appartenenze, occorrenze **con gli id del
     backup** (i comandi `/p_<id>` restano validi, RNF-11) e del messaggio di default se
     presente;
  3. chiusura delle occorrenze aperte con D+1 concluso, con la stessa regola del ciclo orario:
     `UPDATE occurrences SET status = 'non_confermato', outcome_at = now WHERE status =
     'aperta' AND effective_date <= today − 2` — nessun messaggio;
  4. `consumeStatement`.
  La batch è una transazione: un errore in qualunque statement lascia i dati precedenti intatti
  (edge case "nessuna sostituzione parziale"). `sqlite_sequence` non si azzera: gli id nuovi
  dopo il ripristino restano maggiori di tutti quelli mai usati, quindi un vecchio `/p_<id>` di
  una persona non presente nel backup non apre una persona diversa.
- **Promemoria dopo il ripristino** (FR-020a, BR-10): `deliveries` è vuota; il ciclo orario
  pianifica solo l'ora corrente, quindi le occorrenze con D o D+1 oggi ricevono solo gli slot
  futuri (incluso il recupero delle 13:00 di D+1 se non ancora passato). Nessun invio
  retroattivo senza codice aggiuntivo.
- **Alternative scartate**: riscaricare il file a ogni conferma (+2 subrequest e +1 parsing per
  passo); ripristino a più batch (non atomico).

## R-10 — `/modello` ed export CSV

- **Decisione**: serializzatore in `src/domain/csv.ts`: separatore `;`, `\r\n`, BOM UTF-8
  (FR-005a); un valore va tra virgolette se contiene `;`, `,`, `"`, `\r` o `\n` (con `""`
  interne). Colonne nell'ordine di FR-001.
- **Mappatura export** (FR-016, Assumptions): data `gg/mm/aaaa` o `gg/mm` (`formatShort`);
  username senza `@`; gruppi per nome in ordine alfabetico (`sortNames`) separati da `|`;
  priorità minuscola; `messaggio` solo se personalizzato. Persone in ordine di `id`.
- **Telefono** (approvato dal proprietario il 2026-10-29): esportato con uno spazio dopo i primi tre
  caratteri (`+39 3331234567`). Excel interpreta `+393331234567` come numero (perde il `+` o
  passa a notazione scientifica) e il file reimportato avrebbe numeri sbagliati; con lo spazio
  resta testo, e `normalizePhone` rimuove gli spazi in import: reimport identico (SC-004).
- **Rischio noto, nessuna azione**: Excel può trasformare `14/03` (senza anno) in una data e
  salvarla come `14-mar`; l'import la segnala come data non valida con il numero di riga. La
  legenda di `/modello` suggerisce di formattare la colonna `data` come Testo.
- **Iniezione di formule**: i valori sono scritti dal solo proprietario (RNF-02); nessun prefisso
  di neutralizzazione, che romperebbe il reimport identico.

## R-11 — Backup automatico mensile nel cron esistente

- **Decisione**: `runMonthlyBackup(deps, scheduledAt)` in `src/cron/backup-mensile.ts`, chiamata
  dall'handler `scheduled` **dopo** `runHourly`, con un proprio `try/catch` (un guasto dell'una
  non blocca l'altra, RNF-12). Nessun Cron Trigger nuovo (V-01, principio II).
  - **Quando** (FR-022, FR-023a): ora locale da `scheduledTime` (R-02 di 002); il backup del mese
    `AAAA-MM` è *dovuto* se `giorno > 1` oppure `ora ≥ 9`. Giorno e ora in `config.ts`
    (`AUTO_BACKUP_DAY`, `AUTO_BACKUP_HOUR`).
  - **Al massimo una volta** (FR-023), garantito dal database: chiave `auto_backup` in
    `settings`, valore `AAAA-MM:<stato>`. Reclamo con un solo statement:
    `INSERT … ON CONFLICT(key) DO UPDATE SET value = 'AAAA-MM:in_invio' WHERE settings.value NOT
    IN ('AAAA-MM:in_invio', 'AAAA-MM:inviato') RETURNING value`. Solo chi ottiene la riga invia.
  - **Invio**: stessa funzione di `/backup` (FR-022, FR-025): batch di lettura → `sendDocument`
    nella chat del proprietario (`OWNER_TELEGRAM_ID`).
  - **Esito**: `AAAA-MM:inviato`; su errore Telegram `AAAA-MM:fallito`, che il reclamo
    dell'ora successiva riprende (FR-023a, anche nei giorni seguenti). Con un nuovo mese il
    valore precedente viene superato da quello nuovo.
  - Un `in_invio` rimasto bloccato (guasto della piattaforma tra reclamo ed esito) **non** viene
    ritentato: prevale "al massimo una volta", come per gli invii (N-02).
- **Prima installazione a metà mese**: la chiave non esiste, il backup del mese corrente è
  "dovuto" e arriva alla prima esecuzione oraria (effetto di FR-023a, approvato il 2026-10-29).
- **Il ripristino non tocca `auto_backup`** (R-08, R-09): ripristinare un backup non provoca un
  secondo invio nello stesso mese.
- **Alternative scartate**: un secondo Cron Trigger (vietato da V-01); `SELECT` poi `UPDATE`
  (due chiamate e una finestra di doppio invio); invio prima della scrittura dell'esito senza
  reclamo (doppio invio se l'esito fallisce).

## R-12 — Budget di subrequest e CPU (principio II, ~200 persone)

**Subrequest per invocazione** (la colonna D1 include `getActive` del router e, dove indicato,
`clear` di un flusso precedente):

| Invocazione (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| Invio CSV di 500 righe (anteprima su ≤ 30 messaggi, `PREVIEW_MAX_MESSAGES`) | 1 + 1 (`clear`) + 1 (lettura chiavi/gruppi) + 1 (`start` stato) | 2 (getFile + download) + ≤ 30 | ≤ 36 |
| Importa | 1 (`getActive` del motore) + 1 (lettura) + 1 (batch di scrittura) | `editMessageReplyMarkup` + `sendMessage` + `answerCallbackQuery` | 6 |
| Annulla | 2 (`getActive`, `clear`) | 2 | 4 |
| `/modello` | 1 (+1) | 1 (`sendDocument`) | ≤ 3 |
| `/export` | 1 (+1) + 1 (batch) | 1 | ≤ 4 |
| `/backup` | 1 (+1) + 1 (batch) | 1 | ≤ 4 |
| `/ripristina` | 1 (+1) + 1 (`start`) | 1 | ≤ 4 |
| Invio del file JSON di backup | 1 + 1 (conteggi attuali) + 1 (`update`) | 2 (getFile + download) + 1 | 6 |
| Continua / "Sì, ripristina" | 1 + 1 (`update`) / 1 + 1 (batch) | 3 (edit + messaggio + answer) | ≤ 5 |
| Cron con backup dovuto | runHourly ≤ 43 (research R-05 di 002) + 1 (reclamo) + 1 (lettura) + 1 (esito) | + 1 (`sendDocument`) | **≤ 47** |
| Cron senza backup dovuto | runHourly ≤ 43 + 1 (reclamo a vuoto) | — | ≤ 44 |

Tutti i casi ≤ 50. L'anteprima dell'import è limitata da `PREVIEW_MAX_MESSAGES` qualunque sia
il contenuto del file: con righe d'errore sotto ~300 caratteri, 500 righe richiederebbero ~37
messaggi, il tetto le porta a 30. Il caso del cron è il più vicino al limite e viene verificato da un test con
contatore (`ciclo-budget.test.ts` esteso).

**CPU stimata** (bench in Node, soglia 3 ms per iterazione, lasciando margine sui 10 ms):

| Operazione | Stima |
|---|---|
| Import 200 righe: decodifica + parsing + validazione + duplicati + gruppi + testo anteprima + `JSON.stringify` dello stato | ~1 ms |
| Import 500 righe (massimo FR-008a), stesso percorso | ~2 ms |
| Importa: `JSON.parse` dello stato + ricontrollo + parametri JSON | < 0,5 ms |
| Backup: 200 persone + 2000 occorrenze → `JSON.stringify` + `TextEncoder` | ~1 ms |
| Validazione del backup (stesso volume) | ~1,5 ms |
| Export 200 persone | < 0,5 ms |

`getActive` nel router fa `JSON.parse` dello stato a ogni messaggio: con un ripristino in attesa
(~250 KB) costa ~1 ms, una sola volta per update.

## R-13 — Instradamento dei documenti

- **Decisione**: in `routeMessage`, dopo whitelist e chat privata e dopo `getActive`, un messaggio
  con `document` va a `handleDocument` (`src/bot/file.ts`):
  - `.csv` → come un comando (001 FR-018): **dopo il download riuscito** annulla in silenzio il
    flusso in corso, anche un `/ripristina` o un'altra anteprima, poi avvia l'import, anche se il
    file viene poi rifiutato (Assumptions della spec); file troppo grande o download fallito
    lasciano il flusso invariato;
  - `.json` con flusso `ripristina` allo step `file` → validazione del backup;
  - `.json` in ogni altro caso → "Per ripristinare un backup usa /ripristina", flusso invariato
    (edge case della spec);
  - altra estensione → allo step `file` di `ripristina` ripete l'attesa del JSON; altrimenti
    "invia un file .csv", flusso invariato.
  Un messaggio con `photo` (immagine inviata come foto, non come file) non viene scaricato:
  allo step `file` di `ripristina` ripete l'attesa del JSON, altrimenti "invia un file .csv";
  flusso invariato (edge case della spec). La `caption` di un documento ricevuto è ignorata. Mittenti diversi dal proprietario: nessuna
  chiamata (già garantito dal router, RNF-09, FR-027 di 001).

## R-14 — Test e benchmark

- **Fake Telegram**: registra `sendDocument` (nome, MIME, contenuto decodificato, caption);
  `getFile`/`downloadFile` serviti da una mappa `file_id → contenuto` popolata dal test; errori
  simulabili come per `sendMessage`.
- **Helper**: `documentUpdate(fileName, fileId, size?)`; generatori di CSV sintetici (nessun dato
  reale, principio V).
- **Unit**: parser e serializzatore CSV (virgolette, separatori, BOM, a capo, numerazione,
  non UTF-8); validazione di intestazione e righe con tutti i motivi; duplicati e gruppi;
  costruzione e validazione del backup (ogni regola di coerenza); legenda ≤ 1024.
- **Integrazione** (pool workers, D1 locale): ogni scenario della spec (quickstart.md);
  atomicità con uno statement fatto fallire (es. persona con dati che violano un `CHECK`
  iniettata nello stato); round-trip export→import e backup→ripristino; backup mensile con
  `scheduledTime` iniettato; contatori di subrequest.
- **Bench** (`bench/import-backup.bench.ts`, Node): import 200 e 500 righe, generazione e
  validazione del backup, export; soglia 3 ms.
