USE make_my_event_office_management;

-- Removes the "Assigned Employee" column from the Management page.
-- column_key is a generated UUID per row (not a fixed slug), so match by
-- name instead. sheet_cells rows for this column cascade-delete automatically
-- via the sheet_cells -> sheet_columns FK (ON DELETE CASCADE).
-- MySQL Workbench's "safe update mode" blocks UPDATE/DELETE unless the WHERE
-- clause hits a primary/unique key column — column_name isn't one, so it's
-- disabled just for this statement, then restored.
SET SQL_SAFE_UPDATES = 0;
DELETE FROM sheet_columns WHERE column_name = 'Assigned Employee';
SET SQL_SAFE_UPDATES = 1;
