import type {
  CreateNoteInput,
  Note,
  NoteAttachment,
  NoteStatus,
  UpdateNoteInput,
} from "@/types/notes";
import { mergeOptions } from "@/utils/options";
import { notesTable } from "./airtable-client";
import {
  AIRTABLE_NOTES_ASSIGNEES_FIELD,
  AIRTABLE_NOTES_ATTACHMENTS_FIELD,
  AIRTABLE_NOTES_CONTENT_FIELD,
  AIRTABLE_NOTES_CREATED_AT_FIELD,
  AIRTABLE_NOTES_ID_FIELD,
  AIRTABLE_NOTES_STATUS_FIELD,
  AIRTABLE_NOTES_TAGS_FIELD,
} from "./airtable-config";

type AirtableAttachmentInput = { url: string };

function buildUserNotesFilter(userEmail: string): string {
  return `OR({${AIRTABLE_NOTES_ASSIGNEES_FIELD}} = "${userEmail}", FIND("${userEmail}", ARRAYJOIN({${AIRTABLE_NOTES_ASSIGNEES_FIELD}})))`;
}

function mapAttachments(value: unknown): NoteAttachment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is NoteAttachment =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "url" in item &&
        "filename" in item,
    )
    .map((item) => ({
      id: String(item.id),
      url: String(item.url),
      filename: String(item.filename),
      size: typeof item.size === "number" ? item.size : undefined,
      type: typeof item.type === "string" ? item.type : undefined,
    }));
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map(String).map((tag) => tag.trim()).filter(Boolean))];
}

function mapAssigneeIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value) {
    return [value];
  }
  return [];
}

function mapRecordToNote(record: {
  id: string;
  fields: Record<string, unknown>;
}): Note {
  const status = record.fields[AIRTABLE_NOTES_STATUS_FIELD];

  return {
    id: record.id,
    noteNumber: Number(record.fields[AIRTABLE_NOTES_ID_FIELD] ?? 0),
    createdAt: String(record.fields[AIRTABLE_NOTES_CREATED_AT_FIELD] ?? ""),
    content: String(record.fields[AIRTABLE_NOTES_CONTENT_FIELD] ?? ""),
    assigneeIds: mapAssigneeIds(record.fields[AIRTABLE_NOTES_ASSIGNEES_FIELD]),
    status: status === "Commune" ? "Commune" : "Perso",
    attachments: mapAttachments(record.fields[AIRTABLE_NOTES_ATTACHMENTS_FIELD]),
    tags: mapTags(record.fields[AIRTABLE_NOTES_TAGS_FIELD]),
  };
}

function sortNotesByCreatedAt(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function toAirtableAttachments(urls: string[]): AirtableAttachmentInput[] {
  return urls.map((url) => ({ url }));
}

function buildNoteFields(
  editorId: string,
  input: CreateNoteInput | UpdateNoteInput,
): Record<string, string | string[] | AirtableAttachmentInput[]> {
  // Une note n'a plus qu'un destinataire : son auteur. Le champ Assignees et le
  // statut restent écrits pour ne pas dépeupler la base tant qu'on est sur
  // Airtable ; ils disparaîtront avec la migration.
  return {
    [AIRTABLE_NOTES_CONTENT_FIELD]: input.content.trim(),
    [AIRTABLE_NOTES_ASSIGNEES_FIELD]: [editorId],
    [AIRTABLE_NOTES_STATUS_FIELD]: "Perso" satisfies NoteStatus,
    [AIRTABLE_NOTES_ATTACHMENTS_FIELD]: toAirtableAttachments(input.attachmentUrls),
    [AIRTABLE_NOTES_TAGS_FIELD]: mergeOptions(input.tags),
  };
}

export async function getNotesForUser(userEmail: string): Promise<Note[]> {
  const records = await notesTable
    .select({
      filterByFormula: buildUserNotesFilter(userEmail),
    })
    .all();

  return sortNotesByCreatedAt(records.map(mapRecordToNote));
}

export async function createNote(
  creatorId: string,
  input: CreateNoteInput,
): Promise<{ note: Note | null; error?: string }> {
  try {
    const content = input.content.trim();
    if (!content) {
      return { note: null, error: "Le contenu de la note est requis" };
    }

    const createdAt = new Date().toISOString().split("T")[0];
    const fields = {
      ...buildNoteFields(creatorId, input),
      [AIRTABLE_NOTES_CREATED_AT_FIELD]: createdAt,
    };

    // typecast : un tag absent du multi-select Airtable y est créé automatiquement.
    const records = await notesTable.create([{ fields: fields as never }], {
      typecast: true,
    });
    const record = records[0];
    return { note: mapRecordToNote(record) };
  } catch (error: unknown) {
    console.error("Create note error:", error);
    return {
      note: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la création de la note",
    };
  }
}

export async function updateNote(
  editorId: string,
  input: UpdateNoteInput,
): Promise<{ note: Note | null; error?: string }> {
  try {
    const content = input.content.trim();
    if (!content) {
      return { note: null, error: "Le contenu de la note est requis" };
    }

    const records = await notesTable.update(
      [{ id: input.id, fields: buildNoteFields(editorId, input) as never }],
      { typecast: true },
    );
    const record = records[0];

    return { note: mapRecordToNote(record) };
  } catch (error: unknown) {
    console.error("Update note error:", error);
    return {
      note: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de la note",
    };
  }
}

export async function deleteNote(
  noteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await notesTable.destroy([noteId]);
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete note error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression de la note",
    };
  }
}
