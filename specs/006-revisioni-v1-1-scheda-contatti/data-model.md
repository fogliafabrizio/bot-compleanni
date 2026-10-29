# Data Model: Revisioni v1.1 — Scheda e contatti

**Feature**: `006-revisioni-v1-1-scheda-contatti` | **Date**: 2026-10-29

## Schema D1

**Nessuna modifica** (FR-013, research R-06): nessuna migration, nessuna conversione dei dati.

| Tabella | Cambia? | Note |
|---|---|---|
| `persons` | No | `phone` (E.164), `instagram`, `telegram` restano come salvati (FR-014). Il telefono da contatto è salvato nello stesso campo e formato. |
| `conversation_state` | No (struttura) | Nuovi step e un campo JSON opzionale in `data` (sotto). |
| Altre (`groups`, `person_groups`, `occurrences`, `reminders`, `settings`, …) | No | — |

## Entità non persistite

### Contatto condiviso (V-08)

Tipo `Contact` in `src/telegram/types.ts` (research R-01), campo `Message.contact`.

| Campo | Uso |
|---|---|
| `phone_number?` | Unico campo letto; normalizzato con BR-25 (`normalizeContactPhone`). Vuoto o assente → "Questo contatto non ha un numero di telefono". |
| `first_name?`, `last_name?`, `user_id?`, `vcard?` | Ignorati (FR-008): non modificano alcun campo della persona. |

Mai salvato: vive solo per la durata della richiesta.

### Numero proposto

Risultato di `normalizeContactPhone(raw)`:

```
{ ok: true, value: "+<8-15 cifre>" } | { ok: false, reason: "missing" | "invalid" }
```

Regole: research R-03 (BR-25 → BR-15).

## Stato conversazione (`conversation_state`)

### Flusso `nuovo` (RF-01)

```
data_conferma ──Sì──▶ telefono ──testo valido / Salta──▶ instagram
                        │  ▲
              contatto ok│  │Correggi
                        ▼  │
                  telefono_conferma ──Sì──▶ instagram (phone = pendingPhone)
```

- `telefono` (invariato nel nome): `textStep` + `onContact`.
  - contatto `missing` → messaggio specifico + domanda ripetuta (stesso step);
  - contatto `invalid` → `T.invalidPhone` + domanda ripetuta;
  - contatto `ok` → `telefono_conferma` con `pendingPhone`.
- `telefono_conferma` (**nuovo**, a pulsanti, azioni `y`, `c`): testo o contatto → domanda
  ripetuta; Sì → `instagram` con `phone = pendingPhone`; Correggi → `telefono`, `pendingPhone`
  rimosso.

`NuovoData` acquisisce `pendingPhone?: string`.

### Flusso `modifica` (RF-04)

```
menu ──Telefono──▶ valore(field="p") ──contatto ok──▶ valore_conferma ──Sì──▶ savePatch({phone}) → scheda
                        ▲                                   │
                        └────────────Correggi───────────────┘
```

- `valore`: `onContact` attivo solo con `field === "p"`; altri campi → domanda ripetuta.
- `valore_conferma` (**nuovo**): come `telefono_conferma`; Sì aggiorna **solo** `phone` (scrittura
  guardata dal `flowId` come oggi), poi scheda (FR-003); Correggi → `valore` con `field = "p"`,
  telefono salvato invariato.
- Svuota (`z`) invariato.

`ModificaData` acquisisce `pendingPhone?: string`.

### Compatibilità (FR-016)

| Stato al deploy | Comportamento |
|---|---|
| Qualsiasi step esistente, senza `pendingPhone` | Prosegue invariato; da `telefono`/`valore(p)` accetta anche il contatto |
| Step di conferma nuovi | Non possono esistere prima del deploy |
| Rollback con uno stato in `*_conferma` | Step sconosciuto → stato cancellato, "Questa azione non è più disponibile"; nessuna scrittura |

## Scheda persona (vista)

Nessun dato nuovo: `schedaFromResults` restituisce già `person.phone`, `instagram`, `telegram` e
`pending`. Cambiano solo testo e tastiera ([contracts/scheda-contatti.md](contracts/scheda-contatti.md)).

### Regole di presenza dei contatti (FR-002)

| Contatto | Presente se | Pulsante |
|---|---|---|
| Telefono | `phone` non nullo | [WhatsApp] `https://wa.me/<cifre>` |
| Instagram | `isInstagramLinkable(instagram)`: `[A-Za-z0-9._]{1,30}` | [Instagram] `https://ig.me/m/<u>` |
| Telegram | `isTelegramLinkable(telegram)`: `[A-Za-z0-9_]{5,32}` | [Telegram] `https://t.me/<u>` |

Le stesse regole valgono per i promemoria (dove WhatsApp mantiene `?text=`).
