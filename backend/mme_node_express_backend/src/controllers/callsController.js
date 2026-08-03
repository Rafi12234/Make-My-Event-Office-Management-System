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

  const now = new Date();
  const nowValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return value < nowValue;
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
        nextCall: { select: { nextCallDatetime: true } },
      },
      orderBy: [{ callDatetime: { sort: "asc", nulls: "last" } }, { id: "asc" }],
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
    const created = await prisma.clientCall.create({
      data: {
        linkedRowKey: rowKey,
        callDatetime,
        callDiscussion,
        createdById: employeeId,
        updatedById: employeeId,
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

  if (req.body.callDatetime && isPastDatetime(req.body.callDatetime)) {
    return res.status(422).json({ message: "Call time cannot be in the past. Please choose the current time or later." });
  }
  if (req.body.nextCallDatetime && isPastDatetime(req.body.nextCallDatetime)) {
    return res.status(422).json({ message: "Next meeting call time cannot be in the past. Please choose the current time or later." });
  }

  const callDatetime = parseDateTimeLocal(req.body.callDatetime);
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const nextCallDatetime = parseDateTimeLocal(req.body.nextCallDatetime);
  const employeeId = isValidId(req.body.employeeId);

  try {
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
        create: { callId: id, linkedRowKey: rowKey, nextCallDatetime, createdById: employeeId, updatedById: employeeId },
        update: { nextCallDatetime, updatedById: employeeId },
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
