// One-off: adds client_finalizations.finalized_budget (see database/add_finalization_budget_migration.sql).
// Run once with: node scripts/addFinalizationBudgetMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'client_finalizations' AND COLUMN_NAME = 'finalized_budget'`,
);

if (Number(existing[0].count) > 0) {
  console.log("finalized_budget column already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE client_finalizations ADD COLUMN finalized_budget DECIMAL(12, 2) NULL AFTER finalized_at`,
);

console.log("finalized_budget column added to client_finalizations.");
process.exit(0);
