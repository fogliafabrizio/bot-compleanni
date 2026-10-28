# Contratto — Flussi `import` e `ripristina`

Estende il [contratto flussi di 001](../../001-fondamenta-anagrafica/contracts/flussi.md): stesso
motore (`src/bot/flows/engine.ts`), pulsanti di flusso `f:<flowId>:<azione>`, `a` = Annulla
gestita dal motore (`Operazione annullata.`), pulsante di un flusso concluso, sostituito o
scaduto → `Questa azione non è più disponibile` (FR-018c di 001), scadenza 24 ore (A-04).
Nessun ambito statico nuovo nei `callback_data`.

## Flusso `import` — RF-24, §5.8, FR-008…FR-015

### Anteprima (invio del CSV)

Testo, sezioni presenti solo se non vuote:

```text
Anteprima import
104 persone nuove
Riga d'esempio ignorata
5 duplicati (saltati):
• riga 7: Marco Rossi 14/03
• …
3 errori:
• riga 12: data "31/04" non valida
• riga 40: nome mancante
• riga 51: telefono non valido; priorità "altissima" non valida
Gruppi da creare: Calcetto, Università
```

- Duplicati ed errori elencati **tutti**, in ordine di riga.
- Oltre 4096 caratteri: divisione a righe intere (`splitMessage` di 003), pulsanti
  [Importa] [Annulla] solo nell'ultimo messaggio.
- Gruppi da creare: al massimo 10 nomi per riga (`PREVIEW_GROUPS_PER_LINE`); le righe
  successive continuano l'elenco senza ripetere `Gruppi da creare:`.
- Al massimo 30 messaggi (`PREVIEW_MAX_MESSAGES`): se ne servirebbero di più, l'ultimo si chiude
  con `…e altre N righe non mostrate (correggi il file e rimandalo).` e porta i pulsanti; le righe
  con i conteggi restano in testa al primo messaggio.
- Almeno una riga nuova → stato `import`/`anteprima` con le righe ([data-model.md](../data-model.md)),
  pulsanti `f:<id>:i` (Importa) e `f:<id>:a` (Annulla).
- Nessuna riga nuova (FR-015) → stesso testo **senza pulsanti** e nessuno stato.
- Nulla viene scritto nelle tabelle di dominio prima di Importa.

### Mentre l'anteprima è in attesa

| Evento | Effetto |
|---|---|
| testo libero | riepilogo breve: `Anteprima in attesa: 104 nuove, 5 duplicati, 3 errori. Gruppi da creare: Calcetto, Università.` + [Importa] [Annulla] |
| comando, altro CSV, pulsante statico | stato sostituito in silenzio (FR-018 di 001) |
| 24 ore senza interazioni | stato scaduto; Importa → `Questa azione non è più disponibile` |

### Importa (`i`)

1. Ricontrollo dei duplicati e dei gruppi sulle righe salvate (research R-06).
2. Una batch atomica con guardia di flusso (research R-07).
3. `editMessageReplyMarkup` del messaggio premuto con tastiera vuota.
4. Messaggio: `Importate N persone, creati M gruppi.`; se il ricontrollo ha trovato nuovi
   duplicati, prima riga aggiuntiva `K righe sono diventate duplicati e sono state saltate.` (con K = 1:
   `1 riga è diventata un duplicato ed è stata saltata.`)
5. Errore della batch: nessuna riga salvata (transazione); l'utente riceve l'avviso generico
   del webhook; lo stato resta e Importa può essere ripremuto.
6. Secondo tocco concorrente: stato già consumato → `Questa azione non è più disponibile`.

Con N = 0 dopo il ricontrollo: `Nessuna persona importata: tutte le righe sono ora duplicati.`,
stato consumato.

### Annulla (`a`) — FR-014

`Operazione annullata.`; nulla salvato.

## Flusso `ripristina` — RF-26, RNF-05, FR-018…FR-021

| Step | Tipo | Messaggio | Pulsanti |
|---|---|---|---|
| `file` | testo/documento | `Inviami il file JSON di backup da ripristinare.` | [Annulla] |
| `conferma1` | pulsanti | vedi sotto | [Continua] `c` · [Annulla] |
| `conferma2` | pulsanti | `⚠️ Attenzione: l'operazione è irreversibile. Tutti i dati attuali verranno cancellati e sostituiti dal backup. Vuoi procedere?` | [Sì, ripristina] `r` · [Annulla] |

Messaggio di `conferma1`:

```text
Backup del 01/11/2026: 198 persone, 6 gruppi, 1.204 occorrenze.
Dati attuali che verranno sostituiti: 203 persone, 7 gruppi, 1.230 occorrenze.
```

(data = `created_at` del backup in ora locale; dati attuali da `COUNT(*)` al momento della
validazione.)

- Allo step `file`: testo → `Attendo un file JSON di backup. Usa /annulla per interrompere.`;
  JSON non valido → motivo ([backup-json.md](backup-json.md)) e si resta in `file`.
- "Sì, ripristina" → batch atomica ([backup-json.md](backup-json.md)), `editMessageReplyMarkup`
  vuota, poi:

```text
Ripristino completato: 198 persone, 6 gruppi, 1.204 occorrenze.
Messaggio di auguri standard: personalizzato   (oppure: quello iniziale)
```

- Errore della batch: dati invariati (transazione); avviso generico; stato invariato.
- Annulla a ogni step, `/annulla`, un altro comando, un CSV, 24 ore → dati invariati (FR-021).
