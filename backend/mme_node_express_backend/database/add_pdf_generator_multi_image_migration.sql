-- Supports multiple reference photos per PDF Generator item (previously one
-- nullable image per pdf_document_items row). See
-- scripts/addPdfGeneratorMultiImageMigration.js.
CREATE TABLE pdf_document_item_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_item_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL,
  image_path VARCHAR(600) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pdf_document_item_image_order (document_item_id, sort_order),
  KEY idx_pdf_document_item_images_item (document_item_id),
  CONSTRAINT fk_pdf_document_item_images_item FOREIGN KEY (document_item_id)
    REFERENCES pdf_document_items (id) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE pdf_document_items
  DROP COLUMN reference_image_path,
  DROP COLUMN reference_image_original_name,
  DROP COLUMN reference_image_mime_type;
