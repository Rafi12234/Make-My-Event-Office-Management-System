USE make_my_event_office_management;

-- Adds a "Next Meeting Date & Time" + employee-assignment workflow to the
-- client meeting page, mirroring the existing client_next_calls feature:
--   client_next_meetings                    -> new table, one row per meeting
--     .next_meeting_datetime                -> when the next meeting should happen
--     .assigned_employee_id                 -> who should hold the next meeting
--   client_meetings.assigned_by_employee_id -> who scheduled this meeting (set
--     only when the meeting was created to fulfill a pending next-meeting
--     assignment)
CREATE TABLE client_next_meetings (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  linked_row_key        CHAR(36) NOT NULL,
  meeting_id            BIGINT UNSIGNED NOT NULL,
  next_meeting_datetime DATETIME NOT NULL,
  assigned_employee_id  BIGINT UNSIGNED NULL,
  created_by            BIGINT UNSIGNED NULL,
  updated_by            BIGINT UNSIGNED NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY meeting_id (meeting_id),
  KEY idx_client_next_meetings_row (linked_row_key),
  KEY client_next_meetings_ibfk_2 (created_by),
  KEY client_next_meetings_ibfk_3 (updated_by),
  KEY client_next_meetings_ibfk_4 (assigned_employee_id),
  CONSTRAINT client_next_meetings_ibfk_1 FOREIGN KEY (meeting_id) REFERENCES client_meetings (id) ON DELETE CASCADE,
  CONSTRAINT client_next_meetings_ibfk_2 FOREIGN KEY (created_by) REFERENCES employees (id),
  CONSTRAINT client_next_meetings_ibfk_3 FOREIGN KEY (updated_by) REFERENCES employees (id),
  CONSTRAINT client_next_meetings_ibfk_4 FOREIGN KEY (assigned_employee_id) REFERENCES employees (id)
);

ALTER TABLE client_meetings
  ADD COLUMN assigned_by_employee_id BIGINT UNSIGNED NULL AFTER updated_by,
  ADD CONSTRAINT fk_client_meetings_assigned_by
    FOREIGN KEY (assigned_by_employee_id) REFERENCES employees (id);
