// One-off: adds sheet_cells.already_booked (see database/add_already_booked_migration.sql).
// Run once with: node scripts/addAlreadyBookedColumnMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sheet_cells' AND COLUMN_NAME = 'already_booked'`,
);

if (Number(existing[0].count) > 0) {
  console.log("already_booked column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE sheet_cells ADD COLUMN already_booked TINYINT(1) NOT NULL DEFAULT 0 AFTER display_value`,
);

console.log("already_booked column added to sheet_cells.");
process.exit(0);
