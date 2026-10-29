# Quickstart — Validazione delle revisioni v1.1, Scheda e contatti

**Feature**: `006-revisioni-v1-1-scheda-contatti` | Contratto: [contracts/scheda-contatti.md](contracts/scheda-contatti.md) | Modello: [data-model.md](data-model.md) | Decisioni: [research.md](research.md)

## 1. Prerequisiti e comandi

Come per 001–005: `npm install`, nessun secret reale nei test, now iniettato e Telegram simulato.

```powershell
npm run typecheck   # strict, zero errori (gate 5)
npm test            # unit + integrazione (pool workers, D1 locale)
npm run bench       # nessuna regressione su liste/scheda (principio II)
```

Nessuna migration nuova: `npm test` applica le migration esistenti e `schema.test.ts` resta verde
(FR-013).

Helper di test nuovo: `contactUpdate(fromId, phoneNumber?, extra?)` in `test/helpers/updates.ts`
e `shareContact(deps, phone?)` in `test/helpers/send.ts`.

## 2. Test unitari

| Cosa | Atteso | ID | File |
|---|---|---|---|
| `normalizeContactPhone`, tabella di research R-03 (`393331234567`, `333 1234567`, `+41 79 123 45 67`, `0041791234567`, 10 cifre con parentesi, `3933312345678`, `0212345678x12`, < 9 cifre, fuori BR-15, `abc`, vuoto, spazi, `undefined`) | numero atteso / `invalid` / `missing` | BR-25, BR-15, SC-005 | `unit/phone.test.ts` |
| `normalizePhone("393331234567")` invariato (`+39393331234567`); casi BR-15 esistenti verdi | | FR-014 | `unit/phone.test.ts` |
| `isInstagramLinkable` / `isTelegramLinkable`: validi e non validi (`marco rossi`, `màrco`, `abc`, 31/33 caratteri) | | FR-002, Q5 | `unit/username.test.ts` |
| `contactLinks(p, null)`: WhatsApp senza `?text=`; `contactLinks(p, greeting)`: con `?text=`; username non validi omessi; nessun contatto → `[]` | | RF-11, FR-004, D-27 | `unit/promemoria.test.ts` |
| `renderGiorno` / `renderRecupero` / `/oggi`: tastiere invariate (con Copia messaggio) salvo username non validi | | RF-11, FR-005, FR-017 | `unit/promemoria.test.ts` |
| Etichette WhatsApp, Instagram, Telegram, Copia messaggio senza emoji | | FR-006 | `unit/promemoria.test.ts` |
| **Da aggiornare** `renderScheda`: persona completa senza righe `IG @`/`TG @`, telefono presente; persona con soli username → nessuna riga contatti | | RF-03, FR-001 | `unit/scheda.test.ts` |
| **Da aggiornare** `schedaKeyboard`: ordine contatti → Segna fatto → Modifica/Elimina; riga contatti omessa senza contatti; solo telefono → solo WhatsApp; nessun Copia messaggio; URL esatti | | RF-03, FR-002, FR-005 | `unit/scheda.test.ts` |
| `renderRiepilogo` con il nuovo testo | | FR-001, spec Assumptions | `unit/scheda.test.ts` |

## 3. Test di integrazione — un test per ogni criterio Dato/Quando/Allora v1.1

Ogni nome di test cita l'ID AFU (principio XI).

### RF-03, RF-11 — Scheda (`integration/us3-scheda.test.ts`, da aggiornare)

| Scenario spec | Verifica |
|---|---|
| US1-1 | Telefono + Instagram: numero nel testo, [WhatsApp][Instagram] sopra [Modifica][Elimina], nessuno username nel testo |
| US1-2 | Con occorrenza aperta, URL WhatsApp della scheda senza `?text=` |
| US1-3 | Nessun contatto: prima riga = [Modifica][Elimina] |
| US1-4 | Occorrenza saltata 3 giorni fa + tutti i contatti: contatti → Segna fatto → Modifica/Elimina |
| US1-5 | Nessun pulsante `copy_text` nella scheda |
| US1-6 | Dopo `p:f` (`editMessageText`) e dopo una modifica (es. Svuota Instagram) la tastiera ha la riga contatti aggiornata |
| US1-7 | Reminder del giorno: WhatsApp con `?text=` e Copia messaggio presenti (`us1-reminder.test.ts`, regressione) |
| Edge | Username non valido salvato: pulsante assente in scheda e reminder; dopo Modifica con username valido compare |
| FR-003 | `/cerca` con un risultato e Salva in `/nuovo` mostrano la stessa tastiera |
| FR-015 | Pulsanti `p:m`, `p:x`, `p:f` di una scheda "vecchia" (senza riga contatti) funzionano |
| Principio II | `/p_<id>` resta una sola batch oltre a `getActive` (test esistente verde) |

### RF-01, BR-25, V-08 — Inserimento (`integration/us2-inserimento.test.ts`)

| Scenario spec | Verifica |
|---|---|
| **Da aggiornare** | Il test della domanda "Telefono?" usa il nuovo testo §5.2 |
| US2-1 | Contatto `393331234567` → `📱 +393331234567, giusto?`; Sì → domanda Instagram; Salva → `persons.phone = +393331234567` |
| US2-2 | Contatto `333 1234567` → propone `+393331234567` |
| US2-3 | Correggi → domanda del telefono, step `telefono`, `pendingPhone` assente, telefono non salvato |
| US2-4 | Contatto allo step Nome → domanda del nome ripetuta, step invariato |
| US2-5 | Contatto `12345` → messaggio di numero non valido + domanda ripetuta |
| US2-6 | La domanda del telefono contiene "condividi il contatto" |
| US2-7 | Contatto con `first_name` diverso e `user_id` → nome e Telegram della persona salvata quelli del flusso |
| Edge | Contatto senza `phone_number` → "Questo contatto non ha un numero di telefono" + domanda |
| Edge | Durante la conferma: secondo contatto e testo "+39 333 7654321" → conferma ripetuta, `pendingPhone` invariato |
| Edge | Contatto fuori da ogni flusso → "Non ho capito…", nessuna persona creata |
| Edge | Contatto in altro flusso (es. `/messaggio`) → domanda dello step ripetuta |
| Edge | Sì premuto dopo /annulla → "Questa azione non è più disponibile" |
| RF-30 | Contatto da un estraneo → nessuna chiamata |
| FR-016 | Stato `nuovo` creato a mano allo step `telefono` senza `pendingPhone` (come prima del rilascio) → il contatto funziona |
| SC-004 | In tutti i test di contatto, `persons` non cambia prima di Sì |

### RF-04 — Modifica (`integration/us4-modifica.test.ts`)

| Scenario spec | Verifica |
|---|---|
| US3-1 | Modifica → Telefono, contatto, Sì → aggiornato solo `phone`, scheda rimostrata |
| US3-2 | Correggi → domanda del telefono, `phone` salvato invariato |
| US3-3 | Modifica → Instagram, contatto → domanda Instagram ripetuta |
| US3-4 | Telefono → Svuota (test esistente, verde) |
| Edge | Numero confermato uguale a quello salvato → salvataggio e scheda |
| Edge | Persona eliminata durante la conferma → "Persona non trovata" |

## 4. Verifica manuale (opzionale)

Con `npm run dev` e la collection Postman 2.2.0 (`postman/`, research R-11), oppure dal telefono
su un'istanza di prova:

1. `/nuovo` fino al telefono, 📎 → Contatto → conferma → Sì; completare e controllare la scheda.
2. `/p_<id>` di una persona con tutti i contatti: tre pulsanti; WhatsApp apre la chat vuota.
3. Modifica → Telefono → contatto → Correggi → numero scritto a mano.

## 5. Gate di chiusura

1. `npm test` verde; 2. ogni riga delle tabelle §2–§3 ha un test; 3. nessun numero o username nei
log (`privacy-log.test.ts` verde, nessun log nuovo con dati del contatto); 4. budget di research
R-10 rispettato; 5. `npm run typecheck` senza errori.
