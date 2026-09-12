// Orchestrates the full PDF Generator rendering pipeline: load the
// immutable letter-pad template -> draw the first-page summary table
// (spilling onto more letterhead pages if needed) -> draw one reference
// photo per page (2026-09-11: every page now shares the same letterhead
// background, and reference photos are never stacked) -> return the PDF bytes.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PAGE_CONTENT, createTemplatedPage, loadTemplatePdf } from "../config/pdfLayout.js";
import { renderFirstPageBackground } from "./firstPageRenderer.js";
import {
  computeColumnWidths,
  measureRows,
  drawTableTitle,
  drawTableHeader,
  drawTableRow,
} from "./tableRenderer.js";
import { renderReferenceSection } from "./referencePageRenderer.js";
import { renderNbSection } from "./nbSectionRenderer.js";
import { embedImageBytes } from "./imageRenderer.js";

async function embedFonts(pdfDoc) {
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
}

async function drawTableSection(outputPdf, { firstPage, templatePdf, eventTitle, rows, fonts, columnWidths }) {
  let page = firstPage;

  let y = drawTableTitle(page, {
    x: PAGE_CONTENT.x,
    y: PAGE_CONTENT.top,
    width: PAGE_CONTENT.width,
    title: eventTitle,
    font: fonts.bold,
  });
  y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold });

  for (const row of rows) {
    if (y - row.height < PAGE_CONTENT.bottom) {
      // Continuation pages share the same letterhead background and title
      // text as page 1 — no "(continued)" suffix.
      page = await createTemplatedPage(outputPdf, templatePdf);

      y = drawTableTitle(page, {
        x: PAGE_CONTENT.x,
        y: PAGE_CONTENT.top,
        width: PAGE_CONTENT.width,
        title: eventTitle,
        font: fonts.bold,
      });
      y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold });
    }

    y = drawTableRow(page, { x: PAGE_CONTENT.x, y, columnWidths, row, font: fonts.regular });
  }

  return { page, y };
}

export async function generatePdfDocument({ templatePath, eventDate, eventTitle, items, nbPoints }) {
  if (!items?.length) throw new Error("At least one event item is required.");

  const templatePdf = await loadTemplatePdf(templatePath);
  const outputPdf = await PDFDocument.create();
  const fonts = await embedFonts(outputPdf);

  const firstPage = await renderFirstPageBackground(outputPdf, templatePdf, eventDate);

  const columnWidths = computeColumnWidths(PAGE_CONTENT.width);
  const rows = measureRows(items, columnWidths, fonts);
  const afterTable = await drawTableSection(outputPdf, { firstPage, templatePdf, eventTitle, rows, fonts, columnWidths });
  await renderNbSection(outputPdf, { nbPoints, fonts, templatePdf, page: afterTable.page, y: afterTable.y });

  const referenceBlocks = [];
  for (const item of items) {
    const images = item.referenceImages || [];
    for (const image of images) {
      const embeddedImage = await embedImageBytes(outputPdf, image.bytes, image.mimeType);
      // Every photo carries its own caption now — one photo per page (2026-09-11).
      referenceBlocks.push({
        itemName: item.itemName,
        captionText: item.customCaption?.trim() || item.description,
        embeddedImage,
      });
    }
  }

  if (referenceBlocks.length > 0) {
    await renderReferenceSection(outputPdf, { referenceBlocks, fonts, templatePdf });
  }

  const bytes = await outputPdf.save();
  return { bytes, pageCount: outputPdf.getPageCount() };
}
