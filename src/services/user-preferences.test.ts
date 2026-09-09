import { describe, expect, it, vi } from "vitest";

// Le client Supabase s'instancie à l'import et exige une URL : on le remplace
// pour tester la logique pure du service.
const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
vi.mock("./supabase-client", () => ({
  supabase: { from: () => ({ update, select: vi.fn() }) },
  getErrorMessage: (error: unknown, fallback: string) =>
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : fallback,
}));

const {
  getAirtableErrorMessage,
  parseNavigationPreferences,
  updateNavigationPreferences,
} = await import("./user-preferences");

describe("parseNavigationPreferences", () => {
  it("lit les deux cases à cocher", () => {
    expect(
      parseNavigationPreferences({
        show_habits: true,
        show_personal_projects: true,
      }),
    ).toEqual({ habits: true, personalProjects: true });
  });

  it("traite une colonne absente comme décochée", () => {
    expect(parseNavigationPreferences({})).toEqual({
      habits: false,
      personalProjects: false,
    });
  });

  it("n'accepte que le booléen true, pas les valeurs truthy", () => {
    expect(
      parseNavigationPreferences({ show_habits: "true", show_personal_projects: 1 }),
    ).toEqual({ habits: false, personalProjects: false });
  });

  it("ignore les colonnes inconnues", () => {
    expect(parseNavigationPreferences({ autre: true })).toEqual({
      habits: false,
      personalProjects: false,
    });
  });
});

describe("updateNavigationPreferences", () => {
  it("n'écrit que le champ fourni", async () => {
    // Écrire les deux systématiquement réactiverait silencieusement une
    // fonctionnalité que l'utilisateur avait désactivée.
    update.mockClear();
    await updateNavigationPreferences("u1", { habits: false });

    expect(update).toHaveBeenCalledWith({ show_habits: false });
  });

  it("n'écrit rien quand aucun champ n'est fourni", async () => {
    update.mockClear();
    await updateNavigationPreferences("u1", {});

    expect(update).not.toHaveBeenCalled();
  });

  it("ignore les champs explicitement undefined", async () => {
    update.mockClear();
    await updateNavigationPreferences("u1", {
      habits: undefined,
      personalProjects: true,
    });

    expect(update).toHaveBeenCalledWith({ show_personal_projects: true });
  });
});

describe("getAirtableErrorMessage", () => {
  it("retourne le message porté par l'erreur", () => {
    expect(getAirtableErrorMessage({ message: "Boom" })).toBe("Boom");
  });

  it("retombe sur un message générique", () => {
    expect(getAirtableErrorMessage(null)).toBe(
      "Erreur lors de l'enregistrement de la préférence",
    );
  });
});
