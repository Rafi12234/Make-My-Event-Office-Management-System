import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { generatePdfDocument } from "../services/pdfGeneratorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
const { formatDateOnly, formatDateTime } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

const storageRootDirectory = process.env.PDF_GENERATOR_STORAGE_DIR
  ? path.resolve(process.env.PDF_GENERATOR_STORAGE_DIR)
  : path.resolve(__dirname, "../storage");
const sourceImagesDirectory = path.join(storageRootDirectory, "source-images");
const meetingUploadsRootDirectory = process.env.MEETING_UPLOADS_DIR
  ? path.resolve(process.env.MEETING_UPLOADS_DIR)
  : path.resolve(backendSrcDirectory, "../uploads");
const templatePath = process.env.PDF_GENERATOR_TEMPLATE_PATH
  ? path.resolve(process.env.PDF_GENERATOR_TEMPLATE_PATH)
  : path.resolve(__dirname, "../templates/make-my-event-letter-pad.pdf");

mkdirSync(sourceImagesDirectory, { recursive: true });

const ALLOWED_OPTIONAL_COLUMNS = ["price"];
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_NB_LENGTH = 30000;

// Default N.B. text for every new PDF draft. It is copied into each draft,
// so an employee can edit it for one client without changing the default used
// by any other client or future PDF.
const DEFAULT_PDF_NB_TEXT = `1. Payment Terms: 80% of the total agreed amount must be paid as advance for confirmation of the booking and, in any case, no later than 30 days before the event date. The remaining 20% must be paid on the event date before the commencement of the event. The advance payment is non-refundable.
2. Confidentiality: This proposal, including its pricing, designs, concepts, and other commercial information, is strictly confidential and must not be shared, copied, reproduced, or disclosed to any third party without prior written permission from Make My Event. Make My Event reserves the right to take appropriate action in the event of unauthorized disclosure or use.
3. Price & Scope: The quoted price is based on the requirements and specifications mentioned in this proposal. Any additional items, changes, upgrades, quantity increases, design modifications, or services requested by the Client after confirmation may result in additional charges.
4. VAT & AIT: For this event VAT included but AIT is not included in the quoted price and, where applicable, shall be payable by the Client in addition to the stated amount if needed.
5. Rental Materials: All décor items, furniture, structures, artificial flowers, fabrics, props, equipment, and other materials supplied by Make My Event are provided on a rental basis unless specifically stated otherwise. Make My Event retains full ownership of such materials and reserves the right to collect them after completion of the event.
6. Pre-used / Reusable Materials: Fabrics, artificial flowers, props, decorative elements, and other materials may be sourced from Make My Event's existing inventory and may have been previously used. Therefore, these materials may not have the appearance or condition of newly purchased/brand-new materials. Make My Event will ensure that all materials are reasonably maintained and suitable for the intended event setup.
7. Delivery & Setup: Delivery/setup is scheduled according to the agreed timeline. For this event, the scheduled delivery time is 6:30 PM on the event date. The Client acknowledges that unforeseen circumstances, including heavy fog, rain, traffic restrictions, venue access delays, or other circumstances beyond Make My Event's reasonable control, may affect the delivery or setup timeline.
8. Client-Requested Changes: Any changes requested after final confirmation—including changes to design, color, quantity, dimensions, layout, venue, or other specifications—will be subject to availability, feasibility, and additional charges where applicable.
9. Final Confirmation: The booking will be considered confirmed only after receipt of the required advance payment and confirmation of the agreed scope of work.
10. Dismantling & Collection: Make My Event will dismantle and collect its rental materials after the event according to the agreed schedule. The Client/venue shall provide reasonable access for collection and dismantling.`;

const DEFAULT_PDF_NB_POINTS = [DEFAULT_PDF_NB_TEXT];

// Previous default used by old drafts. If a draft still contains exactly this
// untouched default, it is safely upgraded to the new default above.
const LEGACY_DEFAULT_PDF_NB_POINTS = [
  "80% of the total money should be paid in advance/confirmation. Advance is not refundable. The rest of the amount needs to be paid for the event date by 1 PM.",
  "Please do not show this proposal to anyone. It's highly confidential. Make MyEvent has the right to take action on the violation.",
  "Price may change depending on requirements.",
  "VAT is not included in this price.",
  "Items that are being used in the events are rental basis. Make My Event has the fullrights to take everything back after the event.",
  "As most of the materials are reused, these might not be as fresh as the brand-new material",
];

function isValidRowKey(rowKey) {
  return /^[0-9a-fA-F-]{36}$/.test(String(rowKey || ""));
}

function toPositiveBigInt(value) {
  try {
    const id = BigInt(value);
    return id > 0n ? id : null;
  } catch {
    return null;
  }
}

function humanizeItemKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferMimeType(fileName = "") {
  const ext = path.extname(String(fileName)).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".jfif") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return null;
}

function sanitizeSelectedColumns(raw) {
  const values = Array.isArray(raw) ? raw : [];
  return ALLOWED_OPTIONAL_COLUMNS.filter((key) => values.includes(key));
}

function nbTextFromStored(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  if (raw.length === 1) return String(raw[0] ?? "");
  return raw
    .map((value, index) => `${index + 1}. ${String(value ?? "").trim()}`)
    .join("\n");
}

function hasLegacyDefaultNb(raw) {
  return (
    Array.isArray(raw) &&
    raw.length === LEGACY_DEFAULT_PDF_NB_POINTS.length &&
    raw.every((value, index) => String(value ?? "").trim() === LEGACY_DEFAULT_PDF_NB_POINTS[index])
  );
}

function normalizeStoredNbPoints(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || hasLegacyDefaultNb(raw)) {
    return DEFAULT_PDF_NB_POINTS;
  }
  return [nbTextFromStored(raw).slice(0, MAX_NB_LENGTH)];
}

function sanitizeNbPoints(raw) {
  const text = Array.isArray(raw)
    ? nbTextFromStored(raw)
    : String(raw ?? "");
  const normalized = text.replace(/\r\n?/g, "\n").slice(0, MAX_NB_LENGTH);
  return normalized.trim() ? [normalized] : [];
}
function nullableDecimal(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  return text;
}

function serializeDecimal(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function imagePublicUrl(documentId, image) {
  if (String(image.imagePath || "").startsWith("/uploads/")) return image.imagePath;
  return `/api/pdf-generator/documents/${documentId}/images/${image.id}/file`;
}

function serializeItem(documentId, item) {
  return {
    id: String(item.id),
    sourceMeetingItemId: item.sourceMeetingItemId ? String(item.sourceMeetingItemId) : null,
    sortOrder: item.sortOrder,
    itemName: item.itemName,
    description: item.description || "",
    quantity: item.quantity || "1",
    size: item.size || "",
    sqft: serializeDecimal(item.sqft),
    tsqft: serializeDecimal(item.tsqft),
    unit: item.unit || "",
    price: serializeDecimal(item.price),
    customCaption: item.customCaption || "",
    images: (item.images || []).map((image) => ({
      id: String(image.id),
      sourceMeetingImageId: image.sourceMeetingImageId ? String(image.sourceMeetingImageId) : null,
      sortOrder: image.sortOrder,
      originalName: image.originalName || image.storedFileName || "Image",
      mimeType: image.mimeType || inferMimeType(image.originalName || image.storedFileName || image.imagePath),
      fileSizeBytes: image.fileSizeBytes ?? null,
      url: imagePublicUrl(documentId, image),
    })),
  };
}

function serializeDocument(document, { includeItems = false } = {}) {
  const items = document.items || [];
  const photoCount = includeItems
    ? items.reduce((sum, item) => sum + (item.images?.length || 0), 0)
    : undefined;

  const result = {
    id: String(document.id),
    meetingId: document.meetingId ? String(document.meetingId) : null,
    linkedRowKey: document.linkedRowKey || null,
    documentNo: document.documentNo || null,
    sourceMode: document.sourceMode,
    eventDate: formatDateOnly(document.eventDate),
    eventTitle: document.eventTitle,
    selectedColumns: sanitizeSelectedColumns(document.selectedColumns),
    totalPrice: serializeDecimal(document.meeting?.totalPrice),
    nbPoints: normalizeStoredNbPoints(document.nbPoints),
    status: document.status,
    pageCount: document.pageCount ?? null,
    itemCount: includeItems ? items.length : document._count?.items,
    photoCount,
    generatedAt: formatDateTime(document.generatedAt),
    createdAt: formatDateTime(document.createdAt),
    updatedAt: formatDateTime(document.updatedAt),
  };

  if (includeItems) {
    result.items = items.map((item) => serializeItem(document.id, item));
  }
  return result;
}

async function loadOwnedDocument(documentId, employeeId, { includeItems = true } = {}) {
  const id = toPositiveBigInt(documentId);
  if (!id) return null;
  return prisma.pdfDocument.findFirst({
    where: { id, createdById: employeeId },
    include: includeItems
      ? {
          meeting: { select: { totalPrice: true } },
          items: {
            include: { images: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        }
      : {
          meeting: { select: { totalPrice: true } },
        },
  });
}

async function getClientContext(rowKey) {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!sheet) return { clientName: "", eventDate: null };

  const row = await prisma.sheetRow.findFirst({
    where: { sheetId: sheet.id, rowKey },
    select: {
      cells: {
        where: { column: { columnName: { in: ["Client Name", "Event Date"] } } },
        select: {
          valueText: true,
          displayValue: true,
          valueDate: true,
          column: { select: { columnName: true } },
        },
      },
    },
  });

  let clientName = "";
  let eventDate = null;
  for (const cell of row?.cells || []) {
    if (cell.column.columnName === "Client Name") {
      clientName = cell.valueText || cell.displayValue || "";
    } else if (cell.column.columnName === "Event Date") {
      eventDate = cell.valueDate || null;
    }
  }
  return { clientName, eventDate };
}

async function getMeetingSnapshot(rowKey, meetingId) {
  const id = toPositiveBigInt(meetingId);
  if (!id) return null;
  return prisma.clientMeeting.findFirst({
    where: { id, linkedRowKey: rowKey },
    include: {
      items: {
        include: { images: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      },
    },
  });
}

function meetingItemsCreateData(meeting) {
  return meeting.items.map((item, index) => ({
    sortOrder: index,
    sourceMeetingItemId: item.id,
    itemName: item.customLabel?.trim() || humanizeItemKey(item.itemKey) || `Item ${index + 1}`,
    description: item.description || "",
    quantity: String(item.quantity ?? 1),
    size: null,
    sqft: null,
    tsqft: null,
    unit: null,
    // PdfDocumentItem.price is used as the meeting's Item Price snapshot.
    price: item.itemPrice ?? null,
    customCaption: null,
    images: {
      create: item.images.map((image, imageIndex) => ({
        sortOrder: imageIndex,
        sourceMeetingImageId: image.id,
        imagePath: image.fileUrl,
        storedFileName: image.storedFileName,
        originalName: image.originalFileName,
        mimeType: inferMimeType(image.originalFileName) || inferMimeType(image.storedFileName),
        fileSizeBytes: image.fileSizeBytes,
        uploadedById: image.uploadedById,
      })),
    },
  }));
}


function meetingSelectedColumns(meeting) {
  return meeting.items.some(
    (item) => item.itemPrice !== null && item.itemPrice !== undefined,
  )
    ? ["price"]
    : [];
}

async function replaceDocumentWithMeetingSnapshot(document, meeting, employeeId, context = null) {
  await prisma.$transaction(async (tx) => {
    await tx.pdfDocumentItem.deleteMany({ where: { documentId: document.id } });
    for (const data of meetingItemsCreateData(meeting)) {
      await tx.pdfDocumentItem.create({ data: { documentId: document.id, ...data } });
    }
    await tx.pdfDocument.update({
      where: { id: document.id },
      data: {
        sourceMode: "meeting",
        selectedColumns: meetingSelectedColumns(meeting),
        ...(context?.eventDate ? { eventDate: context.eventDate } : {}),
        ...(context?.clientName?.trim() ? { eventTitle: context.clientName.trim() } : {}),
        updatedById: employeeId,
      },
    });
  });
  await rm(path.join(sourceImagesDirectory, `document-${document.id}`), { recursive: true, force: true }).catch(() => {});
}

async function absoluteImagePath(image) {
  const imagePath = String(image.imagePath || "");
  if (imagePath.startsWith("/uploads/")) {
    return path.join(meetingUploadsRootDirectory, imagePath.replace(/^\/uploads\//, ""));
  }
  return path.join(storageRootDirectory, imagePath);
}

async function toRendererItems(document) {
  const rendererItems = [];
  for (const item of document.items || []) {
    const referenceImages = [];
    for (const image of item.images || []) {
      const mimeType = image.mimeType || inferMimeType(image.originalName || image.storedFileName || image.imagePath);
      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        throw new Error(
          `"${image.originalName || "An image"}" is ${mimeType || "an unsupported format"}. PDF generation supports JPG and PNG. Remove it from this PDF and upload a JPG/PNG copy.`,
        );
      }
      const absolutePath = await absoluteImagePath(image);
      if (!existsSync(absolutePath)) {
        throw new Error(`Image file not found: ${image.originalName || image.imagePath}`);
      }
      referenceImages.push({
        bytes: await readFile(absolutePath),
        mimeType,
        originalName: image.originalName,
      });
    }
    rendererItems.push({
      itemName: item.itemName,
      description: item.description || "",
      quantity: item.quantity || "1",
      size: item.size || "",
      sqft: serializeDecimal(item.sqft),
      tsqft: serializeDecimal(item.tsqft),
      unit: item.unit || "",
      price: serializeDecimal(item.price),
      customCaption: item.customCaption || "",
      referenceImages,
    });
  }
  return rendererItems;
}

async function renderOwnedDocument(document) {
  const items = await toRendererItems(document);
  return generatePdfDocument({
    templatePath,
    eventDate: document.eventDate,
    eventTitle: document.eventTitle,
    items,
    selectedColumns: sanitizeSelectedColumns(document.selectedColumns),
    totalPrice: serializeDecimal(document.meeting?.totalPrice),
    nbPoints: normalizeStoredNbPoints(document.nbPoints),
  });
}

export async function ensureMeetingDraft(req, res, next) {
  const { rowKey, meetingId } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const employeeId = BigInt(req.employee.id);

  try {
    const meeting = await getMeetingSnapshot(rowKey, meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });
    if (!meeting.items.length) {
      return res.status(422).json({
        message: "Add at least one item to this meeting before generating a PDF.",
      });
    }

    const context = await getClientContext(rowKey);
    if (!context.eventDate) {
      return res.status(422).json({
        message: "This client does not have an Event Date. Add one in Management before generating the PDF.",
      });
    }

    let document = await prisma.pdfDocument.findFirst({
      where: { meetingId: meeting.id, createdById: employeeId, status: "draft" },
      include: {
        meeting: { select: { totalPrice: true } },
        items: {
          include: { images: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!document) {
      document = await prisma.$transaction(async (tx) => {
        const created = await tx.pdfDocument.create({
          data: {
            meetingId: meeting.id,
            linkedRowKey: rowKey,
            sourceMode: "meeting",
            eventDate: context.eventDate,
            eventTitle: context.clientName?.trim() || "Event Proposal",
            selectedColumns: meetingSelectedColumns(meeting),
            nbPoints: DEFAULT_PDF_NB_POINTS,
            createdById: employeeId,
            updatedById: employeeId,
            status: "draft",
          },
        });

        const documentNo = `MME/${context.eventDate.getUTCFullYear()}/${String(created.id).padStart(6, "0")}`;
        await tx.pdfDocument.update({ where: { id: created.id }, data: { documentNo } });

        for (const data of meetingItemsCreateData(meeting)) {
          await tx.pdfDocumentItem.create({ data: { documentId: created.id, ...data } });
        }

        return tx.pdfDocument.findUnique({
          where: { id: created.id },
          include: {
            meeting: { select: { totalPrice: true } },
            items: {
              include: { images: { orderBy: { sortOrder: "asc" } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        });
      });
    } else {
      const normalizedNbPoints = normalizeStoredNbPoints(document.nbPoints);
      if (JSON.stringify(normalizedNbPoints) !== JSON.stringify(document.nbPoints)) {
        await prisma.pdfDocument.update({
          where: { id: document.id },
          data: { nbPoints: normalizedNbPoints, updatedById: employeeId },
        });
      }

      // PDF content is always a fresh snapshot of the Client Meeting.
      // The per-client N.B. stays untouched.
      await replaceDocumentWithMeetingSnapshot(document, meeting, employeeId, context);
      document = await loadOwnedDocument(document.id, employeeId);
    }

    return res.json({ data: serializeDocument(document, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function resetDraftFromMeeting(req, res, next) {
  const employeeId = BigInt(req.employee.id);

  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") {
      return res.status(409).json({ message: "Only draft documents can be refreshed." });
    }
    if (!document.meetingId || !document.linkedRowKey) {
      return res.status(422).json({ message: "This document is not linked to a Client Meeting." });
    }

    const meeting = await getMeetingSnapshot(document.linkedRowKey, document.meetingId);
    if (!meeting) return res.status(404).json({ message: "The source meeting no longer exists." });
    if (!meeting.items.length) {
      return res.status(422).json({ message: "The source meeting has no items." });
    }

    const context = await getClientContext(document.linkedRowKey);
    await replaceDocumentWithMeetingSnapshot(document, meeting, employeeId, context);

    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function updateDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);

  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") {
      return res.status(409).json({ message: "Only draft documents can be edited." });
    }

    // The PDF table is read-only and always comes from Client Meeting.
    // The only PDF-specific content employees can edit is the N.B. text.
    const nbPoints = sanitizeNbPoints(req.body?.nbPoints);

    await prisma.pdfDocument.update({
      where: { id: document.id },
      data: { nbPoints, updatedById: employeeId },
    });

    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

function pdfContentReadOnly(res) {
  return res.status(409).json({
    message: "PDF items and images are read-only. Make changes in Client Meeting, save the meeting, then return to PDF Generator.",
  });
}

export async function createDocumentItem(req, res) {
  return pdfContentReadOnly(res);
}

export async function deleteDocumentItem(req, res) {
  return pdfContentReadOnly(res);
}

export async function importExcelRows(req, res) {
  return pdfContentReadOnly(res);
}

export async function uploadDocumentItemImage(req, res) {
  return pdfContentReadOnly(res);
}

export async function deleteDocumentItemImage(req, res) {
  return pdfContentReadOnly(res);
}

export async function serveDocumentImage(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    const imageId = toPositiveBigInt(req.params.imageId);
    if (!imageId) return res.status(400).json({ message: "Invalid image reference." });
    const image = await prisma.pdfDocumentItemImage.findFirst({
      where: { id: imageId, documentItem: { documentId: document.id } },
    });
    if (!image) return res.status(404).json({ message: "Image not found." });
    const absolutePath = await absoluteImagePath(image);
    if (!existsSync(absolutePath)) return res.status(404).json({ message: "Image file not found." });
    return res.sendFile(absolutePath);
  } catch (error) {
    return next(error);
  }
}

async function syncDocumentFromMeeting(document, employeeId) {
  if (!document?.meetingId || !document?.linkedRowKey) return document;

  const meeting = await getMeetingSnapshot(document.linkedRowKey, document.meetingId);
  if (!meeting || !meeting.items.length) return document;

  const context = await getClientContext(document.linkedRowKey);
  await replaceDocumentWithMeetingSnapshot(document, meeting, employeeId, context);
  return loadOwnedDocument(document.id, employeeId);
}

export async function previewDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);

  try {
    let document = await loadOwnedDocument(req.params.id, employeeId);
    if (!document) return res.status(404).json({ message: "Document not found." });

    document = await syncDocumentFromMeeting(document, employeeId);
    const { bytes } = await renderOwnedDocument(document);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
}

export async function generateDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);

  try {
    let document = await loadOwnedDocument(req.params.id, employeeId);
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") {
      return res.status(409).json({ message: "Only draft documents can be generated." });
    }

    // Always render the latest saved Client Meeting content. This prevents a
    // stale PDF draft from missing an item that was just added on the meeting page.
    document = await syncDocumentFromMeeting(document, employeeId);

    const { bytes } = await renderOwnedDocument(document);
    const pdfBuffer = Buffer.from(bytes);
    const generatedFileName = `${(
      document.documentNo || `document-${document.id}`
    ).replace(/\//g, "-")}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${generatedFileName}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
}

export async function getDocument(req, res, next) {
  try {
    const document = await loadOwnedDocument(req.params.id, BigInt(req.employee.id));
    if (!document) return res.status(404).json({ message: "Document not found." });
    return res.json({ data: serializeDocument(document, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}
