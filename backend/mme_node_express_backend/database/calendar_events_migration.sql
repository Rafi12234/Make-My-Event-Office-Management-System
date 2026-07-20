USE make_my_event_office_management;

-- Drop and recreate with correct schema (safe for development — no production data yet)
DROP TABLE IF EXISTS calendar_events;

CREATE TABLE calendar_events (
  id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title                VARCHAR(255)     NOT NULL,
  description          TEXT             DEFAULT NULL,
  event_date           DATE             NOT NULL,
  event_time           TIME             DEFAULT NULL,
  event_type           ENUM('meeting','followup','deadline','task','other') NOT NULL DEFAULT 'task',
  client_name          VARCHAR(150)     DEFAULT NULL,
  company_name         VARCHAR(150)     DEFAULT NULL,
  linked_row_key       CHAR(36)         DEFAULT NULL,
  assigned_employee_id BIGINT UNSIGNED  DEFAULT NULL,
  priority             ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
  status               ENUM('Pending','Completed','Cancelled') DEFAULT 'Pending',
  created_by           BIGINT UNSIGNED  DEFAULT NULL,
  updated_by           BIGINT UNSIGNED  DEFAULT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_calendar_event_date  (event_date),
  KEY idx_calendar_linked_row  (linked_row_key),

  CONSTRAINT calendar_events_ibfk_1
    FOREIGN KEY (assigned_employee_id) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT calendar_events_ibfk_2
    FOREIGN KEY (created_by)           REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT calendar_events_ibfk_3
    FOREIGN KEY (updated_by)           REFERENCES employees (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET  = utf8mb4
  COLLATE          = utf8mb4_unicode_ci;
