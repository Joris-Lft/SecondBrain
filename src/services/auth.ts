import { supabase } from "./supabase-client";
import type { LoginCredentials, User } from "@/types/user";

/**
 * Authentification déléguée à Supabase Auth.
 *
 * Le mot de passe n'est plus vérifié côté navigateur : Supabase le hache en
 * bcrypt et gère la session, son jeton et son rafraîchissement. L'ancien
 * couple SHA-256 + sel global, comme le jeton de réinitialisation signé dans
 * le bundle, ont disparu avec cette bascule.
 */

function toUser(id: string, email: string | undefined): User {
  return { id, email: email ?? "" };
}

export async function login(
  credentials: LoginCredentials,
): Promise<{ user: User; error?: undefined } | { user: null; error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password,
  });

  if (error || !data.user) {
    return { user: null, error: "Email ou mot de passe incorrect" };
  }

  return { user: toUser(data.user.id, data.user.email) };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  return sessionUser ? toUser(sessionUser.id, sessionUser.email) : null;
}

/**
 * Prévient à chaque changement de session : connexion, déconnexion,
 * rafraîchissement du jeton, ou lien de réinitialisation ouvert.
 */
export function onAuthChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toUser(session.user.id, session.user.email) : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function createUser(
  email: string,
  password: string,
  additionalFields: Record<string, unknown> = {},
): Promise<{ user: User | null; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: additionalFields },
  });

  if (error) {
    // Supabase renvoie un message générique quand l'email est déjà pris ;
    // on le traduit pour rester cohérent avec le reste des écrans.
    const alreadyUsed = /already|registered|exists/i.test(error.message);
    return {
      user: null,
      error: alreadyUsed
        ? "Cet email est déjà utilisé"
        : "Erreur lors de la création du compte",
    };
  }

  return {
    user: data.user ? toUser(data.user.id, data.user.email) : null,
  };
}

/**
 * Réponse volontairement identique que le compte existe ou non : révéler
 * l'écart permettrait d'énumérer les comptes.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }> {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`;

  try {
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  } catch (error) {
    console.error("requestPasswordReset error:", error);
  }

  return { success: true };
}

/**
 * Applique le nouveau mot de passe.
 *
 * Aucun jeton à passer : le lien reçu par email ouvre l'application avec une
 * session de récupération déjà établie par le client Supabase. Sans elle,
 * l'appel échoue — ce qui est exactement le contrôle attendu.
 */
export async function resetPassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return {
      success: false,
      error: "Ce lien de réinitialisation est invalide ou a expiré.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: "Impossible de réinitialiser le mot de passe." };
  }

  return { success: true };
}
