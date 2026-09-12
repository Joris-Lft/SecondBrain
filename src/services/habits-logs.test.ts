import { beforeEach, describe, expect, it, vi } from "vitest";

// Le client Supabase s'instancie à l'import et exige une URL : on le remplace
// pour tester la logique du service.
let insertResult: { data: unknown; error: unknown } = { data: null, error: null };
let existingResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("./supabase-client", () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => insertResult }) }),
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () => existingResult,
        };
        return chain;
      },
    }),
  },
  getErrorMessage: (error: unknown, fallback: string) =>
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : fallback,
}));

const { createHabitLog } = await import("./habits-logs");

const INPUT = {
  habit_id: "h1",
  user_id: "u1",
  frequency: "daily" as const,
  period: "2026-09-12",
};

const row = (id: string) => ({
  id,
  habit_id: "h1",
  user_id: "u1",
  completed_at: "2026-09-12T10:52:07.525Z",
  frequency: "daily",
  period: "2026-09-12",
});

describe("createHabitLog", () => {
  beforeEach(() => {
    insertResult = { data: null, error: null };
    existingResult = { data: null, error: null };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renvoie le log créé", async () => {
    insertResult = { data: row("log-1"), error: null };

    const result = await createHabitLog(INPUT);

    expect(result.log?.id).toBe("log-1");
    expect(result.error).toBeUndefined();
  });

  it("traite le doublon comme un succès et renvoie le log déjà en base", async () => {
    // Le cache de l'écran ne rafraîchit pas tout seul : sans ce rattrapage,
    // recocher une période déjà enregistrée échouait indéfiniment.
    insertResult = { data: null, error: { code: "23505", message: "duplicate key" } };
    existingResult = { data: row("log-existant"), error: null };

    const result = await createHabitLog(INPUT);

    expect(result.log?.id).toBe("log-existant");
    expect(result.error).toBeUndefined();
  });

  it("signale le doublon masqué par la RLS", async () => {
    // La contrainte d'unicité est globale, la lecture non : si rien ne revient,
    // la ligne existe mais appartient à un autre compte.
    insertResult = { data: null, error: { code: "23505", message: "duplicate key" } };
    existingResult = { data: null, error: null };

    const result = await createHabitLog(INPUT);

    expect(result.log).toBeNull();
    expect(result.error).toBe("Ce tracking est déjà enregistré pour cette période.");
  });

  it("relaie les autres erreurs", async () => {
    insertResult = { data: null, error: { code: "42501", message: "row-level security" } };

    const result = await createHabitLog(INPUT);

    expect(result.log).toBeNull();
    expect(result.error).toBe("row-level security");
  });
});
