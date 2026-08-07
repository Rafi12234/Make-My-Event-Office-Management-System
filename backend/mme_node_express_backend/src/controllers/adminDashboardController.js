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
    const sheetId = await getDefaultSheetId();

    const [
      employees,
      meetingsDoneGroups,
      callsDoneGroups,
      upcomingMeetingsGroups,
      upcomingCallsGroups,
      meetingsByRow,
      callsByRow,
      activeRows,
    ] = await Promise.all([
      prisma.employee.findMany({
        include: { role: true },
        orderBy: { fullName: "asc" },
      }),
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

    const meetingsDoneById     = new Map(meetingsDoneGroups.map((g) => [String(g.createdById), g._count._all]));
    const callsDoneById        = new Map(callsDoneGroups.map((g) => [String(g.createdById), g._count._all]));
    const upcomingMeetingsById = new Map(upcomingMeetingsGroups.map((g) => [String(g.assignedEmployeeId), g._count._all]));
    const upcomingCallsById    = new Map(upcomingCallsGroups.map((g) => [String(g.assignedEmployeeId), g._count._all]));

    const employeeStats = employees.map((employee) => {
      const key = String(employee.id);
      return {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role?.name || null,
        isActive: Boolean(employee.isActive),
        colorHex: employee.colorHex || null,
        meetingsDone: meetingsDoneById.get(key) || 0,
        callsDone: callsDoneById.get(key) || 0,
        upcomingMeetings: upcomingMeetingsById.get(key) || 0,
        upcomingCalls: upcomingCallsById.get(key) || 0,
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
      meetingsDone: employeeStats.reduce((sum, e) => sum + e.meetingsDone, 0),
      callsDone: employeeStats.reduce((sum, e) => sum + e.callsDone, 0),
      upcomingMeetings: employeeStats.reduce((sum, e) => sum + e.upcomingMeetings, 0),
      upcomingCalls: employeeStats.reduce((sum, e) => sum + e.upcomingCalls, 0),
      clients: clients.length,
    };

    res.json({ data: { employees: employeeStats, clients, totals } });
  } catch (error) {
    next(error);
  }
}

