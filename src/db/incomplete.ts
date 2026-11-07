import { isMissing, type IncompleteKey, type IncompletePerson } from "../domain/incomplete";
import { LIST_PERSON_COLUMNS, rowToListPerson, type ListPersonRow } from "./viste";

// Letture di /incomplete (RF-50, FR-008, FR-017, research R-06, R-07): una SELECT aggregata per i
// conteggi del menu, una per la lista. Nessuna scrittura, nessun log.

// Unico frammento SQL del dato mancante: NULL, testo vuoto o di soli spazi (FR-008, FR-017).
export const missingSql = (col: string) => `NULLIF(TRIM(${col}), '') IS NULL`;

const telefono = missingSql("phone");
const instagram = missingSql("instagram");
const telegram = missingSql("telegram");

// Condizioni dei 5 filtri, condivise con /statistiche (SC-005).
export const MISSING: Record<IncompleteKey, string> = {
  telefono,
  instagram,
  telegram,
  anno: missingSql("birth_year"),
  contatti: `(${telefono} AND ${instagram} AND ${telegram})`,
};

export interface IncompleteCountsRow {
  total: number;
  telefono: number | null;
  instagram: number | null;
  telegram: number | null;
  anno: number | null;
  contatti: number | null;
}

export interface IncompleteCounts {
  total: number;
  telefono: number;
  instagram: number;
  telegram: number;
  anno: number;
  contatti: number;
}

export function incompleteCountsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(
    `SELECT COUNT(*) AS total, SUM(${MISSING.telefono}) AS telefono, SUM(${MISSING.instagram}) AS instagram,
       SUM(${MISSING.telegram}) AS telegram, SUM(${MISSING.anno}) AS anno, SUM(${MISSING.contatti}) AS contatti
     FROM persons`,
  );
}

// Su una tabella vuota le SUM valgono NULL → 0.
export function rowToIncompleteCounts(r: IncompleteCountsRow | null): IncompleteCounts {
  return {
    total: r?.total ?? 0,
    telefono: r?.telefono ?? 0,
    instagram: r?.instagram ?? 0,
    telegram: r?.telegram ?? 0,
    anno: r?.anno ?? 0,
    contatti: r?.contatti ?? 0,
  };
}

// birth_year può contenere '' o spazi in produzione (FR-024): il tipo della colonna è largo.
export interface IncompletePersonRow extends Omit<ListPersonRow, "birth_year"> {
  birth_year: number | string | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
}

export function incompletePersonsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(`SELECT ${LIST_PERSON_COLUMNS}, p.phone, p.instagram, p.telegram FROM persons p`);
}

// Un anno vuoto o di soli spazi non deve produrre un'età (§5.7, FR-012).
export function rowToIncompletePerson(r: IncompletePersonRow): IncompletePerson {
  const birthYear = isMissing(r.birth_year) ? null : Number(r.birth_year);
  return {
    ...rowToListPerson({ ...r, birth_year: birthYear }),
    phone: r.phone,
    instagram: r.instagram,
    telegram: r.telegram,
    rawBirthYear: r.birth_year,
  };
}
