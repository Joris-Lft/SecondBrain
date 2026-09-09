import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageShell } from "@/components/ui/PageShell";
import { requestPasswordReset } from "@/services/auth";
import styles from "./AuthPage.module.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Veuillez entrer votre adresse email");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }

    setIsLoading(true);
    await requestPasswordReset(email.trim());
    setIsLoading(false);
    setSubmitted(true);
  };

  return (
    <PageShell className={styles.page}>
      <Card elevated padded className={styles.card}>
        <h1 className={styles.title}>Mot de passe oublié</h1>
        <p className={styles.subtitle}>
          Entrez votre adresse email pour recevoir un lien de réinitialisation
        </p>

        {submitted ? (
          <>
            <p className={styles.success}>
              Si un compte existe pour cette adresse, un email de
              réinitialisation vient d&apos;être envoyé.
            </p>
            <p className={styles.footer}>
              <Link to="/login">Retour à la connexion</Link>
            </p>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <FormField label="Email" htmlFor="forgot-email">
              <Input
                id="forgot-email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
            </FormField>

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" fullWidth loading={isLoading}>
              Envoyer le lien
            </Button>

            <p className={styles.footer}>
              <Link to="/login">Retour à la connexion</Link>
            </p>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
