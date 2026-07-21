USE make_my_event_office_management;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: replace company_name column with venue + shift,
--            rename client_phone label, rename meeting note label,
--            and extend data_type ENUM to include 'venue' and 'shift'.
-- Safe to re-run (uses ON DUPLICATE KEY UPDATE / IF EXISTS guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the data_type ENUM on sheet_columns to include 'venue' and 'shift'
ALTER TABLE sheet_columns
  MODIFY COLUMN data_type ENUM(
    'text','long_text','email','phone','number',
    'decimal','currency','integer',
    'date','time','datetime',
    'boolean','employee','status','priority',
    'venue','shift'
  ) NOT NULL DEFAULT 'text';

-- 2. Deactivate the old 'company_name' column on the default sheet
UPDATE sheet_columns sc
  JOIN management_sheets ms ON ms.id = sc.sheet_id
SET sc.is_active  = FALSE,
    sc.is_visible = FALSE
WHERE ms.is_default = TRUE
  AND sc.column_key  = 'company_name';

-- 3. Upsert all desired columns in the correct display order
--    (INSERT ... ON DUPLICATE KEY UPDATE handles re-runs safely)

-- Ensure the default sheet row exists first (idempotent)
INSERT INTO management_sheets (sheet_name, description, is_default, is_active)
SELECT 'Meeting Management', 'Shared management workspace', TRUE, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM management_sheets WHERE is_default = TRUE AND is_active = TRUE
);

-- Helper: capture the default sheet id once for the upserts below
-- (We use a session variable so the block stays pure SQL without stored procs)
SET @sheet_id = (
  SELECT id FROM management_sheets
  WHERE is_default = TRUE AND is_active = TRUE
  ORDER BY id ASC LIMIT 1
);

INSERT INTO sheet_columns
  (sheet_id, column_key, column_name, data_type, display_order, width_px, is_required, is_visible, is_active)
VALUES
  (@sheet_id, 'client_name',            'Client Name',             'text',     1,  210, TRUE,  TRUE, TRUE),
  (@sheet_id, 'venue',                  'Venue',                   'venue',    2,  220, FALSE, TRUE, TRUE),
  (@sheet_id, 'shift',                  'Shift',                   'shift',    3,  130, FALSE, TRUE, TRUE),
  (@sheet_id, 'client_email',           'Client Email',            'email',    4,  220, FALSE, TRUE, TRUE),
  (@sheet_id, 'client_phone',           'Client Phone Number',     'phone',    5,  190, FALSE, TRUE, TRUE),
  (@sheet_id, 'current_meeting_time',   'Current Meeting Time',    'datetime', 6,  205, FALSE, TRUE, TRUE),
  (@sheet_id, 'meeting_short_note',     'Meeting Call Short Note', 'long_text',7,  300, FALSE, TRUE, TRUE),
  (@sheet_id, 'next_meeting_time',      'Next Meeting Time',       'datetime', 8,  205, FALSE, TRUE, TRUE),
  (@sheet_id, 'next_meeting_discussion','Next Meeting Discussion',  'long_text',9,  300, FALSE, TRUE, TRUE),
  (@sheet_id, 'assigned_employee',      'Assigned Employee',       'employee', 10, 210, FALSE, TRUE, TRUE),
  (@sheet_id, 'status',                 'Status',                  'status',   11, 175, FALSE, TRUE, TRUE),
  (@sheet_id, 'priority',               'Priority',                'priority', 12, 135, FALSE, TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  column_name   = VALUES(column_name),
  data_type     = VALUES(data_type),
  display_order = VALUES(display_order),
  width_px      = VALUES(width_px),
  is_required   = VALUES(is_required),
  is_visible    = VALUES(is_visible),
  is_active     = VALUES(is_active);
