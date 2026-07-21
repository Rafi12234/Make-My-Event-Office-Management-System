import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────

function extractDate(val) {
  if (!val) return null;
  const s = String(val);
  return s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
}

function extractTime(val) {
  if (!val) return null;
  const s = String(val);
  const part = s.includes("T") ? s.split("T")[1] : s.split(" ")[1];
  return part ? part.substring(0, 5) : null;
}

function formatTimeVal(val) {
  if (!val) return null;
  return String(val).substring(0, 5); // "10:30:00" → "10:30"
}

function inferEventType(columnName) {
  const n = columnName.toLowerCase();
  if (n.includes("next") || n.includes("upcoming")) return "upcoming";
  if (n.includes("meeting") || n.includes("call"))   return "meeting";
  if (n.includes("follow"))                           return "followup";
  if (n.includes("deadline") || n.includes("due"))   return "deadline";
  return "task";
}

function cellValueFromRow(row, dataType) {
  if (dataType === "boolean")                           return row.value_boolean;
  if (dataType === "integer")                           return row.value_integer;
  if (["decimal", "currency"].includes(dataType))      return row.value_decimal;
  if (dataType === "date")                              return row.value_date || "";
  if (dataType === "time")                              return row.value_time || "";
  if (dataType === "datetime")                          return row.value_datetime || "";
  if (dataType === "employee")                          return row.employee_name || row.display_value || "";
  return row.value_text ?? row.display_value ?? "";
}

// ─── GET /api/calendar?year=YYYY&month=M ───────────────────────

router.get("/", async (req, res, next) => {
  const year  = parseInt(req.query.year,  10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);

  const startDate    = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth  = new Date(year, month, 0).getDate();
  const endDate      = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const connection = await pool.getConnection();
  try {
    const events = [];
    let worksheetColumns = [];

    // ── Worksheet events ──────────────────────────────────────
    const [sheets] = await connection.execute(
      `SELECT id FROM management_sheets
       WHERE is_default = TRUE AND is_active = TRUE
       ORDER BY id ASC LIMIT 1`,
    );

    if (sheets.length) {
      const sheetId = sheets[0].id;

      // Always fetch all column definitions (for worksheetColumns + rowData building)
      const [allColumns] = await connection.execute(
        `SELECT id, column_key, column_name, data_type
         FROM sheet_columns
         WHERE sheet_id = ? AND is_active = TRUE
         ORDER BY display_order ASC, id ASC`,
        [sheetId],
      );

      worksheetColumns = allColumns.map((c) => ({
        key: c.column_key,
        name: c.column_name,
        type: c.data_type,
      }));

      const [dateColumns] = await connection.execute(
        `SELECT id, column_key, column_name, data_type
         FROM sheet_columns
         WHERE sheet_id = ? AND data_type IN ('datetime','date') AND is_active = TRUE`,
        [sheetId],
      );

      if (dateColumns.length) {
        const columnIds  = dateColumns.map((c) => c.id);
        const colHolders = columnIds.map(() => "?").join(",");

        const [dateCells] = await connection.query(
          `SELECT sc.id, sc.row_id, sc.column_id,
                  sc.value_datetime, sc.value_date,
                  sr.row_key
           FROM sheet_cells sc
           JOIN sheet_rows sr ON sr.id = sc.row_id
           WHERE sc.column_id IN (${colHolders})
             AND sr.is_archived = FALSE
             AND (
               (sc.value_datetime IS NOT NULL AND DATE(sc.value_datetime) BETWEEN ? AND ?)
               OR
               (sc.value_date     IS NOT NULL AND sc.value_date           BETWEEN ? AND ?)
             )`,
          [...columnIds, startDate, endDate, startDate, endDate],
        );

        if (dateCells.length) {
          const rowIds        = [...new Set(dateCells.map((c) => c.row_id))];
          const rowHolders    = rowIds.map(() => "?").join(",");
          const [allCells]    = await connection.query(
            `SELECT sc.row_id, sc.column_id,
                    sc.value_text, sc.value_integer, sc.value_decimal,
                    sc.value_date, sc.value_time, sc.value_datetime,
                    sc.value_boolean, sc.display_value,
                    e.full_name AS employee_name
             FROM sheet_cells sc
             LEFT JOIN employees e ON e.id = sc.value_employee_id
             WHERE sc.row_id IN (${rowHolders})`,
            rowIds,
          );

          const columnMap = new Map(allColumns.map((c) => [c.id, c]));

          // rowId → { columnKey: value }
          const cellsByRow = new Map();
          for (const cell of allCells) {
            const col = columnMap.get(cell.column_id);
            if (!col) continue;
            if (!cellsByRow.has(cell.row_id)) cellsByRow.set(cell.row_id, {});
            cellsByRow.get(cell.row_id)[col.column_key] = cellValueFromRow(cell, col.data_type);
          }

          const dateColMap = new Map(dateColumns.map((c) => [c.id, c]));

          // Find the "Client Name" column once so every event can carry the resolved name
          const clientNameCol = allColumns.find(
            (c) => c.column_name.toLowerCase() === "client name" ||
                   (c.data_type === "text" && c.column_name.toLowerCase().includes("client") && !c.column_name.toLowerCase().includes("email") && !c.column_name.toLowerCase().includes("phone")),
          );

          for (const cell of dateCells) {
            const dateCol  = dateColMap.get(cell.column_id);
            const rawVal   = cell.value_datetime || cell.value_date;
            const dateStr  = extractDate(rawVal);
            const timeStr  = cell.value_datetime ? extractTime(cell.value_datetime) : null;
            const rowData  = cellsByRow.get(cell.row_id) || {};
            const resolvedClientName = clientNameCol ? (rowData[clientNameCol.column_key] || "") : "";

            events.push({
              id:         `ws_${cell.id}`,
              source:     "worksheet",
              date:       dateStr,
              time:       timeStr,
              columnKey:  dateCol.column_key,
              columnName: dateCol.column_name,
              rowKey:     cell.row_key,
              clientName: resolvedClientName,
              rowData,
              eventType:  inferEventType(dateCol.column_name),
            });
          }
        }
      }
    }

    // ── Manual calendar events ────────────────────────────────
    try {
      const [manualEvents] = await connection.execute(
        `SELECT ce.id, ce.title, ce.description, ce.event_date,
                ce.event_time, ce.event_type, ce.client_name, ce.company_name,
                ce.priority, ce.status, ce.linked_row_key,
                e.full_name AS assigned_employee_name
         FROM calendar_events ce
         LEFT JOIN employees e ON e.id = ce.assigned_employee_id
         WHERE ce.event_date BETWEEN ? AND ?
         ORDER BY ce.event_date ASC, ce.event_time ASC`,
        [startDate, endDate],
      );

      for (const ev of manualEvents) {
        events.push({
          id:               `ev_${ev.id}`,
          dbId:             ev.id,
          source:           "manual",
          date:             ev.event_date,
          time:             formatTimeVal(ev.event_time),
          title:            ev.title,
          description:      ev.description || null,
          eventType:        ev.event_type,
          clientName:       ev.client_name || null,
          companyName:      ev.company_name || null,
          priority:         ev.priority,
          status:           ev.status,
          linkedRowKey:     ev.linked_row_key || null,
          assignedEmployee: ev.assigned_employee_name || null,
        });
      }
    } catch {
      // calendar_events table may not exist yet — skip manual events gracefully
    }

    events.sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      return d !== 0 ? d : (a.time || "").localeCompare(b.time || "");
    });

    res.json({ data: { year, month, events, worksheetColumns } });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ─── POST /api/calendar/events ─────────────────────────────────

router.post("/events", async (req, res, next) => {
  try {
    const {
      title, description, eventDate, eventTime, eventType,
      clientName, companyName, priority, status,
      linkedRowKey, assignedEmployeeId, employeeId,
    } = req.body;

    if (!title || !eventDate) {
      return res.status(422).json({ message: "Title and event date are required." });
    }

    const empId = Number(employeeId) || null;

    const [result] = await pool.execute(
      `INSERT INTO calendar_events
        (title, description, event_date, event_time, event_type,
         client_name, company_name, priority, status, linked_row_key,
         assigned_employee_id, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(title).trim(),
        description || null,
        eventDate,
        eventTime || null,
        eventType || "task",
        clientName || null,
        companyName || null,
        priority || "Medium",
        status || "Pending",
        linkedRowKey || null,
        Number(assignedEmployeeId) || null,
        empId,
        empId,
      ],
    );

    res.status(201).json({ data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/calendar/events/:id ──────────────────────────────

router.put("/events/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      title, description, eventDate, eventTime, eventType,
      clientName, companyName, priority, status,
      linkedRowKey, assignedEmployeeId, employeeId,
    } = req.body;

    if (!title || !eventDate) {
      return res.status(422).json({ message: "Title and event date are required." });
    }

    await pool.execute(
      `UPDATE calendar_events SET
        title = ?, description = ?, event_date = ?, event_time = ?,
        event_type = ?, client_name = ?, company_name = ?,
        priority = ?, status = ?, linked_row_key = ?,
        assigned_employee_id = ?, updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        String(title).trim(),
        description || null,
        eventDate,
        eventTime || null,
        eventType || "task",
        clientName || null,
        companyName || null,
        priority || "Medium",
        status || "Pending",
        linkedRowKey || null,
        Number(assignedEmployeeId) || null,
        Number(employeeId) || null,
        id,
      ],
    );

    res.json({ message: "Event updated." });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/calendar/events/:id ───────────────────────────

router.delete("/events/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.execute(`DELETE FROM calendar_events WHERE id = ?`, [id]);
    res.json({ message: "Event deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
