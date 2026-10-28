# Research — 001 Fondamenta e anagrafica

**Data**: 2026-10-28 · **Spec**: [spec.md](spec.md) · **Piano**: [plan.md](plan.md)

Ogni voce riporta decisione, motivazione e alternative scartate. Non restano punti
"NEEDS CLARIFICATION" nel Technical Context.

---

## R-01 — Runtime, linguaggio e configurazione

- **Decisione**: Cloudflare Workers, TypeScript `strict` (più `noUncheckedIndexedAccess`),
  configurazione in `wrangler.jsonc`. Worker `bot-compleanni`, `main: src/index.ts`.
  Tipi dei binding generati con `wrangler types` (`worker-configuration.d.ts`), niente
  `@cloudflare/workers-types` scritto a mano. `compatibility_date` = data corrente al momento
  dell'implementazione, non successiva a quella supportata dal `workerd` installato.
  Nessun flag `nodejs_compat`: il codice usa solo API Web (`fetch`, `crypto.subtle`, `Intl`).
- **Motivazione**: stack imposto da constitution (I, III) e AFU §10. `wrangler types` evita
  disallineamenti tra `wrangler.jsonc` e l'interfaccia `Env`.
- **Alternative scartate**: `wrangler.toml` (l'utente ha chiesto `wrangler.jsonc`); framework
  come Hono o grammY (vietati dal principio III: costano CPU e bundle senza necessità, con una
  sola route).

## R-02 — Dipendenze

Nessuna dipendenza di runtime. Dipendenze di sviluppo (giustificazione richiesta dal principio III):

| Pacchetto | Cosa risolve | Perché non basta codice proprio | Impatto CPU / bundle |
|---|---|---|---|
| `wrangler` | Dev locale, migration D1, deploy, `wrangler types` | È lo strumento ufficiale; gli script `setup-bot.ps1` / `deploy.ps1` lo usano già | Nessuno: non entra nel bundle |
| `typescript` | Typecheck `strict` (gate di chiusura 5) | — | Nessuno |
| `vitest` | Runner dei test (principio X) | Imposto dalla constitution | Nessuno |
| `@cloudflare/vitest-pool-workers` | Esegue i test dentro `workerd` con D1 reale (Miniflare) | Imposto dalla constitution; riproduce il runtime reale | Nessuno |

Nota di implementazione (2026-10-28): `@cloudflare/vitest-pool-workers` risulta deprecato e
rinominato in `@cloudflare/vitest-plugin` (stesso progetto e stessa funzione); si usa
quest'ultimo, con `vitest` 4.1.

Versioni: l'ultima stabile compatibile tra loro al momento di `npm install` (la versione di
`vitest` va scelta tra quelle supportate da `@cloudflare/vitest-pool-workers`), fissate in
`package-lock.json`.

## R-03 — Webhook e verifica della provenienza (RNF-03, FR-028)

- **Decisione**: unica route `POST /webhook`. Ordine dei controlli:
  1. path diverso da `/webhook` → `404`; metodo diverso da `POST` → `405`;
  2. header `X-Telegram-Bot-Api-Secret-Token` assente o diverso da `WEBHOOK_SECRET` → `401`
     senza corpo, **prima** di leggere il body e senza alcun accesso a D1 o a Telegram;
     confronto a tempo costante (`crypto.subtle.timingSafeEqual` dopo il controllo di
     lunghezza);
  3. body non JSON → `400`;
  4. update valido → gestione, poi sempre `200`. Un errore interno viene loggato con un codice
     (senza dati personali) e risponde comunque `200`, per evitare che Telegram ritrasmetta lo
     stesso update ripetendo effetti già avvenuti.
- **Motivazione**: il token segreto prova che la richiesta arriva da Telegram; va verificato
  prima di tutto per non consumare CPU/subrequest su richieste false.
- **Alternative scartate**: confronto con `===` (vulnerabile a timing, anche se teorico);
  rispondere `200` alle richieste senza token (nasconderebbe errori di configurazione).

## R-04 — Whitelist del proprietario (RF-29, RF-30, RNF-02)

- **Decisione**: dopo il token, il router estrae il mittente (`message.from` o
  `callback_query.from`). Ordine:
  1. messaggio di testo `/id` (anche `/id@NomeBot`) da **chiunque** → risposta con l'ID
     numerico (`from.id`) nella stessa chat;
  2. `String(from.id) !== OWNER_TELEGRAM_ID.trim()` → update ignorato: nessuna chiamata a
     Telegram (neppure `answerCallbackQuery`), nessuna lettura/scrittura D1;
  3. il proprietario viene servito solo in chat privata (`chat.type === "private"`); altrove
     l'update è ignorato (salvo `/id`), così schede e dati non finiscono in un gruppo
     (coerente con RNF-09 e principio V).
- **Motivazione**: la whitelist usa l'ID numerico, mai lo username (FR-027). Ignorare anche i
  callback estranei evita qualunque risposta osservabile.
- **Alternative scartate**: salvare l'elenco degli utenti estranei (vietato: "non salva nulla").

## R-05 — Client della Bot API

- **Decisione**: modulo `src/telegram/client.ts` basato su `fetch` verso
  `https://api.telegram.org/bot<TOKEN>/<metodo>`, con i soli metodi necessari:
  `sendMessage`, `editMessageReplyMarkup`, `answerCallbackQuery`. Il client è un'interfaccia
  (`TelegramApi`) iniettata nelle dipendenze: in produzione l'implementazione `fetch`, nei test
  un fake che registra le chiamate (nessuna rete reale, principio X). Testo semplice (nessun
  `parse_mode`): niente escaping HTML/Markdown, nessun rischio di iniezione dai nomi inseriti;
  i comandi `/p_<id>` restano cliccabili. Errori HTTP/`ok:false` → eccezione con il solo
  `error_code` di Telegram, loggata senza contenuto del messaggio.
- **Motivazione**: principio III; i tipi dell'update sono scritti a mano nel sottoinsieme usato
  (`src/telegram/types.ts`).
- **Alternative scartate**: risposta diretta nel body del webhook (risparmia una subrequest ma
  limita a una sola azione per update e complica i test); `parse_mode: HTML` (richiede escaping
  di ogni dato utente).

## R-06 — Iniezione delle dipendenze e del "now" (principio VI)

- **Decisione**: tutte le funzioni di dominio e i flussi ricevono un oggetto
  `Deps = { db: D1Database, tg: TelegramApi, now: () => Date, ownerId: string }`.
  `src/index.ts` è l'**unico** punto che usa `new Date()` per costruire `now`; espone anche
  `handleRequest(request, deps)` che i test chiamano con un `now` fisso e il fake Telegram.
- **Motivazione**: nessuna funzione di dominio legge l'orologio; ogni scenario temporale (età,
  giorni mancanti, scadenza 24 h, anno futuro) è riproducibile.
- **Alternative scartate**: `vi.useFakeTimers` (dipende dall'orologio globale, fragile nel pool
  workers).

## R-07 — Fuso orario Europe/Rome (principio VI, BR-24)

- **Decisione**: `src/time.ts` è l'unico punto di conversione: `toLocal(now)` restituisce
  `{ year, month, day, hour }` in `Europe/Rome` con un `Intl.DateTimeFormat` creato una sola
  volta a livello di modulo (`formatToParts`). Le differenze in giorni si calcolano su date di
  calendario (`Date.UTC(y, m-1, d)`), mai su istanti, così il cambio d'ora non sposta il
  conteggio. Il fuso (`TIMEZONE`) è letto da `src/config.ts`.
- **Motivazione**: la data "oggi" per età, giorni mancanti e anno massimo (BR-02) è quella
  locale; `Intl` è disponibile in `workerd` senza dipendenze.
- **Alternative scartate**: librerie come date-fns-tz/Luxon (dipendenze non necessarie).

## R-08 — Validazione e normalizzazione dei dati inseriti

Moduli puri in `src/domain/`, condivisi da inserimento e modifica (FR-016) e riusabili
dall'import CSV futuro (BR-01).

- **Data (RF-02, BR-01, BR-02, A-07)**: input con spazi iniziali/finali rimossi, poi
  `^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$`. Giorno e mese a una o due cifre (`4/3/1994` equivale a
  `04/03/1994`: stesso formato `gg/mm/aaaa`, senza ambiguità); l'anno, se presente, deve avere
  4 cifre (`14-3-94` e `14/3/94` rifiutate). Giorno valido per il mese; `29/02` valido senza
  anno, con anno solo se bisestile. Anno in `1900..anno locale corrente`. Una data dell'anno
  corrente ma successiva a oggi (es. `25/12/2026` il 28/10/2026) è accettata: l'anno non è
  futuro (BR-02 parla di anno). Conferma in forma estesa con i mesi in italiano
  (`14 marzo 1994`, `29 febbraio`).
- **Telefono (BR-15, chiarimento)**: rimozione di spazi, punti e trattini; `00` iniziale → `+`;
  senza `+` si antepone `PHONE_DEFAULT_PREFIX` (`+39`, da `config.ts`); valido solo
  `^\+\d{8,15}$`. Salvato in forma E.164 (`+393331234567`).
- **Username (BR-16)**: spazi rimossi ai bordi, un `@` iniziale rimosso; vuoto rifiutato.
  Nessun'altra validazione (l'AFU non ne prevede).
- **Testi (FR-010a)**: spazi ai bordi rimossi, vuoto rifiutato, limiti in `config.ts`
  (nome 60, nickname 60, gruppo 30, messaggio 500). La lunghezza si conta in caratteri
  Unicode (code point, `[...s].length`), così un'emoji vale 1.
- **Chiave di confronto per duplicati (BR-14, BR-17)**: `trim()` + `toLocaleLowerCase("it-IT")`,
  salvata in una colonna `*_norm`. Calcolata in TypeScript perché `lower()` di SQLite gestisce
  solo ASCII (non `À`, `È`…).

## R-09 — Stato conversazione persistito in D1 (A-04, FR-018, FR-018a, FR-018c)

- **Decisione**: tabella `conversation_state` con una riga per chat (`chat_id` PK): `flow`,
  `step`, `flow_id`, `data` (JSON dei dati parziali), `expires_at`. Ogni interazione valida
  aggiorna `expires_at = now + 24 h` (`CONVERSATION_TTL_HOURS` in `config.ts`). In lettura,
  una riga con `expires_at <= now` è trattata come assente e cancellata (pulizia pigra): nessun
  messaggio all'utente. Ogni flusso ha un `flow_id` casuale breve (6 caratteri base36 da
  `crypto.getRandomValues`) incluso nei `callback_data` dei suoi pulsanti: se il `flow_id` del
  pulsante non coincide con quello del flusso attivo (scaduto, annullato, concluso, sostituito)
  la risposta è "Questa azione non è più disponibile". Un nuovo comando o l'avvio di un nuovo
  flusso sostituisce la riga, invalidando i pulsanti precedenti.
- **Motivazione**: il Worker non conserva memoria (AFU §8); una riga per chat è estendibile al
  multi-utente (principio IX) senza singleton impliciti. Il `flow_id` rende verificabile la
  validità di un pulsante senza salvare l'elenco dei messaggi inviati.
- **Alternative scartate**: KV o Durable Objects (vietati, principio I); stato codificato nei
  `callback_data` (non sta in 64 byte e non gestisce i passi a testo).

## R-10 — `callback_data` entro 64 byte

- **Decisione**: formato compatto `<ambito>:<azione>[:<arg>]` con soli codici ASCII brevi e ID
  numerici; dettaglio in [contracts/callback-data.md](contracts/callback-data.md). Due famiglie:
  - **senza stato** (`s:…`, `p:…`): valide in ogni momento, controllano l'esistenza della
    persona (altrimenti "Persona non trovata");
  - **di flusso** (`f:<flow_id>:…`): valide solo per il flusso attivo.
  Lunghezza massima prodotta ≈ 25 byte; un test verifica che ogni `callback_data` generato sia
  ≤ 64 byte (UTF-8).
- **Alternative scartate**: JSON nei `callback_data` (spreca byte); nomi dei gruppi nei
  `callback_data` (possono superare il limite: si usano gli ID).

## R-11 — Salvataggio atomico e protezione dal doppio tocco

- **Decisione**: il salvataggio finale (Salva, Salva comunque, Elimina → Sì, rinomina/elimina
  gruppo, modifica di un campo) avviene in un'unica `D1.batch` (transazione) che include la
  cancellazione della riga di stato **condizionata al `flow_id`**; le scritture di dominio sono
  condizionate all'esistenza di quello stato (`… WHERE EXISTS (SELECT 1 FROM
  conversation_state WHERE chat_id = ? AND flow_id = ?)`). Due tocchi ravvicinati su "Salva"
  (Telegram può consegnare update in parallelo) producono quindi una sola persona; il secondo
  riceve "Questa azione non è più disponibile". Test dedicato.
- **Motivazione**: principio II (scritture multiple con `D1.batch`); integrità senza lock.
- **Alternative scartate**: `max_connections: 1` sul webhook (protegge solo se lo script di
  setup è aggiornato e non vale in locale); deduplica per `update_id` (richiede una tabella in
  più).

## R-12 — Gruppi creati durante un flusso (RF-08 vs RF-06) — conflitto da segnalare

- **Decisione**: "➕ Nuovo gruppo" nello step Gruppi valida il nome (BR-17, limite 30) contro i
  gruppi esistenti **e** quelli già creati nel flusso, lo aggiunge ai dati parziali come gruppo
  *in attesa* e lo mostra già selezionato. Il gruppo viene scritto in D1 solo con il
  salvataggio finale (stessa batch della persona). Con Annulla, `/annulla`, un altro comando o
  la scadenza, non resta nulla.
- **Motivazione**: RF-08 dice "il gruppo viene creato e risulta già selezionato"; RF-06 dice
  che Annulla "interrompe senza salvare nulla". Creare subito il gruppo violerebbe RF-06.
  Dal punto di vista dell'utente il gruppo è creato e selezionato; la persistenza è differita.
  Il conflitto è stato segnalato al proprietario (constitution, "Fonte di verità"), che ha
  confermato questa soluzione (spec, chiarimento 2026-10-28).
- **Alternative scartate**: creazione immediata (viola RF-06).

## R-13 — Schema D1 completo fin dalla prima migration

- **Decisione**: `migrations/0001_schema_iniziale.sql` crea tutte le entità di AFU §8:
  `persons`, `groups`, `person_groups`, `occurrences`, `deliveries`, `settings`,
  `conversation_state` (dettaglio in [data-model.md](data-model.md)). Il profilo di priorità
  resta una costante in `config.ts` (AFU §7, entità configurabile solo in v2). Chiavi esterne
  con `ON DELETE CASCADE` (D1 applica le chiavi esterne per impostazione predefinita): eliminare
  una persona rimuove associazioni, occorrenze e invii (RF-05) in un solo statement. Gli ID
  usano `AUTOINCREMENT`, così l'ID di una persona eliminata non viene mai riassegnato e un
  vecchio `/p_12` risponde "Persona non trovata" invece di aprire un'altra persona. La
  migration **non** inserisce il messaggio di default: `settings` resta vuota e il valore
  iniziale arriva da `config.ts` (unico punto, principio VIII, A-06).
- **Motivazione**: richiesta esplicita di non riscrivere le migration; idempotenza N-02
  garantita a livello di DB già dallo schema (`UNIQUE(occurrence_id, kind, ref)`).
- **Alternative scartate**: una migration per feature (richiesta dell'utente di evitarlo);
  tabella per i profili (YAGNI fino a v2).

## R-14 — Test

- **Decisione**: Vitest + `@cloudflare/vitest-pool-workers`. In `vitest.config.ts` si leggono le
  migration con `readD1Migrations("migrations")` e le si passa come binding di test; un file di
  setup le applica con `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`. Binding di test con
  valori fittizi dichiarati nella config di Miniflare (es. `OWNER_TELEGRAM_ID: "1001"`,
  `WEBHOOK_SECRET: "test-secret"`, `TELEGRAM_BOT_TOKEN: "test-token"`): non sono segreti reali
  (RNF-04). Isolamento dei dati tra test con lo storage isolato del pool o, se la versione
  installata non lo offre, svuotamento delle tabelle in `beforeEach`.
  Livelli: unit (domain, time, render scheda, callback) e integrazione (update Telegram simulati
  → `handleRequest` con fake Telegram e `now` fisso → verifica di risposte e righe D1). Ogni
  `describe`/`it` cita l'ID AFU (principio XI). Gli scenari della spec diventano test 1:1.
- **Alternative scartate**: mock di `fetch` globale (meno esplicito del fake iniettato).

## R-15 — Log e privacy (principio V)

- **Decisione**: un helper `log(code, extra?)` accetta solo codici e numeri (es.
  `{ code: "tg_error", error_code: 400 }`, `{ code: "flow_expired" }`). Mai testo dei messaggi,
  nomi, telefoni, username, date. Nessuna configurazione di observability aggiuntiva: i log si
  leggono con `wrangler tail`.

## R-16 — Scelte di testo non dettagliate dall'AFU

Testi raccolti in `src/texts.ts` (RNF-15); il proprietario può cambiarli senza toccare la
logica. Scelte adottate dove spec e AFU non fissano la formulazione:

- Scheda, compleanno oggi/domani: "compie 33 anni oggi" / "compie 33 anni domani"; altrimenti
  "compie 33 anni tra N giorni" (AFU §5.6). Senza anno: "compleanno tra N giorni" (età omessa,
  FR-012).
- Scheda: telefono mostrato in forma E.164 (`+393331234567`), cliccabile in Telegram (V-04);
  l'esempio §5.6 mostra spazi solo a scopo illustrativo. Gruppi in ordine alfabetico; la parte
  "Gruppi", la riga dei contatti e il nickname si omettono se vuoti. Messaggio personalizzato
  mostrato tra virgolette; altrimenti "Messaggio: standard".
- `/annulla` fuori da un flusso: "Nessuna operazione da annullare". Dopo un annullamento:
  "Operazione annullata".
- Errore interno durante la gestione: "Si è verificato un errore, riprova" (best effort).
- Messaggi non testuali (foto, sticker…) del proprietario: trattati come testo non valido
  (ripetizione della domanda nello step corrente, oppure "Non ho capito…" fuori da un flusso).
