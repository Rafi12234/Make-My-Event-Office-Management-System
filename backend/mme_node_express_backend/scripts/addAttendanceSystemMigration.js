// One-off: creates the attendances table (see
// database/add_attendance_system_migration.sql).
// Run once with: node scripts/addAttendanceSystemMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendances'`,
);

if (Number(existing[0].count) > 0) {
  console.log("attendances already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  CREATE TABLE attendances (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    sign_in_at DATETIME NOT NULL,
    sign_in_latitude DECIMAL(10,7) NOT NULL,
    sign_in_longitude DECIMAL(10,7) NOT NULL,
    sign_in_accuracy DECIMAL(8,2) NULL,
    sign_out_at DATETIME NULL,
    sign_out_latitude DECIMAL(10,7) NULL,
    sign_out_longitude DECIMAL(10,7) NULL,
    sign_out_accuracy DECIMAL(8,2) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_employee_date (employee_id, attendance_date),
    KEY fk_attendance_employee (employee_id),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id)
      REFERENCES employees (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

console.log("attendances table created.");
process.exit(0);
