import { prisma } from "../config/prisma.js";
import { formatDateOnly, formatTimeOnly, formatDateTime, parseDateOnly, parseTimeOnly, nowInBusinessTimezone } from "../utils/dbDates.js";
import { computeMeetingCallTimes } from "../utils/meetingCallTimes.js";

// ─── Helpers ───────────────────────────────────────────────────

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

function formatTimeVal(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[1].substring(0, 5); // "10:30:00" → "10:30"
}

function inferEventType(columnName) {
  const n = columnName.toLowerCase();
  if (n.includes("next") || n.includes("upcoming")) return "upcoming";
  if (n.includes("meeting") || n.includes("call"))   return "meeting";
  if (n.includes("follow"))                           return "followup";
  if (n.includes("deadline") || n.includes("due"))   return "deadline";
  return "task";
}

function cellValueFromRow(cell, dataType) {
  if (dataType === "boolean")                           return cell.valueBoolean;
  if (dataType === "integer")                           return cell.valueInteger;
  if (["decimal", "currency"].includes(dataType))      return cell.valueDecimal;
  if (dataType === "date")                              return formatDateOnly(cell.valueDate) || "";
  if (dataType === "time")                              return formatTimeOnly(cell.valueTime) || "";
  if (["datetime", "last_meeting_time", "next_meeting_time"].includes(dataType)) return formatDateTime(cell.valueDatetime) || "";
  if (dataType === "employee")                          return cell.valueEmployee?.fullName || cell.displayValue || "";
  return cell.valueText ?? cell.displayValue ?? "";
}

// ─── GET /api/calendar?year=YYYY&month=M ───────────────────────

export async function getCalendarMonth(req, res, next) {
  const businessNow = nowInBusinessTimezone();
  const year  = parseInt(req.query.year,  10) || businessNow.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || (businessNow.getUTCMonth() + 1);

  // Calendar is personalised — every employee only ever sees the meetings,
  // calls, and events THEY created, never anyone else's. `req.employee` is
  // set server-side by `requireEmployee` from the signed session cookie, so
  // this can't be spoofed via a query param.
  const employeeId = BigInt(req.employee.id);

  const startDate   = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate     = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEnd   = new Date(`${endDate}T23:59:59.999Z`);

  try {
    const events = [];
    let worksheetColumns = [];

    // ── Worksheet events ──────────────────────────────────────
    const sheet = await prisma.managementSheet.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (sheet) {
      const sheetId = sheet.id;

      // Always fetch all column definitions (for worksheetColumns + rowData building)
      const allColumns = await prisma.sheetColumn.findMany({
        where: { sheetId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });

      worksheetColumns = allColumns.map((c) => ({
        key: c.columnKey,
        name: c.columnName,
        type: c.dataType,
      }));

      // Find the "Client Name" column once so every event (worksheet, meeting,
      // or call) can carry the resolved client name + full row values.
      const clientNameCol = allColumns.find(
        (c) => c.columnName.toLowerCase() === "client name" ||
               (c.dataType === "text" && c.columnName.toLowerCase().includes("client") && !c.columnName.toLowerCase().includes("email") && !c.columnName.toLowerCase().includes("phone")),
      );

      const dateColumns = allColumns.filter((c) => c.dataType === "datetime" || c.dataType === "date");
      const dateColumnIds = dateColumns.map((c) => c.id);

      let dateCells = [];
      if (dateColumnIds.length) {
        dateCells = await prisma.sheetCell.findMany({
          where: {
            columnId: { in: dateColumnIds },
            row: { isArchived: false, createdById: employeeId },
            OR: [
              { valueDatetime: { gte: rangeStart, lte: rangeEnd } },
              { valueDate: { gte: rangeStart, lte: rangeEnd } },
            ],
          },
          include: { row: { select: { rowKey: true } } },
        });
      }

      // ── Client meeting events (from the Meeting Manager) ─────
      // Joined against sheet_rows (via an IN-list of active row keys) so
      // meetings belonging to a client that has since been deleted from the
      // worksheet (row archived) never show up here, even for any older
      // data saved before cascading deletes existed.
      const activeRows = await prisma.sheetRow.findMany({
        where: { sheetId, isArchived: false },
        select: { rowKey: true },
      });
      const activeRowKeys = activeRows.map((r) => r.rowKey);

      let meetingRows = [];
      if (activeRowKeys.length) {
        meetingRows = await prisma.clientMeeting.findMany({
          where: {
            linkedRowKey: { in: activeRowKeys },
            meetingDatetime: { gte: rangeStart, lte: rangeEnd },
            createdById: employeeId,
          },
        });
      }

      // ── Client call events (from the Call Manager) ───────────
      let callRows = [];
      if (activeRowKeys.length) {
        callRows = await prisma.clientCall.findMany({
          where: {
            linkedRowKey: { in: activeRowKeys },
            callDatetime: { gte: rangeStart, lte: rangeEnd },
            createdById: employeeId,
          },
        });
      }

      // ── Scheduled next-call events (the "Next Meeting Call Date & Time"
      // set from a call card) — shown on the day it's scheduled for, not the
      // day the call was logged, so employees see upcoming follow-ups too.
      // The assignee dropdown always defaults to the creator when nobody
      // else is picked, so assignedEmployeeId alone is the source of truth
      // for "whose calendar this belongs on" — this is what keeps a next
      // call/meeting off the assigner's calendar once it's handed to someone else.
      let nextCallRows = [];
      if (activeRowKeys.length) {
        nextCallRows = await prisma.clientNextCall.findMany({
          where: {
            linkedRowKey: { in: activeRowKeys },
            nextCallDatetime: { gte: rangeStart, lte: rangeEnd },
            assignedEmployeeId: employeeId,
          },
        });
      }

      // ── Scheduled next-meeting events (the "Next Meeting Date & Time" set
      // from a meeting card) — same idea as next-call, above.
      let nextMeetingRows = [];
      if (activeRowKeys.length) {
        nextMeetingRows = await prisma.clientNextMeeting.findMany({
          where: {
            linkedRowKey: { in: activeRowKeys },
            nextMeetingDatetime: { gte: rangeStart, lte: rangeEnd },
            assignedEmployeeId: employeeId,
          },
        });
      }

      // ── Resolve full row data (every column) for every rowKey touched above ──
      // Worksheet, meeting, and call events all share this map so each event
      // can carry the complete client record — the same values ManagementPage
      // shows for that row.
      const rowDataByKey = new Map();
      const relevantRowKeys = new Set([
        ...dateCells.map((c) => c.row.rowKey),
        ...meetingRows.map((m) => m.linkedRowKey),
        ...callRows.map((c) => c.linkedRowKey),
        ...nextCallRows.map((n) => n.linkedRowKey),
        ...nextMeetingRows.map((n) => n.linkedRowKey),
      ]);

      if (relevantRowKeys.size) {
        const columnMap = new Map(allColumns.map((c) => [c.id, c]));

        const rows = await prisma.sheetRow.findMany({
          where: { sheetId, rowKey: { in: [...relevantRowKeys] } },
          select: {
            rowKey: true,
            cells: {
              include: { valueEmployee: { select: { fullName: true } } },
            },
          },
        });

        for (const row of rows) {
          const rowData = {};
          for (const cell of row.cells) {
            const col = columnMap.get(cell.columnId);
            if (!col) continue;
            rowData[col.columnKey] = cellValueFromRow(cell, col.dataType);
          }
          rowDataByKey.set(row.rowKey, rowData);
        }
      }

      // "Last Meeting Time" / "Next Meeting Time" cells are never persisted
      // (see workspaceController.js) — compute them live here too, so the
      // calendar hover card shows the same values as the management sheet.
      const meetingTimeColumns = allColumns.filter(
        (c) => c.dataType === "last_meeting_time" || c.dataType === "next_meeting_time",
      );
      if (meetingTimeColumns.length && relevantRowKeys.size) {
        const timesByRowKey = await computeMeetingCallTimes([...relevantRowKeys], { employeeId });
        for (const rowKey of relevantRowKeys) {
          const rowData = rowDataByKey.get(rowKey);
          if (!rowData) continue;
          const times = timesByRowKey.get(rowKey);
          for (const col of meetingTimeColumns) {
            // Same meeting-first, call-as-fallback rule ManagementPage uses
            // (row.values[col] || row.lastCallDatetime/nextCallDatetime) —
            // otherwise a client with only a call (no meeting) shows blank here.
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

      // ── Build worksheet events ────────────────────────────────
      const dateColMap = new Map(dateColumns.map((c) => [c.id, c]));

      for (const cell of dateCells) {
        const dateCol  = dateColMap.get(cell.columnId);
        const rawVal   = cell.valueDatetime || cell.valueDate;
        const dateStr  = extractDate(rawVal);
        const timeStr  = cell.valueDatetime ? extractTime(cell.valueDatetime) : null;
        const rowData  = rowDataByKey.get(cell.row.rowKey) || {};
        const resolvedClientName = clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "";

        events.push({
          id:         `ws_${cell.id}`,
          source:     "worksheet",
          date:       dateStr,
          time:       timeStr,
          columnKey:  dateCol.columnKey,
          columnName: dateCol.columnName,
          rowKey:     cell.row.rowKey,
          clientName: resolvedClientName,
          rowData,
          eventType:  inferEventType(dateCol.columnName),
        });
      }

      // ── Build client meeting events ───────────────────────────
      for (const meeting of meetingRows) {
        const rowData    = rowDataByKey.get(meeting.linkedRowKey) || {};
        const clientName = clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "";

        events.push({
          id:          `cm_${meeting.id}`,
          source:      "client_meeting",
          date:        extractDate(meeting.meetingDatetime),
          time:        extractTime(meeting.meetingDatetime),
          title:       clientName ? `Meeting with ${clientName}` : "Client meeting",
          description: meeting.discussionNotes || null,
          rowKey:      meeting.linkedRowKey,
          clientName,
          rowData,
          eventType:   "meeting",
        });
      }

      // ── Build client call events ──────────────────────────────
      for (const call of callRows) {
        const rowData    = rowDataByKey.get(call.linkedRowKey) || {};
        const clientName = clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "";

        events.push({
          id:          `cc_${call.id}`,
          source:      "client_call",
          date:        extractDate(call.callDatetime),
          time:        extractTime(call.callDatetime),
          title:       clientName ? `Call with ${clientName}` : "Client call",
          description: call.callDiscussion || null,
          rowKey:      call.linkedRowKey,
          clientName,
          rowData,
          eventType:   "call",
        });
      }

      // ── Build scheduled next-call events ──────────────────────
      for (const nextCall of nextCallRows) {
        const rowData    = rowDataByKey.get(nextCall.linkedRowKey) || {};
        const clientName = clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "";

        events.push({
          id:          `ncc_${nextCall.id}`,
          source:      "client_next_call",
          date:        extractDate(nextCall.nextCallDatetime),
          time:        extractTime(nextCall.nextCallDatetime),
          title:       clientName ? `Next call with ${clientName}` : "Upcoming client call",
          rowKey:      nextCall.linkedRowKey,
          clientName,
          rowData,
          eventType:   "upcoming",
          isAssignedToMe: nextCall.assignedEmployeeId === employeeId && nextCall.createdById !== employeeId,
        });
      }

      // ── Build scheduled next-meeting events ───────────────────
      for (const nextMeeting of nextMeetingRows) {
        const rowData    = rowDataByKey.get(nextMeeting.linkedRowKey) || {};
        const clientName = clientNameCol ? (rowData[clientNameCol.columnKey] || "") : "";

        events.push({
          id:          `ncm_${nextMeeting.id}`,
          source:      "client_next_meeting",
          date:        extractDate(nextMeeting.nextMeetingDatetime),
          time:        extractTime(nextMeeting.nextMeetingDatetime),
          title:       clientName ? `Next meeting with ${clientName}` : "Upcoming client meeting",
          rowKey:      nextMeeting.linkedRowKey,
          clientName,
          rowData,
          eventType:   "upcoming",
          isAssignedToMe: nextMeeting.assignedEmployeeId === employeeId && nextMeeting.createdById !== employeeId,
        });
      }
    }

    // ── Manual calendar events ────────────────────────────────
    // Visible if I created it myself OR someone assigned it to me.
    const manualEvents = await prisma.calendarEvent.findMany({
      where: {
        eventDate: { gte: rangeStart, lte: rangeEnd },
        OR: [{ createdById: employeeId }, { assignedEmployeeId: employeeId }],
      },
      include: { assignedEmployee: { select: { fullName: true } } },
      orderBy: [{ eventDate: "asc" }, { eventTime: "asc" }],
    });

    for (const ev of manualEvents) {
      events.push({
        id:               `ev_${ev.id}`,
        dbId:             ev.id,
        source:           "manual",
        date:             extractDate(ev.eventDate),
        time:             formatTimeVal(ev.eventTime),
        title:            ev.title,
        description:      ev.description || null,
        eventType:        ev.eventType,
        clientName:       ev.clientName || null,
        companyName:      ev.companyName || null,
        priority:         ev.priority,
        status:           ev.status,
        linkedRowKey:     ev.linkedRowKey || null,
        assignedEmployee: ev.assignedEmployee?.fullName || null,
        isAssignedToMe:   ev.assignedEmployeeId === employeeId && ev.createdById !== employeeId,
      });
    }

    events.sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      return d !== 0 ? d : (a.time || "").localeCompare(b.time || "");
    });

    res.json({ data: { year, month, events, worksheetColumns } });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/calendar/events ─────────────────────────────────

export async function createCalendarEvent(req, res, next) {
  try {
    const {
      title, description, eventDate, eventTime, eventType,
      clientName, companyName, priority, status,
      linkedRowKey, assignedEmployeeId, employeeId,
    } = req.body;

    if (!title || !eventDate) {
      return res.status(422).json({ message: "Title and event date are required." });
    }

    const empId = Number(employeeId) || null;

    const created = await prisma.calendarEvent.create({
      data: {
        title: String(title).trim(),
        description: description || null,
        eventDate: parseDateOnly(eventDate),
        eventTime: parseTimeOnly(eventTime),
        eventType: eventType || "task",
        clientName: clientName || null,
        companyName: companyName || null,
        priority: priority || "Medium",
        status: status || "Pending",
        linkedRowKey: linkedRowKey || null,
        assignedEmployeeId: Number(assignedEmployeeId) || null,
        createdById: empId,
        updatedById: empId,
      },
      select: { id: true },
    });

    res.status(201).json({ data: { id: created.id } });
  } catch (error) {
    next(error);
  }
}

// ─── PUT /api/calendar/events/:id ──────────────────────────────

export async function updateCalendarEvent(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      title, description, eventDate, eventTime, eventType,
      clientName, companyName, priority, status,
      linkedRowKey, assignedEmployeeId, employeeId,
    } = req.body;

    if (!title || !eventDate) {
      return res.status(422).json({ message: "Title and event date are required." });
    }

    await prisma.calendarEvent.updateMany({
      where: { id },
      data: {
        title: String(title).trim(),
        description: description || null,
        eventDate: parseDateOnly(eventDate),
        eventTime: parseTimeOnly(eventTime),
        eventType: eventType || "task",
        clientName: clientName || null,
        companyName: companyName || null,
        priority: priority || "Medium",
        status: status || "Pending",
        linkedRowKey: linkedRowKey || null,
        assignedEmployeeId: Number(assignedEmployeeId) || null,
        updatedById: Number(employeeId) || null,
        updatedAt: new Date(),
      },
    });

    res.json({ message: "Event updated." });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/calendar/events/:id ───────────────────────────

export async function deleteCalendarEvent(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.calendarEvent.deleteMany({ where: { id } });
    res.json({ message: "Event deleted." });
  } catch (error) {
    next(error);
  }
}
