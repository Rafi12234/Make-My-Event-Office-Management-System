// One-off: creates money_receipts for the Money Receipt Generator module
// (see database/add_money_receipt_generator_migration.sql).
// Run once with: node scripts/addMoneyReceiptGeneratorMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function hasTable(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table,
  );
  return Number(rows[0].count) > 0;
}

if (!(await hasTable("money_receipts"))) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE money_receipts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      receipt_no VARCHAR(100) NULL,
      receipt_date DATE NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      client_phone VARCHAR(50) NOT NULL,
      client_email VARCHAR(255) NULL,
      client_address VARCHAR(500) NULL,
      event_name VARCHAR(255) NULL,
      event_date DATE NULL,
      event_venue VARCHAR(255) NULL,
      booking_reference VARCHAR(100) NULL,
      total_payment DECIMAL(14, 2) NOT NULL,
      advance_payment DECIMAL(14, 2) NOT NULL,
      due_payment DECIMAL(14, 2) NOT NULL,
      payment_method ENUM('cash', 'bank_transfer', 'cheque', 'bkash', 'nagad', 'card', 'other') NOT NULL DEFAULT 'cash',
      payment_method_other VARCHAR(100) NULL,
      transaction_reference VARCHAR(150) NULL,
      payment_status ENUM('unpaid', 'partially_paid', 'paid') NOT NULL,
      remarks TEXT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      status ENUM('generated', 'archived') NOT NULL DEFAULT 'generated',
      generated_file_name VARCHAR(255) NULL,
      generated_file_path VARCHAR(600) NULL,
      page_count INT NULL,
      generated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_money_receipts_receipt_no (receipt_no),
      KEY fk_money_receipts_created_by (created_by),
      KEY idx_money_receipts_receipt_date (receipt_date),
      KEY idx_money_receipts_created_at (created_at),
      KEY idx_money_receipts_client_name (client_name),
      KEY idx_money_receipts_client_phone (client_phone),
      CONSTRAINT fk_money_receipts_created_by FOREIGN KEY (created_by)
        REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("money_receipts table created.");
} else {
  console.log("money_receipts already exists — skipped.");
}

console.log("Money Receipt Generator module migration complete.");
process.exit(0);
