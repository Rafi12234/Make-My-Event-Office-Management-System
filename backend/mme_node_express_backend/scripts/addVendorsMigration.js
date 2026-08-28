// One-off: creates vendors / vendor_balances, adds vendor_id / payment_status
// to account_expense_items, and seeds 3 starter vendors (see
// database/add_vendors_migration.sql). Admin "Manage Vendors" UI isn't
// built yet, so this seed is what makes the employee-facing vendor
// dropdown usable until then.
// Run once with: node scripts/addVendorsMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendors'`,
);

if (Number(existing[0].count) > 0) {
  console.log("vendors already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  CREATE TABLE vendors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(190) NOT NULL,
    category VARCHAR(100) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  CREATE TABLE vendor_balances (
    vendor_id BIGINT UNSIGNED NOT NULL,
    current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (vendor_id),
    CONSTRAINT fk_vendor_balances_vendor FOREIGN KEY (vendor_id)
      REFERENCES vendors (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  ALTER TABLE account_expense_items
    ADD COLUMN vendor_id BIGINT UNSIGNED NULL AFTER receipt_file_size_bytes,
    ADD COLUMN payment_status ENUM('to_pay', 'paid') NULL AFTER vendor_id,
    ADD KEY fk_account_expense_items_vendor (vendor_id),
    ADD CONSTRAINT fk_account_expense_items_vendor FOREIGN KEY (vendor_id)
      REFERENCES vendors (id) ON DELETE SET NULL
`);

await prisma.$executeRawUnsafe(`
  INSERT INTO vendors (name, category) VALUES
    ('ABC Transport', 'Transportation'),
    ('ABC Flowers', 'Flowers'),
    ('ABC Carpenter', 'Carpenter')
`);

await prisma.$executeRawUnsafe(`
  INSERT INTO vendor_balances (vendor_id, current_balance)
  SELECT id, 0 FROM vendors
  WHERE name IN ('ABC Transport', 'ABC Flowers', 'ABC Carpenter')
`);

console.log(
  "vendors / vendor_balances created, account_expense_items extended, 3 starter vendors seeded.",
);
process.exit(0);
