import emailjs from "@emailjs/browser";
import {
  AIRTABLE_EMAIL_FIELD,
  AIRTABLE_PASSWORD_FIELD,
  AIRTABLE_SHOW_HABITS_FIELD,
  AIRTABLE_SHOW_PERSONAL_PROJECTS_FIELD,
} from "./airtable-config";
import { usersTable } from "./airtable-client";
import {
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
} from "./emailjs-config";
import type { LoginCredentials, User } from "@/types/user";
import { hashPassword, verifyPassword } from "@/utils/password-hash";
import { generateResetToken, verifyResetToken } from "@/utils/reset-token";
import {
  AUTH_STORAGE_KEY,
  storage,
  USER_STORAGE_KEY,
} from "@/utils/storage";

export async function loginWithAirtable(
  credentials: LoginCredentials,
): Promise<{ user: User; token: string } | null> {
  try {
    const records = await usersTable
      .select({
        filterByFormula: `{${AIRTABLE_EMAIL_FIELD}} = "${credentials.email}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const userRecord = records[0];
    const storedPasswordHash = userRecord.fields[
      AIRTABLE_PASSWORD_FIELD
    ] as string;

    const isPasswordValid = await verifyPassword(
      credentials.password,
      storedPasswordHash,
    );
    if (!isPasswordValid) {
      return null;
    }

    const token = `airtable_${userRecord.id}_${Date.now()}`;

    const user: User = {
      ...userRecord.fields,
      id: userRecord.id,
      email: String(userRecord.fields[AIRTABLE_EMAIL_FIELD] ?? ""),
    };

    await storage.setItem(AUTH_STORAGE_KEY, token);
    await storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

    return { user, token };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await storage.removeItem(AUTH_STORAGE_KEY);
    await storage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

export async function checkAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user: User | null;
}> {
  try {
    const token = await storage.getItem(AUTH_STORAGE_KEY);
    const userData = await storage.getItem(USER_STORAGE_KEY);

    if (!token || !userData) {
      return { isAuthenticated: false, user: null };
    }

    const user: User = JSON.parse(userData);
    return { isAuthenticated: true, user };
  } catch (error) {
    console.error("Check auth status error:", error);
    return { isAuthenticated: false, user: null };
  }
}

export async function getUserRecordByEmail(email: string) {
  const records = await usersTable
    .select({
      filterByFormula: `{${AIRTABLE_EMAIL_FIELD}} = "${email}"`,
      maxRecords: 1,
    })
    .firstPage();

  return records[0] ?? null;
}

export async function emailExists(email: string): Promise<boolean> {
  try {
    const record = await getUserRecordByEmail(email);
    return record !== null;
  } catch (error) {
    console.error("Email exists check error:", error);
    return false;
  }
}

export async function createUser(
  email: string,
  password: string,
  additionalFields: Record<string, unknown> = {},
): Promise<{ user: User | null; error?: string }> {
  try {
    const exists = await emailExists(email);
    if (exists) {
      return { user: null, error: "Cet email est déjà utilisé" };
    }

    const passwordHash = await hashPassword(password);

    const fields: Record<string, string | boolean> = {
      [AIRTABLE_EMAIL_FIELD]: email,
      [AIRTABLE_PASSWORD_FIELD]: passwordHash,
      [AIRTABLE_SHOW_HABITS_FIELD]: true,
      [AIRTABLE_SHOW_PERSONAL_PROJECTS_FIELD]: true,
    };

    Object.assign(fields, additionalFields);

    const [record] = await usersTable.create([{ fields }]);

    const user: User = {
      ...record.fields,
      id: record.id,
      email: String(record.fields[AIRTABLE_EMAIL_FIELD] ?? ""),
    };

    return { user };
  } catch (error: unknown) {
    console.error("Create user error:", error);
    return {
      user: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de la création du compte",
    };
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }> {
  const normalized = email.trim();

  try {
    const exists = await emailExists(normalized);
    if (exists) {
      const token = await generateResetToken(normalized);
      const link = `${window.location.origin}${import.meta.env.BASE_URL}reset-password?token=${encodeURIComponent(token)}`;

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { email: normalized, link },
        { publicKey: EMAILJS_PUBLIC_KEY },
      );
    }
  } catch (error) {
    // On log sans jamais révéler l'échec au caller : ne pas trahir
    // l'existence du compte ni un problème d'envoi (anti-énumération).
    console.error("requestPasswordReset error:", error);
  }

  // Réponse toujours générique et identique, quel que soit le cas.
  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await verifyResetToken(token);
  if (!result.valid) {
    const error =
      result.reason === "expired"
        ? "Ce lien de réinitialisation a expiré. Veuillez refaire une demande."
        : "Lien de réinitialisation invalide.";
    return { success: false, error };
  }

  try {
    const record = await getUserRecordByEmail(result.email);
    if (!record) {
      return { success: false, error: "Compte introuvable." };
    }

    const passwordHash = await hashPassword(newPassword);
    await usersTable.update([
      { id: record.id, fields: { [AIRTABLE_PASSWORD_FIELD]: passwordHash } },
    ]);

    return { success: true };
  } catch (error) {
    console.error("resetPassword error:", error);
    return {
      success: false,
      error: "Impossible de réinitialiser le mot de passe.",
    };
  }
}
