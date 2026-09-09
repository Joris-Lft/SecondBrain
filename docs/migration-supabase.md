# Plan de migration Airtable → Supabase

> Objectif : sortir du plafond de 1 000 appels API/mois du plan Free d'Airtable,
> et fermer au passage la faille de la clé API exposée côté client, sans perdre
> une fonctionnalité ni une donnée.

## Sommaire

1. [Prérequis](#1-prérequis)
2. [Ce qui change, et pourquoi](#2-ce-qui-change-et-pourquoi)
3. [Décisions à prendre avant de commencer](#3-décisions-à-prendre-avant-de-commencer)
4. [Phase 0 — Créer le compte et le projet Supabase](#phase-0--créer-le-compte-et-le-projet-supabase)
5. [Phase 1 — Le schéma SQL](#phase-1--le-schéma-sql)
6. [Phase 2 — Row Level Security](#phase-2--row-level-security)
7. [Phase 3 — Export Airtable](#phase-3--export-airtable)
8. [Phase 4 — Les comptes utilisateurs](#phase-4--les-comptes-utilisateurs)
9. [Phase 5 — Import des données](#phase-5--import-des-données)
10. [Phase 6 — Les images](#phase-6--les-images)
11. [Phase 7 — Réécriture de la couche services](#phase-7--réécriture-de-la-couche-services)
12. [Phase 8 — Bascule et vérification](#phase-8--bascule-et-vérification)
13. [Pièges identifiés](#pièges-identifiés)
14. [Découpage en lots](#découpage-en-lots)

---

## 1. Prérequis

Quatre points à régler avant le lot 1. Les deux premiers coûtent cinq minutes
et évitent un blocage coûteux plus loin.

### 1.1 Déployer la réduction de consommation

La PR #23 (`perf(cache)`) doit être mergée et déployée. Elle divise la
consommation par 5 à 10 : c'est ce qui laisse de la marge de quota pendant les
3 à 4 jours de migration.

### 1.2 Dupliquer la base Airtable

*Duplicate base* depuis l'interface. L'opération ne consomme **aucun appel
API** — elle ne passe pas par l'API — et fige un point de retour pour toute la
durée de la migration.

### 1.3 Ajouter un champ formule `RECORD_ID()` dans les 8 tables

Le prérequis le moins évident, et le plus utile.

Toute la migration repose sur les identifiants `recXXX` pour reconstruire les
liens : `travel_id` des lignes de budget, `habit_id` des logs, assignations des
notes. Si l'API venait à être bloquée, le seul recours serait l'export CSV
manuel — **qui ne contient pas les identifiants de records**. Les relations
seraient alors irrécupérables.

Un champ formule `RECORD_ID()`, lui, sort dans le CSV. Cinq minutes d'assurance
contre un scénario qui coûterait des heures de ressaisie.

### 1.4 Relever l'état du quota

Dans le dashboard Airtable, et noter la date du mail de dépassement : c'est elle
qui démarre les 30 jours de grace period.

À savoir pour ne pas surestimer l'urgence : **même bloqué, le quota se
réinitialise le 1er du mois**, et 1 000 appels frais couvrent très largement un
export qui en consomme 30 à 60. Le pire scénario n'est pas la perte de données,
c'est d'attendre le 1er du mois suivant pour lancer le lot 2.

### Ce qui n'est pas un prérequis

Node et `tsx` sont déjà en place. Le seul ajout de dépendance est
`@supabase/supabase-js`, au lot 4. La validité des emails des comptes est à
vérifier avant le **lot 5** seulement — elle se contrôle sur l'export du lot 2,
qui répond en même temps à la décision 2.4.

---

## 2. Ce qui change, et pourquoi

| Aujourd'hui | Après |
|---|---|
| Clé API Airtable en clair dans le bundle JS, accès total en lecture/écriture | Clé `anon` publique par design, chaque requête filtrée par Row Level Security |
| Mots de passe en SHA-256 + sel global, vérifiés côté navigateur | Supabase Auth (bcrypt, session JWT, vérification serveur) |
| Reset password maison : HMAC signé côté client avec un secret dans le bundle | Reset natif Supabase |
| 1 000 appels/mois, tous écrans confondus | Appels illimités, 500 Mo de base |
| Relations par texte (`travel_id` contenant un `recXXX`) | Clés étrangères, cascades, contraintes d'unicité |
| Pagination Airtable : 1 appel API par tranche de 100 lignes | Une requête SQL |

Le plan Free Supabase : 500 Mo de base, 1 Go de stockage fichiers, 5 Go de bande
passante, 50 000 utilisateurs actifs/mois, 2 projets. Sans commune mesure avec
le volume de cette app.

---

## 3. Décisions à prendre avant de commencer

Ces quatre points conditionnent la suite. Les trois premiers ont une
recommandation ; le quatrième dépend d'un chiffre que tu es seul à connaître.

### 3.1 Les mots de passe existants sont perdus

C'est le point dur de la migration, et il n'a pas de solution élégante.

Les mots de passe actuels sont hachés en `SHA-256(motdepasse + sel)` par
`src/utils/password-hash.ts`. Supabase Auth attend du bcrypt, argon2 ou scrypt.
Il sait importer des hashs dans ces formats — mais pas convertir du SHA-256, qui
est un aller sans retour.

**Recommandation** : créer chaque compte avec un mot de passe aléatoire, puis
déclencher un email de réinitialisation pour chacun. Avec un nombre
d'utilisateurs qui se compte sur les doigts d'une main, c'est cinq minutes de
gêne contre une base d'authentification saine.

Bénéfice collatéral : le hachage actuel (SHA-256, une seule itération, sel
global partagé) est cassable au dictionnaire quasi instantanément. Le remplacer
n'est pas un dommage collatéral de la migration, c'est un gain.

### 3.2 Les emails transactionnels

L'app envoie aujourd'hui les liens de reset via EmailJS. Supabase Auth envoie
les siens nativement.

**Recommandation** : passer aux emails Supabase et retirer EmailJS. Cela
supprime `@emailjs/browser`, `src/services/emailjs-config.ts`,
`src/utils/reset-token.ts` et trois variables d'environnement — dont
`VITE_RESET_TOKEN_SECRET`, un secret HMAC actuellement publié dans le bundle.

À savoir : le SMTP par défaut de Supabase est bridé (quelques mails par heure)
et réservé aux tests. Pour un usage réel, brancher un SMTP gratuit (Resend,
Brevo) dans *Authentication → Emails → SMTP Settings*. Pour deux ou trois
resets par an, le SMTP par défaut suffit.

### 3.3 Les images

Deux dépendances externes aujourd'hui : ImgBB si `VITE_IMGBB_API_KEY` est
défini, sinon Litterbox — **qui supprime les fichiers au bout de 24 h**
(`time=24h` dans `src/utils/upload-image.ts`). Les couvertures de projets
uploadées sans clé ImgBB sont donc mortes le lendemain.

**Recommandation** : basculer sur Supabase Storage. Un bucket, 1 Go inclus,
plus de dépendance tierce, et le bug des 24 h disparaît.

### 3.4 Combien d'utilisateurs, et lesquels ?

Nécessaire pour dimensionner la phase 4. À récupérer d'un coup avec l'export de
la phase 3 — surtout pas par une requête séparée, le quota Airtable étant déjà
dépassé.

---

## Phase 0 — Créer le compte et le projet Supabase

Étape par étape, aucune connaissance préalable requise.

1. Aller sur **https://supabase.com** → *Start your project*. Connexion via
   GitHub (le plus simple, le compte existe déjà).
2. *New project*. Choisir l'organisation par défaut, puis :
   - **Name** : `2026`
   - **Database Password** : générer et **la stocker dans un gestionnaire de
     mots de passe**. Elle sert aux connexions SQL directes et n'est plus
     jamais réaffichée.
   - **Region** : `West EU (Ireland)` ou `Central EU (Frankfurt)` — la plus
     proche, c'est de la latence en moins sur chaque requête.
   - **Plan** : Free.
3. Attendre ~2 minutes le provisionnement.
4. Récupérer les clés dans *Project Settings → API* :

| Clé | Où elle va | Nature |
|---|---|---|
| `Project URL` | `.env` → `VITE_SUPABASE_URL` | Publique |
| `anon public` | `.env` → `VITE_SUPABASE_ANON_KEY` | **Publique par design** — elle n'ouvre que ce que la RLS autorise |
| `service_role` | Scripts de migration uniquement, **jamais** dans un `.env` préfixé `VITE_` | **Secrète** — elle contourne toute la RLS |

> ⚠️ La distinction anon / service_role est le cœur du modèle de sécurité
> Supabase. La clé `anon` peut être publiée sans risque *à condition que la RLS
> soit active sur chaque table* (phase 2). La `service_role` a tous les droits :
> elle ne doit jamais entrer dans le code front, ni dans un fichier versionné.

5. **Déclarer les URL de redirection** dans *Authentication → URL
   Configuration* : `Site URL` à `https://joris-lft.github.io/2026/`, et en
   `Redirect URLs` ajouter `https://joris-lft.github.io/2026/**` ainsi que
   `http://localhost:5173/**` pour le développement.

   > Sans cette déclaration, Supabase refuse toute redirection vers une URL
   > inconnue : les liens de réinitialisation de la phase 4 ne mènent nulle
   > part, sans message d'erreur explicite.

6. Installer le client : `npm install @supabase/supabase-js`

### Le piège de la mise en pause

**Un projet Free est mis en pause après 7 jours sans activité.** L'app devient
alors injoignable jusqu'à une restauration manuelle depuis le dashboard.

Pour une app de tracking quotidien, l'usage normal suffit à l'éviter. Mais deux
semaines de vacances la mettent en pause. Parade : un workflow GitHub Actions
qui interroge la base une fois par jour.

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
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

---

## Phase 1 — Le schéma SQL

À exécuter dans *SQL Editor → New query* sur le dashboard.

Le schéma reprend le modèle actuel en corrigeant trois faiblesses structurelles
qu'Airtable ne permettait pas d'exprimer : les relations deviennent des clés
étrangères, les valeurs contraintes deviennent des `check`, et l'unicité d'un
log par période devient une contrainte plutôt qu'une convention.

```sql
-- ---------------------------------------------------------------
-- Profils. Étend auth.users, qui détient email et mot de passe.
-- ---------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null unique,
  show_habits             boolean not null default true,
  show_measures           boolean not null default true,
  show_personal_projects  boolean not null default true,
  created_at              timestamptz not null default now()
);

-- Crée le profil automatiquement à chaque inscription.
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
-- Habitudes
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
-- Mesures
-- ---------------------------------------------------------------
create table public.measures (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  date     date not null,
  weight   numeric,
  arm      numeric,
  bust     numeric,
  waist    numeric,
  hip      numeric,
  thigh    numeric
);
create index measures_user_date_idx on public.measures (user_id, date desc);

-- ---------------------------------------------------------------
-- Notes. Le multi-assignation devient une table de jointure ;
-- `status` reste stocké pour rester compatible avec l'affichage actuel.
-- ---------------------------------------------------------------
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  note_number  bigint generated by default as identity,
  content      text not null,
  status       text not null default 'Perso' check (status in ('Perso','Commune')),
  tags         text[] not null default '{}',
  created_at   date not null default current_date
);
create index notes_created_idx on public.notes (created_at desc);
create index notes_tags_idx on public.notes using gin (tags);

create table public.note_assignees (
  note_id  uuid not null references public.notes(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (note_id, user_id)
);

create table public.note_attachments (
  id        uuid primary key default gen_random_uuid(),
  note_id   uuid not null references public.notes(id) on delete cascade,
  url       text not null,
  filename  text not null,
  size      bigint,
  type      text
);

-- ---------------------------------------------------------------
-- Projets et voyages
-- ---------------------------------------------------------------
create table public.travels (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  cover_url    text,
  is_voyage    boolean not null default false,
  is_personal  boolean not null default false,
  destination  text not null default '',
  start_date   date,
  end_date     date,
  description  text not null default '',
  created_at   date not null default current_date
);
create index travels_scope_idx on public.travels (is_personal, user_id);

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
  -- NULL = cagnotte commune. Reproduit la convention actuelle
  -- (`user_id` vide) en la rendant explicite.
  user_id  uuid references public.profiles(id) on delete cascade,
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
| `HabitsLogs.habit_id` (texte `recXXX`) | FK uuid + cascade | |
| `Notes.id` (autonumber) | `note_number` (identity) | |
| `Notes.Assignees` (multi) | table `note_assignees` | |
| `Notes.Attachments` | table `note_attachments` | Fichiers à rapatrier (phase 6) |
| `Notes.tags` (multi-select) | `text[]` + index GIN | Plus besoin de l'API meta d'Airtable |
| `TravelBudget.travel_id` (texte) | FK uuid + cascade | |
| `TravelSavings.user_id` vide | `NULL` | Cagnotte commune |

---

## Phase 2 — Row Level Security

Sans RLS, la clé `anon` publique donne accès à tout. **Cette phase n'est pas
optionnelle.**

```sql
alter table public.profiles        enable row level security;
alter table public.habits          enable row level security;
alter table public.habit_logs      enable row level security;
alter table public.measures        enable row level security;
alter table public.notes           enable row level security;
alter table public.note_assignees  enable row level security;
alter table public.note_attachments enable row level security;
alter table public.travels         enable row level security;
alter table public.travel_budget   enable row level security;
alter table public.travel_savings  enable row level security;

-- Profils : chacun lit et modifie le sien. L'annuaire (email seul) reste
-- lisible par tous les comptes connectés — l'app en a besoin pour inviter
-- quelqu'un sur une note.
create policy "profils lisibles par les connectés"
  on public.profiles for select to authenticated using (true);
create policy "chacun modifie son profil"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Habitudes, logs, mesures : strictement personnels.
create policy "habitudes personnelles" on public.habits
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "logs personnels" on public.habit_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mesures personnelles" on public.measures
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notes : visibles des personnes assignées.
create policy "notes assignées" on public.notes
  for all to authenticated
  using (exists (
    select 1 from public.note_assignees a
    where a.note_id = notes.id and a.user_id = auth.uid()
  ));

create policy "assignations des notes visibles" on public.note_assignees
  for all to authenticated
  using (exists (
    select 1 from public.note_assignees mine
    where mine.note_id = note_assignees.note_id and mine.user_id = auth.uid()
  ));

create policy "pièces jointes des notes visibles" on public.note_attachments
  for all to authenticated
  using (exists (
    select 1 from public.note_assignees a
    where a.note_id = note_attachments.note_id and a.user_id = auth.uid()
  ));

-- Projets : les communs pour tous, les persos pour leur créateur.
create policy "projets communs ou personnels" on public.travels
  for all to authenticated
  using (not is_personal or auth.uid() = user_id)
  with check (not is_personal or auth.uid() = user_id);

create policy "budget suit son projet" on public.travel_budget
  for all to authenticated
  using (exists (
    select 1 from public.travels t
    where t.id = travel_budget.travel_id
      and (not t.is_personal or t.user_id = auth.uid())
  ));

-- Cagnotte : la commune (user_id NULL) pour tous, les persos pour leur auteur.
create policy "cagnotte commune ou personnelle" on public.travel_savings
  for all to authenticated
  using (user_id is null or auth.uid() = user_id)
  with check (user_id is null or auth.uid() = user_id);
```

> **À vérifier après création** : le dashboard signale en rouge toute table sans
> RLS active (*Database → Tables*). Aucune ne doit rester non protégée.

---

## Phase 3 — Export Airtable

**Une seule passe de lecture, sauvegardée sur disque.** Le quota est déjà
dépassé : chaque relecture consomme le peu qui reste du grace period. Le script
écrit un JSON brut qu'on pourra rejouer autant de fois que nécessaire sans
retoucher Airtable.

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

Compter environ 30 à 60 appels API pour l'export complet, pagination comprise.
Vérifier ensuite le décompte des lignes par table : c'est la référence à
recontrôler après import.

---

## Phase 4 — Les comptes utilisateurs

Nécessite la clé `service_role` (jamais dans un fichier versionné —
l'exporter dans le shell le temps du script).

`scripts/migrate-users.ts` :

```ts
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const users = JSON.parse(readFileSync("migration/users.json", "utf-8"));
const idMap: Record<string, string> = {};   // recXXX Airtable -> uuid Supabase

for (const row of users) {
  const email = String(row.fields.email ?? "").trim();
  if (!email) continue;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    // Jamais communiqué : chacun passera par « mot de passe oublié ».
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: true,
  });
  if (error) throw new Error(`${email}: ${error.message}`);

  idMap[row.id] = data.user.id;

  // Le trigger a créé le profil ; on y reporte les préférences de navigation.
  await admin.from("profiles").update({
    show_habits: row.fields.show_habits === true,
    show_measures: row.fields.show_measures === true,
    show_personal_projects: row.fields.show_personal_projects === true,
  }).eq("id", data.user.id);

  console.log(`${email} -> ${data.user.id}`);
}

writeFileSync("migration/user-id-map.json", JSON.stringify(idMap, null, 2));
```

`user-id-map.json` est la pièce maîtresse de la phase 5 : toutes les autres
tables référencent les utilisateurs, tantôt par identifiant `recXXX`, tantôt par
email. Construire aussi une correspondance email → uuid à partir de ce fichier.

Envoyer ensuite les invitations à réinitialiser :

```ts
await admin.auth.resetPasswordForEmail(email, {
  redirectTo: "https://joris-lft.github.io/2026/reset-password",
});
```

---

## Phase 5 — Import des données

Ordre imposé par les clés étrangères :

```
profiles (phase 4)
  └─ habits ─ habit_logs
  └─ measures
  └─ notes ─ note_assignees / note_attachments
  └─ travels ─ travel_budget
  └─ travel_savings
```

Chaque étape produit sa propre table de correspondance
(`habit-id-map.json`, `travel-id-map.json`…), consommée par l'étape suivante.

Trois normalisations à ne pas oublier, parce qu'elles sont invisibles dans les
données brutes :

1. **`Habits.user_id` est un champ lié** : Airtable le renvoie sous forme de
   tableau, et l'app le résout par email (`firstLinkedId` dans
   `src/services/airtable-record.ts`). Selon la configuration, la valeur est un
   `recXXX` ou un email — le script doit accepter les deux et retomber sur la
   correspondance email → uuid.

2. **`TravelBudget.travel_id` est du texte contenant un `recXXX`**. Sans la
   table de correspondance, ces lignes deviennent orphelines et la FK rejette
   l'insertion. C'est le contrôle d'intégrité le plus utile de la migration :
   une erreur ici signale un lien déjà cassé côté Airtable.

3. **`TravelSavings.user_id` vide → `NULL`**, jamais chaîne vide : la politique
   RLS de la cagnotte commune teste `user_id is null`.

Filtrer aussi les lignes vides que l'app ignore déjà côté client : versements à
montant nul (les trois lignes par défaut d'Airtable), notes sans contenu.

---

## Phase 6 — Les images

Deux sources : `Notes.Attachments` et `Travel.Cover`.

> ⏱️ **Contrainte de temps** : les URLs de pièces jointes Airtable **expirent
> environ deux heures après leur lecture**. Le téléchargement doit suivre
> l'export de la phase 3 de près — sinon il faut réexporter, et donc
> reconsommer du quota.

1. Créer un bucket **public** `attachments` (*Storage → New bucket*).
2. Pour chaque pièce jointe : télécharger l'URL Airtable, réuploader dans le
   bucket sous `notes/<note_id>/<filename>`, stocker l'URL publique renvoyée.
3. Même chose pour les couvertures, sous `travels/<travel_id>/cover.<ext>`.
4. Remplacer `src/utils/upload-image.ts` par un upload Supabase Storage —
   ImgBB et Litterbox disparaissent.

Politique d'écriture sur le bucket :

```sql
create policy "upload par les connectés"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');
```

---

## Phase 7 — Réécriture de la couche services

**La bonne nouvelle** : l'app est déjà bien découpée. Les composants et les
pages ne connaissent pas Airtable — ils passent par les hooks, qui passent par
`src/services/`. Le périmètre à réécrire est donc circonscrit à cette couche,
et **les hooks TanStack Query restent tels quels** dès lors que les fonctions
de service gardent leur signature et leur type de retour.

C'est le fil conducteur de toute la phase : *changer l'implémentation, préserver
l'interface*.

| Fichier | Action |
|---|---|
| `src/services/airtable-client.ts` | → `supabase-client.ts` (`createClient`) |
| `src/services/airtable-config.ts` | Supprimé — 70 variables d'environnement en moins |
| `src/services/airtable-formula.ts` | Supprimé — plus d'injection de formule possible |
| `src/services/airtable-meta.ts` | Supprimé — les tags viennent d'un `select distinct` |
| `src/services/airtable-record.ts` | Supprimé — plus de champs liés à normaliser |
| `src/services/airtable.ts` | → `auth.ts` (Supabase Auth) |
| `habits.ts`, `habits-logs.ts`, `measures.ts`, `notes.ts`, `travels.ts`, `travel-budget.ts`, `travel-savings.ts`, `users.ts`, `user-preferences.ts` | Réécrits, **signatures inchangées** |
| `emailjs-config.ts`, `src/utils/reset-token.ts`, `src/utils/password-hash.ts` | Supprimés |

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

Deux points d'attention côté auth :

- `checkAuthStatus()` lisait le `localStorage`. Supabase gère la session et son
  rafraîchissement ; `AuthProvider` doit s'abonner à `onAuthStateChange` plutôt
  que lire un jeton au montage.
- La purge du cache à la déconnexion (ajoutée dans la PR #23) reste nécessaire
  et fonctionne à l'identique.

---

## Phase 8 — Bascule et vérification

1. **Compter les lignes**, table par table, et comparer aux totaux de
   l'export :

   ```sql
   select 'habits' as t, count(*) from habits
   union all select 'habit_logs', count(*) from habit_logs
   union all select 'measures', count(*) from measures
   union all select 'notes', count(*) from notes
   union all select 'travels', count(*) from travels
   union all select 'travel_budget', count(*) from travel_budget
   union all select 'travel_savings', count(*) from travel_savings;
   ```

2. **Vérifier la RLS depuis un vrai compte** : se connecter dans l'app, puis
   contrôler qu'un projet personnel d'un autre utilisateur est bien invisible.
   Un test depuis le SQL Editor ne prouve rien — il s'exécute en
   `service_role` et contourne toutes les politiques.

3. **Comparer visuellement les écrans**, ancienne version contre nouvelle :
   tableau de l'arc, totaux du budget, cagnotte, graphe des notes. Les totaux
   sont calculés côté client par des fonctions pures déjà couvertes par les 156
   tests existants — s'ils divergent, le problème est dans les données
   importées, pas dans le calcul.

4. **Garder la base Airtable en lecture seule un mois**, le temps de confirmer
   qu'aucune donnée ne manque. Ne rien supprimer avant.

5. Retirer les variables `VITE_AIRTABLE_*` du `.env` et des secrets GitHub, et
   `npm uninstall airtable @emailjs/browser`.

### Rollback

Tant que la branche n'est pas mergée, revenir en arrière consiste à repasser sur
`main` et redéployer : la base Airtable est intacte. Après bascule, le risque
réel n'est pas la donnée mais les **mots de passe**, réinitialisés
irréversiblement. D'où la recommandation de traiter la phase 4 en dernier,
juste avant la bascule.

---

## Pièges identifiés

| # | Piège | Conséquence si ignoré |
|---|---|---|
| 1 | Les URLs de pièces jointes Airtable expirent en ~2 h | Images perdues, réexport nécessaire (et quota consommé) |
| 2 | `TravelBudget.travel_id` est du texte, pas une relation | Lignes de budget orphelines, rejetées par la FK |
| 3 | `Habits.user_id` est un champ lié résolu par email | `user_id` NULL sur toutes les habitudes |
| 4 | `TravelSavings.user_id` vide ≠ NULL | La cagnotte commune disparaît de l'affichage |
| 5 | RLS oubliée sur une table | La clé publique expose cette table en écriture au monde entier |
| 6 | Projet Free pausé après 7 jours d'inactivité | App injoignable au retour de vacances |
| 7 | Les hashs SHA-256 ne sont pas importables | Découvert trop tard = bascule bloquée. D'où la décision 2.1, à prendre **avant** de commencer |
| 8 | `service_role` committée ou préfixée `VITE_` | Toute la RLS contournée : pire que la situation actuelle |
| 9 | Litterbox supprime les fichiers en 24 h | Certaines couvertures sont **déjà** mortes — ne pas chercher à les récupérer |

---

## Découpage en lots

Chaque lot est indépendant et vérifiable. Les lots 1 à 3 ne touchent pas à
l'application : ils peuvent être menés sans rien casser, et sans presser la
bascule.

| Lot | Contenu | Estimation | Vérifiable par |
|---|---|---|---|
| **1** | Phase 0 + phase 1 + phase 2 | 2 h | Tables visibles, RLS active partout |
| **2** | Phase 3 — export | 1 h | Décompte des lignes par table |
| **3** | Phases 5 et 6 — import données et images | 4 h | Comptages identiques à l'export |
| **4** | Phase 7 — services + auth | 1 à 2 j | 156 tests verts, build OK |
| **5** | Phase 4 + phase 8 — comptes et bascule | 3 h | Parcours complet sur un vrai compte |

Total : 3 à 4 jours de travail effectif.

L'ordre a une logique : les lots 1 à 3 construisent la base Supabase pendant que
l'app continue de tourner sur Airtable. Le lot 4 est le seul à toucher au code
applicatif. Le lot 5, qui réinitialise les mots de passe, est le seul
irréversible — d'où sa place en dernier.
