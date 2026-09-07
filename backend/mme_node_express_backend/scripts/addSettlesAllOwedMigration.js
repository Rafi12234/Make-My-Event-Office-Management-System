// One-off: adds account_expense_items.settles_all_owed (see
// database/add_settles_all_owed_migration.sql).
// Run once with: node scripts/addSettlesAllOwedMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_expense_items' AND COLUMN_NAME = 'settles_all_owed'`,
);

if (Number(existing[0].count) > 0) {
  console.log("settles_all_owed column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE account_expense_items
    ADD COLUMN settles_all_owed TINYINT(1) NOT NULL DEFAULT 0 AFTER settles_item_id
`);

console.log("settles_all_owed column added to account_expense_items.");
process.exit(0);
