# Research — Revisioni v1.2: Navigazione

**Feature**: 009-revisioni-v1-2-navigazione | **Spec**: [spec.md](spec.md) | **AFU**: v1.2
(REV-008…REV-011)

Nessun punto della Technical Context era *NEEDS CLARIFICATION*: le scelte sotto risolvono le
domande di progetto aperte dalla spec (formato dei pulsanti, letture D1, punto in cui calcolare età
e conteggi) sul codice delle feature 001-008.

---

## R-01 — `callback_data` dei nuovi pulsanti: riuso dei formati esistenti

**Decisione**: nessun nuovo ambito; tre azioni nuove nell'ambito senza stato `s` e due nell'ambito
`g2`, più due riusi integrali di pulsanti già esistenti.

| Pulsante | `callback_data` | Ambito | Novità |
|---|---|---|---|
| ⬅️ Tutti i gruppi | `g2:l` | `g2` | azione nuova senza campi (come `g2:n`) |
| Senza gruppo (N) | `g2:s` | `g2` | azione nuova senza campi; N **non** è nel dato (FR-008) |
| Prossimi 90 giorni, senza filtro | `s:u` | `s` | azione nuova senza id |
| Prossimi 90 giorni, con gruppo | `g2:p:<id>:<h>:90` | `g2` | **riuso** dell'azione `p` di 005 con `giorni = 90` |
| ◀️ / ▶️ mese | `s:m:<mese>` | `s` | azione nuova, id = 1…12 |
| ◀️ / ▶️ anno | `s:y:<anno>` | `s` | azione nuova, id = anno a 4 cifre |
| ➕ Aggiungi un'altra persona | `s:n` | `s` | **riuso** di "Aggiungi persona" di `/start` (001) |

**Motivazione**:

- La clarification della spec fissa `g2` per i due pulsanti dei gruppi, con azioni senza campi.
  Il decoder di `g2` accetta già la forma "azione senza campi" (`n`): basta estendere l'elenco delle
  azioni ammesse. Le forme di `o|r|x|p` non cambiano (FR-030).
- `g2:p:<id>:<h>:<N>` fa già esattamente "lista dei prossimi N giorni filtrata sul gruppo, con
  controllo id + hash del nome al tocco": con N = 90 è [Prossimi 90 giorni] con filtro, compreso il
  gruppo scelto tra più candidati. Gruppo eliminato o rinominato → "❌ Questo gruppo non esiste più."
  + elenco gruppi (assunzione della spec, regola di 005 FR-005).
- `s:n` avvia già `/nuovo` sostituendo il flusso in corso (router: `routeStatic` → `clear` →
  `startNuovo`), non è legato a un flusso e resta valido nel tempo: è esattamente FR-022.
- L'ambito `s` accetta già `s:<azione>[:<id>]` con id `\d{1,15}`: mese e anno sono numeri e non
  richiedono modifiche al decoder; la validazione di dominio (1…12, `MIN_BIRTH_YEAR`…anno corrente)
  si fa nel gestore, al tocco.
- Un pulsante `s:*` sostituisce il flusso in corso come il comando corrispondente (spec, edge case
  "durante un flusso guidato", 001 FR-018).

**Lunghezze** (UTF-8, tutte ASCII): `g2:l` 4 · `g2:s` 4 · `s:u` 3 · `s:m:12` 6 · `s:y:2026` 8 ·
`s:n` 3 · caso peggiore `g2:p:999999999999999:zzzzzzz:90` 31 byte. Tutte ≤ 64.

**Pulsanti non validi** → `answerCallbackQuery` "❌ Questa azione non è più disponibile.":
`g2:l:<qualsiasi>`, `g2:s:<qualsiasi>` (campi in più), `s:u:<id>`, `s:m` senza id, `s:m:0`,
`s:m:13`, `s:y` senza id, `s:y:<anno>` fuori da `MIN_BIRTH_YEAR`…anno corrente al tocco, `s:y:12`
(non 4 cifre). Dettaglio in [contracts/callback-data.md](contracts/callback-data.md).

**Alternative scartate**:

- *Nuovo ambito `v` (viste)* o `g3`: richiede un ramo nuovo nel decoder e un tipo `Callback` nuovo
  senza vantaggi; un ambito `g3` romperebbe i pulsanti `g2` già in chat (contrario a FR-030).
- *Mese con anno nel dato* (`s:m:3:2027`): la spec vuole solo il mese e l'anno ricalcolato al tocco
  (FR-019, edge case "a cavallo di un cambio di mese").
- *Numero N nel dato di [Senza gruppo (N)]*: inutile, vale il numero calcolato al tocco (FR-008).
- *Pulsante nuovo `s:a` per "Aggiungi un'altra persona"*: duplicherebbe `s:n` con lo stesso
  significato.
- *Giorni nel dato di `s:u`* (`s:u:90`): la finestra allargata è una sola (90); costante in
  `src/config.ts`.

## R-02 — Conteggio "Senza gruppo" nell'elenco: una statement in più nella stessa batch

**Decisione**: nuova statement `ungroupedCountStatement` in `src/db/groups.ts`
(`SELECT COUNT(*) AS n FROM persons p WHERE NOT EXISTS (SELECT 1 FROM person_groups pg WHERE
pg.person_id = p.id)`), sempre letta **nella stessa `D1.batch`** dei gruppi con conteggio. I punti
che oggi passano l'elenco già letto a `showGroups` ricevono anche il conteggio:

| Chiamante | Oggi | v1.2 |
|---|---|---|
| `/gruppi`, `g2:l`, `replyGroupGone` senza dati | `listWithCounts` (1 `.all`) | `readGroupList` = batch [gruppi, conteggio] (1 subrequest) |
| `searchGroups`, `showProssimi` (`readGroupSearch`) | batch [gruppi, appartenenze] | batch [gruppi, appartenenze, conteggio] |
| Eliminazione gruppo (`flows/gruppi.ts`, step `elimina`) | batch con `listWithCountsStatement` | + `ungroupedCountStatement` nella stessa batch |
| Creazione gruppo | `showGroups` senza dati | invariato (legge con `readGroupList`) |

**Motivazione**: il numero delle subrequest non cambia in nessun percorso (principio II); il
conteggio dopo un'eliminazione è letto dopo la `DELETE`, nella stessa batch, quindi include le
persone rimaste senza gruppo. `person_groups` ha PK `(person_id, group_id)`: il `NOT EXISTS` usa
l'indice.

**Alternative scartate**: conteggio calcolato in TypeScript dalle appartenenze di
`groupSearchStatements` (servirebbe anche l'elenco di tutti gli id persona: una statement comunque);
colonna o tabella materializzata (vietato da FR-025, va tenuta allineata, D-31).

## R-03 — Scheda "Senza gruppo": una batch con persone e gruppi

**Decisione**: il tocco `g2:s` esegue una batch [persone senza appartenenze con le colonne di
lista, gruppi con conteggio]. N = numero di righe della prima statement. N > 0 → scheda
(`showUngroupedCard`); N = 0 → `T.allGrouped` + elenco gruppi con i gruppi già letti e
`ungrouped = 0`, senza seconda andata a D1. La statement delle persone (`ungroupedPersonsStatement`)
sta in `src/db/groups.ts` e riusa `LIST_PERSON_COLUMNS`/`rowToListPerson` di `src/db/viste.ts`.

**Motivazione**: un'unica subrequest D1 copre sia la scheda sia il caso "tutte le persone hanno un
gruppo" (FR-008), compreso il caso rubrica vuota. Leggere i gruppi anche quando poi non servono costa
una statement nella stessa batch, non una subrequest.

**Formato**: stesso di `showGroupCard` (005 FR-008) con titolo `T.ungroupedCardTitle(n)`, righe
`formatRows(sortByNextBirthday(...))`, il solo [⬅️ Tutti i gruppi] sull'ultimo messaggio. La
funzione di rendering della scheda gruppo si generalizza in `renderGroupCard(title, rows,
actionRows)` usata da entrambe.

## R-04 — Elenco gruppi: rendering puro con la voce virtuale

**Decisione**: `renderGroupList(groups, opts)` riceve `opts.ungrouped?: number`; la voce compare
solo se `opts.withNew` (elenco principale) e `ungrouped > 0`. Le scelte tra più candidati
(`showGroupChoice`, `withNew: false`) non hanno mai la voce (FR-003: non si cerca per nome).

| Caso | Testo | Tastiera |
|---|---|---|
| 0 gruppi, N = 0 | `T.noGroups` | [➕ Nuovo gruppo] |
| 0 gruppi, N > 0 | `T.noGroups` | [Senza gruppo (N)] / [➕ Nuovo gruppo] |
| 1…60 gruppi | `T.groupsTitle` | gruppi a 2 colonne / [Senza gruppo (N)] se N > 0 / [➕ Nuovo gruppo] |
| > 60 gruppi | titolo, righe, `T.groupsTypeName` | [Senza gruppo (N)] se N > 0 / [➕ Nuovo gruppo] |

**V-09**: al più `GROUP_BUTTONS_MAX` (60) + 1 + 1 = **62** pulsanti; oltre 60 gruppi al più 2.
Il commento di `GROUP_BUTTONS_MAX` in `src/config.ts` passa da "61 ≤ 100" a "62 ≤ 100". Un gruppo
reale "Senza gruppo" è un gruppo come gli altri, ordinato da `sortGroups` (FR-005): nessun caso
speciale nel codice.

## R-05 — Pulsanti di passo successivo nelle viste: funzioni pure in `src/domain/viste.ts`

**Decisione**: tre funzioni pure, senza Telegram né D1, testate a unità; i gestori in
`src/bot/viste.ts` costruiscono la tastiera e la passano a `sendList`/`reply` (tastiera
sull'ultimo messaggio, già garantito da `sendLines`).

| Funzione | Firma | Regola |
|---|---|---|
| `adjacentMonths` | `(month: number) => { prev: number; next: number }` | circolare: 1 → prev 12, 12 → next 1 (FR-019) |
| `yearNavigation` | `(shown: number, currentYear: number, prevHasHistory: boolean) => { prev: number \| null; next: number \| null }` | prev = shown − 1 se `prevHasHistory`; next = shown + 1 se shown < currentYear (FR-020) |
| `canWidenUpcoming` | `(days: number) => boolean` | `days < UPCOMING_WIDE_DAYS` (90) (FR-018) |

- `/prossimi`: il pulsante compare anche con lista vuota, quindi `T.upcomingNone` viene inviato con
  la tastiera. Con filtro di gruppo (`found.kind === "one"` e tocco `g2:p`) il pulsante è
  `g2:p:<id>:<nameHash(nome)>:90`; senza filtro `s:u`. `sendUpcoming` riceve il gruppo come
  `{ id, name } | null` invece del solo nome.
- `/mese`: etichette `T.btnPrevMonth(MONTHS_CAP[prev - 1])`, `T.btnNextMonth(...)`, con
  `MONTHS_CAP` = `MONTHS_IT` con l'iniziale maiuscola, definito in `src/texts.ts` come
  `MONTHS_SHORT` (assunzione della spec). Il tocco `s:m:<n>` chiama `showMese(ctx, String(n))`:
  l'anno di riferimento è ricalcolato da `referenceYear` al tocco. Vista vuota con i pulsanti.
- `/anno`: errori di argomento senza pulsanti (invariato). Il tocco `s:y:<anno>` valida con
  `parseYear(String(anno), today)`; anno non valido → "Questa azione non è più disponibile" (un anno
  diventato futuro non è possibile, edge case della spec).
- Errori di argomento (`/prossimi 400`, `/mese 13`, `/anno 2099`, gruppo inesistente): nessuna
  lista, nessun pulsante (invariato).

**Alternativa scartata**: calcolare i pulsanti nei gestori con `if` sparsi; le funzioni pure
rendono testabili da sole circolarità e condizioni (principio X).

## R-06 — Storico dell'anno precedente: quarta statement della batch di `/anno`

**Decisione**: `yearStatements(db, year)` aggiunge in coda
`SELECT EXISTS (SELECT 1 FROM occurrences WHERE year = ? AND status <> 'aperta') AS has` con
`year − 1`. La batch resta **una** subrequest. Contano solo le occorrenze chiuse (clarification
della spec), coerente con la prima statement (`status <> 'aperta'`).

**Motivazione**: zero subrequest in più; `ux_occurrences_person_year (person_id, year)` non copre
`year` come prima colonna, ma le occorrenze sono ≤ 200 per anno di storico: scansione trascurabile
lato D1, nessun costo CPU del Worker. Nessun nuovo indice (niente migration, FR-025).

**Alternativa scartata**: leggere gli anni con storico (`SELECT DISTINCT year`) per sapere anche se
esiste un anno più vecchio: non serve, il pulsante guarda solo `anno − 1`.

## R-07 — Sezione 🧑 Età: righe da D1, calcolo in `src/domain/statistiche.ts`

**Decisione**: la batch di `/statistiche` passa da 4 a **5** statement (una subrequest):
`SELECT birth_day, birth_month, birth_year FROM persons WHERE birth_year IS NOT NULL`. Il calcolo è
in funzioni pure:

| Funzione | Regola |
|---|---|
| `isValidBirthYear(year, today)` | `MIN_BIRTH_YEAR ≤ year ≤ today.year` (BR-02); fuori → contato come "senza anno" (FR-026a) |
| `currentAge(day, month, year, today)` | `today.year − year − (oggi < effectiveDate(day, month, today.year) ? 1 : 0)`, minimo 0 (BR-03 per `/statistiche`, BR-04 tramite `effectiveDate`, assunzione "età negativa → 0") |
| `ageBuckets(ages)` | 9 fasce: `0-9`…`70-79`, `80+` (indice `min(floor(age / 10), 8)`); righe dalla fascia minima alla massima con almeno una persona, intermedie a 0 (FR-012) |
| `averageAge(ages)` | `Math.round(somma / n)`: le età sono ≥ 0, quindi 0,5 va per eccesso (FR-013) |
| `ageSectionLines(ages, withoutYear)` | titolo, istogramma (riga `pre` come quello per mese) e riga finale; nessuna età → `T.statsAgeUnavailable` (FR-014) |

`withoutYear = persons.total − ages.length`: comprende `birth_year IS NULL` e anni fuori da BR-02,
senza modificare i dati. Ogni persona è una riga di `persons`: conta una volta sola anche se è in più
gruppi. La riga "Senza anno di nascita" della sezione "mancanti" di 007 resta com'è (conta solo i
`NULL`, FR-010: sezioni di 007 invariate).

**Barre**: stessa regola di `histogramLines` di 007 (massimo `STATS_BAR_WIDTH` blocchi, almeno 1 per
fascia non vuota, conteggi allineati a destra); etichette allineate a sinistra a larghezza 5
(`80+  `, `10-19`). `histogramLines` si generalizza in `barLines(labels, counts)` usata da mesi ed
età.

**Posizione**: subito dopo l'istogramma per mese, prima di "✅ Auguri fatti" (mockup §5.11).

**Costo CPU (200 persone)**: un passaggio lineare su ≤ 200 righe (confronto di date, divisione
intera, somma) + 9 righe di testo: ordine dei microsecondi, < 0,1 ms su un budget di 10 ms. Misurato
con un nuovo `bench` in `bench/stato.bench.ts` (soglia esistente del file: ≤ 2 ms per iterazione
di `/statistiche` completa).

**Alternativa scartata**: età e fasce calcolate in SQL con la data di oggi come parametro: SQL
illeggibile per BR-04 (29/02), logica non testabile a unità, nessun risparmio di subrequest.

## R-08 — Conferma del salvataggio con [➕ Aggiungi un'altra persona]

**Decisione**: `showScheda(ctx, personId, confirm?, extraRows?)` riceve righe di tastiera
aggiuntive da appendere sotto `schedaKeyboard`. Solo `save` in `src/bot/flows/nuovo.ts` passa
`[[button(T.btnAddAnother, { kind: "static", scope: "s", action: "n" })]]`. Tutti gli altri
chiamanti (`/p_<id>`, `/cerca` con un risultato, modifica, Segna fatto) restano senza (FR-021).

`src/bot/flows/steps.ts`: `duplicateStep` ("Salva comunque") chiama `opts.onConfirm`, cioè lo stesso
`save` di `nuovo.ts`: il pulsante compare anche lì senza modifiche al file (edge case della spec).
Il file resta nella lista dei moduli verificati, non modificati.

**Alternativa scartata**: flag booleano `afterSave` in `showScheda`: lega la scheda al flusso
`nuovo`; le righe extra sono generiche e la scheda non conosce chi la chiama.

## R-09 — Testi e inventario

**Decisione**: nuove chiavi in `src/texts.ts`, classificate nell'inventario eseguibile
(`test/unit/testi.test.ts`, `INVENTARIO`) con il tipo di 008 FR-004a; elenco e testi in
[contracts/testi-v12.md](contracts/testi-v12.md). Icone ammesse sui pulsanti nuovi (RNF-19,
FR-023): ◀️ ▶️ ⬅️ ➕; [Prossimi 90 giorni] e [Senza gruppo (N)] senza icona. Il test delle icone dei
pulsanti di `v11-stile.test.ts` estende l'elenco chiuso con queste quattro.

## R-10 — Dati in produzione, export e backup

**Decisione**: **nessuna migration**, nessuna conversione, nessuna scrittura nuova (AFU "Impatto
della versione 1.2", §Modello dati: "Nessuna nuova entità, nessun nuovo attributo, nessuna
migration"). "Senza gruppo" ed età sono calcolati a ogni lettura; `src/db/backup.ts`,
`src/domain/backup.ts`, `src/bot/export.ts` e l'import non si toccano: il gruppo virtuale non può
finire in export e backup perché non esiste in `groups` (FR-028). Un gruppo reale "Senza gruppo" è
una riga di `groups` come le altre (FR-027). I messaggi già inviati non si aggiornano (FR-029):
nessun `editMessage*`.

## R-11 — Budget delle subrequest (principio II)

Caso peggiore: 200 persone, flusso guidato attivo (+1 D1 per `clear` nei tocchi e nei comandi),
liste divise in messaggi da 45 righe (`LIST_MAX_LINES_PER_MESSAGE`).

| Percorso | D1 | Telegram | Totale | Prima di 009 |
|---|---|---|---|---|
| `/gruppi` (≤ 60 gruppi o > 60) | stato 1 + batch [gruppi, conteggio] 1 = 2 (+1 clear) | 1–2 messaggi | ≤ 5 | uguale (`.all` → batch) |
| Tocco `g2:l` [⬅️ Tutti i gruppi] | clear 1 + batch 1 = 2 | 1–2 + answer 1 | ≤ 5 | nuovo |
| Tocco `g2:s`, 200 persone senza gruppo | clear 1 + batch [persone, gruppi] 1 = 2 | 5 messaggi + answer 1 | 8 | nuovo |
| Tocco `g2:s` con N = 0 | 2 | avviso+elenco 1–2 + answer 1 | ≤ 5 | nuovo |
| `/anno`, 200 saltati in serie | stato 1 + batch di 4 = 2 | 9 messaggi | 11 | uguale (batch di 3 → 4) |
| Tocco `s:y:<anno>` | clear 1 + batch 1 = 2 | 9 + answer 1 | 12 | nuovo |
| `/statistiche` | stato 1 + batch di 5 = 2 | 1 | 3 | uguale (batch di 4 → 5) |
| Tocco `s:u` (200 persone, 90 giorni) | clear 1 + lettura 1 = 2 | ≤ 5 + answer 1 | ≤ 8 | nuovo |
| Tocco `g2:p:…:90` | invariato (005): 2 | ≤ 5 + 1 | ≤ 8 | uguale |
| Tocco `s:m:<n>` | clear 1 + lettura 1 = 2 | ≤ 5 + answer 1 | ≤ 8 | nuovo |
| Tocco `s:n` | invariato (001) | | | uguale |

Tutti ≤ 12, ben sotto 50. Il cron orario non è toccato (nessun file in `src/cron/`).
