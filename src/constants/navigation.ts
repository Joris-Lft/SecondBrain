import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FolderHeart,
  NotebookPen,
  UserCircle,
} from "lucide-react";
import { PROJECTS_BASE_PATH, PROJECTS_TITLE } from "@/constants/projects";
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
  {
    to: PROJECTS_BASE_PATH,
    label: PROJECTS_TITLE,
    icon: FolderHeart,
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
