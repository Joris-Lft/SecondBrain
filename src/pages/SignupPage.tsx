import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageShell } from "@/components/ui/PageShell";
import { createUser } from "@/services/auth";
import styles from "./AuthPage.module.css";

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Veuillez entrer une adresse email valide");
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
    try {
      const result = await createUser(email.trim(), password, {
        Name: name.trim(),
      });

      if (result.user) {
        setSuccess(
          "Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.",
        );
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      } else {
        setError(
          result.error ||
            "Impossible de créer le compte. L'email est peut-être déjà utilisé.",
        );
      }
    } catch {
      setError("Une erreur est survenue lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell className={styles.page}>
      <Card elevated padded className={styles.card}>
        <h1 className={styles.title}>Inscription</h1>
        <p className={styles.subtitle}>
          Créez un compte pour accéder à l&apos;application
        </p>

        <form className={styles.form} onSubmit={handleSignup}>
          <FormField label="Nom" htmlFor="signup-name">
            <Input
              id="signup-name"
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={isLoading}
            />
          </FormField>

          <FormField label="Email" htmlFor="signup-email">
            <Input
              id="signup-email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isLoading}
            />
          </FormField>

          <FormField
            label="Mot de passe"
            htmlFor="signup-password"
            hint="Au moins 6 caractères"
          >
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isLoading}
            />
          </FormField>

          <FormField label="Confirmer le mot de passe" htmlFor="signup-confirm">
            <Input
              id="signup-confirm"
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
            S&apos;inscrire
          </Button>

          <p className={styles.footer}>
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </form>
      </Card>
    </PageShell>
  );
}
