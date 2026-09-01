-- Adds account_expense_items.settles_item_id (see scripts/addSettlesItemMigration.js).
-- Lets a "paid" vendor item explicitly point at the specific "to_pay" bill
-- it settles, instead of implicitly netting against every item that shares
-- the same vendor + event.
ALTER TABLE account_expense_items
  ADD COLUMN settles_item_id BIGINT UNSIGNED NULL AFTER payment_status,
  ADD KEY fk_account_expense_items_settles (settles_item_id),
  ADD CONSTRAINT fk_account_expense_items_settles FOREIGN KEY (settles_item_id)
    REFERENCES account_expense_items (id) ON DELETE SET NULL;
