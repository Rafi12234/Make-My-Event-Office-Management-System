USE make_my_event_office_management;

-- Marks a client (via their row's "Event Date" cell) as already booked with
-- another event management company. Toggled by the badge button beside the
-- Event Date cell; 1 = already booked (row renders with a highlight color),
-- 0 = default/not booked.
ALTER TABLE sheet_cells
  ADD COLUMN already_booked TINYINT(1) NOT NULL DEFAULT 0 AFTER display_value;
