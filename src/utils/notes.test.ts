import { beforeEach, describe, expect, it } from "vitest";
import { makeNote, resetNoteSequence } from "@/test/factories";
import {
  MAX_NOTE_TITLE_LENGTH,
  deriveNoteTitle,
  sortNotesByCreatedAt,
  stripCodeBlocks,
  titleKey,
} from "./notes";

beforeEach(resetNoteSequence);

const titleOf = (content: string, noteNumber = 1) =>
  deriveNoteTitle({ content, noteNumber });

describe("stripCodeBlocks", () => {
  it("retire un bloc délimité par des backticks", () => {
    expect(stripCodeBlocks("avant\n```js\ncode\n```\naprès")).toBe(
      "avant\naprès",
    );
  });

  it("retire un bloc délimité par des tildes", () => {
    expect(stripCodeBlocks("a\n~~~\nb\n~~~\nc")).toBe("a\nc");
  });

  it("ne ferme pas un bloc sur un délimiteur plus court ou d'un autre type", () => {
    expect(stripCodeBlocks("a\n````\n```\nb\n````\nc")).toBe("a\nc");
    expect(stripCodeBlocks("a\n```\n~~~\nb\n```\nc")).toBe("a\nc");
  });

  it("retire un bloc indenté introduit après une ligne vide", () => {
    expect(stripCodeBlocks("texte\n\n    code 1\n    code 2\nsuite")).toBe(
      "texte\n\nsuite",
    );
  });

  it("retire aussi un bloc indenté par tabulation", () => {
    expect(stripCodeBlocks("texte\n\n\tcode\nsuite")).toBe("texte\n\nsuite");
  });

  it("garde une ligne indentée qui poursuit un paragraphe", () => {
    // Sans ligne vide avant, ce n'est pas un bloc de code mais une continuation.
    expect(stripCodeBlocks("texte\n    suite indentée")).toBe(
      "texte\n    suite indentée",
    );
  });

  it("laisse un contenu sans code intact", () => {
    expect(stripCodeBlocks("a\nb\nc")).toBe("a\nb\nc");
  });
});

describe("deriveNoteTitle", () => {
  it("utilise le titre markdown de la première ligne", () => {
    expect(titleOf("# Recettes\n\ndu texte")).toBe("Recettes");
  });

  it("accepte tous les niveaux de titre", () => {
    expect(titleOf("###### Petit titre")).toBe("Petit titre");
  });

  it("ignore un titre situé plus bas dans la note", () => {
    // Sinon le titre affiché ne serait pas ce que l'utilisateur lit en premier,
    // et il changerait au gré des réorganisations du corps.
    expect(titleOf("Compte rendu réunion\n\n## Actions\n- appeler Paul")).toBe(
      "Compte rendu réunion",
    );
  });

  it("retire la séquence de dièses fermante", () => {
    expect(titleOf("## Titre ##")).toBe("Titre");
  });

  it("garde un dièse collé au dernier mot", () => {
    expect(titleOf("# Note sur C#")).toBe("Note sur C#");
  });

  it("retombe sur la première ligne non vide", () => {
    expect(titleOf("\n\n  Courses de Noël\nsuite")).toBe("Courses de Noël");
  });

  it("nettoie le balisage markdown inline", () => {
    expect(titleOf("**Gras**, `code`, [lien](http://x) et ~~barré~~")).toBe(
      "Gras, code, lien et barré",
    );
  });

  it("nettoie les puces, cases à cocher et citations", () => {
    expect(titleOf("- [ ] Acheter du pain")).toBe("Acheter du pain");
    expect(titleOf("1. Première étape")).toBe("Première étape");
    expect(titleOf("> Citation")).toBe("Citation");
  });

  it("réduit un wikilink à son libellé affiché", () => {
    expect(titleOf("# Voir [[Budget|le budget]]")).toBe("Voir le budget");
    expect(titleOf("# Voir [[Budget]]")).toBe("Voir Budget");
  });

  it("ignore un titre situé dans un bloc de code", () => {
    expect(titleOf("```\n# Pas un titre\n```\nVrai contenu")).toBe(
      "Vrai contenu",
    );
  });

  it("normalise les espaces superflus", () => {
    expect(titleOf("#   Trop    d'espaces  ")).toBe("Trop d'espaces");
  });

  it("tronque un titre trop long", () => {
    const title = titleOf("x".repeat(200));
    expect(title).toHaveLength(MAX_NOTE_TITLE_LENGTH);
    expect(title.endsWith("…")).toBe(true);
  });

  it("retombe sur le numéro de note quand le contenu est vide", () => {
    expect(titleOf("   \n\n  ", 7)).toBe("Note #7");
  });

  it("retombe sur un libellé générique sans numéro", () => {
    expect(titleOf("", 0)).toBe("Note sans titre");
  });
});

describe("titleKey", () => {
  it("ignore la casse et les espaces superflus", () => {
    expect(titleKey("  Mes   Recettes ")).toBe(titleKey("mes recettes"));
  });

  it("aligne les formes Unicode décomposée et composée", () => {
    // Du texte collé depuis macOS porte des accents décomposés : sans NFC,
    // deux « Café » visuellement identiques ne se résoudraient pas.
    const composed = "Café";
    const decomposed = "Café";
    expect(composed).not.toBe(decomposed);
    expect(titleKey(composed)).toBe(titleKey(decomposed));
  });

  it("distingue deux titres réellement différents", () => {
    expect(titleKey("Recettes")).not.toBe(titleKey("Recette"));
  });
});

describe("sortNotesByCreatedAt", () => {
  it("trie de la plus récente à la plus ancienne", () => {
    const vieille = makeNote({ createdAt: "2026-01-01" });
    const recente = makeNote({ createdAt: "2026-06-01" });

    const result = sortNotesByCreatedAt([vieille, recente]);

    expect(result.map((note) => note.id)).toEqual([recente.id, vieille.id]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const notes = [
      makeNote({ createdAt: "2026-01-01" }),
      makeNote({ createdAt: "2026-06-01" }),
    ];
    const snapshot = [...notes];

    sortNotesByCreatedAt(notes);

    expect(notes).toEqual(snapshot);
  });
});
