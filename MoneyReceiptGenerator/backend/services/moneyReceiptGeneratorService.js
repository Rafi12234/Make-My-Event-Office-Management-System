// Orchestrates Money Receipt PDF generation: load the immutable Make My
// Event letterhead template, embed fonts, delegate drawing to
// receiptRenderer.js, return the PDF bytes. Single entry point used by BOTH
// preview and final generation (guide-style "preview and final use the same
// renderer" convention from the PDF Generator module).
//
// Guarantees exactly ONE page: renders once at full scale, and if the
// content overflowed the page's bottom margin, discards that page and
// re-renders at a computed smaller scale (body text/spacing only) that's
// guaranteed to fit.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PAGE_CONTENT, TEMPLATE_PATH, loadTemplatePdf, createTemplatedPage } from "../config/moneyReceiptLayout.js";
import { renderReceiptContent } from "./receiptRenderer.js";

const MIN_SCALE = 0.55;

async function embedFonts(pdfDoc) {
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  };
}

export async function generateMoneyReceiptPdf({ receiptNo, receiptDate, client, event, payment, remarks }) {
  const templatePdf = await loadTemplatePdf(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const data = { receiptNo, receiptDate, client, event, payment, remarks };

  let page = await createTemplatedPage(pdfDoc, templatePdf);
  let { finalY } = renderReceiptContent(page, { fonts, data, scale: 1 });

  if (finalY < PAGE_CONTENT.bottom) {
    // Overflowed — remove that page and redraw at a scale guaranteed to fit.
    const overflow = PAGE_CONTENT.bottom - finalY;
    const availableHeight = PAGE_CONTENT.top - PAGE_CONTENT.bottom;
    const naturalHeight = availableHeight + overflow;
    const scale = Math.max(MIN_SCALE, availableHeight / naturalHeight);

    pdfDoc.removePage(0);
    page = await createTemplatedPage(pdfDoc, templatePdf);
    renderReceiptContent(page, { fonts, data, scale });
  }

  const bytes = await pdfDoc.save();
  return { bytes, pageCount: pdfDoc.getPageCount() };
}


