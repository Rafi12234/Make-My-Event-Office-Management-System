// Renders the fixed "NB:" terms page — always appended as page 2 of every
// money receipt, on the same letterhead background as page 1. Points come
// from the fixed MONEY_RECEIPT_NB_POINTS list (config/moneyReceiptLayout.js),
// never user-supplied.
import { rgb } from "pdf-lib";
import { PAGE_CONTENT, COLORS, MONEY_RECEIPT_NB_POINTS } from "../config/moneyReceiptLayout.js";
import { wrapText, measureLinesHeight, drawLines } from "./textRenderer.js";

function color(c) {
  return rgb(c.r, c.g, c.b);
}

const HEADING_FONT_SIZE = 12;
const ITEM_FONT_SIZE = 10.5;
const ITEM_GAP = 10;
const NUMBER_COLUMN_WIDTH = 20;

export function renderNbPage(page, { fonts, points = MONEY_RECEIPT_NB_POINTS }) {
  let cursorY = PAGE_CONTENT.top;

  page.drawText("NB:", {
    x: PAGE_CONTENT.x,
    y: cursorY - HEADING_FONT_SIZE,
    size: HEADING_FONT_SIZE,
    font: fonts.bold,
    color: color(COLORS.black),
  });
  cursorY -= HEADING_FONT_SIZE + 16;

  const textMaxWidth = PAGE_CONTENT.width - NUMBER_COLUMN_WIDTH;

  for (const [index, point] of points.entries()) {
    const lines = wrapText(point, fonts.bold, ITEM_FONT_SIZE, textMaxWidth);
    const blockHeight = measureLinesHeight(lines.length, ITEM_FONT_SIZE, 1.4);

    page.drawText(`${index + 1}.`, {
      x: PAGE_CONTENT.x,
      y: cursorY - ITEM_FONT_SIZE,
      size: ITEM_FONT_SIZE,
      font: fonts.bold,
      color: color(COLORS.black),
    });

    drawLines(page, lines, {
      x: PAGE_CONTENT.x + NUMBER_COLUMN_WIDTH,
      topY: cursorY,
      font: fonts.bold,
      fontSize: ITEM_FONT_SIZE,
      color: color(COLORS.black),
      lineHeightFactor: 1.4,
    });

    cursorY -= blockHeight + ITEM_GAP;
  }
}
