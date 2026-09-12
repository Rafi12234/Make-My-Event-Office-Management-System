// Page + layout constants for the PDF Generator module. Values marked
// "calibrated" were measured directly from the real Word letterhead
// (Make_My_Event_Letterhead_Template_Final.docx's <w:pgMar>/<w:pgSz>) or
// visually verified against a generated test PDF. Everything else is a
// reasonable starting value per PDF_GENERATOR_MODULE_IMPLEMENTATION_GUIDE_UPDATED.md
// and can be tweaked here in one place without touching renderer code.
import { PDFDocument } from "pdf-lib";

export const PAGE_WIDTH = 612; // US Letter, pt
export const PAGE_HEIGHT = 792;

// Safe content box for EVERY page — every page (first, table continuation,
// reference photo) now reuses the same letterhead template background
// (2026-09-11 change: no more separate blank "plain" page box), so they all
// share this one box. Calibrated from the docx's <w:pgMar> (twips / 20 = pt):
// top=246.25 right=50.4 bottom=92.15 left=74.15
export const PAGE_CONTENT = {
  x: 74,
  right: 562,
  top: 546, // y measured from the page bottom (PDF coordinate space)
  bottom: 92,
};
PAGE_CONTENT.width = PAGE_CONTENT.right - PAGE_CONTENT.x;

// The template prints a static "Date........................" placeholder
// on the same line as the first address row. We mask that placeholder with
// a white rectangle then draw the real event date on top, so the immutable
// template never needs editing (guide §9.2). Calibrated by visually
// comparing a generated test page against the real template in a browser.
export const DATE_FIELD = {
  x: 460,
  y: 590,
  maskWidth: 102,
  maskHeight: 48,
  fontSize: 10,
  textOffsetY: 28,
};

// Copies the template's first (letterhead) page into the output document —
// used for every page now, not just the first, so the whole document shares
// one consistent branded background instead of switching to blank pages.
export async function createTemplatedPage(outputPdf, templatePdf) {
  const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
  outputPdf.addPage(templatePage);
  return templatePage;
}

// Summary table (guide §17)
export const TABLE_COLUMN_PERCENTAGES = {
  sl: 0.08,
  item: 0.17,
  description: 0.67,
  qty: 0.08,
};
export const TABLE_HEADER_FONT_SIZE = 10;
export const TABLE_BODY_FONT_SIZE = 9.5;
export const TABLE_TITLE_FONT_SIZE = 12.5;
export const TABLE_CELL_PADDING_X = 4;
export const TABLE_CELL_PADDING_Y = 4;
export const TABLE_LINE_HEIGHT_FACTOR = 1.2;
export const TABLE_TITLE_ROW_HEIGHT = 20;

// Reference photo pages — one photo + caption per page (2026-09-11 change).
export const REFERENCE_CAPTION_FONT_SIZE = 10.5;
export const REFERENCE_CAPTION_LINE_HEIGHT_FACTOR = 1.25;
export const REFERENCE_CAPTION_GAP = 8;
export const REFERENCE_IMAGE_MAX_WIDTH = PAGE_CONTENT.width;


// guide §15 — sample uses "04/08/24" (DD/MM/YY), not the DB's YYYY-MM-DD.
export function formatEventDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  // Use UTC getters: eventDate is a date-only value (Prisma @db.Date), and
  // reading it with local getters can shift the day near a timezone
  // boundary. This mirrors the "always use nowInBusinessTimezone()/UTC
  // getters for date-only values" convention already used elsewhere in
  // this backend (see utils/dbDates.js).
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export async function loadTemplatePdf(templatePath) {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(templatePath);
  return PDFDocument.load(bytes);
}
