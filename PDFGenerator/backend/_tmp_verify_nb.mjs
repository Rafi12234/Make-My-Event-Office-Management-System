import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePdfDocument } from "./services/pdfGeneratorService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, "templates/make-my-event-letter-pad.pdf");

const items = [
  { itemName: "Platform", description: "Platform for the stage", quantity: "1", customCaption: null, referenceImages: [] },
  { itemName: "Platform Printing", description: "Platform Base printing, as per choice", quantity: "1", customCaption: null, referenceImages: [] },
  { itemName: "Stage", description: "As per picture, Flower: White & Peach, Back Printing: Whiteish printing & as per customers choice", quantity: "1", customCaption: null, referenceImages: [] },
  { itemName: "Welcome Banner", description: "As per customers choice", quantity: "2", customCaption: null, referenceImages: [] },
];

const nbPoints = [
  "80% of the total money should be paid in advance/confirmation. The rest of the amount needs to be paid for the event date by 1 PM.",
  "Please do not show this proposal to anyone. It's highly confidential. Make MyEvent has the right to take action on the violation.",
  "Price may change depending on requirements.",
  "VAT is not included in this price.",
  "Items that are being used in the events are rental basis. Make My Event has the fullrights to take everything back after the event.",
  "As most of the materials are reused, these might not be as fresh as the brand-new material",
];

const { bytes, pageCount } = await generatePdfDocument({
  templatePath,
  eventDate: new Date("2026-09-30"),
  eventTitle: "Grand Hall, Sena Prangan, 600 Guests",
  items,
  nbPoints,
});

await writeFile(path.join(__dirname, "storage/generated/_tmp_verify_nb.pdf"), Buffer.from(bytes));
console.log("pageCount:", pageCount);
