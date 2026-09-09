import type {
  CreateDepositInput,
  Deposit,
  UpdateDepositInput,
} from "@/types/travel-savings";
import { getErrorMessage, supabase } from "./supabase-client";

type DepositRow = {
  id: string;
  user_id: string;
  amount: number;
  author: string | null;
  date: string | null;
  note: string | null;
};

function toDeposit(row: DepositRow): Deposit {
  return {
    id: row.id,
    amount: Number(row.amount) || 0,
    author: row.author ?? "",
    userId: row.user_id,
    date: row.date ?? "",
    note: row.note ?? "",
  };
}

function toRow(input: CreateDepositInput | UpdateDepositInput) {
  return {
    amount: input.amount,
    author: input.author,
    date: input.date || null,
    note: input.note.trim(),
  };
}

/** Versements de l'utilisateur, du plus récent au plus ancien. */
export async function getDeposits(): Promise<Deposit[]> {
  const { data, error } = await supabase
    .from("travel_savings")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Get deposits error:", error);
    throw error;
  }

  return (data ?? []).map(toDeposit);
}

export async function createDeposit(
  input: CreateDepositInput,
): Promise<{ deposit: Deposit | null; error?: string }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { deposit: null, error: "Montant invalide" };
  }

  const { data, error } = await supabase
    .from("travel_savings")
    .insert({ ...toRow(input), user_id: input.userId })
    .select()
    .single();

  if (error || !data) {
    console.error("Create deposit error:", error);
    return {
      deposit: null,
      error: getErrorMessage(error, "Erreur lors de l'enregistrement du versement"),
    };
  }

  return { deposit: toDeposit(data) };
}

export async function updateDeposit(
  input: UpdateDepositInput,
): Promise<{ deposit: Deposit | null; error?: string }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { deposit: null, error: "Montant invalide" };
  }

  const { data, error } = await supabase
    .from("travel_savings")
    .update(toRow(input))
    .eq("id", input.id)
    .select()
    .single();

  if (error || !data) {
    console.error("Update deposit error:", error);
    return {
      deposit: null,
      error: getErrorMessage(error, "Erreur lors de la mise à jour du versement"),
    };
  }

  return { deposit: toDeposit(data) };
}

export async function deleteDeposit(
  depositId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("travel_savings")
    .delete()
    .eq("id", depositId);

  if (error) {
    console.error("Delete deposit error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression du versement"),
    };
  }

  return { success: true };
}
