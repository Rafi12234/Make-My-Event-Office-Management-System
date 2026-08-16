import { prisma } from "../config/prisma.js";
import { formatDateOnly, formatTimeOnly, formatDateTime } from "../utils/dbDates.js";
import { computeMeetingCallTimes } from "../utils/meetingCallTimes.js";

// ─── Helpers ───────────────────────────────────────────────────

// Deterministic fallback so every employee gets a distinct calendar color
// even before an admin explicitly sets employees.color_hex. Each hue below
// is picked far apart on the color wheel (no two shades of the same base
// color) so adjacent employees never look alike, even as light tints.
const COLOR_PALETTE = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#d97706", // amber
  "#db2777", // magenta
  "#0e7490", // teal
  "#4d7c0f", // olive
  "#334155", // slate
  "#c2410c", // burnt orange
];

// Colors are assigned by each employee's POSITION in the active-employee
// list, not a hash of their id — hashing (e.g. id % palette.length) can
// collide for two different ids that share the same remainder, silently
// handing two employees the same color. Position-based assignment
// guarantees every employee gets a distinct palette slot as long as the
// active headcount doesn't exceed the palette size.
function colorForEmployee(employee, index) {
  if (employee.colorHex) return employee.colorHex;
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function pad(n) { return String(n).padStart(2, "0"); }

function extractDate(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function extractTime(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[1].substring(0, 5);
}

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

// Mirrors calendarController.js's cellValueFromRow so the admin hover card
// can show the same worksheet detail fields (venue, shift, phone, floor,
// guest count, etc.) as the employee CalendarPage hover card.
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

// Batched client-name + full row-detail lookup (single query for every row
// involved), matching what calendarController.js gives the employee
// CalendarPage hover card — every worksheet column's value, not just the
// client's name, so the admin hover card can show the same detail fields
// (venue, shift, phone, floor, guest count, etc.).
async function resolveRowDetails(sheetId, rowKeys) {
  const namesByRowKey = new Map();
  const rowDataByRowKey = new Map();
  let worksheetColumns = [];
  const uniqueRowKeys = [...new Set(rowKeys)];
  if (!sheetId || !uniqueRowKeys.length) return { namesByRowKey, rowDataByRowKey, worksheetColumns };

  const allColumns = await prisma.sheetColumn.findMany({
    where: { sheetId, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });
  worksheetColumns = allColumns.map((c) => ({ key: c.columnKey, name: c.columnName, type: c.dataType }));
  const columnMap = new Map(allColumns.map((c) => [c.id, c]));
  const clientNameCol = allColumns.find((c) => c.columnName.toLowerCase() === "client name");

  const rows = await prisma.sheetRow.findMany({
    where: { sheetId, rowKey: { in: uniqueRowKeys } },
    select: {
      rowKey: true,
      cells: { include: { valueEmployee: { select: { fullName: true } } } },
    },
  });

  for (const row of rows) {
    const rowData = {};
    for (const cell of row.cells) {
      const col = columnMap.get(cell.columnId);
      if (!col) continue;
      rowData[col.columnKey] = cellValueFromRow(cell, col.dataType);
    }
    rowDataByRowKey.set(row.rowKey, rowData);
    namesByRowKey.set(row.rowKey, clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "");
  }

  // "Last/Next Meeting Time" cells are never persisted (computed live) —
  // fill them in the same way calendarController.js does, scoped across
  // ALL employees (no employeeId filter) since this is the admin's
  // company-wide view of each client's row.
  const meetingTimeColumns = allColumns.filter((c) => c.dataType === "last_meeting_time" || c.dataType === "next_meeting_time");
  if (meetingTimeColumns.length) {
    const timesByRowKey = await computeMeetingCallTimes(uniqueRowKeys);
    for (const rowKey of uniqueRowKeys) {
      const rowData = rowDataByRowKey.get(rowKey);
      if (!rowData) continue;
      const times = timesByRowKey.get(rowKey);
      for (const col of meetingTimeColumns) {
        const isLast = col.dataType === "last_meeting_time";
        const meetingRaw = isLast ? times?.lastMeeting : times?.nextMeeting;
        const callRaw    = isLast ? times?.lastCall    : times?.nextCall;
        rowData[col.columnKey] = formatDateTime(meetingRaw || callRaw) || "";
        // Kept separately so callers can show "Last/Next Call Time" for a
        // call event instead of the ambiguous meeting-or-call merged value.
        rowData[`${col.columnKey}__meeting`] = formatDateTime(meetingRaw) || "";
        rowData[`${col.columnKey}__call`]    = formatDateTime(callRaw) || "";
      }
    }
  }

  return { namesByRowKey, rowDataByRowKey, worksheetColumns };
}

// ─── GET /api/admin/calendar?year=YYYY&month=M ──────────────────
// Company-wide calendar — every employee's meetings, calls, and their
// scheduled next-meeting/next-call follow-ups, each tagged with the
// responsible employee's id/name/color for the legend + colored pills.
export async function getAdminCalendarMonth(req, res, next) {
  const year  = parseInt(req.query.year,  10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);

  const startDate   = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate     = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const rangeStart  = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEnd    = new Date(`${endDate}T23:59:59.999Z`);

  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true, NOT: { role: { name: "Admin" } } },
      select: { id: true, fullName: true, colorHex: true },
      orderBy: { fullName: "asc" },
    });

    const colorByEmployeeId = new Map(employees.map((e, i) => [String(e.id), colorForEmployee(e, i)]));
    const employeeById = new Map(employees.map((e) => [String(e.id), e]));

    function employeeTag(empId) {
      if (!empId) return { employeeId: null, employeeName: null, employeeColor: null };
      const emp = employeeById.get(String(empId));
      if (!emp) return { employeeId: null, employeeName: null, employeeColor: null };
      return { employeeId: Number(emp.id), employeeName: emp.fullName, employeeColor: colorByEmployeeId.get(String(emp.id)) };
    }

    const sheetId = await getDefaultSheetId();

    const [meetings, calls, nextMeetings, nextCalls] = await Promise.all([
      prisma.clientMeeting.findMany({
        where: { meetingDatetime: { gte: rangeStart, lte: rangeEnd } },
        select: {
          id: true, linkedRowKey: true, meetingDatetime: true, isCompleted: true,
          discussionNotes: true, requirements: true, createdById: true,
          nextMeeting: {
            select: {
              nextMeetingDatetime: true, assignedEmployeeId: true,
              assignedEmployee: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.clientCall.findMany({
        where: { callDatetime: { gte: rangeStart, lte: rangeEnd } },
        select: {
          id: true, linkedRowKey: true, callDatetime: true, callDiscussion: true, createdById: true,
          nextCall: {
            select: {
              nextCallDatetime: true, assignedEmployeeId: true,
              assignedEmployee: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.clientNextMeeting.findMany({
        where: { nextMeetingDatetime: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, meetingId: true, linkedRowKey: true, nextMeetingDatetime: true, assignedEmployeeId: true, createdById: true },
      }),
      prisma.clientNextCall.findMany({
        where: { nextCallDatetime: { gte: rangeStart, lte: rangeEnd } },
        select: { id: true, callId: true, linkedRowKey: true, nextCallDatetime: true, assignedEmployeeId: true, createdById: true },
      }),
    ]);

    const rowKeys = [
      ...meetings.map((m) => m.linkedRowKey),
      ...calls.map((c) => c.linkedRowKey),
      ...nextMeetings.map((n) => n.linkedRowKey),
      ...nextCalls.map((n) => n.linkedRowKey),
    ];
    const { namesByRowKey, rowDataByRowKey, worksheetColumns } = await resolveRowDetails(sheetId, rowKeys);
    const now = new Date();

    const events = [];

    for (const m of meetings) {
      events.push({
        id: `meeting_${m.id}`,
        source: "meeting",
        date: extractDate(m.meetingDatetime),
        time: extractTime(m.meetingDatetime),
        clientName: namesByRowKey.get(m.linkedRowKey) || "",
        rowKey: m.linkedRowKey,
        notes: m.discussionNotes,
        requirements: m.requirements || null,
        isCompleted: m.isCompleted,
        meetingId: m.id,
        nextMeetingDatetime: formatDateTime(m.nextMeeting?.nextMeetingDatetime),
        nextMeetingAssignedEmployeeId: m.nextMeeting?.assignedEmployeeId ?? null,
        nextMeetingAssignedEmployeeName: m.nextMeeting?.assignedEmployee?.fullName || null,
        ...employeeTag(m.createdById),
      });
    }

    for (const c of calls) {
      events.push({
        id: `call_${c.id}`,
        source: "call",
        date: extractDate(c.callDatetime),
        time: extractTime(c.callDatetime),
        clientName: namesByRowKey.get(c.linkedRowKey) || "",
        rowKey: c.linkedRowKey,
        notes: c.callDiscussion,
        callId: c.id,
        nextCallDatetime: formatDateTime(c.nextCall?.nextCallDatetime),
        nextCallAssignedEmployeeId: c.nextCall?.assignedEmployeeId ?? null,
        nextCallAssignedEmployeeName: c.nextCall?.assignedEmployee?.fullName || null,
        ...employeeTag(c.createdById),
      });
    }

    for (const n of nextMeetings) {
      events.push({
        id: `next_meeting_${n.id}`,
        source: "next_meeting",
        date: extractDate(n.nextMeetingDatetime),
        time: extractTime(n.nextMeetingDatetime),
        clientName: namesByRowKey.get(n.linkedRowKey) || "",
        rowKey: n.linkedRowKey,
        missed: n.nextMeetingDatetime < now,
        meetingId: n.meetingId,
        assignedEmployeeIdRaw: n.assignedEmployeeId,
        ...employeeTag(n.assignedEmployeeId || n.createdById),
      });
    }

    for (const n of nextCalls) {
      events.push({
        id: `next_call_${n.id}`,
        source: "next_call",
        date: extractDate(n.nextCallDatetime),
        time: extractTime(n.nextCallDatetime),
        clientName: namesByRowKey.get(n.linkedRowKey) || "",
        rowKey: n.linkedRowKey,
        missed: n.nextCallDatetime < now,
        callId: n.callId,
        assignedEmployeeIdRaw: n.assignedEmployeeId,
        ...employeeTag(n.assignedEmployeeId || n.createdById),
      });
    }

    events.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));

    res.json({
      data: {
        events,
        worksheetColumns,
        rowData: Object.fromEntries(rowDataByRowKey),
        employees: employees.map((e) => ({
          id: Number(e.id),
          fullName: e.fullName,
          color: colorByEmployeeId.get(String(e.id)),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
