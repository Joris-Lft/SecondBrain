import {
  AIRTABLE_SHOW_HABITS_FIELD,
  AIRTABLE_SHOW_PERSONAL_PROJECTS_FIELD,
} from "./airtable-config";
import { usersTable } from "./airtable-client";
import type {
  NavFeature,
  NavigationPreferences,
} from "@/types/navigation-preferences";

/** Champ Airtable (case à cocher) correspondant à chaque fonctionnalité. */
const FIELD_BY_FEATURE: Record<NavFeature, string> = {
  habits: AIRTABLE_SHOW_HABITS_FIELD,
  personalProjects: AIRTABLE_SHOW_PERSONAL_PROJECTS_FIELD,
};

const NAV_FEATURES = Object.keys(FIELD_BY_FEATURE) as NavFeature[];

export function parseNavigationPreferences(
  fields: Record<string, unknown>,
): NavigationPreferences {
  return Object.fromEntries(
    NAV_FEATURES.map((feature) => [
      feature,
      fields[FIELD_BY_FEATURE[feature]] === true,
    ]),
  ) as NavigationPreferences;
}

export async function fetchNavigationPreferences(
  userId: string,
): Promise<NavigationPreferences> {
  const record = await usersTable.find(userId);
  return parseNavigationPreferences(record.fields);
}

/**
 * N'écrit que les champs fournis. Envoyer les trois systématiquement
 * réécrirait des préférences qu'on n'a peut-être jamais réussi à lire.
 */
export async function updateNavigationPreferences(
  userId: string,
  changes: Partial<NavigationPreferences>,
): Promise<void> {
  const fields = Object.fromEntries(
    NAV_FEATURES.filter((feature) => changes[feature] !== undefined).map(
      (feature) => [FIELD_BY_FEATURE[feature], changes[feature]],
    ),
  );

  if (Object.keys(fields).length === 0) return;

  await usersTable.update(userId, fields);
}

export function getAirtableErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erreur lors de l'enregistrement de la préférence";
}
