import { prisma } from "../config/prisma.js";
import { formatDateTime, parseDateTimeLocal } from "../utils/dbDates.js";

// ─── Helpers ────────────────────────────────────────────────────

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

// Batched client-name lookup (single query for every row involved), unlike
// the per-row helper in callsController.js/meetingsController.js — this
// controller lists ALL clients at once so an N+1 query per row would scale
// badly with the number of meetings/calls in the system.
async function resolveClientNames(sheetId, rowKeys) {
  const namesByRowKey = new Map();
  if (!sheetId || !rowKeys.length) return namesByRowKey;

  const rows = await prisma.sheetRow.findMany({
    where: { sheetId, rowKey: { in: [...new Set(rowKeys)] } },
    select: {
      rowKey: true,
      cells: {
        where: { column: { columnName: { equals: "Client Name" } } },
        select: { valueText: true, displayValue: true },
        take: 1,
      },
    },
  });

  for (const row of rows) {
    const cell = row.cells?.[0];
    namesByRowKey.set(row.rowKey, cell?.valueText || cell?.displayValue || "");
  }
  return namesByRowKey;
}

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ─── GET /api/admin/meetings — every meeting, every employee ───────

export async function listAllMeetings(req, res, next) {
  try {
    const sheetId = await getDefaultSheetId();

    const meetings = await prisma.clientMeeting.findMany({
      include: {
        createdBy: { select: { fullName: true } },
        assignedBy: { select: { fullName: true } },
        nextMeeting: {
          select: {
            id: true,
            nextMeetingDatetime: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ meetingDatetime: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    });

    const namesByRowKey = await resolveClientNames(sheetId, meetings.map((m) => m.linkedRowKey));

    res.json({
      data: meetings.map((meeting) => ({
        id: meeting.id,
        rowKey: meeting.linkedRowKey,
        clientName: namesByRowKey.get(meeting.linkedRowKey) || "",
        meetingDatetime: formatDateTime(meeting.meetingDatetime),
        isCompleted: meeting.isCompleted,
        createdByName: meeting.createdBy?.fullName || null,
        assignedByEmployeeName: meeting.assignedBy?.fullName || null,
        nextMeeting: meeting.nextMeeting
          ? {
              id: meeting.nextMeeting.id,
              nextMeetingDatetime: formatDateTime(meeting.nextMeeting.nextMeetingDatetime),
              assignedEmployeeId: meeting.nextMeeting.assignedEmployeeId,
              assignedEmployeeName: meeting.nextMeeting.assignedEmployee?.fullName || null,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/calls — every call, every employee ─────────────

export async function listAllCalls(req, res, next) {
  try {
    const sheetId = await getDefaultSheetId();

    const calls = await prisma.clientCall.findMany({
      include: {
        createdBy: { select: { fullName: true } },
        assignedBy: { select: { fullName: true } },
        nextCall: {
          select: {
            id: true,
            nextCallDatetime: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ callDatetime: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    });

    const namesByRowKey = await resolveClientNames(sheetId, calls.map((c) => c.linkedRowKey));

    res.json({
      data: calls.map((call) => ({
        id: call.id,
        rowKey: call.linkedRowKey,
        clientName: namesByRowKey.get(call.linkedRowKey) || "",
        callDatetime: formatDateTime(call.callDatetime),
        createdByName: call.createdBy?.fullName || null,
        assignedByEmployeeName: call.assignedBy?.fullName || null,
        nextCall: call.nextCall
          ? {
              id: call.nextCall.id,
              nextCallDatetime: formatDateTime(call.nextCall.nextCallDatetime),
              assignedEmployeeId: call.nextCall.assignedEmployeeId,
              assignedEmployeeName: call.nextCall.assignedEmployee?.fullName || null,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/meetings/:meetingId/next ──────────────────────
// Admin-only override of the next-meeting schedule. Never touches the
// meeting's own created_by/assigned_by — only client_next_meetings.
export async function updateNextMeetingSchedule(req, res, next) {
  const meetingId = isValidId(req.params.meetingId);
  if (!meetingId) return res.status(400).json({ message: "Invalid meeting reference." });

  const nextMeetingDatetime = parseDateTimeLocal(req.body.nextMeetingDatetime);
  const assignedEmployeeId = isValidId(req.body.assignedEmployeeId);

  try {
    const meeting = await prisma.clientMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true, linkedRowKey: true },
    });
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });

    if (!nextMeetingDatetime) {
      await prisma.clientNextMeeting.deleteMany({ where: { meetingId } });
      return res.json({ data: { meetingId, nextMeeting: null } });
    }

    const updated = await prisma.clientNextMeeting.upsert({
      where: { meetingId },
      create: {
        meetingId,
        linkedRowKey: meeting.linkedRowKey,
        nextMeetingDatetime,
        assignedEmployeeId,
        createdById: req.adminId,
        updatedById: req.adminId,
      },
      update: { nextMeetingDatetime, assignedEmployeeId, updatedById: req.adminId },
      include: { assignedEmployee: { select: { fullName: true } } },
    });

    res.json({
      data: {
        meetingId,
        nextMeeting: {
          id: updated.id,
          nextMeetingDatetime: formatDateTime(updated.nextMeetingDatetime),
          assignedEmployeeId: updated.assignedEmployeeId,
          assignedEmployeeName: updated.assignedEmployee?.fullName || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/calls/:callId/next ────────────────────────────
// Admin-only override of the next-call schedule. Never touches the call's
// own created_by/assigned_by — only client_next_calls.
export async function updateNextCallSchedule(req, res, next) {
  const callId = isValidId(req.params.callId);
  if (!callId) return res.status(400).json({ message: "Invalid call reference." });

  const nextCallDatetime = parseDateTimeLocal(req.body.nextCallDatetime);
  const assignedEmployeeId = isValidId(req.body.assignedEmployeeId);

  try {
    const call = await prisma.clientCall.findUnique({
      where: { id: callId },
      select: { id: true, linkedRowKey: true },
    });
    if (!call) return res.status(404).json({ message: "Call not found." });

    if (!nextCallDatetime) {
      await prisma.clientNextCall.deleteMany({ where: { callId } });
      return res.json({ data: { callId, nextCall: null } });
    }

    const updated = await prisma.clientNextCall.upsert({
      where: { callId },
      create: {
        callId,
        linkedRowKey: call.linkedRowKey,
        nextCallDatetime,
        assignedEmployeeId,
        createdById: req.adminId,
        updatedById: req.adminId,
      },
      update: { nextCallDatetime, assignedEmployeeId, updatedById: req.adminId },
      include: { assignedEmployee: { select: { fullName: true } } },
    });

    res.json({
      data: {
        callId,
        nextCall: {
          id: updated.id,
          nextCallDatetime: formatDateTime(updated.nextCallDatetime),
          assignedEmployeeId: updated.assignedEmployeeId,
          assignedEmployeeName: updated.assignedEmployee?.fullName || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
