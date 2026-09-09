import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchNavigationPreferences,
  getPreferenceErrorMessage,
  updateNavigationPreferences,
} from "@/services/user-preferences";
import type {
  NavFeature,
  NavigationPreferences,
} from "@/types/navigation-preferences";
import { DEFAULT_NAVIGATION_PREFERENCES } from "@/types/navigation-preferences";

interface NavigationPreferencesContextType {
  preferences: NavigationPreferences;
  isLoading: boolean;
  /** Les préférences n'ont pas pu être lues : ne pas proposer de les modifier. */
  loadError: string | null;
  saveError: string | null;
  setFeatureEnabled: (feature: NavFeature, enabled: boolean) => void;
}

/** Préférences chargées, associées à l'utilisateur pour lequel elles valent. */
interface LoadedPreferences {
  userId: string;
  preferences: NavigationPreferences;
}

/** Message d'erreur, rattaché à l'utilisateur concerné. */
interface ScopedError {
  userId: string;
  message: string;
}

const NavigationPreferencesContext = createContext<
  NavigationPreferencesContextType | undefined
>(undefined);

export function NavigationPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  const [loaded, setLoaded] = useState<LoadedPreferences | null>(null);
  const [loadFailure, setLoadFailure] = useState<ScopedError | null>(null);
  const [saveFailure, setSaveFailure] = useState<ScopedError | null>(null);

  // Dérivés plutôt que stockés : à la déconnexion ou au changement de compte,
  // on retombe sur les valeurs par défaut sans réinitialiser d'état dans un
  // effet — et sans jamais exposer les préférences, ni les erreurs, de
  // l'utilisateur précédent.
  const isCurrent = loaded !== null && loaded.userId === userId;
  const preferences = isCurrent
    ? loaded.preferences
    : DEFAULT_NAVIGATION_PREFERENCES;
  const loadError =
    loadFailure !== null && loadFailure.userId === userId
      ? loadFailure.message
      : null;
  const saveError =
    saveFailure !== null && saveFailure.userId === userId
      ? saveFailure.message
      : null;
  // Un échec de lecture met fin au chargement : sinon FeatureRoute
  // n'afficherait plus jamais aucune page.
  const isLoading = !!userId && !isCurrent && loadError === null;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void (async () => {
      try {
        const saved = await fetchNavigationPreferences(userId);
        if (!cancelled) {
          setLoadFailure(null);
          setLoaded({ userId, preferences: saved });
        }
      } catch (error) {
        console.error("Fetch navigation preferences error:", error);
        // On ne fabrique pas de préférences par défaut : les valeurs affichées
        // seraient fausses, et les enregistrer écraserait les vraies.
        if (!cancelled) {
          setLoadFailure({ userId, message: getPreferenceErrorMessage(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setFeatureEnabled = useCallback(
    (feature: NavFeature, enabled: boolean) => {
      // Sans lecture réussie, on ignore l'état réel des autres préférences :
      // écrire maintenant reviendrait à deviner.
      if (!userId || !isCurrent) return;

      const previous = preferences;

      setSaveFailure(null);
      setLoaded({ userId, preferences: { ...previous, [feature]: enabled } });

      // Mise à jour optimiste, limitée au champ modifié.
      void updateNavigationPreferences(userId, { [feature]: enabled }).catch((error) => {
        console.error("Update navigation preferences error:", error);

        // Deux gardes : ne rien restaurer si l'utilisateur a changé entre-temps
        // (sinon l'état resterait bloqué en chargement), et ne rejouer que le
        // champ concerné pour ne pas annuler une bascule ultérieure réussie.
        setLoaded((current) =>
          current?.userId === userId
            ? {
                userId,
                preferences: {
                  ...current.preferences,
                  [feature]: previous[feature],
                },
              }
            : current,
        );
        setSaveFailure({ userId, message: getPreferenceErrorMessage(error) });
      });
    },
    [isCurrent, preferences, userId],
  );

  const value = useMemo(
    () => ({
      preferences,
      isLoading,
      loadError,
      saveError,
      setFeatureEnabled,
    }),
    [preferences, isLoading, loadError, saveError, setFeatureEnabled],
  );

  return (
    <NavigationPreferencesContext.Provider value={value}>
      {children}
    </NavigationPreferencesContext.Provider>
  );
}

export function useNavigationPreferences() {
  const context = useContext(NavigationPreferencesContext);
  if (context === undefined) {
    throw new Error(
      "useNavigationPreferences must be used within a NavigationPreferencesProvider",
    );
  }
  return context;
}
