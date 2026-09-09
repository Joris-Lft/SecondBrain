import type {
  CreateHabitInput,
  Habit,
  HabitFrequency,
  UpdateHabitInput,
} from "@/types/habits";
import { getErrorMessage, supabase } from "./supabase-client";

type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  frequency: HabitFrequency;
  created_at: string | null;
  is_active: boolean;
  deleted_date: string | null;
};

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    frequency: row.frequency,
    created_at: row.created_at ?? undefined,
  };
}

export async function createHabit(
  userId: string,
  habitData: CreateHabitInput,
): Promise<{ habit: Habit | null; error?: string }> {
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name: habitData.name,
      frequency: habitData.frequency,
      created_at: habitData.createdAt,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Create habit error:", error);
    return {
      habit: null,
      error: getErrorMessage(error, "Erreur lors de la création de l'habit"),
    };
  }

  return { habit: toHabit(data) };
}

/**
 * Habits actifs de l'utilisateur, toutes fréquences confondues : une seule
 * requête sert les trois périodes affichées, le tri par fréquence se fait côté
 * client. Le filtre par utilisateur est assuré par la RLS.
 *
 * Laisse remonter l'erreur : une liste vide serait indiscernable d'un
 * utilisateur sans habit, et ferait recréer des logs déjà existants.
 */
export async function getActiveHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Get active habits error:", error);
    throw error;
  }

  return (data ?? []).map(toHabit);
}

export async function updateHabit(
  updates: UpdateHabitInput,
): Promise<{ habit: Habit | null; error?: string }> {
  const fields: Record<string, unknown> = {};
  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.frequency !== undefined) fields.frequency = updates.frequency;
  if (updates.createdAt !== undefined) fields.created_at = updates.createdAt;

  const { data, error } = await supabase
    .from("habits")
    .update(fields)
    .eq("id", updates.id)
    .select()
    .single();

  if (error || !data) {
    console.error("Update habit error:", error);
    return {
      habit: null,
      error: getErrorMessage(error, "Erreur lors de la mise à jour de l'habit"),
    };
  }

  return { habit: toHabit(data) };
}

/**
 * Suppression logique : les logs déjà enregistrés gardent leur sens, et
 * l'historique de l'arc reste complet.
 */
export async function deleteHabit(
  habitId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("habits")
    .update({
      is_active: false,
      deleted_date: new Date().toISOString().split("T")[0],
    })
    .eq("id", habitId);

  if (error) {
    console.error("Delete habit error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression de l'habit"),
    };
  }

  return { success: true };
}
