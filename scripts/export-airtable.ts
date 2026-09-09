/**
 * Export brut des tables Airtable vers `migration/*.json`.
 *
 * Une seule passe de lecture : le quota du plan Free est déjà dépassé, et
 * chaque relecture entame le sursis. Les fichiers produits se rejouent ensuite
 * autant de fois que nécessaire sans retoucher Airtable.
 *
 * Usage : npx tsx scripts/export-airtable.ts
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";

config({ path: ".env" });

const {
  usersTable,
  habitsTable,
  habitsLogsTable,
  notesTable,
  travelsTable,
  travelBudgetTable,
  travelSavingsTable,
} = await import("../src/services/airtable-client");

// Les mensurations ne sont pas exportées : la fonctionnalité est retirée et
// la base dupliquée `2026-app-migrate` en conserve l'intégralité.
const TABLES = {
  users: usersTable,
  habits: habitsTable,
  habitLogs: habitsLogsTable,
  notes: notesTable,
  travels: travelsTable,
  travelBudget: travelBudgetTable,
  travelSavings: travelSavingsTable,
};

const OUTPUT_DIR = "migration";

mkdirSync(OUTPUT_DIR, { recursive: true });

const counts: Record<string, number> = {};

for (const [name, table] of Object.entries(TABLES)) {
  const records = await table.select().all();
  const rows = records.map((record) => ({
    id: record.id,
    fields: record.fields,
  }));

  writeFileSync(
    `${OUTPUT_DIR}/${name}.json`,
    JSON.stringify(rows, null, 2),
    "utf-8",
  );

  counts[name] = rows.length;
  console.log(`${name.padEnd(14)} ${String(rows.length).padStart(5)} lignes`);
}

// Sert de référence au contrôle d'intégrité d'après import.
writeFileSync(
  `${OUTPUT_DIR}/counts.json`,
  JSON.stringify(counts, null, 2),
  "utf-8",
);

console.log(`\nExport terminé dans ${OUTPUT_DIR}/`);
