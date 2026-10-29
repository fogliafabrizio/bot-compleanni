# Feature Specification: Revisioni v1.1 — Guida di stile

**Feature Branch**: n/d (nessun hook git configurato; spec creata su `main`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Feature \"revisioni-v1-1-stile\". Fonte unica: docs/AFU.md v1.1, sezioni \"Registro modifiche\" e \"Impatto della versione 1.1\", area Guida di stile: RNF-19 e mockup di §5 (REV-001), applicata a tutti i testi del bot, compresi quelli introdotti dalle feature v1.1 precedenti (005-007). Il bot è già implementato: la spec deve descrivere solo le differenze rispetto alle spec esistenti, citando per ogni requisito la spec che modifica. Includi il trattamento dei dati già presenti in produzione (messaggio di default e messaggi personalizzati non toccati). Riporta gli ID AFU. Non aggiungere altro."

**Fonte**: `docs/AFU.md` v1.1 (fonte di verità funzionale): Registro modifiche (REV-001), "Impatto della versione 1.1" (area Trasversale, ordine di realizzazione punto 4), RNF-19, RNF-15, A-06, decisione D-23, alternativa scartata "Stile dei testi sobrio o giocoso a scelta nelle impostazioni", mockup §5.2-§5.12 e nota di §5.1. Ogni requisito riporta l'ID AFU e la spec che modifica.

## Perimetro

**Natura della feature**: revisione trasversale dei testi di funzioni già rilasciate. Descrive solo le differenze rispetto alle spec 001 (fondamenta-anagrafica), 002 (promemoria-esiti), 003 (viste-ricerche), 004 (import-export-backup), 005 (revisioni-v1-1-gruppi), 006 (revisioni-v1-1-scheda-contatti) e 007 (revisioni-v1-1-stato-statistiche). Cambiano solo i testi mostrati dal bot (messaggi, domande, intestazioni, etichette dei pulsanti, didascalie dei file); comportamento, flussi, regole e dati restano come definiti in quelle spec.

**Revisioni AFU incluse**:

| REV | Titolo | Requisiti AFU |
|---|---|---|
| REV-001 | Tono più caldo ed emoji | RNF-19, mockup §5.2-§5.12, nota di §5.1, D-23 |

**Requisiti delle spec esistenti modificati**:

| Spec | Requisito esistente | Cosa cambia | AFU |
|---|---|---|---|
| 001 | FR-001, FR-014 | Ogni domanda del flusso guidato (inserimento e Modifica) inizia con l'icona del campo; testi delle domande come §5.2 | RNF-19, §5.2 |
| 001 | FR-002, FR-015 | Il pulsante Salta diventa "⏭ Salta" | RNF-19, §5.2 |
| 001 | FR-003 | Dopo il salvataggio, conferma con emoji di successo e nome della persona; il riepilogo ha l'intestazione 📋 | RNF-19, §5.2 |
| 001 | FR-004, FR-016a, FR-017, FR-022 | Avvisi di possibile duplicato e richieste di conferma delle eliminazioni con ⚠️ | RNF-19 |
| 001 | FR-005, FR-007, FR-009, FR-010a, FR-012a, FR-018c, FR-020, FR-025a | Messaggi di errore e di rifiuto con ❌ | RNF-19 |
| 001 | FR-011, FR-014, FR-017 | Scheda: titolo 👤 e riga 🎂 come §5.6; pulsanti "✏️ Modifica" e "🗑 Elimina" | RNF-19, §5.6 |
| 001 | FR-017, FR-019, FR-021, FR-022 | Conferme di eliminazione della persona e di creazione, rinomina ed eliminazione del gruppo con 🎉 o ✅ | RNF-19 |
| 001 | FR-024, FR-025 | Benvenuto con 👋; `/aiuto` con emoji di sezione nell'intestazione | RNF-19 |
| 002 | FR-021, FR-022, FR-024, FR-025, FR-030, FR-033 | Testi di pre-reminder, reminder e recupero come §5.3-§5.5 | RNF-19, §5.3-§5.5 |
| 002 | FR-032 | Domanda di `/messaggio` con l'icona del campo, conferma con 🎉 o ✅; il testo del messaggio resta escluso | RNF-19, A-06 |
| 003 | FR-003, FR-008, FR-013, FR-015, FR-016, FR-019 | Ogni intestazione di vista inizia con un'emoji di sezione (es. 📆); i messaggi di vista vuota seguono la stessa vista | RNF-19, §5.7 |
| 003 | FR-001, FR-001a, FR-007a | Le righe delle liste restano senza emoji aggiunte dal bot | RNF-19, §5.7 |
| 003 | FR-010, FR-011, FR-015, FR-018, FR-019 | Messaggi di errore (giorni, mese, anno non validi; azione non più disponibile) con ❌ | RNF-19 |
| 004 | FR-007, FR-016, FR-017, FR-022 | Didascalie di modello, export e backup (su richiesta e mensile) con emoji di sezione | RNF-19 |
| 004 | FR-008, FR-015 | Anteprima import con intestazione 📥 e sezione errori con ⚠️ | RNF-19, §5.8 |
| 004 | FR-013 | Conferma dell'import con 🎉 | RNF-19, §5.8 |
| 004 | FR-008a, FR-018, FR-026 | Rifiuti del file (troppe righe, backup non valido, file troppo grande) con ❌ | RNF-19 |
| 004 | FR-019, FR-020 | Richieste di conferma del ripristino con ⚠️; conferma di ripristino completato con 🎉 o ✅ | RNF-19 |
| 005 | FR-001, FR-003, FR-004, FR-006a, FR-007, FR-008, FR-009, FR-010 | Testi dei gruppi verificati rispetto alla guida (già in gran parte conformi a §5.9); errori con ❌ | RNF-19, §5.9 |
| 006 | FR-006, FR-007, FR-010 | Confermati: pulsanti di contatto senza icona, domanda e conferma del telefono con 📱; errori del contatto con ❌ | RNF-19, §5.2, §5.6 |
| 007 | FR-005, FR-009, FR-013 | Testi di `/stato`, `/statistiche` e avviso di buco verificati rispetto alla guida (già conformi a §5.10-§5.12) | RNF-19, §5.10-§5.12 |

**Fuori da questa feature**: modifiche di comportamento, di flussi, di comandi o di dati; la scelta dello stile nelle impostazioni (alternativa scartata in AFU); la traduzione dei testi; le altre revisioni v1.1 (REV-002…REV-007), già realizzate dalle spec 005-007.

## Clarifications

### Session 2026-10-29

- Q: Come si classificano i testi che non rientrano negli 8 tipi (titolo/intestazione, domanda di flusso, conferma, avviso, errore, pulsante di azione, pulsante di contatto, riga di lista)? → A: si aggiungono due tipi: **informativo** (istruzioni d'uso, annullamento), senza emoji obbligatoria, e **frammento** (parti composte in altri testi), che segue la regola del testo che lo contiene; il messaggio di vista vuota è un titolo/intestazione con l'emoji della vista. L'inventario completo (testo → tipo → regola) è un prodotto della progettazione e il riferimento dei test.
- Q: Qual è la mappa campo → icona delle domande dei flussi guidati, comprese quelle non mostrate in §5.2? → A: quella di §5.2 (👤 nome, 💬 nickname, 🎂 data, 📱 telefono, 📸 Instagram, ✈️ Telegram, 👥 gruppi, ⭐ priorità, ✍️ messaggio, 📋 riepilogo), estesa riusando icone già esistenti: 👥 nome di un gruppo (nuovo, rinomina), ✏️ "Quale campo vuoi modificare?", 💾 attesa del file di ripristino. In Modifica le stesse icone.
- Q: Quali pulsanti ricevono un'icona e quali restano senza? → A: con icona solo quelli dei mockup: ✏️ Modifica, ✏️ Rinomina, 🗑 Elimina (persona e gruppo), ⏭ Salta, ➕ Nuovo gruppo, Fatto ✅; tutti gli altri senza icona, compresi Segna fatto, Aggiungi persona e Svuota.
- Q: Fino a dove si spinge la revisione del tono e con quale limite di lunghezza? → A: tutti i testi rivolti all'utente, rivisti solo dove impersonali o freddi, con vincoli: "tu" per l'utente e prima persona per il bot; conferme con il nome dell'oggetto quando c'è; errori = cosa non va + come rimediare in al massimo 2 frasi brevi; vuoti e informativi in una frase; nessuna formula di cortesia o riempitivo; "!" solo in benvenuto e conferme di successo; un testo cresce al massimo di una frase breve rispetto a oggi.
- Q: Per i documenti inviati (modello CSV, export, backup), cosa segue la guida? → A: solo le didascalie, con emoji di sezione in testa e tono di FR-001a; le righe "•" della legenda del modello sono righe di lista, senza emoji; contenuto dei file (intestazioni, riga d'esempio, dati, formato JSON) e nomi dei file invariati.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inserimento e scheda con il nuovo tono (Priority: P1)

Il proprietario aggiunge una persona con `/nuovo`: ogni domanda ha la sua icona e un tono più personale, i pulsanti di azione hanno le icone, e al salvataggio il bot festeggia con il nome della persona. La scheda che segue ha il titolo e la data con l'emoji di sezione.

**Why this priority**: è il flusso più usato e quello mostrato come riferimento in AFU §5.2; il criterio di accettazione esplicito di RNF-19 riguarda proprio la conferma del salvataggio.

**Independent Test**: completare un inserimento con tutti i campi e uno saltando i facoltativi, poi una Modifica di ciascun campo; verificare icona e testo di ogni domanda, le etichette dei pulsanti, la conferma finale e la scheda.

**Esempio (AFU §5.2, §5.6)**:

```
Bot: 👤 Come si chiama? Nome e cognome                [Annulla]
Bot: 💬 Come lo chiami nei messaggi? (nickname)       [⏭ Salta]
Bot: 🎂 Quando è nato? Formato gg/mm/aaaa, oppure gg/mm se non sai l'anno
Bot: 📸 Username Instagram?                           [⏭ Salta]
Bot: 📋 Riepilogo: … (scheda)                         [Salva] [Annulla]
Bot: 🎉 Fatto! Marchino è in rubrica.

👤 Marco Rossi — "Marchino"
🎂 14/03/1994 · compie 33 anni tra 137 giorni
Priorità: alta · Gruppi: Beach tennis, Lavoro
[✏️ Modifica] [🗑 Elimina]
```

**Acceptance Scenarios**:

1. **Given** che salvo una persona, **Then** la conferma contiene un'emoji di successo e il nome della persona. *(RNF-19)*
2. **Given** che sono a uno step del flusso guidato, **Then** la domanda inizia con l'icona del campo (👤 nome, 💬 nickname, 🎂 data, 📱 telefono, 📸 Instagram, ✈️ Telegram, 👥 gruppi, ⭐ priorità, ✍️ messaggio). *(RNF-19, §5.2)*
3. **Given** che modifico un campo con ✏️ Modifica, **Then** la domanda usa la stessa icona del campo dell'inserimento. *(RNF-19)*
4. **Given** che uno step è facoltativo, **Then** il pulsante è "⏭ Salta"; Sì, Correggi, Salva, Annulla, Fine e le scelte di priorità e gruppo non hanno icone. *(RNF-19, §5.2)*
5. **Given** che apro una scheda, **Then** il titolo inizia con 👤, la riga della data con 🎂, priorità e gruppi non hanno emoji, e i pulsanti di contatto non hanno icone. *(RNF-19, §5.6)*

---

### User Story 2 - Liste e viste con l'emoji solo nell'intestazione (Priority: P1)

Il proprietario apre `/prossimi`, `/mese`, `/cerca`, `/scaduti`, `/anno` o una scheda gruppo: l'intestazione ha un'emoji di sezione, le righe restano pulite e allineate.

**Why this priority**: è l'altro criterio di accettazione esplicito di RNF-19; un'emoji nelle righe romperebbe l'allineamento in colonna (spec 003, FR-001a).

**Independent Test**: aprire ogni vista con risultati e senza risultati; verificare che l'intestazione inizi con un'emoji di sezione e che nessuna riga contenga emoji aggiunte dal bot.

**Esempio (AFU §5.7)**:

```
📆 Prossimi 30 giorni (Famiglia)

Gio 30/10  Anna (28)      /p_4
Dom 02/11  Luca (35)      /p_17
```

**Acceptance Scenarios**:

1. **Given** che apro una lista, **Then** l'emoji compare solo nell'intestazione. *(RNF-19)*
2. **Given** che una vista non ha risultati, **Then** il messaggio inizia con la stessa emoji di sezione della vista. *(RNF-19)*
3. **Given** che un gruppo o una persona ha emoji nel nome, **Then** il nome compare così com'è, senza emoji aggiunte o tolte dal bot. *(RNF-19; spec 005 FR-016)*

---

### User Story 3 - Promemoria, conferme, avvisi ed errori riconoscibili (Priority: P2)

Il proprietario riceve promemoria con il testo dei mockup, e riconosce a colpo d'occhio un successo (🎉 o ✅), un avviso (⚠️) e un errore (❌) in tutti i comandi, compresi import, backup, ripristino e gruppi.

**Why this priority**: completa la guida su tutti i testi; i promemoria sono già vicini ai mockup.

**Independent Test**: provocare per ogni comando un successo, un avviso e un errore (es. data non valida, possibile duplicato, file CSV con errori, backup non valido, eliminazione di un gruppo) e verificare l'emoji iniziale; ricevere pre-reminder, reminder e recupero e confrontarli con §5.3-§5.5.

**Acceptance Scenarios**:

1. **Given** che un'operazione riesce (salvataggio, modifica, eliminazione, creazione o rinomina di gruppo, `/messaggio`, import, ripristino), **Then** la conferma contiene 🎉 o ✅. *(RNF-19)*
2. **Given** che il bot rifiuta un input o non può eseguire una richiesta, **Then** il messaggio inizia con ❌. *(RNF-19)*
3. **Given** che il bot segnala qualcosa da verificare o chiede conferma di un'operazione distruttiva, **Then** il messaggio inizia con ⚠️. *(RNF-19)*
4. **Given** che parte un reminder, **Then** il testo e i pulsanti seguono §5.3: "🎂 Oggi è il compleanno di …", pulsanti di contatto senza icone, "Fatto ✅" e "Salta quest'anno". *(RNF-19, §5.3)*
5. **Given** che scrivo `/start`, **Then** il benvenuto contiene 👋. *(RNF-19)*

---

### Edge Cases

- Messaggio di auguri (default o personalizzato) mostrato nell'anteprima di `/messaggio`, nel riepilogo, nella scheda o copiato con "Copia messaggio": il testo è riportato esattamente come salvato; solo il testo del bot intorno segue la guida. *(RNF-19, A-06)*
- Messaggio di default con il valore iniziale "Tanti auguri {nome}! 🎉": resta tale, con la sua emoji, che è un dato dell'utente. *(A-06, RNF-19)*
- Nomi, nickname e nomi dei gruppi con emoji: compaiono anche dentro le righe delle liste, perché sono dati dell'utente; il bot non ne aggiunge né ne toglie. *(RNF-19; spec 005 FR-016)*
- Indicatori di selezione dei pulsanti di scelta (☐/☑ nei gruppi, ✓ sulla priorità attuale; spec 001 FR-023): restano, perché segnano uno stato e non sono icone di azione. *(RNF-19, §5.2)*
- Istogramma di `/statistiche` e righe di `/stato`: le barre e le icone delle righe di `/stato` restano come §5.10-§5.11 (spec 007). *(RNF-19)*
- Messaggi divisi in più parti (spec 003, FR-005): l'emoji di sezione compare solo nell'intestazione del primo messaggio. *(RNF-19)*
- Messaggio aggiornato dopo un esito ("✅ Fatto", "Saltato quest'anno"; spec 002 FR-022, FR-025): resta come oggi. *(RNF-19)*
- File inviati (modello CSV, export, backup): cambiano solo le didascalie; il contenuto e il nome dei file restano identici, compresa la riga d'esempio "Tanti auguri {nome}!". *(RNF-19; spec 004 FR-007a, FR-016)*
- Menu dei comandi registrato su Telegram: descrizioni come §5.1, senza emoji. *(§5.1)*
- Messaggi già inviati prima del rilascio: restano con il testo vecchio e i loro pulsanti continuano a funzionare come oggi. *(Impatto v1.1)*
- Flusso guidato in corso al momento del rilascio: prosegue senza interruzioni; le domande successive al rilascio usano i testi nuovi. *(Impatto v1.1)*
- Funzionalità future: devono seguire la stessa guida. *(RNF-19, D-23)*

## Requirements *(mandatory)*

### Functional Requirements

**Regole generali** *(modifica tutte le spec 001-007 per i testi; spec 001 FR-032 invariato)*

- **FR-001** *(RNF-19, D-23)*: Tutti i testi del bot MUST avere un tono caldo, personale e sobrio, senza diventare verbosi. Dove esiste un mockup in AFU §5, il testo MUST seguirne tono e struttura; i testi definitivi MUST restare nel punto unico dei testi (RNF-15; spec 001 FR-032).
- **FR-001a** *(RNF-19, D-23)*: La revisione del tono MUST riguardare tutti i testi rivolti all'utente (conferme, benvenuto, domande, errori, avvisi, vuoti, informativi, didascalie), riscrivendo solo quelli impersonali o freddi, con questi vincoli verificabili:
  - il bot si rivolge all'utente con il "tu" e parla di sé in prima persona (es. "Ho eliminato Marco");
  - le conferme nominano l'oggetto dell'operazione quando esiste (persona, gruppo);
  - un errore dice cosa non va e come rimediare, in al massimo 2 frasi brevi;
  - un messaggio di vista vuota o informativo sta in una frase;
  - nessuna formula di cortesia né riempitivo (es. "Per favore", "Purtroppo");
  - il punto esclamativo compare solo nel benvenuto e nelle conferme di successo;
  - rispetto al testo attuale, un testo cresce al massimo di una frase breve.
- **FR-002** *(RNF-19)*: Ogni titolo o intestazione di messaggio (viste, liste, scheda persona, scheda gruppo, riepilogo, anteprima, `/aiuto`, `/stato`, `/statistiche`, didascalie dei file) MUST iniziare con una sola emoji di sezione. Dove il mockup di §5 indica l'emoji, MUST essere quella; la stessa sezione MUST usare sempre la stessa emoji.
- **FR-003** *(RNF-19; modifica 003 FR-001, FR-001a, FR-007a e 005 FR-008)*: Le righe delle liste di persone e di gruppi MUST NOT contenere emoji aggiunte dal bot.
- **FR-004** *(RNF-19)*: Le conferme di successo MUST contenere 🎉 o ✅; gli avvisi MUST iniziare con ⚠️; gli errori MUST iniziare con ❌. È un avviso un messaggio che segnala qualcosa da verificare mentre l'operazione può proseguire o attende conferma (possibile duplicato, conferma di un'operazione distruttiva, righe scartate nell'anteprima import, avviso di buco, esito sconosciuto). È un errore un messaggio con cui il bot rifiuta un input o non può eseguire la richiesta (formato non valido, valore troppo lungo o vuoto, nome di gruppo già esistente o troppo corto, persona o gruppo non trovato, azione non più disponibile, comando non capito, file rifiutato, errore generico).
- **FR-004a** *(RNF-19, RNF-15)*: Ogni testo del punto unico dei testi MUST essere classificato in uno di questi tipi, con la regola corrispondente: titolo/intestazione (FR-002), domanda di flusso (FR-007), conferma, avviso, errore (FR-004), pulsante di azione (FR-009), pulsante di contatto (FR-010), riga di lista (FR-003), **informativo** (istruzioni d'uso, annullamento: nessuna emoji obbligatoria, mai 🎉, ✅, ⚠️ o ❌), **frammento** (parte composta in un altro testo, es. esiti, nomi dei mesi, righe "Priorità:"/"Gruppi:": segue la regola del testo che lo contiene e MUST NOT avere un'emoji propria se il contenitore è una riga di lista). Il messaggio di vista senza risultati è un titolo/intestazione (FR-014). L'inventario completo (testo → tipo → regola) MUST essere prodotto in progettazione e MUST essere il riferimento dei test di SC-001.
- **FR-005** *(RNF-19)*: Le emoji MUST NOT dipendere dalla priorità o dal gruppo di una persona.
- **FR-006** *(RNF-19, A-06)*: Il messaggio di auguri di default e i messaggi personalizzati MUST essere esclusi dalla guida: ovunque compaiano MUST essere mostrati e usati esattamente come salvati. Lo stesso vale per nomi, nickname e nomi dei gruppi.

**Flussi guidati e pulsanti** *(modifica spec 001 FR-001…FR-003, FR-014, FR-015, FR-017, FR-023 e spec 002 FR-032)*

- **FR-007** *(RNF-19, §5.2; modifica 001 FR-001, FR-014, FR-019, FR-023, 002 FR-032, 004 FR-018 e 005 FR-009)*: Ogni domanda dei flussi guidati MUST iniziare con l'icona del campo, secondo questa mappa chiusa:

  | Domanda | Icona |
  |---|---|
  | Nome completo | 👤 |
  | Nickname | 💬 |
  | Data di nascita | 🎂 |
  | Telefono (anche la conferma del numero) | 📱 |
  | Username Instagram | 📸 |
  | Username Telegram | ✈️ |
  | Gruppi | 👥 |
  | Priorità | ⭐ |
  | Messaggio personalizzato e messaggio di default (`/messaggio`) | ✍️ |
  | Riepilogo | 📋 |
  | Nome di un gruppo (nuovo gruppo, rinomina) | 👥 |
  | "Quale campo vuoi modificare?" | ✏️ |
  | Attesa del file di ripristino (`/ripristina`) | 💾 |

  La stessa icona MUST essere usata in inserimento e in Modifica. Le domande dell'inserimento MUST seguire i testi di §5.2. L'icona ⭐ indica il campo, non il valore della priorità (FR-005).
- **FR-008** *(RNF-19, §5.2; modifica 001 FR-003)*: Il riepilogo prima del salvataggio MUST avere l'intestazione 📋. Dopo il salvataggio il bot MUST mostrare una conferma con un'emoji di successo e il nickname della persona (o il nome completo se manca), come "🎉 Fatto! Marchino è in rubrica."; la scheda della persona MUST continuare a essere mostrata (006 FR-003).
- **FR-009** *(RNF-19; modifica 001 FR-002, FR-014, FR-017, FR-023, 005 FR-009, FR-010)*: Le icone MUST comparire solo sui pulsanti di azione indicati dai mockup di §5, secondo questo elenco chiuso:
  - **con icona**: "✏️ Modifica", "✏️ Rinomina", "🗑 Elimina" (persona e gruppo), "⏭ Salta", "➕ Nuovo gruppo", "Fatto ✅";
  - **senza icona**: tutti gli altri, cioè Sì, Correggi, Salva, Salva comunque, Annulla, Fine, Svuota, Importa, Continua, Sì ripristina, Conferma, Segna fatto, Salta quest'anno, Saltato, Aggiungi persona, Comandi, le scelte di campo del menu Modifica, di priorità e di gruppo, e i pulsanti di contatto (FR-010).

  Restano gli indicatori di selezione ☐/☑ e ✓ già previsti (spec 001 FR-023), che segnano uno stato e non sono icone. Un nuovo pulsante di azione futuro riceve un'icona solo se un mockup AFU la prevede (RNF-19, D-23).
- **FR-010** *(RNF-19, RF-11; conferma 006 FR-006)*: I pulsanti di contatto (WhatsApp, Instagram, Telegram, Copia messaggio) MUST restare senza icona, nella scheda e nei promemoria.

**Scheda, promemoria e benvenuto** *(modifica spec 001 FR-011, FR-024, FR-025 e spec 002 FR-021, FR-024, FR-030, FR-033)*

- **FR-011** *(RNF-19, §5.6; modifica 001 FR-011 e 006 FR-001)*: La scheda della persona MUST seguire §5.6: titolo "👤 <nome completo> — "<nickname>"", riga "🎂 <data> · compie N anni tra M giorni" (senza età se l'anno non è noto), poi priorità e gruppi senza emoji, telefono con 📱, messaggio e storico.
- **FR-012** *(RNF-19, §5.3-§5.5; modifica 002 FR-021, FR-024, FR-030, FR-033)*: Pre-reminder, reminder e recupero MUST seguire i testi di §5.4, §5.3 e §5.5 (📅 pre-reminder, 🎂 reminder, ⏰ recupero, 📱 telefono, "L'anno scorso: fatto ✅").
- **FR-013** *(RNF-19; modifica 001 FR-024, FR-025)*: Il benvenuto di `/start` MUST contenere 👋. L'intestazione di `/aiuto` MUST iniziare con un'emoji di sezione; le righe dei comandi MUST NOT contenere emoji (FR-003).

**Viste, import, backup e gruppi** *(modifica spec 003, 004 e 005)*

- **FR-014** *(RNF-19, §5.7; modifica 003 FR-003, FR-008, FR-013, FR-015, FR-016, FR-019)*: L'intestazione di ogni vista (`/prossimi`, `/mese`, `/cerca`, `/scaduti`, `/anno`, il messaggio riassuntivo di `/oggi`) MUST iniziare con un'emoji di sezione; `/prossimi` MUST usare 📆 come §5.7. Il messaggio di vista senza risultati MUST iniziare con la stessa emoji della vista.
- **FR-015** *(RNF-19, §5.8; modifica 004 FR-008, FR-013, FR-015)*: L'anteprima import MUST avere l'intestazione "📥 Anteprima import" e la sezione degli errori MUST iniziare con ⚠️; la conferma dell'import MUST seguire "🎉 Importate N persone, creati M gruppi".
- **FR-016** *(RNF-19; modifica 004 FR-007, FR-016, FR-017, FR-019, FR-020, FR-022)*: Le didascalie di modello, export, backup su richiesta e backup mensile MUST iniziare con un'emoji di sezione e seguire FR-001a; le righe "•" della legenda del modello sono righe di lista (FR-003) e MUST NOT avere emoji. Il contenuto dei file (intestazioni e riga d'esempio del CSV, dati, formato del JSON di backup) e i nomi dei file MUST restare invariati, così l'export resta reimportabile (004 FR-016), la riga d'esempio resta riconosciuta (004 FR-007a) e i backup restano ripristinabili (004 FR-025). Le richieste di conferma del ripristino MUST iniziare con ⚠️; la conferma di ripristino completato MUST contenere 🎉 o ✅.
- **FR-017** *(RNF-19, §5.9; modifica 005 FR-001, FR-003, FR-004, FR-006a, FR-007…FR-010 e 001 FR-019…FR-022)*: I testi dei gruppi MUST seguire §5.9 ("👥 I tuoi gruppi", "👥 <nome> · N persone", "🔍 Più gruppi corrispondono a «…»:"); conferme di creazione, rinomina ed eliminazione con 🎉 o ✅, conferma di eliminazione con ⚠️, errori con ❌.
- **FR-018** *(RNF-19, §5.10-§5.12; spec 007 FR-005, FR-009, FR-013 invariati)*: I testi di `/stato`, `/statistiche` e dell'avviso di buco MUST restare come §5.10-§5.12 e rientrano nella verifica di FR-001…FR-006.

**Dati già presenti in produzione** *(AFU, "Impatto della versione 1.1")*

- **FR-019**: Il rilascio MUST NOT richiedere nuove entità, modifiche di struttura o conversioni dei dati esistenti.
- **FR-020** *(RNF-19, A-06)*: Il messaggio di auguri di default in produzione (il valore iniziale "Tanti auguri {nome}! 🎉" o quello impostato con `/messaggio`) e i messaggi personalizzati MUST NOT essere modificati, né nel testo né nelle emoji. Un backup ripristinato MUST riportarli esattamente come contenuti nel file (004 FR-020).
- **FR-021** *(RNF-19)*: Nomi, nickname e nomi dei gruppi esistenti MUST NOT essere modificati (005 FR-016).
- **FR-022**: I messaggi già inviati prima del rilascio MUST NOT essere aggiornati; i loro pulsanti MUST continuare a funzionare come oggi.
- **FR-023**: Un flusso guidato o un'anteprima import in corso al momento del rilascio MUST proseguire senza interruzioni; i messaggi successivi al rilascio usano i testi nuovi.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *(RNF-19)*: Il 100% dei testi del punto unico dei testi è classificato nell'inventario (FR-004a) e rispetta la regola del suo tipo (FR-002…FR-010); i due criteri di accettazione di RNF-19 (conferma del salvataggio, emoji solo nell'intestazione delle liste) sono verificati da test.
- **SC-002** *(§5)*: Ogni messaggio mostrato in un mockup di §5.2-§5.12 coincide con il mockup per emoji, struttura ed etichette dei pulsanti.
- **SC-003** *(RNF-19)*: Nessuna riga di lista contiene emoji aggiunte dal bot e l'allineamento in colonna delle liste (spec 003 FR-001a) resta invariato.
- **SC-004** *(RNF-19)*: Nessuna etichetta dei pulsanti di contatto supera la lunghezza attuale, così non vengono troncate su mobile.
- **SC-005** *(Impatto v1.1)*: Dopo il rilascio il messaggio di default, i messaggi personalizzati e il 100% degli altri dati in produzione restano identici a prima.
- **SC-006**: I criteri di accettazione delle spec 001-007, aggiornati ai nuovi testi, continuano a passare: nessun comportamento cambia.
- **SC-007** *(RNF-19)*: Il 100% dei testi dell'inventario rispetta i vincoli di FR-001a; il proprietario, rileggendo il catalogo completo, li giudica caldi e sobri, senza testi che ritiene verbosi.

## Assumptions

- Le spec 001-007 restano valide per tutto ciò che questa spec non cita; dove c'è contrasto sui testi vale questa spec (AFU v1.1).
- I mockup di §5 sono indicativi di tono e struttura (nota di §5.1): i testi senza mockup (errori, viste come `/scaduti`, `/anno`, `/mese`, `/cerca`, `/aiuto`, didascalie, ripristino) seguono le stesse regole, con l'emoji di sezione scelta in fase di progettazione tra quelle coerenti con RNF-19.
- La conferma del salvataggio precede la scheda, che resta mostrata come richiesto da spec 006 FR-003; il nome nella conferma è il nickname o, se manca, il nome completo, come il segnaposto `{nome}` (spec 002 FR-031).
- I testi che già rispettano la guida (introdotti dalle spec 005-007 secondo i mockup §5.2, §5.6, §5.9-§5.12) restano invariati; rientrano comunque nella verifica completa del catalogo.
- Utente unico per istanza (proprietario); l'interfaccia è in italiano.
