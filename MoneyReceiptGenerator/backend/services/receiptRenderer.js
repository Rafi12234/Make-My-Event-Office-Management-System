// Draws the actual Money Receipt content — rendered on the SAME Make My
// Event letterhead template used by the PDF Generator module (see
// moneyReceiptLayout.js's createTemplatedPage). Single render function used
// by BOTH preview and final generation (never diverge).
//
// Always exactly ONE page: this never adds a continuation page. Instead it
// accepts a `scale` multiplier (applied to all body font sizes/spacing) so
// moneyReceiptGeneratorService.js can measure once, detect overflow, and
// re-render at a smaller scale that guarantees everything fits on the page.
import { rgb } from "pdf-lib";
import {
  PAGE_CONTENT,
  DATE_FIELD,
  COLORS,
  FONT_SIZES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatReceiptDate,
} from "../config/moneyReceiptLayout.js";
import { wrapText, measureLinesHeight, drawLines } from "./textRenderer.js";
import { amountToWordsBDT } from "./amountInWords.js";

function color(c) {
  return rgb(c.r, c.g, c.b);
}

// ৳ symbol isn't in Helvetica's WinAnsi encoding pdf-lib uses by default —
// draw the amount with a plain "Tk " prefix instead, which every reader
// renders correctly with the standard fonts already embedded elsewhere in
// this backend (avoids embedding a whole custom font just for one glyph).
export function formatMoney(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? "-" : ""}Tk ${abs}`;
}

// The template prints a static "Date........................" placeholder
// near the address block — mask it, then draw the real receipt date on top
// (identical technique/coordinates to PDFGenerator's firstPageRenderer.js,
// same template file).
function drawDateOverlay(page, fonts, receiptDate) {
  page.drawRectangle({
    x: DATE_FIELD.x,
    y: DATE_FIELD.y,
    width: DATE_FIELD.maskWidth,
    height: DATE_FIELD.maskHeight,
    color: color(COLORS.white),
  });
  page.drawText(`Date: ${formatReceiptDate(receiptDate)}`, {
    x: DATE_FIELD.x,
    y: DATE_FIELD.y + DATE_FIELD.textOffsetY,
    size: DATE_FIELD.fontSize,
    font: fonts.regular,
    color: color(COLORS.black),
  });
}

// Returns { finalY } — the y coordinate after the last thing drawn. The
// caller compares this against PAGE_CONTENT.bottom to detect overflow and
// decide whether a smaller `scale` is needed to keep everything on one page.
export function renderReceiptContent(page, { fonts, data, scale = 1 }) {
  drawDateOverlay(page, fonts, data.receiptDate);

  let cursorY = PAGE_CONTENT.top;

  // Scaled helpers — everything shrinks together at smaller scales.
  const fs = (base) => base * scale;
  const gap = (base) => base * scale;

  function drawLine(y, thickness = 0.8) {
    page.drawLine({
      start: { x: PAGE_CONTENT.x, y },
      end: { x: PAGE_CONTENT.right, y },
      thickness,
      color: color(COLORS.border),
    });
  }

  // --- Title (letterhead already shows the logo/address block above this) ---
  const title = "MONEY RECEIPT";
  const titleWidth = fonts.bold.widthOfTextAtSize(title, FONT_SIZES.title);
  page.drawText(title, {
    x: PAGE_CONTENT.x + (PAGE_CONTENT.width - titleWidth) / 2,
    y: cursorY - FONT_SIZES.title,
    size: FONT_SIZES.title,
    font: fonts.bold,
    color: color(COLORS.black),
  });
  cursorY -= FONT_SIZES.title + 14;

  page.drawLine({
    start: { x: PAGE_CONTENT.x, y: cursorY },
    end: { x: PAGE_CONTENT.right, y: cursorY },
    thickness: 1.2,
    color: color(COLORS.accent),
  });
  cursorY -= gap(18);

  // --- Receipt No (date is already shown via the letterhead's own
  // placeholder, overlaid above) ---
  page.drawText(`Receipt No: ${data.receiptNo || "PREVIEW"}`, {
    x: PAGE_CONTENT.x,
    y: cursorY - fs(FONT_SIZES.value),
    size: fs(FONT_SIZES.value),
    font: fonts.bold,
    color: color(COLORS.black),
  });
  cursorY -= fs(FONT_SIZES.value) + gap(20);

  const labelColumnWidth = 130;
  const valueMaxWidth = PAGE_CONTENT.width - labelColumnWidth;

  function drawSectionHeading(text) {
    page.drawText(text, {
      x: PAGE_CONTENT.x,
      y: cursorY - fs(FONT_SIZES.sectionHeading),
      size: fs(FONT_SIZES.sectionHeading),
      font: fonts.bold,
      color: color(COLORS.accent),
    });
    cursorY -= fs(FONT_SIZES.sectionHeading) + gap(4);
    drawLine(cursorY);
    cursorY -= gap(10);
  }

  function drawRow(label, value, { bold = false } = {}) {
    if (value === null || value === undefined || value === "") return;
    const text = String(value);
    const valueFontSize = fs(FONT_SIZES.value);
    const lines = wrapText(text, fonts.regular, valueFontSize, valueMaxWidth);
    const blockHeight = measureLinesHeight(lines.length, valueFontSize, 1.3);

    page.drawText(label, {
      x: PAGE_CONTENT.x,
      y: cursorY - valueFontSize,
      size: fs(FONT_SIZES.label),
      font: fonts.bold,
      color: color(COLORS.gray),
    });
    drawLines(page, lines, {
      x: PAGE_CONTENT.x + labelColumnWidth,
      topY: cursorY,
      font: bold ? fonts.bold : fonts.regular,
      fontSize: valueFontSize,
      color: color(COLORS.black),
      lineHeightFactor: 1.3,
    });

    cursorY -= blockHeight + gap(6);
  }

  // --- Client Information ---
  drawSectionHeading("CLIENT INFORMATION");
  drawRow("Client Name:", data.client.name);
  drawRow("Phone:", data.client.phone);
  drawRow("Email:", data.client.email);
  drawRow("Address:", data.client.address);
  cursorY -= gap(6);

  // --- Event Information (whole section optional) ---
  const hasEventInfo = data.event.name || data.event.date || data.event.venue || data.event.bookingReference;
  if (hasEventInfo) {
    drawSectionHeading("EVENT INFORMATION");
    drawRow("Event:", data.event.name);
    drawRow("Event Date:", data.event.date ? formatReceiptDate(data.event.date) : null);
    drawRow("Venue:", data.event.venue);
    drawRow("Booking ID:", data.event.bookingReference);
    cursorY -= gap(6);
  }

  // --- Payment Details ---
  drawSectionHeading("PAYMENT DETAILS");

  function drawAmountLine(label, amount, { bold = false } = {}) {
    const valueFontSize = fs(FONT_SIZES.value);
    page.drawText(label, {
      x: PAGE_CONTENT.x,
      y: cursorY - valueFontSize,
      size: valueFontSize,
      font: bold ? fonts.bold : fonts.regular,
      color: bold ? color(COLORS.black) : color(COLORS.gray),
    });
    const amountText = formatMoney(amount);
    const amountFont = bold ? fonts.bold : fonts.regular;
    const amountWidth = amountFont.widthOfTextAtSize(amountText, valueFontSize);
    page.drawText(amountText, {
      x: PAGE_CONTENT.right - amountWidth,
      y: cursorY - valueFontSize,
      size: valueFontSize,
      font: amountFont,
      color: bold ? color(COLORS.black) : color(COLORS.gray),
    });
    cursorY -= valueFontSize + gap(10);
  }

  drawAmountLine("Total Payment", data.payment.total);
  drawAmountLine("Advance Payment", data.payment.advance);
  drawLine(cursorY + gap(4));
  drawAmountLine("Due Payment", data.payment.due, { bold: true });
  cursorY -= gap(8);

  drawRow("Payment Method:", PAYMENT_METHOD_LABELS[data.payment.method] === "Other" && data.payment.methodOther
    ? data.payment.methodOther
    : PAYMENT_METHOD_LABELS[data.payment.method]);
  drawRow("Transaction ID:", data.payment.transactionReference);
  cursorY -= gap(4);

  // --- Payment Status badge ---
  const statusPalette = {
    paid: { text: COLORS.paidGreen, bg: COLORS.paidGreenBg },
    partially_paid: { text: COLORS.partialAmber, bg: COLORS.partialAmberBg },
    unpaid: { text: COLORS.dueRed, bg: COLORS.dueRedBg },
  }[data.payment.status];
  const statusLabel = PAYMENT_STATUS_LABELS[data.payment.status];
  const badgeFontSize = fs(FONT_SIZES.statusBadge);
  const badgeTextWidth = fonts.bold.widthOfTextAtSize(statusLabel, badgeFontSize);
  const badgePaddingX = gap(12);
  const badgeWidth = badgeTextWidth + badgePaddingX * 2;
  const badgeHeight = badgeFontSize + gap(12);

  page.drawText("Payment Status:", {
    x: PAGE_CONTENT.x,
    y: cursorY - fs(FONT_SIZES.value),
    size: fs(FONT_SIZES.label),
    font: fonts.bold,
    color: color(COLORS.gray),
  });
  page.drawRectangle({
    x: PAGE_CONTENT.x + labelColumnWidth,
    y: cursorY - badgeHeight + gap(4),
    width: badgeWidth,
    height: badgeHeight,
    color: color(statusPalette.bg),
  });
  page.drawText(statusLabel, {
    x: PAGE_CONTENT.x + labelColumnWidth + badgePaddingX,
    y: cursorY - badgeHeight + gap(4) + (badgeHeight - badgeFontSize) / 2 + 1,
    size: badgeFontSize,
    font: fonts.bold,
    color: color(statusPalette.text),
  });
  cursorY -= badgeHeight + gap(18);

  // --- Amount Received in Words (advance payment = amount actually received) ---
  drawSectionHeading("AMOUNT RECEIVED IN WORDS");
  const wordsFontSize = fs(FONT_SIZES.value);
  const wordsText = amountToWordsBDT(data.payment.advance);
  const wordsLines = wrapText(wordsText, fonts.italic, wordsFontSize, PAGE_CONTENT.width);
  const wordsBlockHeight = measureLinesHeight(wordsLines.length, wordsFontSize, 1.3);
  drawLines(page, wordsLines, {
    x: PAGE_CONTENT.x,
    topY: cursorY,
    font: fonts.italic,
    fontSize: wordsFontSize,
    color: color(COLORS.black),
    lineHeightFactor: 1.3,
  });
  cursorY -= wordsBlockHeight + gap(14);

  // --- Remarks (optional) ---
  if (data.remarks) {
    drawSectionHeading("REMARKS");
    const remarkFontSize = fs(FONT_SIZES.value);
    const remarkLines = wrapText(data.remarks, fonts.regular, remarkFontSize, PAGE_CONTENT.width);
    const remarkBlockHeight = measureLinesHeight(remarkLines.length, remarkFontSize, 1.3);
    drawLines(page, remarkLines, {
      x: PAGE_CONTENT.x,
      topY: cursorY,
      font: fonts.regular,
      fontSize: remarkFontSize,
      color: color(COLORS.black),
      lineHeightFactor: 1.3,
    });
    cursorY -= remarkBlockHeight + gap(14);
  }

  // --- Footer ---
  cursorY -= gap(10);
  drawLine(cursorY);
  cursorY -= gap(22);

  const footerFontSize = fs(FONT_SIZES.footer);
  const thanksText = "Thank you for choosing Make My Event.";
  const thanksWidth = fonts.italic.widthOfTextAtSize(thanksText, footerFontSize + 1);
  page.drawText(thanksText, {
    x: PAGE_CONTENT.x + (PAGE_CONTENT.width - thanksWidth) / 2,
    y: cursorY,
    size: footerFontSize + 1,
    font: fonts.italic,
    color: color(COLORS.gray),
  });
  cursorY -= gap(16);

  const authorizedText = "Authorized by Make My Event";
  const authorizedWidth = fonts.bold.widthOfTextAtSize(authorizedText, footerFontSize);
  page.drawText(authorizedText, {
    x: PAGE_CONTENT.x + (PAGE_CONTENT.width - authorizedWidth) / 2,
    y: cursorY,
    size: footerFontSize,
    font: fonts.bold,
    color: color(COLORS.lightGray),
  });

  return { finalY: cursorY };
}

