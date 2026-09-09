import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNote,
  deleteNote,
  getNoteTagOptions,
  getNotesForUser,
  updateNote,
} from "@/services/notes";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@/types/notes";
import { mergeOptions } from "@/utils/options";
import { collectUniqueTags } from "@/utils/tags";

export function notesQueryKey(userEmail: string | undefined) {
  return ["notes", userEmail] as const;
}

export function noteTagOptionsQueryKey() {
  return ["noteTagOptions"] as const;
}

export function useNoteTagOptions(notes: Note[] = []) {
  const query = useQuery({
    queryKey: noteTagOptionsQueryKey(),
    queryFn: getNoteTagOptions,
    staleTime: 5 * 60 * 1000,
  });

  // Les tags déjà posés sur les notes complètent les options chargées : un tag
  // tout juste créé reste visible même si le cache des options n'a pas suivi.
  const options = useMemo(
    () =>
      mergeOptions(query.data ?? [], collectUniqueTags(notes)).sort((a: string, b: string) =>
        a.localeCompare(b, "fr"),
      ),
    [query.data, notes],
  );

  return { ...query, options };
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
      void queryClient.invalidateQueries({ queryKey: noteTagOptionsQueryKey() });
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
      void queryClient.invalidateQueries({ queryKey: noteTagOptionsQueryKey() });
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
