// One-off: creates account_money_received / account_expenses /
// account_expense_items / account_wallets (see
// database/add_accounts_module_migration.sql).
// Run once with: node scripts/addAccountsModuleMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_money_received'`,
);

if (Number(existing[0].count) > 0) {
  console.log("account_money_received already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  CREATE TABLE account_money_received (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12, 2) NOT NULL,
    received_date DATE NOT NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_account_money_received_employee (employee_id),
    CONSTRAINT fk_account_money_received_employee FOREIGN KEY (employee_id)
      REFERENCES employees (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  CREATE TABLE account_expenses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id BIGINT UNSIGNED NULL,
    cost_type ENUM('event', 'regular') NOT NULL,
    linked_row_key CHAR(36) NULL,
    event_client_name_snapshot VARCHAR(190) NULL,
    event_date_snapshot DATE NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_account_expenses_employee (employee_id),
    KEY idx_account_expenses_row (linked_row_key),
    CONSTRAINT fk_account_expenses_employee FOREIGN KEY (employee_id)
      REFERENCES employees (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  CREATE TABLE account_expense_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    expense_id BIGINT UNSIGNED NOT NULL,
    purpose VARCHAR(190) NOT NULL,
    cost_date DATE NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    per_qty_amount DECIMAL(12, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    receipt_stored_file_name VARCHAR(255) NULL,
    receipt_original_file_name VARCHAR(255) NULL,
    receipt_file_url VARCHAR(500) NULL,
    receipt_file_size_bytes INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_account_expense_items_expense (expense_id),
    CONSTRAINT fk_account_expense_items_expense FOREIGN KEY (expense_id)
      REFERENCES account_expenses (id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  CREATE TABLE account_wallets (
    employee_id BIGINT UNSIGNED NOT NULL,
    current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id),
    CONSTRAINT fk_account_wallets_employee FOREIGN KEY (employee_id)
      REFERENCES employees (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

console.log(
  "account_money_received / account_expenses / account_expense_items / account_wallets created.",
);
process.exit(0);
