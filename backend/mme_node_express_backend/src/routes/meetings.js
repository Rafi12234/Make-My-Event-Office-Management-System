import { Router } from "express";
import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { pool } from "../config/db.js";

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

async function getDefaultSheetId(connection) {
  const [rows] = await connection.execute(
    `SELECT id FROM management_sheets
     WHERE is_default = TRUE AND is_active = TRUE
     ORDER BY id ASC LIMIT 1`,
  );
  return rows[0]?.id || null;
}

async function getClientName(connection, sheetId, rowKey) {
  if (!sheetId) return "";

  // Columns in this system are not guaranteed to have a readable
  // column_key (many are auto-generated UUIDs), so the "Client Name"
  // column is located by its display name instead — the same approach
  // already used in routes/calendar.js.
  const [rows] = await connection.execute(
    `SELECT sc.value_text, sc.display_value
     FROM sheet_rows sr
     JOIN sheet_cells sc ON sc.row_id = sr.id
     JOIN sheet_columns col ON col.id = sc.column_id
     WHERE sr.sheet_id = ? AND sr.row_key = ? AND LOWER(col.column_name) = 'client name'
     LIMIT 1`,
    [sheetId, rowKey],
  );

  return rows[0]?.value_text || rows[0]?.display_value || "";
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

// ─── GET /api/meetings/:rowKey — list meetings + images for a client ───

router.get("/:rowKey", async (req, res, next) => {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const connection = await pool.getConnection();
  try {
    const sheetId = await getDefaultSheetId(connection);
    const clientName = await getClientName(connection, sheetId, rowKey);

    const [meetings] = await connection.execute(
      `SELECT cm.id, cm.meeting_datetime, cm.discussion_notes,
              cm.created_at, cm.updated_at,
              e1.full_name AS created_by_name,
              e2.full_name AS updated_by_name
       FROM client_meetings cm
       LEFT JOIN employees e1 ON e1.id = cm.created_by
       LEFT JOIN employees e2 ON e2.id = cm.updated_by
       WHERE cm.linked_row_key = ?
       ORDER BY cm.meeting_datetime IS NULL, cm.meeting_datetime ASC, cm.id ASC`,
      [rowKey],
    );

    const meetingIds = meetings.map((meeting) => meeting.id);
    let images = [];
    if (meetingIds.length) {
      const placeholders = meetingIds.map(() => "?").join(",");
      [images] = await connection.query(
        `SELECT id, meeting_id, original_file_name, file_url, created_at
         FROM client_meeting_images
         WHERE meeting_id IN (${placeholders})
         ORDER BY id ASC`,
        meetingIds,
      );
    }

    const imagesByMeeting = new Map();
    for (const image of images) {
      if (!imagesByMeeting.has(image.meeting_id)) {
        imagesByMeeting.set(image.meeting_id, []);
      }
      imagesByMeeting.get(image.meeting_id).push({
        id: image.id,
        originalFileName: image.original_file_name,
        url: image.file_url,
        createdAt: image.created_at,
      });
    }

    res.json({
      data: {
        rowKey,
        clientName,
        meetings: meetings.map((meeting) => ({
          id: meeting.id,
          meetingDatetime: meeting.meeting_datetime,
          discussionNotes: meeting.discussion_notes,
          createdByName: meeting.created_by_name,
          updatedByName: meeting.updated_by_name,
          createdAt: meeting.created_at,
          updatedAt: meeting.updated_at,
          images: imagesByMeeting.get(meeting.id) || [],
        })),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ─── POST /api/meetings/:rowKey — create a new meeting ─────────────

router.post("/:rowKey", async (req, res, next) => {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const meetingDatetime = req.body.meetingDatetime
    ? String(req.body.meetingDatetime).replace("T", " ")
    : null;
  const discussionNotes = req.body.discussionNotes
    ? String(req.body.discussionNotes)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    const [result] = await pool.execute(
      `INSERT INTO client_meetings
        (linked_row_key, meeting_datetime, discussion_notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [rowKey, meetingDatetime, discussionNotes, employeeId, employeeId],
    );

    res.status(201).json({ data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/meetings/:rowKey/:meetingId — update time/notes ──────

router.put("/:rowKey/:meetingId", async (req, res, next) => {
  const { rowKey, meetingId } = req.params;
  const id = isValidId(meetingId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const meetingDatetime = req.body.meetingDatetime
    ? String(req.body.meetingDatetime).replace("T", " ")
    : null;
  const discussionNotes = req.body.discussionNotes
    ? String(req.body.discussionNotes)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    const [result] = await pool.execute(
      `UPDATE client_meetings
       SET meeting_datetime = ?, discussion_notes = ?, updated_by = ?
       WHERE id = ? AND linked_row_key = ?`,
      [meetingDatetime, discussionNotes, employeeId, id, rowKey],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    res.json({ data: { id } });
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

  const connection = await pool.getConnection();
  try {
    const [images] = await connection.execute(
      `SELECT stored_file_name FROM client_meeting_images WHERE meeting_id = ?`,
      [id],
    );

    const [result] = await connection.execute(
      `DELETE FROM client_meetings WHERE id = ? AND linked_row_key = ?`,
      [id, rowKey],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    for (const image of images) {
      unlink(path.join(meetingImagesDirectory, image.stored_file_name), () => {});
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
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

    const connection = await pool.getConnection();
    try {
      const [meetingRows] = await connection.execute(
        `SELECT id FROM client_meetings WHERE id = ? AND linked_row_key = ? LIMIT 1`,
        [id, rowKey],
      );

      if (!meetingRows.length) {
        removeUploadedFiles(req.files);
        return res.status(404).json({ message: "Meeting not found." });
      }

      const inserted = [];
      for (const file of req.files) {
        const fileUrl = `/uploads/meeting-images/${file.filename}`;

        const [result] = await connection.execute(
          `INSERT INTO client_meeting_images
            (meeting_id, stored_file_name, original_file_name, file_url, file_size_bytes, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            file.filename,
            file.originalname.slice(0, 255),
            fileUrl,
            file.size,
            employeeId,
          ],
        );

        inserted.push({
          id: result.insertId,
          originalFileName: file.originalname,
          url: fileUrl,
        });
      }

      res.status(201).json({ data: inserted });
    } catch (error) {
      removeUploadedFiles(req.files);
      next(error);
    } finally {
      connection.release();
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

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT cmi.stored_file_name
       FROM client_meeting_images cmi
       JOIN client_meetings cm ON cm.id = cmi.meeting_id
       WHERE cmi.id = ? AND cmi.meeting_id = ? AND cm.linked_row_key = ?
       LIMIT 1`,
      [iId, mId, rowKey],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Image not found." });
    }

    await connection.execute(`DELETE FROM client_meeting_images WHERE id = ?`, [iId]);

    unlink(path.join(meetingImagesDirectory, rows[0].stored_file_name), () => {});

    res.json({ data: { id: iId } });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

export default router;
