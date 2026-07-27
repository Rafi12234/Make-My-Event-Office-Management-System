import { Router } from "express";
import path from "node:path";
import { unlink } from "node:fs";
import { pool } from "../config/db.js";
import { meetingImagesDirectory } from "./meetings.js";

const router = Router();

// When a client row is permanently removed from the worksheet (deleted by an
// employee), delete every trace of that client elsewhere in the database too
// — its meetings, meeting images (including the uploaded files on disk),
// calls, finalization record, and any calendar events linked to it.
// Without this, meetings/calls tied to a deleted client kept showing up in
// the Calendar page even though the client no longer existed on the sheet.
async function deleteClientDataForRowKeys(connection, rowKeys) {
  if (!rowKeys.length) return;
  const placeholders = rowKeys.map(() => "?").join(",");

  try {
    const [meetings] = await connection.query(
      `SELECT id FROM client_meetings WHERE linked_row_key IN (${placeholders})`,
      rowKeys,
    );
    const meetingIds = meetings.map((meeting) => meeting.id);

    if (meetingIds.length) {
      const meetingPlaceholders = meetingIds.map(() => "?").join(",");

      const [images] = await connection.query(
        `SELECT stored_file_name FROM client_meeting_images WHERE meeting_id IN (${meetingPlaceholders})`,
        meetingIds,
      );

      await connection.query(
        `DELETE FROM client_meeting_images WHERE meeting_id IN (${meetingPlaceholders})`,
        meetingIds,
      );

      for (const image of images) {
        if (image.stored_file_name) {
          unlink(path.join(meetingImagesDirectory, image.stored_file_name), () => {});
        }
      }

      await connection.query(
        `DELETE FROM client_meetings WHERE id IN (${meetingPlaceholders})`,
        meetingIds,
      );
    }
  } catch {
    // client_meetings / client_meeting_images tables may not exist yet — skip gracefully
  }

  try {
    await connection.query(
      `DELETE FROM client_calls WHERE linked_row_key IN (${placeholders})`,
      rowKeys,
    );
  } catch {
    // client_calls table may not exist yet — skip gracefully
  }

  try {
    await connection.query(
      `DELETE FROM client_finalizations WHERE linked_row_key IN (${placeholders})`,
      rowKeys,
    );
  } catch {
    // client_finalizations table may not exist yet — skip gracefully
  }

  try {
    await connection.query(
      `DELETE FROM calendar_events WHERE linked_row_key IN (${placeholders})`,
      rowKeys,
    );
  } catch {
    // calendar_events table may not exist yet — skip gracefully
  }
}

const FRONTEND_TO_DB_TYPE = {
  text: "text",
  long_text: "long_text",
  email: "email",
  phone: "phone",
  number: "decimal",
  integer: "integer",
  date: "date",
  time: "time",
  datetime: "datetime",
  checkbox: "boolean",
  employee: "employee",
  status: "status",
  priority: "priority",
  venue: "venue",
  shift: "shift",
  currency: "currency",
  meeting_manager: "meeting_manager",
  last_meeting_time: "last_meeting_time",
  next_meeting_time: "next_meeting_time",
};

// Columns whose stored value behaves exactly like a plain "datetime" column
// (same value_datetime storage), just with a different semantic label.
const DATETIME_LIKE_TYPES = new Set(["datetime", "last_meeting_time", "next_meeting_time"]);

const DB_TO_FRONTEND_TYPE = {
  decimal: "number",
  boolean: "checkbox",
};

async function getDefaultSheet(connection) {
  const [rows] = await connection.execute(
    `SELECT id, sheet_name, description, updated_at
     FROM management_sheets
     WHERE is_default = TRUE AND is_active = TRUE
     ORDER BY id ASC LIMIT 1`,
  );

  if (!rows.length) {
    const [result] = await connection.execute(
      `INSERT INTO management_sheets
       (sheet_name, description, is_default, is_active)
       VALUES ('Meeting Management', 'Shared management workspace', TRUE, TRUE)`,
    );
    return { id: result.insertId, sheet_name: "Meeting Management" };
  }

  return rows[0];
}

function cellValue(row, dataType) {
  // A cell that was saved as "Not Available" always reads back as the
  // literal text "N/A", no matter what data type the column is (integer,
  // currency, date, etc.) — none of the typed value columns apply to it.
  if (row.display_value === "N/A") return "N/A";
  if (dataType === "integer") return row.value_integer;
  if (["decimal", "currency"].includes(dataType)) return row.value_decimal;
  if (dataType === "date") return row.value_date;
  if (dataType === "time") return row.value_time;
  if (DATETIME_LIKE_TYPES.has(dataType)) return row.value_datetime;
  if (dataType === "boolean") return row.value_boolean === null ? "" : Boolean(row.value_boolean);
  if (dataType === "employee") return row.employee_name || row.display_value || "";
  return row.value_text ?? row.display_value ?? "";
}

router.get("/default", async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const sheet = await getDefaultSheet(connection);

    const [columns] = await connection.execute(
      `SELECT id, column_key, column_name, data_type, display_order,
              width_px, is_required
       FROM sheet_columns
       WHERE sheet_id = ? AND is_active = TRUE AND is_visible = TRUE
       ORDER BY display_order ASC, id ASC`,
      [sheet.id],
    );

    const [rows] = await connection.execute(
      `SELECT id, row_key, row_position, created_at, updated_at
       FROM sheet_rows
       WHERE sheet_id = ? AND is_archived = FALSE
       ORDER BY row_position ASC, id ASC`,
      [sheet.id],
    );

    const rowIds = rows.map((row) => row.id);
    let cells = [];
    if (rowIds.length) {
      const placeholders = rowIds.map(() => "?").join(",");
      [cells] = await connection.query(
        `SELECT sc.row_id, sc.column_id, sc.value_text, sc.value_integer,
                sc.value_decimal, sc.value_date, sc.value_time,
                sc.value_datetime, sc.value_boolean, sc.display_value,
                e.full_name AS employee_name
         FROM sheet_cells sc
         LEFT JOIN employees e ON e.id = sc.value_employee_id
         WHERE sc.row_id IN (${placeholders})`,
        rowIds,
      );
    }

    const columnById = new Map(columns.map((column) => [column.id, column]));
    const valuesByRow = new Map(rows.map((row) => [row.id, {}]));

    for (const cell of cells) {
      const column = columnById.get(cell.column_id);
      if (!column) continue;
      valuesByRow.get(cell.row_id)[column.column_key] = cellValue(cell, column.data_type);
    }

    // "Last Meeting Time" / "Next Meeting Time" are never persisted — they are
    // always computed live from client_meetings so a "next" meeting whose time
    // has passed automatically reads as the "last" meeting on the very next
    // load, with no manual edit or save required.
    const meetingTimeColumns = columns.filter(
      (column) => column.data_type === "last_meeting_time" || column.data_type === "next_meeting_time",
    );
    if (meetingTimeColumns.length && rows.length) {
      try {
        const [meetingTimes] = await connection.query(
          `SELECT sr.row_key,
                  MAX(CASE WHEN cm.meeting_datetime <= NOW() THEN cm.meeting_datetime END) AS last_meeting_time,
                  MIN(CASE WHEN cm.meeting_datetime > NOW() THEN cm.meeting_datetime END) AS next_meeting_time
           FROM sheet_rows sr
           JOIN client_meetings cm ON cm.linked_row_key = sr.row_key AND cm.meeting_datetime IS NOT NULL
           WHERE sr.sheet_id = ?
           GROUP BY sr.row_key`,
          [sheet.id],
        );

        const timesByRowKey = new Map(meetingTimes.map((row) => [row.row_key, row]));

        for (const column of meetingTimeColumns) {
          for (const row of rows) {
            const times = timesByRowKey.get(row.row_key);
            const value =
              column.data_type === "last_meeting_time"
                ? times?.last_meeting_time || ""
                : times?.next_meeting_time || "";
            valuesByRow.get(row.id)[column.column_key] = value;
          }
        }
      } catch {
        // client_meetings table may not exist yet — leave these columns empty
      }
    }

    res.json({
      data: {
        id: String(sheet.id),
        name: sheet.sheet_name,
        columns: columns.map((column) => ({
          id: column.column_key,
          name: column.column_name,
          type: DB_TO_FRONTEND_TYPE[column.data_type] || column.data_type,
          width: column.width_px,
          required: Boolean(column.is_required),
        })),
        rows: rows.map((row) => ({
          id: row.row_key,
          rowNumber: row.row_position,
          values: valuesByRow.get(row.id),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

router.put("/default", async (req, res, next) => {
  const workspace = req.body.workspace;
  const employeeId = Number(req.body.employeeId || 0) || null;

  if (!workspace || !Array.isArray(workspace.columns) || !Array.isArray(workspace.rows)) {
    return res.status(422).json({ message: "A valid workspace payload is required." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sheet = await getDefaultSheet(connection);

    const columnIdsByKey = new Map();
    for (let index = 0; index < workspace.columns.length; index += 1) {
      const column = workspace.columns[index];
      const columnKey = String(column.id);
      const dataType = FRONTEND_TO_DB_TYPE[column.type] || "text";

      await connection.execute(
        `INSERT INTO sheet_columns
          (sheet_id, column_key, column_name, data_type, display_order,
           width_px, is_required, is_visible, is_active, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?, ?)
         ON DUPLICATE KEY UPDATE
           column_name = VALUES(column_name),
           data_type = VALUES(data_type),
           display_order = VALUES(display_order),
           width_px = VALUES(width_px),
           is_required = VALUES(is_required),
           is_visible = TRUE,
           is_active = TRUE,
           updated_by = VALUES(updated_by)`,
        [
          sheet.id,
          columnKey,
          String(column.name || "Untitled Column").trim(),
          dataType,
          index + 1,
          Math.max(80, Math.min(Number(column.width || 180), 1000)),
          Boolean(column.required),
          employeeId,
          employeeId,
        ],
      );

      const [columnRows] = await connection.execute(
        `SELECT id FROM sheet_columns WHERE sheet_id = ? AND column_key = ? LIMIT 1`,
        [sheet.id, columnKey],
      );
      columnIdsByKey.set(columnKey, { id: columnRows[0].id, dataType });
    }

    const activeColumnKeys = workspace.columns.map((column) => String(column.id));
    if (activeColumnKeys.length) {
      const placeholders = activeColumnKeys.map(() => "?").join(",");
      await connection.query(
        `UPDATE sheet_columns SET is_active = FALSE, is_visible = FALSE
         WHERE sheet_id = ? AND column_key NOT IN (${placeholders})`,
        [sheet.id, ...activeColumnKeys],
      );
    }

    const activeRowKeys = [];
    for (let index = 0; index < workspace.rows.length; index += 1) {
      const row = workspace.rows[index];
      const rowKey = String(row.id);
      activeRowKeys.push(rowKey);

      await connection.execute(
        `INSERT INTO sheet_rows
          (sheet_id, row_key, row_position, created_by, updated_by, is_archived)
         VALUES (?, ?, ?, ?, ?, FALSE)
         ON DUPLICATE KEY UPDATE
           row_position = VALUES(row_position),
           updated_by = VALUES(updated_by),
           is_archived = FALSE,
           archived_at = NULL`,
        [sheet.id, rowKey, index + 1, employeeId, employeeId],
      );

      const [rowRows] = await connection.execute(
        `SELECT id FROM sheet_rows WHERE sheet_id = ? AND row_key = ? LIMIT 1`,
        [sheet.id, rowKey],
      );
      const rowId = rowRows[0].id;

      for (const [columnKey, rawValue] of Object.entries(row.values || {})) {
        const column = columnIdsByKey.get(String(columnKey));
        if (!column) continue;
        // "Last Meeting Time" / "Next Meeting Time" are computed live from
        // client_meetings on every read — never persisted as manual cell data.
        if (column.dataType === "last_meeting_time" || column.dataType === "next_meeting_time") continue;

        let valueText = null;
        let valueInteger = null;
        let valueDecimal = null;
        let valueDate = null;
        let valueTime = null;
        let valueDatetime = null;
        let valueBoolean = null;
        let valueEmployeeId = null;
        let displayValue = rawValue === null || rawValue === undefined ? "" : String(rawValue);

        if (displayValue.trim().toUpperCase() === "N/A") {
          // Preserve "Not Available" values verbatim regardless of the
          // column's declared data type — no numeric/date/boolean/employee
          // coercion is attempted, so the value can never silently become
          // null on read; it always comes back as the literal text "N/A".
          valueText = "N/A";
          displayValue = "N/A";
        } else if (column.dataType === "integer" && displayValue !== "") valueInteger = Math.round(Number(displayValue));
        else if (["decimal", "currency"].includes(column.dataType) && displayValue !== "") valueDecimal = Number(displayValue);
        else if (column.dataType === "date") valueDate = displayValue || null;
        else if (column.dataType === "time") valueTime = displayValue || null;
        else if (DATETIME_LIKE_TYPES.has(column.dataType)) valueDatetime = displayValue ? displayValue.replace("T", " ") : null;
        else if (column.dataType === "boolean") valueBoolean = rawValue === true || rawValue === "true" || rawValue === "1";
        else if (column.dataType === "employee" && displayValue) {
          const [employeeRows] = await connection.execute(
            `SELECT id FROM employees WHERE full_name = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1`,
            [displayValue],
          );
          valueEmployeeId = employeeRows[0]?.id || null;
        } else valueText = displayValue;

        await connection.execute(
          `INSERT INTO sheet_cells
            (row_id, column_id, value_text, value_integer, value_decimal,
             value_date, value_time, value_datetime, value_boolean,
             value_employee_id, display_value, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             value_text = VALUES(value_text),
             value_integer = VALUES(value_integer),
             value_decimal = VALUES(value_decimal),
             value_date = VALUES(value_date),
             value_time = VALUES(value_time),
             value_datetime = VALUES(value_datetime),
             value_boolean = VALUES(value_boolean),
             value_employee_id = VALUES(value_employee_id),
             display_value = VALUES(display_value),
             updated_by = VALUES(updated_by)`,
          [
            rowId,
            column.id,
            valueText,
            Number.isNaN(valueInteger) ? null : valueInteger,
            Number.isNaN(valueDecimal) ? null : valueDecimal,
            valueDate,
            valueTime,
            valueDatetime,
            valueBoolean,
            valueEmployeeId,
            displayValue,
            employeeId,
            employeeId,
          ],
        );
      }
    }

    let rowKeysBeingRemoved = [];
    if (activeRowKeys.length) {
      const placeholders = activeRowKeys.map(() => "?").join(",");

      const [removedRows] = await connection.query(
        `SELECT row_key FROM sheet_rows
         WHERE sheet_id = ? AND row_key NOT IN (${placeholders}) AND is_archived = FALSE`,
        [sheet.id, ...activeRowKeys],
      );
      rowKeysBeingRemoved = removedRows.map((row) => row.row_key);

      await connection.query(
        `UPDATE sheet_rows SET is_archived = TRUE, archived_at = NOW(), updated_by = ?
         WHERE sheet_id = ? AND row_key NOT IN (${placeholders})`,
        [employeeId, sheet.id, ...activeRowKeys],
      );
    } else {
      const [removedRows] = await connection.execute(
        `SELECT row_key FROM sheet_rows WHERE sheet_id = ? AND is_archived = FALSE`,
        [sheet.id],
      );
      rowKeysBeingRemoved = removedRows.map((row) => row.row_key);

      await connection.execute(
        `UPDATE sheet_rows SET is_archived = TRUE, archived_at = NOW(), updated_by = ?
         WHERE sheet_id = ?`,
        [employeeId, sheet.id],
      );
    }

    await deleteClientDataForRowKeys(connection, rowKeysBeingRemoved);

    await connection.execute(
      `UPDATE management_sheets SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [employeeId, sheet.id],
    );

    await connection.commit();
    res.json({ message: "Workspace saved successfully." });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

export default router;
