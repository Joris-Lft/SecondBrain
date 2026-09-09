export const APP_NAME = "SecondBrain";

export function formatPageTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle} — ${APP_NAME}` : APP_NAME;
}
