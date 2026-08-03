USE make_my_event_office_management;

-- New table: stores the "Next Meeting Call Date & Time" an employee sets
-- on a call card. One row per call (call_id is unique) — updating it just
-- overwrites the schedule; deleting the call cascades and removes it too.
-- Comparing next_call_datetime against "now" (in application code) is how
-- missed follow-ups are detected: a schedule whose date has passed with no
-- newer call logged for that client.
CREATE TABLE client_next_calls (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  linked_row_key      CHAR(36) NOT NULL,
  call_id             BIGINT UNSIGNED NOT NULL,
  next_call_datetime  DATETIME NOT NULL,
  created_by          BIGINT UNSIGNED NULL,
  updated_by          BIGINT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY call_id (call_id),
  KEY idx_client_next_calls_row (linked_row_key),
  KEY client_next_calls_ibfk_2 (created_by),
  KEY client_next_calls_ibfk_3 (updated_by),
  CONSTRAINT client_next_calls_ibfk_1 FOREIGN KEY (call_id) REFERENCES client_calls (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT client_next_calls_ibfk_2 FOREIGN KEY (created_by) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT client_next_calls_ibfk_3 FOREIGN KEY (updated_by) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
