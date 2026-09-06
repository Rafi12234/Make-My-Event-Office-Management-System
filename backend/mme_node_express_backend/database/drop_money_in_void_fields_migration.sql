-- Drops account_money_received's status/void columns (see
-- scripts/dropMoneyInVoidFieldsMigration.js). Money In entries can no
-- longer be voided — only corrected (edited) — so these are dead weight.
ALTER TABLE account_money_received
  DROP FOREIGN KEY fk_account_money_received_voided_admin,
  DROP COLUMN status,
  DROP COLUMN void_reason,
  DROP COLUMN voided_by_admin_id,
  DROP COLUMN voided_at;
