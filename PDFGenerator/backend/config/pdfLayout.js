import { PDFDocument } from "pdf-lib";

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

// Calibrated safe area inside make-my-event-letter-pad.pdf.
export const PAGE_CONTENT = {
  x: 74,
  right: 562,
  top: 546,
  bottom: 92,
};
PAGE_CONTENT.width = PAGE_CONTENT.right - PAGE_CONTENT.x;
PAGE_CONTENT.height = PAGE_CONTENT.top - PAGE_CONTENT.bottom;

export const DATE_FIELD = {
  x: 460,
  y: 590,
  maskWidth: 102,
  maskHeight: 48,
  fontSize: 10,
  textOffsetY: 28,
};

export async function createTemplatedPage(outputPdf, templatePdf) {
  const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
  outputPdf.addPage(templatePage);
  return templatePage;
}

export const TABLE_TITLE_FONT_SIZE = 11.5;
export const TABLE_TITLE_ROW_HEIGHT = 20;
export const TABLE_CELL_PADDING_X = 3;
export const TABLE_CELL_PADDING_Y = 3;
export const TABLE_LINE_HEIGHT_FACTOR = 1.16;

export const DETAIL_HEADING_FONT_SIZE = 14;
export const DETAIL_DESCRIPTION_FONT_SIZE = 10;
export const DETAIL_LINE_HEIGHT_FACTOR = 1.25;
export const DETAIL_HEADING_GAP = 7;
export const DETAIL_IMAGE_GAP = 10;

export function formatEventDate(date) {
  const d = date instanceof Date ? date : new Date(date);
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
