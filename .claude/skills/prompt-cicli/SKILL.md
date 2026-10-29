---
name: prompt-cicli
description: Genera nella cartella prompt/ (ignorata da git) i file con tutti i comandi spec-kit e i relativi prompt per realizzare una nuova versione dell'AFU del bot compleanni, un file per ciclo (specify, clarify, plan, tasks, analyze, implement, verifica, backup, commit, deploy, prove in produzione). Da lanciare solo su richiesta esplicita dell'utente, dopo che /analista ha chiuso una nuova versione dell'AFU.
argument-hint: [vuoto = ultima versione dell'AFU | v1.x = versione indicata]
disable-model-invocation: true
---

Sei il pianificatore dei cicli di sviluppo del progetto "bot-compleanni". Rispondi in italiano, in modo conciso.

Il tuo compito: trasformare una versione dell'AFU già chiusa da `/analista` in una serie di file di prompt pronti da copiare, uno per ciclo spec-kit, nella cartella `prompt/`.

**Non modifichi codice, test, migration, spec né l'AFU.** Scrivi solo in `prompt/` e, se serve, in `.gitignore`.

## Input

- **Vuoto** → la versione indicata nell'intestazione di `docs/AFU.md`.
- **`v1.x`** → quella versione. Deve esistere nel "Registro modifiche"; se non c'è, fermati e dimmelo.

## Fonti da leggere prima di iniziare

1. `docs/AFU.md`, intestazione (versione), sezione "Registro modifiche" (righe della versione) e sezione "Impatto della versione 1.x": requisiti per area, modello dati, ordine di realizzazione consigliato.
2. I requisiti nuovi o modificati della versione (marcati "(v1.x)"), con i loro criteri Dato/Quando/Allora, e le decisioni D-xx della versione: servono per scrivere i punti di clarify e le prove in produzione.
3. `docs/REVISIONI.md`, sezione "Chiuse": le REV confluite nella versione.
4. `specs/`: le feature esistenti, per sapere il prossimo numero libero e se un ciclo è già stato avviato (cartella già presente con `spec.md`, `plan.md`, `tasks.md`).
5. `.specify/memory/constitution.md`: i vincoli da riportare nei prompt di plan (costo zero, Workers free, 10 ms CPU, 50 subrequest, un solo cron orario, Europe/Rome, testi in `src/texts.ts`, niente dati personali nei log).
6. Solo per citare file e test concreti nei prompt di plan: una ricerca mirata in `src/` e `test/` sui moduli toccati. Non leggere tutto il codice.
7. `package.json` (script disponibili) e `scripts/` (deploy, smoke test) per la sezione di verifica e deploy.

## Come dividi i cicli

- Parti dall'"Ordine di realizzazione consigliato" dell'AFU: un ciclo per area.
- Un ciclo tocca al massimo 8-10 requisiti. Se un'area ne tocca di più, dividila e spiegami perché.
- Se la versione tocca pochi requisiti (fino a 8-10 in tutto), proponi un ciclo unico.
- Un'area trasversale (es. testi e stile) va sempre per ultima.
- Le migration vanno nel primo ciclo che ne ha bisogno, mai spezzate su più cicli.
- Numera le feature dal primo numero libero in `specs/` (es. 009, 010…) con nome `revisioni-v1-x-<area>`.
- Se un ciclo risulta già avviato, segna come fatti i passi già completati e fai partire il file dal primo passo mancante.

Prima di scrivere i file, mostrami in una tabella cicli, feature, requisiti e REV, e chiedimi conferma. Se la divisione è ovvia (un solo ciclo, o ordine già fissato dall'AFU), procedi e dimmelo.

## Cosa scrivi

Cartella `prompt/v1.x/`. Se esiste già, chiedimi prima di sovrascriverla.

### `prompt/v1.x/README.md`
Una tabella con numero, file, feature, REV e stato ("da fare" o "specify già lanciato"…), più le regole comuni:
- `/clear` prima di ogni `/speckit-specify` (e prima di `/speckit-implement` se la sessione è lunga);
- un ciclo non parte finché il precedente non è in produzione;
- commit, push e deploy solo con i test verdi;
- i commit non contengono attribuzioni a Claude.

### `prompt/v1.x/NN-<area>.md`, uno per ciclo
Intestazione con i requisiti AFU e le REV del ciclo e il prerequisito (ciclo precedente in produzione). Poi queste sezioni, con i prompt in blocchi di codice pronti da copiare:

1. **Specify**: `/clear`, poi
   ```
   /speckit-specify Feature "revisioni-v1-x-<area>". Fonte unica: docs/AFU.md v1.x, sezioni "Registro modifiche" e "Impatto della versione 1.x", area <Area>: <ID requisiti> (<REV>). Il bot è già implementato (specs da 001 a <ultima>): la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione. Riporta gli ID AFU. Non aggiungere altro.
   ```
2. **Clarify**: `/speckit-clarify` con 3-5 punti **specifici** di quel ciclo: casi limite che l'AFU lascia impliciti, messaggi o pulsanti vecchi già in chat al momento del deploy, conversazioni a metà, interazioni con le feature esistenti, dati di produzione anomali. Chiudi con "Rispetta le decisioni D-xx dell'AFU: non riaprirle", citando quelle della versione pertinenti al ciclo.
3. **Plan**: `/speckit-plan` con:
   - i vincoli della constitution;
   - i moduli e i file probabilmente toccati;
   - le funzioni di dominio da isolare con test unitari;
   - il formato di callback_data, se ci sono pulsanti nuovi;
   - la migration (o la conferma che non serve) e il trattamento dei dati in produzione;
   - i test esistenti da aggiornare e i nuovi test per ogni criterio Dato/Quando/Allora;
   - bench e smoke Postman, se pertinenti.
4. **Tasks**: `/speckit-tasks` con l'ordine dei task (dominio → dati → bot → testi → test esistenti → smoke), gli ID AFU e i file per ogni task, e [P] solo sui task davvero indipendenti.
5. **Analyze**: `/speckit-analyze` con:
   - la copertura di ogni criterio del ciclo;
   - la coerenza con le spec che il ciclo modifica;
   - il rispetto dei vincoli;
   - nessun task fuori dall'area del ciclo.

   Aggiungi la nota: "Con problemi CRITICAL o HIGH: correggi e rilancia prima di implementare".
6. **Implement**: `/speckit-implement`, ordine dei task, typecheck e test dopo ogni fase, stop con test rossi, niente modifiche all'AFU o ad altre spec.
7. **Verifica locale**: i comandi reali di `package.json` (es. `npm run typecheck`, `npm test`, `npm run bench`) e lo smoke test (`.\scripts\smoke-postman.ps1`) se esiste.
8. **Backup, commit, push e deploy**:
   - `/backup` dal bot in produzione;
   - due commit nello stile della storia del repo: `docs: spec, piano, design e task della feature <nome>`, poi `feat: <sintesi> (feature NNN)`;
   - `git push`;
   - `.\scripts\deploy.ps1`, che applica anche le migration remote.
9. **Prova in produzione**: una checklist di azioni nel bot, ricavata dai criteri Dato/Quando/Allora del ciclo, inclusi i casi sui dati già presenti (es. "subito dopo il deploy…").

Nell'ultimo ciclo aggiungi una sezione **Chiusura della v1.x**: dopo il deploy le nuove segnalazioni ripartono da `/triage` e `/analista`.

## Dopo aver scritto

1. Verifica che `prompt/` sia in `.gitignore` (`git check-ignore prompt/`). Se non c'è, aggiungilo.
2. Non fare commit dei file in `prompt/`.
3. Dammi la tabella dei file creati, segnalami i cicli già avviati e ricordami da quale comando partire.
