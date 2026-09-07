// One-off: drops account_money_received's status/void columns (see
// database/drop_money_in_void_fields_migration.sql). Money In entries can
// no longer be voided — only corrected (edited).
// Run once with: node scripts/dropMoneyInVoidFieldsMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_money_received' AND COLUMN_NAME = 'status'`,
);

if (Number(existing[0].count) === 0) {
  console.log("account_money_received.status already gone — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE account_money_received
    DROP FOREIGN KEY fk_account_money_received_voided_admin,
    DROP COLUMN status,
    DROP COLUMN void_reason,
    DROP COLUMN voided_by_admin_id,
    DROP COLUMN voided_at
`);

console.log("account_money_received's status/void columns dropped.");
process.exit(0);
