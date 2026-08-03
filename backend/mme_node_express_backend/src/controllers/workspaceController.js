import path from "node:path";
import { unlink } from "node:fs";
import { prisma } from "../config/prisma.js";
import { meetingImagesDirectory } from "./meetingsController.js";
import { formatDateOnly, formatTimeOnly, formatDateTime, parseDateOnly, parseTimeOnly, parseDateTimeLocal } from "../utils/dbDates.js";

// When a client row is permanently removed from the worksheet (deleted by an
// employee), delete every trace of that client elsewhere in the database too
// — its meetings, meeting images (including the uploaded files on disk),
// calls, finalization record, and any calendar events linked to it.
// Without this, meetings/calls tied to a deleted client kept showing up in
// the Calendar page even though the client no longer existed on the sheet.
async function deleteClientDataForRowKeys(tx, rowKeys) {
  if (!rowKeys.length) return;

  const meetings = await tx.clientMeeting.findMany({
    where: { linkedRowKey: { in: rowKeys } },
    select: { id: true },
  });
  const meetingIds = meetings.map((meeting) => meeting.id);

  if (meetingIds.length) {
    const images = await tx.clientMeetingImage.findMany({
      where: { meetingId: { in: meetingIds } },
      select: { storedFileName: true },
    });

    // Images are also removed via ON DELETE CASCADE when the meeting itself
    // is deleted below, but we delete them explicitly first so we can clean
    // up the files on disk before the DB rows disappear.
    await tx.clientMeetingImage.deleteMany({ where: { meetingId: { in: meetingIds } } });

    for (const image of images) {
      if (image.storedFileName) {
        unlink(path.join(meetingImagesDirectory, image.storedFileName), () => {});
      }
    }

    await tx.clientMeeting.deleteMany({ where: { id: { in: meetingIds } } });
  }

  await tx.clientCall.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });
  await tx.clientFinalization.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });
  await tx.calendarEvent.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });
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

async function getDefaultSheet(client) {
  const sheet = await client.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, sheetName: true, description: true, updatedAt: true },
  });

  if (sheet) return sheet;

  return client.managementSheet.create({
    data: {
      sheetName: "Meeting Management",
      description: "Shared management workspace",
      isDefault: true,
      isActive: true,
    },
    select: { id: true, sheetName: true, description: true, updatedAt: true },
  });
}

function cellValue(cell, dataType) {
  // A cell that was saved as "Not Available" always reads back as the
  // literal text "N/A", no matter what data type the column is (integer,
  // currency, date, etc.) — none of the typed value columns apply to it.
  if (cell.displayValue === "N/A") return "N/A";
  if (dataType === "integer") return cell.valueInteger;
  if (["decimal", "currency"].includes(dataType)) return cell.valueDecimal;
  if (dataType === "date") return formatDateOnly(cell.valueDate);
  if (dataType === "time") return formatTimeOnly(cell.valueTime);
  if (DATETIME_LIKE_TYPES.has(dataType)) return formatDateTime(cell.valueDatetime);
  if (dataType === "boolean") return cell.valueBoolean === null ? "" : Boolean(cell.valueBoolean);
  if (dataType === "employee") return cell.valueEmployee?.fullName || cell.displayValue || "";
  return cell.valueText ?? cell.displayValue ?? "";
}

export async function getWorkspace(req, res, next) {
  try {
    const sheet = await getDefaultSheet(prisma);

    const columns = await prisma.sheetColumn.findMany({
      where: { sheetId: sheet.id, isActive: true, isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });

    const rows = await prisma.sheetRow.findMany({
      where: { sheetId: sheet.id, isArchived: false },
      orderBy: [{ rowPosition: "asc" }, { id: "asc" }],
    });

    const rowIds = rows.map((row) => row.id);
    let cells = [];
    if (rowIds.length) {
      cells = await prisma.sheetCell.findMany({
        where: { rowId: { in: rowIds } },
        include: { valueEmployee: { select: { fullName: true } } },
      });
    }

    const columnById = new Map(columns.map((column) => [column.id, column]));
    const valuesByRow = new Map(rows.map((row) => [row.id, {}]));

    for (const cell of cells) {
      const column = columnById.get(cell.columnId);
      if (!column) continue;
      valuesByRow.get(cell.rowId)[column.columnKey] = cellValue(cell, column.dataType);
    }

    // "Last Meeting Time" / "Next Meeting Time" are never persisted — they are
    // always computed live from client_meetings so a "next" meeting whose time
    // has passed automatically reads as the "last" meeting on the very next
    // load, with no manual edit or save required.
    // We also compute the previous/next call times in parallel so the
    // management UI can show both meeting + call timing context in those cells.
    const timeSummaryByRowKey = new Map();
    const meetingTimeColumns = columns.filter(
      (column) => column.dataType === "last_meeting_time" || column.dataType === "next_meeting_time",
    );
    if (meetingTimeColumns.length && rows.length) {
      const rowKeys = rows.map((row) => row.rowKey);
      const [meetings, calls, nextCalls] = await Promise.all([
        prisma.clientMeeting.findMany({
          where: { linkedRowKey: { in: rowKeys }, meetingDatetime: { not: null } },
          select: { linkedRowKey: true, meetingDatetime: true },
        }),
        prisma.clientCall.findMany({
          where: { linkedRowKey: { in: rowKeys }, callDatetime: { not: null } },
          select: { linkedRowKey: true, callDatetime: true },
        }),
        prisma.clientNextCall.findMany({
          where: { linkedRowKey: { in: rowKeys } },
          select: { linkedRowKey: true, nextCallDatetime: true },
        }),
      ]);

      // Stored datetimes are naive wall-clock values whose UTC digits mirror the
      // original local input (see dbDates.js) — build "now" the same way so the
      // <= comparisons below aren't skewed by the server's real UTC offset.
      const localNow = new Date();
      const now = new Date(Date.UTC(
        localNow.getFullYear(),
        localNow.getMonth(),
        localNow.getDate(),
        localNow.getHours(),
        localNow.getMinutes(),
        localNow.getSeconds(),
      ));
      const timesByRowKey = new Map();
      const ensureEntry = (rowKey) => {
        let entry = timesByRowKey.get(rowKey);
        if (!entry) {
          entry = { lastMeeting: null, nextMeeting: null, lastCall: null, nextCall: null };
          timesByRowKey.set(rowKey, entry);
        }
        return entry;
      };

      for (const meeting of meetings) {
        const entry = ensureEntry(meeting.linkedRowKey);
        if (meeting.meetingDatetime <= now) {
          if (!entry.lastMeeting || meeting.meetingDatetime > entry.lastMeeting) entry.lastMeeting = meeting.meetingDatetime;
        } else if (!entry.nextMeeting || meeting.meetingDatetime < entry.nextMeeting) {
          entry.nextMeeting = meeting.meetingDatetime;
        }
      }

      for (const call of calls) {
        const entry = ensureEntry(call.linkedRowKey);
        if (call.callDatetime <= now && (!entry.lastCall || call.callDatetime > entry.lastCall)) {
          entry.lastCall = call.callDatetime;
        }
      }

      // "Next call" reflects the explicit follow-up date/time an employee
      // scheduled on a call card, not another call's own (future) call time.
      for (const nextCall of nextCalls) {
        const entry = ensureEntry(nextCall.linkedRowKey);
        if (!entry.nextCall || nextCall.nextCallDatetime < entry.nextCall) entry.nextCall = nextCall.nextCallDatetime;
      }

      for (const column of meetingTimeColumns) {
        for (const row of rows) {
          const times = timesByRowKey.get(row.rowKey);
          const rawValue = column.dataType === "last_meeting_time" ? times?.lastMeeting : times?.nextMeeting;
          valuesByRow.get(row.id)[column.columnKey] = formatDateTime(rawValue) || "";
        }
      }

      for (const row of rows) {
        const times = timesByRowKey.get(row.rowKey);
        timeSummaryByRowKey.set(row.rowKey, {
          lastCallDatetime: formatDateTime(times?.lastCall) || "",
          nextCallDatetime: formatDateTime(times?.nextCall) || "",
        });
      }
    }

    res.json({
      data: {
        id: String(sheet.id),
        name: sheet.sheetName,
        columns: columns.map((column) => ({
          id: column.columnKey,
          name: column.columnName,
          type: DB_TO_FRONTEND_TYPE[column.dataType] || column.dataType,
          width: column.widthPx,
          required: Boolean(column.isRequired),
        })),
        rows: rows.map((row) => ({
          id: row.rowKey,
          rowNumber: row.rowPosition,
          values: valuesByRow.get(row.id),
          ...(timeSummaryByRowKey.get(row.rowKey) || { lastCallDatetime: "", nextCallDatetime: "" }),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function saveWorkspace(req, res, next) {
  const workspace = req.body.workspace;
  const employeeId = Number(req.body.employeeId || 0) || null;

  if (!workspace || !Array.isArray(workspace.columns) || !Array.isArray(workspace.rows)) {
    return res.status(422).json({ message: "A valid workspace payload is required." });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const sheet = await getDefaultSheet(tx);

        const columnIdsByKey = new Map();
        for (let index = 0; index < workspace.columns.length; index += 1) {
          const column = workspace.columns[index];
          const columnKey = String(column.id);
          const dataType = FRONTEND_TO_DB_TYPE[column.type] || "text";
          const columnName = String(column.name || "Untitled Column").trim();
          const widthPx = Math.max(80, Math.min(Number(column.width || 180), 1000));
          const isRequired = Boolean(column.required);

          const upserted = await tx.sheetColumn.upsert({
            where: { sheetId_columnKey: { sheetId: sheet.id, columnKey } },
            update: {
              columnName,
              dataType,
              displayOrder: index + 1,
              widthPx,
              isRequired,
              isVisible: true,
              isActive: true,
              updatedById: employeeId,
            },
            create: {
              sheetId: sheet.id,
              columnKey,
              columnName,
              dataType,
              displayOrder: index + 1,
              widthPx,
              isRequired,
              isVisible: true,
              isActive: true,
              createdById: employeeId,
              updatedById: employeeId,
            },
            select: { id: true },
          });

          columnIdsByKey.set(columnKey, { id: upserted.id, dataType });
        }

        const activeColumnKeys = workspace.columns.map((column) => String(column.id));
        if (activeColumnKeys.length) {
          await tx.sheetColumn.updateMany({
            where: { sheetId: sheet.id, columnKey: { notIn: activeColumnKeys } },
            data: { isActive: false, isVisible: false },
          });
        }

        const activeRowKeys = workspace.rows.map((row) => String(row.id));

        // Permanently delete rows removed from the payload BEFORE upserting the
        // active rows below, instead of just archiving them — a row removed on
        // the sheet must actually disappear from the database, not just be
        // hidden. Deleting first also frees up (sheet_id, row_position) so a
        // later row shifting into a deleted row's old position never collides
        // with it (`sheet_cells` rows for the deleted `sheet_rows` are removed
        // automatically via their ON DELETE CASCADE foreign key).
        let rowKeysBeingRemoved = [];
        if (activeRowKeys.length) {
          const removedRows = await tx.sheetRow.findMany({
            where: { sheetId: sheet.id, rowKey: { notIn: activeRowKeys } },
            select: { rowKey: true },
          });
          rowKeysBeingRemoved = removedRows.map((row) => row.rowKey);

          await tx.sheetRow.deleteMany({
            where: { sheetId: sheet.id, rowKey: { notIn: activeRowKeys } },
          });
        } else {
          const removedRows = await tx.sheetRow.findMany({
            where: { sheetId: sheet.id },
            select: { rowKey: true },
          });
          rowKeysBeingRemoved = removedRows.map((row) => row.rowKey);

          await tx.sheetRow.deleteMany({ where: { sheetId: sheet.id } });
        }

        for (let index = 0; index < workspace.rows.length; index += 1) {
          const row = workspace.rows[index];
          const rowKey = String(row.id);

          const upsertedRow = await tx.sheetRow.upsert({
            where: { sheetId_rowKey: { sheetId: sheet.id, rowKey } },
            update: {
              rowPosition: index + 1,
              updatedById: employeeId,
              isArchived: false,
              archivedAt: null,
            },
            create: {
              sheetId: sheet.id,
              rowKey,
              rowPosition: index + 1,
              createdById: employeeId,
              updatedById: employeeId,
              isArchived: false,
            },
            select: { id: true },
          });
          const rowId = upsertedRow.id;

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
            } else if (column.dataType === "integer" && displayValue !== "") {
              const parsed = Math.round(Number(displayValue));
              // sheet_cells.value_integer is BIGINT in the schema.
              valueInteger = Number.isNaN(parsed) ? null : BigInt(parsed);
            } else if (["decimal", "currency"].includes(column.dataType) && displayValue !== "") {
              const parsed = Number(displayValue);
              valueDecimal = Number.isNaN(parsed) ? null : parsed;
            } else if (column.dataType === "date") {
              valueDate = parseDateOnly(displayValue);
            } else if (column.dataType === "time") {
              valueTime = parseTimeOnly(displayValue);
            } else if (DATETIME_LIKE_TYPES.has(column.dataType)) {
              valueDatetime = parseDateTimeLocal(displayValue);
            } else if (column.dataType === "boolean") {
              valueBoolean = rawValue === true || rawValue === "true" || rawValue === "1";
            } else if (column.dataType === "employee" && displayValue) {
              const employee = await tx.employee.findFirst({
                where: { fullName: displayValue, isActive: true },
                orderBy: { id: "asc" },
                select: { id: true },
              });
              valueEmployeeId = employee?.id || null;
            } else {
              valueText = displayValue;
            }

            await tx.sheetCell.upsert({
              where: { rowId_columnId: { rowId, columnId: column.id } },
              update: {
                valueText,
                valueInteger,
                valueDecimal,
                valueDate,
                valueTime,
                valueDatetime,
                valueBoolean,
                valueEmployeeId,
                displayValue,
                updatedById: employeeId,
              },
              create: {
                rowId,
                columnId: column.id,
                valueText,
                valueInteger,
                valueDecimal,
                valueDate,
                valueTime,
                valueDatetime,
                valueBoolean,
                valueEmployeeId,
                displayValue,
                createdById: employeeId,
                updatedById: employeeId,
              },
            });
          }
        }

        await deleteClientDataForRowKeys(tx, rowKeysBeingRemoved);

        await tx.managementSheet.update({
          where: { id: sheet.id },
          data: { updatedById: employeeId, updatedAt: new Date() },
        });
      },
      { timeout: 30000 },
    );

    res.json({ message: "Workspace saved successfully." });
  } catch (error) {
    next(error);
  }
}
