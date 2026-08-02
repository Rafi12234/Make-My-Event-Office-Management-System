USE make_my_event_office_management;

-- Adds the new "Meeting Items" feature: each client meeting can now have
-- structured item rows (item name from a fixed dropdown, description,
-- quantity, and its own uploaded images) instead of the old free-text
-- "Client Requirements" details + loosely-tagged image gallery.
--
-- This migration is purely additive — it does not drop or modify any
-- existing data. Existing `client_meeting_images` rows are left as-is
-- (item_id NULL) and will simply no longer be shown under an item row
-- in the new UI; they remain in the database untouched.

CREATE TABLE meeting_items (
  id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  meeting_id   BIGINT UNSIGNED  NOT NULL,
  item_key     VARCHAR(80)      NOT NULL,
  description  TEXT             DEFAULT NULL,
  quantity     INT UNSIGNED     DEFAULT 1,
  created_by   BIGINT UNSIGNED  DEFAULT NULL,
  updated_by   BIGINT UNSIGNED  DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_items_meeting_key (meeting_id, item_key),
  KEY meeting_items_ibfk_2 (created_by),
  KEY meeting_items_ibfk_3 (updated_by),

  CONSTRAINT meeting_items_ibfk_1
    FOREIGN KEY (meeting_id) REFERENCES client_meetings (id) ON DELETE CASCADE,
  CONSTRAINT meeting_items_ibfk_2
    FOREIGN KEY (created_by) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT meeting_items_ibfk_3
    FOREIGN KEY (updated_by) REFERENCES employees (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET  = utf8mb4
  COLLATE          = utf8mb4_unicode_ci;

-- Link images to the specific item row they belong to (nullable so
-- existing, pre-migration images remain valid rows).
ALTER TABLE client_meeting_images
    ADD COLUMN item_id BIGINT UNSIGNED NULL AFTER meeting_id,
    ADD KEY client_meeting_images_ibfk_3 (item_id),
    ADD CONSTRAINT client_meeting_images_ibfk_3
      FOREIGN KEY (item_id) REFERENCES meeting_items (id) ON DELETE CASCADE;
