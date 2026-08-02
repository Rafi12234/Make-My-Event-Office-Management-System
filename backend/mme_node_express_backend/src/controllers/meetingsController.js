import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { formatDateTime, parseDateTimeLocal } from "../utils/dbDates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
|--------------------------------------------------------------------------
| Uploaded meeting image storage
|--------------------------------------------------------------------------
|
| Stored at <app-root>/uploads/meeting-images — a directory owned by the
| backend, sitting OUTSIDE the frontend's "public/assets" folder. This is
| deliberate: the CI/CD deploy step wipes and rebuilds "public/assets" on
| every push (Vite's hashed build output), so anything saved there would
| be permanently deleted on the next deploy. This folder is never touched
| by the deploy workflow, so uploaded images persist across deploys, both
| locally and on hosting.
|
*/

export const uploadsRootDirectory = path.resolve(__dirname, "../../uploads");
export const meetingImagesDirectory = path.join(
  uploadsRootDirectory,
  "meeting-images",
);

mkdirSync(meetingImagesDirectory, { recursive: true });

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, meetingImagesDirectory);
  },
  filename(req, file, callback) {
    const extension = ALLOWED_IMAGE_TYPES[file.mimetype] || "";
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per image
    files: 10,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return callback(
        new Error("Only JPG, PNG, GIF, or WEBP images are allowed."),
      );
    }
    callback(null, true);
  },
});

// Express middleware wrapping multer's array upload with a JSON error
// response — used as the first handler on the image-upload route.
export function uploadImagesMiddleware(req, res, next) {
  upload.array("images", 10)(req, res, (error) => {
    if (error) {
      return res.status(422).json({
        message: error.message || "Image upload failed.",
      });
    }
    next();
  });
}

// ─── Helpers ────────────────────────────────────────────────────

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

async function getClientName(sheetId, rowKey) {
  if (!sheetId) return "";

  // Columns in this system are not guaranteed to have a readable
  // column_key (many are auto-generated UUIDs), so the "Client Name"
  // column is located by its display name instead — the same approach
  // already used in controllers/calendarController.js.
  const row = await prisma.sheetRow.findFirst({
    where: { sheetId, rowKey },
    select: {
      cells: {
        where: { column: { columnName: { equals: "Client Name" } } },
        select: { valueText: true, displayValue: true },
        take: 1,
      },
    },
  });

  const cell = row?.cells?.[0];
  return cell?.valueText || cell?.displayValue || "";
}

function isValidRowKey(rowKey) {
  return /^[0-9a-fA-F-]{36}$/.test(String(rowKey || ""));
}

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function removeUploadedFiles(files) {
  for (const file of files || []) {
    unlink(file.path, () => {});
  }
}

// Client requirement checklist entries are sent as an array of
// { key, label, details }. Sanitize defensively rather than trusting
// the client blindly, without hard-coding the exact option set here
// (that list lives in the frontend so it can change independently).
function sanitizeRequirements(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => item && typeof item === "object")
    .slice(0, 40)
    .map((item) => ({
      key: String(item.key || "").slice(0, 80),
      label: String(item.label || "").slice(0, 120),
      details: String(item.details || "").slice(0, 2000),
    }))
    .filter((item) => item.key);
}

function parseRequirements(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Only physically deletes the uploaded file once no other meeting
// (e.g. a "copied forward" meeting) still references the same
// stored_file_name — images can be shared across meetings when a new
// meeting inherits the previous meeting's images.
async function deleteImageFileIfUnreferenced(storedFileName) {
  const count = await prisma.clientMeetingImage.count({
    where: { storedFileName },
  });
  if (!count) {
    unlink(path.join(meetingImagesDirectory, storedFileName), () => {});
  }
}

// Fixed set of selectable item names for the "Add Items" dropdown. Kept in
// sync with CLIENT_REQUIREMENT_OPTIONS in the frontend's data/defaultSheet.js
// — validated defensively here so a client can't store an arbitrary key.
const ITEM_KEY_OPTIONS = new Set([
  "stage",
  "entry_gate",
  "head_table",
  "photo_booth",
  "truss_ceiling_decoration",
  "tent_ceiling_decoration",
  "walkway",
  "tunnel_walkway",
  "mirror_ramp",
  "welcome_stand",
  "centre_pieces",
  "head_table_chair",
  "photo_gallery",
  "comments_board",
  "sangeet_stage",
  "sound_system",
  "led",
  "other",
]);

function isValidItemKey(value) {
  return typeof value === "string" && ITEM_KEY_OPTIONS.has(value);
}

// Only the "other" item stores a free-text name; every other dropdown
// option already has a fixed, human-readable label on the frontend.
function sanitizeCustomLabel(value) {
  return String(value || "").trim().slice(0, 160);
}

function parseQuantity(value) {
  if (value === undefined || value === null || value === "") return 1;
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) return 1;
  return Math.min(Math.round(quantity), 100000);
}

// When a new meeting is created, it inherits the item rows (and each
// item's images) of the most recently created meeting for the same
// client, so employees only need to adjust what changed instead of
// starting over.
async function copyForwardFromPreviousMeeting(rowKey, newMeetingId, employeeId) {
  const previous = await prisma.clientMeeting.findFirst({
    where: { linkedRowKey: rowKey, id: { not: newMeetingId } },
    orderBy: { id: "desc" },
    include: {
      items: { include: { images: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } },
    },
  });
  if (!previous) return;

  for (const item of previous.items) {
    const newItem = await prisma.meetingItem.create({
      data: {
        meetingId: newMeetingId,
        itemKey: item.itemKey,
        customLabel: item.customLabel,
        description: item.description,
        quantity: item.quantity,
        createdById: employeeId,
        updatedById: employeeId,
      },
      select: { id: true },
    });

    for (const image of item.images) {
      await prisma.clientMeetingImage.create({
        data: {
          meetingId: newMeetingId,
          itemId: newItem.id,
          storedFileName: image.storedFileName,
          originalFileName: image.originalFileName,
          tagName: image.tagName,
          fileUrl: image.fileUrl,
          fileSizeBytes: image.fileSizeBytes,
          uploadedById: image.uploadedById || employeeId,
        },
      });
    }
  }
}

// ─── GET /api/meetings/:rowKey — list meetings + images for a client ───

export async function listMeetings(req, res, next) {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  try {
    const sheetId = await getDefaultSheetId();
    const clientName = await getClientName(sheetId, rowKey);

    const meetings = await prisma.clientMeeting.findMany({
      where: { linkedRowKey: rowKey },
      include: {
        createdBy: { select: { fullName: true } },
        updatedBy: { select: { fullName: true } },
        completedBy: { select: { fullName: true } },
        images: { orderBy: { id: "asc" } },
        items: {
          include: { images: { orderBy: { id: "asc" } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ meetingDatetime: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    });

    const finalization = await prisma.clientFinalization.findUnique({
      where: { linkedRowKey: rowKey },
      include: { finalizedBy: { select: { fullName: true } } },
    });

    res.json({
      data: {
        rowKey,
        clientName,
        finalization: finalization
          ? { finalizedAt: formatDateTime(finalization.finalizedAt), finalizedByName: finalization.finalizedBy?.fullName || null }
          : null,
        meetings: meetings.map((meeting) => ({
          id: meeting.id,
          meetingDatetime: formatDateTime(meeting.meetingDatetime),
          requirements: parseRequirements(meeting.requirements),
          isCompleted: Boolean(meeting.isCompleted),
          completedByName: meeting.completedBy?.fullName || null,
          completedAt: formatDateTime(meeting.completedAt),
          createdByName: meeting.createdBy?.fullName || null,
          updatedByName: meeting.updatedBy?.fullName || null,
          createdAt: formatDateTime(meeting.createdAt),
          updatedAt: formatDateTime(meeting.updatedAt),
          images: meeting.images.map((image) => ({
            id: image.id,
            originalFileName: image.originalFileName,
            tagName: image.tagName || "",
            url: image.fileUrl,
            isFinalSelected: Boolean(image.isFinalSelected),
            createdAt: formatDateTime(image.createdAt),
          })),
          items: meeting.items.map((item) => ({
            id: item.id,
            itemKey: item.itemKey,
            customLabel: item.customLabel || "",
            description: item.description || "",
            quantity: item.quantity ?? 1,
            images: item.images.map((image) => ({
              id: image.id,
              originalFileName: image.originalFileName,
              url: image.fileUrl,
              isFinalSelected: Boolean(image.isFinalSelected),
              createdAt: formatDateTime(image.createdAt),
            })),
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/meetings/:rowKey — create a new meeting ─────────────

export async function createMeeting(req, res, next) {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const meetingDatetime = parseDateTimeLocal(req.body.meetingDatetime);
  const employeeId = isValidId(req.body.employeeId);

  try {
    const created = await prisma.clientMeeting.create({
      data: {
        linkedRowKey: rowKey,
        meetingDatetime,
        createdById: employeeId,
        updatedById: employeeId,
      },
      select: { id: true },
    });

    await copyForwardFromPreviousMeeting(rowKey, created.id, employeeId);

    res.status(201).json({ data: { id: created.id } });
  } catch (error) {
    next(error);
  }
}

// ─── PUT /api/meetings/:rowKey/:meetingId — update time/requirements ──

export async function updateMeeting(req, res, next) {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const meetingDatetime = parseDateTimeLocal(req.body.meetingDatetime);
  const employeeId = isValidId(req.body.employeeId);

  // `requirements` is legacy (superseded by the Items feature below) and
  // is only touched here if a caller still explicitly sends it, so a plain
  // "just update the meeting time" request never wipes older data.
  const data = { meetingDatetime, updatedById: employeeId };
  if (req.body.requirements !== undefined) {
    data.requirements = sanitizeRequirements(req.body.requirements);
  }

  try {
    const result = await prisma.clientMeeting.updateMany({
      where: { id, linkedRowKey: rowKey },
      data,
    });

    if (!result.count) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/meetings/:rowKey/:meetingId/complete — toggle "Mark as Done" ───

export async function toggleMeetingComplete(req, res, next) {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const employeeId = isValidId(req.body.employeeId);

  try {
    const meeting = await prisma.clientMeeting.findFirst({
      where: { id, linkedRowKey: rowKey },
      select: { isCompleted: true },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const nextCompleted = !meeting.isCompleted;

    await prisma.clientMeeting.update({
      where: { id },
      data: {
        isCompleted: nextCompleted,
        completedById: nextCompleted ? employeeId : null,
        completedAt: nextCompleted ? new Date() : null,
      },
    });

    res.json({ data: { id, isCompleted: nextCompleted } });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/meetings/:rowKey/images/:imageId/tag — rename an image's tag ───

export async function updateImageTag(req, res, next) {
  const { rowKey, imageId } = req.params;
  const iId = isValidId(imageId);

  if (!isValidRowKey(rowKey) || !iId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const tagName = String(req.body.tagName ?? "").slice(0, 120).trim();

  try {
    const image = await prisma.clientMeetingImage.findFirst({
      where: { id: iId, meeting: { linkedRowKey: rowKey } },
      select: { id: true },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    await prisma.clientMeetingImage.update({
      where: { id: iId },
      data: { tagName: tagName || null },
    });

    res.json({ data: { id: iId, tagName } });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/meetings/:rowKey/images/:imageId/final — toggle final image ───

export async function toggleImageFinal(req, res, next) {
  const { rowKey, imageId } = req.params;
  const iId = isValidId(imageId);

  if (!isValidRowKey(rowKey) || !iId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const image = await prisma.clientMeetingImage.findFirst({
      where: { id: iId, meeting: { linkedRowKey: rowKey } },
      select: { id: true, isFinalSelected: true },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    const nextSelected = !image.isFinalSelected;

    await prisma.clientMeetingImage.update({
      where: { id: iId },
      data: { isFinalSelected: nextSelected },
    });

    res.json({ data: { id: iId, isFinalSelected: nextSelected } });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/meetings/:rowKey/finalize — confirm final client selection ───

export async function finalizeMeeting(req, res, next) {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const employeeId = isValidId(req.body.employeeId);

  try {
    await prisma.clientFinalization.upsert({
      where: { linkedRowKey: rowKey },
      create: { linkedRowKey: rowKey, finalizedById: employeeId, finalizedAt: new Date() },
      update: { finalizedById: employeeId, finalizedAt: new Date() },
    });

    res.json({ data: { rowKey } });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/meetings/:rowKey/:meetingId ───────────────────────

export async function deleteMeeting(req, res, next) {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const images = await prisma.clientMeetingImage.findMany({
      where: { meetingId: id },
      select: { storedFileName: true },
    });

    const result = await prisma.clientMeeting.deleteMany({
      where: { id, linkedRowKey: rowKey },
    });

    if (!result.count) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    for (const image of images) {
      await deleteImageFileIfUnreferenced(image.storedFileName);
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/meetings/:rowKey/:meetingId/images — upload images ──

export async function uploadMeetingImages(req, res, next) {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ message: "Invalid reference." });
  }

  if (!req.files?.length) {
    return res.status(422).json({ message: "At least one image is required." });
  }

  const employeeId = isValidId(req.body.employeeId);

  // Optional per-file tag names, sent as a JSON array of strings aligned
  // by index with the uploaded files (e.g. ["Stage", "Entry Gate"]).
  let tagNames = [];
  try {
    const parsed = JSON.parse(req.body.tagNames || "[]");
    if (Array.isArray(parsed)) tagNames = parsed;
  } catch {
    tagNames = [];
  }

  try {
    const meeting = await prisma.clientMeeting.findFirst({
      where: { id, linkedRowKey: rowKey },
      select: { id: true },
    });

    if (!meeting) {
      removeUploadedFiles(req.files);
      return res.status(404).json({ message: "Meeting not found." });
    }

    const inserted = [];
    for (const [fileIndex, file] of req.files.entries()) {
      const fileUrl = `/uploads/meeting-images/${file.filename}`;
      const tagName = String(tagNames[fileIndex] || "").slice(0, 120).trim() || null;

      const created = await prisma.clientMeetingImage.create({
        data: {
          meetingId: id,
          storedFileName: file.filename,
          originalFileName: file.originalname.slice(0, 255),
          tagName,
          fileUrl,
          fileSizeBytes: file.size,
          uploadedById: employeeId,
        },
        select: { id: true },
      });

      inserted.push({
        id: created.id,
        originalFileName: file.originalname,
        tagName: tagName || "",
        url: fileUrl,
      });
    }

    res.status(201).json({ data: inserted });
  } catch (error) {
    removeUploadedFiles(req.files);
    next(error);
  }
}

// ─── DELETE /api/meetings/:rowKey/:meetingId/images/:imageId ───────

export async function deleteMeetingImage(req, res, next) {
  const { rowKey, meetingId, imageId } = req.params;
  const mId = isValidId(meetingId);
  const iId = isValidId(imageId);

  if (!isValidRowKey(rowKey) || !mId || !iId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const image = await prisma.clientMeetingImage.findFirst({
      where: { id: iId, meetingId: mId, meeting: { linkedRowKey: rowKey } },
      select: { storedFileName: true },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    await prisma.clientMeetingImage.delete({ where: { id: iId } });

    await deleteImageFileIfUnreferenced(image.storedFileName);

    res.json({ data: { id: iId } });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/meetings/:rowKey/:meetingId/items — add an item row ────

export async function createMeetingItem(req, res, next) {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const itemKey = String(req.body.itemKey || "");
  if (!isValidItemKey(itemKey)) {
    return res.status(422).json({ message: "Please choose a valid item from the list." });
  }

  const isOther = itemKey === "other";
  const customLabel = isOther ? sanitizeCustomLabel(req.body.customLabel) : "";
  if (isOther && !customLabel) {
    return res.status(422).json({ message: "Please enter a name for this item." });
  }

  const description = String(req.body.description || "").slice(0, 2000);
  const quantity = parseQuantity(req.body.quantity);
  const employeeId = isValidId(req.body.employeeId);

  try {
    const meeting = await prisma.clientMeeting.findFirst({
      where: { id, linkedRowKey: rowKey },
      select: { id: true },
    });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    // "Other" items are custom-named, so a meeting can have several of
    // them — only the fixed dropdown options must stay unique per meeting.
    if (!isOther) {
      const existing = await prisma.meetingItem.findFirst({
        where: { meetingId: id, itemKey },
        select: { id: true },
      });
      if (existing) {
        return res.status(409).json({ message: "This item has already been added to the meeting." });
      }
    }

    const created = await prisma.meetingItem.create({
      data: {
        meetingId: id,
        itemKey,
        customLabel: isOther ? customLabel : null,
        description: description || null,
        quantity,
        createdById: employeeId,
        updatedById: employeeId,
      },
    });

    res.status(201).json({
      data: {
        id: created.id,
        itemKey: created.itemKey,
        customLabel: created.customLabel || "",
        description: created.description || "",
        quantity: created.quantity ?? 1,
        images: [],
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── PUT /api/meetings/:rowKey/:meetingId/items/:itemId — edit item row ───

export async function updateMeetingItem(req, res, next) {
  const { rowKey, meetingId, itemId } = req.params;
  const mId = isValidId(meetingId);
  const iId = isValidId(itemId);

  if (!isValidRowKey(rowKey) || !mId || !iId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const description = String(req.body.description || "").slice(0, 2000);
  const quantity = parseQuantity(req.body.quantity);
  const employeeId = isValidId(req.body.employeeId);

  try {
    const item = await prisma.meetingItem.findFirst({
      where: { id: iId, meetingId: mId, meeting: { linkedRowKey: rowKey } },
      select: { id: true, itemKey: true },
    });
    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const data = { description: description || null, quantity, updatedById: employeeId };
    if (item.itemKey === "other" && req.body.customLabel !== undefined) {
      const customLabel = sanitizeCustomLabel(req.body.customLabel);
      if (!customLabel) {
        return res.status(422).json({ message: "Please enter a name for this item." });
      }
      data.customLabel = customLabel;
    }

    const updated = await prisma.meetingItem.update({ where: { id: iId }, data });

    res.json({
      data: {
        id: iId,
        customLabel: updated.customLabel || "",
        description,
        quantity,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/meetings/:rowKey/:meetingId/items/:itemId ────────────

export async function deleteMeetingItem(req, res, next) {
  const { rowKey, meetingId, itemId } = req.params;
  const mId = isValidId(meetingId);
  const iId = isValidId(itemId);

  if (!isValidRowKey(rowKey) || !mId || !iId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const item = await prisma.meetingItem.findFirst({
      where: { id: iId, meetingId: mId, meeting: { linkedRowKey: rowKey } },
      select: {
        id: true,
        images: { select: { storedFileName: true } },
      },
    });
    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    // Deleting the item cascades to its images at the DB level; the
    // physical files are cleaned up afterwards if unreferenced elsewhere.
    await prisma.meetingItem.delete({ where: { id: iId } });

    for (const image of item.images) {
      await deleteImageFileIfUnreferenced(image.storedFileName);
    }

    res.json({ data: { id: iId } });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/meetings/:rowKey/:meetingId/items/:itemId/images — upload ──

export function uploadItemImagesMiddleware(req, res, next) {
  upload.array("images", 10)(req, res, (error) => {
    if (error) {
      return res.status(422).json({
        message: error.message || "Image upload failed.",
      });
    }
    next();
  });
}

export async function uploadItemImages(req, res, next) {
  const { rowKey, meetingId, itemId } = req.params;
  const mId = isValidId(meetingId);
  const iId = isValidId(itemId);

  if (!isValidRowKey(rowKey) || !mId || !iId) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ message: "Invalid reference." });
  }

  if (!req.files?.length) {
    return res.status(422).json({ message: "At least one image is required." });
  }

  const employeeId = isValidId(req.body.employeeId);

  try {
    const item = await prisma.meetingItem.findFirst({
      where: { id: iId, meetingId: mId, meeting: { linkedRowKey: rowKey } },
      select: { id: true },
    });

    if (!item) {
      removeUploadedFiles(req.files);
      return res.status(404).json({ message: "Item not found." });
    }

    const inserted = [];
    for (const file of req.files) {
      const fileUrl = `/uploads/meeting-images/${file.filename}`;

      const created = await prisma.clientMeetingImage.create({
        data: {
          meetingId: mId,
          itemId: iId,
          storedFileName: file.filename,
          originalFileName: file.originalname.slice(0, 255),
          fileUrl,
          fileSizeBytes: file.size,
          uploadedById: employeeId,
        },
        select: { id: true },
      });

      inserted.push({
        id: created.id,
        originalFileName: file.originalname,
        url: fileUrl,
        isFinalSelected: false,
      });
    }

    res.status(201).json({ data: inserted });
  } catch (error) {
    removeUploadedFiles(req.files);
    next(error);
  }
}

// ─── DELETE /api/meetings/:rowKey/:meetingId/items/:itemId/images/:imageId ──

export async function deleteItemImage(req, res, next) {
  const { rowKey, meetingId, itemId, imageId } = req.params;
  const mId = isValidId(meetingId);
  const iId = isValidId(itemId);
  const imgId = isValidId(imageId);

  if (!isValidRowKey(rowKey) || !mId || !iId || !imgId) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const image = await prisma.clientMeetingImage.findFirst({
      where: {
        id: imgId,
        itemId: iId,
        meetingId: mId,
        meeting: { linkedRowKey: rowKey },
      },
      select: { storedFileName: true },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found." });
    }

    await prisma.clientMeetingImage.delete({ where: { id: imgId } });

    await deleteImageFileIfUnreferenced(image.storedFileName);

    res.json({ data: { id: imgId } });
  } catch (error) {
    next(error);
  }
}
