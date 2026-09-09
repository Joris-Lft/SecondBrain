import type {
  CreateTravelInput,
  Travel,
  UpdateTravelInput,
} from "@/types/travels";
import { getErrorMessage, supabase } from "./supabase-client";

type TravelRow = {
  id: string;
  name: string;
  cover_url: string | null;
  is_voyage: boolean;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: string | null;
};

function toTravel(row: TravelRow): Travel {
  return {
    id: row.id,
    name: row.name ?? "",
    coverUrl: row.cover_url,
    isVoyage: row.is_voyage === true,
    destination: row.destination ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    description: row.description ?? "",
    createdAt: row.created_at ?? "",
  };
}

function toRow(input: CreateTravelInput | UpdateTravelInput) {
  return {
    name: input.name.trim(),
    cover_url: input.coverUrl,
    is_voyage: input.isVoyage,
    destination: input.destination.trim(),
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    description: input.description.trim(),
  };
}

/** Projets de l'utilisateur, du plus récent au plus ancien. RLS pour le filtre. */
export async function getTravels(): Promise<Travel[]> {
  const { data, error } = await supabase
    .from("travels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get travels error:", error);
    throw error;
  }

  return (data ?? []).map(toTravel);
}

export async function getTravelById(travelId: string): Promise<Travel> {
  const { data, error } = await supabase
    .from("travels")
    .select("*")
    .eq("id", travelId)
    .single();

  if (error || !data) {
    console.error("Get travel error:", error);
    throw error ?? new Error("Projet introuvable");
  }

  return toTravel(data);
}

export async function createTravel(
  userId: string,
  input: CreateTravelInput,
): Promise<{ travel: Travel | null; error?: string }> {
  if (!input.name.trim()) {
    return { travel: null, error: "Le nom du projet est requis" };
  }

  const { data, error } = await supabase
    .from("travels")
    .insert({
      ...toRow(input),
      user_id: userId,
      created_at: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Create travel error:", error);
    return {
      travel: null,
      error: getErrorMessage(error, "Erreur lors de la création du projet"),
    };
  }

  return { travel: toTravel(data) };
}

export async function updateTravel(
  input: UpdateTravelInput,
): Promise<{ travel: Travel | null; error?: string }> {
  if (!input.name.trim()) {
    return { travel: null, error: "Le nom du projet est requis" };
  }

  const { data, error } = await supabase
    .from("travels")
    .update(toRow(input))
    .eq("id", input.id)
    .select()
    .single();

  if (error || !data) {
    console.error("Update travel error:", error);
    return {
      travel: null,
      error: getErrorMessage(error, "Erreur lors de la mise à jour du projet"),
    };
  }

  return { travel: toTravel(data) };
}

/**
 * Les lignes de budget partent en cascade : `travel_budget.travel_id` est une
 * vraie clé étrangère, là où Airtable imposait de les supprimer à la main.
 */
export async function deleteTravel(
  travelId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("travels").delete().eq("id", travelId);

  if (error) {
    console.error("Delete travel error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression du projet"),
    };
  }

  return { success: true };
}
