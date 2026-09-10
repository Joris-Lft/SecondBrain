import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNote,
  deleteNote,
  getNotesForUser,
  updateNote,
} from "@/services/notes";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@/types/notes";
import { collectUniqueTags } from "@/utils/tags";

export function notesQueryKey(userEmail: string | undefined) {
  return ["notes", userEmail] as const;
}

/**
 * Options proposées à la saisie et au filtrage.
 *
 * Elles se déduisent des notes déjà chargées, et d'elles seules. Une requête
 * dédiée existait du temps d'Airtable, où les tags vivaient dans le schéma
 * d'un champ multi-select ; en base, ils n'existent que sur les notes. Deux
 * sources pour la même donnée laissaient le filtre proposer un tag qu'aucune
 * note chargée ne portait — un filtre qui ne renvoyait rien.
 */
export function useNoteTagOptions(notes: Note[] = []) {
  return useMemo(() => collectUniqueTags(notes), [notes]);
}

export function useNotes(userEmail: string | undefined) {
  return useQuery({
    queryKey: notesQueryKey(userEmail),
    queryFn: getNotesForUser,
    enabled: !!userEmail,
  });
}

export function useCreateNote(
  userId: string | undefined,
  userEmail: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      if (!userId) throw new Error("Utilisateur non connecté");
      const result = await createNote(userId, input);
      if (!result.note) throw new Error(result.error ?? "Création impossible");
      return result.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(userEmail) });
    },
  });
}

export function useUpdateNote(
  userId: string | undefined,
  userEmail: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNoteInput) => {
      if (!userId) throw new Error("Utilisateur non connecté");
      const result = await updateNote(userId, input);
      if (!result.note) throw new Error(result.error ?? "Mise à jour impossible");
      return result.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(userEmail) });
    },
  });
}

export function useDeleteNote(userEmail: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const result = await deleteNote(noteId);
      if (!result.success) throw new Error(result.error ?? "Suppression impossible");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(userEmail) });
    },
  });
}
