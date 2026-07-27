import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

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

  // Columns are located by their display name rather than column_key,
  // since column_key is not guaranteed to be a readable slug — the same
  // approach used in routes/calendar.js and routes/meetings.js.
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

// ─── GET /api/calls/:rowKey — list calls for a client ──────────────

router.get("/:rowKey", async (req, res, next) => {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const connection = await pool.getConnection();
  try {
    const sheetId = await getDefaultSheetId(connection);
    const clientName = await getClientName(connection, sheetId, rowKey);

    const [calls] = await connection.execute(
      `SELECT cc.id, cc.call_datetime, cc.call_discussion,
              cc.created_at, cc.updated_at,
              e1.full_name AS created_by_name,
              e2.full_name AS updated_by_name
       FROM client_calls cc
       LEFT JOIN employees e1 ON e1.id = cc.created_by
       LEFT JOIN employees e2 ON e2.id = cc.updated_by
       WHERE cc.linked_row_key = ?
       ORDER BY cc.call_datetime IS NULL, cc.call_datetime ASC, cc.id ASC`,
      [rowKey],
    );

    res.json({
      data: {
        rowKey,
        clientName,
        calls: calls.map((call) => ({
          id: call.id,
          callDatetime: call.call_datetime,
          callDiscussion: call.call_discussion,
          createdByName: call.created_by_name,
          updatedByName: call.updated_by_name,
          createdAt: call.created_at,
          updatedAt: call.updated_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ─── POST /api/calls/:rowKey — create a new call ───────────────────

router.post("/:rowKey", async (req, res, next) => {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  const callDatetime = req.body.callDatetime
    ? String(req.body.callDatetime).replace("T", " ")
    : null;
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    const [result] = await pool.execute(
      `INSERT INTO client_calls
        (linked_row_key, call_datetime, call_discussion, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [rowKey, callDatetime, callDiscussion, employeeId, employeeId],
    );

    res.status(201).json({ data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/calls/:rowKey/:callId — update time/discussion ──────

router.put("/:rowKey/:callId", async (req, res, next) => {
  const { rowKey, callId } = req.params;
  const id = isValidId(callId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const callDatetime = req.body.callDatetime
    ? String(req.body.callDatetime).replace("T", " ")
    : null;
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    const [result] = await pool.execute(
      `UPDATE client_calls
       SET call_datetime = ?, call_discussion = ?, updated_by = ?
       WHERE id = ? AND linked_row_key = ?`,
      [callDatetime, callDiscussion, employeeId, id, rowKey],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Call not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/calls/:rowKey/:callId ─────────────────────────────

router.delete("/:rowKey/:callId", async (req, res, next) => {
  const { rowKey, callId } = req.params;
  const id = isValidId(callId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const [result] = await pool.execute(
      `DELETE FROM client_calls WHERE id = ? AND linked_row_key = ?`,
      [id, rowKey],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Call not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
});

export default router;
