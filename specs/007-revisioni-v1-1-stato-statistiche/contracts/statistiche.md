# Contratto: `/statistiche` (RF-32)

Fonti: spec FR-013…FR-015, AFU §5.11, D-29; research R-08.

## Ingresso

`/statistiche` (argomenti ignorati) dal proprietario; whitelist e interruzione dei flussi come
ogni comando.

## Esecuzione

Una batch D1 (`statisticheReadStatements`, `src/db/statistiche.ts`), 4 statement:

| # | Query | Uso |
|---|---|---|
| 0 | `persons`: totale, alta, media, bassa, senza anno, senza contatti, senza gruppo | riga 1 e 3, "Senza gruppo N" |
| 1 | `groups LEFT JOIN person_groups GROUP BY g.id` → `id, name, n` | riga gruppi, ordinata con `sortGroups` |
| 2 | `persons GROUP BY birth_month` | istogramma (mesi mancanti = 0) |
| 3 | `occurrences WHERE status <> 'aperta' GROUP BY year ORDER BY year DESC` → `year, fatto, chiuse` | andamento |

Poi `formatStatistiche(...)` (pura, `src/domain/statistiche.ts`) e `sendLines`.

## Uscita (layout AFU §5.11)

```text
📊 Statistiche
<N> persone · Alta <a> · Media <m> · Bassa <b>
Gruppi: <Nome> <n> · <Nome> <n> · … · Senza gruppo <k>      (k > 0)
Gruppi: nessun gruppo                                        (nessun gruppo; testo in texts.ts)
Senza anno di nascita: <y> · Senza contatti: <c>

🎂 Compleanni per mese
Gen ████████   11                                            (12 righe, entità pre)
…
Dic             0
✅ Auguri fatti: 2026 87% · 2025 81%
✅ Auguri fatti: non ci sono ancora anni con esiti           (nessun anno chiuso)
```

- Priorità sempre tutte e tre, anche a 0. "1 persona" al singolare.
- Gruppi: tutti, anche con 0, in ordine `sortGroups`; persona in più gruppi contata in ciascuno.
- Barra: `STATS_BAR_WIDTH` (10) blocchi al mese massimo; `0` → barra vuota; `n ≥ 1` → almeno 1
  blocco (`max(1, round(n × W / max))`); conteggio allineato a destra.
- Percentuale: `Math.round(fatto × 100 / chiuse)`; anni con sole occorrenze aperte assenti; anno con
  0 fatti → `0%`.
- Nessun elenco di persone (FR-015).

## Budget

D1: 1. Telegram: 1 `sendMessage` (di più solo con una riga gruppi oltre i 4096 caratteri).
CPU: ≈ 0,1–0,3 ms con 200 persone e 20 gruppi.
