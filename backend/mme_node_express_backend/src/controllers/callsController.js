import { prisma } from "../config/prisma.js";
import { formatDateTime, parseDateTimeLocal, nowMinValue, todayMinValue } from "../utils/dbDates.js";

// ─── Helpers ────────────────────────────────────────────────────

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

async function getClientName(sheetId, rowKey) {
  if (!sheetId) return "";

  // Columns are located by their display name rather than column_key,
  // since column_key is not guaranteed to be a readable slug — the same
  // approach used in controllers/calendarController.js and controllers/meetingsController.js.
  const row = await prisma.sheetRow.findFirst({
    where: { sheetId, rowKey },
    select: {
      cells: {
        where: { column: { columnName: { equals: "Client Name" } } },
        select: { valueText: true, displayValue: true },
        take: 1,
      },
    },
  });

  const cell = row?.cells?.[0];
  return cell?.valueText || cell?.displayValue || "";
}

function isValidRowKey(rowKey) {
  return /^[0-9a-fA-F-]{36}$/.test(String(rowKey || ""));
}

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Compares the full "YYYY-MM-DDTHH:MM" value against the current minute so a
// past time on today's date is rejected too (not just past calendar days) —
// otherwise an employee could backdate a call to an earlier time today.
// Matches the naive/no-timezone-shift date handling in dbDates.js.
function isPastDatetime(datetimeLocalValue) {
  const value = String(datetimeLocalValue || "").trim().slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;

  return value < nowMinValue();
}

// Only compares the date part — the next call's time of day is unrestricted.
function isNextCallDateTooEarly(datetimeLocalValue) {
  const value = String(datetimeLocalValue || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value < todayMinValue().slice(0, 10);
}

// ─── GET /api/calls/:rowKey — list calls for a client ──────────────

export async function listCalls(req, res, next) {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  try {
    const sheetId = await getDefaultSheetId();
    const clientName = await getClientName(sheetId, rowKey);

    const calls = await prisma.clientCall.findMany({
      where: { linkedRowKey: rowKey },
      include: {
        createdBy: { select: { fullName: true } },
        updatedBy: { select: { fullName: true } },
        assignedBy: { select: { fullName: true } },
        nextCall: {
          select: {
            nextCallDatetime: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { fullName: true } },
          },
        },
      },
      // Newest-created first so a freshly added (still unscheduled) call
      // appears at the top of the list instead of sinking to the bottom.
      orderBy: { id: "desc" },
    });

    res.json({
      data: {
        rowKey,
        clientName,
        calls: calls.map((call) => ({
          id: call.id,
          callDatetime: formatDateTime(call.callDatetime),
          callDiscussion: call.callDiscussion,
          nextCallDatetime: formatDateTime(call.nextCall?.nextCallDatetime),
          nextCallAssignedEmployeeId: call.nextCall?.assignedEmployeeId ?? null,
          nextCallAssignedEmployeeName: call.nextCall?.assignedEmployee?.fullName || null,
          assignedByEmployeeName: call.assignedBy?.fullName || null,
          createdByName: call.createdBy?.fullName || null,
          updatedByName: call.updatedBy?.fullName || null,
          createdAt: formatDateTime(call.createdAt),
          updatedAt: formatDateTime(call.updatedAt),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/calls/:rowKey — create a new call ───────────────────

export async function createCall(req, res, next) {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
  }

  if (req.body.callDatetime && isPastDatetime(req.body.callDatetime)) {
    return res.status(422).json({ message: "Call time cannot be in the past. Please choose the current time or later." });
  }

  const callDatetime = parseDateTimeLocal(req.body.callDatetime);
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    // If this client has a pending next-call assignment (set on a previous
    // call), this new call is fulfilling it — record who made that
    // assignment so the new call card can show "Assigned by <name>".
    const pendingNextCall = await prisma.clientNextCall.findFirst({
      where: { linkedRowKey: rowKey },
      select: { updatedById: true, createdById: true },
    });
    const assignedByEmployeeId = pendingNextCall?.updatedById ?? pendingNextCall?.createdById ?? null;

    const created = await prisma.clientCall.create({
      data: {
        linkedRowKey: rowKey,
        callDatetime,
        callDiscussion,
        createdById: employeeId,
        updatedById: employeeId,
        assignedByEmployeeId,
      },
      select: { id: true },
    });

    // Logging a new call fulfills whatever follow-up was pending from an
    // earlier call, so clear any stale next-call schedules for this client —
    // otherwise an old, already-passed date keeps winning as the "soonest".
    await prisma.clientNextCall.deleteMany({
      where: { linkedRowKey: rowKey, callId: { not: created.id } },
    });

    res.status(201).json({ data: { id: created.id } });
  } catch (error) {
    next(error);
  }
}

// ─── PUT /api/calls/:rowKey/:callId — update time/discussion ──────

export async function updateCall(req, res, next) {
  const { rowKey, callId } = req.params;
  const id = isValidId(callId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const callDatetime = parseDateTimeLocal(req.body.callDatetime);
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const nextCallDatetime = parseDateTimeLocal(req.body.nextCallDatetime);
  const employeeId = isValidId(req.body.employeeId);
  const nextCallAssignedEmployeeId = isValidId(req.body.nextCallAssignedEmployeeId);

  try {
    // Only re-validate fields the caller is actually changing — otherwise an
    // untouched call time that has since ticked into the past (or an
    // existing next-call date) would block saving unrelated edits.
    const existing = await prisma.clientCall.findFirst({
      where: { id, linkedRowKey: rowKey },
      include: { nextCall: { select: { nextCallDatetime: true } } },
    });
    if (!existing) {
      return res.status(404).json({ message: "Call not found." });
    }

    const callDatetimeChanged = formatDateTime(existing.callDatetime) !== formatDateTime(callDatetime);
    if (callDatetimeChanged && req.body.callDatetime && isPastDatetime(req.body.callDatetime)) {
      return res.status(422).json({ message: "Call time cannot be in the past. Please choose the current time or later." });
    }

    const nextCallDatetimeChanged = formatDateTime(existing.nextCall?.nextCallDatetime) !== formatDateTime(nextCallDatetime);
    if (nextCallDatetimeChanged && req.body.nextCallDatetime && isNextCallDateTooEarly(req.body.nextCallDatetime)) {
      return res.status(422).json({ message: "Next meeting call date cannot be before today. Any time of day is fine." });
    }

    const result = await prisma.clientCall.updateMany({
      where: { id, linkedRowKey: rowKey },
      data: { callDatetime, callDiscussion, updatedById: employeeId },
    });

    if (!result.count) {
      return res.status(404).json({ message: "Call not found." });
    }

    if (nextCallDatetime) {
      await prisma.clientNextCall.upsert({
        where: { callId: id },
        create: {
          callId: id,
          linkedRowKey: rowKey,
          nextCallDatetime,
          assignedEmployeeId: nextCallAssignedEmployeeId,
          createdById: employeeId,
          updatedById: employeeId,
        },
        update: { nextCallDatetime, assignedEmployeeId: nextCallAssignedEmployeeId, updatedById: employeeId },
      });
    } else {
      await prisma.clientNextCall.deleteMany({ where: { callId: id } });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/calls/:rowKey/:callId ─────────────────────────────

export async function deleteCall(req, res, next) {
  const { rowKey, callId } = req.params;
  const id = isValidId(callId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  try {
    const result = await prisma.clientCall.deleteMany({
      where: { id, linkedRowKey: rowKey },
    });

    if (!result.count) {
      return res.status(404).json({ message: "Call not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}
