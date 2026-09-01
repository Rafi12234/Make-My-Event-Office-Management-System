USE make_my_event_office_management;

-- Employee GPS-based Sign In / Sign Out attendance (mobile app, V1 — see
-- mobile/Attendance/BUILD_GUIDE.md). Additive migration — safe to run
-- against an existing production database, does not touch any other table.
CREATE TABLE IF NOT EXISTS attendances (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  employee_id         BIGINT UNSIGNED  NOT NULL,
  attendance_date     DATE             NOT NULL,
  sign_in_at          DATETIME         NOT NULL,
  sign_in_latitude    DECIMAL(10,7)    NOT NULL,
  sign_in_longitude   DECIMAL(10,7)    NOT NULL,
  sign_in_accuracy    DECIMAL(8,2)     DEFAULT NULL,
  sign_out_at         DATETIME         DEFAULT NULL,
  sign_out_latitude   DECIMAL(10,7)    DEFAULT NULL,
  sign_out_longitude  DECIMAL(10,7)    DEFAULT NULL,
  sign_out_accuracy   DECIMAL(8,2)     DEFAULT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_employee_date (employee_id, attendance_date),
  KEY fk_attendance_employee (employee_id),

  CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET  = utf8mb4
  COLLATE          = utf8mb4_unicode_ci;
