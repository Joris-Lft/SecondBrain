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
import { LegacyTravelRedirect } from "@/routes/LegacyTravelRedirect";
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
            path: "projets-communs",
            element: <ProjetsPage scope="shared" />,
            handle: { title: "Projets communs" },
          },
          {
            path: "projets-communs/cagnotte",
            element: <CagnottePage scope="shared" />,
            handle: { title: "Cagnotte commune" },
          },
          {
            path: "projets-communs/:travelId",
            element: <ProjetDetailPage scope="shared" />,
            handle: { title: "Projet" },
          },
          {
            path: "projets-perso",
            handle: { title: "Projets perso" },
            element: (
              <FeatureRoute feature="personalProjects">
                <ProjetsPage scope="personal" />
              </FeatureRoute>
            ),
          },
          {
            path: "projets-perso/cagnotte",
            handle: { title: "Ma cagnotte" },
            element: (
              <FeatureRoute feature="personalProjects">
                <CagnottePage scope="personal" />
              </FeatureRoute>
            ),
          },
          {
            path: "projets-perso/:travelId",
            handle: { title: "Projet perso" },
            element: (
              <FeatureRoute feature="personalProjects">
                <ProjetDetailPage scope="personal" />
              </FeatureRoute>
            ),
          },
          // Anciennes URLs des projets, avant le renommage /voyages → /projets-communs.
          { path: "voyages", element: <Navigate to="/projets-communs" replace /> },
          {
            path: "voyages/cagnotte",
            element: <Navigate to="/projets-communs/cagnotte" replace />,
          },
          { path: "voyages/:travelId", element: <LegacyTravelRedirect /> },
          { path: "profil", element: <ProfilPage />, handle: { title: "Profil" } },
        ],
      },
      { path: "*", element: <NotFoundPage />, handle: { title: "Page introuvable" } },
    ],
  },
  ],
  { basename: basename || undefined },
);
