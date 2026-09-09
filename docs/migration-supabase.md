# Plan de migration — Airtable → Supabase, et passage en SecondBrain

> Trois chantiers menés ensemble : sortir d'Airtable, retirer le partage
> multi-utilisateurs devenu inutile, et renommer l'application.

## Sommaire

1. [État des lieux](#1-état-des-lieux)
2. [Prérequis](#2-prérequis)
3. [Décisions actées](#3-décisions-actées)
4. [Ce que le mono-utilisateur supprime](#4-ce-que-le-mono-utilisateur-supprime)
5. [Lot 0 — Renommage en SecondBrain](#lot-0--renommage-en-secondbrain)
6. [Phase 0 — Créer le compte et le projet Supabase](#phase-0--créer-le-compte-et-le-projet-supabase)
7. [Phase 1 — Le schéma SQL](#phase-1--le-schéma-sql)
8. [Phase 2 — Row Level Security](#phase-2--row-level-security)
9. [Phase 3 — Export Airtable](#phase-3--export-airtable)
10. [Phase 4 — Le compte](#phase-4--le-compte)
11. [Phase 5 — Import des données](#phase-5--import-des-données)
12. [Phase 6 — Les images](#phase-6--les-images)
13. [Phase 7 — Réécriture de la couche services](#phase-7--réécriture-de-la-couche-services)
14. [Phase 8 — Bascule et vérification](#phase-8--bascule-et-vérification)
15. [Pièges identifiés](#pièges-identifiés)
16. [Découpage en lots](#découpage-en-lots)

---

## 1. État des lieux

**Consommation Airtable au 7 septembre 2026 : 1 300 appels pour 1 000
autorisés.** Le dépassement a ouvert le grace period de 30 jours, et le
compteur se réinitialise le 1er octobre.

Un point à intégrer avant de se presser : la PR #23, déployée, divise la
consommation par 5 à 10. Sur la base de 1 300, cela place l'app autour de
**130 à 260 appels par mois — sous le plafond**. L'urgence budgétaire est
retombée.

Ce qui reste, et qui justifie la migration :

- **La clé API Airtable est en clair dans le bundle JavaScript**, avec accès
  total en lecture et écriture sur la base — table des comptes comprise. C'est
  la vraie raison de partir, et elle ne se règle pas par du cache.
- Le passage en mono-utilisateur permet de supprimer une moitié du modèle de
  données et du code associé. Autant le faire pendant qu'on réécrit la couche
  d'accès aux données, pas après.

Autrement dit : la migration se fait posément, sans course contre le quota.

---

## 2. Prérequis

### 2.1 Déployer la réduction de consommation — fait

PR #23 mergée sur `main`, déploiement automatique.

### 2.2 Dupliquer la base Airtable — fait

Copie disponible sous **`2026-app-migrate`**. Elle sert de point de retour et,
pour les données des autres utilisateurs, d'archive définitive.

### 2.3 Ajouter un champ formule `RECORD_ID()` dans les 8 tables

**À faire dans l'interface Airtable — l'API ne sait pas le faire.** L'endpoint
de création de champs ne supporte pas le type `formula` : ces champs ne peuvent
être créés que depuis l'application web ou desktop. Aucun script ne contournera
cette limite.

C'est de toute façon la bonne voie : à 1 300 appels sur 1 000, mieux vaut ne pas
solliciter l'API pour une opération que l'interface fait gratuitement.

Pour chaque table — `Users`, `Habits`, `HabitsLogs`, `Measures`, `Notes`,
`Travel`, `TravelBudget`, `TravelSavings` — ajouter un champ de type *Formula*
nommé `record_id`, avec pour formule `RECORD_ID()`.

Pourquoi c'est important : toute la migration repose sur les identifiants
`recXXX` pour reconstruire les liens entre tables. Si l'API venait à être
bloquée, le seul recours serait l'export CSV manuel — qui ne contient pas ces
identifiants. Un champ formule, lui, sort dans le CSV.

### 2.4 Renommer le dépôt GitHub

*Settings → General → Repository name* → `SecondBrain`.

**À faire avant la phase 0** : l'URL de déploiement passe de
`joris-lft.github.io/2026/` à `joris-lft.github.io/SecondBrain/`, et c'est
cette URL qu'il faudra déclarer dans Supabase. La faire changer après
obligerait à reconfigurer les Redirect URLs.

Conséquence à accepter : l'ancienne URL cesse de répondre. Favoris et raccourci
installé sur le téléphone sont à refaire.

---

## 3. Décisions actées

| # | Décision | Choix |
|---|---|---|
| 1 | Mots de passe existants | Non migrables (SHA-256 → bcrypt impossible). Sans objet : un seul compte à recréer, le tien |
| 2 | Emails transactionnels | Supabase Auth natif, EmailJS retiré |
| 3 | Images | Supabase Storage, ImgBB et Litterbox retirés |
| 4 | Utilisateurs | **Un seul** : toi |
| 5 | Données communes | **Rattachées à ton compte.** Ce qui appartient exclusivement à d'autres n'est pas importé et reste dans `2026-app-migrate` |
| 6 | Nom | **SecondBrain**, dépôt renommé, logo et favicon refaits |

La décision 1, qui était le point dur du plan initial, s'évapore : il n'y a plus
qu'un compte à créer, et tu choisis son mot de passe toi-même à l'inscription.
Plus aucune étape irréversible dans le parcours.

---

## 4. Ce que la simplification supprime

Le partage traversait le modèle de données, les routes et onze fichiers de code.
Le retirer est la simplification la plus profonde de cette migration.

### Dans le modèle

| Élément actuel | Devient |
|---|---|
| `Notes.Status` (`Perso` / `Commune`) | Supprimé |
| `Notes.Assignees` (multi-utilisateurs) | `notes.user_id`, une simple clé étrangère |
| `Travel.is_personal` | Supprimé — tous les projets sont les tiens |
| `TravelSavings.user_id` vide = cagnotte commune | `user_id` devient obligatoire, une seule cagnotte |
| Annuaire des utilisateurs | Supprimé |

### Dans le code

À supprimer intégralement :

- `src/constants/project-scope.ts` — le type `ProjectScope` et ses deux
  périmètres
- `src/services/users.ts` et `src/hooks/use-users.ts` — l'annuaire servait à
  choisir qui inviter sur une note
- Les routes `/projets-communs` et leurs redirections héritées dans
  `src/routes/router.tsx`, ainsi que `src/routes/LegacyTravelRedirect.tsx`
- Le champ « invités » des formulaires de note

À simplifier — le paramètre `scope` disparaît de leur signature :
`use-travels.ts`, `use-travel-savings.ts`, `travels.ts`, `travel-savings.ts`,
`ProjetsPage.tsx`, `ProjetDetailPage.tsx`, `CagnottePage.tsx`,
`SavingsCard.tsx`, `src/constants/navigation.ts`.

Les routes deviennent `/projets` et `/projets/cagnotte`.

> **Reporté au lot 5** : la préférence `show_personal_projects` a été conservée
> telle quelle — elle pilote toujours l'affichage de l'onglet Projets. La
> renommer en `show_projects` touchait au schéma Airtable pour un gain nul ;
> autant le faire en écrivant le schéma Supabase.

### Les mensurations

Fonctionnalité inutilisée, retirée entièrement : ni migrée, ni conservée dans
l'interface. Les données restent dans `2026-app-migrate`.

À supprimer :

- `src/components/Measure/` — les trois composants (formulaire, tableau, graphe)
- `src/pages/MeasurePage.tsx`
- `src/hooks/use-measures.ts`, `src/services/measures.ts`, `src/types/measures.ts`
- La route `/measures` et son `FeatureRoute` dans `src/routes/router.tsx`
- L'entrée « Mensurations » de `src/constants/navigation.ts`
- La table `Measures` du schéma, l'index associé et sa politique RLS
- Le champ `show_measures` de `profiles`, la valeur `"measures"` du type
  `NavFeature`, et la préférence correspondante dans `ProfilPage.tsx`

À ajuster : `src/constants/charts.ts` (couleurs de séries propres aux mesures),
`src/components/ui/Skeleton.tsx` (variante dédiée au tableau) et
`src/services/user-preferences.test.ts` (les cas portant sur `show_measures`).

La table `Measures` reste **exportée** en phase 3 — quelques appels API pour une
archive JSON, autant l'avoir — mais n'est pas importée.

---

## Lot 0 — Renommage en SecondBrain

Indépendant de Supabase, et à faire en premier puisque le dépôt doit être
renommé avant la phase 0.

| Fichier | Changement |
|---|---|
| `src/constants/branding.ts` | `APP_NAME` → `"SecondBrain"` |
| `index.html` | `<title>`, et `theme-color` si la palette change |
| `public/favicon.svg` | Nouveau logo — sert aussi de marque dans l'en-tête (`AppLayout.tsx`) |
| `vite.config.ts` | `repositoryName` → `"SecondBrain"` |
| `package.json` | `name` → `"secondbrain"` |
| `README.md` | Titre et URL de déploiement |

Le branding est bien centralisé : `APP_NAME` alimente à la fois l'en-tête et les
titres de page via `formatPageTitle`, et le favicon sert de logo dans
`AppLayout`. Six fichiers suffisent.

**Direction pour le logo** : l'actuel est un chat, littéral et lié à l'ancien
nom. Plutôt qu'un cerveau — le cliché du « second brain » — partir du graphe de
notes reliées par wikilinks, qui est déjà la fonctionnalité la plus
caractéristique de l'app : trois ou quatre nœuds reliés, dans le terracotta
`#c45d3e` déjà utilisé comme teinte d'accent (`--color-tint`), pour ne pas
toucher au thème.

---

## Phase 0 — Créer le compte et le projet Supabase

1. Aller sur **https://supabase.com** → *Start your project*, connexion via
   GitHub.
2. *New project* :
   - **Name** : `secondbrain`
   - **Database Password** : générer et **la stocker dans un gestionnaire de
     mots de passe** — elle n'est plus jamais réaffichée.
   - **Region** : `West EU (Ireland)` ou `Central EU (Frankfurt)`.
   - **Plan** : Free.
3. Attendre le provisionnement, environ deux minutes.
4. Récupérer les clés dans *Project Settings → API* :

| Clé | Destination | Nature |
|---|---|---|
| `Project URL` | `.env` → `VITE_SUPABASE_URL` | Publique |
| `publishable` (`sb_publishable_…`) | `.env` → `VITE_SUPABASE_PUBLISHABLE_KEY` | **Publique par design** — n'ouvre que ce que la RLS autorise |
| `secret` (`sb_secret_…`) | Scripts de migration uniquement, **jamais** préfixée `VITE_` | **Secrète** — contourne toute la RLS |

> Supabase remplace les anciennes clés `anon` / `service_role` par les clés
> `publishable` / `secret`, à privilégier pour un projet neuf. Les rôles sont
> identiques ; la clé secrète refuse en plus les appels venant d'un navigateur,
> garde-fou que l'ancienne `service_role` n'avait pas.

5. **Déclarer les URL de redirection** dans *Authentication → URL
   Configuration* : `Site URL` à `https://joris-lft.github.io/SecondBrain/`, et
   en `Redirect URLs` ajouter `https://joris-lft.github.io/SecondBrain/**` ainsi
   que `http://localhost:5173/**`.

   > Sans cette déclaration, Supabase refuse toute redirection vers une URL
   > inconnue, sans message d'erreur explicite.

6. Installer le client : `npm install @supabase/supabase-js`

### Le piège de la mise en pause

**Un projet Free est mis en pause après 7 jours sans activité**, et redevient
joignable seulement après restauration manuelle. Un usage quotidien suffit à
l'éviter, deux semaines de vacances non.

```yaml
# .github/workflows/keep-alive.yml
name: keep-alive
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -o /dev/null -w "%{http_code}\n" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/profiles?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}"
```

---

## Phase 1 — Le schéma SQL

À exécuter dans *SQL Editor → New query*. Le schéma corrige trois faiblesses
qu'Airtable ne permettait pas d'exprimer — les relations deviennent des clés
étrangères, les valeurs contraintes des `check`, l'unicité d'un log par période
une contrainte — et retire tout le partage.

```sql
-- ---------------------------------------------------------------
-- Profil. Étend auth.users, qui détient email et mot de passe.
-- ---------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null unique,
  show_habits             boolean not null default true,
  show_personal_projects  boolean not null default true,
  created_at              timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Habitudes et mesures
-- ---------------------------------------------------------------
create table public.habits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  frequency     text not null check (frequency in ('daily','weekly','monthly')),
  created_at    date not null default current_date,
  is_active     boolean not null default true,
  deleted_date  date
);
create index habits_user_active_idx on public.habits (user_id, is_active);

create table public.habit_logs (
  id            uuid primary key default gen_random_uuid(),
  habit_id      uuid not null references public.habits(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  frequency     text not null check (frequency in ('daily','weekly','monthly')),
  period        text not null,
  -- Impossible à garantir dans Airtable : un double clic rapide pouvait
  -- créer deux logs pour la même période.
  unique (habit_id, period)
);
create index habit_logs_user_period_idx on public.habit_logs (user_id, period);

-- ---------------------------------------------------------------
-- Notes. Plus de statut ni d'assignation : une note appartient
-- à son auteur, point.
-- ---------------------------------------------------------------
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  note_number  bigint generated by default as identity,
  content      text not null,
  tags         text[] not null default '{}',
  created_at   date not null default current_date
);
create index notes_user_created_idx on public.notes (user_id, created_at desc);
create index notes_tags_idx on public.notes using gin (tags);

create table public.note_attachments (
  id        uuid primary key default gen_random_uuid(),
  note_id   uuid not null references public.notes(id) on delete cascade,
  url       text not null,
  filename  text not null,
  size      bigint,
  type      text
);

-- ---------------------------------------------------------------
-- Projets, budget, cagnotte. Plus de périmètre commun.
-- ---------------------------------------------------------------
create table public.travels (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  cover_url    text,
  is_voyage    boolean not null default false,
  destination  text not null default '',
  start_date   date,
  end_date     date,
  description  text not null default '',
  created_at   date not null default current_date
);
create index travels_user_idx on public.travels (user_id, created_at desc);

create table public.travel_budget (
  id           uuid primary key default gen_random_uuid(),
  -- La cascade remplace `deleteBudgetLinesForTravel` et sa boucle de
  -- suppressions par lots de 10.
  travel_id    uuid not null references public.travels(id) on delete cascade,
  category     text not null default 'Autre',
  label        text not null default '',
  estimated    numeric,
  actual       numeric,
  notes        text not null default '',
  location     text not null default '',
  in_budget    boolean not null default false,
  to_visit     boolean not null default false,
  purchased    boolean not null default false,
  spend_level  text not null default 'Confortable'
                 check (spend_level in ('Strict minimum','Confortable','Royal'))
);
create index travel_budget_travel_idx on public.travel_budget (travel_id);

create table public.travel_savings (
  id       uuid primary key default gen_random_uuid(),
  -- Plus de cagnotte commune : chaque versement a un propriétaire.
  user_id  uuid not null references public.profiles(id) on delete cascade,
  amount   numeric not null check (amount > 0),
  author   text not null default '',
  date     date,
  note     text not null default ''
);
create index travel_savings_user_idx on public.travel_savings (user_id);
```

### Correspondance avec l'existant

| Airtable | Postgres | Note |
|---|---|---|
| `Users.Password` | `auth.users.encrypted_password` | Géré par Supabase Auth |
| `Habits.user_id` (champ lié) | `habits.user_id` (FK uuid) | Était filtré par email |
| `HabitsLogs.habit_id` (texte) | FK uuid + cascade | |
| `Measures` (table entière) | — | Supprimée, archivée dans `2026-app-migrate` |
| `Notes.id` (autonumber) | `note_number` (identity) | |
| `Notes.Assignees` | `notes.user_id` | Le partage disparaît |
| `Notes.Status` | — | Supprimé |
| `Notes.Attachments` | table `note_attachments` | Fichiers à rapatrier (phase 6) |
| `Notes.tags` (multi-select) | `text[]` + index GIN | Plus besoin de l'API meta d'Airtable |
| `Travel.is_personal` | — | Supprimé |
| `TravelBudget.travel_id` (texte) | FK uuid + cascade | |
| `TravelSavings.user_id` vide | `user_id` (obligatoire) | Cagnotte commune rattachée |

---

## Phase 2 — Row Level Security

Sans RLS, la clé `anon` publique donne un accès total en écriture à qui ouvre
l'onglet réseau. **Cette phase n'est pas optionnelle.**

En mono-utilisateur, les politiques deviennent triviales : une seule règle,
répétée.

```sql
alter table public.profiles         enable row level security;
alter table public.habits           enable row level security;
alter table public.habit_logs       enable row level security;
alter table public.notes            enable row level security;
alter table public.note_attachments enable row level security;
alter table public.travels          enable row level security;
alter table public.travel_budget    enable row level security;
alter table public.travel_savings   enable row level security;

create policy "profil personnel" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "habitudes personnelles" on public.habits
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "logs personnels" on public.habit_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes personnelles" on public.notes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "projets personnels" on public.travels
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cagnotte personnelle" on public.travel_savings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Les deux tables filles suivent leur parent.
create policy "pièces jointes suivent leur note" on public.note_attachments
  for all to authenticated
  using (exists (
    select 1 from public.notes n
    where n.id = note_attachments.note_id and n.user_id = auth.uid()
  ));

create policy "budget suit son projet" on public.travel_budget
  for all to authenticated
  using (exists (
    select 1 from public.travels t
    where t.id = travel_budget.travel_id and t.user_id = auth.uid()
  ));
```

> **Contrôle** : le dashboard signale en rouge toute table sans RLS active dans
> *Database → Tables*. Aucune ne doit rester non protégée.

---

## Phase 3 — Export Airtable

**Une seule passe de lecture, sauvegardée sur disque.** Le script écrit un JSON
brut qu'on pourra rejouer autant de fois que nécessaire sans retoucher Airtable.

L'export porte sur la base d'origine, pas sur `2026-app-migrate` : la copie est
l'archive, pas la source.

`scripts/export-airtable.ts` :

```ts
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  usersTable, habitsTable, habitsLogsTable, measureTable,
  notesTable, travelsTable, travelBudgetTable, travelSavingsTable,
} from "../src/services/airtable-client";

const TABLES = {
  users: usersTable,
  habits: habitsTable,
  habitLogs: habitsLogsTable,
  measures: measureTable,
  notes: notesTable,
  travels: travelsTable,
  travelBudget: travelBudgetTable,
  travelSavings: travelSavingsTable,
};

mkdirSync("migration", { recursive: true });

for (const [name, table] of Object.entries(TABLES)) {
  const records = await table.select().all();
  const rows = records.map((r) => ({ id: r.id, fields: r.fields }));
  writeFileSync(`migration/${name}.json`, JSON.stringify(rows, null, 2));
  console.log(`${name}: ${rows.length} lignes`);
}
```

```bash
npx tsx scripts/export-airtable.ts
```

Ajouter `migration/` au `.gitignore` : ces fichiers contiennent les hashs de
mots de passe et l'ensemble des données personnelles.

Compter 30 à 60 appels API, pagination comprise. Noter le décompte des lignes
par table : c'est la référence à recontrôler après import.

---

## Phase 4 — Le compte

Réduite à sa plus simple expression, maintenant qu'il n'y a qu'un utilisateur.

1. Lancer l'app en local une fois la couche services réécrite, et **s'inscrire
   normalement** avec ton email habituel et un mot de passe que tu choisis.
2. Le trigger `on_auth_user_created` crée le profil automatiquement.
3. Récupérer l'uuid dans *Authentication → Users*, et le passer aux scripts
   d'import.

Aucun script d'administration, aucun email de réinitialisation, aucune étape
irréversible. Reporter à la main les trois préférences de navigation depuis
l'export, ou les recocher dans l'app.

---

## Phase 5 — Import des données

Ordre imposé par les clés étrangères :

```
profiles (phase 4)
  └─ habits ─ habit_logs
  └─ notes ─ note_attachments
  └─ travels ─ travel_budget
  └─ travel_savings
```

Chaque étape produit sa table de correspondance (`habit-id-map.json`,
`travel-id-map.json`…), consommée par la suivante.

### La règle de rattachement

Puisque tout t'appartient désormais, `user_id` vaut ton uuid partout. Le tri se
fait à la lecture de l'export :

| Donnée | Importée ? |
|---|---|
| Habitudes et logs portant ton email | Oui |
| Habitudes et logs d'un autre compte | **Non** — restent dans `2026-app-migrate` |
| Mensurations, toutes | **Non** — fonctionnalité supprimée |
| Notes où tu figures dans `Assignees` (seul ou non) | Oui, rattachées à toi |
| Notes où tu ne figures pas | **Non** |
| Projets communs et personnels (les tiens) | Oui |
| Projets personnels d'un autre compte | **Non** |
| Cagnotte commune (`user_id` vide) | Oui, rattachée à toi |
| Cagnotte personnelle d'un autre compte | **Non** |

Le budget suit toujours son projet : une ligne de `TravelBudget` n'est importée
que si son `travel_id` pointe vers un projet retenu.

### Trois normalisations invisibles dans les données brutes

1. **`Habits.user_id` est un champ lié.** Airtable le renvoie sous forme de
   tableau, résolu par email (`firstLinkedId`). Selon la configuration, la
   valeur est un `recXXX` ou un email — accepter les deux.
2. **`TravelBudget.travel_id` est du texte contenant un `recXXX`.** Sans la
   table de correspondance, ces lignes deviennent orphelines et la clé étrangère
   rejette l'insertion. C'est le contrôle d'intégrité le plus utile de la
   migration : une erreur ici signale un lien déjà cassé côté Airtable.
3. **Les versements à montant nul sont à écarter** — dont les trois lignes par
   défaut d'Airtable, que l'app filtre déjà côté client. Idem pour les notes
   sans contenu.

---

## Phase 6 — Les images

Deux sources : `Notes.Attachments` et `Travel.Cover`.

> ⏱️ **Contrainte de temps** : les URLs de pièces jointes Airtable **expirent
> environ deux heures après leur lecture**. Le téléchargement doit suivre
> l'export de la phase 3 de près.

1. Créer un bucket **public** `attachments` (*Storage → New bucket*).
2. Pour chaque pièce jointe : télécharger l'URL Airtable, réuploader sous
   `notes/<note_id>/<filename>`, stocker l'URL publique renvoyée.
3. Même chose pour les couvertures, sous `travels/<travel_id>/cover.<ext>`.
4. Remplacer `src/utils/upload-image.ts` par un upload Supabase Storage.

```sql
create policy "upload par les connectés"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');
```

---

## Phase 7 — Réécriture de la couche services

L'app est bien découpée : composants et pages ne connaissent pas Airtable, tout
passe par les hooks puis par `src/services/`. **Les hooks TanStack Query restent
inchangés** dès lors que les fonctions de service gardent leur signature — sauf
celles dont le paramètre `scope` disparaît (voir section 4).

Fil conducteur : changer l'implémentation, préserver l'interface.

| Fichier | Action |
|---|---|
| `airtable-client.ts` | → `supabase-client.ts` |
| `airtable-config.ts` | Supprimé — 70 variables d'environnement en moins |
| `airtable-formula.ts` | Supprimé — plus d'injection de formule possible |
| `airtable-meta.ts` | Supprimé — les tags viennent d'un `select distinct` |
| `airtable-record.ts` | Supprimé — plus de champs liés à normaliser |
| `airtable.ts` | → `auth.ts` (Supabase Auth) |
| `users.ts` | Supprimé — plus d'annuaire |
| `habits.ts`, `habits-logs.ts`, `notes.ts`, `travels.ts`, `travel-budget.ts`, `travel-savings.ts`, `user-preferences.ts` | Réécrits |
| `measures.ts` | Supprimé — fonctionnalité retirée |
| `emailjs-config.ts`, `utils/reset-token.ts`, `utils/password-hash.ts` | Supprimés |
| `constants/project-scope.ts` | Supprimé |

Exemple de la transformation, sur `getActiveHabits` :

```ts
// Avant — 1 appel API, +1 par tranche de 100 lignes
const records = await habitsTable.select({
  filterByFormula: `AND({user_id} = ${formulaValue(userId)}, {is_active})`,
  sort: [{ field: "name", direction: "asc" }],
}).all();

// Après — une requête, pas de pagination, filtre doublé par la RLS
const { data, error } = await supabase
  .from("habits")
  .select("*")
  .eq("is_active", true)
  .order("name");
if (error) throw error;
```

Le `user_id` disparaît du filtre : la RLS s'en charge côté serveur. C'est
précisément ce qui rend la clé publique inoffensive.

Deux points côté auth :

- `checkAuthStatus()` lisait le `localStorage`. Supabase gère la session et son
  rafraîchissement : `AuthProvider` doit s'abonner à `onAuthStateChange` plutôt
  que lire un jeton au montage.
- La purge du cache à la déconnexion, ajoutée dans la PR #23, reste nécessaire
  et fonctionne à l'identique.

---

## Phase 8 — Bascule et vérification

1. **Compter les lignes**, et comparer aux totaux retenus à l'export (après
   filtrage des données d'autres comptes) :

   ```sql
   select 'habits' as t, count(*) from habits
   union all select 'habit_logs', count(*) from habit_logs
   union all select 'notes', count(*) from notes
   union all select 'travels', count(*) from travels
   union all select 'travel_budget', count(*) from travel_budget
   union all select 'travel_savings', count(*) from travel_savings;
   ```

2. **Vérifier la RLS depuis l'app**, pas depuis le SQL Editor : celui-ci
   s'exécute avec la clé secrète et contourne toutes les politiques. Le test utile
   est de se déconnecter et de constater qu'aucune donnée ne remonte.

3. **Comparer visuellement les écrans**, ancienne version contre nouvelle :
   tableau de l'arc, totaux du budget, cagnotte, graphe des notes. Ces totaux
   sont calculés côté client par des fonctions pures déjà couvertes par les 156
   tests — s'ils divergent, le problème est dans les données importées, pas dans
   le calcul.

4. **Garder la base Airtable un mois** avant toute suppression. `2026-app-migrate`
   reste, elle, l'archive permanente des données des autres comptes.

5. Retirer les variables `VITE_AIRTABLE_*` du `.env` et des secrets GitHub, puis
   `npm uninstall airtable @emailjs/browser`.

### Rollback

Tant que la branche n'est pas mergée, revenir en arrière consiste à repasser sur
`main` et redéployer : la base Airtable est intacte. Avec la phase 4 réduite à
une inscription, **plus aucune étape n'est irréversible**.

---

## Pièges identifiés

| # | Piège | Conséquence si ignoré |
|---|---|---|
| 1 | Les champs formule ne sont pas créables par l'API | Temps perdu à scripter l'impossible — passer par l'interface |
| 2 | Les URLs de pièces jointes Airtable expirent en ~2 h | Images perdues, réexport nécessaire |
| 3 | `TravelBudget.travel_id` est du texte, pas une relation | Lignes de budget orphelines, rejetées par la clé étrangère |
| 4 | `Habits.user_id` est un champ lié résolu par email | `user_id` NULL sur toutes les habitudes |
| 5 | Le filtrage par compte et le retrait des mesures à l'import | Import des données d'autres personnes, ou perte de la cagnotte commune |
| 6 | RLS oubliée sur une table | La clé publique expose cette table en écriture au monde entier |
| 7 | Projet Free pausé après 7 jours d'inactivité | App injoignable au retour de vacances |
| 8 | clé secrète committée ou préfixée `VITE_` | Toute la RLS contournée : pire que la situation actuelle |
| 9 | Dépôt renommé après la configuration Supabase | Redirect URLs à refaire, liens de reset cassés |
| 10 | Litterbox supprime les fichiers en 24 h | Certaines couvertures sont **déjà** mortes — ne pas chercher à les récupérer |

---

## Découpage en lots

| Lot | Contenu | Estimation | Vérifiable par |
|---|---|---|---|
| **0** ✅ | Renommage SecondBrain + dépôt | 2 h | App déployée sous le nouveau nom et la nouvelle URL |
| **1** ✅ | Phases 0 → 2 : projet, schéma, RLS | 2 h | Tables visibles, RLS active partout |
| **2** ✅ | Phase 3 : export | 1 h | Décompte des lignes par table |
| **3** ✅ | Phases 5 → 6 : import données et images | 3 h | Comptages conformes après filtrage |
| **4** ✅ | Section 4 : retrait du partage et des mensurations | 5 h | Tests verts, plus une occurrence de `ProjectScope` ni de `Measure` |
| **5** ✅ | Phase 7 : couche services et auth | 1 à 2 j | 152 tests verts, build OK |
| **6** | Phases 4 + 8 : compte et bascule | 2 h | Parcours complet sur ton compte |

Total : 3 à 4 jours de travail effectif.

Les lots 0 à 3 ne touchent pas à la logique applicative : ils préparent le
terrain pendant que l'app tourne encore sur Airtable. Le lot 4 peut être mené
**avant** le 5 sur Airtable, ou fusionné avec lui — les réécrire d'un coup évite
de toucher deux fois aux mêmes fichiers, au prix d'une revue plus lourde.
