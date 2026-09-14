// One-off: creates pdf_documents / pdf_document_items for the PDF Generator
// module (see database/add_pdf_generator_module_migration.sql).
// Run once with: node scripts/addPdfGeneratorModuleMigration.js
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

if (!(await hasTable("pdf_documents"))) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE pdf_documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_no VARCHAR(100) NULL,
      event_date DATE NOT NULL,
      event_title VARCHAR(255) NOT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      status ENUM('draft', 'generated', 'archived') NOT NULL DEFAULT 'generated',
      generated_file_name VARCHAR(255) NULL,
      generated_file_path VARCHAR(600) NULL,
      page_count INT NULL,
      template_version VARCHAR(50) NOT NULL DEFAULT 'palm-view-style-v1',
      generated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pdf_documents_document_no (document_no),
      KEY fk_pdf_documents_created_by (created_by),
      KEY idx_pdf_documents_event_date (event_date),
      KEY idx_pdf_documents_created_at (created_at),
      CONSTRAINT fk_pdf_documents_created_by FOREIGN KEY (created_by)
        REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("pdf_documents table created.");
} else {
  console.log("pdf_documents already exists — skipped.");
}

if (!(await hasTable("pdf_document_items"))) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE pdf_document_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_id BIGINT UNSIGNED NOT NULL,
      sort_order INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      quantity VARCHAR(100) NOT NULL,
      reference_image_path VARCHAR(600) NULL,
      reference_image_original_name VARCHAR(255) NULL,
      reference_image_mime_type VARCHAR(100) NULL,
      custom_caption VARCHAR(1000) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pdf_document_item_order (document_id, sort_order),
      KEY idx_pdf_document_items_document (document_id),
      CONSTRAINT fk_pdf_document_items_document FOREIGN KEY (document_id)
        REFERENCES pdf_documents (id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("pdf_document_items table created.");
} else {
  console.log("pdf_document_items already exists — skipped.");
}

console.log("PDF Generator module migration complete.");
process.exit(0);
