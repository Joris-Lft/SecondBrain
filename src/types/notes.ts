export type NoteStatus = "Perso" | "Commune";

export type NoteAttachment = {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

export type Note = {
  id: string;
  noteNumber: number;
  createdAt: string;
  content: string;
  assigneeIds: string[];
  status: NoteStatus;
  attachments: NoteAttachment[];
  tags: string[];
};

export type NoteFormInput = {
  content: string;
  attachmentUrls: string[];
  tags: string[];
};

export type CreateNoteInput = NoteFormInput;

export type UpdateNoteInput = NoteFormInput & {
  id: string;
};
