import type { Note } from "@/types/notes";
import { normalizeOptionLabel } from "./options";

/** Longueur maximale d'un titre dérivé avant troncature. */
export const MAX_NOTE_TITLE_LENGTH = 80;

// La séquence fermante d'un titre ATX doit être précédée d'une espace :
// « # Note sur C# » garde son dièse final.
const HEADING_REGEX = /^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#*)?\s*$/;
const FENCE_REGEX = /^\s{0,3}(`{3,}|~{3,})/;
const INDENTED_CODE_REGEX = /^(?: {4}|\t)/;

/**
 * Retire les blocs de code : délimités (``` ou ~~~) et indentés (4 espaces ou
 * une tabulation après une ligne vide). Partagé par la dérivation du titre et
 * l'extraction des liens, pour que l'index et le rendu markdown s'accordent
 * sur ce qui compte comme contenu.
 */
export function stripCodeBlocks(content: string): string {
  const kept: string[] = [];
  let fence: string | null = null;
  let previousWasBlank = true;

  for (const line of content.split("\n")) {
    const match = FENCE_REGEX.exec(line);

    if (fence) {
      // Une clôture doit utiliser le même caractère et être au moins aussi longue.
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    if (match) {
      fence = match[1];
      previousWasBlank = false;
      continue;
    }

    const isBlank = !line.trim();

    // Un bloc indenté ne peut commencer qu'après une ligne vide : sinon c'est
    // la continuation d'un paragraphe ou d'un élément de liste.
    if (previousWasBlank && INDENTED_CODE_REGEX.test(line)) {
      continue;
    }

    previousWasBlank = isBlank;
    kept.push(line);
  }

  return kept.join("\n");
}

/** Retire le balisage markdown inline pour garder un titre lisible. */
function stripInlineMarkdown(line: string): string {
  return line
    .replace(/^\s*>+\s*/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\s*(?:\[[ xX]\]\s+)?/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^[\]|\n]+)\|([^[\]\n]+)\]\]/g, "$2")
    .replace(/\[\[([^[\]\n]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*\*|___)(.+?)\1/g, "$2")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`+([^`]+)`+/g, "$1");
}

/**
 * Titre d'une note, dérivé de sa **première ligne non vide** (titre markdown
 * ou texte brut). Les notes n'ont pas de champ titre en base.
 *
 * Volontairement limité à la première ligne : un `## Section` plus bas dans la
 * note ferait un titre que l'utilisateur ne lit pas en premier, et qui
 * changerait au gré des réorganisations du corps.
 */
export function deriveNoteTitle(
  note: Pick<Note, "content" | "noteNumber">,
): string {
  const firstLine =
    stripCodeBlocks(note.content ?? "")
      .split("\n")
      .find((line) => line.trim()) ?? "";

  const heading = HEADING_REGEX.exec(firstLine);
  const candidate = heading ? heading[2] : firstLine;

  const title = normalizeOptionLabel(stripInlineMarkdown(candidate));

  if (!title) {
    return note.noteNumber > 0 ? `Note #${note.noteNumber}` : "Note sans titre";
  }

  return title.length > MAX_NOTE_TITLE_LENGTH
    ? `${title.slice(0, MAX_NOTE_TITLE_LENGTH - 1).trimEnd()}…`
    : title;
}

/**
 * Clé de comparaison d'un titre : insensible à la casse, aux espaces et à la
 * forme de normalisation Unicode. Le NFC est indispensable — du texte collé
 * depuis macOS porte des accents décomposés, et "Café" ≠ "Café" casserait les
 * liens sans aucun signal visible.
 */
export function titleKey(title: string): string {
  return normalizeOptionLabel(title).normalize("NFC").toLowerCase();
}

/** De la plus récente à la plus ancienne, sans modifier le tableau reçu. */
export function sortNotesByCreatedAt(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
