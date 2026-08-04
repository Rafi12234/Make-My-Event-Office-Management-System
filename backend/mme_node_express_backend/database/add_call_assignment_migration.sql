USE make_my_event_office_management;

-- Adds employee-assignment tracking for the client call/next-call workflow:
--   client_next_calls.assigned_employee_id -> who should make the next call
--   client_calls.assigned_by_employee_id   -> who scheduled this call (set only
--     when the call was created to fulfill a pending next-call assignment)
ALTER TABLE client_next_calls
  ADD COLUMN assigned_employee_id BIGINT UNSIGNED NULL AFTER next_call_datetime,
  ADD CONSTRAINT client_next_calls_ibfk_4
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id);

ALTER TABLE client_calls
  ADD COLUMN assigned_by_employee_id BIGINT UNSIGNED NULL AFTER updated_by,
  ADD CONSTRAINT client_calls_ibfk_3
    FOREIGN KEY (assigned_by_employee_id) REFERENCES employees (id);
