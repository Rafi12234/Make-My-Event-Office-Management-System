// One-off: adds money_receipts.billed_to / booking_status (see
// database/add_money_receipt_billed_to_and_status_migration.sql).
// Run once with: node scripts/addMoneyReceiptBilledToAndStatusMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'money_receipts' AND COLUMN_NAME = 'billed_to'`,
);

if (Number(existing[0].count) > 0) {
  console.log("money_receipts.billed_to already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE money_receipts
    ADD COLUMN billed_to VARCHAR(255) NULL AFTER client_address,
    ADD COLUMN booking_status ENUM('confirmed', 'not_confirmed') NOT NULL DEFAULT 'not_confirmed' AFTER booking_reference
`);

console.log("money_receipts.billed_to / booking_status added.");
process.exit(0);
