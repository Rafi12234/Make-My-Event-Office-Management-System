// One-off: supports multiple reference photos per PDF Generator item (see
// database/add_pdf_generator_multi_image_migration.sql).
// Run once with: node scripts/addPdfGeneratorMultiImageMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function hasTable(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table,
  );
  return Number(rows[0].count) > 0;
}

async function hasColumn(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  );
  return Number(rows[0].count) > 0;
}

if (!(await hasTable("pdf_document_item_images"))) {
  await prisma.$executeRawUnsafe(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("pdf_document_item_images table created.");
} else {
  console.log("pdf_document_item_images already exists — skipped.");
}

if (await hasColumn("pdf_document_items", "reference_image_path")) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE pdf_document_items
      DROP COLUMN reference_image_path,
      DROP COLUMN reference_image_original_name,
      DROP COLUMN reference_image_mime_type
  `);
  console.log("pdf_document_items: dropped single-image columns.");
} else {
  console.log("pdf_document_items already migrated — skipped.");
}

console.log("PDF Generator multi-image migration complete.");
process.exit(0);
