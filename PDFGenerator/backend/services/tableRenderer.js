import { rgb } from "pdf-lib";
import {
  TABLE_CELL_PADDING_X,
  TABLE_CELL_PADDING_Y,
  TABLE_LINE_HEIGHT_FACTOR,
  TABLE_TITLE_FONT_SIZE,
  TABLE_TITLE_ROW_HEIGHT,
} from "../config/pdfLayout.js";
import { drawLines, measureLinesHeight, wrapText } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);
const OPTIONAL_ORDER = ["size", "sqft", "tsqft", "unit", "price"];
const META = {
  sl: { label: "SL", weight: 4 },
  item: { label: "Item", weight: 11 },
  description: { label: "Description", weight: 20 },
  qty: { label: "QTY", weight: 5 },
  size: { label: "Size", weight: 8 },
  sqft: { label: "SQFT", weight: 6 },
  tsqft: { label: "TSqft", weight: 6 },
  unit: { label: "Unit", weight: 6 },
  price: { label: "Price", weight: 8 },
};

// Images are intentionally NOT part of the summary table. They remain attached
// to each PDF item and are rendered later in the detail/reference section.
export function getColumnOrder(selectedColumns = []) {
  const optional = OPTIONAL_ORDER.filter((key) => selectedColumns.includes(key));
  return ["sl", "item", "description", "qty", ...optional];
}

export function tableFontSizes(columnCount) {
  if (columnCount >= 9) return { header: 6.8, body: 6.9 };
  if (columnCount >= 7) return { header: 7.4, body: 7.6 };
  if (columnCount >= 6) return { header: 8, body: 8.2 };
  return { header: 8.8, body: 9 };
}

export function computeColumnWidths(tableWidth, selectedColumns = []) {
  const order = getColumnOrder(selectedColumns);
  const totalWeight = order.reduce((sum, key) => sum + META[key].weight, 0);
  const widths = {};
  for (const key of order) widths[key] = (tableWidth * META[key].weight) / totalWeight;
  return widths;
}

function totalWidth(columnWidths, order) {
  return order.reduce((sum, key) => sum + columnWidths[key], 0);
}

function textValue(item, key, index) {
  if (key === "sl") return String(index + 1);
  if (key === "item") return item.itemName || "";
  if (key === "description") return item.description || "";
  if (key === "qty") return item.quantity || "";
  return item[key] == null ? "" : String(item[key]);
}

export function measureRows(items, columnWidths, fonts, selectedColumns = []) {
  const order = getColumnOrder(selectedColumns);
  const { body } = tableFontSizes(order.length);

  return items.map((item, index) => {
    const wrapped = {};
    let textHeight = 0;

    for (const key of order) {
      const maxWidth = Math.max(4, columnWidths[key] - TABLE_CELL_PADDING_X * 2);
      wrapped[key] = wrapText(textValue(item, key, index), fonts.regular, body, maxWidth);
      textHeight = Math.max(
        textHeight,
        measureLinesHeight(wrapped[key].length, body, TABLE_LINE_HEIGHT_FACTOR) + TABLE_CELL_PADDING_Y * 2,
      );
    }

    return {
      item,
      wrapped,
      height: Math.max(textHeight, body + TABLE_CELL_PADDING_Y * 2),
    };
  });
}

// Extremely tall rows are split across continuation pages. Since images are
// not part of the table anymore, only wrapped text needs to be segmented.
export function splitMeasuredRow(row, maxHeight, columnWidths, selectedColumns = []) {
  if (row.height <= maxHeight) return [row];

  const order = getColumnOrder(selectedColumns);
  const { body } = tableFontSizes(order.length);
  const lineHeight = body * TABLE_LINE_HEIGHT_FACTOR;
  const maxTextLines = Math.max(1, Math.floor((maxHeight - TABLE_CELL_PADDING_Y * 2) / lineHeight));
  const offsets = Object.fromEntries(order.map((key) => [key, 0]));
  const segments = [];

  function hasRemaining() {
    return order.some((key) => offsets[key] < (row.wrapped[key] || []).length);
  }

  while (hasRemaining()) {
    const wrapped = {};
    let textHeight = 0;

    for (const key of order) {
      const lines = row.wrapped[key] || [];
      const start = offsets[key];
      const chunk = lines.slice(start, start + maxTextLines);
      offsets[key] = start + chunk.length;
      wrapped[key] = chunk;

      if (chunk.length) {
        textHeight = Math.max(
          textHeight,
          measureLinesHeight(chunk.length, body, TABLE_LINE_HEIGHT_FACTOR) + TABLE_CELL_PADDING_Y * 2,
        );
      }
    }

    segments.push({
      item: row.item,
      wrapped,
      height: Math.min(maxHeight, Math.max(textHeight, body + TABLE_CELL_PADDING_Y * 2)),
    });
  }

  return segments;
}

export function measureHeaderHeight(selectedColumns = []) {
  const count = getColumnOrder(selectedColumns).length;
  const { header } = tableFontSizes(count);
  return measureLinesHeight(1, header, TABLE_LINE_HEIGHT_FACTOR) + TABLE_CELL_PADDING_Y * 2;
}

function drawColumnBorders(page, x, columnWidths, order, topY, bottomY) {
  let cursor = x;
  page.drawLine({ start: { x: cursor, y: topY }, end: { x: cursor, y: bottomY }, thickness: 0.7, color: BLACK });
  for (const key of order) {
    cursor += columnWidths[key];
    page.drawLine({ start: { x: cursor, y: topY }, end: { x: cursor, y: bottomY }, thickness: 0.7, color: BLACK });
  }
}

export function drawTableTitle(page, { x, y, width, title, font }) {
  const height = TABLE_TITLE_ROW_HEIGHT;
  const bottomY = y - height;
  page.drawRectangle({ x, y: bottomY, width, height, borderWidth: 0.7, borderColor: BLACK });

  const safeTitle = String(title || "");
  const textWidth = font.widthOfTextAtSize(safeTitle, TABLE_TITLE_FONT_SIZE);
  const fittedSize = textWidth > width - 12
    ? Math.max(8, (TABLE_TITLE_FONT_SIZE * (width - 12)) / textWidth)
    : TABLE_TITLE_FONT_SIZE;
  const fittedWidth = font.widthOfTextAtSize(safeTitle, fittedSize);

  page.drawText(safeTitle, {
    x: x + (width - fittedWidth) / 2,
    y: bottomY + (height - fittedSize) / 2 + 1,
    size: fittedSize,
    font,
    color: BLACK,
  });
  return bottomY;
}

export function drawTableHeader(page, { x, y, columnWidths, font, selectedColumns = [] }) {
  const order = getColumnOrder(selectedColumns);
  const { header } = tableFontSizes(order.length);
  const height = measureHeaderHeight(selectedColumns);
  const bottomY = y - height;
  const width = totalWidth(columnWidths, order);

  drawColumnBorders(page, x, columnWidths, order, y, bottomY);
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.7, color: BLACK });
  page.drawLine({ start: { x, y: bottomY }, end: { x: x + width, y: bottomY }, thickness: 0.7, color: BLACK });

  let cursor = x;
  for (const key of order) {
    const label = META[key].label;
    const labelWidth = font.widthOfTextAtSize(label, header);
    page.drawText(label, {
      x: cursor + Math.max(1, (columnWidths[key] - labelWidth) / 2),
      y: bottomY + (height - header) / 2 + 1,
      size: header,
      font,
      color: BLACK,
    });
    cursor += columnWidths[key];
  }

  return bottomY;
}

export function drawTableRow(page, { x, y, columnWidths, row, font, selectedColumns = [] }) {
  const order = getColumnOrder(selectedColumns);
  const { body } = tableFontSizes(order.length);
  const bottomY = y - row.height;
  const width = totalWidth(columnWidths, order);

  drawColumnBorders(page, x, columnWidths, order, y, bottomY);
  page.drawLine({ start: { x, y: bottomY }, end: { x: x + width, y: bottomY }, thickness: 0.7, color: BLACK });

  let cursor = x;
  for (const key of order) {
    const lines = row.wrapped[key] || [""];
    const linesHeight = measureLinesHeight(lines.length, body, TABLE_LINE_HEIGHT_FACTOR);
    const topInset = Math.max((row.height - linesHeight) / 2, TABLE_CELL_PADDING_Y);

    drawLines(page, lines, {
      x: cursor + TABLE_CELL_PADDING_X,
      topY: y - topInset,
      width: Math.max(4, columnWidths[key] - TABLE_CELL_PADDING_X * 2),
      font,
      fontSize: body,
      color: BLACK,
      align: "center",
      lineHeightFactor: TABLE_LINE_HEIGHT_FACTOR,
    });

    cursor += columnWidths[key];
  }

  return bottomY;
}
