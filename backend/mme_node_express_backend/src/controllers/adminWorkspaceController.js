import { prisma } from "../config/prisma.js";
import { formatDateTime } from "../utils/dbDates.js";
import { computeMeetingCallTimes } from "../utils/meetingCallTimes.js";
import { cellValue, buildCellValueFields, DB_TO_FRONTEND_TYPE } from "./workspaceController.js";

async function getDefaultSheet() {
  return prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, sheetName: true },
  });
}

// ─── GET /api/admin/workspace — read-only mirror of the employee side's
// GET /api/workspace/default (workspaceController.js's getWorkspace), for
// the admin "Client Informations & Management" page. Same live dynamic
// columns/rows every employee edits, minus the Last/Next Meeting Time
// (LAT/NAT) columns, which only make sense in the employee-editing context.
export async function getAdminWorkspace(req, res, next) {
  try {
    const sheet = await getDefaultSheet();
    if (!sheet) {
      return res.json({ data: { id: null, name: "Meeting Management", columns: [], rows: [] } });
    }

    const columns = await prisma.sheetColumn.findMany({
      where: {
        sheetId: sheet.id,
        isActive: true,
        isVisible: true,
        dataType: { notIn: ["last_meeting_time", "next_meeting_time"] },
      },
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
        where: { rowId: { in: rowIds }, columnId: { in: columns.map((c) => c.id) } },
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

    // The Meeting/Call hover buttons still need each row's next-call
    // schedule for their "Upcoming" list, even though the LAT/NAT columns
    // themselves aren't part of this read-only admin table.
    const timeSummaryByRowKey = new Map();
    if (rows.length) {
      const timesByRowKey = await computeMeetingCallTimes(rows.map((row) => row.rowKey));
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

// ─── PATCH /api/admin/workspace/rows/:rowKey — edit a single client cell
// from the admin side. Deliberately scoped to one cell (not a whole-sheet
// replace like the employee side's saveWorkspace) so an admin's read-only
// view — which omits the LAT/NAT columns — can never accidentally
// deactivate those columns or drop rows missing from its payload.
export async function updateAdminWorkspaceCell(req, res, next) {
  const { rowKey } = req.params;
  const columnKey = String(req.body.columnKey || "");
  const rawValue = req.body.value;

  if (!rowKey || !columnKey) {
    return res.status(422).json({ message: "columnKey is required." });
  }

  try {
    const sheet = await getDefaultSheet();
    if (!sheet) return res.status(404).json({ message: "Workspace not found." });

    const column = await prisma.sheetColumn.findUnique({
      where: { sheetId_columnKey: { sheetId: sheet.id, columnKey } },
    });
    if (!column || !column.isActive) {
      return res.status(404).json({ message: "Column not found." });
    }
    if (column.dataType === "last_meeting_time" || column.dataType === "next_meeting_time") {
      return res.status(400).json({ message: "This column is computed automatically and can't be edited." });
    }

    const row = await prisma.sheetRow.findUnique({
      where: { sheetId_rowKey: { sheetId: sheet.id, rowKey: String(rowKey) } },
    });
    if (!row || row.isArchived) {
      return res.status(404).json({ message: "Client row not found." });
    }

    const fields = await buildCellValueFields(prisma, rawValue, column.dataType);
    const adminId = req.adminId;

    await prisma.$transaction([
      prisma.sheetCell.upsert({
        where: { rowId_columnId: { rowId: row.id, columnId: column.id } },
        update: { ...fields, updatedById: adminId },
        create: { rowId: row.id, columnId: column.id, ...fields, createdById: adminId, updatedById: adminId },
      }),
      prisma.sheetRow.update({ where: { id: row.id }, data: { updatedById: adminId } }),
    ]);

    const savedCell = await prisma.sheetCell.findUnique({
      where: { rowId_columnId: { rowId: row.id, columnId: column.id } },
      include: { valueEmployee: { select: { fullName: true } } },
    });

    res.json({ data: { value: cellValue(savedCell, column.dataType) } });
  } catch (error) {
    next(error);
  }
}
