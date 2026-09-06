// One-off: adds account_expenses.approved / approved_by_admin_id /
// approved_at (see database/add_expense_approval_migration.sql).
// Run once with: node scripts/addExpenseApprovalMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_expenses' AND COLUMN_NAME = 'approved'`,
);

if (Number(existing[0].count) > 0) {
  console.log("account_expenses.approved already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE account_expenses
    ADD COLUMN approved TINYINT(1) NOT NULL DEFAULT 0 AFTER voided_at,
    ADD COLUMN approved_by_admin_id BIGINT UNSIGNED NULL AFTER approved,
    ADD COLUMN approved_at DATETIME NULL AFTER approved_by_admin_id,
    ADD CONSTRAINT fk_account_expenses_approved_admin
      FOREIGN KEY (approved_by_admin_id) REFERENCES employees(id)
      ON DELETE SET NULL ON UPDATE NO ACTION
`);

console.log("account_expenses.approved / approved_by_admin_id / approved_at added.");
process.exit(0);
