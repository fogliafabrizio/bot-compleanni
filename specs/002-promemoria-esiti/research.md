# Research — 002 Promemoria ed esiti

**Data**: 2026-10-28 · **Spec**: [spec.md](spec.md) · **Piano**: [plan.md](plan.md)

Stack, convenzioni e scelte trasversali sono quelli della feature 001
([research 001](../001-fondamenta-anagrafica/research.md), R-01…R-16) e non vengono ripetuti.
Qui solo le decisioni nuove. Non restano punti "NEEDS CLARIFICATION".

---

## R-01 — Limiti di piattaforma verificati (fonte: documentazione Cloudflare, ottobre 2026)

| Limite (piano Free) | Valore | Conseguenza per il design |
|---|---|---|
| CPU per invocazione, anche cron | 10 ms | Lavoro lineare nel numero di invii, nessuna chiamata `Intl` per persona, statement D1 raggruppati (R-07) |
| Subrequest per invocazione | 50 (D1 e `fetch` contano entrambi) | Numero **costante** di chiamate D1 per esecuzione (3) + una `sendMessage` per invio, con un tetto (R-05) |
| Query D1 per invocazione | 50; **un `db.batch()` conta come una sola query** | Letture in un'unica batch, scritture in due batch |
| Parametri per statement D1 | 100 | Gli INSERT multi-riga sono spezzati in blocchi ≤ 100 parametri (R-07) |
| Lunghezza statement D1 | 100 KB | Irrilevante con i blocchi di R-07 |
| Connessioni simultanee in attesa | 6 | Gli invii a Telegram sono sequenziali (R-06) |
| Wall time di un cron | 15 minuti | Le pause tra un invio e l'altro non consumano CPU e stanno ampiamente nel limite (R-06) |
| `copy_text` di Telegram | 1–256 caratteri | Limite di 256 per i messaggi di auguri (spec FR-035) |

Il tempo di attesa di D1 e di Telegram non conta come CPU (RNF-17).

## R-02 — Ora dell'esecuzione e "now"

- **Decisione**: l'ora locale di un'esecuzione si ricava da `controller.scheduledTime` (l'istante
  per cui il cron era programmato, sempre a ora piena UTC), convertito con `toLocal`. I timestamp
  scritti (`sent_at`, `outcome_at`, `created_at`) usano `deps.now()`. `src/index.ts` passa
  `scheduledTime` a `runHourly(deps, scheduledAt)`; nessuna funzione di dominio legge l'orologio.
- **Motivazione**: un'esecuzione partita con qualche secondo di ritardo appartiene comunque alla
  sua ora (N-01); una ripetizione dello stesso evento cron ricalcola la stessa ora, quindi gli
  stessi invii, che l'indice unico scarta (N-02). Poiché Europe/Rome ha offset a ore intere,
  l'inizio dell'ora locale coincide con l'inizio dell'ora UTC: l'"istante dello slot" è
  `scheduledAt` arrotondato all'ora.
- **Alternative scartate**: `deps.now()` per l'ora (un ritardo oltre l'ora sposterebbe l'invio
  allo slot sbagliato).

## R-03 — Selezione per ora esatta (N-01, N-04, N-05, BR-10, BR-24)

- **Decisione**: a ogni esecuzione con data locale `T` e ora `H` sono **nuovi** solo gli invii
  pianificati esattamente per `(T, H)`:
  - `H ∈ slot del profilo` → reminder `giorno` per le persone con data effettiva `T`;
  - `H = 13` → pre-reminder `pre` con riferimento `N ∈ {7, 2, 1}` per le date effettive `T+N`
    (filtrati per profilo) e recupero per la data effettiva `T−1`.
  Nessun "recupero" degli slot di ore precedenti: uno slot non eseguito è perso (N-04).
  Le date di calendario si calcolano con `Date.UTC` su `LocalDate` (già in `src/time.ts`), quindi
  il cambio d'ora non sposta gli slot (BR-24). Profili e ore vengono da `src/config.ts`.
- **BR-10**: un invio nuovo è ammesso solo se `persons.created_at ≤ istante dello slot`
  (`scheduledAt` arrotondato all'ora). Inserire una persona alle 10:30 esclude lo slot delle 9 e
  include 13 e 18, senza logiche dedicate.
- **Motivazione**: il criterio "ora esatta" realizza insieme N-01, N-04 e BR-10/BR-11 con un solo
  confronto; con "tutti gli slot ≤ H non ancora inviati" un'esecuzione saltata verrebbe
  recuperata (vietato da N-04).
- **Alternative scartate**: pianificare in anticipo tutte le righe `deliveries` dell'anno (righe
  da ricalcolare a ogni cambio di priorità o data, BR-12/BR-13).

## R-04 — Occorrenze create "al bisogno" (BR-05, BR-06, BR-11, BR-13)

- **Decisione**: l'occorrenza `(persona, anno)` nasce nel ciclo orario, nella stessa batch del
  primo invio previsto (`INSERT OR IGNORE`, indice unico `ux_occurrences_person_year`).
  L'anno è quello della data effettiva (BR-05: il pre-reminder del 26/12 per il 02/01 crea
  l'occorrenza dell'anno nuovo). L'inserimento è condizionato a `EXISTS (persona)`, così una
  persona eliminata nel frattempo non fa fallire la batch per chiave esterna (RNF-12).
- **Recupero (BR-11, chiarimento 2026-10-28)**: alle 13 di `T`, per la data effettiva `D = T−1`:
  - persona creata **prima** dell'inizio locale di `D` → recupero se l'occorrenza è aperta **o non
    esiste ancora** (es. Bassa senza pre-reminder e slot di `D` persi per guasto: l'occorrenza
    nasce ora, N-04);
  - persona creata **durante** `D` → recupero solo se esiste un invio `giorno` di quell'occorrenza
    in stato `inviato` o `in_invio` (R-08);
  - persona creata dopo la fine di `D` → nessun recupero (la data effettiva precede l'inserimento,
    spec Assumptions).
  Gli inizi di giornata locali si calcolano con una nuova funzione `localDayStartUtc` in
  `src/time.ts` (unico punto del fuso), corretta anche nei giorni del cambio d'ora.
- **Chiusura *non confermato* (RF-13)**: a ogni esecuzione, `UPDATE occurrences SET status =
  'non_confermato', outcome_at = now WHERE status = 'aperta' AND effective_date ≤ T−2`.
  Normalmente agisce alle 00:00; se quell'esecuzione manca, la prima successiva recupera la
  chiusura (non è un invio, quindi N-04 non si applica). Nessun messaggio.
- **BR-12**: la priorità è letta a ogni esecuzione: vale automaticamente solo per il futuro.
- **BR-13**: nella batch di salvataggio del campo Data (flusso Modifica della feature 001) si
  aggiunge `DELETE FROM occurrences WHERE person_id = ? AND status = 'aperta'` (cascata sugli
  invii), **solo se cambiano giorno o mese**. Si annullano tutte le occorrenze aperte della
  persona: al più quella dell'anno corrente o, a dicembre, quella dell'anno successivo già nata
  da un pre-reminder (vedi "Interpretazioni" nel piano). Un'occorrenza già chiusa resta e,
  grazie all'indice unico, non ne nasce una seconda nello stesso anno (BR-06).
- **Motivazione**: nessuna riga "fantasma" per compleanni mai notificati; il modello resta
  coerente con l'assunzione della spec ("un'occorrenza nasce solo per compleanni la cui data
  effettiva non precede l'inserimento").
- **Limite noto**: se per una persona Bassa falliscono per guasto sia tutti gli slot di `D` sia
  l'esecuzione delle 13 di `D+1`, l'occorrenza non nasce e lo storico non mostra quell'anno.
  È la stessa situazione di N-04 (nessuna rete di sicurezza oltre il recupero) e non viene
  gestita.

## R-05 — Tetto di invii per esecuzione e coda nella giornata (principio II, N-03)

- **Decisione**: `MAX_SENDS_PER_RUN = 40` in `src/config.ts`. In ogni esecuzione:
  1. gli invii nuovi vengono ordinati per tipo (`giorno`, `recupero`, `pre`) e ID persona;
  2. i primi fino al tetto vengono reclamati in stato `in_invio`; quelli oltre il tetto vengono
     registrati subito in stato `fallito` con `attempts = 0` e `last_error_code = NULL`
     ("in coda");
  3. lo spazio rimasto sotto il tetto serve ai retry (righe `fallito` della stessa giornata).
  Le righe in coda seguono quindi lo stesso percorso dei retry di N-03: partono alle esecuzioni
  successive della stessa giornata e, se la giornata finisce, vengono abbandonate.
- **Motivazione**: con 3 chiamate D1 fisse e al massimo 40 `sendMessage` un'esecuzione non supera
  mai 43 subrequest, anche in un caso patologico (200 compleanni nello stesso giorno). Le righe
  in coda sono già registrate, quindi N-02 resta garantito dall'indice unico.
- **Impatto funzionale**: oltre 40 messaggi nella stessa ora gli eccedenti arrivano all'ora
  successiva. Con ~200 persone il caso realistico peggiore resta sotto il tetto (R-09). È una
  deviazione da N-01 imposta dal limite di piattaforma: segnalata nel piano.
- **Alternative scartate**: nessun tetto (un giorno affollato supera 50 subrequest e l'esecuzione
  fallisce per tutti, contro RNF-12); una `D1` call per invio (3 subrequest per messaggio,
  tetto effettivo ~15 messaggi).

## R-06 — Invio sequenziale con pausa

- **Decisione**: gli invii di un'esecuzione partono **in sequenza**, con una pausa di
  `SEND_INTERVAL_MS = 1000` tra un invio e il successivo (`scheduler.wait` del runtime, iniettato
  come `sleep` nelle dipendenze del ciclo; nei test è una funzione vuota). Ogni errore di
  Telegram è catturato per singolo invio (RNF-12).
- **Motivazione**: Telegram chiede di non superare circa un messaggio al secondo nella stessa chat,
  pena errori 429; la pausa non consuma CPU e 40 invii restano lontani dal limite di 15 minuti.
  La sequenza rispetta anche il limite di 6 connessioni simultanee.
- **Alternative scartate**: invii in parallelo (429 e limite di connessioni); gestione di
  `retry_after` (più codice, subrequest aggiuntive; il retry orario di N-03 basta).

## R-07 — Tre chiamate D1 per esecuzione, statement multi-riga

Struttura di `runHourly` (dettaglio in [contracts/ciclo-orario.md](contracts/ciclo-orario.md)):

| Fase | Chiamata D1 | Contenuto |
|---|---|---|
| Lettura | 1 `batch` di SELECT | messaggio di default (`settings`); persone candidate per le date di `T` con gruppi; occorrenze delle candidate per gli anni `T−1…T+1`; righe `fallito` di oggi da ritentare |
| Reclamo | 1 `batch` | chiusura *non confermato*; abbandono dei `fallito` dei giorni precedenti; `INSERT OR IGNORE` delle occorrenze; `INSERT OR IGNORE … RETURNING` degli invii nuovi; `UPDATE … WHERE status = 'fallito' RETURNING` dei retry |
| Esito | 1 `batch` | aggiornamento di ogni invio reclamato (`inviato` + `telegram_message_id` + `sent_at`, oppure `fallito` + `attempts` + `last_error_code`) |

- Gli INSERT di occorrenze e invii sono **multi-riga** (`VALUES` o `UNION ALL`) spezzati in
  blocchi da ≤ 100 parametri: con 200 invii nuovi la batch di reclamo ha ~25 statement invece di
  ~400, e il costo CPU di preparazione resta trascurabile.
- I `RETURNING` restituiscono `id, occurrence_id, kind, ref`: solo le righe effettivamente inserite
  o aggiornate vengono inviate. È questo a garantire N-02 anche con esecuzioni sovrapposte.
- Il filtro di priorità e la selezione per data avvengono in TypeScript sui risultati della lettura
  (profili solo in `config.ts`, principio VIII); la SQL filtra per `(birth_month, birth_day)`
  delle date di interesse (≤ 7 coppie, includendo 29/02 quando la data è 28/02 di un anno non
  bisestile, BR-04).
- Alle ore senza slot né pre-reminder (20 su 24) la lettura contiene solo default e retry; se non
  c'è nulla da inviare la fase Esito non avviene: 2 subrequest.
- Tutti gli statement sono scritti per non fallire riga per riga (`OR IGNORE`, condizioni
  `EXISTS`): un fallimento della batch è quindi un guasto di piattaforma (N-04), non di una
  singola persona.

## R-08 — Stati dell'invio e garanzia "al massimo una volta" (N-02, N-03)

Lo schema esiste già (`deliveries`, migration 0001). Semantica:

| Stato | Significato | Esce verso |
|---|---|---|
| `in_invio` | reclamato da un'esecuzione, invio in corso o esito non registrato | `inviato`, `fallito` (fase Esito) |
| `inviato` | Telegram ha confermato | — (finale) |
| `fallito` | errore Telegram (`attempts ≥ 1`) o in coda per il tetto (`attempts = 0`) | `in_invio` (retry nella stessa giornata), `abbandonato` (giornata finita) |
| `abbandonato` | retry esauriti | — (finale) |

- Un `in_invio` che resta tale (esecuzione interrotta tra invio e registrazione) **non viene mai
  ritentato**: si preferisce perdere un messaggio piuttosto che duplicarlo (N-02 "al massimo una
  volta"). Ai fini di BR-11 conta come possibile invio.
- Un retry è reclamato solo se l'occorrenza è ancora aperta; altrimenti diventa `abbandonato`
  (es. occorrenza chiusa da un pre-reminder nel frattempo).
- `local_date` = data locale dell'esecuzione che ha creato la riga: delimita la giornata dei retry.
- Nuovo indice `idx_deliveries_retry (local_date, status)` (migration `0002`): la ricerca dei retry
  avviene a ogni esecuzione e altrimenti scorrerebbe tutta la tabella, che cresce ogni anno.

## R-09 — Stima del caso peggiore (principio II, RNF-16, RNF-17)

**Esecuzione più carica**: le 13:00, quando coincidono pre-reminder −7, −2, −1, slot delle 13 e
recupero, più eventuali retry.

Scenari di verifica (diventano test, vedi quickstart):

| Scenario | Persone | Invii previsti | D1 | Telegram | Subrequest totali |
|---|---|---|---|---|---|
| Ora senza invii | 200 | 0 | 2 | 0 | **2** |
| Giorno tipico | 200 | 1–3 | 3 | 1–3 | **4–6** |
| Giorno realistico peggiore: 5 compleanni (Alta) su ciascuna delle 5 date rilevanti alle 13 | 200 | 25 | 3 | 25 | **28** |
| Giorno affollato: 8 compleanni (Alta) su ciascuna delle 5 date | 200 | 40 | 3 | 40 | **43** |
| Patologico: 200 compleanni lo stesso giorno, Alta, ore 9 | 200 | 200 (40 inviati, 160 in coda) | 3 | 40 | **43** |

Con ~200 persone (media 0,55 compleanni al giorno) un giorno con 5 compleanni capita in media meno
di una volta ogni dieci anni; 5 date "piene" nella stessa esecuzione sono ancora più improbabili.
Il tetto R-05 rende comunque il massimo indipendente dai dati: **≤ 43 subrequest**.

**CPU (stima per 40 invii, caso "giorno affollato")**:

| Voce | Stima |
|---|---|
| `toLocal` e calcolo date (poche chiamate `Intl`, non per persona) | < 0,1 ms |
| Materializzazione dei risultati D1 (≤ 200 righe) | ~0,3 ms |
| Pianificazione e filtro per profilo | < 0,1 ms |
| Composizione di 40 testi e tastiere (`encodeURIComponent`, ordinamento gruppi con un `Intl.Collator` di modulo) | ~0,5–1 ms |
| Preparazione delle batch (~30 statement) | ~0,3 ms |
| 40 `fetch` verso Telegram (serializzazione JSON ~1 KB, parsing della risposta) | ~2–4 ms |
| **Totale** | **~3,5–6 ms** (margine ≥ 40% su 10 ms) |

Callback Fatto/Salta: 1 batch D1 + `editMessageText` + `answerCallbackQuery` = **3 subrequest**,
CPU < 1 ms. `/messaggio`: come i flussi della feature 001, ≤ 4 subrequest per update.

**Verifica**:
1. **Subrequest** — test di integrazione deterministici con il contatore D1 e il fake Telegram già
   presenti (`test/helpers/deps.ts`), uno per scenario della tabella, con asserzione ≤ 50 (e sul
   valore esatto atteso).
2. **CPU, prima del rilascio** — benchmark Vitest (`vitest bench`, ambiente Node, nessuna nuova
   dipendenza) delle parti puramente computazionali del ciclo (pianificazione, composizione dei
   testi e delle tastiere, serializzazione dei corpi delle richieste) con 200 persone e 40 invii:
   soglia 3 ms, per lasciare margine a `fetch` e D1. Nel pool workers l'orologio è congelato
   durante l'esecuzione e non permette di misurare la CPU.
3. **CPU, dopo il rilascio** — dashboard Cloudflare → Worker → *Metrics*: percentili del CPU time
   delle invocazioni cron (nessuna configurazione aggiuntiva) e nessun esito `exceededCpu`.
   Se il p99 supera 7 ms, si abbassa `MAX_SENDS_PER_RUN`.

**Misura** (2026-10-28, Windows 11, Node v24.22.0, `npm run bench`): parti pure dell'esecuzione
delle 13 con 200 persone e 40 invii = media 0,098 ms, p99 0,17 ms per iterazione (soglia 3 ms).
Subrequest misurate dai test di `ciclo-budget`: 2 / 4 / 28 / 43 / 43, come da tabella.
CPU dei cron in produzione (Metrics, p99): *da annotare dopo il primo deploy*.

## R-09b — Limiti giornalieri di D1 (Free)

Righe lette: ~24 esecuzioni × (≤ 200 persone + occorrenze + retry indicizzati) ≈ 10–15 mila
al giorno, contro 5 milioni. Righe scritte: decine al giorno, contro 100 mila. Nessun rischio.

## R-10 — Pulsanti dei promemoria (RF-11, V-04, V-05, V-06)

- **Tipi**: `InlineKeyboardButton` diventa un'unione: `{ text, callback_data }`, `{ text, url }`,
  `{ text, copy_text: { text } }` (Bot API, `CopyTextButton`, 1–256 caratteri).
- **WhatsApp**: `https://wa.me/<cifre>?text=<messaggio>` — numero E.164 senza `+` (V-06),
  messaggio con `encodeURIComponent`.
- **Instagram**: `https://ig.me/m/<username>`; **Telegram**: `https://t.me/<username>`; username
  con `encodeURIComponent` (BR-16 non valida il formato: un URL malformato farebbe rifiutare
  l'intero messaggio da Telegram).
- **Copia messaggio**: pulsante `copy_text` con il messaggio di auguri composto (spec FR-029).
  Omesso solo se il messaggio composto supera 256 caratteri (spec Assumptions: messaggi salvati
  prima di FR-035).
- Nessun pulsante `tel:`/`sms:` (V-04); il telefono è nel testo, in forma E.164.
- **Fatto / Salta**: `callback_data` della nuova famiglia `o:` con l'ID dell'**invio**
  (`o:f:<deliveryId>`, `o:s:<deliveryId>`), vedi
  [contracts/callback-data.md](contracts/callback-data.md). L'ID dell'invio è noto prima della
  `sendMessage` grazie al `RETURNING` della fase di reclamo, e identifica occorrenza, persona,
  tipo e riferimento: basta per applicare l'esito e ricomporre il messaggio.

## R-11 — Esito da pulsante (RF-12, BR-07, BR-08, chiarimento 2026-10-28)

- **Decisione**: una sola batch D1 con:
  1. `UPDATE occurrences SET status = ?, outcome_at = ? WHERE id = (occorrenza dell'invio) AND
     (status = 'aperta' OR (? = correzione AND status IN ('saltato','non_confermato') AND
     effective_date ≥ T−7))` — la correzione è ammessa solo per Fatto premuto su un **recupero**
     (BR-08, spec FR-016);
  2. `SELECT` dei dati per ricomporre il messaggio (invio, occorrenza, persona, gruppi, esito
     dell'anno precedente, messaggio di default).
  `changes = 1` → esito applicato: `editMessageText` del solo messaggio premuto (testo ricomposto
  + riga dell'esito, tastiera di [contracts/promemoria.md](contracts/promemoria.md)), poi
  `answerCallbackQuery` senza testo. `changes = 0` con invio esistente → "Questa azione non è più
  disponibile". Invio inesistente (persona eliminata, cascata) → "Persona non trovata".
- **Ricomposizione dal database** invece che dal `message` del callback: per i messaggi vecchi
  (correzione fino a D+7) Telegram può non restituire testo e tastiera.
- La condizione nell'UPDATE rende atomico il "vale solo il primo" anche con due tocchi
  ravvicinati.
- I pulsanti `o:` **non** interrompono un flusso guidato in corso (a differenza dei pulsanti
  senza stato della feature 001): chiudere un promemoria mentre si inserisce una persona non deve
  far perdere l'inserimento.
- **Alternative scartate**: aggiornare anche gli altri messaggi dell'occorrenza (escluso dal
  chiarimento 2026-10-28; costerebbe una subrequest per messaggio).

## R-12 — Messaggio di auguri (RF-15, FR-031, FR-032, FR-035)

- **Composizione** (`src/domain/greeting.ts`, pura): personalizzato se presente, altrimenti
  `settings.default_message`, altrimenti `DEFAULT_BIRTHDAY_MESSAGE` di `config.ts`; ogni `{nome}`
  sostituito con nickname o nome completo. Nessuna età (BR-03).
- **Validazione condivisa** da `/messaggio`, inserimento e modifica: trim, non vuoto,
  `lunghezza(testo senza {nome}) + 60 × occorrenze di {nome} ≤ 256` (code point). Il limite
  `TEXT_LIMITS.customMessage` passa da 500 a 256 e si aggiunge `TEXT_LIMITS.greetingNamePlaceholder
  = 60` (= limite di nome e nickname). I test della feature 001 sul limite 500 vanno aggiornati.
- **`/messaggio`**: nuovo flusso `messaggio` nel motore della feature 001 (stato in
  `conversation_state`, `flow_id`, scadenza 24 h, Annulla). Step `testo` → step `conferma` con
  anteprima su un nome d'esempio (`T.sampleName`) e pulsanti Conferma / Annulla. Il salvataggio
  (`INSERT … ON CONFLICT(key) DO UPDATE` su `settings`) è nella stessa batch che consuma lo stato,
  con la guardia di flusso della feature 001 (R-11 di 001). Dettaglio in
  [contracts/messaggio.md](contracts/messaggio.md).

## R-13 — Storico (RF-03, RF-14)

Già implementato dalla feature 001 (`getOutcomes`, riga "Storico" della scheda, testi
`T.outcome`). Questa feature aggiunge solo i test con occorrenze reali (ordine dal più recente,
esclusione delle *aperte*). "L'anno scorso" legge lo stato dell'occorrenza `anno − 1` nella
stessa query dei candidati: compare solo con `fatto` o `saltato` (BR-09).

## R-14 — Test

- Unit (pool workers come la feature 001): pianificazione (`(T, H)` → invii attesi) con 29/02,
  cavallo d'anno e giorni del cambio d'ora (ultima domenica di marzo e di ottobre);
  `localDayStartUtc` negli stessi giorni; composizione del messaggio e validazione 256;
  rendering di pre-reminder, reminder, recupero e varianti aggiornate; `callback_data` ≤ 64 byte.
- Integrazione: `runHourly` con `scheduledAt` fisso, D1 reale (Miniflare) e fake Telegram con
  errori simulabili per chiamata (`failNext(code)`); callback `o:` tramite `handleRequest`; un file
  per user story (US1…US6) più `ciclo-idempotenza`, `ciclo-retry`, `ciclo-budget`.
- Il test della feature 001 "handler scheduled vuoto" viene sostituito.
- Benchmark CPU in `bench/` con `vitest bench` in ambiente Node (R-09): non è un test di
  requisito, non sostituisce i test nel pool workers.
