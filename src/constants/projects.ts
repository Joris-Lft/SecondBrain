/**
 * Les projets ne connaissent plus qu'un périmètre : celui de l'utilisateur.
 *
 * Ce module a remplacé `project-scope.ts`, qui distinguait les projets communs
 * (partagés entre tous les comptes) des projets perso. L'application n'ayant
 * plus qu'un utilisateur, les deux périmètres ont fusionné.
 */
export const PROJECTS_BASE_PATH = "/projets";
export const PROJECTS_TITLE = "Projets";
export const SAVINGS_LABEL = "Cagnotte";
