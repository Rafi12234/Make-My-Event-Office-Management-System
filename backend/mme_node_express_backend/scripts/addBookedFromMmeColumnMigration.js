// One-off: adds sheet_cells.booked_from_mme (see database/add_booked_from_mme_migration.sql).
// Run once with: node scripts/addBookedFromMmeColumnMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sheet_cells' AND COLUMN_NAME = 'booked_from_mme'`,
);

if (Number(existing[0].count) > 0) {
  console.log("booked_from_mme column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE sheet_cells ADD COLUMN booked_from_mme TINYINT(1) NOT NULL DEFAULT 0 AFTER already_booked`,
);

console.log("booked_from_mme column added to sheet_cells.");
process.exit(0);
