# Research: Revisioni v1.1 — Stato e statistiche

**Feature**: `007-revisioni-v1-1-stato-statistiche` | **Data**: 2026-10-29 | **Spec**: [spec.md](spec.md)

Nessun `NEEDS CLARIFICATION` aperto: le cinque domande della spec sono chiarite (sessione
2026-10-29). Qui le decisioni tecniche sul codice di 001–006.

---

## R-01 — Chiavi tecniche nella tabella `settings`

**Decisione**: due chiavi nuove, oltre alle esistenti `default_message` (dato utente),
`bot_commands` (005) e `auto_backup` (004):

| Chiave | Scritta da | Valore | `updated_at` |
|---|---|---|---|
| `cron_last_run` | `src/cron/hourly.ts` (batch di lettura) | istante ISO 8601 UTC dell'ora piena prevista, `toIso(floorToHour(scheduledAt))`, es. `2026-10-29T14:00:00.000Z` | `now()` reale della scrittura |
| `auto_backup_last` | `src/cron/backup-mensile.ts` (tramite `src/db/settings.ts`) | JSON `{"at":"<ISO UTC del reclamo>","esito":"in_invio"\|"riuscito"\|"non_riuscito"}` | `now()` reale della scrittura |

Il formato di `auto_backup` (`AAAA-MM:<stato>`, reclamo mensile di 004) **non cambia nella
forma**; si aggiunge solo lo stato `errore` (R-05).

**Motivazione**:

- `cron_last_run` come ISO UTC: confronto in millisecondi reali (cambio d'ora gestito senza
  casi speciali, R-03) e ordinamento lessicografico corretto nella condizione SQL anti-regressione.
  L'ora locale si calcola solo in visualizzazione, in `src/time.ts` (principio VI).
- `auto_backup_last` separata da `auto_backup`: in produzione `auto_backup` contiene già i mesi
  passati (004 rilasciata). Riusarla farebbe vedere subito a `/stato` un tentativo anteriore al
  deploy, contro FR-020 e l'AFU ("Impatto della versione 1.1": i dati tecnici nascono vuoti,
  `/stato` mostra "mai registrato"). Inoltre `auto_backup` è un meccanismo di reclamo (N-02) e
  conviene non mescolarlo con un dato di visualizzazione.
- `at` = istante del reclamo, uguale in tutte e due le scritture del tentativo: è la "data e ora
  del tentativo" di FR-008, indipendente da quanto dura l'invio del file.

**Alternative scartate**: riusare `auto_backup` (viola FR-020); una tabella `technical_state`
(migration, contro FR-019); `cron_last_run` in ora locale (ambigua nell'ora ripetuta del ritorno
all'ora solare).

---

## R-02 — Lettura e scrittura di `cron_last_run` (N-06, FR-004)

**Decisione**: due statement **in testa alla batch di lettura** di `runHourly`
(`readStatements` in `src/db/reminders.ts`), nell'ordine:

1. `SELECT value FROM settings WHERE key = 'cron_last_run'` → ora registrata precedente;
2. upsert anti-regressione:
   `INSERT INTO settings (key, value, updated_at) VALUES ('cron_last_run', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    WHERE excluded.value > settings.value`.

Il resto della batch (messaggio di default, candidati, occorrenze, retry) è invariato.

**Motivazione**:

- `D1.batch` è una transazione eseguita in sequenza: lettura del valore vecchio e scrittura del
  nuovo sono atomiche. Una seconda esecuzione concorrente della stessa ora legge il valore già
  scritto → nessun doppio avviso (idempotenza, N-02, principio VII).
- **0 subrequest in più**: la batch resta una sola chiamata D1.
- Registrazione "all'inizio del ciclo, prima degli invii" (chiarimento 1): un guasto durante gli
  invii lascia l'ora registrata → nessun avviso all'esecuzione successiva (FR-004).
- `WHERE excluded.value > settings.value`: una riesecuzione tardiva di un'ora già superata non
  riporta indietro il valore (e il suo confronto dà una differenza negativa → nessun avviso).
- Se la batch di lettura fallisce, nulla è registrato e il ciclo termina come oggi (`cron_error`):
  coerente, perché in quell'ora non è partito nessun invio.

**Alternative scartate**: statement separato prima della batch (+1 subrequest, non atomico con
la lettura); `RETURNING` sull'upsert (restituisce il valore nuovo, non il precedente); scrittura
in `scheduled.ts` (servirebbe una chiamata D1 in più e l'avviso finirebbe fuori dall'ordine
"prima dei promemoria").

---

## R-03 — Calcolo del buco e invio dell'avviso (N-06, FR-005…FR-007)

**Decisione**:

- Funzione pura `detectGap(lastIso: string | null, currentIso: string): { from: Date; to: Date } | null`
  in `src/domain/stato.ts`: `null` se `lastIso` è nullo o non parsabile; buco se
  `Date.parse(currentIso) − Date.parse(lastIso) > 2 h` (con ore piene: ≥ 3 h reali).
- Invio in `runHourly` **subito dopo la batch di lettura**, prima del reclamo (passo 3): un solo
  `sendMessage(ownerId, T.gapAlert(...))`, in `try/catch`; su errore `log("gap_alert", { sent: false,
  error_code })`, nessun retry, nessuna scrittura (l'ora è già aggiornata). Su successo
  `log("gap_alert", { sent: true, hours })`. Non entra in `MAX_SENDS_PER_RUN` né in
  `report.claimed`.
- Testo: `T.gapAlert(from, to, today)` in `src/texts.ts`; formattazione locale con il nuovo
  `toLocalClock()` di `src/time.ts` (R-09): "dalle 14:00 alle 19:00 di oggi" se le due date locali
  coincidono con oggi, altrimenti "dalle 23:00 del 28/10 alle 3:00 del 29/10".

**Motivazione**: differenza in millisecondi = ore reali; il cambio d'ora non genera avvisi
(1:00 → 3:00 locali = 1 h reale; le due 2:00 del ritorno all'ora solare distano 1 h reale).
Ore piene previste (`floorToHour(scheduledAt)`, già usato da `selectNew`): i ritardi di
pochi minuti della piattaforma non contano. Prima dei promemoria come da chiarimento 3.

**Idempotenza**: l'avviso dipende solo dalla coppia (valore letto, ora corrente) letta e scritta
atomicamente (R-02): riesecuzione della stessa ora → differenza 0; esecuzione dell'ora dopo →
1 h; nessuna chiave "avviso inviato" necessaria.

**Alternative scartate**: avviso in coda ai promemoria (contro chiarimento 3); retry
dell'avviso (si ripeterebbe a ogni ora, contro "un solo avviso"); confronto tra ore locali
(errato al cambio d'ora).

---

## R-04 — Invii "in invio" dell'esecuzione corrente (FR-010)

**Problema**: `deliveries` non ha l'istante del reclamo; `/stato` deve contare tra gli
abbandonati gli `in_invio` di esecuzioni precedenti e non contare quelli dell'esecuzione in corso.

**Decisione**: la colonna esistente `sent_at` (oggi `NULL` finché la riga non è `inviato`, letta
solo da `src/db/reminders.ts`) vale come **istante del reclamo finché la riga è `in_invio`**:

- `insertDeliveries(..., 'in_invio', ...)` e l'`UPDATE` dei retry scrivono `sent_at = nowIso`;
- `resultStatements`: successo → `sent_at` = istante di invio (invariato); errore →
  `sent_at = NULL` (come oggi per le righe `fallito`);
- `/stato`: un `in_invio` è "dell'esecuzione corrente" se `sent_at >= hourStartIso`, cioè l'ora
  piena di `now` (`toIso(floorToHour(now))`): reclamato nell'ora in corso; altrimenti, o con
  `sent_at` nullo (righe anteriori al deploy), è abbandonato. Non si usa `cron_last_run`: con il
  cron fermo dopo un'esecuzione interrotta, le sue righe resterebbero "correnti" a tempo
  indeterminato, contro FR-010 (analisi I1). Unico effetto residuo, trascurabile: un reclamo a
  cavallo dell'ora (es. alle 14:59:58, invio ancora in corso alle 15:00:30) compare per pochi
  secondi tra gli abbandonati.

**Motivazione**: nessuna colonna nuova (FR-019), nessuna conversione: le righe `in_invio` già in
produzione hanno `sent_at NULL` e risultano correttamente abbandonate. Le righe in coda
(`fallito`, `attempts = 0`) restano con `sent_at NULL`. La semantica di `inviato` non cambia.

**Alternative scartate**: colonna `claimed_at` (migration); convertire gli `in_invio` vecchi in
`abbandonato` nel ciclo (modifica dati esistenti, FR-021); chiave `cron_last_end` di fine ciclo
(nasconderebbe per tutta l'ora gli `in_invio` bloccati di ore precedenti della stessa giornata).

---

## R-05 — Esito del backup mensile (FR-008)

**Decisione** in `src/cron/backup-mensile.ts`:

- `claimAutoBackup` diventa una batch di 2 statement (1 subrequest come oggi): il reclamo
  esistente + `INSERT … ON CONFLICT DO UPDATE` di `auto_backup_last = {"at": nowIso, "esito":
  "in_invio"}` condizionato a `EXISTS (SELECT 1 FROM settings WHERE key = 'auto_backup' AND
  value = ? || ':in_invio' AND updated_at = ?)` (cioè solo se il reclamo è riuscito in questa
  batch). Ritorna `{ attemptIso } | null`.
- `setAutoBackupResult` diventa una batch di 2 statement (1 subrequest): stato di `auto_backup` +
  `auto_backup_last = {"at": attemptIso, "esito": "riuscito" | "non_riuscito"}`.
- `catch`: `TelegramError` → `auto_backup = AAAA-MM:fallito` (ritentato alle ore successive,
  FR-023a invariato); **ogni altro errore** → `auto_backup = AAAA-MM:errore`, **non** ritentato nel
  mese (come oggi, quando restava `in_invio`); in entrambi i casi `auto_backup_last.esito =
  "non_riuscito"` e `log("auto_backup", { sent: false, error_code })` con codice 0 per i non
  Telegram. L'eccezione non Telegram non si propaga più (il `catch` di `scheduled.ts` resta come
  difesa).
- `claimAutoBackup` esclude anche `:errore` dal riprendere (`NOT IN (':in_invio', ':inviato',
  ':errore')`).
- `/backup` su richiesta (`src/bot/backup.ts`, `sendBackup`) non scrive nulla: invariato.

**Motivazione**: chiarimento 4 (ogni errore intercettato = ❌) senza cambiare la regola di
ripetizione di 004 FR-023a e del chiarimento 2026-10-29 di 004 (i guasti non Telegram non si
ritentano). Interruzione prima dell'esito → `auto_backup_last` resta `in_invio` → `/stato`
mostra ⚠️ "esito sconosciuto".

**Se la scrittura dell'esito fallisce** (D1): `auto_backup_last` resta `in_invio` → ⚠️, la
stessa verità di un'interruzione.

---

## R-06 — Esclusione delle chiavi tecniche da `/backup` e `/ripristina` (FR-002, FR-003, FR-022)

**Decisione**: nessuna modifica di comportamento, solo test di regressione e commenti:

- `backupReadStatements` (`src/db/backup.ts`) legge le impostazioni solo con
  `defaultMessageStatement` (`key = 'default_message'`); `buildBackup` scrive
  `settings: { default_message }`. Le chiavi tecniche non possono entrare nel file.
- `restoreGuardedStatements` cancella e reinserisce solo `key = DEFAULT_MESSAGE_KEY`:
  `cron_last_run`, `auto_backup`, `auto_backup_last`, `bot_commands` restano intatte.
- `validate` (`src/domain/backup.ts`) richiede solo `settings.default_message` e ignora altre
  chiavi: un file con dati tecnici (es. `settings.cron_last_run`) è accettato e quelle chiavi sono
  ignorate (FR-003). `BACKUP_FORMAT_VERSION` invariata → backup anteriori al rilascio ripristinabili
  come prima (FR-022).
- Si aggiunge in `src/db/settings.ts` la costante `TECHNICAL_KEYS` (documentale, usata dai test)
  e il commento in `restoreGuardedStatements` è esteso alle chiavi nuove.

**Alternative scartate**: filtro esplicito per chiave in backup/ripristino (inutile: si legge e
si scrive già per chiave); nuova versione del formato (romperebbe FR-022).

---

## R-07 — `/stato`: una batch D1 + `getWebhookInfo` (RF-31, FR-009…FR-012)

**Decisione**: handler `showStato` in `src/bot/stato.ts`; query in `src/db/stato.ts`; funzioni
pure di classificazione e formattazione in `src/domain/stato.ts`.

- **D1 (1 subrequest)**, batch di 3 statement:
  1. `SELECT key, value FROM settings WHERE key IN ('cron_last_run', 'auto_backup_last')`;
  2. aggregato su `deliveries` degli ultimi 7 giorni (oggi e i 6 precedenti), raggruppato per
     `(oggi?, esito)` con l'esito calcolato in SQL:
     `inviato` → inviati; `fallito` di oggi → falliti; `abbandonato`, `fallito` di giorni
     precedenti, `in_invio` non corrente → abbandonati; `in_invio` corrente (R-04) → escluso;
  3. dettaglio degli abbandonati della finestra (stessa condizione), con
     `p.nickname, p.full_name, d.kind, d.ref, d.local_date`, `ORDER BY d.local_date, d.id`.
  I parametri sono `today`, `today − 6` e `hourStartIso` (R-04); la condizione "corrente" è
  `d.sent_at >= ?` con `hourStartIso` (NULL → falso → abbandonato), così le tre query non
  dipendono l'una dall'altra.
- **Telegram**: `getWebhookInfo` (metodo nuovo in `TelegramApi`, risultato ridotto a
  `{ pendingUpdateCount, lastErrorDate?, lastErrorMessage? }`) è l'**unica subrequest esterna oltre
  alla risposta**. Avviata in parallelo alla batch (`Promise.allSettled`); qualsiasi errore
  (`TelegramError`, rete, JSON) → riga "🔗 Webhook: non disponibile" e
  `log("webhook_info_error", { error_code })`; le altre righe compaiono comunque (FR-012). Il testo
  dell'errore del webhook va solo nella risposta, mai nei log.
- **Risposta**: `sendLines` di `src/bot/liste.ts` (oltre 4096 caratteri si divide in più messaggi;
  nel caso normale 1 messaggio).

**Indice**: nessuno nuovo. Le query 2 e 3 filtrano su `local_date BETWEEN ? AND ?`, coperto
dall'indice esistente `idx_deliveries_retry (local_date, status)` di 0002. Volume: ~200 persone ×
≤ 6 invii/anno ≈ 1.200 righe/anno, ≤ ~250 righe nella finestra anche nel caso peggiore.

**Subrequest**: 1 D1 + 1 `getWebhookInfo` + 1 `sendMessage` = **3** (più messaggi solo con
moltissimi abbandonati, comunque ≪ 50). Guardia di flusso e whitelist invariati (+ le D1 già
presenti nel router).

**Alternative scartate**: due chiamate D1 separate (+1 subrequest); conteggi in TypeScript su
tutte le righe (più CPU senza vantaggi); cache di `getWebhookInfo` (nessuno storage ammesso oltre
D1, e non serve).

---

## R-08 — `/statistiche`: aggregati SQL (RF-32, FR-013…FR-015)

**Decisione**: aggregati **in SQL**, una batch D1 (1 subrequest), formattazione in TypeScript.
Handler `showStatistiche` in `src/bot/statistiche.ts`, query in `src/db/statistiche.ts`, funzioni
pure in `src/domain/statistiche.ts`.

1. Persone: `COUNT(*)`, `SUM(priority = 'alta')`, `…'media'`, `…'bassa'`,
   `SUM(birth_year IS NULL)`, `SUM(phone IS NULL AND instagram IS NULL AND telegram IS NULL)`,
   `SUM(NOT EXISTS (SELECT 1 FROM person_groups pg WHERE pg.person_id = p.id))`;
2. Gruppi: `SELECT g.id, g.name, COUNT(pg.person_id) FROM groups g LEFT JOIN person_groups pg …
   GROUP BY g.id` → ordinati con `sortGroups` (stesso ordine dell'elenco gruppi, 005 FR-001);
3. Mesi: `SELECT birth_month, COUNT(*) FROM persons GROUP BY birth_month` (29/02 conta in
   febbraio senza casi speciali);
4. Andamento: `SELECT year, SUM(status = 'fatto'), COUNT(*) FROM occurrences WHERE status <>
   'aperta' GROUP BY year ORDER BY year DESC`; percentuale `Math.round(fatto × 100 / chiuse)`.

**Istogramma testuale**: 12 righe in un'entità `pre` (monospazio, come le liste di 003):
`<Mmm> <barra padEnd W> <conteggio padStart>`; mese abbreviato = prime 3 lettere di `MONTHS_IT`
con iniziale maiuscola; larghezza massima `STATS_BAR_WIDTH = 10` blocchi `█` (in `src/config.ts`)
assegnata al mese massimo; barra = `0` se conteggio 0, altrimenti `max(1, round(n × W / max))`.

**CPU stimata** (~200 persone, 20 gruppi, 5 anni di storico): il lavoro SQL gira in D1 e non conta
nella CPU del Worker; in TypeScript ~40 righe di risultato, un `sortGroups` su ≤ 20 nomi
(Collator già istanziato), 12 righe di istogramma e la stringa finale: **≈ 0,1–0,3 ms**. Bench
dedicato (R-10).

**Subrequest**: 1 D1 + 1 `sendMessage` = **2** (riga gruppi lunghissima → `sendLines`).

**Alternative scartate**: caricare tutte le persone e contare in TypeScript (200 righe × colonne
da deserializzare: ~1 ms, inutilmente; gli aggregati SQL sono anche più semplici da verificare
con SC-004).

---

## R-09 — Ora locale con minuti in `src/time.ts`

**Decisione**: nuova `toLocalClock(d: Date): LocalDateTime & { minute: number }` con un secondo
`Intl.DateTimeFormat` che include `minute` (sempre in `src/time.ts`, unico punto del fuso,
principio VI). `toLocal` resta invariata (usata ovunque e nei test con confronti esatti).

**Uso**: `/stato` ("oggi alle 15:00", "01/10 alle 9:00") e avviso di buco. Ora senza zero
iniziale e minuti a due cifre, come nel mockup.

---

## R-10 — Menu, `/aiuto`, test e bench

- `BOT_COMMANDS` (`src/texts.ts`): `{ command: "statistiche", description: "Statistiche della
  rubrica e andamento" }` e `{ command: "stato", description: "Salute di cron, invii, backup e
  webhook" }` (testi di AFU §5.1), dopo `anno`. Cambia l'hash → `syncBotCommands` (005 R-10)
  registra il menu alla prima esecuzione oraria senza invii dopo il deploy: **nessun passo manuale**.
- `T.help`: due righe nuove nello stesso punto.
- `COMMANDS` (`src/bot/commands.ts`): `statistiche`, `stato`. Interruzione dei flussi e whitelist
  ereditati dal router (001 FR-018, FR-027).
- Test: un test per ogni criterio di accettazione e caso limite di RF-31, RF-32, N-06 (mappa in
  [quickstart.md](quickstart.md)), unitari per `detectGap`, la classificazione, la formattazione e
  l'istogramma; integrazione in `test/integration/v11-stato.test.ts`,
  `v11-statistiche.test.ts`, `v11-buco-cron.test.ts`; regressione backup/ripristino in
  `us2-backup.test.ts`/`us2-ripristino.test.ts`; budget in `ciclo-budget.test.ts` e
  `viste-budget.test.ts`.
- Fake Telegram (`test/helpers/fake-telegram.ts`): `getWebhookInfo` con risposta configurabile o
  errore.
- Bench: `bench/ciclo.bench.ts` con `cron_last_run` presente e scenario "buco + avviso";
  `bench/stato.bench.ts` nuovo per `/stato` e `/statistiche` su 200 persone con storico.

---

## R-11 — Subrequest del Cron Trigger nel caso peggiore (principio II)

| Scenario | D1 | Telegram | Totale |
|---|---|---|---|
| Ciclo con 40 invii + avviso di buco | 3 | 40 + 1 | 44 |
| + backup mensile dovuto (reclamo, lettura, esito) | +3 | +1 | **48** |
| Ciclo senza invii + avviso + menu cambiato | 3 + 2 | 1 + 1 | 7 |
| Prima: ciclo + backup (004) | 6 | 41 | 47 |

L'avviso aggiunge al massimo **1** subrequest; le scritture di `cron_last_run` e
`auto_backup_last` viaggiano nelle batch esistenti (0 in più). La regola di `scheduled.ts` che
salta il menu quando il ciclo ha reclamato invii o il backup ha inviato resta invariata: con 48
non si somma mai il menu.

**CPU del ciclo**: `detectGap` (due `Date.parse`) + un `toLocalClock` e una stringa solo quando
c'è il buco: < 0,05 ms in più rispetto al bench di 002.
