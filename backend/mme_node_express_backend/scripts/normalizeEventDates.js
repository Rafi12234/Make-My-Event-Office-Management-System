// One-off data-fix: the "Event Date" column (columnKey "event_date", see
// DEFAULT_COLUMNS in the frontend's defaultSheet.js) is a free-text column,
// so employees have typed it in many different formats over time. This
// rewrites every stored value to a single consistent "DD/MM/YYYY" format
// (see normalizeEventDateText for the parsing rules). Run once with:
//   node scripts/normalizeEventDates.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { normalizeEventDateText } from "../src/utils/normalizeEventDate.js";

async function main() {
  const columns = await prisma.sheetColumn.findMany({
    where: { columnKey: "event_date" },
    select: { id: true, sheetId: true },
  });

  if (!columns.length) {
    console.log('No "Event Date" column found (columnKey "event_date"). Nothing to do.');
    return;
  }

  const cells = await prisma.sheetCell.findMany({
    where: { columnId: { in: columns.map((c) => c.id) } },
    select: { id: true, rowId: true, valueText: true, displayValue: true },
  });

  let updated = 0;
  let skipped = 0;
  const unparseable = [];

  for (const cell of cells) {
    const raw = cell.valueText ?? cell.displayValue ?? "";
    if (!raw.trim() || /^n\/?a$/i.test(raw.trim())) {
      skipped += 1;
      continue;
    }

    const normalized = normalizeEventDateText(raw);
    if (!normalized) {
      unparseable.push({ cellId: String(cell.id), rowId: String(cell.rowId), raw });
      continue;
    }
    if (normalized === raw) {
      skipped += 1;
      continue;
    }

    await prisma.sheetCell.update({
      where: { id: cell.id },
      data: { valueText: normalized, displayValue: normalized },
    });
    updated += 1;
  }

  console.log(`Normalized ${updated} Event Date cell(s). Skipped ${skipped} (already correct/blank/N-A).`);
  if (unparseable.length) {
    console.log(`Could not parse ${unparseable.length} value(s) — left unchanged, review manually:`);
    for (const item of unparseable) {
      console.log(`  row ${item.rowId} (cell ${item.cellId}): "${item.raw}"`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
