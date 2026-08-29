// One-off: adds account_expenses.wallet_deduction_amount and backfills it
// from existing item data (see database/add_wallet_deduction_amount_migration.sql).
// Run once with: node scripts/addWalletDeductionAmountMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_expenses' AND COLUMN_NAME = 'wallet_deduction_amount'`,
);

if (Number(existing[0].count) > 0) {
  console.log("wallet_deduction_amount column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE account_expenses ADD COLUMN wallet_deduction_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER total_amount`,
);

await prisma.$executeRawUnsafe(`
  UPDATE account_expenses ae
  SET wallet_deduction_amount = (
    SELECT COALESCE(SUM(aei.total_amount), 0)
    FROM account_expense_items aei
    WHERE aei.expense_id = ae.id
      AND NOT (aei.vendor_id IS NOT NULL AND aei.payment_status = 'to_pay')
  )
`);

console.log("wallet_deduction_amount column added to account_expenses and backfilled.");
process.exit(0);
