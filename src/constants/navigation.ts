import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FolderHeart,
  FolderLock,
  NotebookPen,
  UserCircle,
} from "lucide-react";
import { PROJECT_SCOPES } from "@/constants/project-scope";
import type { NavFeature, NavigationPreferences } from "@/types/navigation-preferences";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  feature?: NavFeature;
};

/**
 * Destination par défaut d'un utilisateur connecté sans page précise
 * (connexion, route index, feature désactivée, page d'erreur). Notes n'a pas de
 * feature flag : la route est toujours visible.
 */
export const HOME_ROUTE = "/notes";

export const NAV_ITEMS: NavItem[] = [
  { to: "/habits", label: "Habits", icon: BarChart3, feature: "habits" },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: PROJECT_SCOPES.shared.basePath, label: "Communs", icon: FolderHeart },
  {
    to: PROJECT_SCOPES.personal.basePath,
    label: "Perso",
    icon: FolderLock,
    feature: "personalProjects",
  },
  { to: "/profil", label: "Profil", icon: UserCircle },
];

export function isNavItemVisible(
  item: NavItem,
  preferences: NavigationPreferences,
): boolean {
  if (!item.feature) {
    return true;
  }
  return preferences[item.feature];
}

export function getVisibleNavItems(
  preferences: NavigationPreferences,
): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, preferences));
}
