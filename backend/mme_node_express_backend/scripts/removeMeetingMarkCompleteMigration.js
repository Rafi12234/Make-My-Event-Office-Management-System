// One-off: removes client_meetings.is_completed/completed_by/completed_at
// (see database/remove_meeting_mark_complete_migration.sql).
// Run once with: node scripts/removeMeetingMarkCompleteMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'client_meetings' AND COLUMN_NAME = 'is_completed'`,
);

if (Number(existing[0].count) === 0) {
  console.log("is_completed column already removed — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`ALTER TABLE client_meetings DROP FOREIGN KEY fk_client_meetings_completed_by`);
await prisma.$executeRawUnsafe(`ALTER TABLE client_meetings DROP INDEX fk_client_meetings_completed_by`);
await prisma.$executeRawUnsafe(
  `ALTER TABLE client_meetings DROP COLUMN is_completed, DROP COLUMN completed_by, DROP COLUMN completed_at`,
);

console.log("is_completed/completed_by/completed_at removed from client_meetings.");
process.exit(0);
