// Copies the immutable letter-pad template's first page into the output
// document and overlays the dynamic event date (guide §9.2, §10, §13-15).
import { StandardFonts, rgb } from "pdf-lib";
import { DATE_FIELD, formatEventDate } from "../config/pdfLayout.js";

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

export async function renderFirstPageBackground(outputPdf, templatePdf, eventDate) {
  const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
  outputPdf.addPage(templatePage);

  const font = await outputPdf.embedFont(StandardFonts.Helvetica);

  // The template prints a static "Date........................" placeholder
  // on this line — mask it, then draw the real value in the same spot so
  // the template file itself never needs editing.
  templatePage.drawRectangle({
    x: DATE_FIELD.x,
    y: DATE_FIELD.y,
    width: DATE_FIELD.maskWidth,
    height: DATE_FIELD.maskHeight,
    color: WHITE,
  });
  templatePage.drawText(`Date: ${formatEventDate(eventDate)}`, {
    x: DATE_FIELD.x,
    y: DATE_FIELD.y + DATE_FIELD.textOffsetY,
    size: DATE_FIELD.fontSize,
    font,
    color: BLACK,
  });

  return templatePage;
}
