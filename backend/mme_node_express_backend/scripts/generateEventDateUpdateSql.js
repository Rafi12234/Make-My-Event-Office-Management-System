// For production DBs where only phpMyAdmin (no server terminal) is available.
// Turns a phpMyAdmin JSON export of the "Event Date" cells into a reviewable
// .sql file of UPDATE statements, using the exact same parsing rules as
// scripts/normalizeEventDates.js — so you can eyeball the SQL before pasting
// it into phpMyAdmin's SQL tab yourself, instead of connecting to prod directly.
//
// Usage:
//   1. In phpMyAdmin (on the production DB), run this SQL query:
//        SELECT c.id, c.value_text
//        FROM sheet_cells c
//        JOIN sheet_columns col ON col.id = c.column_id
//        WHERE col.column_key = 'event_date';
//   2. Click "Export" on the results, choose format "JSON", and save the file.
//   3. Run: node scripts/generateEventDateUpdateSql.js path/to/export.json
//   4. Review the generated event_date_updates.sql, then back up the
//      production DB (phpMyAdmin Export), then paste that .sql into
//      phpMyAdmin's SQL tab on production and run it.

import fs from "node:fs";
import path from "node:path";
import { normalizeEventDateText } from "../src/utils/normalizeEventDate.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/generateEventDateUpdateSql.js <phpMyAdmin-json-export>");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);

// phpMyAdmin's JSON export is either a plain array of row objects, or an
// array of metadata objects where one has a `data` array of rows — handle both.
function findRows(value) {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && "id" in value[0] && "value_text" in value[0]) {
      return value;
    }
    for (const item of value) {
      const found = findRows(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    if (Array.isArray(value.data)) {
      const found = findRows(value.data);
      if (found) return found;
    }
    for (const key of Object.keys(value)) {
      const found = findRows(value[key]);
      if (found) return found;
    }
  }
  return null;
}

const rows = findRows(parsed);
if (!rows) {
  console.error("Could not find any rows with `id` and `value_text` fields in the given JSON file.");
  process.exit(1);
}

function escapeSqlString(text) {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

let updated = 0;
let skipped = 0;
const unparseable = [];
const statements = [];

for (const row of rows) {
  const id = row.id;
  const original = row.value_text;
  const text = original === null || original === undefined ? "" : String(original).trim();

  if (!text || /^n\/?a$/i.test(text)) {
    skipped += 1;
    continue;
  }

  const normalized = normalizeEventDateText(text);
  if (!normalized) {
    unparseable.push({ id, original });
    continue;
  }

  if (normalized === text) {
    skipped += 1;
    continue;
  }

  statements.push(`UPDATE sheet_cells SET value_text = '${escapeSqlString(normalized)}' WHERE id = ${id};`);
  updated += 1;
}

const outputPath = path.join(path.dirname(inputPath), "event_date_updates.sql");
fs.writeFileSync(outputPath, statements.join("\n") + "\n", "utf8");

console.log(`Generated ${updated} UPDATE statement(s) -> ${outputPath}`);
console.log(`Skipped ${skipped} (already correct/blank/N-A).`);
if (unparseable.length > 0) {
  console.log(`Could not parse ${unparseable.length} value(s) — these need manual editing in the app instead:`);
  for (const { id, original } of unparseable) {
    console.log(`  cell ${id}: ${JSON.stringify(original)}`);
  }
}
