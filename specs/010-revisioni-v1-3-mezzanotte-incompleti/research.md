# Research — Revisioni v1.3: Mezzanotte e profili incompleti

**Feature**: 010-revisioni-v1-3-mezzanotte-incompleti | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

Nessun punto NEEDS CLARIFICATION nel Technical Context: le 6 domande della sessione di clarify del
2026-11-06 hanno chiuso i casi aperti. Le decisioni sotto riguardano il "come" sul codice esistente
(feature 001-009).

---

## R-01 — Slot delle 00:00: un solo punto di verità in `src/config.ts`

**Decision**: il profilo Alta diventa `slots: [0, 9, 13, 18, 21]`; `SLOT_HOURS` non è più un
letterale ma l'unione ordinata degli slot dei profili:

```ts
export const SLOT_HOURS: readonly number[] = [...new Set(Object.values(PRIORITY_PROFILES).flatMap((p) => p.slots))].sort((a, b) => a - b);
```

(quindi `[0, 9, 13, 18, 21]`), dichiarata dopo `PRIORITY_PROFILES`. `planTargets(T, 0)` produce così
il target `giorno` con `ref = 0`; il filtro per profilo resta in `admitted` (`profile.slots.includes(t.ref)`),
per cui Media e Bassa non ricevono nulla alle 00:00 (FR-001, US1-4).

**Rationale**: oggi `[9, 13, 18, 21]` è scritto due volte (`SLOT_HOURS` e `alta.slots`): aggiungere lo
0 in un solo posto lascerebbe l'altro disallineato. Derivare `SLOT_HOURS` dai profili rispetta il
principio VIII (orari degli slot e profili in un unico punto) e prepara RF-40 (profili configurabili)
senza scriverlo. È lo stesso schema già usato per `PRE_DAYS` in `src/domain/schedule.ts`.

**Alternatives considered**: aggiungere 0 ai due letterali (duplicazione, rischio di disallineamento);
costante `MIDNIGHT_SLOT` a parte (terzo punto da tenere allineato).

---

## R-02 — Istante dello slot delle 00:00 e persone create a mezzanotte (BR-10, FR-004)

**Decision**: in `admitted` (`src/domain/schedule.ts`) il caso `giorno` diventa:

```ts
case "giorno":
  return profile.slots.includes(t.ref) && (t.ref === 0 ? c.createdAt < w.dayStartTodayIso : c.createdAt <= w.slotInstantIso);
```

Per lo slot 0 l'istante dello slot coincide con l'inizio della data effettiva (`localDayStartUtc(T)`):
la persona è ammessa solo se creata **prima** delle 00:00:00 (chiarimento 2026-11-06: creata alle
23:30 del giorno prima → parte; alle 00:00:00 o dopo → non parte, anche se l'esecuzione gira qualche
secondo dopo). Per gli altri slot la regola di 002 (`<=` sull'ora piena) resta identica.

**Rationale**: `slotInstantIso` è già l'ora piena prevista (`floorToHour(scheduledAt)`), non l'ora reale
dell'esecuzione: un'esecuzione delle 00:00 che parte alle 00:00:07 confronta comunque con 00:00:00.
L'unica differenza è il bordo esatto, che la spec definisce "creata prima di quell'istante"; usare
`dayStartTodayIso` allinea lo slot 0 alla stessa nozione di "prima di D" usata dal recupero (BR-11,
research R-04 di 002), senza toccare il comportamento di 002 sugli altri slot.

**Alternatives considered**: `<` per tutti gli slot (cambierebbe 002 al bordo, fuori perimetro);
lasciare `<=` (contraddice il chiarimento per il caso "creata alle 00:00:00").

---

## R-03 — Retry, coda, recupero e idempotenza dello slot 0: codice invariato

**Decision**: nessuna modifica a `src/cron/hourly.ts` e `src/db/reminders.ts`. Verifiche sul codice:

- **Idempotenza (N-02)**: `INSERT OR IGNORE` su `ux_deliveries_unique (occurrence_id, kind, ref)`:
  `('giorno', 0)` è una chiave distinta da `('giorno', 9)` (SC-003).
- **Retry (N-03)**: i retry sono le righe `fallito` con `local_date = oggi`; l'invio delle 00:00 ha
  `local_date` = data effettiva, quindi si ritenta dalle 1:00 fino alle 23:00 dello stesso giorno, poi
  `abbandonato` (`local_date < today`).
- **Coda (N-01)**: con più di `MAX_SENDS_PER_RUN` = 40 invii alle 00:00 `splitByCap` mette gli eccedenti
  in coda; partono alle esecuzioni successive della stessa giornata come oggi (spec 002 FR-003).
- **Recupero (BR-11)**: `has_day_send` conta qualunque invio `giorno` inviato o `in_invio`, quindi
  anche lo slot 0; il recupero delle 13:00 di D+1 segue le regole attuali.
- **Fatto / Salta (BR-07)**: chiudono l'occorrenza; `admitted` scarta ogni target se
  `occ.status !== 'aperta'`.
- **Cambio di priorità (BR-12)**: la priorità è letta a ogni esecuzione; Alta → Media dopo le 00:00
  lascia registrato l'invio 0 e ammette gli slot Media futuri.
- **Esito sconosciuto**: una riga rimasta `in_invio` non si ritenta (spec 002 FR-006).

**Rationale**: lo slot 0 è un valore in più del riferimento, il ciclo è già generico su `ref`.

**Alternatives considered**: nessuna.

---

## R-04 — Fuso orario e cambio d'ora (BR-24, principio VI)

**Decision**: il cron resta `0 * * * *` in `wrangler.toml` (un solo trigger, non toccato). L'esecuzione
delle 00:00 locali è quella delle 23:00 UTC in ora solare e delle 22:00 UTC in ora legale; `toLocal`
(unico punto di conversione, `src/time.ts`) dà già `hour = 0`. I cambi d'ora avvengono alle 2:00/3:00
e non toccano la mezzanotte. Test obbligatori in `test/unit/schedule.test.ts` e
`test/unit/time.test.ts`:

| Caso | scheduledAt (UTC) | Locale atteso |
|---|---|---|
| Inverno | 2026-01-13T23:00Z | 14/01 00:00 |
| Estate | 2026-07-13T22:00Z | 14/07 00:00 |
| Giorno del passaggio all'ora legale | 2026-03-28T23:00Z | 29/03 00:00 (CET) |
| Giorno del passaggio all'ora solare | 2026-10-24T22:00Z | 25/10 00:00 (CEST) |
| 29/02 in anno non bisestile | 2027-02-27T23:00Z | 28/02 00:00 → coppie (2,28) e (2,29) |
| 29/02 in anno bisestile | 2028-02-28T23:00Z | 29/02 00:00 → sola coppia (2,29) |

**Rationale**: BR-04 è già in `birthPairsFor`, indipendente dall'ora: basta verificarlo con `H = 0`.

**Alternatives considered**: nessuna (secondo cron vietato dal principio II).

---

## R-05 — Scrittura della mezzanotte: `clock` e `hourLabel` in `src/texts.ts`

**Decision**: in `src/texts.ts`:

```ts
// RNF-19: la mezzanotte si scrive "00:00"; le altre ore "H:MM" senza zero iniziale.
export const formatClock = (hour: number, minute: number) => `${hour === 0 ? "00" : hour}:${pad2(minute)}`;
const clock = (c: LocalClock) => formatClock(c.hour, c.minute);
```

e `statoKind` usa `` `reminder delle ${formatClock(ref, 0)}` ``. Effetti: `statoWhen`, `statoAt`,
`gapAlert` e la riga degli abbandonati passano tutti da `formatClock`. Un orario dell'ora 0 con minuti
(es. ultimo errore del webhook alle 0:37) diventa "00:37", coerente con la regola.

**Rationale**: `clock` è già l'unico formattatore degli orari (§5.10, §5.12); `statoKind` è l'unico
punto che scrive un'ora senza `clock`. Esportare `formatClock` permette il test unitario
(0 → "00:00", 9 → "9:00", 1 → "1:00", 23 → "23:00", (0, 37) → "00:37"). Nessun testo del reminder
contiene l'orario (verificato: `renderByKind` non usa `ref` per i `giorno`), quindi i reminder non
cambiano. `src/domain/stato.ts` non cambia: passa `LocalClock` e `ref` ai testi.

**Alternatives considered**: zero iniziale per tutte le ore ("01:00"), scartata nel clarify
(FR-007); formattazione in `src/domain/stato.ts` (violerebbe RNF-15, testi solo in `texts.ts`).

---

## R-06 — Regola del "dato mancante": un frammento SQL e un predicato puro

**Decision**:

- **SQL**: in `src/db/incomplete.ts` un'unica funzione `missingSql(col)` →
  `` `NULLIF(TRIM(${col}), '') IS NULL` ``, e le 5 condizioni dei filtri costruite da questa
  (`contatti` = telefono AND instagram AND telegram mancanti). `src/db/statistiche.ts` importa le
  condizioni di `anno` e `contatti` per `senza_anno` e `senza_contatti` (FR-017), così i conteggi di
  `/statistiche` e di `/incomplete` sono la stessa espressione.
- **TypeScript**: in `src/domain/incomplete.ts` `isMissing(v: string | number | null)` (null, `""` o
  solo spazi → true; un numero → false) e `matchesFilter(p, filter)`, usati per filtrare la lista.

`TRIM` su `birth_year` (INTEGER) funziona: SQLite converte il numero in testo; un `''` salvato in una
colonna INTEGER (affinità: resta testo e passa il `CHECK >= 1900`, perché in SQLite un testo è sempre
maggiore di un numero) risulta mancante, come chiede il chiarimento. Per `phone` il `CHECK GLOB '+[0-9]*'`
impedisce già vuoti e spazi: la regola si applica comunque, uguale per tutti.

**Rationale**: i conteggi si fanno in SQL (una `SELECT` aggregata, nessuna riga trasferita); la lista
legge le persone e filtra in TypeScript con il predicato puro, testabile a unità. La parità tra le due
forme è verificata da un test d'integrazione su una rubrica con `NULL`, `''` e `'   '` (SC-005).

**Alternatives considered**: lista con `WHERE` in SQL (il predicato TypeScript resterebbe solo nei test,
contro il principio III); conteggi in TypeScript (serve comunque l'SQL per `/statistiche`); conversione
dei dati anomali (vietata, FR-021).

---

## R-07 — Letture di `/incomplete`: una `SELECT` per i conteggi, una per la lista

**Decision**: in `src/db/incomplete.ts`:

- `incompleteCountsStatement(db)`: `SELECT COUNT(*) AS total, SUM(<telefono>) AS telefono, SUM(<instagram>) AS instagram, SUM(<telegram>) AS telegram, SUM(<anno>) AS anno, SUM(<contatti>) AS contatti FROM persons` (SUM su tabella vuota = NULL → 0).
- `incompletePersonsStatement(db)`: `SELECT ${LIST_PERSON_COLUMNS}, p.phone, p.instagram, p.telegram FROM persons p`
  (riusa `LIST_PERSON_COLUMNS` e `rowToListPerson` di `src/db/viste.ts`).

Il menu usa solo la prima; la lista solo la seconda (rubrica vuota = 0 righe → testo "non ci sono
persone", senza una seconda query). Ordinamento con `sortByNextBirthday` di `src/domain/viste.ts`,
righe con `formatRows` (che usa `formatListLine`), divisione con `sendList` → `splitMessage` di
`src/bot/liste.ts`: intestazione solo nel primo messaggio, righe intere, nessuna tastiera (FR-012).

**Rationale**: riuso integrale del formato §5.7 e dell'ordinamento delle viste (FR-002 di 003); una
sola andata D1 per ogni percorso.

**Alternatives considered**: una sola `SELECT` per menu e lista (il menu trasferirebbe 200 righe per
5 numeri).

---

## R-08 — Argomento di `/incomplete`

**Decision**: `parseIncompleteArg(args): { kind: "menu" } | { kind: "filter"; filter: IncompleteFilter } | { kind: "unknown" }`
in `src/domain/incomplete.ts`. `args` arriva già senza spazi ai bordi da `parseCommand`
(`/incomplete@nomebot telefono` incluso, perché `parseCommand` scarta `@nomebot`). Regole: `""` →
menu; `args.toLowerCase()` uguale a una delle 5 parole → filtro; qualsiasi altro valore (varianti,
plurali, sinonimi, più parole come `telefono famiglia`) → unknown. Con unknown il bot invia l'errore
`T.incompleteUnknown` e poi il menu, identico a `/incomplete` (due messaggi: il menu resta una sola
funzione `sendIncompleteMenu`).

**Rationale**: elenco chiuso (chiarimento 2026-11-06); nessuna normalizzazione di accenti o sinonimi.

**Alternatives considered**: errore e menu in un solo messaggio (risparmia 1 subrequest ma duplica la
composizione del menu e mescola un errore ❌ con un'intestazione 📝, contro R2 di 008).

---

## R-09 — `callback_data` dei nuovi pulsanti: ambito `s`, azione `i`

**Decision**: [📝 Profili incompleti] = `s:i`; filtri = `s:i:<n>` con `n` = codice del filtro 1…5
nell'ordine di FR-008 (1 telefono, 2 instagram, 3 telegram, 4 anno, 5 contatti). Gestore
`"s:i"` in `STATIC_CALLBACKS`: id assente → menu; `1 ≤ id ≤ 5` → lista; altrimenti
`answerCallback(ctx, T.actionUnavailable)`. Decoder invariato. Dettaglio in
[contracts/callback-data.md](contracts/callback-data.md).

**Rationale**: stesso schema di `s:m:<mese>` (009): un'azione libera (`i` non è usata: esistono
`n`, `h`, `u`, `m`, `y`), validazione al tocco, nessun nuovo ambito né versione. Il codice numerico
rientra nel `ID_RE` esistente e non contiene mai testo dell'utente (principio V). Come ogni `s:*`, il
tocco interrompe il flusso guidato in corso (FR-018 di 001), come il comando.

**Alternatives considered**: 5 azioni distinte (`s:t`, `s:g`…; consumano lettere, collisioni future);
argomento testuale nel dato (`s:i:telefono`, non passa il decoder numerico).

---

## R-10 — Pulsante in fondo a `/statistiche`

**Decision**: `showStatistiche` passa a `sendLines` la tastiera `[[📝 Profili incompleti → s:i]]`:
`sendLines` la mette già solo sull'ultimo messaggio (FR-016). Presente anche con la rubrica vuota.
Il tocco invia un nuovo messaggio uguale a `/incomplete` (stessa `sendIncompleteMenu`).

**Rationale**: riuso del meccanismo dei pulsanti di passo successivo di 009 (al più 2 per vista: qui 1).

**Alternatives considered**: nessuna.

---

## R-11 — Menu dei comandi e `/aiuto` (RF-28)

**Decision**: nuova riga in `T.help` e nuova voce in `BOT_COMMANDS` dopo `/anno` e prima di
`/statistiche`, nell'ordine di §5.1. `src/cron/comandi.ts` **non cambia**: l'hash di `BOT_COMMANDS`
cambia e il menu si registra alla prima esecuzione oraria senza invii (FR-014 di 005), senza passi
manuali. `/start` invariato.

**Rationale**: meccanismo esistente; `comandi.ts` è nel perimetro solo come verifica.

**Alternatives considered**: nessuna.

---

## R-12 — Dati in produzione e migration

**Decision**: **nessuna migration**. `deliveries.ref` è `INTEGER NOT NULL` senza `CHECK` sui valori,
quindi accetta 0; `ux_deliveries_unique (occurrence_id, kind, ref)` distingue lo slot 0. Nessuna
conversione (AFU §Modello dati v1.3, FR-021). Effetti del deploy:

- occorrenze già aperte il giorno del deploy: lo slot 0 è già passato (nessuna esecuzione delle 00:00
  rigira per ore passate), quindi nessun invio retroattivo (FR-022);
- invii registrati prima del deploy: invariati; `/stato` li formatta al momento della lettura, quindi
  un `cron_last_run` delle 00:00 compare "00:00" (FR-023);
- messaggi già inviati: nessun `editMessage*`; i vecchi `/statistiche` restano senza pulsante (FR-025);
- profili incompleti calcolati sui dati attuali, vuoti e spazi inclusi, senza toccarli (FR-024).

Export, import, backup e ripristino non cambiano (nessun campo nuovo).

---

## R-13 — Budget delle subrequest e CPU (principio II)

Caso peggiore: 200 persone, flusso guidato attivo (+1 D1 per `clear`), liste da 45 righe per
messaggio (`LIST_MAX_LINES_PER_MESSAGE`).

**Ciclo orario delle 00:00** (`planTargets(T, 0)` = solo il target `giorno` 0: nessun pre-reminder,
nessun recupero a quell'ora):

| Scenario | D1 | Telegram | Totale |
|---|---|---|---|
| Nessun Alta che compie gli anni | 2 (lettura + reclamo) | 0 | 2 |
| 1 Alta | 3 (lettura, reclamo, esiti) | 1 | 4 |
| 200 Alta lo stesso giorno | 3 | 40 (`splitByCap`, 160 in coda) | 43 |
| idem + avviso di buco | 3 | 41 | 44 |
| Caso peggiore di `runScheduled` (invariato, R-11 di 007) | 3 + 3 | 40 + 1 + 1 | 48 |

Il menu dei comandi non si somma (`syncBotCommands` salta se `claimed > 0`). Le 160 in coda partono
come retry alle 1:00, 2:00, 3:00 e 4:00 (al più 40 per esecuzione, `retryClaim` usa i posti
rimasti), tutte prima dello slot delle 9:00. CPU: invariata rispetto a un'esecuzione delle 9:00 con 200 compleanni
(`bench/ciclo.bench.ts`, scenario nuovo "00:00, 200 Alta").

**`/incomplete` e pulsanti** (webhook):

| Percorso | D1 | Telegram | Totale |
|---|---|---|---|
| `/incomplete` (menu) | stato 1 + clear 1 + conteggi 1 = 3 | 1 | 4 |
| `/incomplete email` | 3 | errore 1 + menu 1 | 5 |
| `/incomplete telefono`, 200 senza telefono | stato 1 + clear 1 + lista 1 = 3 | 5 (1 + 200 righe / 45) | 8 |
| `/incomplete anno`, lista vuota o rubrica vuota | 3 | 1 | 4 |
| Tocco `s:i` (da `/statistiche` o menu) | clear 1 + conteggi 1 = 2 | 1 + answer 1 | 4 |
| Tocco `s:i:<n>`, 200 persone | clear 1 + lista 1 = 2 | 5 + answer 1 | 8 |
| `/statistiche` con il pulsante | invariato: 2 | 1 | 3 |

Tutti ≤ 8, sotto 50. CPU `/incomplete` su 200 persone: un passaggio di filtro + `sortByNextBirthday`
+ `formatRows` + `splitMessage`, stesso ordine di `/prossimi 366` (`bench/liste.bench.ts`, < 1 ms):
nuovo scenario "`/incomplete telefono`, 200 persone" con la soglia del file.
