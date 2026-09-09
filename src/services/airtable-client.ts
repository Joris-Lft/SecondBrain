import Airtable from "airtable";
import {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_HABITS_LOGS_TABLE_NAME,
  AIRTABLE_HABITS_TABLE_NAME,
  AIRTABLE_NOTES_TABLE_NAME,
  AIRTABLE_TABLE_NAME,
  AIRTABLE_TRAVEL_BUDGET_TABLE_NAME,
  AIRTABLE_TRAVEL_SAVINGS_TABLE_NAME,
  AIRTABLE_TRAVELS_TABLE_NAME,
} from "./airtable-config";

const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
export const base = airtable.base(AIRTABLE_BASE_ID);

export const usersTable = base(AIRTABLE_TABLE_NAME);
export const habitsTable = base(AIRTABLE_HABITS_TABLE_NAME);
export const habitsLogsTable = base(AIRTABLE_HABITS_LOGS_TABLE_NAME);
export const notesTable = base(AIRTABLE_NOTES_TABLE_NAME);
export const travelsTable = base(AIRTABLE_TRAVELS_TABLE_NAME);
export const travelBudgetTable = base(AIRTABLE_TRAVEL_BUDGET_TABLE_NAME);
export const travelSavingsTable = base(AIRTABLE_TRAVEL_SAVINGS_TABLE_NAME);
