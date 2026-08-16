-- Converts the "Event Date" column from a text column to a real DATE column
-- on production. Run this AFTER event_date_updates_prod.sql (the text
-- normalization to "DD/MM/YYYY") has already been applied.
--
-- TAKE A DATABASE BACKUP BEFORE RUNNING THIS.
--
-- Step 1: copy every cleanly-formatted "DD/MM/YYYY" value into the real
-- value_date column. Cells that aren't in that exact shape are left alone
-- (value_date stays NULL) instead of failing the whole statement, so any
-- leftover malformed cells can be found and fixed by hand afterwards (see
-- Step 3 below).
UPDATE sheet_cells c
JOIN sheet_columns col ON col.id = c.column_id
SET c.value_date = STR_TO_DATE(c.value_text, '%d/%m/%Y')
WHERE col.column_key = 'event_date'
  AND c.value_text REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$';

-- Step 2: flip the column's declared type to "date" so the app starts
-- reading/writing it as a real date from now on.
UPDATE sheet_columns
SET data_type = 'date'
WHERE column_key = 'event_date';

-- Step 3: run this SELECT afterwards to find any cells that still need a
-- manual fix (open the row in the app and pick the date via the date
-- picker once the column shows as a real date field):
-- SELECT c.id, c.row_id, c.value_text
-- FROM sheet_cells c
-- JOIN sheet_columns col ON col.id = c.column_id
-- WHERE col.column_key = 'event_date'
--   AND c.value_date IS NULL
--   AND c.value_text IS NOT NULL
--   AND c.value_text <> 'N/A';
