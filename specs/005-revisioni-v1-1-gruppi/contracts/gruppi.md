# Contratto — `/gruppi [nome]`, scheda gruppo, filtro di `/prossimi`, menu

*(RF-07, RF-17, RF-19, BR-26, RNF-14, V-09, §5.1, §5.9)*

Modifica il contratto comandi di [001](../../001-fondamenta-anagrafica/contracts/comandi.md) e di
[003](../../003-viste-ricerche/contracts/comandi.md) (sezioni `/gruppi`, `/gruppo`, `/prossimi`).
Testi in `src/texts.ts` (principio VIII); le stringhe sotto sono il riferimento per i test. I
numeri (60, 2, 366) vengono da `src/config.ts` (`GROUP_BUTTONS_MAX`, `GROUP_KEY_MIN_LENGTH`,
`UPCOMING_MAX_DAYS`).

## Comando

`/gruppi` e `/gruppo` sono lo stesso handler (`COMMANDS.gruppi === COMMANDS.gruppo`), con e senza
argomento. `args` come in 003 (testo dopo il comando, senza spazi ai bordi).

| `args` | `groupKey(args)` | Risposta |
|---|---|---|
| vuoto | — | Elenco gruppi |
| non vuoto | vuota (solo emoji/simboli) | Elenco gruppi |
| non vuoto | non vuota | Ricerca (`findGroups`, research R-03) |

## Elenco gruppi (FR-001…FR-004, FR-013)

Ordine: `sortGroups` (chiave BR-26, poi nome, poi id). Etichetta: `<nome> (<n>)`.

| Caso | Testo | Tastiera |
|---|---|---|
| 1…60 gruppi | `👥 I tuoi gruppi` | due colonne di `g2:o`, poi riga `[➕ Nuovo gruppo]` (`g2:n`) |
| 0 gruppi | `Non hai ancora nessun gruppo.` | `[➕ Nuovo gruppo]` |
| ≥ 61 gruppi | `👥 I tuoi gruppi`, riga vuota, una riga `<nome> (<n>)` per gruppo, riga vuota, `Scrivi /gruppi seguito da una parte del nome per aprire un gruppo, es. /gruppi fam` | `[➕ Nuovo gruppo]` (sull'ultimo messaggio se diviso) |

Con prefisso (dopo creazione o eliminazione, o "non esiste"): `<prefisso>` + riga vuota + testo.

## Ricerca (FR-006, FR-007)

| Esito | Risposta |
|---|---|
| `one` | Scheda gruppo |
| `many`, ≤ 60 candidati | `🔍 Più gruppi corrispondono a «<testo>»:` + tastiera a due colonne di `g2:o` (senza Nuovo gruppo) |
| `many`, ≥ 61 candidati | stesso titolo + righe `<nome> (<n>)` + invito `/gruppi <nome>` |
| `none` | prefisso `Nessun gruppo corrisponde a «<testo>».` + elenco gruppi |

`<testo>` è `args` come scritto dall'utente.

## Scheda gruppo (FR-008, FR-012)

```
👥 <nome> · <n> persone        (1 persona / 0 persone)

<righe di lista di 003, per prossimo compleanno, con /p_<id>>
[✏️ Rinomina] [🗑 Elimina]
```

- Righe: `formatRows(sortByNextBirthday(...))` di 003, entità `code` e `bot_command` invariate.
- Divisione con `splitMessage` (003 FR-005); tastiera `g2:r` / `g2:x` solo sull'ultimo messaggio.
- 0 persone: titolo, riga vuota, `Nel gruppo non ci sono persone.`, tastiera.
- Nessun altro pulsante (niente Indietro, niente pulsanti per persona).
- Con prefisso (dopo la rinomina): `Gruppo rinominato in <nome>` + riga vuota + scheda.

## Rinomina ed Elimina dalla scheda (FR-009, FR-010, FR-006a)

| Passo | Risposta |
|---|---|
| tocco `g2:r` valido | `Nuovo nome per il gruppo <nome>?` + [Annulla] |
| nome vuoto / > 30 | errori di 001 FR-010a + stessa domanda |
| chiave < 2 | `Il nome del gruppo deve contenere almeno 2 lettere o cifre` + stessa domanda |
| `name_norm` di un altro gruppo | `Esiste già un gruppo con questo nome` + stessa domanda |
| nome valido | `Gruppo rinominato in <nuovo>` + scheda aggiornata (nuovo messaggio) |
| gruppo cambiato nel frattempo | `Il gruppo non esiste più.` + elenco, flusso chiuso |
| tocco `g2:x` valido | `Eliminare il gruppo <nome>? <n> persone perderanno questa etichetta` (testi di 001 FR-022) + [Sì] [Annulla] |
| Sì | `Gruppo <nome> eliminato` + elenco aggiornato |

Le regole di creazione da `g2:n` (step `crea`) sono le stesse, con conferma `Gruppo <nome> creato`
+ elenco. `Esiste già…` e la regola della chiave valgono anche per `newGroupStep` di `/nuovo` e
Modifica.

## `/prossimi [giorni] [gruppo]` (FR-011, FR-011a)

`parseUpcomingArgs` invariato nella forma (primo token di sole cifre = giorni, 1…366, altrimenti
errore di 003 FR-011; senza numero 30 giorni e tutto il testo è il gruppo). Novità:

| Testo del gruppo | Risposta |
|---|---|
| assente o chiave vuota | lista senza filtro (003 FR-009) |
| `one` | lista dei prossimi N giorni filtrata (titoli di 003 con il **nome salvato** del gruppo) |
| `many` | `🔍 Più gruppi corrispondono a «<testo>»:` + `g2:p:<id>:<h>:<N>`; il tocco dà la lista filtrata con lo stesso N |
| `none` | `Nessun gruppo corrisponde a «<testo>».` + elenco gruppi a pulsanti (i tocchi aprono la scheda) |

## `/aiuto` e menu (FR-014)

- `/aiuto`: la riga `/gruppi — elenca, crea, rinomina ed elimina i gruppi` diventa
  `/gruppi [nome] — elenco gruppi a pulsanti; con un nome cerca il gruppo e apre la scheda`;
  la riga `/gruppo <nome> — persone di un gruppo` sparisce.
- Menu Telegram (`BOT_COMMANDS` in `src/texts.ts`, `setMyCommands`): voce `gruppi` con
  descrizione `Elenco gruppi; con un nome cerca e apre la scheda`; nessuna voce `gruppo`.
  Sincronizzato dal cron (research R-10).

## Import CSV (FR-006a; 004 FR-006)

Un gruppo della colonna `gruppi` che non esiste (per `name_norm`) e ha chiave < 2 rende la riga
non valida con il motivo `gruppo "<valore>" senza almeno 2 lettere o cifre`; un gruppo esistente
con quel nome viene associato.
