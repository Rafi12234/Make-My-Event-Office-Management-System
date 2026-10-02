import {
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  DATE_FIELD,
  formatEventDate,
  createTemplatedPage,
} from "../config/pdfLayout.js";

const BLACK = rgb(0, 0, 0);

export async function renderFirstPageBackground(
  outputPdf,
  templatePdf,
  eventDate,
) {
  const templatePage =
    await createTemplatedPage(
      outputPdf,
      templatePdf,
    );

  const font =
    await outputPdf.embedFont(
      StandardFonts.Helvetica,
    );

  // New letterhead contains no printed Date placeholder,
  // so do NOT draw the old white masking rectangle.
  templatePage.drawText(
    `Date: ${formatEventDate(
      eventDate,
    )}`,
    {
      x: DATE_FIELD.x,
      y: DATE_FIELD.y,
      size:
        DATE_FIELD.fontSize,
      font,
      color: BLACK,
    },
  );

  return templatePage;
}