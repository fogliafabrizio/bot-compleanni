# Contratto — Flussi guidati

*(RF-01, RF-02, RF-04…RF-08, BR-01, BR-02, BR-14…BR-17, A-04, RNF-13)*

Regole comuni a tutti i flussi:

- Stato in `conversation_state` (vedi [data-model.md](../data-model.md)); scadenza 24 h
  dall'ultima interazione, poi trattato come assente in silenzio (FR-018a).
- `/annulla` o `[Annulla]` → "Operazione annullata", nulla salvato (FR-018). Ogni altro
  comando esistente → flusso annullato in silenzio, poi comando eseguito. Comando inesistente
  → "Non ho capito…" e ripetizione della domanda dello step; il flusso prosegue.
- Step Priorità: Media è preselezionata (✓) e si conferma con un tocco; non c'è Salta.
- **Step a testo**: input non valido → messaggio d'errore specifico + ripetizione della
  domanda; input valido → step successivo.
- **Step a pulsanti**: testo libero (non comando) → ripetizione della domanda con i suoi
  pulsanti (FR-018b).
- Pulsante di un flusso non attivo o di uno step diverso → "Questa azione non è più
  disponibile" (FR-018c).
- Scritture finali in un'unica `D1.batch` condizionata al `flow_id` (research R-11).

## Flusso `nuovo` (RF-01, AFU §5.2)

| # | Step | Tipo | Pulsanti | Validazione / effetto |
|---|---|---|---|---|
| 1 | `nome` | testo | `[Annulla]` | Obbligatorio, 1–60 car. |
| 2 | `nickname` | testo | `[Salta]` | 1–60 car. |
| 3 | `data` | testo | — | `gg/mm/aaaa` o `gg/mm`; giorno esistente; 29/02 con anno solo se bisestile; anno 1900…anno corrente (RF-02, BR-01, BR-02). Errore → ripete il formato atteso |
| 4 | `data_conferma` | pulsanti | `[Sì] [Correggi]` | "14 marzo 1994, giusto?" — Correggi → step 3 |
| 5 | `telefono` | testo | `[Salta]` | Normalizzazione BR-15; errore → ripete l'esempio `+39 333 1234567` |
| 6 | `instagram` | testo | `[Salta]` | `@` rimosso (BR-16) |
| 7 | `telegram` | testo | `[Salta]` | `@` rimosso (BR-16) |
| 8 | `gruppi` | pulsanti | `[☐/☑ <gruppo>]…` `[➕ Nuovo gruppo] [Fine]` | Toggle con `editMessageReplyMarkup`; nessun gruppo esistente → solo Nuovo gruppo e Fine |
| 8a | `gruppo_nuovo` | testo | `[Annulla]` | 1–30 car., univoco senza distinzione di maiuscole tra esistenti e in attesa (BR-17); valido → torna a 8 con il gruppo selezionato (RF-08; creazione in DB al salvataggio, R-12) |
| 9 | `priorita` | pulsanti | `[Alta] [Media ✓] [Bassa]` | Default Media |
| 10 | `messaggio` | testo | `[Salta]` | 1–500 car.; saltato = standard |
| 11 | `riepilogo` | pulsanti | `[Salva] [Annulla]` | Testo della scheda senza riga Storico |
| 12 | `duplicato` | pulsanti | `[Salva comunque] [Annulla]` | Solo se BR-14 trova un duplicato al momento di Salva |

Salvataggio → batch: gruppi in attesa, persona, appartenenze, cancellazione stato; poi la
scheda (FR-003).

## Flusso `modifica` (RF-04)

| Step | Tipo | Pulsanti | Effetto |
|---|---|---|---|
| `menu` | pulsanti | `[Nome] [Nickname] [Data] [Telefono] [Instagram] [Telegram] [Gruppi] [Priorità] [Messaggio] [Annulla]` | Scelta del campo |
| `valore` | testo | `[Svuota]` solo per i campi opzionali (nickname, telefono, instagram, telegram, messaggio), `[Annulla]` | Stesse regole dell'inserimento (FR-016). Svuota → campo a NULL, salvato subito (FR-015) |
| `data_conferma` | pulsanti | `[Sì] [Correggi]` | Solo per Data |
| `gruppi` / `gruppo_nuovo` | come nel flusso `nuovo` | | Selezione iniziale = gruppi attuali; Fine salva l'insieme |
| `priorita` | pulsanti | `[Alta] [Media] [Bassa]` con ✓ sulla corrente | Salvata subito |
| `duplicato` | pulsanti | `[Salva comunque] [Annulla]` | Solo per Nome o Data, se il nuovo valore crea un duplicato di **un'altra** persona (FR-016a) |

Dopo il salvataggio: `updated_at` aggiornato e scheda rimostrata. Persona eliminata nel
frattempo → "Persona non trovata" e flusso chiuso.

## Flusso `elimina` (RF-05)

| Step | Tipo | Pulsanti | Effetto |
|---|---|---|---|
| `conferma` | pulsanti | `[Sì] [Annulla]` | Testo "Eliminare <nome completo>? Perderai anche lo storico". Sì → `DELETE` persona (cascata su appartenenze, occorrenze, invii) e messaggio di conferma; Annulla → nulla cambia |

## Flusso `gruppi` (RF-07)

| Azione | Step | Effetto |
|---|---|---|
| Crea (`g:n`) | `nome` (testo) | 1–30 car., BR-17; creato e poi rimostrato l'elenco `/gruppi` |
| Rinomina (`g:r`) | `scelta` (pulsanti, un gruppo per pulsante) → `nome` (testo) | BR-17 escludendo il gruppo stesso (cambio solo di maiuscole consentito); rimostra l'elenco |
| Elimina (`g:x`) | `scelta` → `conferma` (pulsanti `[Sì] [Annulla]`) | Testo con "N persone perderanno questa etichetta" (FR-022); Sì → gruppo eliminato, persone intatte |

Gruppo eliminato nel frattempo → "Questa azione non è più disponibile" e flusso chiuso.
