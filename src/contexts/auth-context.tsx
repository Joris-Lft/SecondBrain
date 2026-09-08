import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  checkAuthStatus,
  loginWithAirtable,
  logout as logoutService,
} from "@/services/airtable";
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
    void (async () => {
      try {
        const { user: currentUser } = await checkAuthStatus();
        setUser(currentUser);
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await loginWithAirtable({ email, password });
      if (result) {
        setUser(result.user);
        return { success: true };
      }
      return { success: false, error: "Email ou mot de passe incorrect" };
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
