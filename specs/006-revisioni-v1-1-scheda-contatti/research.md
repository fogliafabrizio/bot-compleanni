# Research: Revisioni v1.1 — Scheda e contatti

**Feature**: `006-revisioni-v1-1-scheda-contatti` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

Nessun punto del Technical Context è rimasto "NEEDS CLARIFICATION": le cinque domande aperte
sono state chiuse nella sessione di chiarimento della spec (2026-10-29). Qui si fissano le scelte
tecniche sul codice esistente (feature 001–005).

---

## R-01 — Modellazione di `msg.contact` (V-08, FR-008)

**Decision**: in `src/telegram/types.ts` si aggiunge l'interfaccia `Contact` con i soli campi
della Bot API che il bot legge o ignora esplicitamente:

```ts
export interface Contact {
  phone_number?: string; // nella Bot API è obbligatorio; opzionale qui per FR-009 (contatto senza numero)
  first_name?: string;   // ignorato (FR-008)
  last_name?: string;    // ignorato
  user_id?: number;      // ignorato (FR-008, US2 scenario 7)
  vcard?: string;        // ignorato (V-08)
}
```

e `contact?: Contact` in `Message`.

**Rationale**: `phone_number` è dichiarato obbligatorio dalla Bot API, ma la spec chiede un
messaggio specifico per "vuoto o assente": tenerlo opzionale costringe il typecheck a trattare il
caso. I campi ignorati sono elencati solo per documentare FR-008; nessun codice li legge.

**Alternatives considered**: tipo completo della Bot API (inutile, principio III); leggere la
vCard per gli altri numeri (escluso da V-08 e dalla spec, edge case "più numeri").

---

## R-02 — Instradamento del contatto (FR-011, RF-01)

**Decision**:

1. **Router** (`src/bot/router.ts`, `routeMessage`): dopo i rami `document` e `photo` e prima di
   `cmd`, un ramo `msg.contact`:
   - con flusso attivo → `handleFlowContact(ctx, state, msg.contact)`;
   - senza flusso → `reply(ctx, T.notUnderstood)` (spec 001 FR-025a; nessuna persona creata).
   Il controllo proprietario/chat privata resta prima (RF-30): un contatto da un estraneo è
   ignorato in silenzio come ogni altro messaggio.
2. **Motore** (`src/bot/flows/engine.ts`): `Step` riceve un hook opzionale
   `onContact?(contact: Contact, state, ctx): Promise<void>`; `handleFlowContact` chiama
   `step.onContact` se presente, altrimenti `repeatStep(ctx, state)` (ripete la domanda dello step
   con i suoi pulsanti, come FR-018b). Step sconosciuto → stesso trattamento di `handleFlowText`.
3. **Solo due step** definiscono `onContact`:
   - `nuovo.telefono` (`src/bot/flows/nuovo.ts`);
   - `modifica.valore` (`src/bot/flows/modifica.ts`), che lo gestisce **solo** se
     `data.field === "p"`; con qualunque altro campo chiama `repeatStep` (US3 scenario 3).

   Tutti gli altri step di tutti i flussi (compresi gli step di conferma, `/messaggio`, gruppi,
   import, ripristina) non lo definiscono e quindi ripetono la domanda.

**Rationale**: oggi un contatto, che non ha `text`, finisce in `handleFlowText` con
`text === undefined` e ripete già la domanda: il comportamento di FR-011 negli step "estranei" è
quindi già quello attuale, e il nuovo hook è opt-in. Nessun flusso esistente cambia.

**Alternatives considered**: convertire il contatto in testo e passarlo a `onText` (mescolerebbe
BR-15 e BR-25 e salterebbe la conferma, contro D-24); un controllo `state.step === "telefono"` nel
router (logica di flusso fuori dal motore, fragile con i nomi degli step).

---

## R-03 — Normalizzazione BR-25 separata da BR-15 (FR-009)

**Decision**: in `src/domain/phone.ts` nuova funzione pura

```ts
export function normalizeContactPhone(raw: string | undefined):
  | { ok: true; value: string }
  | { ok: false; reason: "missing" | "invalid" };
```

- `raw` assente o vuoto dopo `trim()` → `missing`;
- `plus = raw.trim().startsWith("+")`; `digits = raw.replace(/\D/g, "")` (spazi, trattini,
  parentesi, punti, lettere, estensioni: tutto scartato, chiarimento Q2);
- regole nell'ordine di BR-25: `+` → `+digits`; `00…` → `+` + resto; 9-10 cifre →
  `PHONE_DEFAULT_PREFIX + digits`; ≥ 11 cifre → `+digits`; altrimenti (< 9 cifre) `invalid`;
- validazione finale con la **stessa** regola BR-15 di `normalizePhone`, estratta in una costante
  privata del modulo (`E164_RE = /^\+\d{8,15}$/`) usata da entrambe.

`normalizePhone` (BR-15, numeri scritti a mano e import) resta **invariata** nel comportamento.

**Rationale**: le due regole divergono proprio sui casi critici (`393331234567` → BR-15 darebbe
`+39393331234567`, BR-25 `+393331234567`); una sola funzione con un flag renderebbe ambigui i
test. La regex condivisa garantisce che "valido" significhi la stessa cosa (FR-009). Il prefisso
`+39` resta in `config.ts` (principio VIII).

**Test**: `test/unit/phone.test.ts`, nuovo `describe("BR-25 …")` con `it.each` tabellare:

| Input | Atteso |
|---|---|
| `393331234567` | `+393331234567` |
| `333 1234567` | `+393331234567` |
| `+41 79 123 45 67` | `+41791234567` |
| `0041791234567` | `+41791234567` |
| `(02) 1234-5678` (10 cifre) | `+390212345678` |
| `3933312345678` | `+3933312345678` (chiarimento Q1) |
| `0212345678x12` | `+021234567812` (12 cifre → `+` + cifre, valido per BR-15; si scarta con Correggi, Q2) |
| `12345678` (8 cifre) | `invalid` |
| `+1234567` | `invalid` (BR-15) |
| `+1234567890123456` | `invalid` (BR-15) |
| `""`, `"   "`, `undefined` | `missing` |
| `abc` | `invalid` |

più un test di non regressione: `normalizePhone("393331234567")` resta `+39393331234567`
(FR-014: BR-25 vale solo per i contatti).

**Alternatives considered**: estendere `normalizePhone` con un parametro `source` (scartata, vedi
sopra); librerie come libphonenumber (vietate dal principio III, ~150 kB di bundle).

---

## R-04 — Step di conferma del numero e compatibilità con le conversazioni in corso (FR-010, FR-016)

**Decision**:

- Nuovo step `telefono_conferma` nel flusso `nuovo` e `valore_conferma` nel flusso `modifica`,
  costruiti da un helper comune `phoneConfirmStep({ correctStep, onConfirm })` in
  `src/bot/flows/steps.ts`, modellato su `dateConfirmStep`: `kind: "buttons"`, azioni `y`/`c`,
  testo `T.confirmPhone(numero)`, pulsanti [Sì] [Correggi] (+ nessun Annulla, come la conferma
  della data).
- Dati: campo opzionale `pendingPhone?: string` in `NuovoData` e `ModificaData` (stesso schema di
  `pendingDate`); con Sì lo si consuma (`nuovo`: `phone = pendingPhone`, poi `instagram`;
  `modifica`: `savePatch({ phone })` → scheda), con Correggi si torna allo step del telefono
  **senza** usarlo e lo si rimuove dai dati. Se `pendingPhone` manca (stato incoerente), Sì si
  comporta come Correggi.
- Testo o contatto durante la conferma: step a pulsanti senza `onContact` → `repeatStep`
  (chiarimento Q4, FR-011).
- `onContact` dello step telefono: `missing` → `repeatStep(ctx, state, T.contactWithoutPhone)`;
  `invalid` → `repeatStep(ctx, state, T.invalidPhone)`; `ok` → `goTo(…_conferma, { …, pendingPhone })`.

**Compatibilità al deploy**: lo stato è in `conversation_state.data` (JSON) con `step` testuale.

- Uno stato salvato prima del rilascio non può trovarsi in `telefono_conferma`/`valore_conferma`
  (non esistevano) e non ha `pendingPhone`: i nomi degli step esistenti (`telefono`, `valore`,
  `instagram`, …) **non cambiano**, quindi ogni flusso a metà prosegue e dallo step telefono in poi
  accetta anche il contatto (FR-016).
- I `callback_data` dei flussi (`f:<flowId>:<azione>[:<arg>]`) non cambiano; le azioni `y`/`c`
  sono già nel formato ammesso.
- In caso di rollback, uno stato in uno step di conferma sconosciuto al vecchio codice cade nel
  ramo "step sconosciuto" di `handleFlowText`/`handleFlowCallback` (stato cancellato, "Questa
  azione non è più disponibile"): degradazione accettabile, nessun dato scritto.

**Rationale**: stesso pattern già in produzione per la data (RF-02); un campo JSON opzionale non
richiede migration (R-06).

**Alternatives considered**: conferma come pulsanti dentro lo step `telefono` (complica `textStep` e
la ripetizione della domanda); salvare subito e offrire "Annulla" (contro D-24 e SC-004).

---

## R-05 — Tastiera della scheda con i pulsanti di contatto (FR-002…FR-006, D-27)

**Decision**:

1. In `src/bot/promemoria.ts` si estrae da `contactRows` una funzione pura esportata
   ```ts
   export function contactLinks(p: ContactFields, greeting: string | null): InlineKeyboardButton[]
   ```
   con `ContactFields = Pick<ReminderPerson, "phone" | "instagram" | "telegram">`:
   - WhatsApp: `https://wa.me/<cifre>` + `?text=<greeting>` **solo se** `greeting !== null`;
   - Instagram / Telegram: link invariati, ma solo se lo username passa `isInstagramLinkable` /
     `isTelegramLinkable` (R-07).
   `contactRows(d, layout)` diventa `contactLinks(d.person, d.greeting)` + "Copia messaggio": i
   promemoria restano identici (FR-005, FR-017) salvo l'omissione dei pulsanti con username non
   validi (FR-002, chiarimento Q5).
2. In `src/bot/scheda.ts`, `schedaKeyboard(personId, contacts, hasPending)` costruisce le righe
   nell'ordine di FR-002:
   1. `contactLinks(contacts, null)` — riga omessa se vuota (`keyboard()` scarta già le righe vuote);
   2. [Segna fatto] se `hasPending` (condizioni di 003 FR-017 invariate);
   3. [Modifica] [Elimina].
   Nessun "Copia messaggio" (FR-005).
3. **Un solo punto di costruzione**: `schedaKeyboard` è già l'unica tastiera della scheda, usata da
   `showScheda` (`/p_<id>`, `/cerca` con un risultato, dopo il salvataggio in `nuovo`, dopo ogni
   modifica in `modifica`) e da `markDone` (`editMessageText` dopo Segna fatto). Entrambi passano
   `data.person`, riletto nella stessa batch: la riga dei contatti riflette i contatti al momento
   del ridisegno (FR-003).
4. Le etichette `T.btnWhatsApp`, `T.btnInstagram`, `T.btnTelegram`, `T.btnCopy` sono già senza
   icone (FR-006): nessuna modifica, solo un test che lo fissa.

**Rationale**: riuso diretto della logica di RF-11; `promemoria.ts` è puro (nessun
`cloudflare:*`), quindi `scheda.ts` può importarlo senza effetti sul bench. Il riepilogo di
`nuovo` mantiene Salva/Annulla (spec Assumptions) e non usa `schedaKeyboard`.

**Alternatives considered**: nuova funzione di link nella scheda (duplicazione di URL e regole,
contro il principio VIII); spostare tutto in `telegram/keyboard.ts` (mescolerebbe dominio e
codifica dei `callback_data`).

---

## R-06 — Migration

**Decision**: **nessuna migration**. Schema D1 invariato: nessuna colonna, tabella o indice nuovo;
`persons.phone`, `instagram`, `telegram` restano come sono. Lo stato di conversazione acquisisce
solo il campo JSON opzionale `pendingPhone` (colonna `data` TEXT già esistente). Nessuna riga di
`settings` nuova.

**Rationale**: FR-013. Il test `test/integration/schema.test.ts` resta invariato e lo conferma.

---

## R-07 — Username validi per il link (FR-002, chiarimento Q5)

**Decision**: in `src/domain/username.ts` due predicati puri

- `isInstagramLinkable(u)`: `/^[A-Za-z0-9._]{1,30}$/`;
- `isTelegramLinkable(u)`: `/^[A-Za-z0-9_]{5,32}$/`.

Usati solo da `contactLinks`. `normalizeUsername` (BR-16) resta invariata: nessuna validazione
nuova in inserimento o modifica (la spec non la chiede) e nessuna correzione dei dati esistenti
(FR-014).

**Test**: `test/unit/username.test.ts`, tabelle di casi validi/non validi (`marco rossi`, `màrco`,
Telegram `abc`, 31 caratteri Instagram, 33 Telegram).

---

## R-08 — Testi (principio VIII, RNF-15)

Tutti in `src/texts.ts`:

| Chiave | Testo | Requisito |
|---|---|---|
| `askPhone` (modificato) | `📱 Telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎` | FR-007, §5.2 |
| `editAsk.p` (modificato) | `Nuovo telefono? Scrivilo con il prefisso (es. +39 333 1234567)\noppure condividi il contatto 📎` | FR-012 ("stesse regole di RF-01", che comprendono il suggerimento) |
| `confirmPhone(n)` (nuovo) | `📱 ${n}, giusto?` | FR-010 |
| `contactWithoutPhone` (nuovo) | `Questo contatto non ha un numero di telefono` | FR-009, Q3 |
| `invalidPhone` | invariato | FR-009 |
| `schedaInstagram`, `schedaTelegram` | **rimossi** (non più usati) | FR-001 |

Il resto dei testi resta fuori (RNF-19 escluso dalla spec).

---

## R-09 — Dati in produzione e messaggi già inviati (FR-014, FR-015, FR-017)

- Nessuna scrittura su `persons` al deploy; `normalizeContactPhone` è chiamata solo da `onContact`.
- Schede e promemoria già inviati non vengono toccati: Telegram conserva il vecchio testo (con
  `IG @…`/`TG @…`) e la vecchia tastiera. I loro pulsanti `p:m`, `p:x`, `p:f`, `o:*`, `t:*` hanno
  lo stesso formato e restano validi; il ridisegno dopo `p:f` usa già la nuova `schedaKeyboard`.
- Messaggio di auguri di default e personalizzati: nessun accesso in scrittura.

---

## R-10 — Budget di piattaforma (principio II)

La feature non tocca ciclo orario, import, export né backup (nessuna stima obbligatoria); per
completezza:

| Invocazione | D1 | Telegram | Totale |
|---|---|---|---|
| Contatto allo step telefono (`nuovo`) | 2 (`getActive`, `update`) | 1 | 3 |
| Sì sulla conferma (`nuovo`) | 2 | 1 + 1 answer | 4 |
| Sì sulla conferma (`modifica`) | 4 (`getActive`, `getById`, batch scrittura, batch scheda) | 1 + 1 | 6 |
| Contatto in altro step / durante la conferma | 2 | 1 | 3 |
| `/p_<id>` | invariato (2) | 1 | 3 |

CPU: `normalizeContactPhone` e due regex per username < 0,05 ms; nessuna variazione misurabile
su `bench/liste.bench.ts`.

---

## R-11 — Collection Postman

La collection di smoke test (`postman/`) simula gli `Update`: si aggiungono le richieste con
`message.contact` (allo step telefono, in altro step, fuori flusso, senza numero) e si aggiornano i
controlli della scheda (testo senza username). Versione 2.2.0 con voce di Changelog. Non è un gate
della feature (i gate restano i test Vitest).
