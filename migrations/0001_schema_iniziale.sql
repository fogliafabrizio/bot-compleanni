-- Schema iniziale completo (AFU §8, data-model.md): contiene già le tabelle usate dalle
-- feature successive (occorrenze, invii, impostazioni), così le migration non vanno riscritte.
-- Le unicità sono indici separati e non vincoli di colonna: in un futuro multi-utente si
-- possono sostituire con indici che includono l'ID proprietario senza ricostruire le tabelle
-- (principio IX). Nessun dato iniziale: il messaggio di default sta in src/config.ts (R-13).

CREATE TABLE persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  full_name_norm TEXT NOT NULL,
  nickname TEXT NULL,
  birth_day INTEGER NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
  birth_month INTEGER NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_year INTEGER NULL CHECK (birth_year >= 1900),
  phone TEXT NULL CHECK (phone GLOB '+[0-9]*'),
  instagram TEXT NULL,
  telegram TEXT NULL,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'bassa')),
  custom_message TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Non unico: un possibile duplicato è ammesso dopo conferma esplicita (BR-14).
CREATE INDEX idx_persons_dup ON persons(full_name_norm, birth_day, birth_month);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL
);

CREATE UNIQUE INDEX ux_groups_name_norm ON groups(name_norm);

CREATE TABLE person_groups (
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, group_id)
);

CREATE INDEX idx_person_groups_group ON person_groups(group_id);

CREATE TABLE occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aperta' CHECK (status IN ('aperta', 'fatto', 'saltato', 'non_confermato')),
  outcome_at TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX ux_occurrences_person_year ON occurrences(person_id, year);
CREATE INDEX idx_occurrences_date ON occurrences(effective_date);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pre', 'giorno', 'recupero')),
  ref INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_invio', 'inviato', 'fallito', 'abbandonato')),
  attempts INTEGER NOT NULL DEFAULT 0,
  local_date TEXT NOT NULL,
  sent_at TEXT NULL,
  telegram_message_id INTEGER NULL,
  last_error_code INTEGER NULL
);

-- Idempotenza degli invii garantita dal database (N-02, principio VII).
CREATE UNIQUE INDEX ux_deliveries_unique ON deliveries(occurrence_id, kind, ref);

-- Chiave documentata: default_message (scritta dalla feature promemoria). Nasce vuota.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Nessun CHECK su flow: i valori ammessi sono validati da src/db/conversation.ts.
CREATE TABLE conversation_state (
  chat_id INTEGER PRIMARY KEY,
  flow TEXT NOT NULL,
  step TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
