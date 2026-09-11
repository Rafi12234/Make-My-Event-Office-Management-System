// Orchestrates the full PDF Generator rendering pipeline (guide §51):
// load the immutable letter-pad template -> draw the first-page summary
// table (spilling onto plain continuation pages if needed) -> draw the
// flow-based reference-photo section -> return the final PDF bytes.
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  FIRST_PAGE_CONTENT,
  PLAIN_PAGE_CONTENT,
  createPlainPage,
  loadTemplatePdf,
} from "../config/pdfLayout.js";
import { renderFirstPageBackground } from "./firstPageRenderer.js";
import {
  computeColumnWidths,
  measureRows,
  drawTableTitle,
  drawTableHeader,
  drawTableRow,
} from "./tableRenderer.js";
import { renderReferenceSection } from "./referencePageRenderer.js";
import { embedImageBytes } from "./imageRenderer.js";

async function embedFonts(pdfDoc) {
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
}

function drawTableSection(outputPdf, { firstPage, eventTitle, rows, fonts }) {
  const firstPageColumnWidths = computeColumnWidths(FIRST_PAGE_CONTENT.width);
  const continuationColumnWidths = computeColumnWidths(PLAIN_PAGE_CONTENT.width);

  let page = firstPage;
  let contentBox = FIRST_PAGE_CONTENT;
  let columnWidths = firstPageColumnWidths;

  let y = drawTableTitle(page, {
    x: contentBox.x,
    y: contentBox.top,
    width: contentBox.width,
    title: eventTitle,
    font: fonts.bold,
  });
  y = drawTableHeader(page, { x: contentBox.x, y, columnWidths, font: fonts.bold });

  for (const row of rows) {
    if (y - row.height < contentBox.bottom) {
      // Table continuation pages are plain white, headers repeated (guide §55-56).
      page = createPlainPage(outputPdf);
      contentBox = PLAIN_PAGE_CONTENT;
      columnWidths = continuationColumnWidths;

      y = drawTableTitle(page, {
        x: contentBox.x,
        y: contentBox.top,
        width: contentBox.width,
        title: `${eventTitle} (continued)`,
        font: fonts.bold,
      });
      y = drawTableHeader(page, { x: contentBox.x, y, columnWidths, font: fonts.bold });
    }

    y = drawTableRow(page, { x: contentBox.x, y, columnWidths, row, font: fonts.regular });
  }

  return { page, y };
}

export async function generatePdfDocument({ templatePath, eventDate, eventTitle, items }) {
  if (!items?.length) throw new Error("At least one event item is required.");

  const templatePdf = await loadTemplatePdf(templatePath);
  const outputPdf = await PDFDocument.create();
  const fonts = await embedFonts(outputPdf);

  const firstPage = await renderFirstPageBackground(outputPdf, templatePdf, eventDate);

  const firstPageColumnWidths = computeColumnWidths(FIRST_PAGE_CONTENT.width);
  const rows = measureRows(items, firstPageColumnWidths, fonts);
  drawTableSection(outputPdf, { firstPage, eventTitle, rows, fonts });

  const referenceBlocks = [];
  for (const item of items) {
    const images = item.referenceImages || [];
    for (const [index, image] of images.entries()) {
      const embeddedImage = await embedImageBytes(outputPdf, image.bytes, image.mimeType);
      referenceBlocks.push({
        // Only the first photo of an item carries the caption (guide §25) —
        // additional photos of the same item stack underneath, uncaptioned.
        itemName: index === 0 ? item.itemName : null,
        captionText: index === 0 ? item.customCaption?.trim() || item.description : null,
        embeddedImage,
      });
    }
  }

  if (referenceBlocks.length > 0) {
    // Reference pages always start fresh, after the table finishes (guide §55).
    const referenceStartPage = createPlainPage(outputPdf);
    renderReferenceSection(outputPdf, {
      referenceBlocks,
      fonts,
      startPage: referenceStartPage,
      startY: PLAIN_PAGE_CONTENT.top,
    });
  }

  const bytes = await outputPdf.save();
  return { bytes, pageCount: outputPdf.getPageCount() };
}
