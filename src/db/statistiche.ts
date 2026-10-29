// Letture di /statistiche (RF-32, contracts/statistiche.md, research R-08 di 007): una batch di 4
// aggregati [persone, gruppi, mesi, andamento per anno].

export interface StatsPersonsRow {
  total: number;
  alta: number | null;
  media: number | null;
  bassa: number | null;
  senza_anno: number | null;
  senza_contatti: number | null;
  senza_gruppo: number | null;
}

export interface StatsGroupRow {
  id: number;
  name: string;
  n: number;
}

export interface StatsMonthRow {
  birth_month: number;
  n: number;
}

export interface StatsYearRow {
  year: number;
  fatto: number;
  chiuse: number;
}

export function statisticheReadStatements(db: D1Database): D1PreparedStatement[] {
  return [
    // Su una tabella vuota le SUM valgono NULL.
    db.prepare(
      `SELECT COUNT(*) AS total, SUM(priority = 'alta') AS alta, SUM(priority = 'media') AS media,
         SUM(priority = 'bassa') AS bassa, SUM(birth_year IS NULL) AS senza_anno,
         SUM(phone IS NULL AND instagram IS NULL AND telegram IS NULL) AS senza_contatti,
         SUM(NOT EXISTS (SELECT 1 FROM person_groups pg WHERE pg.person_id = p.id)) AS senza_gruppo
       FROM persons p`,
    ),
    db.prepare("SELECT g.id, g.name, COUNT(pg.person_id) AS n FROM groups g LEFT JOIN person_groups pg ON pg.group_id = g.id GROUP BY g.id"),
    db.prepare("SELECT birth_month, COUNT(*) AS n FROM persons GROUP BY birth_month"),
    db.prepare(
      `SELECT year, SUM(status = 'fatto') AS fatto, COUNT(*) AS chiuse FROM occurrences
       WHERE status <> 'aperta' GROUP BY year ORDER BY year DESC`,
    ),
  ];
}
