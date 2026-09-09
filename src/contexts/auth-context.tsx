import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, login as loginService, logout as logoutService, onAuthChange } from "@/services/auth";
import { clearQueryCache } from "@/utils/query-client";
import type { User } from "@/types/user";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (active) setUser(currentUser);
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    /*
     * Supabase entretient la session et la rafraîchit de lui-même : s'y abonner
     * évite de lire un jeton périmé, et capte aussi la session ouverte par un
     * lien de réinitialisation.
     */
    const unsubscribe = onAuthChange((nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await loginService({ email, password });
      if (result.user) {
        setUser(result.user);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "Erreur de connexion. Veuillez réessayer.",
      };
    }
  };

  const logout = async () => {
    await logoutService();
    // Le cache de requêtes est persisté : sans ce nettoyage, les données du
    // compte qui se déconnecte resteraient lisibles dans le navigateur.
    await clearQueryCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
