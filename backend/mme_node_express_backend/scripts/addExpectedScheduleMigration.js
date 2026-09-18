// One-off: adds client_calls.expected_call_datetime + client_meetings.expected_meeting_datetime
// (see database/add_expected_schedule_migration.sql). Run once with:
// node scripts/addExpectedScheduleMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`,
  );
  return Number(rows[0].count) > 0;
}

if (await columnExists("client_calls", "expected_call_datetime")) {
  console.log("client_calls.expected_call_datetime already exists — skipping.");
} else {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE client_calls ADD COLUMN expected_call_datetime DATETIME NULL AFTER call_datetime`,
  );
  console.log("Added client_calls.expected_call_datetime.");
}

if (await columnExists("client_meetings", "expected_meeting_datetime")) {
  console.log("client_meetings.expected_meeting_datetime already exists — skipping.");
} else {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE client_meetings ADD COLUMN expected_meeting_datetime DATETIME NULL AFTER meeting_datetime`,
  );
  console.log("Added client_meetings.expected_meeting_datetime.");
}

process.exit(0);
