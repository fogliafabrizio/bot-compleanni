# Implementation Plan: Revisioni v1.1 — Scheda e contatti

**Branch**: `006-revisioni-v1-1-scheda-contatti` (cartella della feature; lavoro su `main`, nessun hook git) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-revisioni-v1-1-scheda-contatti/spec.md`

## Summary

Revisione della scheda persona e dello step Telefono già rilasciati (REV-005, REV-002 dell'AFU
v1.1): gli username escono dal testo della scheda e i contatti presenti diventano pulsanti
[WhatsApp] [Instagram] [Telegram] (WhatsApp senza testo precompilato, niente "Copia messaggio");
allo step Telefono di `/nuovo` e di Modifica → Telefono si può condividere un contatto dalla
rubrica, normalizzato con BR-25 e sempre confermato (RF-01, RF-03, RF-04, RF-11, BR-25, V-08,
D-24, D-27).

Approccio: architettura e stack di 001–005 invariati, **nessuna dipendenza nuova, nessuna
migration, nessuna conversione dei dati**.

- **Contatto in ingresso**: tipo `Contact` in `src/telegram/types.ts`; ramo `msg.contact` nel
  router → `handleFlowContact` del motore → hook opzionale `Step.onContact`, definito **solo** da
  `nuovo.telefono` e da `modifica.valore` con campo Telefono; ovunque altrove la domanda dello step
  si ripete, fuori flusso "Non ho capito" (R-01, R-02).
- **BR-25**: `normalizeContactPhone` in `src/domain/phone.ts`, separata da `normalizePhone`
  (BR-15, invariata); validazione finale con la stessa regex E.164; test tabellari (R-03).
- **Conferma**: step nuovi `telefono_conferma` (`nuovo`) e `valore_conferma` (`modifica`) da un
  helper `phoneConfirmStep` sul modello di `dateConfirmStep`, con `pendingPhone` nei dati JSON;
  nomi degli step esistenti invariati → conversazioni a metà al deploy proseguono (R-04).
- **Scheda**: `contactLinks(p, greeting | null)` estratta da `contactRows` di
  `src/bot/promemoria.ts` e riusata da `schedaKeyboard` con `greeting = null`; ordine contatti →
  Segna fatto → Modifica/Elimina; un solo punto di costruzione usato da `showScheda` e `markDone`
  (R-05). Username non validi per il link → pulsante omesso, anche nei promemoria (R-07).

Dettagli in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript `strict` + `noUncheckedIndexedAccess`, runtime `workerd` (come 001–005)

**Primary Dependencies**: nessuna di runtime; sviluppo invariato (`wrangler`, `typescript`,
`vitest`, `@cloudflare/vitest-plugin`)

**Storage**: D1 `birthday-bot-db`, schema invariato; `conversation_state.data` con il campo JSON
opzionale `pendingPhone` e due step nuovi ([data-model.md](data-model.md))

**Testing**: Vitest nel pool workers con D1 locale e fake Telegram, `now` iniettato; helper nuovo
per gli update con `contact`

**Target Platform**: Cloudflare Workers Free; webhook e Cron Trigger invariati (il cron non è
toccato)

**Project Type**: web-service (bot Telegram via webhook + cron), progetto singolo

**Performance Goals**: invariati; nuove funzioni pure < 0,05 ms di CPU per invocazione

**Constraints**: ≤ 10 ms CPU e ≤ 50 subrequest per invocazione (RNF-17, V-02); testi solo in
`src/texts.ts` (principio VIII); `callback_data` ≤ 64 byte (nessun formato nuovo)

**Scale/Scope**: ~200 persone (RNF-16); 1 vista rivista (scheda), 2 step rivisti (telefono in
`nuovo` e `modifica`), 2 step nuovi (conferme), 1 tipo di messaggio nuovo in ingresso (contatto)

## Moduli toccati

| Modulo | Modifica | Requisiti |
|---|---|---|
| `src/telegram/types.ts` | + `Contact` (`phone_number?`, campi ignorati documentati), `Message.contact?` | V-08, FR-008 |
| `src/bot/router.ts` | `routeMessage`: ramo `msg.contact` dopo `document`/`photo`, prima dei comandi: con flusso → `handleFlowContact`, senza → `T.notUnderstood` | FR-011, 001 FR-025a |
| `src/bot/flows/engine.ts` | `Step.onContact?`; + `handleFlowContact(ctx, state, contact)`: hook se presente, altrimenti `repeatStep` | FR-011, 001 FR-018b |
| `src/domain/phone.ts` | + `normalizeContactPhone` (BR-25 → BR-15, esiti `missing`/`invalid`); regex E.164 condivisa; `normalizePhone` invariata | BR-25, BR-15, FR-009, FR-014 |
| `src/domain/username.ts` | + `isInstagramLinkable`, `isTelegramLinkable`; `normalizeUsername` invariata | FR-002, Q5 |
| `src/bot/flows/steps.ts` | + `phoneConfirmStep({ correctStep, onConfirm })`; + `phoneContactHandler(confirmStep)` comune ai due flussi (salva `pendingPhone` nei dati) (missing / invalid / ok → conferma) | FR-009, FR-010, FR-012 |
| `src/bot/flows/nuovo.ts` | `NuovoData.pendingPhone?`; step `telefono` = `optionalField` + `onContact`; nuovo step `telefono_conferma` (Sì → `instagram`, Correggi → `telefono`) | RF-01, FR-007…FR-011 |
| `src/bot/flows/modifica.ts` | `ModificaData.pendingPhone?`; `valore.onContact` solo con `field === "p"`; nuovo step `valore_conferma` (Sì → `savePatch({ phone })` → scheda; Correggi → `valore`) | RF-04, FR-012 |
| `src/bot/promemoria.ts` | + `contactLinks(p, greeting \| null)` esportata; `contactRows` la usa (output invariato salvo username non validi) | RF-11, FR-004, FR-005 |
| `src/bot/scheda.ts` | `schedaLines` senza `IG`/`TG`; `schedaKeyboard(personId, contacts, hasPending)` con l'ordine di FR-002; `showScheda` e `markDone` passano `data.person` | RF-03, FR-001…FR-003 |
| `src/texts.ts` | `askPhone` e `editAsk.p` con "oppure condividi il contatto 📎"; + `confirmPhone(n)`, `contactWithoutPhone`; − `schedaInstagram`, `schedaTelegram` | FR-007, FR-009, FR-010, FR-012 |
| `test/helpers/updates.ts`, `test/helpers/send.ts` | + `contactUpdate`, `shareContact` | — |
| `postman/*` | richieste con `message.contact`, controlli della scheda, versione 2.2.0 e Changelog | research R-11 |

Non toccati: `src/db/*` (nessuna query nuova: `schedaFromResults` restituisce già i contatti),
`src/cron/*`, import/export/backup, `src/telegram/keyboard.ts`, `src/config.ts` (`PHONE_DEFAULT_PREFIX` già presente).

### Dettaglio: instradamento del contatto

```
routeMessage
 ├─ estraneo / chat non privata ─────────────▶ ignorato (RF-30)
 ├─ document / photo ────────────────────────▶ come oggi
 ├─ contact ─┬─ nessun flusso ───────────────▶ "Non ho capito…" (FR-011)
 │           └─ flusso attivo ─▶ handleFlowContact
 │                                ├─ step.onContact ─▶ nuovo.telefono | modifica.valore(p)
 │                                └─ altrimenti ─────▶ repeatStep (domanda dello step)
 ├─ comando ─────────────────────────────────▶ come oggi
 └─ testo ───────────────────────────────────▶ come oggi
```

`modifica.valore.onContact` con `field !== "p"` → `repeatStep` (US3 scenario 3).

### Dettaglio: tastiera della scheda

```
[WhatsApp] [Instagram] [Telegram]   ← contactLinks(person, null), riga omessa se vuota
[Segna fatto]                       ← solo se pending (003 FR-017)
[Modifica] [Elimina]                 ← T.btnEdit, T.btnDelete invariati (icone del mockup §5.6: ciclo stile RNF-19)
```

Chiamanti di `schedaKeyboard`: `showScheda` (`/p_<id>`, `/cerca` con un risultato, Salva in
`nuovo`, ogni salvataggio in `modifica`) e `markDone` (`editMessageText` dopo Segna fatto). Nessun
altro punto costruisce la tastiera della scheda.

## Verifica dei limiti di piattaforma *(principio II)*

La feature non tocca ciclo orario, import, export né backup: la stima obbligatoria non si applica;
riportata comunque (research R-10).

| Invocazione (caso peggiore) | D1 | Telegram | Totale |
|---|---|---|---|
| Contatto allo step telefono | 2 | 1 | 3 |
| Sì sulla conferma, `nuovo` | 2 | 2 | 4 |
| Sì sulla conferma, `modifica` (scrittura + scheda) | 4 | 2 | 6 |
| Contatto in altro step o in conferma | 2 | 1 | 3 |
| `/p_<id>`, `p:f` | invariati | invariati | ≤ 4 |

CPU: una regex e qualche operazione su stringhe per `normalizeContactPhone`; due regex per gli
username; tastiera di ≤ 6 pulsanti. Trascurabile rispetto a 10 ms; `bench/liste.bench.ts` resta
il riferimento per la scheda.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Verifica nel piano | Esito |
|---|---|---|---|
| I | Costo zero | Solo Workers, D1, Bot API; i link `wa.me`, `ig.me`, `t.me` sono URL aperti dal client, non chiamate del Worker | ✅ |
| II | Limiti Free | ≤ 6 subrequest per invocazione; nessun Cron nuovo; CPU trascurabile; nessuna scrittura multipla nuova fuori da `D1.batch` (Modifica riusa `updateFieldGuardedStatements`) | ✅ |
| III | Semplicità | Zero dipendenze (niente libphonenumber), zero migration; riuso di `contactRows` → `contactLinks`, `dateConfirmStep` come modello, `optionalField`, `savePatch`, `showScheda`; nessuna creazione di persona da contatto (fuori AFU) | ✅ |
| IV | Sicurezza | Il contatto passa dal router esistente (secret, whitelist, chat privata); nessun salvataggio senza Sì (D-24, SC-004); scritture guardate dal `flowId` | ✅ |
| V | Privacy | Nessun log del numero, del nome o della vCard del contatto; `privacy-log.test.ts` resta verde | ✅ |
| VI | Tempo | Nessuna logica di data nuova; la scheda usa `toLocal(deps.now())` come oggi | ✅ |
| VII | Affidabilità | Promemoria invariati salvo l'omissione dei pulsanti con username non validi; nessun impatto su idempotenza e retry | ✅ |
| VIII | Centralizzazione | Testi nuovi e modificati solo in `src/texts.ts`; `+39` da `PHONE_DEFAULT_PREFIX`; regex E.164 unica in `phone.ts`; URL dei contatti costruiti solo in `contactLinks` | ✅ |
| IX | Mono-proprietario | Nessun dato nuovo, nessuna unicità nuova | ✅ |
| X | Qualità e test | Un test per ogni criterio Dato/Quando/Allora v1.1 di RF-01, RF-03, RF-04, RF-11 e per ogni caso limite ([quickstart.md](quickstart.md) §3); BR-25 con test tabellari; test MVP aggiornati e verdi | ✅ |
| XI | Tracciabilità | ID AFU in research, contratto, quickstart e nomi dei test | ✅ |
| XII | Italiano | Testi e documenti in italiano | ✅ |

Vincoli: V-04 (telefono solo come testo per chiamare: resta nella scheda), V-08 (solo numero
principale), V-02 (CPU).

**Re-check post Phase 1**: confermato ✅ dopo [data-model.md](data-model.md) e
[contracts/scheda-contatti.md](contracts/scheda-contatti.md). Nessuna violazione, tabella di
complessità vuota.

### Scelte di piano da confermare

Precisano punti che la spec non fissa esplicitamente:

1. **Suggerimento del contatto anche in Modifica → Telefono**: `editAsk.p` diventa "Nuovo
   telefono? Scrivilo con il prefisso (es. +39 333 1234567) oppure condividi il contatto 📎".
   Motivo: RF-04 rimanda alle "stesse regole di RF-01", che includono il suggerimento (research
   R-08).
2. **Messaggio di numero non valido da contatto = `T.invalidPhone` esistente** ("Numero non valido.
   Scrivilo con il prefisso…"): nessun testo nuovo oltre a quello del contatto senza numero.
3. **Pulsanti [Sì] [Correggi] senza [Annulla]** nella conferma del numero, come nella conferma
   della data; `/annulla` resta disponibile.
4. **Validità degli username anche nei promemoria**: l'omissione dei pulsanti con username non
   validi vale da subito per reminder, recupero e `/oggi` (FR-002), con test di regressione.

## Dati in produzione *(FR-013…FR-017)*

- **Migration**: **non serve**. Nessuna colonna, tabella, indice o riga di `settings` nuova;
  `pendingPhone` vive nel JSON di `conversation_state.data`. `schema.test.ts` invariato.
- **Conversioni**: nessuna. Telefoni e username restano identici (SC-006); BR-25 non si applica ai
  numeri salvati; username non validi restano salvati e semplicemente non generano il pulsante.
- **Messaggi già inviati**: schede e promemoria inviati prima del rilascio **restano con il vecchio
  formato** (username nel testo, nessuna riga contatti); i loro pulsanti (`p:m`, `p:x`, `p:f`,
  `o:*`, `t:*`) hanno lo stesso formato e continuano a funzionare; ridisegnati dopo Segna fatto o
  una modifica prendono il nuovo formato.
- **Conversazioni a metà**: proseguono (step esistenti con lo stesso nome; R-04, FR-016).
- **Deploy**: `scripts/deploy.ps1` invariato (la fase migration non trova nulla da applicare).

## Test

**Da aggiornare**:

- `test/unit/scheda.test.ts` — testo senza `IG @`/`TG @`; `schedaKeyboard` con la nuova firma e
  l'ordine contatti → Segna fatto → Modifica/Elimina; riepilogo;
- `test/integration/us3-scheda.test.ts` — testo e tastiera della scheda, `p:f` e modifica con
  ridisegno;
- `test/integration/us2-inserimento.test.ts` (flusso `/nuovo`) — nuovo testo della domanda del
  telefono (righe che oggi verificano `"Telefono? (con prefisso, es. +39 333 1234567)"`);
- `test/integration/us4-modifica.test.ts` — nuovo testo di Modifica → Telefono;
- `test/unit/promemoria.test.ts` — `contactRows` invariato più username non validi.

**Nuovi** (elenco completo in [quickstart.md](quickstart.md) §2–§3):

- unitari: `normalizeContactPhone` tabellare (BR-25, SC-005), non regressione di `normalizePhone`,
  `isInstagramLinkable`/`isTelegramLinkable`, `contactLinks` con e senza `greeting`, etichette
  senza icone (FR-006);
- integrazione: un test per ciascuno dei criteri v1.1 — RF-03 (US1-1…US1-6), RF-11 (US1-2,
  US1-5, US1-7), RF-01 (US2-1…US2-7), RF-04 (US3-1…US3-4) — più i casi limite (contatto senza
  numero, secondo contatto e testo in conferma, contatto fuori flusso e in altri flussi, Sì dopo
  /annulla, estraneo, stato pre-rilascio allo step `telefono`).

**Postman**: aggiornata (versione 2.2.0) con gli update `message.contact` e i controlli della
scheda; non è un gate (research R-11).

## Project Structure

### Documentation (this feature)

```text
specs/006-revisioni-v1-1-scheda-contatti/
├── plan.md              # questo file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── scheda-contatti.md
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── telegram/types.ts            # Contact
├── domain/phone.ts              # normalizeContactPhone (BR-25)
├── domain/username.ts           # is*Linkable
├── bot/router.ts                # ramo msg.contact
├── bot/flows/engine.ts          # onContact, handleFlowContact
├── bot/flows/steps.ts           # phoneConfirmStep, phoneContactHandler
├── bot/flows/nuovo.ts           # telefono + telefono_conferma
├── bot/flows/modifica.ts        # valore(p) + valore_conferma
├── bot/promemoria.ts            # contactLinks
├── bot/scheda.ts                # testo e tastiera
└── texts.ts

test/
├── helpers/{updates,send}.ts
├── unit/{phone,username,promemoria,scheda}.test.ts
└── integration/{us2-inserimento,us3-scheda,us4-modifica,us1-reminder}.test.ts
```

**Structure Decision**: progetto singolo esistente; nessun modulo nuovo, solo estensioni dei
moduli elencati.

## Complexity Tracking

Nessuna violazione della constitution: tabella vuota.
