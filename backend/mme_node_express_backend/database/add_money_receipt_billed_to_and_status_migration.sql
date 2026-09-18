-- Adds money_receipts.billed_to / booking_status (see
-- scripts/addMoneyReceiptBilledToAndStatusMigration.js).
ALTER TABLE money_receipts
  ADD COLUMN billed_to VARCHAR(255) NULL AFTER client_address,
  ADD COLUMN booking_status ENUM('confirmed', 'not_confirmed') NOT NULL DEFAULT 'not_confirmed' AFTER booking_reference;
