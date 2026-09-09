import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageShell } from "@/components/ui/PageShell";
import { resetPassword } from "@/services/auth";
import { useAuth } from "@/contexts/auth-context";
import styles from "./AuthPage.module.css";

export function ResetPasswordPage() {
  /*
   * Le lien reçu par email ouvre l'application avec une session de
   * récupération déjà établie par le client Supabase : c'est sa présence, et
   * non un jeton dans l'URL, qui autorise le changement de mot de passe.
   */
  const { isAuthenticated, isLoading: isCheckingSession } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isAuthenticated) return;

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setIsLoading(true);
    const result = await resetPassword(password);
    setIsLoading(false);

    if (result.success) {
      setSuccess(
        "Votre mot de passe a été réinitialisé. Vous allez être redirigé vers la connexion.",
      );
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } else {
      setError(result.error || "Une erreur est survenue");
    }
  };

  return (
    <PageShell className={styles.page}>
      <Card elevated padded className={styles.card}>
        <h1 className={styles.title}>Réinitialisation</h1>

        {isCheckingSession ? (
          <p className={styles.subtitle}>Vérification du lien…</p>
        ) : !isAuthenticated ? (
          <>
            <p className={styles.subtitle}>
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
            <p className={styles.footer}>
              <Link to="/forgot-password">Refaire une demande</Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>Choisissez un nouveau mot de passe</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <FormField
                label="Nouveau mot de passe"
                htmlFor="reset-password"
                hint="Au moins 6 caractères"
              >
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </FormField>

              <FormField
                label="Confirmer le mot de passe"
                htmlFor="reset-confirm"
              >
                <Input
                  id="reset-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </FormField>

              {error && <p className={styles.error}>{error}</p>}
              {success && <p className={styles.success}>{success}</p>}

              <Button type="submit" fullWidth loading={isLoading}>
                Réinitialiser
              </Button>

              <p className={styles.footer}>
                <Link to="/login">Retour à la connexion</Link>
              </p>
            </form>
          </>
        )}
      </Card>
    </PageShell>
  );
}
