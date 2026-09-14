// Reference-photo section (2026-09-11 rewrite): every photo gets its own
// full page, sharing the same letterhead background as the first page, with
// its own caption above it — no more stacking multiple photos on one page.
import { rgb } from "pdf-lib";
import {
  PAGE_CONTENT,
  REFERENCE_CAPTION_FONT_SIZE,
  REFERENCE_CAPTION_LINE_HEIGHT_FACTOR,
  REFERENCE_CAPTION_GAP,
  REFERENCE_IMAGE_MAX_WIDTH,
  createTemplatedPage,
} from "../config/pdfLayout.js";
import { containImage, drawImageCentered } from "./imageRenderer.js";
import { wrapCaption, drawCaptionLines } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

// referenceBlocks: [{ itemName, captionText, embeddedImage }] — one entry
// per photo; every photo carries its own caption (item name + description).
export async function renderReferenceSection(outputPdf, { referenceBlocks, fonts, templatePdf }) {
  const contentX = PAGE_CONTENT.x;
  const contentWidth = PAGE_CONTENT.width;

  for (const block of referenceBlocks) {
    const page = await createTemplatedPage(outputPdf, templatePdf);

    const captionLines = wrapCaption(block.itemName, block.captionText, fonts, REFERENCE_CAPTION_FONT_SIZE, contentWidth);

    const afterCaptionY = drawCaptionLines(page, captionLines, {
      x: contentX,
      topY: PAGE_CONTENT.top,
      fontSize: REFERENCE_CAPTION_FONT_SIZE,
      color: BLACK,
      lineHeightFactor: REFERENCE_CAPTION_LINE_HEIGHT_FACTOR,
    });
    const imageTopY = afterCaptionY - REFERENCE_CAPTION_GAP;

    const maxImageHeight = imageTopY - PAGE_CONTENT.bottom;
    const fitted = containImage(block.embeddedImage.width, block.embeddedImage.height, REFERENCE_IMAGE_MAX_WIDTH, maxImageHeight);

    drawImageCentered(page, block.embeddedImage, {
      contentX,
      contentWidth,
      topY: imageTopY,
      width: fitted.width,
      height: fitted.height,
    });
  }
}
