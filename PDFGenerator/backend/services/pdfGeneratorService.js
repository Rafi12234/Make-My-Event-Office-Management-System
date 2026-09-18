import { PDFDocument, StandardFonts } from "pdf-lib";
import { PAGE_CONTENT, TABLE_TITLE_ROW_HEIGHT, createTemplatedPage, loadTemplatePdf } from "../config/pdfLayout.js";
import { renderFirstPageBackground } from "./firstPageRenderer.js";
import {
  computeColumnWidths,
  drawTableHeader,
  drawTableRow,
  drawTableTitle,
  measureRows,
  measureHeaderHeight,
  splitMeasuredRow,
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

async function embedItemImages(outputPdf, items) {
  const prepared = [];
  for (const item of items) {
    const embeddedImages = [];
    for (const image of item.referenceImages || []) {
      embeddedImages.push(await embedImageBytes(outputPdf, image.bytes, image.mimeType));
    }
    prepared.push({ ...item, embeddedImages });
  }
  return prepared;
}

async function drawTableSection(outputPdf, { firstPage, templatePdf, eventTitle, rows, fonts, columnWidths, selectedColumns }) {
  let page = firstPage;
  let y = drawTableTitle(page, {
    x: PAGE_CONTENT.x,
    y: PAGE_CONTENT.top,
    width: PAGE_CONTENT.width,
    title: eventTitle,
    font: fonts.bold,
  });
  y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold, selectedColumns });

  const continuationRowMaxHeight =
    PAGE_CONTENT.height - TABLE_TITLE_ROW_HEIGHT - measureHeaderHeight(selectedColumns);

  for (const row of rows) {
    if (row.height > continuationRowMaxHeight) {
      if (y < PAGE_CONTENT.top - TABLE_TITLE_ROW_HEIGHT - measureHeaderHeight(selectedColumns)) {
        page = await createTemplatedPage(outputPdf, templatePdf);
        y = drawTableTitle(page, {
          x: PAGE_CONTENT.x,
          y: PAGE_CONTENT.top,
          width: PAGE_CONTENT.width,
          title: eventTitle,
          font: fonts.bold,
        });
        y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold, selectedColumns });
      }

      const segments = splitMeasuredRow(row, continuationRowMaxHeight, columnWidths, selectedColumns);
      for (const [segmentIndex, segment] of segments.entries()) {
        if (segmentIndex > 0) {
          page = await createTemplatedPage(outputPdf, templatePdf);
          y = drawTableTitle(page, {
            x: PAGE_CONTENT.x,
            y: PAGE_CONTENT.top,
            width: PAGE_CONTENT.width,
            title: eventTitle,
            font: fonts.bold,
          });
          y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold, selectedColumns });
        }
        y = drawTableRow(page, { x: PAGE_CONTENT.x, y, columnWidths, row: segment, font: fonts.regular, selectedColumns });
      }
      continue;
    }

    if (y - row.height < PAGE_CONTENT.bottom) {
      page = await createTemplatedPage(outputPdf, templatePdf);
      y = drawTableTitle(page, {
        x: PAGE_CONTENT.x,
        y: PAGE_CONTENT.top,
        width: PAGE_CONTENT.width,
        title: eventTitle,
        font: fonts.bold,
      });
      y = drawTableHeader(page, { x: PAGE_CONTENT.x, y, columnWidths, font: fonts.bold, selectedColumns });
    }
    y = drawTableRow(page, { x: PAGE_CONTENT.x, y, columnWidths, row, font: fonts.regular, selectedColumns });
  }
  return { page, y };
}

export async function generatePdfDocument({ templatePath, eventDate, eventTitle, items, selectedColumns = [], nbPoints = [] }) {
  if (!items?.length) throw new Error("At least one event item is required.");

  const templatePdf = await loadTemplatePdf(templatePath);
  const outputPdf = await PDFDocument.create();
  const fonts = await embedFonts(outputPdf);
  const preparedItems = await embedItemImages(outputPdf, items);

  const firstPage = await renderFirstPageBackground(outputPdf, templatePdf, eventDate);
  const columnWidths = computeColumnWidths(PAGE_CONTENT.width, selectedColumns);
  const rows = measureRows(preparedItems, columnWidths, fonts, selectedColumns);
  const afterTable = await drawTableSection(outputPdf, {
    firstPage,
    templatePdf,
    eventTitle,
    rows,
    fonts,
    columnWidths,
    selectedColumns,
  });
  await renderNbSection(outputPdf, { nbPoints, fonts, templatePdf, page: afterTable.page, y: afterTable.y });

  // The detail/reference section intentionally starts after the table/N.B.
  // and groups content by item: heading once, description once, then images.
  await renderReferenceSection(outputPdf, { items: preparedItems, fonts, templatePdf });

  const bytes = await outputPdf.save();
  return { bytes, pageCount: outputPdf.getPageCount() };
}
