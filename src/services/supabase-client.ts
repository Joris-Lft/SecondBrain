import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase partagé.
 *
 * La clé publishable est publique par conception : elle n'ouvre que ce que les
 * politiques Row Level Security autorisent, et chaque table du schéma en a une.
 * C'est ce qui remplace la clé Airtable, qui elle donnait un accès total à la
 * base depuis le bundle.
 */
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requis.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/** Message lisible tiré d'une erreur Supabase, ou d'une erreur quelconque. */
export function getErrorMessage(
  error: unknown,
  fallback = "Une erreur est survenue",
): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
