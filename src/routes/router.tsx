import { createBrowserRouter, Navigate } from "react-router";
import { RouteErrorPage } from "@/components/errors/RouteErrorPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HabitPage } from "@/pages/HabitPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotesPage } from "@/pages/NotesPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { CagnottePage } from "@/pages/CagnottePage";
import { ProfilPage } from "@/pages/ProfilPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SignupPage } from "@/pages/SignupPage";
import { ProjetDetailPage } from "@/pages/ProjetDetailPage";
import { ProjetsPage } from "@/pages/ProjetsPage";
import { HOME_ROUTE } from "@/constants/navigation";
import { FeatureRoute } from "@/routes/FeatureRoute";
import { GuestRoute, ProtectedRoute } from "@/routes/RouteGuards";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(
  [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to={HOME_ROUTE} replace /> },
      {
        element: <GuestRoute />,
        children: [
          { path: "login", element: <LoginPage />, handle: { title: "Connexion" } },
          { path: "signup", element: <SignupPage />, handle: { title: "Inscription" } },
          { path: "forgot-password", element: <ForgotPasswordPage />, handle: { title: "Mot de passe oublié" } },
          { path: "reset-password", element: <ResetPasswordPage />, handle: { title: "Réinitialisation" } },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "habits",
            handle: { title: "Habits" },
            element: (
              <FeatureRoute feature="habits">
                <HabitPage />
              </FeatureRoute>
            ),
          },
          { path: "notes", element: <NotesPage />, handle: { title: "Notes" } },
          {
            path: "projets",
            handle: { title: "Projets" },
            element: (
              <FeatureRoute feature="personalProjects">
                <ProjetsPage />
              </FeatureRoute>
            ),
          },
          {
            path: "projets/cagnotte",
            handle: { title: "Cagnotte" },
            element: (
              <FeatureRoute feature="personalProjects">
                <CagnottePage />
              </FeatureRoute>
            ),
          },
          {
            path: "projets/:travelId",
            handle: { title: "Projet" },
            element: (
              <FeatureRoute feature="personalProjects">
                <ProjetDetailPage />
              </FeatureRoute>
            ),
          },
          { path: "profil", element: <ProfilPage />, handle: { title: "Profil" } },
        ],
      },
      { path: "*", element: <NotFoundPage />, handle: { title: "Page introuvable" } },
    ],
  },
  ],
  { basename: basename || undefined },
);
