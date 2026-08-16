// One-off structural migration: the "Event Date" column (columnKey
// "event_date") was originally a plain "text" column (values already
// normalized to "DD/MM/YYYY" by normalizeEventDates.js). This converts it
// into a real "date" column — copying each cell's text value into the
// proper `value_date` DATE column, then flipping the column's `data_type`
// to "date" so the app starts reading/writing it as an actual date.
//
// Run once with: node scripts/convertEventDateColumnToDateType.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const column = await prisma.sheetColumn.findFirst({ where: { columnKey: "event_date" } });
if (!column) {
  console.log('No "Event Date" column found (columnKey "event_date"). Nothing to do.');
  process.exit(0);
}

// Only touch cells that are already a clean "DD/MM/YYYY" string (as left by
// normalizeEventDates.js) — anything else (the handful of unparseable notes
// flagged earlier) is skipped here so it doesn't hard-fail the whole batch,
// and is reported below for manual re-entry via the app's date picker.
const result = await prisma.$executeRawUnsafe(
  `UPDATE sheet_cells
   SET value_date = STR_TO_DATE(value_text, '%d/%m/%Y')
   WHERE column_id = ? AND value_text REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'`,
  column.id,
);

const leftover = await prisma.sheetCell.findMany({
  where: {
    columnId: column.id,
    valueDate: null,
    valueText: { not: null },
    NOT: { valueText: "N/A" },
  },
  select: { id: true, rowId: true, valueText: true },
});

await prisma.sheetColumn.update({ where: { id: column.id }, data: { dataType: "date" } });

console.log(`Copied ${result} value(s) from value_text into value_date.`);
console.log('Column "event_date" data_type is now "date".');
if (leftover.length > 0) {
  console.log(`${leftover.length} cell(s) could not be converted — fix these manually via the date picker in the app:`);
  for (const cell of leftover) console.log(`  cell ${cell.id} (row ${cell.rowId}): ${JSON.stringify(cell.valueText)}`);
}

await prisma.$disconnect();
