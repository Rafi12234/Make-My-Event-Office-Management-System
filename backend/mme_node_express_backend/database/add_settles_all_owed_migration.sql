-- Adds account_expense_items.settles_all_owed (see scripts/addSettlesAllOwedMigration.js).
-- Lets a "paid" vendor item sweep EVERY still-outstanding bill for that
-- vendor (oldest first) in one click, instead of naming one bill via
-- settles_item_id.
ALTER TABLE account_expense_items
  ADD COLUMN settles_all_owed TINYINT(1) NOT NULL DEFAULT 0 AFTER settles_item_id;
