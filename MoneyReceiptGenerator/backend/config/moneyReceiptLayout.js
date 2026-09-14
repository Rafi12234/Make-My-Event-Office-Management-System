// Layout + typography constants for the Money Receipt Generator (Admin-only
// official payment receipts). The receipt is now rendered on the SAME
// Make My Event letterhead template used by the PDF Generator module (own
// local copy under templates/, kept module-isolated — no cross-import),
// instead of a blank page + a separately-embedded logo image.
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Safe content box INSIDE the letterhead's border/logo/address artwork —
// identical calibrated values to PDFGenerator/backend/config/pdfLayout.js's
// PAGE_CONTENT (measured from the real docx template's margins), since both
// modules render onto the exact same letterhead file.
export const PAGE_CONTENT = {
  x: 74,
  right: 562,
  top: 546,
  bottom: 92,
};
PAGE_CONTENT.width = PAGE_CONTENT.right - PAGE_CONTENT.x;

// The template prints a static "Date........................" placeholder
// near the address block — masked with a white rectangle then overlaid with
// the real receipt date, same technique/coordinates as PDFGenerator's
// firstPageRenderer.js (same template file, same placeholder position).
export const DATE_FIELD = {
  x: 460,
  y: 590,
  maskWidth: 102,
  maskHeight: 48,
  fontSize: 10,
  textOffsetY: 28,
};

export const TEMPLATE_PATH = process.env.MONEY_RECEIPT_TEMPLATE_PATH
  ? path.resolve(process.env.MONEY_RECEIPT_TEMPLATE_PATH)
  : path.resolve(__dirname, "../templates/make-my-event-letter-pad.pdf");

export async function loadTemplatePdf(templatePath) {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(templatePath);
  return PDFDocument.load(bytes);
}

// Copies the template's letterhead page into the output document — every
// receipt is exactly one page, so this is only ever called once per receipt,
// but shares the exact mechanism PDFGenerator uses for consistency.
export async function createTemplatedPage(outputPdf, templatePdf) {
  const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
  outputPdf.addPage(templatePage);
  return templatePage;
}

export const COLORS = {
  black: { r: 0.06, g: 0.06, b: 0.09 },
  white: { r: 1, g: 1, b: 1 },
  gray: { r: 0.42, g: 0.42, b: 0.46 },
  lightGray: { r: 0.62, g: 0.62, b: 0.66 },
  border: { r: 0.82, g: 0.82, b: 0.85 },
  accent: { r: 0.42, g: 0.24, b: 0.64 }, // matches admin portal's mme-purple accent
  paidGreen: { r: 0.02, g: 0.45, b: 0.31 },
  paidGreenBg: { r: 0.85, g: 0.96, b: 0.9 },
  dueRed: { r: 0.72, g: 0.11, b: 0.11 },
  dueRedBg: { r: 0.99, g: 0.9, b: 0.9 },
  partialAmber: { r: 0.6, g: 0.4, b: 0.02 },
  partialAmberBg: { r: 1, g: 0.96, b: 0.85 },
};


export const FONT_SIZES = {
  title: 18,
  subtitle: 10.5,
  sectionHeading: 10.5,
  label: 9,
  value: 10,
  statusBadge: 11,
  footer: 8.5,
};

export const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Card",
  other: "Other",
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: "UNPAID",
  partially_paid: "PARTIALLY PAID",
  paid: "PAID",
};

// Fixed terms & conditions, always rendered as page 2 of every receipt (not
// user-editable — unlike PDFGenerator's optional per-document nbPoints list).
export const MONEY_RECEIPT_NB_POINTS = [
  "80% of the total money should be paid in advance/confirmation. Advance is not refundable. The rest of the amount needs to be paid for the event date by 1 PM.",
  "Please do not show this proposal to anyone. It's highly confidential. Make My Event has the right to take action on the violation.",
  "Price may change depending on requirements.",
  "VAT is not included in this price.",
  "Items that are being used in the events are rental basis. Make My Event has the full rights to take everything back after the event.",
  "As most of the materials are reused, these might not be as fresh as the brand-new material.",
];

// guide-style DD/MM/YY display convention, matches the PDF Generator module.
export function formatReceiptDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
