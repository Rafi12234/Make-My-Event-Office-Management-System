// Optional "NB:" numbered notes list drawn under the summary table on page
// 1 (guide reference sample) — plain user-authored text, entirely optional
// (renderNbSection is a no-op when nbPoints is empty).
import { rgb } from "pdf-lib";
import { PAGE_CONTENT, createTemplatedPage } from "../config/pdfLayout.js";
import { wrapText, measureLinesHeight, drawLines } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

const HEADING_FONT_SIZE = 10.5;
const ITEM_FONT_SIZE = 9.5;
const LINE_HEIGHT_FACTOR = 1.25;
const GAP_ABOVE_HEADING = 16;
const GAP_AFTER_HEADING = 6;
const ITEM_GAP = 5;
const NUMBER_COLUMN_WIDTH = 18; // reserved width for "N." so wrapped lines hang-indent under the text

// Draws below wherever the table finished ({ page, y }), spilling onto a
// fresh templated page if it runs out of room. Returns unused when empty.
export async function renderNbSection(outputPdf, { nbPoints, fonts, templatePdf, page, y }) {
  const points = (nbPoints || []).map((text) => String(text).trim()).filter(Boolean);
  if (points.length === 0) return { page, y };

  let currentPage = page;
  let cursorY = y - GAP_ABOVE_HEADING;

  async function ensureRoom(neededHeight) {
    if (cursorY - neededHeight < PAGE_CONTENT.bottom) {
      currentPage = await createTemplatedPage(outputPdf, templatePdf);
      cursorY = PAGE_CONTENT.top;
    }
  }

  const headingLineHeight = HEADING_FONT_SIZE * LINE_HEIGHT_FACTOR;
  await ensureRoom(headingLineHeight);
  currentPage.drawText("NB:", {
    x: PAGE_CONTENT.x,
    y: cursorY - HEADING_FONT_SIZE,
    size: HEADING_FONT_SIZE,
    font: fonts.bold,
    color: BLACK,
  });
  cursorY -= headingLineHeight + GAP_AFTER_HEADING;

  const textMaxWidth = PAGE_CONTENT.width - NUMBER_COLUMN_WIDTH;

  for (const [index, text] of points.entries()) {
    const lines = wrapText(text, fonts.regular, ITEM_FONT_SIZE, textMaxWidth);
    const blockHeight = measureLinesHeight(lines.length, ITEM_FONT_SIZE, LINE_HEIGHT_FACTOR);

    await ensureRoom(blockHeight);

    currentPage.drawText(`${index + 1}.`, {
      x: PAGE_CONTENT.x,
      y: cursorY - ITEM_FONT_SIZE,
      size: ITEM_FONT_SIZE,
      font: fonts.regular,
      color: BLACK,
    });

    drawLines(currentPage, lines, {
      x: PAGE_CONTENT.x + NUMBER_COLUMN_WIDTH,
      topY: cursorY,
      width: textMaxWidth,
      font: fonts.regular,
      fontSize: ITEM_FONT_SIZE,
      color: BLACK,
      lineHeightFactor: LINE_HEIGHT_FACTOR,
    });

    cursorY -= blockHeight + ITEM_GAP;
  }

  return { page: currentPage, y: cursorY };
}
