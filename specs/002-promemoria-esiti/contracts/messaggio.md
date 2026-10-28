# Contratto — `/messaggio` e messaggio di auguri

*(RF-15, A-06, spec FR-031, FR-032, FR-035)*

## Comando

| Comando | Effetto |
|---|---|
| `/messaggio` | Avvia il flusso `messaggio` (come ogni comando, annulla in silenzio un flusso in corso, FR-018 di 001). Aggiunto anche al testo di `/aiuto` |

## Flusso `messaggio`

Regole comuni dei flussi della feature 001: stato in `conversation_state`, `flow_id`, scadenza
24 h, `/annulla` e pulsante Annulla, testo inviato in uno step a pulsanti → domanda ripetuta.

| Step | Bot | Input atteso | Esito |
|---|---|---|---|
| `testo` | "Messaggio attuale: «<default attuale>»\nScrivi il nuovo messaggio di auguri. Usa {nome} per il nome." + `[Annulla]` | testo | valido → `conferma`; non valido → errore + domanda ripetuta |
| `conferma` | "Anteprima: «<testo con {nome} = T.sampleName>»\nConfermi?" + `[Conferma] [Annulla]` | pulsante | Conferma → salva, "Messaggio di auguri aggiornato", fine; Annulla → "Operazione annullata", fine |

Validazione (`validateGreeting`, condivisa con `custom_message` di inserimento e modifica):

1. spazi iniziali e finali rimossi; vuoto → rifiutato;
2. `lunghezza = code point del testo senza "{nome}" + 60 × numero di "{nome}"`;
3. `lunghezza > 256` → "Il messaggio può avere al massimo 256 caratteri (ogni {nome} conta 60)."
   e domanda ripetuta.

Salvataggio: una batch con
`INSERT INTO settings (key, value, updated_at) SELECT 'default_message', ?, ? WHERE <guardia di
flusso> ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
e la cancellazione dello stato (stessa protezione dal doppio tocco della feature 001).

## Composizione (`composeGreeting`)

```
template = persona.custom_message ?? settings.default_message ?? DEFAULT_BIRTHDAY_MESSAGE
auguri   = template.replaceAll("{nome}", persona.nickname ?? persona.full_name)
```

Usato da WhatsApp e Copia messaggio. Mai l'età (BR-03).

## Budget

≤ 4 subrequest per update (lettura stato, eventuale batch di salvataggio, `sendMessage`,
`answerCallbackQuery`), come i flussi della feature 001.
