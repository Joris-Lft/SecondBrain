import { describe, expect, it, vi } from "vitest";

// Le client Airtable s'instancie à l'import et exige une clé d'API : on le
// remplace pour pouvoir tester la logique pure du service.
const update = vi.fn();
vi.mock("./airtable-client", () => ({
  usersTable: { update, find: vi.fn() },
}));

// Les noms de champs viennent de la config (surchargeables par .env) : on les
// lit plutôt que de les coder en dur, pour tester le mappage et non un libellé.
const {
  AIRTABLE_SHOW_HABITS_FIELD: HABITS,
  AIRTABLE_SHOW_PERSONAL_PROJECTS_FIELD: PROJECTS,
} = await import("./airtable-config");

const {
  getAirtableErrorMessage,
  parseNavigationPreferences,
  updateNavigationPreferences,
} = await import("./user-preferences");

describe("parseNavigationPreferences", () => {
  it("lit les deux cases à cocher", () => {
    expect(
      parseNavigationPreferences({
        [HABITS]: true,
        [PROJECTS]: true,
      }),
    ).toEqual({ habits: true, personalProjects: true });
  });

  it("traite une case absente comme décochée", () => {
    // Airtable omet les cases décochées dans les champs renvoyés.
    expect(parseNavigationPreferences({})).toEqual({
      habits: false,
      personalProjects: false,
    });
  });

  it("n'accepte que le booléen true, pas les valeurs truthy", () => {
    expect(
      parseNavigationPreferences({ [HABITS]: "true", [PROJECTS]: 1 }),
    ).toMatchObject({ habits: false, personalProjects: false });
  });

  it("ignore les champs inconnus", () => {
    expect(parseNavigationPreferences({ autre: true })).toEqual({
      habits: false,
      personalProjects: false,
    });
  });
});

describe("updateNavigationPreferences", () => {
  it("n'écrit que le champ fourni", async () => {
    // Écrire les deux systématiquement réactiverait silencieusement des
    // fonctionnalités que l'utilisateur avait désactivées.
    update.mockClear();
    await updateNavigationPreferences("rec1", { habits: false });

    expect(update).toHaveBeenCalledWith("rec1", { [HABITS]: false });
  });

  it("écrit plusieurs champs quand plusieurs sont fournis", async () => {
    update.mockClear();
    await updateNavigationPreferences("rec1", {
      habits: true,
      personalProjects: false,
    });

    expect(update).toHaveBeenCalledWith("rec1", {
      [HABITS]: true,
      [PROJECTS]: false,
    });
  });

  it("n'appelle pas Airtable quand il n'y a rien à écrire", async () => {
    update.mockClear();
    await updateNavigationPreferences("rec1", {});

    expect(update).not.toHaveBeenCalled();
  });

  it("ignore les champs explicitement undefined", async () => {
    update.mockClear();
    await updateNavigationPreferences("rec1", {
      habits: undefined,
      personalProjects: true,
    });

    expect(update).toHaveBeenCalledWith("rec1", { [PROJECTS]: true });
  });
});

describe("getAirtableErrorMessage", () => {
  it("utilise le message porté par l'erreur", () => {
    expect(getAirtableErrorMessage({ message: "Champ inconnu" })).toBe(
      "Champ inconnu",
    );
  });

  it("utilise le message d'une instance Error", () => {
    expect(getAirtableErrorMessage(new Error("Réseau indisponible"))).toBe(
      "Réseau indisponible",
    );
  });

  it("retombe sur un message générique sur un message vide", () => {
    expect(getAirtableErrorMessage({ message: "" })).toContain(
      "Erreur lors de l'enregistrement",
    );
  });

  it("retombe sur un message générique sur une valeur inattendue", () => {
    expect(getAirtableErrorMessage(null)).toContain(
      "Erreur lors de l'enregistrement",
    );
    expect(getAirtableErrorMessage("oups")).toContain(
      "Erreur lors de l'enregistrement",
    );
  });
});
