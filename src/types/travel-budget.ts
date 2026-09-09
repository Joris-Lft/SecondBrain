/**
 * Catégories proposées par défaut. La liste n'est pas fermée : l'utilisateur peut
 * créer les siennes : le champ est un texte libre, les lignes existantes en
 * sont la seule source.
 */
export const DEFAULT_BUDGET_CATEGORIES = [
  "Transport",
  "Logement",
  "Nourriture",
  "Activités",
  "Autre",
] as const;

export type BudgetCategory = string;

export const DEFAULT_BUDGET_CATEGORY: BudgetCategory = "Transport";

/** Fallback de désérialisation quand la catégorie d'une ligne est vide. */
export const FALLBACK_BUDGET_CATEGORY: BudgetCategory = "Autre";

/** Ordonne les catégories : celles par défaut d'abord (ordre historique), puis les autres par ordre alphabétique. */
export function compareBudgetCategories(a: BudgetCategory, b: BudgetCategory) {
  const defaults = DEFAULT_BUDGET_CATEGORIES as readonly string[];
  const indexA = defaults.indexOf(a);
  const indexB = defaults.indexOf(b);

  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b, "fr");
}

/** Niveaux de dépense, du plus prioritaire au plus optionnel. */
export const SPEND_LEVELS = [
  "Strict minimum",
  "Confortable",
  "Royal",
] as const;

export type SpendLevel = (typeof SPEND_LEVELS)[number];

export const DEFAULT_SPEND_LEVEL: SpendLevel = "Confortable";

export function isSpendLevel(value: unknown): value is SpendLevel {
  return (
    typeof value === "string" &&
    (SPEND_LEVELS as readonly string[]).includes(value)
  );
}

/** Ordonne les lignes par priorité d'achat, dans l'ordre de `SPEND_LEVELS`. */
export function compareSpendLevels(a: SpendLevel, b: SpendLevel) {
  return SPEND_LEVELS.indexOf(a) - SPEND_LEVELS.indexOf(b);
}

/** Budget estimé d'un voyage, détaillé par niveau de dépense. */
export type TravelBudgetTotals = {
  total: number;
  byLevel: Record<SpendLevel, number>;
};

export function emptyBudgetTotals(): TravelBudgetTotals {
  return {
    total: 0,
    byLevel: { "Strict minimum": 0, Confortable: 0, Royal: 0 },
  };
}

export type BudgetLine = {
  id: string;
  category: BudgetCategory;
  label: string;
  estimated: number | null;
  actual: number | null;
  notes: string;
  location: string;
  inBudget: boolean;
  toVisit: boolean;
  /** Item déjà acheté : sort du reste à payer, son coût réel est déduit de la cagnotte. */
  purchased: boolean;
  spendLevel: SpendLevel;
};

export type BudgetLineInput = {
  category: BudgetCategory;
  label: string;
  estimated: number | null;
  actual: number | null;
  notes: string;
  location: string;
  inBudget: boolean;
  toVisit: boolean;
  purchased: boolean;
  spendLevel: SpendLevel;
};

/**
 * Agrège le reste à payer d'un projet par niveau de dépense : somme des montants
 * estimés des items NON encore achetés.
 */
export function sumBudgetTotals(lines: BudgetLine[]): TravelBudgetTotals {
  const totals = emptyBudgetTotals();
  for (const line of lines) {
    if (line.purchased || line.estimated == null) continue;
    totals.total += line.estimated;
    totals.byLevel[line.spendLevel] += line.estimated;
  }
  return totals;
}

/** Total dépensé (sortie de cagnotte) : somme du réel payé (ou de l'estimé à défaut) des items achetés. */
export function sumPurchasedSpend(lines: BudgetLine[]): number {
  return lines.reduce((sum, line) => {
    if (!line.purchased) return sum;
    const spent = line.actual ?? line.estimated;
    return spent != null ? sum + spent : sum;
  }, 0);
}

/** Un item compte dans le budget s'il est explicitement flaggé ou s'il a un prix. */
export function isBudgetItem(line: BudgetLine): boolean {
  return line.inBudget || line.estimated != null || line.actual != null;
}

/** Un item est « à visiter » s'il est flaggé ou s'il a un point GPS. */
export function isVisitItem(line: BudgetLine): boolean {
  return line.toVisit || line.location.trim() !== "";
}

/** Extrait des coordonnées lat,lng depuis une chaîne « lat,lng » ou une URL Google Maps. */
export function parseLatLng(
  location: string,
): { lat: number; lng: number } | null {
  const value = location.trim();
  if (!value) return null;

  const validate = (rawLat: string, rawLng: string) => {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { lat, lng };
    }
    return null;
  };

  // Coordonnées brutes « lat,lng »
  const plain = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) return validate(plain[1], plain[2]);

  // URLs Google Maps /place/… : le lieu cliqué est la DERNIÈRE paire !3d!4d
  const placeMatches = [
    ...value.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g),
  ];
  if (placeMatches.length > 0) {
    const last = placeMatches[placeMatches.length - 1];
    const result = validate(last[1], last[2]);
    if (result) return result;
  }

  // Paramètres query= / q=
  const query = value.match(/[?&](?:query|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (query) return validate(query[1], query[2]);

  // Centre de la vue @lat,lng (dernier recours)
  const at = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return validate(at[1], at[2]);

  return null;
}

export type CreateBudgetLineInput = BudgetLineInput;

export type UpdateBudgetLineInput = BudgetLineInput & {
  id: string;
};
