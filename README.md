# SecondBrain — Application de tracking d'habitudes

Application web React pour le suivi d'habitudes quotidiennes, hebdomadaires et mensuelles, avec authentification Airtable.

## Stack

- React 19 + TypeScript
- Vite
- react-router v7
- TanStack Query v5
- Airtable (backend)

## Démarrage

```bash
# Installer les dépendances
npm install

# Configurer l'environnement
cp env.template .env
# Remplir les variables VITE_* dans .env

# Lancer le serveur de développement
npm run dev
```

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (types + bundle) |
| `npm run preview` | Prévisualiser le build |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:watch` | Tests en mode watch |
| `npm run create-user` | Créer un utilisateur via CLI |

Les tests couvrent les utilitaires purs (`src/utils/`) : dérivation de titre,
wikilinks, graphe de notes, tags et formatage. Ils tournent en environnement
Node — aucun DOM, aucun accès Airtable, aucun secret requis. La CI
(`.github/workflows/ci.yml`) les rejoue sur chaque PR vers `main`.

## Structure

```
├── legacy/          # Ancienne app Expo/React Native (archivée)
├── src/
│   ├── pages/       # Écrans (Login, Habits, Profil…)
│   ├── components/  # Composants UI
│   ├── services/    # Couche Airtable
│   ├── hooks/       # TanStack Query + thème
│   └── routes/      # react-router
├── env.template     # Variables d'environnement
└── .env             # Config locale (non versionnée)
```

## Variables d'environnement

Toutes les variables utilisent le préfixe `VITE_` (requis par Vite). Voir `env.template` pour la liste complète.

Le token Airtable (`VITE_AIRTABLE_API_KEY`) doit porter les scopes `data.records:read`, `data.records:write` et `schema.bases:read` — ce dernier sert à lister les tags disponibles (les choix du champ `tags` de la table `Notes`, un multi-select). Sans lui, seuls les tags déjà posés sur les notes chargées sont proposés.

La table `Habits` s'appuie sur deux colonnes de cycle de vie : `is_active` (case à cocher) et `deleted_date` (date). Supprimer un tracking depuis l'app l'archive — `is_active` est décochée et `deleted_date` renseignée — pour que ses logs historiques restent rattachés. Seuls les enregistrements dont `is_active` est cochée s'affichent : un habit créé directement dans Airtable doit donc avoir cette case cochée pour être visible.

Créer un tag depuis l'app ajoute un choix au multi-select Airtable (via l'option `typecast` du SDK) : il est donc visible par tout le monde et ne peut être supprimé que depuis Airtable. Les catégories de dépenses, elles, sont un simple champ texte : la liste proposée est reconstituée à partir des catégories déjà utilisées dans la table.

## Déploiement (GitHub Pages)

Le site est déployé automatiquement sur chaque push vers `main` via GitHub Actions.

**URL :** https://joris-lft.github.io/SecondBrain/

### Configuration initiale (une seule fois)

1. **Activer GitHub Pages** — Dans le dépôt GitHub : *Settings → Pages → Build and deployment → Source* : choisir **GitHub Actions**.

2. **Ajouter le secret `ENV_FILE`** — *Settings → Secrets and variables → Actions → New repository secret* :
   - Nom : `ENV_FILE`
   - Valeur : le contenu complet de votre fichier `.env` local (toutes les variables `VITE_*`)

3. **Merger dans `main`** — Le workflow `.github/workflows/deploy.yml` build et publie le dossier `dist/`.

### Notes techniques

- Le `base` Vite est `/SecondBrain/` en production (sous-chemin du dépôt GitHub).
- Un `404.html` est généré au build pour le routage SPA (react-router).
- Le fichier `public/.nojekyll` désactive le traitement Jekyll de GitHub Pages.

## Application legacy

L'ancienne application mobile Expo est conservée dans `legacy/` pour référence. Elle n'est plus maintenue activement.
