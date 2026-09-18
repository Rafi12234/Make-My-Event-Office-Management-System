import path from "node:path";
import crypto from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rm, unlink, writeFile } from "node:fs/promises";
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
const { formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

const storageRootDirectory = process.env.PDF_GENERATOR_STORAGE_DIR
  ? path.resolve(process.env.PDF_GENERATOR_STORAGE_DIR)
  : path.resolve(__dirname, "../storage");
const generatedDirectory = path.join(storageRootDirectory, "generated");
const sourceImagesDirectory = path.join(storageRootDirectory, "source-images");
const meetingUploadsRootDirectory = process.env.MEETING_UPLOADS_DIR
  ? path.resolve(process.env.MEETING_UPLOADS_DIR)
  : path.resolve(backendSrcDirectory, "../uploads");
const templatePath = process.env.PDF_GENERATOR_TEMPLATE_PATH
  ? path.resolve(process.env.PDF_GENERATOR_TEMPLATE_PATH)
  : path.resolve(__dirname, "../templates/make-my-event-letter-pad.pdf");

mkdirSync(generatedDirectory, { recursive: true });
mkdirSync(sourceImagesDirectory, { recursive: true });

const ALLOWED_OPTIONAL_COLUMNS = ["size", "sqft", "tsqft", "unit", "price"];
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_ITEMS = 250;
const MAX_IMAGES_PER_ITEM = 20;
const MAX_NB_POINTS = 30;

// Default proposal terms shown immediately after the PDF summary table.
// They are seeded into new meeting-linked PDF drafts, and also backfilled
// into an existing draft when that draft currently has no N.B. points.
const DEFAULT_PDF_NB_POINTS = [
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

function sanitizeNbPoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_NB_POINTS);
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
    nbPoints: Array.isArray(document.nbPoints) ? document.nbPoints : [],
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
          items: {
            include: { images: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        }
      : undefined,
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
    price: null,
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

async function replaceDocumentWithMeetingSnapshot(document, meeting, employeeId) {
  await prisma.$transaction(async (tx) => {
    await tx.pdfDocumentItem.deleteMany({ where: { documentId: document.id } });
    for (const data of meetingItemsCreateData(meeting)) {
      await tx.pdfDocumentItem.create({ data: { documentId: document.id, ...data } });
    }
    await tx.pdfDocument.update({
      where: { id: document.id },
      data: {
        sourceMode: "meeting",
        selectedColumns: [],
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
    nbPoints: Array.isArray(document.nbPoints) ? document.nbPoints : [],
  });
}

export async function ensureMeetingDraft(req, res, next) {
  const { rowKey, meetingId } = req.params;
  if (!isValidRowKey(rowKey)) return res.status(400).json({ message: "Invalid client reference." });
  const employeeId = BigInt(req.employee.id);

  try {
    const meeting = await getMeetingSnapshot(rowKey, meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });
    if (!meeting.items.length) return res.status(422).json({ message: "Add at least one item to this meeting before generating a PDF." });

    let document = await prisma.pdfDocument.findFirst({
      where: { meetingId: meeting.id, createdById: employeeId, status: "draft" },
      include: {
        items: { include: { images: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (document && (!Array.isArray(document.nbPoints) || document.nbPoints.length === 0)) {
      document = await prisma.pdfDocument.update({
        where: { id: document.id },
        data: { nbPoints: DEFAULT_PDF_NB_POINTS, updatedById: employeeId },
        include: {
          items: { include: { images: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
        },
      });
    }

    if (!document) {
      const context = await getClientContext(rowKey);
      const eventDate = context.eventDate;
      if (!eventDate) return res.status(422).json({ message: "This client does not have an Event Date. Add one in Management before generating the PDF." });

      document = await prisma.$transaction(async (tx) => {
        const created = await tx.pdfDocument.create({
          data: {
            meetingId: meeting.id,
            linkedRowKey: rowKey,
            sourceMode: "meeting",
            eventDate,
            eventTitle: context.clientName?.trim() || "Event Proposal",
            selectedColumns: [],
            nbPoints: DEFAULT_PDF_NB_POINTS,
            createdById: employeeId,
            updatedById: employeeId,
            status: "draft",
          },
        });
        const documentNo = `MME/${eventDate.getUTCFullYear()}/${String(created.id).padStart(6, "0")}`;
        await tx.pdfDocument.update({ where: { id: created.id }, data: { documentNo } });
        for (const data of meetingItemsCreateData(meeting)) {
          await tx.pdfDocumentItem.create({ data: { documentId: created.id, ...data } });
        }
        return tx.pdfDocument.findUnique({
          where: { id: created.id },
          include: { items: { include: { images: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
        });
      });
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
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be reset." });
    if (!document.meetingId || !document.linkedRowKey) return res.status(422).json({ message: "This document is not linked to a Client Meeting." });

    const meeting = await getMeetingSnapshot(document.linkedRowKey, document.meetingId);
    if (!meeting) return res.status(404).json({ message: "The source meeting no longer exists." });
    if (!meeting.items.length) return res.status(422).json({ message: "The source meeting has no items." });

    await replaceDocumentWithMeetingSnapshot(document, meeting, employeeId);
    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function updateDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId);
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be edited." });

    const eventDate = parseDateOnly(String(req.body?.eventDate || "").slice(0, 10));
    const eventTitle = String(req.body?.eventTitle || "").trim();
    const selectedColumns = sanitizeSelectedColumns(req.body?.selectedColumns);
    const nbPoints = sanitizeNbPoints(req.body?.nbPoints);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!eventDate) return res.status(422).json({ message: "A valid event date is required." });
    if (!eventTitle) return res.status(422).json({ message: "Event title is required." });
    if (!items.length || items.length > MAX_ITEMS) return res.status(422).json({ message: `A PDF must contain between 1 and ${MAX_ITEMS} items.` });

    const existingIds = new Set(document.items.map((item) => String(item.id)));
    const seenIds = new Set();
    const normalized = [];

    for (const [index, raw] of items.entries()) {
      const id = String(raw?.id || "");
      if (!existingIds.has(id) || seenIds.has(id)) return res.status(422).json({ message: `Invalid PDF item at row ${index + 1}.` });
      seenIds.add(id);
      const itemName = String(raw?.itemName || "").trim();
      const quantity = String(raw?.quantity ?? "").trim();
      if (!itemName || !quantity) return res.status(422).json({ message: `Item and QTY are required in row ${index + 1}.` });

      const sqft = nullableDecimal(raw?.sqft);
      const tsqft = nullableDecimal(raw?.tsqft);
      const price = nullableDecimal(raw?.price);
      if (sqft === undefined || tsqft === undefined || price === undefined) {
        return res.status(422).json({ message: `SQFT, TSqft and Price must be valid numbers in row ${index + 1}.` });
      }

      normalized.push({
        id: BigInt(id),
        sortOrder: index,
        itemName: itemName.slice(0, 255),
        description: String(raw?.description || "").trim(),
        quantity: quantity.slice(0, 100),
        size: String(raw?.size || "").trim().slice(0, 120) || null,
        sqft,
        tsqft,
        unit: String(raw?.unit || "").trim().slice(0, 80) || null,
        price,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pdfDocument.update({
        where: { id: document.id },
        data: { eventDate, eventTitle, selectedColumns, nbPoints, updatedById: employeeId },
      });
      for (const item of normalized) {
        await tx.pdfDocumentItem.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            size: item.size,
            sqft: item.sqft,
            tsqft: item.tsqft,
            unit: item.unit,
            price: item.price,
          },
        });
      }
    });

    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}


export async function createDocumentItem(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be edited." });

    const itemCount = await prisma.pdfDocumentItem.count({ where: { documentId: document.id } });
    if (itemCount >= MAX_ITEMS) {
      return res.status(422).json({ message: `A PDF can contain at most ${MAX_ITEMS} items.` });
    }

    const itemName = String(req.body?.itemName || "").trim();
    if (!itemName) return res.status(422).json({ message: "Choose an item before adding it." });

    const lastItem = await prisma.pdfDocumentItem.findFirst({
      where: { documentId: document.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.pdfDocumentItem.create({
        data: {
          documentId: document.id,
          sourceMeetingItemId: null,
          sortOrder: (lastItem?.sortOrder ?? -1) + 1,
          itemName: itemName.slice(0, 255),
          description: "",
          quantity: "1",
          size: null,
          sqft: null,
          tsqft: null,
          unit: null,
          price: null,
        },
      });
      await tx.pdfDocument.update({
        where: { id: document.id },
        data: { updatedById: employeeId },
      });
    });

    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.status(201).json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function deleteDocumentItem(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be edited." });

    const itemId = toPositiveBigInt(req.params.itemId);
    if (!itemId) return res.status(400).json({ message: "Invalid PDF item." });

    const item = await prisma.pdfDocumentItem.findFirst({
      where: { id: itemId, documentId: document.id },
      include: { images: true },
    });
    if (!item) return res.status(404).json({ message: "PDF item not found." });

    const itemCount = await prisma.pdfDocumentItem.count({ where: { documentId: document.id } });
    if (itemCount <= 1) return res.status(422).json({ message: "A PDF must contain at least one item." });

    await prisma.$transaction(async (tx) => {
      await tx.pdfDocumentItem.delete({ where: { id: item.id } });
      const remaining = await tx.pdfDocumentItem.findMany({
        where: { documentId: document.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      });
      for (const [index, row] of remaining.entries()) {
        if (row.sortOrder !== index) {
          await tx.pdfDocumentItem.update({ where: { id: row.id }, data: { sortOrder: index } });
        }
      }
      await tx.pdfDocument.update({
        where: { id: document.id },
        data: { updatedById: employeeId },
      });
    });

    for (const image of item.images || []) {
      if (!String(image.imagePath || "").startsWith("/uploads/")) {
        await unlink(path.join(storageRootDirectory, image.imagePath)).catch(() => {});
      }
    }

    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function importExcelRows(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  let importId = null;
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can import Excel data." });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length || rows.length > MAX_ITEMS) return res.status(422).json({ message: `Excel must contain between 1 and ${MAX_ITEMS} data rows.` });
    const originalFileName = String(req.body?.originalFileName || "").trim().slice(0, 255);
    if (!originalFileName) return res.status(422).json({ message: "Excel file name is required." });

    const selectedColumns = sanitizeSelectedColumns(req.body?.selectedColumns);
    const normalizedRows = [];
    for (const [index, row] of rows.entries()) {
      const itemName = String(row?.itemName || "").trim();
      const quantity = String(row?.quantity ?? "1").trim() || "1";
      if (!itemName) return res.status(422).json({ message: `Excel row ${index + 2} does not contain an Item value.` });
      const sqft = nullableDecimal(row?.sqft);
      const tsqft = nullableDecimal(row?.tsqft);
      const price = nullableDecimal(row?.price);
      if (sqft === undefined || tsqft === undefined || price === undefined) {
        return res.status(422).json({ message: `Excel row ${index + 2} contains an invalid numeric value.` });
      }
      normalizedRows.push({
        sortOrder: index,
        itemName: itemName.slice(0, 255),
        description: String(row?.description || "").trim(),
        quantity: quantity.slice(0, 100),
        size: String(row?.size || "").trim().slice(0, 120) || null,
        sqft,
        tsqft,
        unit: String(row?.unit || "").trim().slice(0, 80) || null,
        price,
      });
    }

    const imported = await prisma.$transaction(async (tx) => {
      const log = await tx.pdfDocumentImport.create({
        data: {
          documentId: document.id,
          importedById: employeeId,
          originalFileName,
          selectedSheetName: String(req.body?.sheetName || "").trim().slice(0, 255) || null,
          status: "processing",
          totalRows: normalizedRows.length,
          detectedHeaders: Array.isArray(req.body?.detectedHeaders) ? req.body.detectedHeaders : null,
          columnMapping: req.body?.columnMapping && typeof req.body.columnMapping === "object" ? req.body.columnMapping : null,
        },
      });
      importId = log.id;

      await tx.pdfDocumentItem.deleteMany({ where: { documentId: document.id } });
      for (const row of normalizedRows) {
        await tx.pdfDocumentItem.create({ data: { documentId: document.id, ...row } });
      }
      await tx.pdfDocument.update({
        where: { id: document.id },
        data: { sourceMode: "excel", selectedColumns, updatedById: employeeId },
      });
      await tx.pdfDocumentImport.update({
        where: { id: log.id },
        data: { status: "completed", importedRows: normalizedRows.length, failedRows: 0 },
      });
      return log;
    });

    await rm(path.join(sourceImagesDirectory, `document-${document.id}`), { recursive: true, force: true }).catch(() => {});
    const reloaded = await loadOwnedDocument(document.id, employeeId);
    return res.json({ data: serializeDocument(reloaded, { includeItems: true }), importId: String(imported.id) });
  } catch (error) {
    if (importId) {
      await prisma.pdfDocumentImport.update({
        where: { id: importId },
        data: { status: "failed", errorMessage: String(error.message || error).slice(0, 5000) },
      }).catch(() => {});
    }
    return next(error);
  }
}

export async function uploadDocumentItemImage(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    if (!req.file) return res.status(422).json({ message: "Choose a JPG or PNG image." });
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be edited." });

    const itemId = toPositiveBigInt(req.params.itemId);
    if (!itemId) return res.status(400).json({ message: "Invalid PDF item." });
    const item = await prisma.pdfDocumentItem.findFirst({
      where: { id: itemId, documentId: document.id },
      include: { images: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 } },
    });
    if (!item) return res.status(404).json({ message: "PDF item not found." });
    const count = await prisma.pdfDocumentItemImage.count({ where: { documentItemId: item.id } });
    if (count >= MAX_IMAGES_PER_ITEM) return res.status(422).json({ message: `An item can contain at most ${MAX_IMAGES_PER_ITEM} images.` });

    const extension = req.file.mimetype === "image/png" ? ".png" : ".jpg";
    const storedFileName = `${crypto.randomUUID()}${extension}`;
    const relativePath = path.posix.join("source-images", `document-${document.id}`, storedFileName);
    const absolutePath = path.join(storageRootDirectory, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, req.file.buffer);

    const created = await prisma.pdfDocumentItemImage.create({
      data: {
        documentItemId: item.id,
        sortOrder: (item.images[0]?.sortOrder ?? -1) + 1,
        imagePath: relativePath,
        storedFileName,
        originalName: req.file.originalname || null,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
        uploadedById: employeeId,
      },
    });

    return res.status(201).json({
      data: {
        id: String(created.id),
        sourceMeetingImageId: null,
        sortOrder: created.sortOrder,
        originalName: created.originalName || created.storedFileName || "Image",
        mimeType: created.mimeType,
        fileSizeBytes: created.fileSizeBytes,
        url: imagePublicUrl(document.id, created),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteDocumentItemImage(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "Only draft documents can be edited." });
    const imageId = toPositiveBigInt(req.params.imageId);
    const itemId = toPositiveBigInt(req.params.itemId);
    if (!imageId || !itemId) return res.status(400).json({ message: "Invalid image reference." });

    const image = await prisma.pdfDocumentItemImage.findFirst({
      where: { id: imageId, documentItemId: itemId, documentItem: { documentId: document.id } },
    });
    if (!image) return res.status(404).json({ message: "Image not found." });

    await prisma.$transaction(async (tx) => {
      await tx.pdfDocumentItemImage.delete({ where: { id: image.id } });
      const remaining = await tx.pdfDocumentItemImage.findMany({
        where: { documentItemId: itemId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      });
      for (const [index, row] of remaining.entries()) {
        if (index !== row.sortOrder) {
          await tx.pdfDocumentItemImage.update({ where: { id: row.id }, data: { sortOrder: index } });
        }
      }
    });

    if (!String(image.imagePath).startsWith("/uploads/")) {
      await unlink(path.join(storageRootDirectory, image.imagePath)).catch(() => {});
    }
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
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

export async function previewDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId);
    if (!document) return res.status(404).json({ message: "Document not found." });
    const { bytes } = await renderOwnedDocument(document);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="preview.pdf"' });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
}

export async function generateDocument(req, res, next) {
  const employeeId = BigInt(req.employee.id);
  try {
    const document = await loadOwnedDocument(req.params.id, employeeId);
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (document.status !== "draft") return res.status(409).json({ message: "This document has already been generated." });

    const { bytes, pageCount } = await renderOwnedDocument(document);
    const generatedFileName = `${(document.documentNo || `document-${document.id}`).replace(/\//g, "-")}.pdf`;
    await writeFile(path.join(generatedDirectory, generatedFileName), Buffer.from(bytes));

    const updated = await prisma.pdfDocument.update({
      where: { id: document.id },
      data: {
        generatedFileName,
        generatedFilePath: path.posix.join("generated", generatedFileName),
        pageCount,
        generatedAt: new Date(),
        status: "generated",
        updatedById: employeeId,
      },
      include: { items: { include: { images: true }, orderBy: { sortOrder: "asc" } } },
    });
    return res.json({ data: serializeDocument(updated, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const documents = await prisma.pdfDocument.findMany({
      where: { createdById: employeeId, status: { in: ["generated", "archived"] } },
      include: { items: { include: { images: { select: { id: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: documents.map((document) => serializeDocument(document, { includeItems: true })) });
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

export async function downloadDocument(req, res, next) {
  try {
    const document = await loadOwnedDocument(req.params.id, BigInt(req.employee.id), { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    if (!document.generatedFilePath) return res.status(404).json({ message: "This document has not been generated yet." });
    const absolutePath = path.join(storageRootDirectory, document.generatedFilePath);
    if (!existsSync(absolutePath)) return res.status(404).json({ message: "The generated PDF file could not be found." });
    return res.download(absolutePath, document.generatedFileName || "document.pdf");
  } catch (error) {
    return next(error);
  }
}

export async function archiveDocument(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const document = await loadOwnedDocument(req.params.id, employeeId, { includeItems: false });
    if (!document) return res.status(404).json({ message: "Document not found." });
    const updated = await prisma.pdfDocument.update({
      where: { id: document.id },
      data: { status: "archived", updatedById: employeeId },
      include: { items: { include: { images: true }, orderBy: { sortOrder: "asc" } } },
    });
    return res.json({ data: serializeDocument(updated, { includeItems: true }) });
  } catch (error) {
    return next(error);
  }
}
