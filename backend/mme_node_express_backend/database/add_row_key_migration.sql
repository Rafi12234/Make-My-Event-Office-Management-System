USE make_my_event_office_management;

-- Required for stable synchronization between React rows and MySQL rows.
ALTER TABLE sheet_rows
    ADD COLUMN row_key CHAR(36) NULL AFTER id;

UPDATE sheet_rows
SET row_key = UUID()
WHERE row_key IS NULL;

ALTER TABLE sheet_rows
    MODIFY COLUMN row_key CHAR(36) NOT NULL,
    ADD UNIQUE KEY uq_sheet_row_key (sheet_id, row_key);
