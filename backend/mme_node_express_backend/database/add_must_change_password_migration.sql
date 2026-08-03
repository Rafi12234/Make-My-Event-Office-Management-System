USE make_my_event_office_management;

-- Forces employees to change the admin-provided password on first login.
-- 1 = must change password (default for every new/existing employee row),
-- 0 = employee has already changed their own password.
ALTER TABLE employees
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash;
