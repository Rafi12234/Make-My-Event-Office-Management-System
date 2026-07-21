import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

const FRONTEND_TO_DB_TYPE = {
  text: "text",
  long_text: "long_text",
  email: "email",
  phone: "phone",
  number: "decimal",
  date: "date",
  time: "time",
  datetime: "datetime",
  checkbox: "boolean",
  employee: "employee",
  status: "status",
  priority: "priority",
  venue: "venue",
  shift: "shift",
};

const DB_TO_FRONTEND_TYPE = {
  integer: "number",
  decimal: "number",
  currency: "number",
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
  if (dataType === "integer") return row.value_integer;
  if (["decimal", "currency"].includes(dataType)) return row.value_decimal;
  if (dataType === "date") return row.value_date;
  if (dataType === "time") return row.value_time;
  if (dataType === "datetime") return row.value_datetime;
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

        let valueText = null;
        let valueInteger = null;
        let valueDecimal = null;
        let valueDate = null;
        let valueTime = null;
        let valueDatetime = null;
        let valueBoolean = null;
        let valueEmployeeId = null;
        let displayValue = rawValue === null || rawValue === undefined ? "" : String(rawValue);

        if (column.dataType === "integer" && displayValue !== "") valueInteger = Number.parseInt(displayValue, 10);
        else if (["decimal", "currency"].includes(column.dataType) && displayValue !== "") valueDecimal = Number(displayValue);
        else if (column.dataType === "date") valueDate = displayValue || null;
        else if (column.dataType === "time") valueTime = displayValue || null;
        else if (column.dataType === "datetime") valueDatetime = displayValue ? displayValue.replace("T", " ") : null;
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

    if (activeRowKeys.length) {
      const placeholders = activeRowKeys.map(() => "?").join(",");
      await connection.query(
        `UPDATE sheet_rows SET is_archived = TRUE, archived_at = NOW(), updated_by = ?
         WHERE sheet_id = ? AND row_key NOT IN (${placeholders})`,
        [employeeId, sheet.id, ...activeRowKeys],
      );
    } else {
      await connection.execute(
        `UPDATE sheet_rows SET is_archived = TRUE, archived_at = NOW(), updated_by = ?
         WHERE sheet_id = ?`,
        [employeeId, sheet.id],
      );
    }

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
