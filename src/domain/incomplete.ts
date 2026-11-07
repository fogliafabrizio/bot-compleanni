import type { LocalDate } from "../time";
import { sortByNextBirthday, type BirthdayRow, type ListPerson } from "./viste";

// Profili incompleti (RF-50, FR-008, FR-011, FR-012, data-model "Filtro dei profili incompleti",
// research R-06, R-08). Puro: nessun import da db/ o bot/.

export type IncompleteKey = "telefono" | "instagram" | "telegram" | "anno" | "contatti";

export interface IncompleteFilter {
  // Campo id del callback_data s:i:<code> (contracts/callback-data.md).
  code: 1 | 2 | 3 | 4 | 5;
  key: IncompleteKey;
  // Argomento di /incomplete <arg>.
  arg: string;
}

// FR-008: ordine dei pulsanti e dei codici.
export const INCOMPLETE_FILTERS: readonly IncompleteFilter[] = [
  { code: 1, key: "telefono", arg: "telefono" },
  { code: 2, key: "instagram", arg: "instagram" },
  { code: 3, key: "telegram", arg: "telegram" },
  { code: 4, key: "anno", arg: "anno" },
  { code: 5, key: "contatti", arg: "contatti" },
];

export interface IncompletePerson extends ListPerson {
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  // Valore grezzo della colonna birth_year: in produzione può essere '' o di soli spazi.
  rawBirthYear: string | number | null;
}

export function filterByCode(n: number): IncompleteFilter | undefined {
  return INCOMPLETE_FILTERS.find((f) => f.code === n);
}

export type IncompleteArg = { kind: "menu" } | { kind: "filter"; filter: IncompleteFilter } | { kind: "unknown" };

// FR-011: argomento case-insensitive, spazi ai bordi ignorati; varianti e più parole → unknown.
export function parseIncompleteArg(args: string): IncompleteArg {
  const a = args.trim().toLowerCase();
  if (a === "") return { kind: "menu" };
  const filter = INCOMPLETE_FILTERS.find((f) => f.arg === a);
  return filter ? { kind: "filter", filter } : { kind: "unknown" };
}

// FR-008, FR-017: dato mancante = NULL, testo vuoto o di soli spazi; un numero non è mai mancante.
export function isMissing(v: string | number | null): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

export function matchesFilter(p: IncompletePerson, f: IncompleteFilter): boolean {
  switch (f.key) {
    case "telefono":
      return isMissing(p.phone);
    case "instagram":
      return isMissing(p.instagram);
    case "telegram":
      return isMissing(p.telegram);
    case "anno":
      return isMissing(p.rawBirthYear);
    case "contatti":
      return isMissing(p.phone) && isMissing(p.instagram) && isMissing(p.telegram);
  }
}

// FR-012: persone a cui manca il dato, per prossimo compleanno (oggi compreso), poi nome, poi id.
export function incompleteRows(people: readonly IncompletePerson[], f: IncompleteFilter, today: LocalDate): BirthdayRow[] {
  return sortByNextBirthday(
    people.filter((p) => matchesFilter(p, f)),
    today,
  );
}
