# Contratto — testi nuovi e modificati v1.3 (`src/texts.ts`)

**Requisiti**: RNF-15, RNF-19, FR-007, FR-009, FR-011, FR-012, FR-013, FR-016, FR-018, FR-019, FR-020 |
Estende [contracts/testi.md di 008](../../008-revisioni-v1-1-stile/contracts/testi.md) e
[testi-v12.md di 009](../../009-revisioni-v1-2-navigazione/contracts/testi-v12.md) (tipi e regole
R1…R7 invariati).

Ogni chiave nuova entra in `INVENTARIO` di `test/unit/testi.test.ts` con il tipo indicato. Dove il
mockup §5.13 non dà il testo, la formulazione segue R1 (tono di 008).

## Orari (RNF-19)

| Nome | Tipo | Comportamento | Note |
|---|---|---|---|
| `formatClock(hour, minute)` *(nuova, esportata)* | funzione | 0 → `00:MM`; altre ore `H:MM` senza zero iniziale | unico formattatore; `clock(c)` interno la usa |
| `statoKind("giorno", ref)` *(modificata)* | T | `reminder delle ${formatClock(ref, 0)}` → "reminder delle 00:00", "reminder delle 9:00" | |

## Profili incompleti (RF-50, §5.13)

| Chiave | Tipo | Testo | Regola |
|---|---|---|---|
| `incompleteTitle` | T | 📝 Profili incompleti | R2, emoji di sezione 📝 (FR-019) |
| `incompleteQuestion` | D | Quale dato manca? | §5.13; nello stesso messaggio, riga dopo il titolo |
| `btnIncompleteFilter(label, n)` | PA | {label} ({n}) | R6, **senza emoji** (FR-019) |
| `INCOMPLETE_LABELS` (costante) | — | Telefono · Instagram · Telegram · Anno di nascita · Nessun contatto | etichette dei pulsanti, indicizzate per chiave del filtro |
| `incompleteListHeader(key, n)` | T | 📝 Senza telefono · {1 persona \| n persone}; 📝 Senza Instagram · …; 📝 Senza Telegram · …; 📝 Senza anno di nascita · …; 📝 Nessun contatto · … | R2, `plural()`; §5.13 |
| `incompleteAllHave(key)` | C | ✅ Tutte le persone hanno il telefono. / l'username Instagram. / l'username Telegram. / l'anno di nascita. / almeno un contatto. | R3 conferma (FR-013) |
| `incompleteNoPersons` | I | 📝 La rubrica è vuota: non ci sono persone. | R1 (FR-013) |
| `incompleteUnknown` | E | ❌ Non conosco questo dato. Scegli un filtro qui sotto oppure scrivi /incomplete seguito da telefono, instagram, telegram, anno o contatti. | R4 errore con rimedio (FR-011) |
| `btnIncomplete` | PA | 📝 Profili incompleti | R6, icona 📝 (FR-019); pulsante di `/statistiche` |

## Comandi (RF-28, §5.1)

| Chiave | Tipo | Testo |
|---|---|---|
| `help` (riga nuova) | T | /incomplete [campo] — profili incompleti: pulsanti dei filtri con i conteggi; con un campo (telefono, instagram, telegram, anno, contatti) la lista |
| `BOT_COMMANDS` (voce nuova) | — | `{ command: "incomplete", description: "Profili incompleti: dati mancanti delle schede" }` |

## Verifiche dell'inventario (`test/unit/testi.test.ts`)

- tutte le chiavi sopra presenti e classificate;
- nessun testo di `T` produce `"0:00"` preceduto da un non-cifra (regex `/(^|[^0-9])0:00/`) per gli
  orari della mezzanotte (SC-004), con `LocalClock` a ore 0;
- `btnIncompleteFilter` non contiene emoji; `btnIncomplete` inizia con 📝;
- elenco chiuso delle icone dei pulsanti (`v11-stile.test.ts`) esteso con 📝.
