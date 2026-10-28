# Contratto — Ciclo orario (`scheduled`)

*(N-01…N-05, RNF-10, RNF-12, RNF-17, BR-10…BR-13, BR-24; research R-02…R-09)*

## Ingresso

```ts
// src/index.ts
async scheduled(controller, env) {
  await runHourly(makeCronDeps(env), new Date(controller.scheduledTime));
}

// src/cron/hourly.ts
export interface CronDeps extends Deps {
  sleep(ms: number): Promise<void>;   // scheduler.wait in produzione, no-op nei test
}
export async function runHourly(deps: CronDeps, scheduledAt: Date): Promise<RunReport>;

export interface RunReport {        // per test e log (solo numeri, principio V)
  hour: number;
  claimed: number;                  // invii reclamati in questa esecuzione (nuovi + retry)
  queued: number;                   // nuovi registrati in coda oltre il tetto
  sent: number;
  failed: number;
  closed: number;                   // occorrenze passate a non_confermato
  abandoned: number;
}
```

Cron in `wrangler.jsonc` invariato: `"0 * * * *"` (UTC, un solo trigger, V-01).

## Algoritmo

`T, H = toLocal(scheduledAt)`; `slotInstant = scheduledAt` arrotondato all'ora;
`now = deps.now()`.

1. **Piano delle date** (`src/domain/schedule.ts`, puro):
   - `H ∈ SLOT_HOURS` → target `giorno/H` sulla data `T`;
   - `H = PRE_REMINDER_HOUR` → target `pre/N` sulla data `T+N` per ogni `N` presente in almeno
     un profilo;
   - `H = RECOVERY_HOUR` → target `recupero/13` sulla data `T−1`.
   Per ogni data target: anno, `effective_date`, coppie `(mese, giorno)` di nascita che vi cadono
   (29/02 → 28/02 negli anni non bisestili, BR-04).
2. **Lettura** — 1 `db.batch`: default message; candidati (coppie del piano ∪ persone dei retry);
   occorrenze dei candidati per gli anni `T.year−1 … T.year+1` (+ `has_day_send`); retry
   (`local_date = T`, `status = 'fallito'`).
3. **Selezione** (pura) degli invii nuovi; per ciascun candidato e target:
   - priorità ammessa dal profilo (`slots` include `H`, oppure `preReminderDays` include `N`;
     il recupero vale per tutti);
   - occorrenza dell'anno target assente o `aperta`;
   - BR-10: `created_at ≤ slotInstant`;
   - recupero, BR-11 (research R-04): `created_at < inizio(T−1)` → sempre;
     `inizio(T−1) ≤ created_at < inizio(T)` → solo con `has_day_send`; altrimenti mai.
   Ordinamento: `giorno`, `recupero`, `pre`; poi ID persona. I primi `MAX_SENDS_PER_RUN` →
   `in_invio`, gli altri → `fallito` con `attempts = 0`. Retry: fino ai posti rimasti.
4. **Reclamo** — 1 `db.batch`, in ordine:
   1. `UPDATE occurrences → non_confermato` per `aperta` con `effective_date ≤ T−2`;
   2. `UPDATE deliveries → abbandonato` per `fallito` con `local_date < T`;
   3. `UPDATE deliveries → abbandonato` per i retry di oggi la cui occorrenza non è più `aperta`;
   4. `INSERT OR IGNORE INTO occurrences` multi-riga, guardia `EXISTS (persona)`;
   5. `INSERT OR IGNORE INTO deliveries … SELECT … FROM occurrences WHERE status = 'aperta'`
      multi-riga, `RETURNING id, occurrence_id, kind, ref, status`;
   6. `UPDATE deliveries SET status = 'in_invio', attempts = attempts + 1 WHERE id IN (…) AND
      status = 'fallito' RETURNING …` per i retry scelti.
   Statement multi-riga spezzati a ≤ 100 parametri. Si inviano **solo** le righe restituite con
   `in_invio`.
5. **Invio** — per ogni riga reclamata, in sequenza, con `sleep(SEND_INTERVAL_MS)` tra due invii:
   composizione del testo e della tastiera ([promemoria.md](promemoria.md)) e `sendMessage`.
   Un'eccezione di composizione o di Telegram riguarda solo quell'invio (RNF-12): esito `fallito`
   con il codice d'errore (`0` per errori interni).
6. **Esito** — 1 `db.batch` (saltata se nessun invio è stato reclamato): per ogni invio
   `inviato` + `sent_at` + `telegram_message_id`, oppure `fallito` + `last_error_code`.
7. **Log**: `{ code: "cron_run", hour, claimed, queued, sent, failed, closed, abandoned }`.

Un'eccezione nelle fasi 2, 4 o 6 (guasto D1) interrompe l'esecuzione con un log
`cron_error`: gli invii non reclamati non partono (N-04), quelli rimasti `in_invio` non vengono
ripetuti (N-02).

## Budget per esecuzione *(principio II)*

| Fase | Subrequest |
|---|---|
| Lettura | 1 |
| Reclamo | 1 |
| Invio | ≤ `MAX_SENDS_PER_RUN` = 40 |
| Esito | 0–1 |
| **Massimo** | **43** (≤ 50) |

CPU stimata ≤ 6 ms con 40 invii; ≤ 1 ms senza invii (research R-09).

## Garanzie verificate dai test

| Garanzia | ID |
|---|---|
| Ripetere `runHourly` con lo stesso `scheduledAt` non produce nuovi `sendMessage` | N-02, SC-002 |
| Errore Telegram alle 9 → ritentato alle 10; ancora fallito a fine giornata → `abbandonato`, mai inviato il giorno dopo | N-03 |
| Nessuna esecuzione alle 9 → alle 13 lo slot delle 9 non parte | N-04 |
| Errore su una persona → le altre ricevono comunque il messaggio | RNF-12, SC-006 |
| Ultima domenica di marzo e di ottobre: slot alle ore locali corrette | BR-24, SC-008 |
| Ogni scenario della tabella di research R-09 ≤ 50 subrequest, con il valore atteso | RNF-17, principio II |
