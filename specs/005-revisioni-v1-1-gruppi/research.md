# Research — Revisioni v1.1, Gruppi (feature 005)

Decisioni tecniche per REV-003 e REV-004 (RF-07, RF-17, RF-19, BR-26, RNF-14, V-09) sul codice
delle feature 001–004. Ogni voce: decisione, motivazione, alternative scartate.

## R-01 — Limiti che riguardano la feature

| Limite | Valore | Conseguenza |
|---|---|---|
| CPU per invocazione | 10 ms | Chiave BR-26 calcolata in TypeScript con poche regex per nome; nessun `Intl` per gruppo (R-03 di 003) |
| Subrequest per invocazione | 50 | Ogni comando o tocco di gruppo fa **una** batch D1 di lettura (più la lettura del flusso del router); rinomina ed eliminazione due batch (R-07) |
| Tastiera inline | 100 pulsanti (V-09) | Al massimo 60 pulsanti di gruppo + [➕ Nuovo gruppo] (R-06) |
| `callback_data` | 1–64 byte | Solo codici, id e hash, mai testo dell'utente (R-04) |
| Messaggio | 4096 caratteri | Scheda gruppo ed elenco testuale divisi con `splitMessage` di 003 (R-08) |

## R-02 — Chiave di ricerca dei gruppi (BR-26, FR-006)

- **Decisione**: nuova funzione pura `groupKey(s)` in `src/domain/text.ts`, costruita **sopra**
  `searchKey` di `/cerca`:
  1. le sequenze keycap (`[0-9#*]` + `U+FE0F`? + `U+20E3`, es. "1️⃣") diventano uno spazio;
  2. `searchKey(s)`: NFD, rimozione dei segni `\p{M}` (accenti, ma anche `U+FE0F` e `U+20E3`),
     minuscolo;
  3. ogni carattere che non è `\p{L}` né `\p{Nd}` diventa uno spazio
     (`/[^\p{L}\p{Nd}]+/gu → " "`): ZWJ `U+200D`, emoji, colori della pelle, indicatori regionali
     delle bandiere, tag, simboli come ★, punteggiatura, trattini;
  4. `trim()` (gli spazi consecutivi sono già uno solo grazie al `+`).

  Più `hasValidGroupKey(name) = groupKey(name).length >= GROUP_KEY_MIN_LENGTH` (FR-006a), con
  `GROUP_KEY_MIN_LENGTH = 2` in `src/config.ts` (principio VIII).
- **Compatibilità con `searchKey`**: `searchKey` è riusata così com'è, ma **non** sostituita.
  Cambiarla altererebbe `/cerca` (RF-18, fuori perimetro): "Rossi-Bianchi" cercato con "i-b"
  oggi trova la persona, con la chiave di BR-26 no. La chiave dei gruppi è un'estensione stretta:
  `groupKey(s) = compatta(searchKey(s) con i non alfanumerici a spazio)`.
- **Perché il passo keycap**: senza, "1️⃣ Calcetto" darebbe "1 calcetto", perché `U+20E3` è un
  segno (`\p{Me}`) e la cifra resterebbe; il chiarimento 2026-10-29 vuole le emoji come spazi.
- **Perché NFD e non NFKD**: è la normalizzazione di `searchKey`; NFKD cambierebbe anche "²" in
  "2" o "ﬁ" in "fi", casi che BR-26 non chiede. Lettere senza decomposizione (ø, ß, ł) restano
  lettere: sono "lettere", non vanno scartate.
- **Casi dei test unitari** (`test/unit/text.test.ts`, titoli con BR-26/FR-006/FR-006a):

  | Input | `groupKey` | Nota |
  |---|---|---|
  | `👨‍👩‍👧 Famiglia` | `famiglia` | emoji composta con ZWJ |
  | `👍🏽 Amici` | `amici` | colore della pelle |
  | `★ Calcetto 🇮🇹` | `calcetto` | simbolo e bandiera |
  | `🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scozia` | `scozia` | bandiera con tag |
  | `❤️ Cuori` | `cuori` | selettore di variante `U+FE0F` |
  | `1️⃣ Calcetto` | `calcetto` | keycap |
  | `Università` / `UNIVERSITA` | `universita` | accenti e maiuscole |
  | `Nicolò` decomposto (NFD) e composto (NFC) | `nicolo` | due forme Unicode |
  | `beach-tennis`, `Beach  tennis`, ` Beach tennis ` | `beach tennis` | punteggiatura e spazi |
  | `2024 Calcetto` | `2024 calcetto` | cifre conservate |
  | `🏖`, `★★`, `""`, `"   "` | `""` | chiave vuota |
  | `🏖 X` | `x` | chiave di 1 carattere → non valida per FR-006a |
  | `U2`, `★ Bar` | `u2`, `bar` | valide per FR-006a |
  | `Smørrebrød` | `smørrebrød` | lettera senza decomposizione conservata |

- **Alternative scartate**: modificare `searchKey` (cambia RF-18); colonna salvata con la chiave
  (serve una migration, contraria a FR-015 e all'AFU "Impatto della versione 1.1"); `\p{Emoji}`
  per togliere le emoji (contiene anche le cifre `0-9`, `#` e `*`).

## R-03 — Ricerca e ordinamento (FR-006, FR-007, FR-011)

- **Decisione**: funzione pura `findGroups(groups, query)` in `src/domain/viste.ts`:
  `k = groupKey(query)`; `k === ""` → `{ kind: "empty" }` (equivale a nessun testo); altrimenti
  `exact = groups con groupKey(name) === k`, `partial = groups con groupKey(name).includes(k)`;
  esito `one` se `exact.length === 1`, oppure se `exact.length === 0 && partial.length === 1`;
  `many` con i candidati (`exact` se più di uno, altrimenti `partial`); `none` se `partial` è
  vuoto. Un gruppo esistente con chiave vuota non è mai trovato (FR-016): è raggiungibile
  dall'elenco.
- **Ordinamento** dell'elenco e dei candidati: `sortGroups` per `groupKey(name)`, poi per
  `compareNames(name)` (il Collator unico di `text.ts`), poi per `id`. Così "👨‍👩‍👧 Famiglia" sta
  accanto a "Famiglia" (Assunzione della spec). Lo `ORDER BY name COLLATE NOCASE` di SQL non basta:
  le emoji iniziali finirebbero in fondo.
- **CPU**: 1–2 `groupKey` per gruppo (≤ ~100 gruppi realistici), poche regex su stringhe ≤ 30
  caratteri: trascurabile. Il Collator viene invocato solo sui pari chiave. Il benchmark
  `bench/liste.bench.ts` riceve un caso "ricerca gruppo con 200 persone e 100 gruppi".
- **Alternative scartate**: ricerca in SQL con `LIKE` (non toglie emoji né accenti: `lower()` di
  SQLite è solo ASCII).

## R-04 — Formato del `callback_data` dei gruppi (FR-005, FR-017)

- **Decisione**: nuovo ambito **versionato** `g2`, senza stato, con l'hash del nome mostrato:

  ```
  g2:<azione>[:<groupId>:<nameHash>[:<giorni>]]
  ```

  | Azione | Forma | Pulsante |
  |---|---|---|
  | `n` | `g2:n` | ➕ Nuovo gruppo |
  | `o` | `g2:o:<id>:<h>` | gruppo dell'elenco o della scelta di `/gruppi <testo>` → scheda |
  | `r` | `g2:r:<id>:<h>` | ✏️ Rinomina della scheda |
  | `x` | `g2:x:<id>:<h>` | 🗑 Elimina della scheda |
  | `p` | `g2:p:<id>:<h>:<giorni>` | scelta tra più gruppi di `/prossimi` |

  `nameHash` = FNV-1a a 32 bit sulle unità UTF-16 del **nome esatto** salvato, in base 36
  (1–7 caratteri `[0-9a-z]`), funzione pura `nameHash` in `src/domain/text.ts`. Caso peggiore:
  `g2:p:999999999999999:zzzzzzz:366` = **32 byte** (< 64).
- **Validazione al tocco** (FR-005): il gruppo `id` deve esistere **e** `nameHash(name) === h`.
  Altrimenti (eliminato, rinominato, anche solo nelle maiuscole) → "Il gruppo non esiste più." +
  elenco aggiornato, nessuna scrittura. L'hash distingue un cambio di sole maiuscole, che
  `name_norm` non vedrebbe. Collisione: 1 su ~4·10⁹ per rinomina, accettabile per un uso personale.
- **Pulsanti vecchi** (FR-017): `g:n`, `g:r`, `g:x` escono dal tipo `Callback` e dal decoder →
  `decodeCallback` restituisce `null` → "Questa azione non è più disponibile" (ramo già esistente
  del router). Lo step `scelta` (azione di flusso `sg`) viene rimosso e gli step del flusso
  `gruppi` cambiano nome (R-05): un pulsante di flusso vecchio, anche con il flusso ancora attivo
  al rilascio, non trova lo step → stessa risposta del motore. Nessun gruppo viene modificato.
- **Perché la versione nel prefisso**: `g` resta riconoscibile come "vecchio" senza tabelle di
  compatibilità; un futuro `g3` segue la stessa regola.
- **Alternative scartate**: nome del gruppo nel `callback_data` (testo dell'utente, fino a
  120 byte UTF-8 con le emoji, oltre il limite e contro il contratto di 001); solo l'`id` (non
  rileva la rinomina, contro il chiarimento 2026-10-29); token salvato in D1 per ogni tastiera
  (scrittura a ogni `/gruppi`, tabella nuova, migration); timestamp del deploy nel dato (non
  rileva la rinomina).

## R-05 — Flusso `gruppi`: Nuovo, Rinomina ed Elimina dalla scheda (FR-009, FR-010, FR-006a)

- **Decisione**: il flusso `gruppi` resta (nessun `FlowName` nuovo), con step rinominati:
  `crea` (testo, nome del nuovo gruppo), `rinomina` (testo, nuovo nome), `elimina` (pulsanti, Sì /
  Annulla). Gli step `nome`, `scelta`, `conferma` spariscono: uno stato salvato prima del rilascio
  non trova più lo step (testo → il motore cancella lo stato e risponde "Non ho capito"; pulsante
  → "Questa azione non è più disponibile").
- `g2:r` e `g2:x` validano id + hash (R-04) e avviano il flusso con `{ groupId, groupName }`:
  niente "Quale gruppo?".
- **Scrittura protetta**: `UPDATE`/`DELETE … WHERE id = ? AND name = ? AND <guardia di flusso>`.
  Se il gruppo è cambiato tra la domanda e la risposta, 0 righe: si distingue dal doppio tocco
  rileggendo il gruppo nella stessa batch (R-07); gruppo cambiato → "Il gruppo non esiste più." +
  elenco.
- **FR-006a**: `validateGroupName(text)` in `src/bot/flows/steps.ts` = `validateText` (vuoto,
  30 caratteri) + `hasValidGroupKey`, usata da `crea`, `rinomina` e `newGroupStep` (creazione al
  volo di `nuovo` e `modifica`). Errore → `T.groupKeyTooShort` e ripetizione della domanda.
- **Dopo la rinomina**: un nuovo messaggio con la scheda aggiornata, preceduta dalla conferma
  (`T.groupRenamed`) nello stesso messaggio, come oggi `showGroups(ctx, prefix)`. **Dopo
  l'eliminazione**: elenco aggiornato con la conferma in testa. La scheda precedente non si tocca.
- **Dopo la creazione** (`g2:n`): comportamento attuale (conferma + elenco, ora a pulsanti).

## R-06 — Elenco gruppi e limite di V-09 (FR-001…FR-004, FR-013)

- **Decisione**: `renderGroupList(groups, prefix?)` puro in `src/bot/gruppi.ts` (nuovo modulo
  di vista, R-09): ≤ 60 gruppi → titolo `T.groupsTitle` ("👥 I tuoi gruppi") e tastiera a due
  colonne di `g2:o`, etichetta `T.groupButton(name, n)` = "<nome> (<n>)", ultima riga
  [➕ Nuovo gruppo]; 0 gruppi → `T.noGroups` + solo [➕ Nuovo gruppo]; > 60 → righe testuali
  "<nome> (<n>)" + `T.groupsTypeName` (invito a `/gruppi <nome>`) e [➕ Nuovo gruppo].
  `GROUP_BUTTONS_MAX = 60` in `src/config.ts`. La stessa funzione serve la scelta tra più
  candidati (`g2:o` o `g2:p`), senza [➕ Nuovo gruppo], con l'elenco testuale oltre 60.
- **Elenco testuale lungo**: con molti gruppi si passa da `splitMessage` di 003 (R-08).

## R-07 — Accessi a D1 e subrequest (principio II)

Ogni update passa già dal router: `getActive` (1 D1). Oltre a questo:

| Interazione | D1 | Telegram | Batch |
|---|---|---|---|
| `/gruppi` | 1 | 1 | `listWithCounts` |
| `/gruppi <testo>` (`/gruppo`) | 1 | 1–5 | [gruppi con conteggi, appartenenze con le colonne della lista] |
| `/prossimi [N] <testo>` | 1 | 1–5 | stessa batch |
| tocco `g2:o` | 1 (+1 `clear`) | 1–5 + answer | [gruppo per id, persone del gruppo] |
| tocco `g2:p` | 1 (+1 `clear`) | 1–5 + answer | stessa batch di `g2:o` |
| gruppo cambiato al tocco | +1 | 1 + answer | `listWithCounts` |
| `g2:r` → domanda | 1 (+1 `clear`, +1 `start`) | 1 + answer | `getById` |
| Rinomina, risposta | 2 (+1 `update` se errore) | 1–5 | [esiste per id e nome, BR-17] poi [UPDATE guardato, consumo, gruppo, persone] |
| Elimina, conferma | 1 | 1 + answer | [conteggio] alla domanda; [DELETE guardato, consumo, gruppo per id, `listWithCounts`] al Sì |

- **Ricerca in una sola andata**: la chiave non si calcola in SQL, quindi la batch legge
  insieme i gruppi con i conteggi e tutte le appartenenze (`person_groups JOIN persons`, colonne
  di `LIST_PERSON_COLUMNS` + `group_id`); il filtro sul gruppo trovato è in TypeScript. Caso
  peggiore ~200 persone × pochi gruppi = qualche centinaio di righe, già nell'ordine delle liste
  di 003. Con esito `many`/`none` le appartenenze lette non si usano: accettato per avere una sola
  andata anche nel caso più comune (`one`).
- **Caso peggiore per update**: scheda di un gruppo con 200 persone = 1 + 2 D1 + 5 `sendMessage` +
  1 `answerCallbackQuery` ≈ **9 subrequest**; menu comandi nel cron (R-10) +3 solo quando cambia.
- **Test**: `test/integration/budget.test.ts` aggiorna la misura di `/gruppi` e aggiunge
  `/gruppi <testo>`, tocco `g2:o` su 200 persone e Rinomina; `viste-budget.test.ts` aggiunge
  `/prossimi 30 <testo>`.
- **Alternative scartate**: due andate (gruppi, poi persone del gruppo trovato): più semplice ma
  contraria al vincolo "una sola andata a D1 dove possibile".

## R-08 — Scheda gruppo (FR-008, FR-012)

- **Decisione**: `showGroupCard(ctx, group, people, prefix?)` in `src/bot/gruppi.ts`: titolo
  `T.groupCardTitle(name, n)` ("👥 Famiglia · 8 persone", "1 persona", "0 persone"), riga vuota,
  righe di `formatRows(sortByNextBirthday(...))` (003), divise con `splitMessage`; tastiera
  [✏️ Rinomina] [🗑 Elimina] (`g2:r`, `g2:x`) **solo sull'ultimo messaggio**. Gruppo vuoto:
  titolo + `T.groupCardEmpty` + tastiera.
- `sendList` di `src/bot/liste.ts` riceve un parametro opzionale `keyboard` applicato all'ultimo
  messaggio; tutte le altre liste continuano a chiamarlo senza (FR-004 di 003, RNF-14).
- Nessun pulsante di navigazione nelle righe: si naviga con `/p_<id>`.

## R-09 — Organizzazione dei moduli

- **Decisione**: nuovo modulo `src/bot/gruppi.ts` con le sole viste (elenco, scheda, ricerca),
  che non importa nulla da `src/bot/flows/*`. I tocchi `g2:*` (`handleGroupCallback`) stanno in
  `src/bot/flows/gruppi.ts`, che avvia gli step e importa le viste. `src/bot/viste.ts` perde
  `showGruppo`/`lookupGroup`/`replyGroupNotFound` e chiama le funzioni di ricerca condivise per
  `/prossimi`. `showGroups` si sposta da `flows/gruppi.ts` a `bot/gruppi.ts` (oggi è importata
  da `commands.ts`).
- **Motivazione**: dipendenze in un solo verso (router → flussi → viste → db), quindi nessun
  import circolare: il flusso dopo la rinomina mostra la scheda, e il tocco sulla scheda avvia il
  flusso dal modulo del flusso stesso. Il router importa già i flussi.

## R-10 — Menu dei comandi (`setMyCommands`, FR-014)

- **Stato attuale**: il codice non chiama `setMyCommands`; il menu non è gestito dal progetto.
- **Decisione**: elenco del menu centralizzato in `src/texts.ts` (`BOT_COMMANDS`: comando e
  descrizione, con `gruppi` = "Elenco gruppi; con un nome: cerca e apre la scheda", senza
  `gruppo`) e metodo `setMyCommands` nel client `src/telegram/client.ts`. La sincronizzazione è un
  passo isolato `syncBotCommands` dell'handler `scheduled` (dopo `runHourly` e il backup mensile,
  con il suo `try/catch`, RNF-12): legge `settings.bot_commands` (hash FNV-1a del JSON di
  `BOT_COMMANDS`, stessa `nameHash`) e, se diverso, chiama `setMyCommands` e salva l'hash.
  Il menu si aggiorna al primo cron dopo il deploy (entro un'ora) senza passi manuali.
- **Budget del cron**: per non avvicinarsi a 50 (3 D1 + 40 invii + 4 del backup mensile), il passo
  si salta se l'esecuzione oraria ha reclamato almeno un invio (`report.claimed > 0`) o se il
  backup mensile ha inviato: costo 1 D1 a vuoto, 1 D1 + 1 Telegram + 1 D1 quando cambia. Test in
  `ciclo-budget.test.ts` e uno nuovo `menu-comandi.test.ts`.
- **Alternative scartate**: passo in `scripts/deploy.ps1` (il token è un secret di Cloudflare,
  non leggibile dallo script; chiederlo a ogni deploy è scomodo); chiamata a ogni update del
  webhook (una lettura in più per ogni messaggio); BotFather a mano (non garantisce "aggiornato al
  rilascio").

## R-11 — Import CSV e ripristino (FR-006a; 004 FR-006)

- **Decisione**: in `src/domain/import.ts` la regola si applica dove i gruppi esistenti sono
  noti (`analyze…`, insieme a `groupsToCreate`): una riga che porterebbe a **creare** un gruppo
  con `hasValidGroupKey` falso diventa non valida con `T.rowReason.groupKeyTooShort(valore)`; un
  gruppo con lo stesso `name_norm` di uno esistente viene associato normalmente.
- **Ripristino da backup** (`domain/backup.ts`): **non** applica FR-006a. Il backup riporta dati
  già in produzione, che FR-016 lascia invariati anche se fuori regola.

## R-12 — Migration e dati in produzione (FR-015, FR-016, FR-017)

- **Nessuna migration**: la chiave BR-26 si calcola al momento e non si salva; `name_norm`
  (`normKey` = `trim().toLowerCase()`) resta la colonna dell'unicità BR-17, con il suo indice
  unico, invariata. `settings.bot_commands` è una nuova **riga** della tabella esistente, non una
  modifica di struttura.
- **Nessuna conversione**: nomi, `name_norm` e `person_groups` non vengono riscritti. Gruppi con
  chiave < 2 restano, sono nell'elenco e si rinominano solo con un nome conforme.
- **Messaggi vecchi**: non si modificano; i loro pulsanti rispondono "Questa azione non è più
  disponibile" (R-04, R-05).

## R-13 — Collection Postman di smoke

- **Decisione**: sì, va aggiornata (`postman/bot-compleanni.postman_collection.json`, versione
  2.1.0 nel Changelog di `postman/README.md`): cartelle 02 (testo di `/aiuto`), 04 (`/prossimi`
  con ricerca morbida, scelta `g2:p`, gruppo inesistente con elenco a pulsanti), 06 rinominata
  "06 · /gruppi <nome> (RF-19, BR-26)", 16 rinominata "16 · Gruppi (/gruppi, g2:*)" con elenco,
  scheda, Rinomina ed Elimina dalla scheda, pulsanti vecchi `g:r`/`f:…:sg` → non più disponibile.
- I pulsanti `g2` richiedono l'hash del nome: funzione `nameHash` nello script di collection
  (stesso algoritmo, verificato contro un valore fisso dei test unitari) e id letti dal D1 locale
  con l'helper. `seed-smoke.sql` aggiunge il gruppo 9203 "👨‍👩‍👧 Smoke Casa" e 9204 "Smoke Casa
  Rossi" per i casi emoji e scelta multipla, senza cambiare 9201 e 9202.
