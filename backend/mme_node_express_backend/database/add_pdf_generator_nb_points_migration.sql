-- PDF Generator: optional "NB:" numbered notes list shown under the summary
-- table on page 1 (user-authored, entirely optional). Run via
-- scripts/addPdfGeneratorNbPointsMigration.js (this file is a reference doc).
ALTER TABLE pdf_documents
  ADD COLUMN nb_points JSON NULL AFTER event_title;
