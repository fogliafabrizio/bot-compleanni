-- Dati di prova per gli smoke test della collection Postman (feature 003). Solo D1 LOCALE:
--   npx wrangler d1 execute birthday-bot-db --local --file postman/seed-smoke.sql
-- Id fissi (persone 9001–9006, gruppi 9201–9202, occorrenze 9101–9106) così le richieste possono
-- usare /p_<id>, t:f:<occorrenza> e p:f:<persona>. Le date sono relative a oggi (ora locale della
-- macchina): rieseguire il file riporta tutto allo stato iniziale.

-- Pulizia dei soli dati di prova.
DELETE FROM deliveries WHERE occurrence_id IN (SELECT id FROM occurrences WHERE person_id BETWEEN 9001 AND 9099);
DELETE FROM occurrences WHERE person_id BETWEEN 9001 AND 9099;
DELETE FROM person_groups WHERE person_id BETWEEN 9001 AND 9099 OR group_id BETWEEN 9201 AND 9299;
DELETE FROM persons WHERE id BETWEEN 9001 AND 9099;
DELETE FROM groups WHERE id BETWEEN 9201 AND 9299;

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

-- Occorrenze: Marco oggi aperta (t:f:9101) e l'anno scorso fatto; Luca saltato quest'anno e l'anno
-- prima (serie di /anno, "Segna fatto"); Sara aperta di 2 giorni fa; Paolo non confermato di 5 giorni fa.
INSERT INTO occurrences (id, person_id, year, effective_date, status, created_at) VALUES
  (9101, 9001, CAST(strftime('%Y', 'now', 'localtime') AS INTEGER), date('now', 'localtime'), 'aperta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9102, 9001, CAST(strftime('%Y', 'now', 'localtime', '-1 year') AS INTEGER), date('now', 'localtime', '-1 year'), 'fatto', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9103, 9004, CAST(strftime('%Y', 'now', 'localtime', '-3 day') AS INTEGER), date('now', 'localtime', '-3 day'), 'saltato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9104, 9004, CAST(strftime('%Y', 'now', 'localtime', '-3 day', '-1 year') AS INTEGER), date('now', 'localtime', '-3 day', '-1 year'), 'saltato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9105, 9005, CAST(strftime('%Y', 'now', 'localtime', '-2 day') AS INTEGER), date('now', 'localtime', '-2 day'), 'aperta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  (9106, 9006, CAST(strftime('%Y', 'now', 'localtime', '-5 day') AS INTEGER), date('now', 'localtime', '-5 day'), 'non_confermato', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
