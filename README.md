# SecondBrain — Application de tracking d'habitudes

Application web React pour le suivi d'habitudes quotidiennes, hebdomadaires et mensuelles, adossée à Supabase.

## Stack

- React 19 + TypeScript
- Vite
- react-router v7
- TanStack Query v5
- Supabase (Postgres, Auth, Storage)

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

Les tests couvrent les utilitaires purs (`src/utils/`) : dérivation de titre,
wikilinks, graphe de notes, tags et formatage. Ils tournent en environnement
Node — aucun DOM, aucun accès réseau, aucun secret requis. La CI
(`.github/workflows/ci.yml`) les rejoue sur chaque PR vers `main`.

## Structure

```
├── legacy/          # Ancienne app Expo/React Native (archivée)
├── src/
│   ├── pages/       # Écrans (Login, Habits, Profil…)
│   ├── components/  # Composants UI
│   ├── services/    # Couche Supabase
│   ├── hooks/       # TanStack Query + thème
│   └── routes/      # react-router
├── env.template     # Variables d'environnement
└── .env             # Config locale (non versionnée)
```

## Variables d'environnement

L'application n'a besoin que de deux variables, toutes deux préfixées `VITE_` (requis par Vite) :

| Variable | Rôle |
|----------|------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`) |

La clé publishable est publique par conception : elle n'ouvre que ce que les politiques Row Level Security autorisent, et chaque table du schéma en a une. **La clé secrète (`sb_secret_…`) ne doit jamais être préfixée `VITE_`** — Vite publierait la variable dans le bundle, et cette clé contourne toute la RLS. Seuls les scripts de migration la lisent, sous le nom `SUPABASE_SECRET_KEY`.

La table `habits` s'appuie sur deux colonnes de cycle de vie : `is_active` et `deleted_date`. Supprimer un tracking depuis l'app l'archive — `is_active` passe à faux et `deleted_date` est renseignée — pour que ses logs historiques restent rattachés. Seules les lignes actives s'affichent.

Les tags de notes et les catégories de dépenses sont des valeurs libres : la liste proposée à la saisie est reconstituée à partir de celles déjà utilisées.

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
