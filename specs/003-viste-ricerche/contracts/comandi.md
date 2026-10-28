# Contratto — Comandi delle viste

Estende il [contratto comandi 001](../../001-fondamenta-anagrafica/contracts/comandi.md). Tutti i
comandi sono serviti solo al proprietario in chat privata (router invariato) e, come ogni comando
esistente, annullano in silenzio un flusso guidato in corso (FR-018 di 001). Testi in
`src/texts.ts`; le stringhe sotto sono il riferimento per i test. I numeri che compaiono nei
testi (366, 7, 1900) sono risolti con i valori attuali e vengono da `config.ts`
(`UPCOMING_MAX_DAYS`, `OUTCOME_CORRECTION_DAYS`, `MIN_BIRTH_YEAR`): i testi sono funzioni con
parametro, mai valori scritti a mano.

`parseCommand` restituisce `{ name, personId?, args }`, con `args` = testo dopo il primo token,
senza spazi ai bordi (research R-10).

## `/oggi` — RF-16

| Caso | Risposta |
|---|---|
| ≥ 1 persona con data effettiva oggi | per ciascuna (ordine per nome), il messaggio del reminder del giorno (`renderGiorno` di 002) con pulsanti `t:f` / `t:s`; se l'occorrenza è già chiusa, `renderGiornoAfter` (solo contatti + "✅ Fatto" o "Saltato") |
| più di `TODAY_MAX_MESSAGES` (10) | i primi 10 come sopra, poi un messaggio lista `Altri compleanni di oggi:` con le restanti persone |
| nessun compleanno, persone presenti | `Oggi non ci sono compleanni. Il prossimo:` + riga vuota + le righe (formato lista) di tutte le persone del prossimo giorno con compleanni |
| nessuna persona registrata | `Oggi non ci sono compleanni e non hai ancora inserito nessuna persona.` |

29/02 in anno non bisestile: il reminder del 28/02 contiene già "(compleanno il 29/02)" (002).
Nessuna riga in `deliveries` (FR-007).

**Tocchi** (`t:f`, `t:s`): stessa risposta dei pulsanti del reminder (contratto promemoria 002):
`editMessageText` del messaggio premuto con `renderGiornoAfter`, `answerCallbackQuery` senza
testo; occorrenza non aperta → "Questa azione non è più disponibile"; inesistente → "Persona non
trovata".

## `/prossimi [giorni] [gruppo]` — RF-17

| Input | Risposta |
|---|---|
| `/prossimi` | `Prossimi 30 giorni` + righe di tutte le persone con prossimo compleanno in [oggi, oggi+29] |
| `/prossimi 7 famiglia` | `Prossimi 7 giorni (Famiglia)` (nome del gruppo come salvato) |
| `/prossimi 1` | `Prossimo giorno` |
| `/prossimi famiglia` | gruppo = `famiglia`, 30 giorni |
| giorni non in 1–366 (`0`, `-3`, `400`) | `Il numero di giorni deve essere tra 1 e 366` |
| gruppo inesistente | `Il gruppo «<testo>» non esiste.` + `Gruppi esistenti: A, B, C` (oppure `Non hai ancora nessun gruppo.`) |
| nessun compleanno nel periodo | `Nessun compleanno nei prossimi N giorni` (+ ` (Gruppo)`) |

## `/cerca <testo>` — RF-18

| Input | Risposta |
|---|---|
| senza testo | `Scrivi /cerca seguito da una parte del nome o del nickname, es. /cerca marco` |
| 1 risultato | la scheda (`showScheda`, identica a `/p_<id>`) |
| ≥ 2 risultati | `Risultati per «<testo>»` + righe ordinate per prossimo compleanno |
| 0 risultati | `Nessun risultato per «<testo>»` |

Confronto: `searchKey(testo)` contenuto in `searchKey(full_name)` o `searchKey(nickname)`
(senza maiuscole e accenti, research R-09).

## `/gruppo <nome>` — RF-19

| Input | Risposta |
|---|---|
| senza nome | `Scrivi /gruppo seguito dal nome del gruppo, es. /gruppo Famiglia` + elenco gruppi esistenti |
| gruppo esistente con persone | `Gruppo <Nome>` + righe di tutte le persone, per prossimo compleanno |
| gruppo esistente vuoto | `Nessuna persona nel gruppo <Nome>` |
| gruppo inesistente | come `/prossimi` |

## `/mese [mese]` — RF-20

| Input | Risposta |
|---|---|
| `/mese` | mese corrente |
| `/mese marzo`, `/mese Marzo`, `/mese 3` | `Compleanni di marzo <R>` + righe ordinate per giorno, con `R` anno di riferimento (research R-04) |
| mese non riconosciuto (`marzzo`, `13`, `0`) | `Mese non riconosciuto: scrivilo per nome (es. marzo) o per numero da 1 a 12` |
| nessun compleanno | `Nessun compleanno a <mese>` |

## `/scaduti` — RF-21

| Caso | Risposta |
|---|---|
| occorrenze con data effettiva in [oggi−7, ieri] e stato ≠ `fatto` | `Ultimi 7 giorni, non fatti` + righe con esito (`saltato`, `non confermato`, `in attesa`), in ordine di data |
| nessuna | `Nessun compleanno in sospeso negli ultimi 7 giorni` |

I compleanni di oggi non compaiono. Ogni riga porta alla scheda con "Segna fatto".

## Scheda `/p_<id>` — modifica (FR-017, BR-08)

- Tastiera: `[Modifica] [Elimina]` invariata; se c'è un'occorrenza in sospeso (stessa finestra di
  `/scaduti`) si aggiunge una riga `[Segna fatto]` (`p:f:<personId>`) **sopra** Modifica/Elimina.
- Tocco con occorrenza aggiornata: `editMessageText` della scheda premuta, ricomposta (storico con
  `<anno> fatto`, nessun "Segna fatto"); `answerCallbackQuery` senza testo.
- Nessuna occorrenza aggiornata (oltre D+7, già `fatto`): "Questa azione non è più disponibile",
  esito invariato.

## `/anno [anno]` — RF-22

```text
Riepilogo 2025

Fatto: 40
Saltato: 3
Non confermato: 2

Saltati:
Lun 10/03  Luca (35)    /p_17
Ven 21/11  Giulia       /p_9
…

Saltati per 2 o più anni di fila:
Lun 10/03  Luca (35)    /p_17
```

Le righe delle persone seguono [liste.md](liste.md) (parte sinistra in monospazio, colonne
allineate); conteggi e titoli di sezione sono testo semplice.

| Input | Risposta |
|---|---|
| `/anno` | anno corrente |
| `/anno 2025` | anno 2025 |
| non valido (`20x5`, `1850`) o futuro | `Anno non valido: scrivi un anno tra 1900 e <anno corrente>` |
| anno senza esiti | conteggi a zero, sezioni con `nessuno` |

Le occorrenze `aperta` non sono conteggiate; le righe usano la data dell'occorrenza di Y e l'età
`Y − anno di nascita`.

## `/aiuto` — aggiornamento

Aggiunge, prima di `/annulla`: `/oggi`, `/prossimi [giorni] [gruppo]`, `/cerca <testo>`,
`/gruppo <nome>`, `/mese [mese]`, `/scaduti`, `/anno [anno]`, ciascuno con una descrizione di una
riga (AFU §5.1).
