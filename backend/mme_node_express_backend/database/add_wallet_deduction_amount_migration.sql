USE make_my_event_office_management;

-- account_expenses.total_amount is the total RECORDED COST for a
-- submission (including any unpaid "to_pay" vendor items) — it was being
-- misread as "money actually spent". This adds a separate persisted
-- column for the real wallet deduction so future reporting doesn't have
-- to re-derive it from items. Backfilled using the same "non-vendor OR
-- vendor+paid" rule the app already uses to compute wallet deductions.
ALTER TABLE account_expenses
  ADD COLUMN wallet_deduction_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER total_amount;

UPDATE account_expenses ae
SET wallet_deduction_amount = (
  SELECT COALESCE(SUM(aei.total_amount), 0)
  FROM account_expense_items aei
  WHERE aei.expense_id = ae.id
    AND NOT (aei.vendor_id IS NOT NULL AND aei.payment_status = 'to_pay')
);
