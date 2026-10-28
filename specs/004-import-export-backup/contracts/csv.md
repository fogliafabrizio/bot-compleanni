# Contratto — Formato CSV (modello, import, export)

Riferimenti: BR-18…BR-23, BR-14, RF-23, RF-24, RF-25; FR-001…FR-016 della spec. Codice:
`src/domain/csv.ts` (parser e serializzatore) e `src/domain/import.ts` (validazione).

## Colonne *(BR-18, FR-001)*

Ordine dei file prodotti dal bot:

```text
nome;nickname;data;telefono;instagram;telegram;gruppi;priorita;messaggio
```

| Colonna | Obbligatoria | Regola (stessa del guidato) | Esempio |
|---|---|---|---|
| `nome` | sì | `cleanText`, max 60 | `Marco Rossi` |
| `nickname` | no | `cleanText`, max 60 | `Marchino` |
| `data` | sì | `gg/mm/aaaa` o `gg/mm`; anno 1900…anno corrente; 29/02 solo senza anno o con anno bisestile | `14/03/1985`, `29/02` |
| `telefono` | no | `normalizePhone`: spazi, punti e trattini rimossi, `00` → `+`, senza prefisso `+39`; E.164 8–15 cifre | `333 1234567` |
| `instagram` | no | `normalizeUsername`: `@` iniziale rimossa | `@marco.rossi` |
| `telegram` | no | come `instagram` | `marcorossi` |
| `gruppi` | no | nomi separati da `\|`, ciascuno `cleanText` max 30; vuoti ignorati; ripetuti (senza maiuscole) contati una volta | `Famiglia\|Beach tennis` |
| `priorita` | no | `alta`, `media`, `bassa` senza maiuscole; vuota = `media` | `ALTA` |
| `messaggio` | no | `validateGreeting` (FR-035 di 002: 256, `{nome}` vale 60) | `Auguri {nome}!` |

## Lettura (import)

- **Codifica** (BR-22): UTF-8 con o senza BOM. Byte non UTF-8 → file rifiutato.
- **Separatore** (BR-19): `;` o `,`, scelto contando i due caratteri fuori dalle virgolette
  nell'intestazione (a parità `;`).
- **Virgolette**: un campo tra `"` può contenere separatori e a capo; `""` vale `"`.
- **Fine riga**: `\r\n` o `\n`.
- **Intestazione** = primo record non vuoto. Ogni cella confrontata senza spazi ai bordi, senza
  maiuscole e senza accenti (`Priorità` = `priorita`). Colonne sconosciute o ripetute, oppure
  `nome` o `data` assenti → file rifiutato. Colonne opzionali assenti → valgono vuote.
- **Numero di riga** (FR-009): posizione del record nel file, intestazione = 1; un campo
  multilinea tra virgolette resta una riga; le righe vuote contano.
- **Righe vuote**: ignorate, non sono errori.
- **Celle**: mancanti in coda = vuote; in più rispetto all'intestazione → errore `colonne in più`
  solo se non vuote.
- **Limite** (FR-008a): più di 500 righe di dati non vuote → file rifiutato per intero.

### Motivi di errore di riga *(FR-010; uno per ogni campo non valido, separati da `; `)*

| Caso | Motivo |
|---|---|
| nome vuoto | `nome mancante` |
| nome > 60 | `nome troppo lungo (max 60)` |
| nickname > 60 | `nickname troppo lungo (max 60)` |
| data vuota | `data mancante` |
| data non valida | `data "31/04" non valida` |
| telefono non valido | `telefono non valido` |
| priorità sconosciuta | `priorità "altissima" non valida` |
| gruppo > 30 | `gruppo "…" troppo lungo (max 30)` |
| messaggio troppo lungo | `messaggio troppo lungo` |
| celle in eccesso | `colonne in più` |

Ogni campo dà al massimo un motivo (per `gruppi` il primo elemento troppo lungo). I valori
citati tra virgolette sono accorciati a 30 caratteri (`IMPORT_ERROR_VALUE_MAX`) con `…` in coda.

I numeri (60, 30, 500…) vengono da `config.ts`; i testi da `texts.ts`.

### Riga d'esempio *(FR-007a)*

`CSV_EXAMPLE_ROW` in `texts.ts`:

```text
Esempio Da Cancellare;Esempio;14/03/1990;+39 3331234567;esempio.ig;esempio_tg;Famiglia|Amici;alta;Tanti auguri {nome}!
```

All'import una riga **valida** con `normKey(nome)` = `esempio da cancellare` e data `14/03/1990`
è sempre saltata (né nuova, né duplicata, né errore) e l'anteprima riporta "Riga d'esempio
ignorata". Se la riga d'esempio è stata modificata in modo da avere errori, conta come errore.

### Duplicati *(BR-14, FR-011)*

Duplicato se `normKey(nome)`, giorno e mese coincidono con una persona esistente o con una riga
**precedente valida** del file, e l'anno coincide oppure manca in una delle due. Saltato senza
conferma; nell'anteprima: `Nome Completo gg/mm[/aaaa]` (nome come scritto nel file).

## Scrittura (`/modello`, `/export`) *(FR-005a, FR-016)*

- UTF-8 **con BOM**, separatore `;`, fine riga `\r\n`, intestazione come sopra.
- Un valore è tra virgolette se contiene `;`, `,`, `"`, `\r` o `\n`; `"` raddoppiate.
- `/modello`: intestazione + `CSV_EXAMPLE_ROW`, nient'altro.
- `/export`: una riga per persona in ordine di `id`:
  - `data`: `formatShort` → `gg/mm/aaaa` o `gg/mm` (29/02 resta 29/02);
  - `telefono`: E.164 con uno spazio dopo i primi tre caratteri (`+39 3331234567`) perché
    Excel lo tratti come testo (research R-10, approvato 2026-10-29);
  - `instagram`, `telegram`: senza `@`;
  - `gruppi`: nomi come salvati, in ordine alfabetico, uniti da `|`;
  - `priorita`: minuscola;
  - `messaggio`: solo se personalizzato, vuoto se la persona usa il default.
  - Nessuno storico (RF-25). Zero persone → solo l'intestazione.

**Proprietà verificata dai test** (SC-004, RF-25): `import(export(D))` su un'istanza vuota
produce le stesse persone con gli stessi campi e gruppi, zero errori; sulla stessa istanza tutte
le righe risultano duplicati.
