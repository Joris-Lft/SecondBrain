import type { Note, NoteAttachment } from "@/types/notes";

let sequence = 0;

/**
 * Note de test. `noteNumber` s'auto-incrémente pour refléter l'ordre de
 * création réel (`note_number`), dont dépend la résolution des
 * titres ambigus.
 */
export function makeNote(overrides: Partial<Note> = {}): Note {
  sequence += 1;

  return {
    id: `rec${sequence}`,
    noteNumber: sequence,
    createdAt: "2026-01-01",
    content: "",
    attachments: [],
    tags: [],
    ...overrides,
  };
}

/** Remet le compteur à zéro, à appeler en `beforeEach` pour des ids stables. */
export function resetNoteSequence() {
  sequence = 0;
}

export function makeAttachment(
  overrides: Partial<NoteAttachment> = {},
): NoteAttachment {
  return {
    id: "att1",
    url: "https://example.test/file.png",
    filename: "file.png",
    ...overrides,
  };
}
