import path from "node:path";
import { unlink } from "node:fs";
import { prisma } from "../config/prisma.js";
import { meetingImagesDirectory } from "./meetingsController.js";
import { formatDateOnly, formatTimeOnly, formatDateTime, parseDateOnly, parseTimeOnly, parseDateTimeLocal } from "../utils/dbDates.js";
import { computeMeetingCallTimes } from "../utils/meetingCallTimes.js";

// When a client row is permanently removed from the worksheet (deleted by an
// employee), delete every trace of that client elsewhere in the database too
// — its meetings, meeting images (including the uploaded files on disk),
// calls, finalization record, and any calendar events linked to it.
// Without this, meetings/calls tied to a deleted client kept showing up in
// the Calendar page even though the client no longer existed on the sheet.
async function deleteClientDataForRowKeys(tx, rowKeys) {
  if (!rowKeys.length) return [];

  const meetings = await tx.clientMeeting.findMany({
    where: { linkedRowKey: { in: rowKeys } },
    select: {
      id: true,
      images: {
        select: { id: true, storedFileName: true },
      },
    },
  });

  const meetingIds = meetings.map((meeting) => meeting.id);
  const images = meetings.flatMap((meeting) => meeting.images || []);
  const imageIds = images.map((image) => image.id);
  const imageFileNames = images
    .map((image) => image.storedFileName)
    .filter(Boolean);

  if (meetingIds.length) {
    // Generated proposal documents are historical records and must survive a
    // client deletion. Detach their optional source references before the
    // meetings/images are removed so foreign keys never block the delete.
    await tx.pdfDocument.updateMany({
      where: { meetingId: { in: meetingIds } },
      data: { meetingId: null },
    });

    if (imageIds.length) {
      await tx.pdfDocumentItemImage.updateMany({
        where: { sourceMeetingImageId: { in: imageIds } },
        data: { sourceMeetingImageId: null },
      });
    }

    // Meeting items and meeting images cascade from client_meetings. Keeping
    // this as one delete is much faster than individually deleting every
    // image/item row first.
    await tx.clientMeeting.deleteMany({ where: { id: { in: meetingIds } } });
  }

  await tx.clientCall.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });
  await tx.clientFinalization.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });
  await tx.calendarEvent.deleteMany({ where: { linkedRowKey: { in: rowKeys } } });

  return imageFileNames;
}

function removeMeetingImageFiles(fileNames) {
  for (const storedFileName of fileNames || []) {
    unlink(path.join(meetingImagesDirectory, storedFileName), () => {});
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

export const DB_TO_FRONTEND_TYPE = {
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

// Exported so adminWorkspaceController.js's read-only admin table can reuse
// the exact same cell-value extraction rules as the employee workspace.
export function cellValue(cell, dataType) {
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
    // "Already booked" is stored on the row's Event Date cell (see the badge
    // button beside it on the frontend) but is really a per-row flag.
    const alreadyBookedByRow = new Map();
    // "Booked from MME" is also stored on the row's Event Date cell — set
    // automatically by finalizeMeeting when the employee confirms & finalizes.
    const bookedFromMmeByRow = new Map();

    for (const cell of cells) {
      const column = columnById.get(cell.columnId);
      if (!column) continue;
      valuesByRow.get(cell.rowId)[column.columnKey] = cellValue(cell, column.dataType);
      if (cell.alreadyBooked) alreadyBookedByRow.set(cell.rowId, true);
      if (cell.bookedFromMme) bookedFromMmeByRow.set(cell.rowId, true);
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
      const timesByRowKey = await computeMeetingCallTimes(rowKeys);

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
        rows: rows.map((row, index) => ({
          id: row.rowKey,
          // row_position is an internal stable sort key and may contain gaps
          // after fast targeted deletes; display numbering should stay 1..N.
          rowNumber: index + 1,
          values: valuesByRow.get(row.id),
          alreadyBooked: alreadyBookedByRow.get(row.id) || false,
          bookedFromMme: bookedFromMmeByRow.get(row.id) || false,
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

// Turns one raw frontend cell value into the typed sheet_cells columns to
// write. Shared by saveWorkspace's whole-sheet replace and the admin side's
// single-cell PATCH endpoint, so both stay in sync with the same coercion
// rules (N/A passthrough, employee name lookup, etc.).
export async function buildCellValueFields(client, rawValue, dataType) {
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
    valueText = "N/A";
    displayValue = "N/A";
  } else if (dataType === "integer" && displayValue !== "") {
    const parsed = Math.round(Number(displayValue));
    // sheet_cells.value_integer is BIGINT in the schema.
    valueInteger = Number.isNaN(parsed) ? null : BigInt(parsed);
  } else if (["decimal", "currency"].includes(dataType) && displayValue !== "") {
    const parsed = Number(displayValue);
    valueDecimal = Number.isNaN(parsed) ? null : parsed;
  } else if (dataType === "date") {
    valueDate = parseDateOnly(displayValue);
  } else if (dataType === "time") {
    valueTime = parseTimeOnly(displayValue);
  } else if (DATETIME_LIKE_TYPES.has(dataType)) {
    valueDatetime = parseDateTimeLocal(displayValue);
  } else if (dataType === "boolean") {
    valueBoolean = rawValue === true || rawValue === "true" || rawValue === "1";
  } else if (dataType === "employee" && displayValue) {
    const employee = await client.employee.findFirst({
      where: { fullName: displayValue, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    valueEmployeeId = employee?.id || null;
  } else {
    valueText = displayValue;
  }

  return { valueText, valueInteger, valueDecimal, valueDate, valueTime, valueDatetime, valueBoolean, valueEmployeeId, displayValue };
}


// Lightweight snapshot for cross-employee add/delete awareness. The frontend
// polls this endpoint instead of downloading every management-sheet cell.
export async function getWorkspaceRowSnapshot(req, res, next) {
  try {
    const sheet = await getDefaultSheet(prisma);
    const rows = await prisma.sheetRow.findMany({
      where: { sheetId: sheet.id, isArchived: false },
      orderBy: [{ rowPosition: "asc" }, { id: "asc" }],
      select: { rowKey: true },
    });

    return res.json({
      data: {
        updatedAt: sheet.updatedAt,
        rowKeys: rows.map((row) => row.rowKey),
      },
    });
  } catch (error) {
    return next(error);
  }
}

// Fast path for normal Management-page saves. Unlike the legacy whole-sheet
// PUT endpoint, this endpoint never interprets a missing row as a deletion.
// Only rows that are new/edited are sent by the frontend, which makes saves
// much faster and prevents one employee's stale screen from deleting another
// employee's newly-added clients.
export async function saveWorkspaceChanges(req, res, next) {
  const columns = req.body?.columns;
  const rows = req.body?.rows;
  const employeeId = Number(req.employee?.id || 0) || null;

  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(422).json({ message: "Valid columns and changed rows are required." });
  }

  if (rows.length > 2000) {
    return res.status(422).json({ message: "Too many rows were submitted in one save." });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sheet = await getDefaultSheet(tx);
        const mutationTime = new Date();

        // Updating the single sheet row first gives concurrent Management-page
        // mutations a common lock. That prevents two employees adding clients
        // at the same moment from choosing the same unique row_position.
        await tx.managementSheet.update({
          where: { id: sheet.id },
          data: { updatedById: employeeId, updatedAt: mutationTime },
        });

        const existingColumns = await tx.sheetColumn.findMany({
          where: { sheetId: sheet.id },
          select: {
            id: true,
            columnKey: true,
            columnName: true,
            dataType: true,
            displayOrder: true,
            widthPx: true,
            isRequired: true,
            isVisible: true,
            isActive: true,
          },
        });
        const existingColumnByKey = new Map(
          existingColumns.map((column) => [column.columnKey, column]),
        );
        const columnIdsByKey = new Map();

        for (let index = 0; index < columns.length; index += 1) {
          const column = columns[index];
          const columnKey = String(column.id);
          const dataType = FRONTEND_TO_DB_TYPE[column.type] || "text";
          const columnName = String(column.name || "Untitled Column").trim();
          const widthPx = Math.max(80, Math.min(Number(column.width || 180), 1000));
          const isRequired = Boolean(column.required);
          const existing = existingColumnByKey.get(columnKey);

          if (existing) {
            const needsUpdate =
              existing.columnName !== columnName ||
              existing.dataType !== dataType ||
              existing.displayOrder !== index + 1 ||
              Number(existing.widthPx) !== widthPx ||
              Boolean(existing.isRequired) !== isRequired ||
              !existing.isVisible ||
              !existing.isActive;

            if (needsUpdate) {
              await tx.sheetColumn.update({
                where: { id: existing.id },
                data: {
                  columnName,
                  dataType,
                  displayOrder: index + 1,
                  widthPx,
                  isRequired,
                  isVisible: true,
                  isActive: true,
                  updatedById: employeeId,
                },
              });
            }

            columnIdsByKey.set(columnKey, { id: existing.id, dataType });
            continue;
          }

          const created = await tx.sheetColumn.create({
            data: {
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
          columnIdsByKey.set(columnKey, { id: created.id, dataType });
        }

        const rowKeys = [...new Set(rows.map((row) => String(row.id || "").trim()).filter(Boolean))];
        const existingRows = rowKeys.length
          ? await tx.sheetRow.findMany({
              where: { sheetId: sheet.id, rowKey: { in: rowKeys } },
              select: { id: true, rowKey: true },
            })
          : [];
        const existingRowByKey = new Map(existingRows.map((row) => [row.rowKey, row]));

        // Lock/read current row positions (not a repeatable-read snapshot) so
        // a second employee adding a client concurrently always sees the
        // position committed by the first employee.
        const lockedPositionRows = await tx.$queryRawUnsafe(
          "SELECT row_position AS rowPosition FROM sheet_rows WHERE sheet_id = ? FOR UPDATE",
          sheet.id,
        );
        let nextPosition = lockedPositionRows.reduce(
          (max, row) => Math.max(max, Number(row.rowPosition || 0)),
          0,
        );
        const savedRowKeys = [];

        for (const row of rows) {
          const rowKey = String(row.id || "").trim();
          if (!rowKey) continue;

          let rowRecord = existingRowByKey.get(rowKey);
          if (rowRecord) {
            rowRecord = await tx.sheetRow.update({
              where: { id: rowRecord.id },
              data: {
                updatedById: employeeId,
                isArchived: false,
                archivedAt: null,
              },
              select: { id: true, rowKey: true },
            });
          } else {
            if (row.isNewClient !== true) {
              const conflict = new Error(
                "This client was deleted by another employee while you were working. Refresh the Management page before saving it again.",
              );
              conflict.statusCode = 409;
              throw conflict;
            }

            nextPosition += 1;
            rowRecord = await tx.sheetRow.create({
              data: {
                sheetId: sheet.id,
                rowKey,
                rowPosition: nextPosition,
                createdById: employeeId,
                updatedById: employeeId,
                isArchived: false,
              },
              select: { id: true, rowKey: true },
            });
          }

          for (const [columnKeyRaw, rawValue] of Object.entries(row.values || {})) {
            const columnKey = String(columnKeyRaw);
            const column = columnIdsByKey.get(columnKey);
            if (!column) continue;
            if (column.dataType === "last_meeting_time" || column.dataType === "next_meeting_time") continue;

            const fields = await buildCellValueFields(tx, rawValue, column.dataType);
            const isEventDateColumn = columnKey === "event_date";
            const alreadyBookedFields = isEventDateColumn
              ? { alreadyBooked: Boolean(row.alreadyBooked) }
              : {};

            await tx.sheetCell.upsert({
              where: { rowId_columnId: { rowId: rowRecord.id, columnId: column.id } },
              update: {
                ...fields,
                ...alreadyBookedFields,
                updatedById: employeeId,
              },
              create: {
                rowId: rowRecord.id,
                columnId: column.id,
                ...fields,
                ...alreadyBookedFields,
                createdById: employeeId,
                updatedById: employeeId,
              },
            });
          }

          savedRowKeys.push(rowKey);
        }

        return { savedRowKeys, updatedAt: mutationTime };
      },
      { timeout: 30000 },
    );

    return res.json({
      message: "Changes saved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

// Saves only the per-client "already booked with another company" badge.
// This is intentionally separate from the normal row save so clicking the
// badge never commits unrelated cell edits that are still being typed.
export async function setWorkspaceRowAlreadyBooked(req, res, next) {
  const employeeId = Number(req.employee?.id || 0) || null;
  const rowKey = String(req.params?.rowKey || "").trim();

  if (!rowKey) {
    return res.status(422).json({ message: "A valid client row is required." });
  }
  if (typeof req.body?.alreadyBooked !== "boolean") {
    return res.status(422).json({ message: "A valid booking badge value is required." });
  }

  const alreadyBooked = req.body.alreadyBooked;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sheet = await getDefaultSheet(tx);

      const row = await tx.sheetRow.findUnique({
        where: {
          sheetId_rowKey: {
            sheetId: sheet.id,
            rowKey,
          },
        },
        select: { id: true, rowKey: true, isArchived: true },
      });

      if (!row || row.isArchived) {
        return null;
      }

      const eventDateColumn = await tx.sheetColumn.findUnique({
        where: {
          sheetId_columnKey: {
            sheetId: sheet.id,
            columnKey: "event_date",
          },
        },
        select: { id: true, dataType: true },
      });

      if (!eventDateColumn) {
        const configurationError = new Error(
          "Event Date column is missing from the Management sheet.",
        );
        configurationError.statusCode = 409;
        throw configurationError;
      }

      const existingCell = await tx.sheetCell.findUnique({
        where: {
          rowId_columnId: {
            rowId: row.id,
            columnId: eventDateColumn.id,
          },
        },
        select: { id: true },
      });

      if (existingCell) {
        await tx.sheetCell.update({
          where: { id: existingCell.id },
          data: {
            alreadyBooked,
            updatedById: employeeId,
          },
        });
      } else {
        // Current Management saves normally create an Event Date cell for every
        // saved client (blank dates become N/A). Keep this fallback so older or
        // manually-migrated rows can still use the badge safely.
        const fallbackFields = await buildCellValueFields(
          tx,
          "N/A",
          eventDateColumn.dataType,
        );
        await tx.sheetCell.create({
          data: {
            rowId: row.id,
            columnId: eventDateColumn.id,
            ...fallbackFields,
            alreadyBooked,
            createdById: employeeId,
            updatedById: employeeId,
          },
        });
      }

      const mutationTime = new Date();
      await tx.sheetRow.update({
        where: { id: row.id },
        data: { updatedById: employeeId },
      });
      await tx.managementSheet.update({
        where: { id: sheet.id },
        data: { updatedById: employeeId, updatedAt: mutationTime },
      });

      return {
        rowKey: row.rowKey,
        alreadyBooked,
        updatedAt: mutationTime,
      };
    });

    if (!result) {
      return res.status(404).json({
        message:
          "This client no longer exists. Another employee may have deleted it; refresh the Management page.",
      });
    }

    return res.json({
      message: alreadyBooked
        ? "Client marked as booked with another company."
        : "Client booking badge removed.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

// One transaction handles both the original one-row delete button and the new
// multi-select delete action. It avoids the old expensive pattern of sending
// and rewriting the entire remaining worksheet just to remove a few clients.
export async function deleteWorkspaceRows(req, res, next) {
  const employeeId = Number(req.employee?.id || 0) || null;
  const rowKeys = Array.isArray(req.body?.rowKeys)
    ? [...new Set(req.body.rowKeys.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

  if (!rowKeys.length) {
    return res.status(422).json({ message: "Select at least one client to delete." });
  }
  if (rowKeys.length > 500) {
    return res.status(422).json({ message: "Delete at most 500 clients at a time." });
  }

  let imageFileNames = [];

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sheet = await getDefaultSheet(tx);
        const mutationTime = new Date();

        // Serialize row mutations on this shared sheet for predictable results
        // when several employees save/delete at the same time.
        await tx.managementSheet.update({
          where: { id: sheet.id },
          data: { updatedById: employeeId, updatedAt: mutationTime },
        });

        const existingRows = await tx.sheetRow.findMany({
          where: {
            sheetId: sheet.id,
            isArchived: false,
            rowKey: { in: rowKeys },
          },
          select: { rowKey: true },
        });
        const existingRowKeys = existingRows.map((row) => row.rowKey);

        if (!existingRowKeys.length) {
          return { deletedRowKeys: [], updatedAt: mutationTime };
        }

        imageFileNames = await deleteClientDataForRowKeys(tx, existingRowKeys);

        await tx.sheetRow.deleteMany({
          where: { sheetId: sheet.id, rowKey: { in: existingRowKeys } },
        });

        return { deletedRowKeys: existingRowKeys, updatedAt: mutationTime };
      },
      { timeout: 30000 },
    );

    // Delete image files only after the DB transaction committed. If a DB
    // constraint/error rolls the transaction back, its image files remain.
    removeMeetingImageFiles(imageFileNames);

    return res.json({
      message:
        result.deletedRowKeys.length === 1
          ? "Client deleted successfully."
          : `${result.deletedRowKeys.length} clients deleted successfully.`,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function saveWorkspace(req, res, next) {
  const workspace = req.body.workspace;
  // Always trust the authenticated session, never a caller-supplied employeeId.
  const employeeId = Number(req.employee?.id || 0) || null;

  if (!workspace || !Array.isArray(workspace.columns) || !Array.isArray(workspace.rows)) {
    return res.status(422).json({ message: "A valid workspace payload is required." });
  }

  let imageFileNames = [];

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

            const fields = await buildCellValueFields(tx, rawValue, column.dataType);
            // "Already booked with another company" is a per-row flag, but it's
            // stored on the row's Event Date cell (see the badge button beside
            // it on the frontend) since sheet_cells is the only per-row table.
            const isEventDateColumn = columnKey === "event_date";
            const alreadyBookedFields = isEventDateColumn ? { alreadyBooked: Boolean(row.alreadyBooked) } : {};

            await tx.sheetCell.upsert({
              where: { rowId_columnId: { rowId, columnId: column.id } },
              update: {
                ...fields,
                ...alreadyBookedFields,
                updatedById: employeeId,
              },
              create: {
                rowId,
                columnId: column.id,
                ...fields,
                ...alreadyBookedFields,
                createdById: employeeId,
                updatedById: employeeId,
              },
            });
          }
        }

        imageFileNames = await deleteClientDataForRowKeys(tx, rowKeysBeingRemoved);

        await tx.managementSheet.update({
          where: { id: sheet.id },
          data: { updatedById: employeeId, updatedAt: new Date() },
        });
      },
      { timeout: 30000 },
    );

    removeMeetingImageFiles(imageFileNames);
    res.json({ message: "Workspace saved successfully." });
  } catch (error) {
    next(error);
  }
}
