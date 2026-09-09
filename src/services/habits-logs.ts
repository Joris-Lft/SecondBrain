import type { CreateHabitLogInput, HabitLog } from "@/types/habits";
import { getErrorMessage, supabase } from "./supabase-client";

type HabitLogRow = {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  frequency: HabitLog["frequency"];
  period: string;
};

function toHabitLog(row: HabitLogRow): HabitLog {
  return {
    id: row.id,
    habit_id: row.habit_id,
    user_id: row.user_id,
    completed_at: row.completed_at,
    frequency: row.frequency,
    period: row.period,
  };
}

/**
 * Logs couvrant les périodes demandées. Le filtre par utilisateur est assuré
 * par la RLS ; la pagination d'Airtable, qui coûtait un appel par tranche de
 * cent lignes, n'a plus d'équivalent.
 */
export async function getHabitLogsForPeriods(
  periodKeys: string[],
): Promise<HabitLog[]> {
  if (periodKeys.length === 0) return [];

  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .in("period", periodKeys);

  if (error) {
    // On trace puis on relaie : l'appelant doit voir l'échec, pas une liste vide.
    console.error("Get habit logs for periods error:", error);
    throw error;
  }

  return (data ?? []).map(toHabitLog);
}

export async function createHabitLog(
  logData: CreateHabitLogInput,
): Promise<{ log: HabitLog | null; error?: string }> {
  const { data, error } = await supabase
    .from("habit_logs")
    .insert({
      habit_id: logData.habit_id,
      user_id: logData.user_id,
      completed_at: logData.completed_at ?? new Date().toISOString(),
      frequency: logData.frequency,
      period: logData.period,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Create habit log error:", error);
    return {
      log: null,
      error: getErrorMessage(error, "Erreur lors de l'enregistrement"),
    };
  }

  return { log: toHabitLog(data) };
}

export async function deleteHabitLog(
  logId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("habit_logs").delete().eq("id", logId);

  if (error) {
    console.error("Delete habit log error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression"),
    };
  }

  return { success: true };
}
