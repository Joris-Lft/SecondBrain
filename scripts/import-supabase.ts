/**
 * Import des données exportées d'Airtable vers Supabase.
 *
 * Nécessite la clé secrète : les tables sont protégées par RLS, et le script
 * écrit pour le compte de l'utilisateur sans être authentifié comme lui.
 *
 *   SUPABASE_SECRET_KEY=sb_secret_… npx tsx scripts/import-supabase.ts
 *
 * Le script est volontairement non idempotent : il refuse de tourner si les
 * tables contiennent déjà quelque chose, plutôt que de risquer des doublons.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

config({ path: ".env" });

/** Compte de destination : tout ce qui est importé lui est rattaché. */
const USER_UUID = "3b82d16c-6295-4d7e-8031-3fd7001f53e9";
const USER_EMAIL = "contact@joris-lefait.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    "Variables manquantes. Attendu VITE_SUPABASE_URL et SUPABASE_SECRET_KEY\n" +
      "(la clé secrète ne doit jamais être préfixée VITE_ : elle contourne la RLS).",
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = { id: string; fields: Record<string, any> };

const load = (name: string): Row[] =>
  JSON.parse(readFileSync(`migration/${name}.json`, "utf-8"));

/** Premier identifiant d'un champ lié Airtable, qui arrive sous forme de tableau. */
const linked = (value: unknown): string | undefined =>
  Array.isArray(value) ? (value[0] as string) : (value as string | undefined);

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Garde-fou : ne jamais importer par-dessus des données existantes.
// ---------------------------------------------------------------------------
const TABLES = [
  "habits",
  "habit_logs",
  "notes",
  "travels",
  "travel_budget",
  "travel_savings",
];

for (const table of TABLES) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`Lecture de ${table} impossible : ${error.message}`);
  if (count && count > 0) {
    console.error(
      `${table} contient déjà ${count} ligne(s). Vider les tables avant de rejouer l'import.`,
    );
    process.exit(1);
  }
}

const { data: profile, error: profileError } = await db
  .from("profiles")
  .select("id, email")
  .eq("id", USER_UUID)
  .single();

if (profileError || !profile) {
  console.error(
    `Profil ${USER_UUID} introuvable. Le compte doit exister avant l'import.`,
  );
  process.exit(1);
}
console.log(`Compte cible : ${profile.email}\n`);

// ---------------------------------------------------------------------------
// Le compte Airtable correspondant, dont dérive tout le filtrage.
// ---------------------------------------------------------------------------
const users = load("users");
const airtableMe = users.find(
  (u) => String(u.fields.email ?? "").toLowerCase() === USER_EMAIL.toLowerCase(),
);
if (!airtableMe) {
  console.error(`Aucun compte Airtable pour ${USER_EMAIL}`);
  process.exit(1);
}
const ME = airtableMe.id;

// ---------------------------------------------------------------------------
// Couvertures de projets : déjà téléchargées, à verser dans le Storage.
// ---------------------------------------------------------------------------
const BUCKET = "attachments";
const coverUrlByTravel = new Map<string, string>();

if (existsSync("migration/covers/index.json")) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Création du bucket : ${error.message}`);
    console.log(`Bucket « ${BUCKET} » créé`);
  }

  const covers: Record<string, { file: string; type: string }> = JSON.parse(
    readFileSync("migration/covers/index.json", "utf-8"),
  );

  for (const [travelRecId, cover] of Object.entries(covers)) {
    const path = `travels/${travelRecId}/${cover.file}`;
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, readFileSync(`migration/covers/${cover.file}`), {
        contentType: cover.type,
        upsert: true,
      });
    if (error) throw new Error(`Upload ${cover.file} : ${error.message}`);

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    coverUrlByTravel.set(travelRecId, data.publicUrl);
  }
  console.log(`${coverUrlByTravel.size} couverture(s) versée(s) dans le Storage\n`);
}

// ---------------------------------------------------------------------------
// Habitudes et logs
// ---------------------------------------------------------------------------
const habitIdMap = new Map<string, string>();
const habitRows = load("habits")
  .filter((h) => linked(h.fields.user_id) === ME)
  .map((h) => {
    const id = randomUUID();
    habitIdMap.set(h.id, id);
    return {
      id,
      user_id: USER_UUID,
      name: String(h.fields.name ?? ""),
      frequency: String(h.fields.frequency ?? "daily"),
      created_at: h.fields.created_at ?? null,
      is_active: h.fields.is_active === true,
      deleted_date: h.fields.deleted_date ?? null,
    };
  });
await insert("habits", habitRows);

const logRows = load("habitLogs")
  .filter((l) => linked(l.fields.user_id) === ME)
  .filter((l) => habitIdMap.has(linked(l.fields.habit_id) ?? ""))
  .map((l) => ({
    id: randomUUID(),
    habit_id: habitIdMap.get(linked(l.fields.habit_id)!)!,
    user_id: USER_UUID,
    completed_at: l.fields.completed_at ?? new Date().toISOString(),
    frequency: String(l.fields.frequency ?? "daily"),
    period: String(l.fields.period ?? ""),
  }));
await insert("habit_logs", logRows);

// ---------------------------------------------------------------------------
// Notes : celles où le compte figure, seul ou non. `note_number` est repris
// tel quel — les wikilinks peuvent cibler une note par son numéro.
// ---------------------------------------------------------------------------
const noteRows = load("notes")
  .filter((n) => (n.fields.Assignees ?? []).includes(ME))
  .map((n) => ({
    id: randomUUID(),
    user_id: USER_UUID,
    note_number: Number(n.fields.id ?? 0) || undefined,
    content: String(n.fields.Notes ?? ""),
    tags: n.fields.tags ?? [],
    created_at: n.fields.created_at ?? null,
  }))
  .filter((n) => n.content.trim() !== "");
await insert("notes", noteRows);

// ---------------------------------------------------------------------------
// Projets : les communs et les siens. Le budget suit son projet.
// ---------------------------------------------------------------------------
const travelIdMap = new Map<string, string>();
const travelRows = load("travels")
  .filter(
    (t) =>
      t.fields.is_personal !== true ||
      String(t.fields.user_id ?? "").toLowerCase() === USER_EMAIL.toLowerCase(),
  )
  .map((t) => {
    const id = randomUUID();
    travelIdMap.set(t.id, id);
    return {
      id,
      user_id: USER_UUID,
      name: String(t.fields.Name ?? ""),
      cover_url: coverUrlByTravel.get(t.id) ?? null,
      is_voyage: t.fields.is_voyage === true,
      destination: String(t.fields.destination ?? ""),
      start_date: t.fields.start_date ?? null,
      end_date: t.fields.end_date ?? null,
      description: String(t.fields.description ?? ""),
      created_at: t.fields.created_at ?? null,
    };
  });
await insert("travels", travelRows);

const budgetRows = load("travelBudget")
  .filter((b) => travelIdMap.has(String(b.fields.travel_id ?? "")))
  .map((b) => ({
    id: randomUUID(),
    travel_id: travelIdMap.get(String(b.fields.travel_id))!,
    category: String(b.fields.category ?? "Autre"),
    label: String(b.fields.label ?? ""),
    estimated: b.fields.estimated ?? null,
    actual: b.fields.actual ?? null,
    notes: String(b.fields.notes ?? ""),
    location: String(b.fields.location ?? ""),
    in_budget: b.fields.in_budget === true,
    to_visit: b.fields.to_visit === true,
    purchased: b.fields.purchased === true,
    spend_level: String(b.fields.spend_level ?? "Confortable"),
  }));
await insert("travel_budget", budgetRows);

// ---------------------------------------------------------------------------
// Cagnotte : les versements du compte, et ceux de l'ancienne cagnotte commune
// — reconnaissables à leur user_id vide.
// ---------------------------------------------------------------------------
const depositRows = load("travelSavings")
  .filter((d) => {
    const owner = String(d.fields.user_id ?? "").trim();
    return owner === "" || owner.toLowerCase() === USER_EMAIL.toLowerCase();
  })
  .filter((d) => Number(d.fields.amount ?? 0) > 0)
  .map((d) => ({
    id: randomUUID(),
    user_id: USER_UUID,
    amount: Number(d.fields.amount),
    author: String(d.fields.author ?? ""),
    date: d.fields.date ?? null,
    note: String(d.fields.note ?? ""),
  }));
await insert("travel_savings", depositRows);

// ---------------------------------------------------------------------------
// Correspondances et rapport
// ---------------------------------------------------------------------------
writeFileSync(
  "migration/id-map.json",
  JSON.stringify(
    {
      user: { [ME]: USER_UUID },
      habits: Object.fromEntries(habitIdMap),
      travels: Object.fromEntries(travelIdMap),
    },
    null,
    2,
  ),
);

const source = JSON.parse(readFileSync("migration/counts.json", "utf-8"));
const report: [string, number, number][] = [
  ["habits", habitRows.length, source.habits],
  ["habit_logs", logRows.length, source.habitLogs],
  ["notes", noteRows.length, source.notes],
  ["travels", travelRows.length, source.travels],
  ["travel_budget", budgetRows.length, source.travelBudget],
  ["travel_savings", depositRows.length, source.travelSavings],
];

console.log("table            importées   exportées   écartées");
for (const [name, kept, total] of report) {
  console.log(
    `${name.padEnd(16)}${String(kept).padStart(9)}${String(total).padStart(12)}${String(total - kept).padStart(11)}`,
  );
}
console.log("\nImport terminé.");
