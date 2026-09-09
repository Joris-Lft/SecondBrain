import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useNavigationPreferences } from "@/contexts/navigation-preferences-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import styles from "./ProfilPage.module.css";

const NAV_SETTINGS = [
  {
    feature: "habits" as const,
    label: "Habits",
    description: "Afficher l'onglet de suivi des habitudes",
  },
  {
    feature: "personalProjects" as const,
    label: "Projets perso",
    description: "Afficher l'onglet des projets personnels",
  },
];

export function ProfilPage() {
  const { user, logout } = useAuth();
  const { preferences, isLoading, loadError, saveError, setFeatureEnabled } =
    useNavigationPreferences();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      setError("Impossible de se déconnecter");
    }
  };

  return (
    <PageShell className={styles.page}>
      <div className={styles.content}>
        <PageHeader title="Profil" align="center" />

        {user && (
          <Card padded className={styles.userInfo}>
            {user.Name && (
              <>
                <span className={styles.label}>Nom:</span>
                <span className={styles.value}>{user.Name as string}</span>
              </>
            )}
            <span className={styles.label}>Email:</span>
            <span className={styles.value}>{user.email}</span>
          </Card>
        )}

        <Card padded className={styles.settingsSection}>
          <section aria-labelledby="nav-settings-title">
            <h2 id="nav-settings-title" className={styles.settingsTitle}>
              Navigation
            </h2>
            <p className={styles.settingsHint}>
              Choisissez les onglets visibles dans la barre de navigation.
            </p>
            <ul className={styles.settingsList}>
              {NAV_SETTINGS.map(({ feature, label, description }) => (
                <li key={feature} className={styles.settingItem}>
                  <div className={styles.settingText}>
                    <span className={styles.settingLabel}>{label}</span>
                    <span className={styles.settingDescription}>{description}</span>
                  </div>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={preferences[feature]}
                      // Lecture échouée : les valeurs affichées ne sont pas
                      // celles enregistrées, les modifier les écraserait.
                      disabled={isLoading || loadError !== null}
                      onChange={(event) =>
                        setFeatureEnabled(feature, event.target.checked)
                      }
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                  </label>
                </li>
              ))}
            </ul>
            {loadError && (
              <p className={styles.error}>
                Préférences illisibles pour le moment ({loadError}). Réessayez
                en rechargeant la page.
              </p>
            )}
            {saveError && <p className={styles.error}>{saveError}</p>}
          </section>
        </Card>

        {error && <p className={styles.error}>{error}</p>}

        <Button
          variant="danger"
          fullWidth
          onClick={() => setShowConfirm(true)}
        >
          Se déconnecter
        </Button>

        <ConfirmModal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => void handleLogout()}
          message="Êtes-vous sûr de vouloir vous déconnecter ?"
          confirmLabel="Déconnexion"
        />
      </div>
    </PageShell>
  );
}
