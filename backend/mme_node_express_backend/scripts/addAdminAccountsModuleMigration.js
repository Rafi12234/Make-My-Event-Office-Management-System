// One-off: adds the Admin Accounts panel columns + account_audit_logs table
// (see database/add_admin_accounts_module_migration.sql).
// Run once with: node scripts/addAdminAccountsModuleMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function hasColumn(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  );
  return Number(rows[0].count) > 0;
}

async function hasTable(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table,
  );
  return Number(rows[0].count) > 0;
}

if (!(await hasColumn("account_money_received", "source"))) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE account_money_received
      ADD COLUMN source ENUM('employee', 'admin') NOT NULL DEFAULT 'employee' AFTER note,
      ADD COLUMN created_by_admin_id BIGINT UNSIGNED NULL AFTER source,
      ADD COLUMN status ENUM('active', 'void') NOT NULL DEFAULT 'active' AFTER created_by_admin_id,
      ADD COLUMN void_reason VARCHAR(255) NULL AFTER status,
      ADD COLUMN voided_by_admin_id BIGINT UNSIGNED NULL AFTER void_reason,
      ADD COLUMN voided_at DATETIME NULL AFTER voided_by_admin_id,
      ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ADD KEY fk_account_money_received_created_admin (created_by_admin_id),
      ADD KEY fk_account_money_received_voided_admin (voided_by_admin_id),
      ADD KEY idx_account_money_received_date (received_date),
      ADD CONSTRAINT fk_account_money_received_created_admin FOREIGN KEY (created_by_admin_id)
        REFERENCES employees (id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_account_money_received_voided_admin FOREIGN KEY (voided_by_admin_id)
        REFERENCES employees (id) ON DELETE SET NULL
  `);
  console.log("account_money_received: admin/void/source columns added.");
} else {
  console.log("account_money_received already migrated — skipped.");
}

if (!(await hasColumn("account_expenses", "payment_source"))) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE account_expenses
      ADD COLUMN payment_source ENUM('employee_wallet', 'company') NOT NULL DEFAULT 'employee_wallet' AFTER wallet_deduction_amount,
      ADD COLUMN created_by_admin_id BIGINT UNSIGNED NULL AFTER payment_source,
      ADD COLUMN status ENUM('active', 'void') NOT NULL DEFAULT 'active' AFTER created_by_admin_id,
      ADD COLUMN void_reason VARCHAR(255) NULL AFTER status,
      ADD COLUMN voided_by_admin_id BIGINT UNSIGNED NULL AFTER void_reason,
      ADD COLUMN voided_at DATETIME NULL AFTER voided_by_admin_id,
      ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ADD KEY fk_account_expenses_created_admin (created_by_admin_id),
      ADD KEY fk_account_expenses_voided_admin (voided_by_admin_id),
      ADD KEY idx_account_expenses_created (created_at),
      ADD CONSTRAINT fk_account_expenses_created_admin FOREIGN KEY (created_by_admin_id)
        REFERENCES employees (id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_account_expenses_voided_admin FOREIGN KEY (voided_by_admin_id)
        REFERENCES employees (id) ON DELETE SET NULL
  `);
  console.log("account_expenses: admin/void/payment-source columns added.");
} else {
  console.log("account_expenses already migrated — skipped.");
}

if (!(await hasColumn("account_expense_items", "updated_at"))) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE account_expense_items
      ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `);
  console.log("account_expense_items: updated_at added.");
} else {
  console.log("account_expense_items already migrated — skipped.");
}

if (!(await hasColumn("vendors", "contact_name"))) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE vendors
      ADD COLUMN contact_name VARCHAR(190) NULL AFTER category,
      ADD COLUMN contact_phone VARCHAR(50) NULL AFTER contact_name,
      ADD COLUMN contact_email VARCHAR(190) NULL AFTER contact_phone,
      ADD COLUMN notes VARCHAR(500) NULL AFTER contact_email,
      ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `);
  console.log("vendors: contact + updated_at columns added.");
} else {
  console.log("vendors already migrated — skipped.");
}

if (!(await hasTable("account_audit_logs"))) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE account_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      entity_type ENUM('money_received', 'expense', 'expense_item', 'vendor') NOT NULL,
      entity_id BIGINT UNSIGNED NOT NULL,
      action ENUM('create', 'update', 'void') NOT NULL,
      admin_id BIGINT UNSIGNED NULL,
      employee_id BIGINT UNSIGNED NULL,
      vendor_id BIGINT UNSIGNED NULL,
      reason VARCHAR(500) NOT NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_account_audit_logs_entity (entity_type, entity_id),
      KEY fk_account_audit_logs_admin (admin_id),
      KEY idx_account_audit_logs_employee (employee_id),
      KEY idx_account_audit_logs_vendor (vendor_id),
      KEY idx_account_audit_logs_created (created_at),
      CONSTRAINT fk_account_audit_logs_admin FOREIGN KEY (admin_id)
        REFERENCES employees (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("account_audit_logs table created.");
} else {
  console.log("account_audit_logs already exists — skipped.");
}

console.log("Admin Accounts module migration complete.");
process.exit(0);
