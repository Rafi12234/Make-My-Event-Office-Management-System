// Flow-based reference-photo section (guide §27-34, §57-59): multiple
// caption+image blocks per page when they fit, a fresh page when they
// don't, and never shrinks an image below MIN_REFERENCE_IMAGE_HEIGHT just
// to squeeze it onto an already-full page.
import { rgb } from "pdf-lib";
import {
  PLAIN_PAGE_CONTENT,
  REFERENCE_CAPTION_FONT_SIZE,
  REFERENCE_CAPTION_LINE_HEIGHT_FACTOR,
  REFERENCE_CAPTION_GAP,
  REFERENCE_BLOCK_GAP,
  REFERENCE_IMAGE_MAX_WIDTH,
  MIN_REFERENCE_IMAGE_HEIGHT,
  createPlainPage,
} from "../config/pdfLayout.js";
import { containImage, drawImageCentered } from "./imageRenderer.js";
import { wrapCaption, measureCaptionHeight, drawCaptionLines } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

// referenceBlocks: [{ itemName, captionText, embeddedImage }] — an item with
// multiple photos contributes multiple blocks; only the FIRST photo of an
// item carries itemName/captionText (subsequent ones pass null so the
// caption isn't repeated, just a smaller gap between stacked photos of the
// same item). embeddedImage already embedded via imageRenderer.embedImageBytes.
export function renderReferenceSection(outputPdf, { referenceBlocks, fonts, startPage, startY }) {
  let page = startPage;
  let cursorY = startY;
  let remainingHeight = startY - PLAIN_PAGE_CONTENT.bottom;

  const contentX = PLAIN_PAGE_CONTENT.x;
  const contentWidth = PLAIN_PAGE_CONTENT.width;

  for (const block of referenceBlocks) {
    const hasCaption = Boolean(block.itemName);
    const captionLines = hasCaption
      ? wrapCaption(block.itemName, block.captionText, fonts, REFERENCE_CAPTION_FONT_SIZE, contentWidth)
      : [];
    const captionHeight = hasCaption
      ? measureCaptionHeight(captionLines, REFERENCE_CAPTION_FONT_SIZE, REFERENCE_CAPTION_LINE_HEIGHT_FACTOR)
      : 0;
    const captionGap = hasCaption ? REFERENCE_CAPTION_GAP : 0;
    // A same-item continuation photo (no caption) only needs a small gap
    // before it, not the full inter-item block gap.
    const gapAfter = hasCaption ? REFERENCE_BLOCK_GAP : REFERENCE_CAPTION_GAP;

    const nativeWidth = block.embeddedImage.width;
    const nativeHeight = block.embeddedImage.height;
    const preferred = containImage(nativeWidth, nativeHeight, REFERENCE_IMAGE_MAX_WIDTH, Number.POSITIVE_INFINITY);
    const preferredBlockHeight = captionHeight + captionGap + preferred.height + gapAfter;

    let fitted = preferred;

    if (preferredBlockHeight > remainingHeight) {
      const maxImageHeightHere = remainingHeight - captionHeight - captionGap - gapAfter;

      if (maxImageHeightHere >= MIN_REFERENCE_IMAGE_HEIGHT) {
        // Shrink to fit the remaining space on the CURRENT page.
        fitted = containImage(nativeWidth, nativeHeight, REFERENCE_IMAGE_MAX_WIDTH, maxImageHeightHere);
      } else {
        // Not enough room left to keep the image reasonably sized — move
        // the whole block to a fresh page instead (guide §33-34).
        page = createPlainPage(outputPdf);
        cursorY = PLAIN_PAGE_CONTENT.top;
        remainingHeight = PLAIN_PAGE_CONTENT.top - PLAIN_PAGE_CONTENT.bottom;
        const maxImageHeightOnNewPage = remainingHeight - captionHeight - captionGap - gapAfter;
        fitted = containImage(nativeWidth, nativeHeight, REFERENCE_IMAGE_MAX_WIDTH, maxImageHeightOnNewPage);
      }
    }

    const blockHeight = captionHeight + captionGap + fitted.height + gapAfter;

    let imageTopY = cursorY;
    if (hasCaption) {
      const afterCaptionY = drawCaptionLines(page, captionLines, {
        x: contentX,
        topY: cursorY,
        fontSize: REFERENCE_CAPTION_FONT_SIZE,
        color: BLACK,
        lineHeightFactor: REFERENCE_CAPTION_LINE_HEIGHT_FACTOR,
      });
      imageTopY = afterCaptionY - captionGap;
    }

    drawImageCentered(page, block.embeddedImage, {
      contentX,
      contentWidth,
      topY: imageTopY,
      width: fitted.width,
      height: fitted.height,
    });

    cursorY -= blockHeight;
    remainingHeight -= blockHeight;
  }

  return { page, y: cursorY };
}
