import type {
  CreateNoteInput,
  Note,
  NoteAttachment,
  UpdateNoteInput,
} from "@/types/notes";
import { mergeOptions } from "@/utils/options";
import { getErrorMessage, supabase } from "./supabase-client";

type AttachmentRow = {
  id: string;
  url: string;
  filename: string;
  size: number | null;
  type: string | null;
};

type NoteRow = {
  id: string;
  note_number: number | null;
  content: string;
  tags: string[] | null;
  created_at: string | null;
  note_attachments?: AttachmentRow[] | null;
};

/** La note et ses pièces jointes en une requête, plutôt qu'un aller-retour par note. */
const NOTE_SELECT = "*, note_attachments(*)";

function toAttachment(row: AttachmentRow): NoteAttachment {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    size: row.size ?? undefined,
    type: row.type ?? undefined,
  };
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    noteNumber: row.note_number ?? 0,
    createdAt: row.created_at ?? "",
    content: row.content ?? "",
    attachments: (row.note_attachments ?? []).map(toAttachment),
    tags: mergeOptions(row.tags ?? []),
  };
}

/** Nom de fichier lisible tiré d'une URL, pour l'affichage des pièces jointes. */
function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() || "piece-jointe");
  } catch {
    return "piece-jointe";
  }
}

/**
 * Remplace les pièces jointes d'une note par la liste fournie.
 *
 * Le formulaire renvoie l'état final voulu, pas un delta : on repart donc de
 * zéro plutôt que de tenter un rapprochement ligne à ligne.
 */
async function replaceAttachments(noteId: string, urls: string[]) {
  const { error: deleteError } = await supabase
    .from("note_attachments")
    .delete()
    .eq("note_id", noteId);
  if (deleteError) throw deleteError;

  if (urls.length === 0) return;

  const { error } = await supabase.from("note_attachments").insert(
    urls.map((url) => ({
      note_id: noteId,
      url,
      filename: filenameFromUrl(url),
    })),
  );
  if (error) throw error;
}

/** Notes de l'utilisateur : la RLS se charge du filtre. */
export async function getNotesForUser(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get notes error:", error);
    throw error;
  }

  return (data ?? []).map(toNote);
}

export async function createNote(
  userId: string,
  input: CreateNoteInput,
): Promise<{ note: Note | null; error?: string }> {
  const content = input.content.trim();
  if (!content) {
    return { note: null, error: "Le contenu de la note est requis" };
  }

  try {
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        content,
        tags: mergeOptions(input.tags),
        created_at: new Date().toISOString().split("T")[0],
      })
      .select(NOTE_SELECT)
      .single();

    if (error || !data) throw error;

    await replaceAttachments(data.id, input.attachmentUrls);

    return { note: { ...toNote(data), attachments: [] } };
  } catch (error: unknown) {
    console.error("Create note error:", error);
    return {
      note: null,
      error: getErrorMessage(error, "Erreur lors de la création de la note"),
    };
  }
}

export async function updateNote(
  _userId: string,
  input: UpdateNoteInput,
): Promise<{ note: Note | null; error?: string }> {
  const content = input.content.trim();
  if (!content) {
    return { note: null, error: "Le contenu de la note est requis" };
  }

  try {
    const { data, error } = await supabase
      .from("notes")
      .update({ content, tags: mergeOptions(input.tags) })
      .eq("id", input.id)
      .select(NOTE_SELECT)
      .single();

    if (error || !data) throw error;

    await replaceAttachments(input.id, input.attachmentUrls);

    return { note: toNote(data) };
  } catch (error: unknown) {
    console.error("Update note error:", error);
    return {
      note: null,
      error: getErrorMessage(error, "Erreur lors de la mise à jour de la note"),
    };
  }
}

export async function deleteNote(
  noteId: string,
): Promise<{ success: boolean; error?: string }> {
  // Les pièces jointes suivent par cascade côté base.
  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) {
    console.error("Delete note error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Erreur lors de la suppression de la note"),
    };
  }

  return { success: true };
}
