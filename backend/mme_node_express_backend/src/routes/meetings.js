import { Router } from "express";
import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { parseDateTimeLocal } from "../utils/dbDates.js";

const router = Router();

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
  // already used in routes/calendar.js.
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

// When a new meeting is created, it inherits the requirements and
// images of the most recently created meeting for the same client, so
// employees only need to adjust what changed instead of starting over.
async function copyForwardFromPreviousMeeting(rowKey, newMeetingId, employeeId) {
  const previous = await prisma.clientMeeting.findFirst({
    where: { linkedRowKey: rowKey, id: { not: newMeetingId } },
    orderBy: { id: "desc" },
    include: { images: { orderBy: { id: "asc" } } },
  });
  if (!previous) return;

  if (previous.requirements) {
    await prisma.clientMeeting.update({
      where: { id: newMeetingId },
      data: { requirements: previous.requirements },
    });
  }

  for (const image of previous.images) {
    await prisma.clientMeetingImage.create({
      data: {
        meetingId: newMeetingId,
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

// ─── GET /api/meetings/:rowKey — list meetings + images for a client ───

router.get("/:rowKey", async (req, res, next) => {
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
          ? { finalizedAt: finalization.finalizedAt, finalizedByName: finalization.finalizedBy?.fullName || null }
          : null,
        meetings: meetings.map((meeting) => ({
          id: meeting.id,
          meetingDatetime: meeting.meetingDatetime,
          requirements: parseRequirements(meeting.requirements),
          isCompleted: Boolean(meeting.isCompleted),
          completedByName: meeting.completedBy?.fullName || null,
          completedAt: meeting.completedAt,
          createdByName: meeting.createdBy?.fullName || null,
          updatedByName: meeting.updatedBy?.fullName || null,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
          images: meeting.images.map((image) => ({
            id: image.id,
            originalFileName: image.originalFileName,
            tagName: image.tagName || "",
            url: image.fileUrl,
            isFinalSelected: Boolean(image.isFinalSelected),
            createdAt: image.createdAt,
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/meetings/:rowKey — create a new meeting ─────────────

router.post("/:rowKey", async (req, res, next) => {
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
});

// ─── PUT /api/meetings/:rowKey/:meetingId — update time/requirements ──

router.put("/:rowKey/:meetingId", async (req, res, next) => {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const meetingDatetime = parseDateTimeLocal(req.body.meetingDatetime);
  const requirements = sanitizeRequirements(req.body.requirements);
  const employeeId = isValidId(req.body.employeeId);

  try {
    const result = await prisma.clientMeeting.updateMany({
      where: { id, linkedRowKey: rowKey },
      data: { meetingDatetime, requirements, updatedById: employeeId },
    });

    if (!result.count) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /api/meetings/:rowKey/:meetingId/complete — toggle "Mark as Done" ───

router.patch("/:rowKey/:meetingId/complete", async (req, res, next) => {
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
});

// ─── PATCH /api/meetings/:rowKey/images/:imageId/tag — rename an image's tag ───

router.patch("/:rowKey/images/:imageId/tag", async (req, res, next) => {
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
});

// ─── PATCH /api/meetings/:rowKey/images/:imageId/final — toggle final image ───

router.patch("/:rowKey/images/:imageId/final", async (req, res, next) => {
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
});

// ─── POST /api/meetings/:rowKey/finalize — confirm final client selection ───

router.post("/:rowKey/finalize", async (req, res, next) => {
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
});

// ─── DELETE /api/meetings/:rowKey/:meetingId ───────────────────────

router.delete("/:rowKey/:meetingId", async (req, res, next) => {
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
});

// ─── POST /api/meetings/:rowKey/:meetingId/images — upload images ──

router.post(
  "/:rowKey/:meetingId/images",
  (req, res, next) => {
    upload.array("images", 10)(req, res, (error) => {
      if (error) {
        return res.status(422).json({
          message: error.message || "Image upload failed.",
        });
      }
      next();
    });
  },
  async (req, res, next) => {
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
  },
);

// ─── DELETE /api/meetings/:rowKey/:meetingId/images/:imageId ───────

router.delete("/:rowKey/:meetingId/images/:imageId", async (req, res, next) => {
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
});

export default router;
