USE make_my_event_office_management;

-- ============================================================================
-- PRODUCTION CATCH-UP SCRIPT for the Accounts module.
--
-- Diagnosis: production only ever had the BASE Accounts tables created
-- (account_money_received, account_expenses, account_expense_items,
-- account_wallets). Every later incremental migration (vendors,
-- wallet_deduction_amount, admin_accounts_module, settles_item) was never
-- run against production, which is why the hosted Employee/Admin Accounts
-- pages error with "column does not exist" as soon as they touch anything
-- added after that first migration.
--
-- This uses temporary stored procedures to check information_schema before
-- each ALTER, so it is genuinely safe to run regardless of what's already
-- applied ("IF NOT EXISTS" on ADD COLUMN/ADD KEY is NOT standard SQL and
-- was confirmed to fail outright with a syntax error on this project's own
-- MySQL — this is the portable equivalent, tested and confirmed to work.
--
-- How to run in phpMyAdmin: SQL tab -> paste this whole file -> Go.
-- (phpMyAdmin auto-detects the "DELIMITER $$" blocks below — no manual
-- delimiter change needed.)
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS mme_add_column_if_missing$$
CREATE PROCEDURE mme_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_column_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @mme_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_column_ddl);
    PREPARE mme_stmt FROM @mme_sql;
    EXECUTE mme_stmt;
    DEALLOCATE PREPARE mme_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS mme_add_key_if_missing$$
CREATE PROCEDURE mme_add_key_if_missing(
  IN p_table VARCHAR(64),
  IN p_key_name VARCHAR(64),
  IN p_key_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_key_name
  ) THEN
    SET @mme_sql = CONCAT('ALTER TABLE `', p_table, '` ADD KEY `', p_key_name, '` ', p_key_ddl);
    PREPARE mme_stmt FROM @mme_sql;
    EXECUTE mme_stmt;
    DEALLOCATE PREPARE mme_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS mme_add_fk_if_missing$$
CREATE PROCEDURE mme_add_fk_if_missing(
  IN p_table VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_fk_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND CONSTRAINT_NAME = p_constraint_name
  ) THEN
    SET @mme_sql = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint_name, '` ', p_fk_ddl);
    PREPARE mme_stmt FROM @mme_sql;
    EXECUTE mme_stmt;
    DEALLOCATE PREPARE mme_stmt;
  END IF;
END$$

DELIMITER ;

-- ─── 1. Vendors (add_vendors_migration.sql) ────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(190) NOT NULL,
  category VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendor_balances (
  vendor_id BIGINT UNSIGNED NOT NULL,
  current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL mme_add_column_if_missing('account_expense_items', 'vendor_id', '`vendor_id` BIGINT UNSIGNED NULL AFTER `receipt_file_size_bytes`');
CALL mme_add_column_if_missing('account_expense_items', 'payment_status', "`payment_status` ENUM('to_pay', 'paid') NULL AFTER `vendor_id`");
CALL mme_add_key_if_missing('account_expense_items', 'fk_account_expense_items_vendor', '(vendor_id)');

INSERT INTO vendors (name, category)
SELECT * FROM (
  SELECT 'ABC Transport' AS name, 'Transportation' AS category
  UNION ALL SELECT 'ABC Flowers', 'Flowers'
  UNION ALL SELECT 'ABC Carpenter', 'Carpenter'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendors.name = seed.name);

INSERT IGNORE INTO vendor_balances (vendor_id, current_balance)
SELECT id, 0 FROM vendors
WHERE name IN ('ABC Transport', 'ABC Flowers', 'ABC Carpenter');

-- ─── 2. Wallet deduction tracking (add_wallet_deduction_amount_migration.sql) ─
CALL mme_add_column_if_missing('account_expenses', 'wallet_deduction_amount', "`wallet_deduction_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `total_amount`");

UPDATE account_expenses ae
SET wallet_deduction_amount = (
  SELECT COALESCE(SUM(aei.total_amount), 0)
  FROM account_expense_items aei
  WHERE aei.expense_id = ae.id
    AND NOT (aei.vendor_id IS NOT NULL AND aei.payment_status = 'to_pay')
)
WHERE wallet_deduction_amount = 0;

-- ─── 3. Admin Accounts module (add_admin_accounts_module_migration.sql) ────
CALL mme_add_column_if_missing('account_money_received', 'source', "`source` ENUM('employee', 'admin') NOT NULL DEFAULT 'employee' AFTER `note`");
CALL mme_add_column_if_missing('account_money_received', 'created_by_admin_id', '`created_by_admin_id` BIGINT UNSIGNED NULL AFTER `source`');
CALL mme_add_column_if_missing('account_money_received', 'status', "`status` ENUM('active', 'void') NOT NULL DEFAULT 'active' AFTER `created_by_admin_id`");
CALL mme_add_column_if_missing('account_money_received', 'void_reason', '`void_reason` VARCHAR(255) NULL AFTER `status`');
CALL mme_add_column_if_missing('account_money_received', 'voided_by_admin_id', '`voided_by_admin_id` BIGINT UNSIGNED NULL AFTER `void_reason`');
CALL mme_add_column_if_missing('account_money_received', 'voided_at', '`voided_at` DATETIME NULL AFTER `voided_by_admin_id`');
CALL mme_add_column_if_missing('account_money_received', 'updated_at', '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL mme_add_key_if_missing('account_money_received', 'fk_account_money_received_created_admin', '(created_by_admin_id)');
CALL mme_add_key_if_missing('account_money_received', 'fk_account_money_received_voided_admin', '(voided_by_admin_id)');
CALL mme_add_key_if_missing('account_money_received', 'idx_account_money_received_date', '(received_date)');

CALL mme_add_column_if_missing('account_expenses', 'payment_source', "`payment_source` ENUM('employee_wallet', 'company') NOT NULL DEFAULT 'employee_wallet' AFTER `wallet_deduction_amount`");
CALL mme_add_column_if_missing('account_expenses', 'created_by_admin_id', '`created_by_admin_id` BIGINT UNSIGNED NULL AFTER `payment_source`');
CALL mme_add_column_if_missing('account_expenses', 'status', "`status` ENUM('active', 'void') NOT NULL DEFAULT 'active' AFTER `created_by_admin_id`");
CALL mme_add_column_if_missing('account_expenses', 'void_reason', '`void_reason` VARCHAR(255) NULL AFTER `status`');
CALL mme_add_column_if_missing('account_expenses', 'voided_by_admin_id', '`voided_by_admin_id` BIGINT UNSIGNED NULL AFTER `void_reason`');
CALL mme_add_column_if_missing('account_expenses', 'voided_at', '`voided_at` DATETIME NULL AFTER `voided_by_admin_id`');
CALL mme_add_column_if_missing('account_expenses', 'updated_at', '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL mme_add_key_if_missing('account_expenses', 'fk_account_expenses_created_admin', '(created_by_admin_id)');
CALL mme_add_key_if_missing('account_expenses', 'fk_account_expenses_voided_admin', '(voided_by_admin_id)');
CALL mme_add_key_if_missing('account_expenses', 'idx_account_expenses_created', '(created_at)');

CALL mme_add_column_if_missing('account_expense_items', 'updated_at', '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL mme_add_column_if_missing('vendors', 'contact_name', '`contact_name` VARCHAR(190) NULL AFTER `category`');
CALL mme_add_column_if_missing('vendors', 'contact_phone', '`contact_phone` VARCHAR(50) NULL AFTER `contact_name`');
CALL mme_add_column_if_missing('vendors', 'contact_email', '`contact_email` VARCHAR(190) NULL AFTER `contact_phone`');
CALL mme_add_column_if_missing('vendors', 'notes', '`notes` VARCHAR(500) NULL AFTER `contact_email`');
CALL mme_add_column_if_missing('vendors', 'updated_at', '`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CREATE TABLE IF NOT EXISTS account_audit_logs (
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
  KEY idx_account_audit_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 4. Explicit bill settlement (add_settles_item_migration.sql) ──────────
CALL mme_add_column_if_missing('account_expense_items', 'settles_item_id', '`settles_item_id` BIGINT UNSIGNED NULL AFTER `payment_status`');
CALL mme_add_key_if_missing('account_expense_items', 'fk_account_expense_items_settles', '(settles_item_id)');

-- ─── 5. Foreign keys (guarded the same way — safe to run every time) ──────
CALL mme_add_fk_if_missing('account_expense_items', 'fk_account_expense_items_vendor', 'FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('vendor_balances', 'fk_vendor_balances_vendor', 'FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE');
CALL mme_add_fk_if_missing('account_expense_items', 'fk_account_expense_items_settles', 'FOREIGN KEY (settles_item_id) REFERENCES account_expense_items (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('account_money_received', 'fk_account_money_received_created_admin', 'FOREIGN KEY (created_by_admin_id) REFERENCES employees (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('account_money_received', 'fk_account_money_received_voided_admin', 'FOREIGN KEY (voided_by_admin_id) REFERENCES employees (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('account_expenses', 'fk_account_expenses_created_admin', 'FOREIGN KEY (created_by_admin_id) REFERENCES employees (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('account_expenses', 'fk_account_expenses_voided_admin', 'FOREIGN KEY (voided_by_admin_id) REFERENCES employees (id) ON DELETE SET NULL');
CALL mme_add_fk_if_missing('account_audit_logs', 'fk_account_audit_logs_admin', 'FOREIGN KEY (admin_id) REFERENCES employees (id) ON DELETE SET NULL');

-- ─── 6. Clean up the temporary helper procedures ───────────────────────────
DROP PROCEDURE IF EXISTS mme_add_column_if_missing;
DROP PROCEDURE IF EXISTS mme_add_key_if_missing;
DROP PROCEDURE IF EXISTS mme_add_fk_if_missing;
