import type {
  NavFeature,
  NavigationPreferences,
} from "@/types/navigation-preferences";
import { getErrorMessage, supabase } from "./supabase-client";

/** Colonne de `profiles` correspondant à chaque fonctionnalité. */
const COLUMN_BY_FEATURE: Record<NavFeature, string> = {
  habits: "show_habits",
  personalProjects: "show_personal_projects",
};

const NAV_FEATURES = Object.keys(COLUMN_BY_FEATURE) as NavFeature[];

export function parseNavigationPreferences(
  row: Record<string, unknown>,
): NavigationPreferences {
  return Object.fromEntries(
    NAV_FEATURES.map((feature) => [
      feature,
      row[COLUMN_BY_FEATURE[feature]] === true,
    ]),
  ) as NavigationPreferences;
}

export async function fetchNavigationPreferences(
  userId: string,
): Promise<NavigationPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select(Object.values(COLUMN_BY_FEATURE).join(", "))
    .eq("id", userId)
    .single();

  if (error || !data) throw error ?? new Error("Profil introuvable");

  return parseNavigationPreferences(data as unknown as Record<string, unknown>);
}

/**
 * N'écrit que les champs fournis. Envoyer les deux systématiquement
 * réécrirait des préférences qu'on n'a peut-être jamais réussi à lire.
 */
export async function updateNavigationPreferences(
  userId: string,
  changes: Partial<NavigationPreferences>,
): Promise<void> {
  const fields = Object.fromEntries(
    NAV_FEATURES.filter((feature) => changes[feature] !== undefined).map(
      (feature) => [COLUMN_BY_FEATURE[feature], changes[feature]],
    ),
  );

  if (Object.keys(fields).length === 0) return;

  const { error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", userId);

  if (error) throw error;
}

export function getPreferenceErrorMessage(error: unknown): string {
  return getErrorMessage(error, "Erreur lors de l'enregistrement de la préférence");
}
