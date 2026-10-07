// N.B. / Terms & Conditions is stored as one full copy/paste text block.
// The renderer matches the proposal style: heading + numbered terms where only
// the number/title before the colon is bold and the paragraph body is regular.
import { rgb } from "pdf-lib";
import {
  PAGE_CONTENT,
  createTemplatedPage,
} from "../config/pdfLayout.js";
import { wrapText } from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

// Sizes measured from the supplied reference proposal.
const HEADING_FONT_SIZE = 16;
const ITEM_FONT_SIZE = 9.6;
const LINE_HEIGHT = 12.4;
const GAP_ABOVE_HEADING = 14;
const GAP_AFTER_HEADING = 10;
const ITEM_GAP = 5;
const NUMBER_INDENT = 5;
const BODY_INDENT = 30;
const WORD_GAP = 2.2;

function storedNbToText(nbPoints) {
  if (!Array.isArray(nbPoints) || nbPoints.length === 0) return "";
  if (nbPoints.length === 1) return String(nbPoints[0] ?? "");

  // Backward compatibility for old drafts that stored one point per array item.
  return nbPoints
    .map((text, index) => `${index + 1}. ${String(text ?? "").trim()}`)
    .join("\n");
}

function parseNumberedTerm(line) {
  const match = String(line || "").match(/^\s*(\d+\.)\s*([^:]+:)\s*(.*)$/);
  if (!match) return null;

  return {
    number: match[1],
    title: match[2].trim(),
    body: match[3].trim(),
  };
}

function splitWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function pushWordToLine(line, word, font, fontSize, maxWidth) {
  const wordWidth = font.widthOfTextAtSize(word, fontSize);
  const gap = line.segments.length ? WORD_GAP : 0;

  if (line.width + gap + wordWidth <= maxWidth || !line.segments.length) {
    line.segments.push({ text: word, font });
    line.width += gap + wordWidth;
    return true;
  }

  return false;
}

function layoutNumberedTerm(term, fonts) {
  const bodyX = PAGE_CONTENT.x + BODY_INDENT;
  const rightX = PAGE_CONTENT.x + PAGE_CONTENT.width;
  const fullWidth = rightX - bodyX;

  const titleText = term.title;
  const titleWidth = fonts.bold.widthOfTextAtSize(titleText, ITEM_FONT_SIZE);

  const lines = [];
  const firstLine = {
    segments: [{ text: titleText, font: fonts.bold }],
    width: titleWidth,
  };

  const bodyWords = splitWords(term.body);
  let current = firstLine;

  for (const word of bodyWords) {
    if (!pushWordToLine(current, word, fonts.regular, ITEM_FONT_SIZE, fullWidth)) {
      lines.push(current);
      current = { segments: [], width: 0 };
      pushWordToLine(current, word, fonts.regular, ITEM_FONT_SIZE, fullWidth);
    }
  }

  lines.push(current);

  return {
    number: term.number,
    bodyX,
    lines,
  };
}


function measureIntroBlockHeight(text, fonts, numberedTermsToKeep = 4) {
  const physicalLines = String(text || "").split("\n");
  let height = HEADING_FONT_SIZE + GAP_AFTER_HEADING;
  let numberedTerms = 0;

  for (const physicalLine of physicalLines) {
    const cleanLine = physicalLine.trim();

    if (!cleanLine) {
      height += ITEM_GAP;
      continue;
    }

    const term = parseNumberedTerm(cleanLine);

    if (term) {
      const layout = layoutNumberedTerm(term, fonts);
      height += layout.lines.length * LINE_HEIGHT + ITEM_GAP;
      numberedTerms += 1;

      if (numberedTerms >= numberedTermsToKeep) {
        break;
      }

      continue;
    }

    // Preserve any pasted non-numbered line that appears before point 4 in
    // the same keep-together calculation, so the preflight exactly matches
    // what will be drawn.
    const paragraphWidth = PAGE_CONTENT.width - BODY_INDENT;
    const wrapped = wrapText(
      cleanLine,
      fonts.regular,
      ITEM_FONT_SIZE,
      paragraphWidth,
    );

    height += wrapped.length * LINE_HEIGHT + ITEM_GAP;
  }

  return { height, numberedTerms };
}

function drawMixedLine(page, line, x, baselineY) {
  let cursorX = x;

  for (const [index, segment] of line.segments.entries()) {
    if (index > 0) cursorX += WORD_GAP;

    page.drawText(segment.text, {
      x: cursorX,
      y: baselineY,
      size: ITEM_FONT_SIZE,
      font: segment.font,
      color: BLACK,
    });

    cursorX += segment.font.widthOfTextAtSize(segment.text, ITEM_FONT_SIZE);
  }
}

export async function renderNbSection(
  outputPdf,
  { nbPoints, fonts, templatePdf, page, y },
) {
  const text = storedNbToText(nbPoints)
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!text) return { page, y };

  let currentPage = page;
  let cursorY = y - GAP_ABOVE_HEADING;

  async function newPage() {
    currentPage = await createTemplatedPage(outputPdf, templatePdf);
    cursorY = PAGE_CONTENT.top;
  }

  async function ensureRoom(height) {
    if (cursorY - height < PAGE_CONTENT.bottom) {
      await newPage();
    }
  }

  // Avoid leaving only the TERMS & CONDITIONS heading at the bottom of a
  // page. If the heading plus points 1-4 will not fit in the remaining
  // space, move the entire N.B. section to the next letterhead page first.
  const introBlock = measureIntroBlockHeight(text, fonts, 4);
  const fullPageAvailable = PAGE_CONTENT.top - PAGE_CONTENT.bottom;

  if (
    introBlock.numberedTerms >= 4 &&
    introBlock.height <= fullPageAvailable &&
    cursorY - introBlock.height < PAGE_CONTENT.bottom
  ) {
    await newPage();
  } else {
    await ensureRoom(HEADING_FONT_SIZE + GAP_AFTER_HEADING);
  }

  currentPage.drawText("TERMS & CONDITIONS", {
    x: PAGE_CONTENT.x,
    y: cursorY - HEADING_FONT_SIZE,
    size: HEADING_FONT_SIZE,
    font: fonts.bold,
    color: BLACK,
  });

  cursorY -= HEADING_FONT_SIZE + GAP_AFTER_HEADING;

  const physicalLines = text.split("\n");

  for (const physicalLine of physicalLines) {
    const cleanLine = physicalLine.trim();

    if (!cleanLine) {
      cursorY -= ITEM_GAP;
      continue;
    }

    const term = parseNumberedTerm(cleanLine);

    if (term) {
      const layout = layoutNumberedTerm(term, fonts);
      const itemHeight = layout.lines.length * LINE_HEIGHT + ITEM_GAP;
      const fullPageAvailable = PAGE_CONTENT.top - PAGE_CONTENT.bottom;

      // Keep a complete term together when it can fit on one page.
      if (
        itemHeight <= fullPageAvailable &&
        cursorY - itemHeight < PAGE_CONTENT.bottom
      ) {
        await newPage();
      }

      for (let index = 0; index < layout.lines.length; index += 1) {
        await ensureRoom(LINE_HEIGHT);

        const baselineY = cursorY - ITEM_FONT_SIZE;

        if (index === 0) {
          currentPage.drawText(layout.number, {
            x: PAGE_CONTENT.x + NUMBER_INDENT,
            y: baselineY,
            size: ITEM_FONT_SIZE,
            font: fonts.bold,
            color: BLACK,
          });
        }

        drawMixedLine(currentPage, layout.lines[index], layout.bodyX, baselineY);
        cursorY -= LINE_HEIGHT;
      }

      cursorY -= ITEM_GAP;
      continue;
    }

    // Non-numbered text is preserved as regular paragraph text.
    const paragraphX = PAGE_CONTENT.x + BODY_INDENT;
    const paragraphWidth = PAGE_CONTENT.width - BODY_INDENT;
    const wrapped = wrapText(
      cleanLine,
      fonts.regular,
      ITEM_FONT_SIZE,
      paragraphWidth,
    );

    for (const wrappedLine of wrapped) {
      await ensureRoom(LINE_HEIGHT);

      currentPage.drawText(wrappedLine, {
        x: paragraphX,
        y: cursorY - ITEM_FONT_SIZE,
        size: ITEM_FONT_SIZE,
        font: fonts.regular,
        color: BLACK,
      });

      cursorY -= LINE_HEIGHT;
    }

    cursorY -= ITEM_GAP;
  }

  return { page: currentPage, y: cursorY };
}
