import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  createTravel,
  deleteTravel,
  getTravelById,
  getTravels,
  updateTravel,
} from "@/services/travels";
import type {
  CreateTravelInput,
  Travel,
  UpdateTravelInput,
} from "@/types/travels";
import { travelBudgetTotalsQueryKey } from "./use-travel-budget";

export function travelsQueryKey(userEmail: string | undefined) {
  return ["travels", userEmail ?? null] as const;
}

export function travelQueryKey(travelId: string | undefined) {
  return ["travel", travelId] as const;
}

export function useTravels() {
  const { user } = useAuth();
  const userEmail = user?.email;

  return useQuery({
    queryKey: travelsQueryKey(userEmail),
    queryFn: () => getTravels(userEmail),
  });
}

export function useTravel(travelId: string | undefined) {
  return useQuery({
    queryKey: travelQueryKey(travelId),
    queryFn: () => getTravelById(travelId!),
    enabled: !!travelId,
  });
}

export function useCreateTravel(userEmail: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTravelInput): Promise<Travel> => {
      if (!userEmail) throw new Error("Utilisateur non connecté");
      const result = await createTravel(userEmail, input);
      if (!result.travel) throw new Error(result.error ?? "Création impossible");
      return result.travel;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: travelsQueryKey(userEmail),
      });
    },
  });
}

export function useUpdateTravel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateTravelInput): Promise<Travel> => {
      const result = await updateTravel(input);
      if (!result.travel) throw new Error(result.error ?? "Mise à jour impossible");
      return result.travel;
    },
    onSuccess: (travel) => {
      void queryClient.invalidateQueries({
        queryKey: travelsQueryKey(user?.email),
      });
      void queryClient.invalidateQueries({
        queryKey: travelQueryKey(travel.id),
      });
    },
  });
}

export function useDeleteTravel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (travelId: string) => {
      const result = await deleteTravel(travelId);
      if (!result.success) throw new Error(result.error ?? "Suppression impossible");
    },
    onSuccess: (_data, travelId) => {
      void queryClient.invalidateQueries({
        queryKey: travelsQueryKey(user?.email),
      });
      void queryClient.removeQueries({ queryKey: travelQueryKey(travelId) });
      void queryClient.invalidateQueries({
        queryKey: travelBudgetTotalsQueryKey(),
      });
    },
  });
}
