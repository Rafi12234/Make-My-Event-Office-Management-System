// One-off: adds office-geofence distance/inside-office columns to
// attendances (see database/add_attendance_office_distance_migration.sql).
// Run once with: node scripts/addAttendanceOfficeDistanceMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'attendances'
     AND column_name = 'sign_in_distance_from_office'`,
);

if (Number(existing[0].count) > 0) {
  console.log("sign_in_distance_from_office already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE attendances
    ADD COLUMN sign_in_distance_from_office  DECIMAL(8,2) NULL AFTER sign_in_accuracy,
    ADD COLUMN sign_in_inside_office         BOOLEAN      NULL AFTER sign_in_distance_from_office,
    ADD COLUMN sign_out_distance_from_office DECIMAL(8,2) NULL AFTER sign_out_accuracy,
    ADD COLUMN sign_out_inside_office        BOOLEAN      NULL AFTER sign_out_distance_from_office
`);

console.log("Office-distance columns added to attendances.");
process.exit(0);
