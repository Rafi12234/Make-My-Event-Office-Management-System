USE make_my_event_office_management;

-- Vendors (Accounts module extension) — company-wide payee ledger. See
-- Accounts/backend for the controller/routes, prisma/schema.prisma for the
-- matching Prisma models. Admin "Manage Vendors" UI is not built yet, so a
-- handful of real vendors are seeded below to make the employee-facing
-- flow usable in the meantime.

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
  PRIMARY KEY (vendor_id),
  CONSTRAINT fk_vendor_balances_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE account_expense_items
  ADD COLUMN vendor_id BIGINT UNSIGNED NULL AFTER receipt_file_size_bytes,
  ADD COLUMN payment_status ENUM('to_pay', 'paid') NULL AFTER vendor_id,
  ADD KEY fk_account_expense_items_vendor (vendor_id),
  ADD CONSTRAINT fk_account_expense_items_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (id) ON DELETE SET NULL;

INSERT INTO vendors (name, category) VALUES
  ('ABC Transport', 'Transportation'),
  ('ABC Flowers', 'Flowers'),
  ('ABC Carpenter', 'Carpenter');

INSERT INTO vendor_balances (vendor_id, current_balance)
SELECT id, 0 FROM vendors
WHERE name IN ('ABC Transport', 'ABC Flowers', 'ABC Carpenter');
