import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  createDeposit,
  deleteDeposit,
  getDeposits,
  updateDeposit,
} from "@/services/travel-savings";
import type {
  CreateDepositInput,
  Deposit,
  UpdateDepositInput,
} from "@/types/travel-savings";
import { useTravelBudgetTotals } from "./use-travel-budget";
import { useTravels } from "./use-travels";

export function travelSavingsQueryKey(userEmail: string | undefined) {
  return ["travel-savings", userEmail ?? null] as const;
}

export function useDeposits() {
  const { user } = useAuth();
  const userEmail = user?.email;

  return useQuery({
    queryKey: travelSavingsQueryKey(userEmail),
    queryFn: () => getDeposits(userEmail),
  });
}

/**
 * Solde de la cagnotte : total versé, déjà dépensé et disponible (versé −
 * dépensé, borné à 0). Les achats de tous les projets la débitent.
 */
export function useAvailableSavings() {
  const { data: deposits = [] } = useDeposits();
  const { data: travels = [] } = useTravels();
  const { data: budgetSummary } = useTravelBudgetTotals();

  const total = deposits.reduce((sum, d) => sum + d.amount, 0);
  const spent = travels.reduce(
    (sum, travel) =>
      sum + (budgetSummary?.purchasedSpendByTravel[travel.id] ?? 0),
    0,
  );

  return { total, spent, available: Math.max(0, total - spent) };
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateDepositInput): Promise<Deposit> => {
      const result = await createDeposit(input);
      if (!result.deposit) throw new Error(result.error ?? "Enregistrement impossible");
      return result.deposit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: travelSavingsQueryKey(user?.email),
      });
    },
  });
}

export function useUpdateDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: UpdateDepositInput): Promise<Deposit> => {
      const result = await updateDeposit(input);
      if (!result.deposit) throw new Error(result.error ?? "Mise à jour impossible");
      return result.deposit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: travelSavingsQueryKey(user?.email),
      });
    },
  });
}

export function useDeleteDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (depositId: string) => {
      const result = await deleteDeposit(depositId);
      if (!result.success) throw new Error(result.error ?? "Suppression impossible");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: travelSavingsQueryKey(user?.email),
      });
    },
  });
}
