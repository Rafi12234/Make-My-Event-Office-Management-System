-- Adds account_expenses.approved / approved_by_admin_id / approved_at (see
-- scripts/addExpenseApprovalMigration.js). A bill only counts as a
-- finalized company expense once an admin has reviewed and approved it.
ALTER TABLE account_expenses
  ADD COLUMN approved TINYINT(1) NOT NULL DEFAULT 0 AFTER voided_at,
  ADD COLUMN approved_by_admin_id BIGINT UNSIGNED NULL AFTER approved,
  ADD COLUMN approved_at DATETIME NULL AFTER approved_by_admin_id,
  ADD CONSTRAINT fk_account_expenses_approved_admin
    FOREIGN KEY (approved_by_admin_id) REFERENCES employees(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;
