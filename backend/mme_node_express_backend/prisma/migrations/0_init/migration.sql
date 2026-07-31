-- CreateTable
CREATE TABLE `employees` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `role_id` TINYINT UNSIGNED NULL,
    `password_hash` VARCHAR(255) NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `last_used_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `employees_email_key`(`email`),
    INDEX `fk_emp_created_by`(`created_by`),
    INDEX `fk_emp_role`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` ENUM('Admin', 'Employee') NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_role_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `employee_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(100) NULL,
    `entity_type` VARCHAR(100) NULL,
    `entity_id` BIGINT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `employee_id`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `management_sheets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sheet_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `is_default` BOOLEAN NULL DEFAULT false,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sheet_name`(`sheet_name`),
    INDEX `created_by`(`created_by`),
    INDEX `updated_by`(`updated_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sheet_columns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sheet_id` BIGINT UNSIGNED NOT NULL,
    `column_key` CHAR(36) NOT NULL,
    `column_name` VARCHAR(150) NOT NULL,
    `data_type` ENUM('text', 'long_text', 'email', 'phone', 'number', 'decimal', 'currency', 'integer', 'date', 'time', 'datetime', 'boolean', 'employee', 'status', 'priority', 'venue', 'shift', 'meeting_manager', 'last_meeting_time', 'next_meeting_time') NOT NULL DEFAULT 'text',
    `calendar_role` ENUM('none', 'event_title', 'start_datetime', 'end_datetime', 'description', 'assignee', 'status', 'priority') NULL DEFAULT 'none',
    `dropdown_options` JSON NULL,
    `display_order` INTEGER NULL DEFAULT 0,
    `width_px` INTEGER NULL DEFAULT 180,
    `is_required` BOOLEAN NULL DEFAULT false,
    `is_visible` BOOLEAN NULL DEFAULT true,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `created_by`(`created_by`),
    INDEX `updated_by`(`updated_by`),
    UNIQUE INDEX `sheet_id`(`sheet_id`, `column_key`),
    UNIQUE INDEX `sheet_id_2`(`sheet_id`, `column_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sheet_rows` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `row_key` CHAR(36) NOT NULL,
    `sheet_id` BIGINT UNSIGNED NOT NULL,
    `row_position` INTEGER UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `is_archived` BOOLEAN NULL DEFAULT false,
    `archived_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `created_by`(`created_by`),
    INDEX `updated_by`(`updated_by`),
    UNIQUE INDEX `sheet_id`(`sheet_id`, `row_key`),
    UNIQUE INDEX `sheet_id_2`(`sheet_id`, `row_position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sheet_cells` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `row_id` BIGINT UNSIGNED NOT NULL,
    `column_id` BIGINT UNSIGNED NOT NULL,
    `value_text` LONGTEXT NULL,
    `value_integer` BIGINT NULL,
    `value_decimal` DECIMAL(20, 4) NULL,
    `value_date` DATE NULL,
    `value_time` TIME(0) NULL,
    `value_datetime` DATETIME(0) NULL,
    `value_boolean` BOOLEAN NULL,
    `value_employee_id` BIGINT UNSIGNED NULL,
    `value_json` JSON NULL,
    `display_value` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `column_id`(`column_id`),
    INDEX `created_by`(`created_by`),
    INDEX `updated_by`(`updated_by`),
    INDEX `value_employee_id`(`value_employee_id`),
    UNIQUE INDEX `row_id`(`row_id`, `column_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_meetings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `linked_row_key` CHAR(36) NOT NULL,
    `meeting_datetime` DATETIME(0) NULL,
    `discussion_notes` TEXT NULL,
    `requirements` JSON NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_by` BIGINT UNSIGNED NULL,
    `completed_at` DATETIME(0) NULL,

    INDEX `client_meetings_ibfk_1`(`created_by`),
    INDEX `client_meetings_ibfk_2`(`updated_by`),
    INDEX `fk_client_meetings_completed_by`(`completed_by`),
    INDEX `idx_client_meetings_datetime`(`meeting_datetime`),
    INDEX `idx_client_meetings_row`(`linked_row_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_meeting_images` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `meeting_id` BIGINT UNSIGNED NOT NULL,
    `stored_file_name` VARCHAR(255) NOT NULL,
    `original_file_name` VARCHAR(255) NULL,
    `tag_name` VARCHAR(120) NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_size_bytes` INTEGER UNSIGNED NULL,
    `uploaded_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_final_selected` BOOLEAN NOT NULL DEFAULT false,

    INDEX `client_meeting_images_ibfk_2`(`uploaded_by`),
    INDEX `idx_meeting_images_meeting`(`meeting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_calls` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `linked_row_key` CHAR(36) NOT NULL,
    `call_datetime` DATETIME(0) NULL,
    `call_discussion` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `client_calls_ibfk_1`(`created_by`),
    INDEX `client_calls_ibfk_2`(`updated_by`),
    INDEX `idx_client_calls_row`(`linked_row_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_finalizations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `linked_row_key` CHAR(36) NOT NULL,
    `finalized_by` BIGINT UNSIGNED NULL,
    `finalized_at` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_client_finalizations_row`(`linked_row_key`),
    INDEX `fk_client_finalizations_employee`(`finalized_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `event_date` DATE NOT NULL,
    `event_time` TIME(0) NULL,
    `event_type` ENUM('meeting', 'followup', 'deadline', 'task', 'other') NOT NULL DEFAULT 'task',
    `client_name` VARCHAR(150) NULL,
    `company_name` VARCHAR(150) NULL,
    `linked_row_key` CHAR(36) NULL,
    `assigned_employee_id` BIGINT UNSIGNED NULL,
    `priority` ENUM('Low', 'Medium', 'High', 'Urgent') NULL DEFAULT 'Medium',
    `status` ENUM('Pending', 'Completed', 'Cancelled') NULL DEFAULT 'Pending',
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `calendar_events_ibfk_1`(`assigned_employee_id`),
    INDEX `calendar_events_ibfk_2`(`created_by`),
    INDEX `calendar_events_ibfk_3`(`updated_by`),
    INDEX `idx_calendar_event_date`(`event_date`),
    INDEX `idx_calendar_linked_row`(`linked_row_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `excel_imports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sheet_id` BIGINT UNSIGNED NULL,
    `imported_by` BIGINT UNSIGNED NULL,
    `original_file_name` VARCHAR(255) NOT NULL,
    `stored_file_path` VARCHAR(500) NULL,
    `import_mode` ENUM('create_new_sheet', 'append', 'replace', 'merge') NULL DEFAULT 'append',
    `status` ENUM('pending', 'processing', 'completed', 'partial', 'failed') NULL DEFAULT 'pending',
    `total_columns` INTEGER NULL DEFAULT 0,
    `total_rows` INTEGER NULL DEFAULT 0,
    `imported_rows` INTEGER NULL DEFAULT 0,
    `failed_rows` INTEGER NULL DEFAULT 0,
    `detected_headers` JSON NULL,
    `column_mapping` JSON NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `imported_by`(`imported_by`),
    INDEX `sheet_id`(`sheet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `excel_import_errors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `import_id` BIGINT UNSIGNED NOT NULL,
    `excel_row_number` INTEGER NULL,
    `excel_column_name` VARCHAR(150) NULL,
    `error_code` VARCHAR(100) NULL,
    `error_message` TEXT NOT NULL,
    `row_data` JSON NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `import_id`(`import_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `fk_emp_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `fk_emp_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `management_sheets` ADD CONSTRAINT `management_sheets_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `management_sheets` ADD CONSTRAINT `management_sheets_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_columns` ADD CONSTRAINT `sheet_columns_ibfk_1` FOREIGN KEY (`sheet_id`) REFERENCES `management_sheets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_columns` ADD CONSTRAINT `sheet_columns_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_columns` ADD CONSTRAINT `sheet_columns_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_rows` ADD CONSTRAINT `sheet_rows_ibfk_1` FOREIGN KEY (`sheet_id`) REFERENCES `management_sheets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_rows` ADD CONSTRAINT `sheet_rows_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_rows` ADD CONSTRAINT `sheet_rows_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_cells` ADD CONSTRAINT `sheet_cells_ibfk_1` FOREIGN KEY (`row_id`) REFERENCES `sheet_rows`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_cells` ADD CONSTRAINT `sheet_cells_ibfk_2` FOREIGN KEY (`column_id`) REFERENCES `sheet_columns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_cells` ADD CONSTRAINT `sheet_cells_ibfk_3` FOREIGN KEY (`value_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_cells` ADD CONSTRAINT `sheet_cells_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sheet_cells` ADD CONSTRAINT `sheet_cells_ibfk_5` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_meetings` ADD CONSTRAINT `client_meetings_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_meetings` ADD CONSTRAINT `client_meetings_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_meetings` ADD CONSTRAINT `fk_client_meetings_completed_by` FOREIGN KEY (`completed_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_meeting_images` ADD CONSTRAINT `client_meeting_images_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `client_meetings`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_meeting_images` ADD CONSTRAINT `client_meeting_images_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_calls` ADD CONSTRAINT `client_calls_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_calls` ADD CONSTRAINT `client_calls_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `client_finalizations` ADD CONSTRAINT `fk_client_finalizations_employee` FOREIGN KEY (`finalized_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_ibfk_1` FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `excel_imports` ADD CONSTRAINT `excel_imports_ibfk_1` FOREIGN KEY (`sheet_id`) REFERENCES `management_sheets`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `excel_imports` ADD CONSTRAINT `excel_imports_ibfk_2` FOREIGN KEY (`imported_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `excel_import_errors` ADD CONSTRAINT `excel_import_errors_ibfk_1` FOREIGN KEY (`import_id`) REFERENCES `excel_imports`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

