// One-off: adds account_expense_items.settles_item_id (see
// database/add_settles_item_migration.sql).
// Run once with: node scripts/addSettlesItemMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_expense_items' AND COLUMN_NAME = 'settles_item_id'`,
);

if (Number(existing[0].count) > 0) {
  console.log("settles_item_id column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE account_expense_items
    ADD COLUMN settles_item_id BIGINT UNSIGNED NULL AFTER payment_status,
    ADD KEY fk_account_expense_items_settles (settles_item_id),
    ADD CONSTRAINT fk_account_expense_items_settles FOREIGN KEY (settles_item_id)
      REFERENCES account_expense_items (id) ON DELETE SET NULL
`);

console.log("settles_item_id column added to account_expense_items.");
process.exit(0);
