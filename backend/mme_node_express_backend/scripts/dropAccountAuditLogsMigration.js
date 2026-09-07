// One-off: drops account_audit_logs (see
// database/drop_account_audit_logs_migration.sql). The Admin Accounts
// audit-trail feature was removed entirely.
// Run once with: node scripts/dropAccountAuditLogsMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_audit_logs'`,
);

if (Number(existing[0].count) === 0) {
  console.log("account_audit_logs already dropped — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`DROP TABLE account_audit_logs`);

console.log("account_audit_logs table dropped.");
process.exit(0);
