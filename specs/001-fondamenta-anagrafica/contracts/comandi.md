# Contratto — Comandi e risposte

*(AFU §5.1; RF-01, RF-03, RF-06, RF-07, RF-28, RF-29, RNF-13, RNF-14)*

Tutti i testi stanno in `src/texts.ts` (RNF-15); qui è indicato il significato, non la
formulazione definitiva (salvo i testi fissati da spec/AFU, tra virgolette).

## Parsing

- Un messaggio è un comando se il testo (senza spazi iniziali) inizia con `/`. Il nome è il
  primo token, con un eventuale suffisso `@NomeBot` rimosso, confrontato in minuscolo.
- `/p_<id>`: `^/p_(\d+)$` (anche con `@NomeBot`).
- Un comando esistente ricevuto durante un flusso guidato annulla il flusso senza salvare e
  poi viene eseguito (FR-018). `/annulla` annulla e basta. Un comando inesistente non annulla
  il flusso: "Non ho capito…" e ripetizione della domanda dello step.

## Comandi di questa feature

| Comando | Chi | Risposta | Requisito |
|---|---|---|---|
| `/id` | Chiunque | Il proprio ID Telegram numerico | RF-29 |
| `/start` | Proprietario | Benvenuto + pulsanti `[Aggiungi persona] [Comandi]` (niente "Scarica modello CSV" finché manca RF-23) | RF-28 |
| `/aiuto` | Proprietario | Un comando per riga con descrizione: `/nuovo`, `/gruppi`, `/annulla`, `/id`, `/aiuto`, `/start` e la spiegazione di `/p_<id>` | RF-28 |
| `/nuovo` | Proprietario | Avvia il flusso guidato di inserimento | RF-01 |
| `/p_<id>` | Proprietario | Scheda (sotto) con `[Modifica] [Elimina]`; id inesistente → "Persona non trovata" | RF-03 |
| `/gruppi` | Proprietario | Elenco gruppi con numero di persone, pulsanti `[➕ Nuovo gruppo] [✏️ Rinomina] [🗑 Elimina]` (Rinomina ed Elimina solo se esiste almeno un gruppo) | RF-07 |
| `/annulla` | Proprietario | Con flusso attivo: interrompe senza salvare, "Operazione annullata". Senza flusso: "Nessuna operazione da annullare" | RF-06 |
| Testo libero o comando sconosciuto, fuori da un flusso | Proprietario | "Non ho capito. Scrivi /aiuto per l'elenco dei comandi" | RF-28, RNF-13 |
| Comando sconosciuto durante un flusso | Proprietario | "Non ho capito…" + ripetizione della domanda dello step; flusso non interrotto | FR-018 |
| Qualunque cosa diversa da `/id` | Estraneo | Nessuna risposta | RF-30, RNF-02 |

## Scheda persona (AFU §5.6, FR-011…FR-013)

```
<Nome completo>[ — "<nickname>"]
<gg/mm[/aaaa]> · <compie N anni tra G giorni | compleanno tra G giorni>
Priorità: <alta|media|bassa>[ · Gruppi: <A>, <B>]
[📱 <+E164>][ · IG @<instagram>][ · TG @<telegram>]
Messaggio: <standard | "testo personalizzato">
[Storico: <anno> <esito> · …]          ← assente finché non c'è almeno un esito

[Modifica] [Elimina]
```

- Data mostrata nel formato inserito: `14/03/1994` o `14/03` (29/02 resta 29/02, BR-04).
- Giorni ed età rispetto al prossimo compleanno in data locale Europe/Rome; età = anno del
  prossimo compleanno − anno di nascita (BR-03); nati il 29/02, anni non bisestili → 28/02.
  `G = 0` → "oggi", `G = 1` → "domani".
- Senza anno: età omessa (FR-012). Gruppi in ordine alfabetico; parti vuote omesse.
- Esempio verificato: now = 28/10/2026, nascita 14/03/1994 → "compie 33 anni tra 137 giorni".

## `/gruppi` (FR-019)

```
Gruppi:
• Beach tennis (5)
• Famiglia (3)
```

Nessun gruppo: messaggio dedicato e solo `[➕ Nuovo gruppo]`. Ordine alfabetico.
