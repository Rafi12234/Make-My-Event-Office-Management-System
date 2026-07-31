import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { parseDateTimeLocal } from "../utils/dbDates.js";

const router = Router();

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
  // approach used in routes/calendar.js and routes/meetings.js.
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

// ─── GET /api/calls/:rowKey — list calls for a client ──────────────

router.get("/:rowKey", async (req, res, next) => {
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
      },
      orderBy: [{ callDatetime: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    });

    res.json({
      data: {
        rowKey,
        clientName,
        calls: calls.map((call) => ({
          id: call.id,
          callDatetime: call.callDatetime,
          callDiscussion: call.callDiscussion,
          createdByName: call.createdBy?.fullName || null,
          updatedByName: call.updatedBy?.fullName || null,
          createdAt: call.createdAt,
          updatedAt: call.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/calls/:rowKey — create a new call ───────────────────

router.post("/:rowKey", async (req, res, next) => {
  const { rowKey } = req.params;
  if (!isValidRowKey(rowKey)) {
    return res.status(400).json({ message: "Invalid client reference." });
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

    res.status(201).json({ data: { id: created.id } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/calls/:rowKey/:callId — update time/discussion ──────

router.put("/:rowKey/:callId", async (req, res, next) => {
  const { rowKey, callId } = req.params;
  const id = isValidId(callId);

  if (!isValidRowKey(rowKey) || !id) {
    return res.status(400).json({ message: "Invalid reference." });
  }

  const callDatetime = parseDateTimeLocal(req.body.callDatetime);
  const callDiscussion = req.body.callDiscussion
    ? String(req.body.callDiscussion)
    : null;
  const employeeId = isValidId(req.body.employeeId);

  try {
    const result = await prisma.clientCall.updateMany({
      where: { id, linkedRowKey: rowKey },
      data: { callDatetime, callDiscussion, updatedById: employeeId },
    });

    if (!result.count) {
      return res.status(404).json({ message: "Call not found." });
    }

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/calls/:rowKey/:callId ─────────────────────────────

router.delete("/:rowKey/:callId", async (req, res, next) => {
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
});

export default router;
