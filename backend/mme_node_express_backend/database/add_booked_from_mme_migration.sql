USE make_my_event_office_management;

-- Adds a per-row "booked from MME" flag — set to 1 automatically when an
-- employee confirms & finalizes a client's event (see finalizeMeeting in
-- meetingsController.js), cleared back to 0 if that finalization is later
-- invalidated (e.g. a meeting it was based on gets deleted). Stored on the
-- row's Event Date cell, same convention as the existing already_booked flag.
ALTER TABLE sheet_cells
  ADD COLUMN booked_from_mme TINYINT(1) NOT NULL DEFAULT 0 AFTER already_booked;
