import {
  compareBudgetCategories,
  DEFAULT_SPEND_LEVEL,
  emptyBudgetTotals,
  FALLBACK_BUDGET_CATEGORY,
  isSpendLevel,
  type BudgetLine,
  type CreateBudgetLineInput,
  type TravelBudgetTotals,
  type UpdateBudgetLineInput,
} from "@/types/travel-budget";
import { mergeOptions, normalizeOptionLabel } from "@/utils/options";
import { getErrorMessage, supabase } from "./supabase-client";

type BudgetRow = {
  id: string;
  travel_id: string;
  category: string | null;
  label: string | null;
  estimated: number | null;
  actual: number | null;
  notes: string | null;
  location: string | null;
  in_budget: boolean;
  to_visit: boolean;
  purchased: boolean;
  spend_level: string | null;
};

function mapNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBudgetLine(row: BudgetRow): BudgetLine {
  return {
    id: row.id,
    category:
      normalizeOptionLabel(String(row.category ?? "")) ||
      FALLBACK_BUDGET_CATEGORY,
    label: row.label ?? "",
    estimated: mapNumber(row.estimated),
    actual: mapNumber(row.actual),
    notes: row.notes ?? "",
    location: row.location ?? "",
    inBudget: row.in_budget === true,
    toVisit: row.to_visit === true,
    purchased: row.purchased === true,
    spendLevel: isSpendLevel(row.spend_level) ? row.spend_level : DEFAULT_SPEND_LEVEL,
  };
}

function sortBudgetLines(lines: BudgetLine[]): BudgetLine[] {
  return [...lines].sort((a, b) => {
    const byCategory = compareBudgetCategories(a.category, b.category);
    if (byCategory !== 0) return byCategory;
    return a.label.localeCompare(b.label, "fr");
  });
}

function toRow(
  travelId: string,
  input: CreateBudgetLineInput | UpdateBudgetLineInput,
) {
  return {
    travel_id: travelId,
    category: normalizeOptionLabel(input.category),
    label: input.label.trim(),
    estimated: input.estimated,
    actual: input.actual,
    notes: input.notes.trim(),
    location: input.location.trim(),
    in_budget: input.inBudget,
    to_visit: input.toVisit,
    purchased: input.purchased,
    spend_level: input.spendLevel,
  };
}

export async function getBudgetForTravel(
  travelId: string,
): Promise<BudgetLine[]> {
  const { data, error } = await supabase
    .from("travel_budget")
    .select("*")
    .eq("travel_id", travelId);

  if (error) {
    console.error("Get budget error:", error);
    throw error;
  }

  return sortBudgetLines((data ?? []).map(toBudgetLine));
}

export type BudgetSummary = {
  /** Reste à payer par voyage (items non achetés), détaillé par niveau de dépense. */
  totalsByTravel: Record<string, TravelBudgetTotals>;
  /** Dépensé par projet : réel payé (ou estimé) des items achetés. */
  purchasedSpendByTravel: Record<string, number>;
  /**
   * Catégories utilisées dans toute la base : le champ `category` est un texte
   * libre, les lignes existantes en sont donc la seule source.
   */
  categories: string[];
};

/**
 * Synthèse budgétaire en une seule requête (pour la liste des projets et le
 * solde de la cagnotte) : le reste à payer par projet (items non achetés) et le
 * déjà dépensé par projet (items achetés).
 */
export async function getBudgetSummary(): Promise<BudgetSummary> {
  const { data, error } = await supabase
    .from("travel_budget")
    .select("travel_id, category, estimated, actual, purchased, spend_level");

  if (error) {
    console.error("Get budget summary error:", error);
    throw error;
  }

  const rows = (data ?? []) as Pick<
    BudgetRow,
    "travel_id" | "category" | "estimated" | "actual" | "purchased" | "spend_level"
  >[];

  const totalsByTravel: Record<string, TravelBudgetTotals> = {};
  const purchasedSpendByTravel: Record<string, number> = {};
  const categories = mergeOptions(rows.map((row) => String(row.category ?? "")));

  for (const row of rows) {
    const travelId = row.travel_id;
    if (!travelId) continue;

    const estimated = mapNumber(row.estimated);

    if (row.purchased === true) {
      const spent = mapNumber(row.actual) ?? estimated;
      if (spent != null) {
        purchasedSpendByTravel[travelId] =
          (purchasedSpendByTravel[travelId] ?? 0) + spent;
      }
      continue;
    }

    if (estimated == null) continue;

    const level = isSpendLevel(row.spend_level) ? row.spend_level : DEFAULT_SPEND_LEVEL;
    const entry = (totalsByTravel[travelId] ??= emptyBudgetTotals());
    entry.total += estimated;
    entry.byLevel[level] += estimated;
  }

  return { totalsByTravel, purchasedSpendByTravel, categories };
}

export async function createBudgetLine(
  travelId: string,
  input: CreateBudgetLineInput,
): Promise<{ line: BudgetLine | null; error?: string }> {
  const { data, error } = await supabase
    .from("travel_budget")
    .insert(toRow(travelId, input))
    .select()
    .single();

  if (error || !data) {
    console.error("Create budget line error:", error);
    return {
      line: null,
      error: getErrorMessage(error, "Erreur lors de la création de la ligne"),
    };
  }

  return { line: toBudgetLine(data) };
}

export async function updateBudgetLine(
  travelId: string,
  input: UpdateBudgetLineInput,
): Promise<{ line: BudgetLine | null; error?: string }> {
  const { data, error } = await supabase
    .from("travel_budget")
    .update(toRow(travelId, input))
    .eq("id", input.id)
    .select()
    .single();

  if (error || !data) {
    console.error("Update budget line error:", error);
    return {
      line: null,
      error: getErrorMessage(error, "Erreur lors de la mise à jour de la ligne"),
    };
  }

  return { line: toBudgetLine(data) };
}

export async function deleteBudgetLine(
  lineId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("travel_budget")
    .delete()
    .eq("id", lineId);

  if (error) {
    console.error("Delete budget line error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression de la ligne"),
    };
  }

  return { success: true };
}
