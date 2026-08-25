USE make_my_event_office_management;

-- Structured per-item finalization data (Confirm & Finalize popup), one row
-- per distinct item aggregated across every meeting it appeared in, plus
-- the images the employee actually finalized for it.
CREATE TABLE IF NOT EXISTS client_finalization_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  finalization_id BIGINT UNSIGNED NOT NULL,
  item_key VARCHAR(80) NOT NULL,
  custom_label VARCHAR(160) NULL,
  description TEXT NULL,
  quantity INT UNSIGNED NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_finalization_items_finalization (finalization_id),
  CONSTRAINT fk_finalization_items_finalization FOREIGN KEY (finalization_id)
    REFERENCES client_finalizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_finalization_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  finalization_item_id BIGINT UNSIGNED NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_finalization_images_item (finalization_item_id),
  CONSTRAINT fk_finalization_images_item FOREIGN KEY (finalization_item_id)
    REFERENCES client_finalization_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
