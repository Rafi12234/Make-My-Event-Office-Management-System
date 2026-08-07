USE make_my_event_office_management;

-- Adds a fixed display color per employee, used by the admin panel's
-- company-wide calendar (feature 3) to color-code each employee's meetings
-- and calls and to render the color legend above the calendar.
ALTER TABLE employees
  ADD COLUMN color_hex VARCHAR(7) NULL AFTER is_active;
