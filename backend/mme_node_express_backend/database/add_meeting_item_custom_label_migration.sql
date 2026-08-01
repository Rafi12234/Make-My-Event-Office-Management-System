USE make_my_event_office_management;

-- Adds support for custom-named "Other" meeting items:
--   1. A new `custom_label` column stores the free-text name the employee
--      types in when they pick "Other" from the item dropdown.
--   2. The old UNIQUE(meeting_id, item_key) constraint is dropped so a
--      meeting can have more than one "Other" item (each with its own
--      custom_label). Uniqueness for the fixed (non-"other") dropdown
--      items is still enforced in the application layer.
--
-- Purely additive — no existing data is dropped or modified.

ALTER TABLE meeting_items
  ADD COLUMN custom_label VARCHAR(160) NULL AFTER item_key;

-- Add the replacement index first — the old unique index backs the
-- meeting_id foreign key, so MySQL refuses to drop it until another
-- index can take over that role.
ALTER TABLE meeting_items
  ADD KEY idx_meeting_items_meeting (meeting_id);

ALTER TABLE meeting_items
  DROP INDEX uq_meeting_items_meeting_key;
