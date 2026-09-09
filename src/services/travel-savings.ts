import type {
  CreateDepositInput,
  Deposit,
  UpdateDepositInput,
} from "@/types/travel-savings";
import { travelSavingsTable } from "./airtable-client";
import {
  AIRTABLE_TRAVEL_SAVINGS_AMOUNT_FIELD,
  AIRTABLE_TRAVEL_SAVINGS_AUTHOR_FIELD,
  AIRTABLE_TRAVEL_SAVINGS_DATE_FIELD,
  AIRTABLE_TRAVEL_SAVINGS_NOTE_FIELD,
  AIRTABLE_TRAVEL_SAVINGS_USER_ID_FIELD,
} from "./airtable-config";

function mapNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapRecordToDeposit(record: {
  id: string;
  fields: Record<string, unknown>;
}): Deposit {
  return {
    id: record.id,
    amount: mapNumber(record.fields[AIRTABLE_TRAVEL_SAVINGS_AMOUNT_FIELD]),
    author: String(record.fields[AIRTABLE_TRAVEL_SAVINGS_AUTHOR_FIELD] ?? ""),
    userId: String(record.fields[AIRTABLE_TRAVEL_SAVINGS_USER_ID_FIELD] ?? ""),
    date: String(record.fields[AIRTABLE_TRAVEL_SAVINGS_DATE_FIELD] ?? ""),
    note: String(record.fields[AIRTABLE_TRAVEL_SAVINGS_NOTE_FIELD] ?? ""),
  };
}

function sortByDateDesc(deposits: Deposit[]): Deposit[] {
  return [...deposits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function buildFields(
  input: CreateDepositInput | UpdateDepositInput,
): Record<string, unknown> {
  return {
    [AIRTABLE_TRAVEL_SAVINGS_AMOUNT_FIELD]: input.amount,
    [AIRTABLE_TRAVEL_SAVINGS_AUTHOR_FIELD]: input.author,
    [AIRTABLE_TRAVEL_SAVINGS_USER_ID_FIELD]: input.userId,
    [AIRTABLE_TRAVEL_SAVINGS_DATE_FIELD]: input.date || null,
    [AIRTABLE_TRAVEL_SAVINGS_NOTE_FIELD]: input.note.trim(),
  };
}

/**
 * La cagnotte de l'utilisateur : ses versements, et ceux de l'ancienne cagnotte
 * commune — reconnaissables à leur user_id vide — que le passage en
 * mono-utilisateur lui rattache.
 */
export async function getDeposits(
  userEmail: string | undefined,
): Promise<Deposit[]> {
  if (!userEmail) return [];

  const records = await travelSavingsTable
    .select({
      filterByFormula: `OR({${AIRTABLE_TRAVEL_SAVINGS_USER_ID_FIELD}} = "", {${AIRTABLE_TRAVEL_SAVINGS_USER_ID_FIELD}} = "${userEmail}")`,
    })
    .all();
  const deposits = records
    .map(mapRecordToDeposit)
    // Ignore les lignes vides (dont les 3 lignes par défaut d'Airtable)
    .filter((deposit) => deposit.amount > 0);
  return sortByDateDesc(deposits);
}

export async function createDeposit(
  input: CreateDepositInput,
): Promise<{ deposit: Deposit | null; error?: string }> {
  try {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { deposit: null, error: "Montant invalide" };
    }
    const records = await travelSavingsTable.create([
      { fields: buildFields(input) as never },
    ]);
    return { deposit: mapRecordToDeposit(records[0]) };
  } catch (error: unknown) {
    console.error("Create deposit error:", error);
    return {
      deposit: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement du versement",
    };
  }
}

export async function updateDeposit(
  input: UpdateDepositInput,
): Promise<{ deposit: Deposit | null; error?: string }> {
  try {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { deposit: null, error: "Montant invalide" };
    }
    const records = await travelSavingsTable.update([
      { id: input.id, fields: buildFields(input) as never },
    ]);
    return { deposit: mapRecordToDeposit(records[0]) };
  } catch (error: unknown) {
    console.error("Update deposit error:", error);
    return {
      deposit: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour du versement",
    };
  }
}

export async function deleteDeposit(
  depositId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await travelSavingsTable.destroy([depositId]);
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete deposit error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression du versement",
    };
  }
}
