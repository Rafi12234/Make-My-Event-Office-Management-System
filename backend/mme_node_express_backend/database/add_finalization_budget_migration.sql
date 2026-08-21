USE make_my_event_office_management;

-- Adds the "Finalize Budget for this event" field entered by the employee
-- on the Confirm & Finalize popup — one value per client finalization
-- (client_finalizations is already one row per linked_row_key).
ALTER TABLE client_finalizations
  ADD COLUMN finalized_budget DECIMAL(12, 2) NULL AFTER finalized_at;
