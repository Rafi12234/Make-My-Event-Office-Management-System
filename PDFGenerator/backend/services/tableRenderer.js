// Summary-table drawing + pagination for pdf-lib (guide §17-23, §54-56):
// dynamic row heights, cell text wrapping, centered alignment, and table
// continuation onto plain pages when rows overflow the first page.
import { rgb } from "pdf-lib";
import {
  TABLE_COLUMN_PERCENTAGES,
  TABLE_HEADER_FONT_SIZE,
  TABLE_BODY_FONT_SIZE,
  TABLE_TITLE_FONT_SIZE,
  TABLE_TITLE_ROW_HEIGHT,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_PADDING_Y,
  TABLE_LINE_HEIGHT_FACTOR,
} from "../config/pdfLayout.js";
import { wrapText, measureLinesHeight, drawLines } from "./textRenderer.js";

const COLUMN_ORDER = ["sl", "item", "description", "qty"];
const COLUMN_LABELS = { sl: "Sl", item: "Item", description: "Description", qty: "Qty" };
const BLACK = rgb(0, 0, 0);

export function computeColumnWidths(tableWidth) {
  const widths = {};
  for (const key of COLUMN_ORDER) widths[key] = tableWidth * TABLE_COLUMN_PERCENTAGES[key];
  return widths;
}

function totalWidth(columnWidths) {
  return COLUMN_ORDER.reduce((sum, key) => sum + columnWidths[key], 0);
}

function cellMaxTextWidth(columnWidth) {
  return columnWidth - TABLE_CELL_PADDING_X * 2;
}

// Precomputes wrapped lines + required row height for every item, once, so
// pagination can walk through rows without re-measuring repeatedly (guide
// §58 "measure before drawing").
export function measureRows(items, columnWidths, fonts) {
  return items.map((item, index) => {
    const wrapped = {
      sl: wrapText(String(index + 1), fonts.regular, TABLE_BODY_FONT_SIZE, cellMaxTextWidth(columnWidths.sl)),
      item: wrapText(item.itemName, fonts.regular, TABLE_BODY_FONT_SIZE, cellMaxTextWidth(columnWidths.item)),
      description: wrapText(item.description, fonts.regular, TABLE_BODY_FONT_SIZE, cellMaxTextWidth(columnWidths.description)),
      qty: wrapText(String(item.quantity), fonts.regular, TABLE_BODY_FONT_SIZE, cellMaxTextWidth(columnWidths.qty)),
    };

    const maxLines = Math.max(...COLUMN_ORDER.map((key) => wrapped[key].length), 1);
    const height = measureLinesHeight(maxLines, TABLE_BODY_FONT_SIZE, TABLE_LINE_HEIGHT_FACTOR) + TABLE_CELL_PADDING_Y * 2;

    return { item, wrapped, height };
  });
}

export function measureHeaderHeight() {
  return measureLinesHeight(1, TABLE_HEADER_FONT_SIZE, TABLE_LINE_HEIGHT_FACTOR) + TABLE_CELL_PADDING_Y * 2;
}

function drawColumnBorders(page, x, columnWidths, topY, bottomY) {
  let cursor = x;
  page.drawLine({ start: { x: cursor, y: topY }, end: { x: cursor, y: bottomY }, thickness: 0.8, color: BLACK });
  for (const key of COLUMN_ORDER) {
    cursor += columnWidths[key];
    page.drawLine({ start: { x: cursor, y: topY }, end: { x: cursor, y: bottomY }, thickness: 0.8, color: BLACK });
  }
}

// Merged, centered event-title row above the table headers (guide §16).
export function drawTableTitle(page, { x, y, width, title, font }) {
  const height = TABLE_TITLE_ROW_HEIGHT;
  const bottomY = y - height;

  page.drawRectangle({ x, y: bottomY, width, height, borderWidth: 0.8, borderColor: BLACK });
  const textWidth = font.widthOfTextAtSize(title, TABLE_TITLE_FONT_SIZE);
  page.drawText(title, {
    x: x + (width - textWidth) / 2,
    y: bottomY + (height - TABLE_TITLE_FONT_SIZE) / 2 + 1,
    size: TABLE_TITLE_FONT_SIZE,
    font,
    color: BLACK,
  });

  return bottomY;
}

export function drawTableHeader(page, { x, y, columnWidths, font }) {
  const height = measureHeaderHeight();
  const bottomY = y - height;
  const width = totalWidth(columnWidths);

  drawColumnBorders(page, x, columnWidths, y, bottomY);
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.8, color: BLACK });
  page.drawLine({ start: { x, y: bottomY }, end: { x: x + width, y: bottomY }, thickness: 0.8, color: BLACK });

  let cursor = x;
  for (const key of COLUMN_ORDER) {
    const label = COLUMN_LABELS[key];
    const textWidth = font.widthOfTextAtSize(label, TABLE_HEADER_FONT_SIZE);
    page.drawText(label, {
      x: cursor + (columnWidths[key] - textWidth) / 2,
      y: bottomY + (height - TABLE_HEADER_FONT_SIZE) / 2 + 1,
      size: TABLE_HEADER_FONT_SIZE,
      font,
      color: BLACK,
    });
    cursor += columnWidths[key];
  }

  return bottomY;
}

// Draws one pre-measured row (from measureRows) with vertically centered,
// wrapped, centered-aligned cell text (guide §19-21).
export function drawTableRow(page, { x, y, columnWidths, row, font }) {
  const bottomY = y - row.height;
  const width = totalWidth(columnWidths);

  drawColumnBorders(page, x, columnWidths, y, bottomY);
  page.drawLine({ start: { x, y: bottomY }, end: { x: x + width, y: bottomY }, thickness: 0.8, color: BLACK });

  let cursor = x;
  for (const key of COLUMN_ORDER) {
    const lines = row.wrapped[key];
    const linesHeight = measureLinesHeight(lines.length, TABLE_BODY_FONT_SIZE, TABLE_LINE_HEIGHT_FACTOR);
    const topInset = Math.max((row.height - linesHeight) / 2, TABLE_CELL_PADDING_Y);

    drawLines(page, lines, {
      x: cursor + TABLE_CELL_PADDING_X,
      topY: y - topInset,
      width: cellMaxTextWidth(columnWidths[key]),
      font,
      fontSize: TABLE_BODY_FONT_SIZE,
      color: BLACK,
      align: "center",
      lineHeightFactor: TABLE_LINE_HEIGHT_FACTOR,
    });
    cursor += columnWidths[key];
  }

  return bottomY;
}
