import { rgb } from "pdf-lib";
import { PAGE_CONTENT, createTemplatedPage } from "../config/pdfLayout.js";

const BLACK = rgb(0, 0, 0);
const BORDER = rgb(0.82, 0.82, 0.82);
const BACKGROUND = rgb(0.97, 0.97, 0.97);
const GAP_ABOVE = 10;
const BOX_HEIGHT = 30;
const FONT_SIZE = 10;
const PADDING_X = 10;

function formatPrice(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export async function renderTotalPrice(outputPdf, { totalPrice, fonts, templatePdf, page, y }) {
  const amount = formatPrice(totalPrice);
  if (!amount) return { page, y };

  let currentPage = page;
  let topY = y - GAP_ABOVE;

  if (topY - BOX_HEIGHT < PAGE_CONTENT.bottom) {
    currentPage = await createTemplatedPage(outputPdf, templatePdf);
    topY = PAGE_CONTENT.top;
  }

  const boxWidth = Math.min(235, PAGE_CONTENT.width);
  const x = PAGE_CONTENT.x + PAGE_CONTENT.width - boxWidth;
  const bottomY = topY - BOX_HEIGHT;

  currentPage.drawRectangle({
    x,
    y: bottomY,
    width: boxWidth,
    height: BOX_HEIGHT,
    color: BACKGROUND,
    borderColor: BORDER,
    borderWidth: 0.75,
  });

  const label = "Total Price";
  const value = amount;
  const baselineY = bottomY + (BOX_HEIGHT - FONT_SIZE) / 2 + 1;

  currentPage.drawText(label, {
    x: x + PADDING_X,
    y: baselineY,
    size: FONT_SIZE,
    font: fonts.bold,
    color: BLACK,
  });

  const valueWidth = fonts.bold.widthOfTextAtSize(value, FONT_SIZE);
  currentPage.drawText(value, {
    x: x + boxWidth - PADDING_X - valueWidth,
    y: baselineY,
    size: FONT_SIZE,
    font: fonts.bold,
    color: BLACK,
  });

  return {
    page: currentPage,
    y: bottomY,
  };
}
