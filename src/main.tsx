import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { AuthProvider } from "@/contexts/auth-context";
import { NavigationPreferencesProvider } from "@/contexts/navigation-preferences-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { router } from "@/routes/router";
import { CACHE_MAX_AGE, queryClient, queryPersister } from "@/utils/query-client";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      // `buster` : la version applicative, pour qu'un déploiement qui change la
      // forme des données réponde par un cache neuf plutôt que par un plantage.
      persistOptions={{
        persister: queryPersister,
        maxAge: CACHE_MAX_AGE,
        buster: __APP_VERSION__,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <NavigationPreferencesProvider>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
          </NavigationPreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
