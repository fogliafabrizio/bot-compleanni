# Research — 003 Viste e ricerche

**Data**: 2026-10-28 · **Spec**: [spec.md](spec.md) · **Piano**: [plan.md](plan.md)

Stack, convenzioni e scelte trasversali sono quelli delle feature 001
([research 001](../001-fondamenta-anagrafica/research.md)) e 002
([research 002](../002-promemoria-esiti/research.md)) e non vengono ripetuti. Qui solo le
decisioni nuove. Non restano punti "NEEDS CLARIFICATION".

---

## R-01 — Limiti che riguardano le viste

| Limite | Valore | Conseguenza per il design |
|---|---|---|
| Lunghezza di un messaggio Telegram | 4096 caratteri (dopo il parsing delle entità) | Le liste sono divise in più messaggi a righe intere (R-05) |
| Subrequest per invocazione (webhook) | 50 | Ogni vista usa **una** batch D1 (due per `/cerca` con un solo risultato e `/oggi` senza compleanni) oltre alle letture del router, più i `sendMessage` (R-08) |
| CPU per invocazione | 10 ms | Filtro, ordinamento e rendering di ~200 righe in TypeScript senza `Intl` per persona (R-09) |
| Ritmo di invio nella stessa chat | ~1 messaggio/s, brevi raffiche tollerate | `/oggi` e le liste divise inviano pochi messaggi in sequenza, senza pausa (R-06) |
| Risposta al webhook | il Worker risponde 200 solo dopo aver gestito l'update (001, `webhook.ts`) | Nessuna pausa artificiale: un webhook lento verrebbe ritrasmesso da Telegram |

## R-02 — Formato della riga e intestazione (FR-001, FR-003, §5.7)

- **Decisione** (approvata dal proprietario, chiarimento 2026-10-28): una funzione pura
  `formatListLine` in `src/bot/liste.ts` produce una riga in due parti:
  `[Ggg gg/mm  <nome (età)><riempimento>[  <esito><riempimento>]]  /p_<id>`, dove la parte tra
  parentesi quadre esterne è coperta da un'**entità `code`** (monospazio) e `/p_<id>` sta fuori
  dal `code`, coperto da un'entità esplicita **`bot_command`**. Ogni riga porta esattamente queste
  due entità, che non si sovrappongono:
  - giorno della settimana da `WEEKDAYS_IT` (`Lun`…`Dom`, in `src/texts.ts`), calcolato con
    `Date.UTC(...).getUTCDay()` sulla **data effettiva** della riga (BR-04: il 28/02 negli anni non
    bisestili);
  - data `gg/mm` di **nascita** (resta `29/02`, come nei pre-reminder di 002);
  - nome = nickname, altrimenti nome completo;
  - età solo con anno di nascita noto; quale età dipende dalla vista (R-04);
  - esito solo in `/scaduti` (`saltato`, `non confermato`, `in attesa`).
  - **Colonne**: "nome (età)" è riempito con spazi fino alla larghezza `W` = lunghezza (in code
    point) del più lungo della **lista intera** (uguale in tutti i messaggi di una lista divisa),
    con tetto `LIST_NAME_COLUMN_MAX = 20` (`config.ts`): un nome più lungo sfora solo la propria
    riga, senza troncamenti. L'esito, quando c'è, è riempito a 14 (`non confermato`). Data e
    giorno hanno già larghezza fissa.
  - **Entità**: le entità si passano come array `entities` di `sendMessage`
    (`{ type: "code" | "bot_command", offset, length }`, offset e lunghezze in unità UTF-16 =
    `String.length`). Il `bot_command` esplicito evita di dipendere dal riconoscimento automatico
    dei comandi da parte di Telegram quando il messaggio porta già delle entità,
    **senza `parse_mode`**: nessun escaping HTML/Markdown dei nomi, testo identico a quello
    calcolato. `TelegramApi.sendMessage` riceve un parametro opzionale `entities`; il resto del
    bot continua a non usarlo.
- **Motivazione**: Telegram mostra il testo semplice con un carattere proporzionale, quindi
  l'allineamento di §5.7 è possibile solo in monospazio; un'entità `code` limitata alla parte
  sinistra allinea data, nome ed età, mentre `/p_<id>` fuori dall'entità resta un comando
  toccabile (RNF-14). Il tetto di 20 evita che un nickname lungo spinga tutte le righe a capo
  su un telefono.
- **Alternative scartate**: separatore fisso senza allineamento (proposta iniziale, respinta dal
  proprietario); blocco `pre` o `code` sull'intera riga (i `/p_<id>` non sarebbero più
  toccabili); `parse_mode: "HTML"` (escaping di ogni nome, rischio di messaggi rifiutati per
  un `<` o `&`); larghezza calcolata per messaggio (colonne diverse tra i messaggi di una lista).

## R-03 — Ordinamento (FR-002, FR-015, FR-016, FR-019)

- **Decisione**: tutte le viste "anagrafiche" (`/prossimi`, `/gruppo`, `/cerca`, prossimo di
  `/oggi`) ordinano per `nextBirthday(...).daysUntil` (funzione già esistente in
  `src/domain/date.ts`, oggi = 0), poi per nome visualizzato (`Intl.Collator` di modulo già in
  `src/domain/text.ts`), poi per `id`. `/mese` ordina per giorno di nascita, poi nome. Le viste
  "storiche" (`/scaduti`, elenchi di `/anno`) ordinano per **data effettiva dell'occorrenza**
  crescente, poi nome.
- **Motivazione**: per le occorrenze passate "prossimo compleanno" non ha senso (ognuna è
  ancorata a una data già trascorsa); l'ordine cronologico è quello che la riga stessa mostra.
  Rientra nel "salvo diversa indicazione" di §4.4/FR-002; **approvato dal proprietario**
  (chiarimento 2026-10-28, FR-002).
- **Alternative scartate**: per `/scaduti` dal più recente al più vecchio (meno naturale da
  leggere dall'alto); per `/anno` ordine alfabetico.

## R-04 — Età e anno di riferimento per vista

| Vista | Data della riga | Età mostrata |
|---|---|---|
| `/prossimi`, `/gruppo`, `/cerca`, prossimo di `/oggi` | prossimo compleanno (oggi compreso) | che compirà: `next.year − birth_year` |
| `/mese M` | anno di riferimento `R` = anno corrente se `M ≥ mese corrente`, altrimenti anno prossimo (chiarimento) | `R − birth_year` (per i giorni passati del mese corrente è l'età compiuta) |
| `/scaduti` | data effettiva dell'occorrenza | `occurrence.year − birth_year` (età compiuta) |
| `/anno Y` | data effettiva dell'occorrenza di `Y` | `Y − birth_year` |

Tutti i calcoli usano `today = toLocal(deps.now())` (principio VI) e `effectiveDate` per il 29/02.

## R-05 — Divisione dei messaggi lunghi (FR-005, RNF-16)

- **Decisione**: `splitMessage(lines)` (puro, `src/bot/liste.ts`) riceve righe già formattate
  (testo + entità relative alla riga) e riempie i messaggi in modo greedy unendo righe intere con
  `\n`; apre un nuovo messaggio quando la riga successiva farebbe superare `MESSAGE_MAX_LENGTH`
  caratteri **oppure** `LIST_MAX_LINES_PER_MESSAGE = 45` righe con entità. Gli offset delle
  entità vengono traslati nella posizione della riga dentro il proprio messaggio. Il tetto di
  righe è prudenziale: ogni riga porta esattamente due entità esplicite (`code` e `bot_command`)
  e assumiamo, senza verifica documentale, che Telegram tratti in modo affidabile al più ~100
  entità per messaggio; 45 righe = 90 entità. La soglia si verifica a mano con il bot reale
  prima di implementare le liste (task T016a) e, se serve, si abbassa
  `LIST_MAX_LINES_PER_MESSAGE`. Le righe vuote in testa a un messaggio di
  continuazione vengono scartate. L'intestazione compare solo nel primo messaggio. La lunghezza
  si misura con `String.length` (unità UTF-16), che non è mai inferiore al conteggio di
  Telegram: il limite è rispettato anche con emoji e lettere accentate. `MESSAGE_MAX_LENGTH =
  4096` sta in `src/config.ts` (principio VIII).
- **Dimensionamento**: riga tipica ~35 caratteri, massima ~110 (nickname di 60 + età + esito +
  `/p_<id>`). 200 righe → 5 messaggi (limite di righe); caso peggiore assoluto di `/anno`
  (200 saltati + 200 in serie, righe massime ≈ 44 000 caratteri) → 12 messaggi (limite di
  lunghezza, ~37 righe ciascuno).
- **Alternative scartate**: paginazione con pulsanti (vietata da RNF-14/RNF-16); file di testo
  allegato (cambia l'esperienza delle liste e i `/p_<id>` non sarebbero toccabili); ripetere
  l'intestazione in ogni messaggio (righe in più, nessun beneficio con pochi messaggi).

## R-06 — `/oggi`: messaggi del reminder, pulsanti e tetto (FR-006…FR-008)

- **Decisione**:
  1. Una batch D1: `INSERT OR IGNORE` dell'occorrenza `aperta` di oggi per le persone con data
     effettiva oggi (coppie di `birthPairsFor(today)`, già in `domain/schedule.ts`), poi la
     `SELECT` di persone, occorrenza di oggi, esito dell'anno precedente e messaggio di default.
  2. Per ciascuna persona si riusa `renderGiorno` / `renderGiornoAfter` di
     `bot/promemoria.ts`; i pulsanti Fatto/Salta puntano all'**occorrenza** con il nuovo ambito
     `t:f:<occurrenceId>` / `t:s:<occurrenceId>` ([callback-data.md](contracts/callback-data.md)).
  3. Nessuna riga in `deliveries`: il messaggio non conta come slot e la pianificazione non cambia
     (FR-007). L'occorrenza creata qui è identica a quella che creerebbe il ciclo orario
     (002 R-04): il ciclo la trova, la usa e la chiude come sempre.
  4. Tetto `TODAY_MAX_MESSAGES = 10` (in `config.ts`): oltre il decimo compleanno, le persone
     restanti vanno in un ultimo messaggio nel formato lista, ciascuna con `/p_<id>`.
  5. Un'occorrenza creata da `/oggi` segue il ciclo normale: se resta aperta, il ciclo la chiude
     a *non confermato* a D+2 (`minOpenDate = T − 2`) e compare in storico, `/scaduti` e `/anno`,
     anche per una persona che non ha ricevuto reminder programmati (es. inserita dopo l'ultimo
     slot). È voluto: `/oggi` ha mostrato il compleanno con i pulsanti di esito.
- **Motivazione**: i pulsanti del reminder sono legati a `deliveries.id` (002 R-10), che qui non
  esiste; legarli all'occorrenza evita di inventare invii fittizi e mantiene gli stessi effetti
  (stesso `UPDATE … WHERE status = 'aperta'`, BR-07). Creare l'occorrenza è necessario perché
  prima del primo slot (o per una persona inserita oggi) potrebbe non esistere ancora. Il tetto
  serve al limite di 50 subrequest e al ritmo di Telegram (R-01) senza pause nel webhook: con
  ~200 persone la media è ~0,55 compleanni al giorno, quindi non scatta mai nell'uso reale.
  Il tetto è uno scostamento da "per ciascuno" di RF-16 **approvato dal proprietario**
  (chiarimento 2026-10-28, FR-007a).
- **Alternative scartate**: pulsanti con `personId` e anno ricavato al tocco (sbagliato su un
  messaggio di ieri premuto dopo mezzanotte, e l'occorrenza andrebbe comunque creata al tocco);
  registrare i messaggi di `/oggi` come `deliveries` (violerebbe FR-007 e l'unicità per slot);
  pausa di 1 s tra gli invii (rischio di ritrasmissione dell'update da parte di Telegram).

## R-07 — "Segna fatto" nella scheda (FR-017, FR-018, BR-08)

- **Decisione**: `showScheda` legge anche l'eventuale **occorrenza in sospeso**: data effettiva
  tra `oggi − OUTCOME_CORRECTION_DAYS` e `ieri`, stato diverso da `fatto` (al più una per persona,
  perché in 7 giorni cade un solo compleanno). Se esiste, la tastiera aggiunge "Segna fatto"
  (`p:f:<personId>`). Al tocco, una batch: `UPDATE occurrences SET status = 'fatto' … WHERE
  person_id = ? AND status <> 'fatto' AND effective_date BETWEEN ? AND ?` più le letture per
  ricomporre la scheda; con `changes = 0` → "Questa azione non è più disponibile"; altrimenti
  `editMessageText` della scheda premuta (storico aggiornato, pulsante scomparso).
- **Motivazione**: la finestra coincide con quella di `/scaduti` e con il limite D+7 già usato
  dal recupero (`OUTCOME_CORRECTION_DAYS`, 002); condizione nella query = nessuna corsa con il
  ciclo orario. Un'occorrenza ancora aperta di ieri chiusa in *fatto* non riceve il recupero,
  perché il reclamo del ciclo richiede `status = 'aperta'` (002 `insertDeliveries`): BR-07 senza
  codice nuovo. L'ambito `p` passa già dal controllo "Persona non trovata" del router.
- **Alternative scartate**: pulsante con `occurrenceId` (la scheda è per persona e il router
  verifica già la persona); includere oggi nella finestra (oggi resta di `/oggi`, chiarimento).

## R-08 — Letture D1 per vista (principio II)

Una batch per comando (due solo dove indicato), **oltre alle letture del router**: ogni messaggio
di testo legge lo stato della conversazione (`getActive`, 1 chiamata) e, con un flusso attivo, lo
cancella (`clear`, +1); i pulsanti `p:` passano da `getById` e `clear` di `routeStatic` (+2); i
pulsanti `t:` non leggono lo stato. Le colonne sotto contano solo le batch del comando; i totali
sono in plan.md. Tutte le query leggono al più ~200 persone o le occorrenze di un anno.

| Comando | Batch D1 | Statement | Telegram |
|---|---|---|---|
| `/prossimi`, `/gruppo` | 1 | gruppo per `name_norm`, persone (filtrate per gruppo con sottoquery), elenco gruppi | 1–k messaggi |
| `/mese` | 1 | persone con `birth_month = ?` | 1–k |
| `/cerca` | 1 (+1 se un solo risultato → `showScheda`) | tutte le persone (campi della lista) | 1–k |
| `/scaduti` | 1 | occorrenze nella finestra con persona | 1–k |
| `/anno` | 1 | conteggi per stato, saltati di Y, saltati di Y e Y−1 | 1–k |
| `/oggi` | 1 (+1 se nessun compleanno) | INSERT occorrenze, SELECT dati reminder; poi persone per il prossimo | ≤ 11 |
| `t:f` / `t:s` | 1 | UPDATE + SELECT per ricomporre | edit + answer |
| `p:f` | 1 | UPDATE + persona + gruppi + storico + sospeso | edit + answer |
| `/p_<id>` (modificato) | 1 | persona, gruppi, storico, sospeso: oggi sono 3 chiamate separate, riunite in una batch condivisa con `p:f` | 1 |

Nessuna migration: l'indice `idx_occurrences_date` copre `/scaduti` e il "sospeso" della scheda;
`/anno` filtra per `year` su poche migliaia di righe al massimo (scansione trascurabile).

## R-09 — Ricerca senza accenti e senza maiuscole (FR-012)

- **Decisione**: `searchKey(s) = s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT")`
  in `src/domain/text.ts`; `/cerca` legge le persone (≤ 200) e confronta `includes` in TypeScript
  su nome completo e nickname. Il testo cercato viene ripulito con `trim()`; vuoto → sintassi.
- **Motivazione**: `LIKE` e `lower()` di SQLite gestiscono solo ASCII (001 R-08 aveva già portato
  `normKey` in TypeScript) e non tolgono gli accenti. 400 normalizzazioni di stringhe brevi
  costano decine di microsecondi.
- **Alternative scartate**: colonna `search_norm` con migration e aggiornamento di inserimento e
  modifica (più codice per un guadagno di CPU irrilevante a questi volumi); FTS5 (sovradimensionato).

## R-10 — Parsing degli argomenti

- **Decisione**: `parseCommand` restituisce anche `args` (testo dopo il comando, `trim`).
  - `/prossimi`: se il primo token è un intero (anche negativo o zero) è il numero di giorni,
    validato 1–366 (`UPCOMING_MAX_DAYS`, default `UPCOMING_DEFAULT_DAYS = 30`, in `config.ts`); il
    resto (anche con spazi) è il gruppo. Un primo token non numerico → tutto è il gruppo.
  - `/gruppo`: tutto l'argomento è il nome; confronto con `normKey` su `groups.name_norm`.
  - `/mese`: nome italiano (`MONTHS_IT`, confronto `normKey`) o intero 1–12; vuoto = mese corrente.
  - `/anno`: 4 cifre tra `MIN_BIRTH_YEAR` e l'anno corrente; vuoto = anno corrente.
  - `/cerca`: tutto l'argomento.
- **Motivazione**: argomenti posizionali come da spec (Assumptions); i nomi di gruppo possono
  contenere spazi (001, limite 30).

## R-11 — `/anno`: serie di saltati (FR-019)

- **Decisione**: "saltata per 2 o più anni consecutivi" = esito `saltato` nell'anno Y **e** in
  Y−1 (la serie termina in Y). Una query: `SELECT … FROM occurrences o JOIN occurrences prev ON
  prev.person_id = o.person_id AND prev.year = o.year − 1 WHERE o.year = ? AND o.status =
  'saltato' AND prev.status = 'saltato'`. I conteggi escludono `aperta`.
- **Motivazione**: chiarimento 2026-10-28 (un *non confermato* o un anno senza occorrenza
  interrompe la serie); serie più lunghe sono automaticamente incluse.
- **Alternative scartate**: calcolo della lunghezza della serie da mostrare sulla riga (non
  richiesto dall'AFU).

## R-12 — Test e benchmark

- Integrazione (pool workers, D1 locale, fake Telegram, `now` iniettato): un file per user story,
  ogni scenario Dato/Quando/Allora con l'ID nel nome del test (principio XI).
- Budget: contatore delle chiamate D1 e di Telegram per `/oggi` con 15 compleanni, `/prossimi 366`
  e `/anno` con 200 persone (≤ 50, valore esatto).
- Unit: `formatListLine` (larghezza di colonna, tetto 20, entità `code` che non copre `/p_<id>`,
  entità `bot_command` esattamente su `/p_<id>`,
  offset UTF-16 con emoji e accenti), `splitMessage` (righe intere, ≤ 4096, ≤ 45 righe, offset
  traslati), `searchKey`, parsing di
  `/prossimi` e `/mese`, età/anno di riferimento di `/mese`, 29/02 in anno non bisestile.
- Benchmark (`vitest bench`, Node, file `bench/liste.bench.ts`): ordinamento + rendering + split
  di 200 persone e `/cerca` su 200 persone, soglia 2 ms per iterazione.

## R-13 — Scelte di testo non fissate dall'AFU

Intestazioni: "Prossimi N giorni" (singolare "Prossimo giorno" con N = 1) con "(Gruppo)" se
filtrato; "Gruppo <Nome>"; "Compleanni di <mese> <anno di riferimento>"; "Risultati per
«testo»"; "Ultimi 7 giorni, non fatti"; "Riepilogo <anno>" con le righe "Fatto: n", "Saltato: n",
"Non confermato: n" e le sezioni "Saltati:" e "Saltati per 2 o più anni di fila:" (con "nessuno"
se vuote). Etichetta del pulsante: "Segna fatto". Testi esatti in
[contracts/comandi.md](contracts/comandi.md); tutti in `src/texts.ts`. `/aiuto` elenca i nuovi
comandi.
