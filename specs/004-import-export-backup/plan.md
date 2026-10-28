# Implementation Plan: Import, export e backup

**Branch**: `004-import-export-backup` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-import-export-backup/spec.md`

## Summary

Aggiunge `/modello`, l'import CSV con anteprima (invio di un documento), `/export`, `/backup`,
`/ripristina` con doppia conferma e il backup automatico del 1° del mese alle 9:00 (RF-23…RF-27,
BR-14, BR-18…BR-23, RNF-05, RNF-09, RNF-11, V-07).

Approccio: architettura e stack di 001–003 invariati (Worker TypeScript strict, D1, client Bot API
su `fetch`, dipendenze e `now` iniettati), **nessuna dipendenza nuova, nessuna migration**.

- **File in ingresso**: documenti Telegram, `getFile` + download dal client; tipo dall'estensione
  (`.csv`, `.json`); rifiuto oltre 20 MB (V-07) e oltre un tetto tecnico di 1 MiB per la CPU.
- **CSV**: parser RFC 4180 proprio, UTF-8 `fatal` con BOM, separatore `;`/`,` dall'intestazione;
  validazione con le **stesse funzioni pure** del guidato; duplicati (regola di `findDuplicate`) e
  gruppi in TypeScript.
- **Anteprima**: flusso `import` del motore esistente; le righe normalizzate stanno in
  `conversation_state.data` fino a Importa/Annulla (scadenza 24 ore, pulsanti non più validi,
  sostituzione da comando: già gestiti).
- **Scritture**: una `D1.batch` per Importa e una per il ripristino, con parametri JSON letti da
  `json_each` (pochi statement, ≤ 100 parametri) e guardia di flusso; la batch è una transazione,
  quindi **tutto o niente**.
- **Backup**: JSON v1 con chiavi uguali alle colonne; `parseBackup` puro valida tipi, regole e
  coerenza **prima** delle conferme; ripristino con gli id originali e chiusura delle occorrenze
  con D+1 concluso.
- **Backup mensile**: `runMonthlyBackup` chiamato dall'handler `scheduled` esistente dopo
  `runHourly`; idempotenza per mese con reclamo su `settings.auto_backup` (`ON CONFLICT … WHERE …
  RETURNING`), retry alle ore successive.
- **Invio file**: `sendDocument` multipart, solo nella chat del proprietario.

Dettagli in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001–003)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`). Parser CSV, `FormData`/`Blob`, `TextDecoder` dal runtime

**Storage**: D1 `birthday-bot-db`, schema invariato; chiave nuova `settings.auto_backup`; flussi
nuovi `import`, `ripristina` in `conversation_state` ([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale, fake Telegram esteso (`sendDocument`,
`getFile`, `downloadFile`), `now` e `scheduledTime` iniettati; `vitest bench` in Node per le
parti pure

**Target Platform**: Cloudflare Workers Free; webhook invariato; Cron Trigger invariato
(`0 * * * *`), handler esteso

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: import di 200 righe e generazione del backup ≤ 3 ms di CPU misurati (≤ 10 ms
di limite); una batch di scrittura per operazione

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); download ≤ 20 MB
e upload ≤ 50 MB (V-07); caption ≤ 1024 caratteri; ≤ 100 parametri per statement; ≤ 2 MB per riga
D1; 500 righe per import (FR-008a)

**Scale/Scope**: ~200 persone (RNF-16), storico pluriennale (~2000 occorrenze); 4 comandi nuovi,
ricezione documenti, 2 flussi nuovi, 1 estensione del cron

## Verifica dei limiti di piattaforma *(principio II)*

La feature tocca import, export, backup e ciclo orario: stime nel caso peggiore (research R-12).

**Subrequest**

| Invocazione (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| Invio CSV di 500 righe, anteprima su ≤ 30 messaggi (`PREVIEW_MAX_MESSAGES`), flusso precedente annullato | 4 (`getActive`, `clear`, lettura chiavi/gruppi, `start`) | 2 (`getFile`, download) + ≤ 30 | ≤ 36 |
| Importa | 3 (`getActive`, lettura per il ricontrollo, **una batch di scrittura**) | 3 (edit, messaggio, answer) | 6 |
| `/modello` · `/export` · `/backup` | ≤ 2 (+1 batch di lettura per export/backup) | 1 (`sendDocument`) | ≤ 4 |
| `/ripristina` · Continua · Sì, ripristina (per passo) | ≤ 3 | ≤ 3 | ≤ 5 |
| Invio del file JSON di backup nel flusso `ripristina` | 3 (`getActive`, conteggi, `update`) | 3 (`getFile`, download, messaggio) | 6 |
| Cron con backup dovuto (40 promemoria nella stessa ora) | 3 (runHourly) + 3 (reclamo, lettura, esito) | 40 + 1 (`sendDocument`) | **≤ 47** |
| Cron senza backup dovuto | 3 + 1 (reclamo a vuoto) | ≤ 40 | ≤ 44 |

Massimo assoluto **47 ≤ 50**, nel cron del 1° del mese alle 9:00 con il tetto di invii
`MAX_SENDS_PER_RUN` pieno.

**CPU** (stima, research R-12): import 200 righe ~1 ms (500 righe ~2 ms) tra decodifica, parsing,
validazione, duplicati, testo e `JSON.stringify` dello stato; Importa < 0,5 ms; backup 200
persone + 2000 occorrenze ~1 ms; validazione del backup ~1,5 ms; export < 0,5 ms. Il tetto di
1 MiB sui file ricevuti limita la decodifica nel caso peggiore.

**Come si verifica**: test di integrazione con contatore D1/Telegram (`import-budget.test.ts`,
`ciclo-budget.test.ts` esteso: valori esatti e ≤ 50); `vitest bench` (`bench/import-backup.bench.ts`)
con soglia 3 ms per import 200 e 500 righe, generazione e validazione del backup, export; dopo il
deploy, nessun `exceededCpu` nelle *Metrics*.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, un Cron, Bot API; file consegnati via Telegram, nessuno storage esterno (R2 non usato) | ✅ |
| II | Limiti Free | Tabella precedente: massimo 47 subrequest (cron del 1° alle 9:00); scritture multiple in **una** `D1.batch` (import, ripristino); CPU ≤ 3 ms misurata con bench; nessun Cron nuovo | ✅ |
| III | Semplicità | Zero dipendenze (parser CSV di ~70 righe, R-03), zero migration; riuso di motore dei flussi, `cleanText`, `parseBirthDate`, `normalizePhone`, `normalizeUsername`, `validateGreeting`, `normKey`, `splitMessage`, `formatShort`, `sortNames`; nessuna funzionalità fuori AFU | ✅ |
| IV | Sicurezza | Documenti e comandi dietro il router esistente (token, whitelist, chat privata); token solo nell'URL di download interno al client; ripristino con **doppia conferma** (RNF-05) e guardia di flusso su ogni statement | ✅ |
| V | Privacy | File consegnati solo nella chat del proprietario, mai link (RNF-09); log solo codici e conteggi (`auto_backup`: `sent`, `error_code`); messaggi di rifiuto del backup con soli id e nomi di campo | ✅ |
| VI | Tempo | Data del nome file, `today` della validazione e soglia D+1 da `toLocal(deps.now())`; ora del backup mensile da `scheduledTime` (R-02 di 002); test con ora solare e legale, 29/02 in CSV ed export | ✅ |
| VII | Affidabilità | Backup mensile al massimo una volta per mese garantito da D1 (`ON CONFLICT … WHERE … RETURNING`); `runMonthlyBackup` isolato con proprio `try/catch` (un suo guasto non tocca i promemoria e viceversa); il ripristino non crea invii retroattivi | ✅ |
| VIII | Centralizzazione | `IMPORT_MAX_ROWS`, `RECEIVED_FILE_MAX_BYTES`, `TELEGRAM_DOWNLOAD_MAX_BYTES`, `CSV_COLUMNS`, `CSV_EXPORT_SEPARATOR`, `CSV_GROUP_SEPARATOR`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `AUTO_BACKUP_DAY`, `AUTO_BACKUP_HOUR`, `DOCUMENT_CAPTION_MAX_LENGTH`, `IMPORT_ERROR_VALUE_MAX`, `PREVIEW_MAX_MESSAGES`, `PREVIEW_GROUPS_PER_LINE` in `config.ts`; legenda, riga d'esempio, motivi di errore e messaggi in `texts.ts` | ✅ |
| IX | Mono-proprietario | Nessuna tabella né unicità nuova; `auto_backup` è una riga di `settings` come `default_message`, estendibile per proprietario | ✅ |
| X | Qualità e test | Ogni scenario della spec → test ([quickstart.md](quickstart.md) §2); fake Telegram per file; niente orologio né rete reali | ✅ |
| XI | Tracciabilità | ID AFU in research, contratti, quickstart e nomi dei test | ✅ |
| XII | Italiano | Testi, legenda, nomi dei file e documenti in italiano; le chiavi del JSON di backup seguono le colonne D1 (formato macchina, R-08) | ✅ |

Vincoli V-01…V-07: nessun Cron nuovo (V-01); CPU (V-02); nessun pulsante URL (V-04…V-06); file
ricevuti ≤ 20 MB e inviati ≤ 50 MB (V-07).

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/](contracts/). Nessuna violazione.

### Decisioni del proprietario (2026-10-29)

Scelte che la spec non fissava o che ne precisano un'ipotesi; segnalate in fase di piano come
richiesto dalla constitution ("Fonte di verità"), approvate dal proprietario e registrate nei
Chiarimenti della spec (FR-001, FR-016, FR-023a, FR-026, Assumptions).

1. **Tetto tecnico di 1 MiB sui file ricevuti** (oltre ai 20 MB di V-07/FR-026): serve a
   restare nei 10 ms di CPU; copre 500 righe CSV e un backup con 200 persone e 20 anni di
   storico (R-01).
2. **Telefono nell'export come `+39 3331234567`** (spazio dopo il prefisso) invece del formato
   salvato `+393331234567` (Assumptions della spec): senza spazio Excel lo trasforma in numero e
   il reimport produce numeri sbagliati; `normalizePhone` rimuove lo spazio, quindi il reimport
   resta identico (R-10).
3. **Colonne opzionali assenti dall'intestazione ammesse** (valgono vuote); intestazioni
   confrontate anche senza accenti (`Priorità`) (R-04).
4. **Prima installazione a metà mese**: il backup del mese corrente arriva alla prima esecuzione
   oraria, come effetto di FR-023a (R-11).
5. **Backup mensile bloccato in `in_invio`** (guasto della piattaforma tra reclamo ed esito):
   non viene ritentato, prevale "al massimo una volta" (FR-023) come per i promemoria (N-02).
6. **Anteprima limitata** (emerso da `/speckit-analyze`): valori citati negli errori accorciati a
   30 caratteri, un motivo per campo, gruppi da creare a capo ogni 10 nomi, al massimo 30
   messaggi con indicazione delle righe non mostrate. Senza questi limiti un file di 1 MiB con
   valori lunghi o migliaia di gruppi nuovi supererebbe le 50 subrequest o i 4096 caratteri per
   riga (research R-04, R-06, R-12).

### Scelte non fissate dalla spec (modificabili senza impatto sull'architettura)

Testi di legenda, caption, rifiuti, riepiloghi e conferme ([contracts/](contracts/)); riga
d'esempio "Esempio Da Cancellare" `14/03/1990`; riepilogo breve dell'anteprima su testo libero;
un JSON fuori da `/ripristina` non interrompe il flusso in corso; un CSV sì (come un comando);
backup JSON compatto; `/aiuto` elenca i comandi nuovi; `/start` invariato (RF-28 fuori
perimetro).

## Project Structure

### Documentation (this feature)

```text
specs/004-import-export-backup/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── comandi.md       # /modello, /export, /backup, /ripristina, documenti ricevuti, /aiuto
│   ├── csv.md           # colonne, lettura, motivi di errore, riga d'esempio, scrittura
│   ├── backup-json.md   # schema v1, validazione, semantica del ripristino
│   ├── flussi.md        # flussi import e ripristina, pulsanti, messaggi
│   ├── backup-mensile.md# aggancio al cron, reclamo, retry, budget
│   └── telegram-file.md # Document, sendDocument, getFile, downloadFile, fake
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Nuovi file marcati `+`, modificati `~`.

```text
src/
├── ~ config.ts              # IMPORT_MAX_ROWS, RECEIVED_FILE_MAX_BYTES, TELEGRAM_DOWNLOAD_MAX_BYTES,
│                            # CSV_COLUMNS, CSV_EXPORT_SEPARATOR, CSV_GROUP_SEPARATOR, BACKUP_FORMAT,
│                            # BACKUP_FORMAT_VERSION, AUTO_BACKUP_DAY, AUTO_BACKUP_HOUR,
│                            # DOCUMENT_CAPTION_MAX_LENGTH, IMPORT_ERROR_VALUE_MAX,
│                            # PREVIEW_MAX_MESSAGES, PREVIEW_GROUPS_PER_LINE
├── ~ texts.ts               # legenda, CSV_EXAMPLE_ROW, motivi di errore, anteprima, conferme, rifiuti, /aiuto
├── ~ index.ts               # scheduled: runHourly poi runMonthlyBackup
├── domain/
│   ├── + csv.ts             # decodifica UTF-8, parser RFC 4180, separatore, serializzatore (puro)
│   ├── + import.ts          # intestazione, validazione righe, esempio, duplicati, gruppi, anteprima (puro)
│   └── + backup.ts          # costruzione del JSON v1 e parseBackup con regole di coerenza (puro)
├── db/
│   ├── + import.ts          # lettura chiavi/gruppi; batch Importa con json_each e guardia
│   ├── + backup.ts          # batch di lettura completa; conteggi; batch di ripristino
│   ├── ~ settings.ts        # reclamo ed esito di auto_backup
│   └── ~ conversation.ts    # FLOW_NAMES + "import", "ripristina"
├── bot/
│   ├── + file.ts            # handleDocument: limiti, download, instradamento per estensione
│   ├── + import.ts          # anteprima (testo, split, stato) e flusso import (Importa)
│   ├── + export.ts          # /modello, /export
│   ├── + backup.ts          # /backup e sendBackup condiviso con il cron
│   ├── flows/+ ripristina.ts# flusso ripristina: file, conferma1, conferma2
│   ├── ~ router.ts          # ramo document in routeMessage
│   └── ~ commands.ts        # modello, export, backup, ripristina
├── cron/
│   └── + backup-mensile.ts  # runMonthlyBackup
└── telegram/
    ├── ~ client.ts          # sendDocument (multipart), getFile, downloadFile
    └── ~ types.ts           # Document, Message.document, Message.caption

test/
├── helpers/~ fake-telegram.ts   # sendDocument, getFile, downloadFile, addFile
├── helpers/~ updates.ts         # documentUpdate
├── helpers/+ csv-fixtures.ts    # generatori di CSV e backup sintetici
├── unit/+ csv.test.ts, + import.test.ts, + backup.test.ts, ~ telegram-client.test.ts, ~ commands-parse.test.ts
└── integration/
    ├── + us1-modello, + us1-import, + documenti
    ├── + us2-backup, + us2-ripristino
    ├── + us3-backup-mensile
    ├── + us4-export
    ├── + import-budget.test.ts
    └── ~ ciclo-budget.test.ts, ~ us1-accesso.test.ts, ~ us7-start-aiuto.test.ts

bench/
└── + import-backup.bench.ts     # import 200/500 righe, backup e validazione, export
```

**Structure Decision**: struttura di 001–003 invariata (`domain/` puro, `db/` SQL, `telegram/`
trasporto, `bot/` interazione, `cron/` esecuzioni programmate). Le parti pure (`domain/csv.ts`,
`domain/import.ts`, `domain/backup.ts`) non importano `cloudflare:*`, così il benchmark gira in
Node come quelli del ciclo e delle liste.

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
