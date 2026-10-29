-- Dati di prova per gli smoke test della collection Postman (feature 001–005). Solo D1 LOCALE:
--   npx wrangler d1 execute birthday-bot-db --local --file postman/seed-smoke.sql
-- (lo esegue anche la richiesta "Seed" della collection, tramite postman/helper.mjs).
-- Id fissi (persone 9001–9006, gruppi 9201–9204, occorrenze 9101–9106, invii 9301–9303) così le
-- richieste possono usare /p_<id>, t:f:<occorrenza>, p:f:<persona> e o:f:<invio>. Le date sono
-- relative a oggi (ora locale della macchina): rieseguire il file riporta tutto allo stato iniziale.

-- Pulizia dei dati di prova: id fissi, più persone e gruppi creati dalla collection (nome con
-- "postman"). Lo stato dei flussi guidati è azzerato per tutte le chat (D1 locale).
DELETE FROM deliveries WHERE occurrence_id IN (SELECT id FROM occurrences WHERE person_id BETWEEN 9001 AND 9099
  OR person_id IN (SELECT id FROM persons WHERE full_name_norm LIKE '%postman%'));
DELETE FROM occurrences WHERE person_id BETWEEN 9001 AND 9099
  OR person_id IN (SELECT id FROM persons WHERE full_name_norm LIKE '%postman%');
DELETE FROM person_groups WHERE person_id BETWEEN 9001 AND 9099 OR group_id BETWEEN 9201 AND 9299
  OR person_id IN (SELECT id FROM persons WHERE full_name_norm LIKE '%postman%')
  OR group_id IN (SELECT id FROM groups WHERE name_norm LIKE 'postman%');
DELETE FROM persons WHERE id BETWEEN 9001 AND 9099 OR full_name_norm LIKE '%postman%';
DELETE FROM groups WHERE id BETWEEN 9201 AND 9299 OR name_norm LIKE 'postman%';
DELETE FROM conversation_state;

-- Persone: compleanno oggi, tra 5 e 40 giorni, 2, 3 e 5 giorni fa.
INSERT INTO persons (id, full_name, full_name_norm, nickname, birth_day, birth_month, birth_year, phone, priority, created_at, updated_at) VALUES
  (9001, 'Marco Rossi', 'marco rossi', 'Marchino',
    CAST(strftime('%d', 'now', 'localtime') AS INTEGER), CAST(strftime('%m', 'now', 'localtime') AS INTEGER), 1994,
    '+393331234567', 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day')),
  (9002, 'Anna Bianchi', 'anna bianchi', NULL,
    CAST(strftime('%d', 'now', 'localtime', '+5 day') AS INTEGER), CAST(strftime('%m', 'now', 'localtime', '+5 day') AS INTEGER), NULL,
    NULL, 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day')),
  (9003, 'Nicolò Verdi', 'nicolò verdi', NULL,
    CAST(strftime('%d', 'now', 'localtime', '+40 day') AS INTEGER), CAST(strftime('%m', 'now', 'localtime', '+40 day') AS INTEGER), 1990,
    NULL, 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day')),
  (9004, 'Luca Neri', 'luca neri', NULL,
    CAST(strftime('%d', 'now', 'localtime', '-3 day') AS INTEGER), CAST(strftime('%m', 'now', 'localtime', '-3 day') AS INTEGER), 2000,
    NULL, 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-800 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-800 day')),
  (9005, 'Sara Gialli', 'sara gialli', NULL,
    CAST(strftime('%d', 'now', 'localtime', '-2 day') AS INTEGER), CAST(strftime('%m', 'now', 'localtime', '-2 day') AS INTEGER), NULL,
    NULL, 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day')),
  (9006, 'Paolo Blu', 'paolo blu', NULL,
    CAST(strftime('%d', 'now', 'localtime', '-5 day') AS INTEGER), CAST(strftime('%m', 'now', 'localtime', '-5 day') AS INTEGER), 1985,
    NULL, 'media', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day'));

-- Gruppi con nome di due parole (prova anche gli spazi negli argomenti).
INSERT INTO groups (id, name, name_norm) VALUES (9201, 'Smoke Famiglia', 'smoke famiglia'), (9202, 'Smoke Lavoro', 'smoke lavoro');
INSERT INTO person_groups (person_id, group_id) VALUES (9002, 9201), (9001, 9202), (9004, 9202);

-- Gruppi della ricerca morbida (feature 005, BR-26): emoji in testa e due gruppi che contengono
-- "casa" (scelta tra più gruppi). name_norm = normKey(name) = trim + minuscolo, emoji comprese.
INSERT INTO groups (id, name, name_norm) VALUES (9203, '👨‍👩‍👧 Smoke Casa', '👨‍👩‍👧 smoke casa'), (9204, 'Smoke Casa Rossi', 'smoke casa rossi');
INSERT INTO person_groups (person_id, group_id) VALUES (9002, 9203), (9003, 9204);

-- Occorrenze: Marco oggi aperta (t:f:9101) e l'anno scorso fatto; Luca saltato quest'anno e l'anno
-- prima (serie di /anno, "Segna fatto"); Sara aperta di 2 giorni fa; Paolo non confermato di 5 giorni fa.
INSERT INTO occurrences (id, person_id, year, effective_date, status, created_at) VALUES
  (9101, 9001, CAST(strftime('%Y', 'now', 'localtime') AS INTEGER), date('now', 'localtime'), 'aperta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9102, 9001, CAST(strftime('%Y', 'now', 'localtime', '-1 year') AS INTEGER), date('now', 'localtime', '-1 year'), 'fatto', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9103, 9004, CAST(strftime('%Y', 'now', 'localtime', '-3 day') AS INTEGER), date('now', 'localtime', '-3 day'), 'saltato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9104, 9004, CAST(strftime('%Y', 'now', 'localtime', '-3 day', '-1 year') AS INTEGER), date('now', 'localtime', '-3 day', '-1 year'), 'saltato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9105, 9005, CAST(strftime('%Y', 'now', 'localtime', '-2 day') AS INTEGER), date('now', 'localtime', '-2 day'), 'aperta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9106, 9006, CAST(strftime('%Y', 'now', 'localtime', '-5 day') AS INTEGER), date('now', 'localtime', '-5 day'), 'non_confermato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Invii dei promemoria (o:f / o:s senza passare dal cron): recupero di Sara (9301) e di Paolo
-- (9302), pre-reminder di Sara (9303, "Fatto" non cambia l'esito).
INSERT INTO deliveries (id, occurrence_id, kind, ref, status, attempts, local_date, sent_at) VALUES
  (9301, 9105, 'recupero', 13, 'inviato', 1, date('now', 'localtime', '-1 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9302, 9106, 'recupero', 13, 'inviato', 1, date('now', 'localtime', '-4 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9303, 9105, 'pre', 1, 'inviato', 1, date('now', 'localtime', '-3 day'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
