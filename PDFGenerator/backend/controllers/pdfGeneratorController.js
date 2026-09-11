// PDF Generator module — HTTP layer (guide §51). Business logic here is
// deliberately thin: validate the request, delegate PDF drawing to
// services/pdfGeneratorService.js, and persist via Prisma. Mirrors
// Accounts/backend/controllers/accountsController.js's conventions
// (BigInt ids stringified for JSON, res.status(422) for validation errors,
// try/catch + next(error) for anything unexpected).
import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { generatePdfDocument } from "../services/pdfGeneratorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main backend project's src/ — see Accounts/backend/controllers/
// accountsController.js for why this is resolved via BACKEND_SRC_DIR
// (production's directory layout doesn't mirror this repo's nesting) with
// a local-dev fallback, loaded via require() to avoid top-level await.
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
const { formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

/*
|--------------------------------------------------------------------------
| Storage paths
|--------------------------------------------------------------------------
|
| PDF_GENERATOR_STORAGE_DIR/PDF_GENERATOR_TEMPLATE_PATH override these in
| production (see .env.example), same idea as ACCOUNTS_BACKEND_DIR — local
| dev falls back to the real repo-relative paths.
*/

const storageRootDirectory = process.env.PDF_GENERATOR_STORAGE_DIR
  ? path.resolve(process.env.PDF_GENERATOR_STORAGE_DIR)
  : path.resolve(__dirname, "../storage");

const generatedDirectory = path.join(storageRootDirectory, "generated");
const sourceImagesDirectory = path.join(storageRootDirectory, "source-images");

mkdirSync(generatedDirectory, { recursive: true });
mkdirSync(sourceImagesDirectory, { recursive: true });

const templatePath = process.env.PDF_GENERATOR_TEMPLATE_PATH
  ? path.resolve(process.env.PDF_GENERATOR_TEMPLATE_PATH)
  : path.resolve(__dirname, "../templates/make-my-event-letter-pad.pdf");

const ALLOWED_IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const MAX_ITEMS = 50;
const MAX_IMAGES_PER_ITEM = 10;

/*
|--------------------------------------------------------------------------
| Shared request parsing/validation
|--------------------------------------------------------------------------
|
| multipart/form-data body: a "document" field (JSON string: { eventDate,
| eventTitle, items: [{ itemName, description, quantity, customCaption,
| imageKey }] }) plus zero or more files. An item's photos all share the
| SAME field name (its imageKey) — multer collects repeated field names as
| multiple entries, so one item can carry many reference photos.
*/
function parseDocumentPayload(req) {
  let payload;
  try {
    payload = JSON.parse(req.body?.document || "{}");
  } catch {
    return { error: "Invalid request — could not parse document data." };
  }

  const { eventDate, eventTitle, items } = payload;

  if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
    return { error: "A valid event date is required." };
  }
  if (!eventTitle || !String(eventTitle).trim()) {
    return { error: "Event title is required." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Add at least one event item." };
  }
  if (items.length > MAX_ITEMS) {
    return { error: `A document can have at most ${MAX_ITEMS} items.` };
  }

  const filesByFieldName = new Map();
  for (const file of req.files || []) {
    if (!filesByFieldName.has(file.fieldname)) filesByFieldName.set(file.fieldname, []);
    filesByFieldName.get(file.fieldname).push(file);
  }

  const parsedItems = [];
  for (const [index, rawItem] of items.entries()) {
    const itemName = String(rawItem?.itemName || "").trim();
    const description = String(rawItem?.description || "").trim();
    const quantity = String(rawItem?.quantity ?? "").trim();

    if (!itemName || !description || !quantity) {
      return { error: `Item ${index + 1} is missing required fields (item, description, or quantity).` };
    }

    let imageFiles = [];
    if (rawItem?.imageKey) {
      imageFiles = filesByFieldName.get(rawItem.imageKey) || [];
      if (imageFiles.length === 0) {
        return { error: `Item ${index + 1}'s reference photos were not received. Please re-attach them.` };
      }
      if (imageFiles.length > MAX_IMAGES_PER_ITEM) {
        return { error: `Item ${index + 1} can have at most ${MAX_IMAGES_PER_ITEM} reference photos.` };
      }
      if (imageFiles.some((file) => !ALLOWED_IMAGE_EXTENSIONS[file.mimetype])) {
        return { error: "Only JPG, JPEG and PNG reference images are supported." };
      }
    }

    parsedItems.push({
      itemName,
      description,
      quantity,
      customCaption: rawItem?.customCaption ? String(rawItem.customCaption).trim() : null,
      imageFiles,
    });
  }

  return {
    data: {
      eventDate: parseDateOnly(String(eventDate).slice(0, 10)),
      eventTitle: eventTitle.trim(),
      items: parsedItems,
    },
  };
}

function toRendererItems(items) {
  return items.map((item) => ({
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    customCaption: item.customCaption,
    referenceImages: item.imageFiles.map((file) => ({ bytes: file.buffer, mimeType: file.mimetype })),
  }));
}

function serializeDocument(document) {
  const photoCount = document.items?.reduce((sum, item) => sum + (item.images?.length ?? 0), 0);
  return {
    id: String(document.id),
    documentNo: document.documentNo,
    eventDate: formatDateOnly(document.eventDate),
    eventTitle: document.eventTitle,
    status: document.status,
    pageCount: document.pageCount,
    itemCount: document.items?.length ?? document._count?.items ?? undefined,
    photoCount: document.items ? photoCount : undefined,
    generatedAt: formatDateTime(document.generatedAt),
    createdAt: formatDateTime(document.createdAt),
  };
}

/*
|--------------------------------------------------------------------------
| POST /api/pdf-generator/preview
|--------------------------------------------------------------------------
|
| Renders with the exact same renderer as final generation (guide §48), but
| never touches the database or persistent storage.
*/
export async function previewDocument(req, res, next) {
  try {
    const parsed = parseDocumentPayload(req);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const { bytes } = await generatePdfDocument({
      templatePath,
      eventDate: parsed.data.eventDate,
      eventTitle: parsed.data.eventTitle,
      items: toRendererItems(parsed.data.items),
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/pdf-generator/documents
|--------------------------------------------------------------------------
*/
export async function createDocument(req, res, next) {
  let createdDocumentId = null;

  try {
    const parsed = parseDocumentPayload(req);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const employeeId = BigInt(req.employee.id);
    const { eventDate, eventTitle, items } = parsed.data;

    // 1. Create the DB rows first (guide §85) — MySQL allocates the
    // autoincrement id immediately, even before the transaction commits, so
    // it's safe to use `document.id` for the source-image folder name below.
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.pdfDocument.create({
        data: { eventDate, eventTitle, createdById: employeeId, status: "draft" },
      });

      const year = eventDate.getUTCFullYear();
      const documentNo = `MME/${year}/${String(doc.id).padStart(6, "0")}`;
      await tx.pdfDocument.update({
        where: { id: doc.id },
        data: { documentNo },
      });
      doc.documentNo = documentNo;

      await Promise.all(
        items.map((item, index) =>
          tx.pdfDocumentItem.create({
            data: {
              documentId: doc.id,
              sortOrder: index,
              itemName: item.itemName,
              description: item.description,
              quantity: item.quantity,
              customCaption: item.customCaption,
              images: {
                create: item.imageFiles.map((file, imageIndex) => ({
                  sortOrder: imageIndex,
                  imagePath: path.join(
                    "source-images",
                    `document-${doc.id}`,
                    `item-${index + 1}-${imageIndex + 1}-${crypto.randomUUID()}${ALLOWED_IMAGE_EXTENSIONS[file.mimetype]}`,
                  ),
                  originalName: file.originalname || null,
                  mimeType: file.mimetype,
                })),
              },
            },
          }),
        ),
      );

      return doc;
    });

    createdDocumentId = document.id;

    // 2. Persist source images to disk now that we know the document id
    // (guide §73 — kept for future editing/regeneration/history integrity).
    const dbItems = await prisma.pdfDocumentItem.findMany({
      where: { documentId: document.id },
      orderBy: { sortOrder: "asc" },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    await Promise.all(
      items.flatMap((item, index) =>
        item.imageFiles.map(async (file, imageIndex) => {
          const relativePath = dbItems[index].images[imageIndex].imagePath;
          const absolutePath = path.join(storageRootDirectory, relativePath);
          mkdirSync(path.dirname(absolutePath), { recursive: true });
          await writeFile(absolutePath, file.buffer);
        }),
      ),
    );

    // 3. Generate the PDF from the in-memory image buffers (guide §48 — the
    // exact same renderer preview used, so what employees saw is what they get).
    const { bytes, pageCount } = await generatePdfDocument({
      templatePath,
      eventDate,
      eventTitle,
      items: toRendererItems(items),
    });

    const generatedFileName = `${document.documentNo?.replace(/\//g, "-") || `document-${document.id}`}.pdf`;
    await writeFile(path.join(generatedDirectory, generatedFileName), Buffer.from(bytes));

    const updated = await prisma.pdfDocument.update({
      where: { id: document.id },
      data: {
        generatedFileName,
        generatedFilePath: path.join("generated", generatedFileName),
        pageCount,
        generatedAt: new Date(),
        status: "generated",
      },
      include: { items: { include: { images: { select: { id: true } } } } },
    });

    return res.status(201).json({ data: serializeDocument(updated) });
  } catch (error) {
    // Roll back the DB rows + any partially-written files (guide §85).
    if (createdDocumentId) {
      await prisma.pdfDocument.delete({ where: { id: createdDocumentId } }).catch(() => {});
      await rm(path.join(sourceImagesDirectory, `document-${createdDocumentId}`), {
        recursive: true,
        force: true,
      }).catch(() => {});
    }
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/pdf-generator/documents
|--------------------------------------------------------------------------
*/
export async function listDocuments(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);

    const documents = await prisma.pdfDocument.findMany({
      where: { createdById: employeeId },
      include: { items: { include: { images: { select: { id: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ data: documents.map(serializeDocument) });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/pdf-generator/documents/:id
|--------------------------------------------------------------------------
*/
export async function getDocument(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const document = await prisma.pdfDocument.findFirst({
      where: { id: BigInt(req.params.id), createdById: employeeId },
      include: { items: { include: { images: true }, orderBy: { sortOrder: "asc" } } },
    });

    // Ownership check on every query (guide §70) — never reveal whether a
    // document belonging to someone else exists.
    if (!document) return res.status(404).json({ message: "Document not found." });

    return res.json({
      data: {
        ...serializeDocument(document),
        items: document.items.map((item) => ({
          id: String(item.id),
          sortOrder: item.sortOrder,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          customCaption: item.customCaption,
          imageCount: item.images.length,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/pdf-generator/documents/:id/download
|--------------------------------------------------------------------------
*/
export async function downloadDocument(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const document = await prisma.pdfDocument.findFirst({
      where: { id: BigInt(req.params.id), createdById: employeeId },
    });

    if (!document) return res.status(404).json({ message: "Document not found." });
    if (!document.generatedFilePath) {
      return res.status(404).json({ message: "This document has not finished generating yet." });
    }

    const absolutePath = path.join(storageRootDirectory, document.generatedFilePath);
    if (!existsSync(absolutePath)) {
      return res.status(404).json({ message: "The generated PDF file could not be found." });
    }

    return res.download(absolutePath, document.generatedFileName || "document.pdf");
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| PATCH /api/pdf-generator/documents/:id/archive
|--------------------------------------------------------------------------
*/
export async function archiveDocument(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const document = await prisma.pdfDocument.findFirst({
      where: { id: BigInt(req.params.id), createdById: employeeId },
    });

    if (!document) return res.status(404).json({ message: "Document not found." });

    const updated = await prisma.pdfDocument.update({
      where: { id: document.id },
      data: { status: "archived" },
      include: { items: { include: { images: { select: { id: true } } } } },
    });

    return res.json({ data: serializeDocument(updated) });
  } catch (error) {
    return next(error);
  }
}
