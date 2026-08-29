USE make_my_event_office_management;

-- Admin Accounts panel foundation. Adds the columns that make existing
-- financial records correctable/voidable by an Admin (instead of being a
-- strictly append-only employee log), plus the append-only audit trail.
-- Financial rows are never hard-deleted — status = 'void' reverses the
-- wallet/vendor effect while the original row stays visible.

-- ─── account_money_received ────────────────────────────────────────────
-- source tells us whether the employee logged it or an Admin added it on
-- their behalf; created_by_admin_id records which Admin.
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
    REFERENCES employees (id) ON DELETE SET NULL;

-- ─── account_expenses ──────────────────────────────────────────────────
-- payment_source = 'company' marks an Admin direct vendor cost/payment:
-- employee_id stays NULL and no employee wallet is touched.
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
    REFERENCES employees (id) ON DELETE SET NULL;

-- ─── account_expense_items ─────────────────────────────────────────────
-- created_at can no longer represent the latest change once Admins edit.
ALTER TABLE account_expense_items
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ─── vendors ───────────────────────────────────────────────────────────
ALTER TABLE vendors
  ADD COLUMN contact_name VARCHAR(190) NULL AFTER category,
  ADD COLUMN contact_phone VARCHAR(50) NULL AFTER contact_name,
  ADD COLUMN contact_email VARCHAR(190) NULL AFTER contact_phone,
  ADD COLUMN notes VARCHAR(500) NULL AFTER contact_email,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ─── account_audit_logs ────────────────────────────────────────────────
-- before_data / after_data keep the full serialized record so original
-- values survive any number of later corrections.
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
  KEY idx_account_audit_logs_created (created_at),
  CONSTRAINT fk_account_audit_logs_admin FOREIGN KEY (admin_id)
    REFERENCES employees (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
