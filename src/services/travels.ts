import type {
  CreateTravelInput,
  Travel,
  UpdateTravelInput,
} from "@/types/travels";
import { travelsTable } from "./airtable-client";
import {
  AIRTABLE_TRAVELS_COVER_FIELD,
  AIRTABLE_TRAVELS_CREATED_AT_FIELD,
  AIRTABLE_TRAVELS_DESCRIPTION_FIELD,
  AIRTABLE_TRAVELS_DESTINATION_FIELD,
  AIRTABLE_TRAVELS_END_DATE_FIELD,
  AIRTABLE_TRAVELS_IS_PERSONAL_FIELD,
  AIRTABLE_TRAVELS_IS_VOYAGE_FIELD,
  AIRTABLE_TRAVELS_NAME_FIELD,
  AIRTABLE_TRAVELS_START_DATE_FIELD,
  AIRTABLE_TRAVELS_USER_ID_FIELD,
} from "./airtable-config";
import { deleteBudgetLinesForTravel } from "./travel-budget";

type AirtableAttachmentInput = { url: string };

function mapCoverUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value.find(
    (item): item is { url: string } =>
      typeof item === "object" && item !== null && "url" in item,
  );
  return first ? String(first.url) : null;
}

function mapRecordToTravel(record: {
  id: string;
  fields: Record<string, unknown>;
}): Travel {
  return {
    id: record.id,
    name: String(record.fields[AIRTABLE_TRAVELS_NAME_FIELD] ?? ""),
    coverUrl: mapCoverUrl(record.fields[AIRTABLE_TRAVELS_COVER_FIELD]),
    isVoyage: Boolean(record.fields[AIRTABLE_TRAVELS_IS_VOYAGE_FIELD]),
      destination: String(record.fields[AIRTABLE_TRAVELS_DESTINATION_FIELD] ?? ""),
    startDate: String(record.fields[AIRTABLE_TRAVELS_START_DATE_FIELD] ?? ""),
    endDate: String(record.fields[AIRTABLE_TRAVELS_END_DATE_FIELD] ?? ""),
    description: String(record.fields[AIRTABLE_TRAVELS_DESCRIPTION_FIELD] ?? ""),
    createdAt: String(record.fields[AIRTABLE_TRAVELS_CREATED_AT_FIELD] ?? ""),
  };
}

function sortTravelsByCreatedAt(travels: Travel[]): Travel[] {
  return [...travels].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function toCoverField(coverUrl: string | null): AirtableAttachmentInput[] {
  return coverUrl ? [{ url: coverUrl }] : [];
}

/**
 * Tous les projets de l'utilisateur : ceux qu'il a créés, et l'historique des
 * anciens projets communs, que le passage en mono-utilisateur lui rattache.
 */
export async function getTravels(
  userEmail: string | undefined,
): Promise<Travel[]> {
  if (!userEmail) return [];

  const records = await travelsTable
    .select({
      filterByFormula: `OR(NOT({${AIRTABLE_TRAVELS_IS_PERSONAL_FIELD}}), {${AIRTABLE_TRAVELS_USER_ID_FIELD}} = "${userEmail}")`,
    })
    .all();
  return sortTravelsByCreatedAt(records.map(mapRecordToTravel));
}

export async function getTravelById(travelId: string): Promise<Travel> {
  const record = await travelsTable.find(travelId);
  return mapRecordToTravel(record);
}

export async function createTravel(
  userEmail: string,
  input: CreateTravelInput,
): Promise<{ travel: Travel | null; error?: string }> {
  try {
    const name = input.name.trim();
    if (!name) {
      return { travel: null, error: "Le nom du projet est requis" };
    }

    const createdAt = new Date().toISOString().split("T")[0];
    const fields = {
      [AIRTABLE_TRAVELS_NAME_FIELD]: name,
      [AIRTABLE_TRAVELS_COVER_FIELD]: toCoverField(input.coverUrl),
      [AIRTABLE_TRAVELS_USER_ID_FIELD]: userEmail,
      [AIRTABLE_TRAVELS_CREATED_AT_FIELD]: createdAt,
      [AIRTABLE_TRAVELS_IS_VOYAGE_FIELD]: input.isVoyage,
      [AIRTABLE_TRAVELS_DESTINATION_FIELD]: input.destination.trim(),
      [AIRTABLE_TRAVELS_START_DATE_FIELD]: input.startDate || null,
      [AIRTABLE_TRAVELS_END_DATE_FIELD]: input.endDate || null,
      [AIRTABLE_TRAVELS_DESCRIPTION_FIELD]: input.description.trim(),
    };

    const records = await travelsTable.create([{ fields: fields as never }]);
    return { travel: mapRecordToTravel(records[0]) };
  } catch (error: unknown) {
    console.error("Create travel error:", error);
    return {
      travel: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la création du projet",
    };
  }
}

export async function updateTravel(
  input: UpdateTravelInput,
): Promise<{ travel: Travel | null; error?: string }> {
  try {
    const name = input.name.trim();
    if (!name) {
      return { travel: null, error: "Le nom du projet est requis" };
    }

    const records = await travelsTable.update([
      {
        id: input.id,
        fields: {
          [AIRTABLE_TRAVELS_NAME_FIELD]: name,
          [AIRTABLE_TRAVELS_COVER_FIELD]: toCoverField(input.coverUrl),
          [AIRTABLE_TRAVELS_IS_VOYAGE_FIELD]: input.isVoyage,
          [AIRTABLE_TRAVELS_DESTINATION_FIELD]: input.destination.trim(),
          [AIRTABLE_TRAVELS_START_DATE_FIELD]: input.startDate || null,
          [AIRTABLE_TRAVELS_END_DATE_FIELD]: input.endDate || null,
          [AIRTABLE_TRAVELS_DESCRIPTION_FIELD]: input.description.trim(),
        } as never,
      },
    ]);

    return { travel: mapRecordToTravel(records[0]) };
  } catch (error: unknown) {
    console.error("Update travel error:", error);
    return {
      travel: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour du projet",
    };
  }
}

/**
 * Supprime le projet et, en amont, ses lignes de budget et activités : le champ
 * travel_id de TravelBudget est un simple texte, Airtable ne cascade pas.
 */
export async function deleteTravel(
  travelId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteBudgetLinesForTravel(travelId);
    await travelsTable.destroy([travelId]);
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete travel error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression du projet",
    };
  }
}
