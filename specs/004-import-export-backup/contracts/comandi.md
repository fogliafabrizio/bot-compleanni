# Contratto — Comandi e documenti ricevuti

Estende il contratto comandi di [001](../../001-fondamenta-anagrafica/contracts/comandi.md) e
[003](../../003-viste-ricerche/contracts/comandi.md). Tutto è servito solo al proprietario in
chat privata (router invariato: estranei ignorati senza alcuna chiamata, RNF-09, FR-027 di 001).
I comandi nuovi, come gli esistenti, annullano in silenzio un flusso in corso (FR-018 di 001).
Testi in `src/texts.ts`; le stringhe sotto sono il riferimento per i test; i numeri vengono da
`config.ts`.

## `/modello` — RF-23, FR-007

`sendDocument` di `compleanni-modello.csv` ([csv.md](csv.md): intestazione + riga d'esempio),
con `caption` = legenda (≤ 1024 caratteri, verificato da test):

```text
Modello per importare le persone. Compilalo al PC e rimandamelo qui.

• nome e data sono obbligatori
• data: gg/mm/aaaa oppure gg/mm se l'anno non è noto (formatta la colonna come Testo)
• telefono: con o senza +39
• instagram, telegram: username, con o senza @
• gruppi: separati da | (es. Famiglia|Amici); quelli nuovi vengono creati
• priorita: alta, media o bassa (vuota = media)
• messaggio: auguri personalizzati, {nome} diventa il nome
• la riga d'esempio viene ignorata: puoi lasciarla o cancellarla
• separatore ; oppure , — salva come "CSV UTF-8"
```

## `/export` — RF-25, FR-016

`sendDocument` di `compleanni-export-AAAA-MM-GG.csv` ([csv.md](csv.md)), caption
`Export di N persone.` (anche con N = 0).

## `/backup` — RF-26, FR-017

`sendDocument` di `compleanni-backup-AAAA-MM-GG.json` ([backup-json.md](backup-json.md)),
caption `Backup: N persone, M gruppi, K occorrenze. Per ripristinarlo usa /ripristina.`

## `/ripristina` — RF-26, FR-018…FR-021

Avvia il flusso `ripristina` ([flussi.md](flussi.md)):
`Inviami il file JSON di backup da ripristinare.` + [Annulla].

## Documento ricevuto — RF-24, RF-26 (research R-01, R-13)

| Situazione | Risposta | Flusso in corso |
|---|---|---|
| `file_size` > 20 MB | `Il file è troppo grande: Telegram consente ai bot di ricevere file fino a 20 MB.` | invariato |
| `file_size` o dimensione scaricata > 1 MiB | `Il file è troppo grande (massimo 1 MB).` | invariato |
| `.csv` | import: anteprima ([flussi.md](flussi.md)) o rifiuto del file | **annullato** in silenzio dopo il download riuscito, come da un comando, anche se il file viene rifiutato |
| `.json`, flusso `ripristina` allo step `file` | validazione → prima conferma o motivo del rifiuto | prosegue |
| `.json` in ogni altro caso | `Per ripristinare un backup usa /ripristina.` | invariato |
| altra estensione, step `file` di `ripristina` | `Attendo un file JSON di backup. Usa /annulla per interrompere.` | invariato |
| altra estensione, altrimenti | `Per importare persone inviami un file .csv (usa /modello per il formato).` | invariato |
| foto (immagine non inviata come file), step `file` di `ripristina` | `Attendo un file JSON di backup. Usa /annulla per interrompere.` | invariato |
| foto, altrimenti | `Per importare persone inviami un file .csv (usa /modello per il formato).` | invariato |
| errore di download (getFile o file) | `Non sono riuscito a scaricare il file, riprova.` | invariato |

### Rifiuto del CSV per intero (nulla salvato, nessuna anteprima)

| Caso | Messaggio |
|---|---|
| non UTF-8 (BR-22) | `Non riesco a leggere il file: salvalo da Excel come "CSV UTF-8" e rimandalo.` |
| intestazione assente, colonne sconosciute o ripetute, `nome`/`data` mancanti (BR-18) | `Intestazione non valida. Colonne attese: nome; nickname; data; telefono; instagram; telegram; gruppi; priorita; messaggio (obbligatorie: nome e data).` |
| solo intestazione o file vuoto | `Il file non contiene righe da importare.` |
| più di 500 righe (FR-008a) | `Il file ha più di 500 righe: dividilo in più file da al massimo 500 righe.` |

## `/aiuto`

Aggiunge, nella sezione dei comandi, una riga per `/modello`, `/export`, `/backup`,
`/ripristina` e la nota "Per importare persone inviami un file CSV". `/start` resta invariato
(RF-28 fuori perimetro).
