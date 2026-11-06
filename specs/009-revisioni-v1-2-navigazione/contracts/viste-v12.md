# Contratto — viste e tastiere v1.2

*(RF-01, RF-07, RF-17, RF-19, RF-20, RF-22, RF-32, RNF-14, V-09)* | Layout dei messaggi di
risposta. `callback_data` in [callback-data.md](callback-data.md), testi in
[testi-v12.md](testi-v12.md). Regola comune: ogni pulsante di passo successivo manda un **nuovo**
messaggio; tastiera solo sull'**ultimo** messaggio di una vista spezzata (`sendLines`); al massimo
**2** pulsanti di passo successivo per vista; nessun pulsante sulle righe delle persone; `/cerca`
senza pulsanti.

## Elenco gruppi (`/gruppi`, `g2:l`, avvisi seguiti dall'elenco)

```
👥 I tuoi gruppi
[Beach tennis (6)]  [Famiglia (8)]
[Lavoro (5)]        [Università (12)]
[Senza gruppo (12)]                     ← solo se N > 0, riga a sé
[➕ Nuovo gruppo]
```

| Gruppi | N | Tastiera | Pulsanti max |
|---|---|---|---|
| 0 | 0 | [➕ Nuovo gruppo] | 1 |
| 0 | > 0 | [Senza gruppo (N)] / [➕ Nuovo gruppo] | 2 |
| 1…60 | ≥ 0 | gruppi a 2 colonne / [Senza gruppo (N)]? / [➕ Nuovo gruppo] | **62** (V-09) |
| > 60 | ≥ 0 | testo (righe + invito) e [Senza gruppo (N)]? / [➕ Nuovo gruppo] | 2 |

Scelta tra più gruppi (`/gruppi <testo>`, `/prossimi … <testo>`): **mai** la voce virtuale, mai
➕ Nuovo gruppo (invariato).

## Scheda gruppo

```
👥 Famiglia · 8 persone

Gio 30/10  Anna (28)      /p_4
…
[✏️ Rinomina] [🗑 Elimina]
[⬅️ Tutti i gruppi]
```

Vale per ogni apertura: `g2:o`, `/gruppi <nome>` con un trovato, dopo la rinomina (con il prefisso
"✅ Ho rinominato…"), gruppo vuoto ("Nel gruppo non c'è ancora nessuno.").

## Scheda "Senza gruppo" (`g2:s`, N attuale > 0)

```
👥 Senza gruppo · 12 persone

Sab 01/11  Paolo (41)     /p_23
…
[⬅️ Tutti i gruppi]
```

N attuale = 0: messaggio `Ora tutte le persone hanno un gruppo.` + riga vuota + elenco gruppi
aggiornato (stesso messaggio, come gli altri prefissi di `showGroups`).

## `/prossimi`

| Caso | Tastiera |
|---|---|
| N < 90, senza filtro (anche lista vuota) | [Prossimi 90 giorni] → `s:u` |
| N < 90, con gruppo (trovato, o scelto tra più candidati con `g2:p`) | [Prossimi 90 giorni] → `g2:p:<id>:<h>:90` |
| N ≥ 90 | nessuna |
| Errore di argomento, gruppo inesistente, scelta tra più gruppi | nessun pulsante di passo successivo |

## `/mese`

```
🗓 Compleanni di marzo 2027
…
[◀️ Febbraio] [Aprile ▶️]
```

Sempre entrambi i pulsanti, anche con "🗓 Nessun compleanno a …"; gennaio → [◀️ Dicembre],
dicembre → [Gennaio ▶️]. Mese non valido: errore senza pulsanti.

## `/anno`

| Anno mostrato Y | Storico chiuso in Y − 1 | Tastiera |
|---|---|---|
| Y = anno corrente | sì | [◀️ Y−1] |
| Y = anno corrente | no | nessuna |
| Y < anno corrente | sì | [◀️ Y−1] [Y+1 ▶️] |
| Y < anno corrente | no | [Y+1 ▶️] |

Anno non valido o futuro: errore senza pulsanti.

## Conferma del salvataggio (flusso `nuovo`, anche dopo "Salva comunque")

```
🎉 Fatto! Marchino è in rubrica.

👤 Marco Rossi — "Marchino"
…
[WhatsApp] [Instagram]
[✏️ Modifica] [🗑 Elimina]
[➕ Aggiungi un'altra persona]
```

Scheda da `/p_<id>`, `/cerca`, dopo modifica o Segna fatto: **senza** l'ultima riga.

## `/statistiche` — sezione 🧑 Età (dopo "🎂 Compleanni per mese", prima di "✅ Auguri fatti")

```
🧑 Età
0-9   █████      1
10-19            0
20-29            0
30-39 ██████████ 2
40-49            0
50-59 █████      1
Età media: 33 anni
```

- Righe dalla fascia minima alla massima non vuota; intermedie a 0; ultima fascia `80+`.
- Istogramma in un'entità `pre` (come quello per mese); "Età media" fuori dal blocco.
- Senza anno di nascita > 0: `Età media: N anni · senza anno di nascita: M`.
- Nessuna età valida: `🧑 Età` + `Età non disponibile: nessuna persona ha l'anno di nascita.`
