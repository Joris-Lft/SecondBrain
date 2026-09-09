export type NavFeature = "habits" | "personalProjects";

export type NavigationPreferences = Record<NavFeature, boolean>;

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferences = {
  habits: true,
  personalProjects: true,
};
