import { prisma } from "../config/prisma.js";
import { formatDateOnly, formatTimeOnly, formatDateTime, nowInBusinessTimezone } from "../utils/dbDates.js";
import { computeMeetingCallTimes } from "../utils/meetingCallTimes.js";

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

// The handful of worksheet columns shown on a client's dashboard card —
// looked up by name (not columnKey) since every default/custom sheet is
// expected to define these, but a custom sheet missing one just renders blank.
const CLIENT_DETAIL_COLUMNS = ["Client Name", "Venue", "Shift", "Client Phone Number", "Guest Count", "Event Date"];

// Batched lookup (one query for every row) of the display columns above,
// keyed by rowKey then column name.
async function resolveClientDetails(sheetId, rowKeys) {
  const detailsByRowKey = new Map();
  const uniqueRowKeys = [...new Set(rowKeys)];
  if (!sheetId || !uniqueRowKeys.length) return detailsByRowKey;

  const columns = await prisma.sheetColumn.findMany({
    where: { sheetId, isActive: true, columnName: { in: CLIENT_DETAIL_COLUMNS } },
    select: { id: true, columnName: true },
  });
  const columnNameById = new Map(columns.map((c) => [c.id, c.columnName]));

  const rows = await prisma.sheetRow.findMany({
    where: { sheetId, rowKey: { in: uniqueRowKeys } },
    select: {
      rowKey: true,
      cells: {
        where: { columnId: { in: columns.map((c) => c.id) } },
        select: { columnId: true, valueText: true, displayValue: true },
      },
    },
  });

  for (const row of rows) {
    const details = {};
    for (const cell of row.cells) {
      const name = columnNameById.get(cell.columnId);
      if (!name) continue;
      details[name] = cell.valueText ?? cell.displayValue ?? "";
    }
    detailsByRowKey.set(row.rowKey, details);
  }
  return detailsByRowKey;
}

// ─── GET /api/admin/dashboard — system-wide employee & client overview ──
export async function getAdminDashboard(req, res, next) {
  try {
    const now = nowInBusinessTimezone();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgo = new Date(now.getTime() - oneWeekMs);
    const weekAhead = new Date(now.getTime() + oneWeekMs);
    const sheetId = await getDefaultSheetId();

    const [
      employees,
      meetingsDoneWeekGroups,
      callsDoneWeekGroups,
      upcomingMeetingsWeekGroups,
      upcomingCallsWeekGroups,
      meetingsDoneAllGroups,
      callsDoneAllGroups,
      upcomingMeetingsAllGroups,
      upcomingCallsAllGroups,
      meetingsByRow,
      callsByRow,
      activeRows,
    ] = await Promise.all([
      prisma.employee.findMany({
        // Admins aren't employees — exclude them from the dashboard's staff list/stats.
        where: { role: { name: { not: "Admin" } } },
        include: { role: true },
        orderBy: { fullName: "asc" },
      }),
      // Last-7-days counts — used only for the top summary cards.
      prisma.clientMeeting.groupBy({
        by: ["createdById"],
        where: { meetingDatetime: { gte: weekAgo, lte: now } },
        _count: { _all: true },
      }),
      prisma.clientCall.groupBy({
        by: ["createdById"],
        where: { callDatetime: { gte: weekAgo, lte: now } },
        _count: { _all: true },
      }),
      prisma.clientNextMeeting.groupBy({
        by: ["assignedEmployeeId"],
        where: { nextMeetingDatetime: { gte: now, lte: weekAhead } },
        _count: { _all: true },
      }),
      prisma.clientNextCall.groupBy({
        by: ["assignedEmployeeId"],
        where: { nextCallDatetime: { gte: now, lte: weekAhead } },
        _count: { _all: true },
      }),
      // All-time counts — used for the per-employee "All Employees" table.
      // "Done" = the scheduled moment has already passed (meetingDatetime
      // is null for a freshly-added, not-yet-scheduled meeting — Prisma's
      // `lte` comparison naturally excludes those nulls).
      prisma.clientMeeting.groupBy({
        by: ["createdById"],
        where: { meetingDatetime: { lte: now } },
        _count: { _all: true },
      }),
      prisma.clientCall.groupBy({
        by: ["createdById"],
        where: { callDatetime: { lte: now } },
        _count: { _all: true },
      }),
      prisma.clientNextMeeting.groupBy({
        by: ["assignedEmployeeId"],
        where: { nextMeetingDatetime: { gte: now } },
        _count: { _all: true },
      }),
      prisma.clientNextCall.groupBy({
        by: ["assignedEmployeeId"],
        where: { nextCallDatetime: { gte: now } },
        _count: { _all: true },
      }),
      prisma.clientMeeting.groupBy({
        by: ["linkedRowKey"],
        _count: { _all: true },
        _max: { meetingDatetime: true, updatedAt: true },
      }),
      prisma.clientCall.groupBy({
        by: ["linkedRowKey"],
        _count: { _all: true },
        _max: { callDatetime: true, updatedAt: true },
      }),
      sheetId
        ? prisma.sheetRow.findMany({
            where: { sheetId, isArchived: false },
            select: { rowKey: true, createdAt: true },
          })
        : [],
    ]);

    const sumCounts = (groups) => groups.reduce((sum, g) => sum + g._count._all, 0);

    const meetingsDoneAllById     = new Map(meetingsDoneAllGroups.map((g) => [String(g.createdById), g._count._all]));
    const callsDoneAllById        = new Map(callsDoneAllGroups.map((g) => [String(g.createdById), g._count._all]));
    const upcomingMeetingsAllById = new Map(upcomingMeetingsAllGroups.map((g) => [String(g.assignedEmployeeId), g._count._all]));
    const upcomingCallsAllById    = new Map(upcomingCallsAllGroups.map((g) => [String(g.assignedEmployeeId), g._count._all]));

    const employeeStats = employees.map((employee) => {
      const key = String(employee.id);
      return {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role?.name || null,
        isActive: Boolean(employee.isActive),
        colorHex: employee.colorHex || null,
        meetingsDone: meetingsDoneAllById.get(key) || 0,
        callsDone: callsDoneAllById.get(key) || 0,
        upcomingMeetings: upcomingMeetingsAllById.get(key) || 0,
        upcomingCalls: upcomingCallsAllById.get(key) || 0,
      };
    });

    const meetingStatsByRow = new Map(meetingsByRow.map((g) => [g.linkedRowKey, g]));
    const callStatsByRow    = new Map(callsByRow.map((g) => [g.linkedRowKey, g]));
    const detailsByRowKey   = await resolveClientDetails(sheetId, activeRows.map((r) => r.rowKey));

    const clients = activeRows.map((row) => {
      const m = meetingStatsByRow.get(row.rowKey);
      const c = callStatsByRow.get(row.rowKey);
      const meetingsCount = m?._count?._all || 0;
      const callsCount = c?._count?._all || 0;
      const lastActivityAt = [m?._max?.meetingDatetime, m?._max?.updatedAt, c?._max?.callDatetime, c?._max?.updatedAt, row.createdAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
        .reduce((max, t) => (t > max ? t : max), 0);
      const details = detailsByRowKey.get(row.rowKey) || {};

      return {
        rowKey: row.rowKey,
        clientName: details["Client Name"] || "Unnamed client",
        venue: details["Venue"] || "",
        shift: details["Shift"] || "",
        phone: details["Client Phone Number"] || "",
        guestCount: details["Guest Count"] || "",
        eventDate: details["Event Date"] || "",
        meetingsCount,
        callsCount,
        totalActivity: meetingsCount + callsCount,
        lastActivityAt: lastActivityAt ? formatDateTime(new Date(lastActivityAt)) : null,
      };
    });

    // Most active first (meetings + calls combined), then most recently active.
    clients.sort((a, b) => {
      if (b.totalActivity !== a.totalActivity) return b.totalActivity - a.totalActivity;
      return (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "");
    });

    const totals = {
      employees: employees.length,
      activeEmployees: employees.filter((e) => e.isActive).length,
      meetingsDone: sumCounts(meetingsDoneWeekGroups),
      callsDone: sumCounts(callsDoneWeekGroups),
      upcomingMeetings: sumCounts(upcomingMeetingsWeekGroups),
      upcomingCalls: sumCounts(upcomingCallsWeekGroups),
      clients: clients.length,
    };

    res.json({ data: { employees: employeeStats, clients, totals } });
  } catch (error) {
    next(error);
  }
}

// Mirrors adminCalendarController.js's cellValueFromRow so this page shows
// every worksheet column using the same value-extraction rules everywhere.
function cellValueFromRow(cell, dataType) {
  if (dataType === "boolean")                          return cell.valueBoolean;
  if (dataType === "integer")                          return cell.valueInteger;
  if (["decimal", "currency"].includes(dataType))      return cell.valueDecimal;
  if (dataType === "date")                             return formatDateOnly(cell.valueDate) || "";
  if (dataType === "time")                             return formatTimeOnly(cell.valueTime) || "";
  if (["datetime", "last_meeting_time", "next_meeting_time"].includes(dataType)) return formatDateTime(cell.valueDatetime) || "";
  if (dataType === "employee")                         return cell.valueEmployee?.fullName || cell.displayValue || "";
  return cell.valueText ?? cell.displayValue ?? "";
}

// ─── GET /api/admin/dashboard/clients/:rowKey — one client's full profile ──
export async function getClientDetail(req, res, next) {
  try {
    const rowKey = String(req.params.rowKey || "").trim();
    if (!rowKey) return res.status(400).json({ message: "A client row key is required." });

    const sheetId = await getDefaultSheetId();
    if (!sheetId) return res.status(404).json({ message: "No active worksheet found." });

    const [row, allColumns, meetings, calls, finalization, timesByRowKey] = await Promise.all([
      prisma.sheetRow.findFirst({
        where: { sheetId, rowKey },
        select: { rowKey: true, createdAt: true, isArchived: true },
      }),
      prisma.sheetColumn.findMany({
        where: { sheetId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      }),
      prisma.clientMeeting.findMany({
        where: { linkedRowKey: rowKey },
        include: {
          createdBy: { select: { fullName: true } },
          completedBy: { select: { fullName: true } },
          assignedBy: { select: { fullName: true } },
          nextMeeting: { include: { assignedEmployee: { select: { fullName: true } } } },
        },
        orderBy: { id: "desc" },
      }),
      prisma.clientCall.findMany({
        where: { linkedRowKey: rowKey },
        include: {
          createdBy: { select: { fullName: true } },
          assignedBy: { select: { fullName: true } },
          nextCall: { include: { assignedEmployee: { select: { fullName: true } } } },
        },
        orderBy: { id: "desc" },
      }),
      prisma.clientFinalization.findUnique({
        where: { linkedRowKey: rowKey },
        include: { finalizedBy: { select: { fullName: true } } },
      }),
      computeMeetingCallTimes([rowKey]),
    ]);

    if (!row) return res.status(404).json({ message: "Client not found." });

    const cells = await prisma.sheetCell.findMany({
      where: { row: { sheetId, rowKey }, columnId: { in: allColumns.map((c) => c.id) } },
      include: { valueEmployee: { select: { fullName: true } } },
    });
    const cellByColumnId = new Map(cells.map((c) => [c.columnId, c]));
    const times = timesByRowKey.get(rowKey);

    const columns = allColumns.map((col) => {
      if (col.dataType === "last_meeting_time") {
        return { name: col.columnName, value: formatDateTime(times?.lastMeeting || times?.lastCall) || "" };
      }
      if (col.dataType === "next_meeting_time") {
        return { name: col.columnName, value: formatDateTime(times?.nextMeeting || times?.nextCall) || "" };
      }
      const cell = cellByColumnId.get(col.id);
      return { name: col.columnName, value: cell ? cellValueFromRow(cell, col.dataType) : "" };
    });

    res.json({
      data: {
        rowKey: row.rowKey,
        columns,
        totals: { meetingsCount: meetings.length, callsCount: calls.length },
        finalization: finalization
          ? {
              finalizedAt: formatDateTime(finalization.finalizedAt),
              finalizedByName: finalization.finalizedBy?.fullName || null,
            }
          : null,
        meetings: meetings.map((m) => ({
          id: m.id,
          meetingDatetime: formatDateTime(m.meetingDatetime),
          isCompleted: m.isCompleted,
          discussionNotes: m.discussionNotes,
          createdByName: m.createdBy?.fullName || null,
          completedByName: m.completedBy?.fullName || null,
          assignedByEmployeeName: m.assignedBy?.fullName || null,
          nextMeeting: m.nextMeeting
            ? {
                nextMeetingDatetime: formatDateTime(m.nextMeeting.nextMeetingDatetime),
                assignedEmployeeName: m.nextMeeting.assignedEmployee?.fullName || null,
              }
            : null,
        })),
        calls: calls.map((c) => ({
          id: c.id,
          callDatetime: formatDateTime(c.callDatetime),
          callDiscussion: c.callDiscussion,
          createdByName: c.createdBy?.fullName || null,
          assignedByEmployeeName: c.assignedBy?.fullName || null,
          nextCall: c.nextCall
            ? {
                nextCallDatetime: formatDateTime(c.nextCall.nextCallDatetime),
                assignedEmployeeName: c.nextCall.assignedEmployee?.fullName || null,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

