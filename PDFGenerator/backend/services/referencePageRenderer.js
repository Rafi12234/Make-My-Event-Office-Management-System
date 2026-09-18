import { rgb } from "pdf-lib";
import {
  createTemplatedPage,
  DETAIL_DESCRIPTION_FONT_SIZE,
  DETAIL_HEADING_FONT_SIZE,
  DETAIL_HEADING_GAP,
  DETAIL_IMAGE_GAP,
  DETAIL_LINE_HEIGHT_FACTOR,
  PAGE_CONTENT,
} from "../config/pdfLayout.js";
import { containImage, drawImageCentered } from "./imageRenderer.js";
import { drawLines, measureLinesHeight, wrapText } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);
const MIN_USEFUL_IMAGE_SPACE = 95;

async function newPage(outputPdf, templatePdf) {
  return createTemplatedPage(outputPdf, templatePdf);
}

export async function renderReferenceSection(outputPdf, { items, fonts, templatePdf }) {
  for (const item of items) {
    let page = await newPage(outputPdf, templatePdf);
    let cursorY = PAGE_CONTENT.top;

    const headingLines = wrapText(item.itemName || "Item", fonts.bold, DETAIL_HEADING_FONT_SIZE, PAGE_CONTENT.width);
    drawLines(page, headingLines, {
      x: PAGE_CONTENT.x,
      topY: cursorY,
      width: PAGE_CONTENT.width,
      font: fonts.bold,
      fontSize: DETAIL_HEADING_FONT_SIZE,
      color: BLACK,
      lineHeightFactor: DETAIL_LINE_HEIGHT_FACTOR,
    });
    cursorY -= measureLinesHeight(headingLines.length, DETAIL_HEADING_FONT_SIZE, DETAIL_LINE_HEIGHT_FACTOR);

    const description = String(item.customCaption?.trim() || item.description || "").trim();
    if (description) {
      cursorY -= DETAIL_HEADING_GAP;
      const remainingDescriptionLines = wrapText(
        description,
        fonts.regular,
        DETAIL_DESCRIPTION_FONT_SIZE,
        PAGE_CONTENT.width,
      );
      const lineHeight = DETAIL_DESCRIPTION_FONT_SIZE * DETAIL_LINE_HEIGHT_FACTOR;

      while (remainingDescriptionLines.length) {
        let lineCapacity = Math.floor((cursorY - PAGE_CONTENT.bottom) / lineHeight);
        if (lineCapacity < 1) {
          page = await newPage(outputPdf, templatePdf);
          cursorY = PAGE_CONTENT.top;
          lineCapacity = Math.max(1, Math.floor(PAGE_CONTENT.height / lineHeight));
        }

        const chunk = remainingDescriptionLines.splice(0, lineCapacity);
        drawLines(page, chunk, {
          x: PAGE_CONTENT.x,
          topY: cursorY,
          width: PAGE_CONTENT.width,
          font: fonts.regular,
          fontSize: DETAIL_DESCRIPTION_FONT_SIZE,
          color: BLACK,
          lineHeightFactor: DETAIL_LINE_HEIGHT_FACTOR,
        });
        cursorY -= measureLinesHeight(chunk.length, DETAIL_DESCRIPTION_FONT_SIZE, DETAIL_LINE_HEIGHT_FACTOR);

        if (remainingDescriptionLines.length) {
          page = await newPage(outputPdf, templatePdf);
          cursorY = PAGE_CONTENT.top;
        }
      }
    }

    const images = item.embeddedImages || [];
    if (!images.length) continue;
    cursorY -= DETAIL_IMAGE_GAP;

    for (const embeddedImage of images) {
      let remaining = cursorY - PAGE_CONTENT.bottom;
      if (remaining < MIN_USEFUL_IMAGE_SPACE) {
        page = await newPage(outputPdf, templatePdf);
        cursorY = PAGE_CONTENT.top;
        remaining = PAGE_CONTENT.height;
      }

      // Preserve the complete source image: never crop or stretch. Large
      // images use the available letterhead content box; genuinely smaller
      // images keep their natural footprint so another image may follow.
      const fitted = containImage(
        embeddedImage.width,
        embeddedImage.height,
        PAGE_CONTENT.width,
        remaining,
        { allowUpscale: false },
      );

      drawImageCentered(page, embeddedImage, {
        contentX: PAGE_CONTENT.x,
        contentWidth: PAGE_CONTENT.width,
        topY: cursorY,
        width: fitted.width,
        height: fitted.height,
      });
      cursorY -= fitted.height + DETAIL_IMAGE_GAP;
    }
  }
}
