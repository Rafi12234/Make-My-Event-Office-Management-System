// One-off: adds the optional "NB:" notes list column to pdf_documents (see
// database/add_pdf_generator_nb_points_migration.sql).
// Run once with: node scripts/addPdfGeneratorNbPointsMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function hasColumn(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  );
  return Number(rows[0].count) > 0;
}

if (!(await hasColumn("pdf_documents", "nb_points"))) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE pdf_documents
      ADD COLUMN nb_points JSON NULL AFTER event_title
  `);
  console.log("pdf_documents: added nb_points column.");
} else {
  console.log("pdf_documents.nb_points already exists — skipped.");
}

console.log("PDF Generator NB points migration complete.");
process.exit(0);
