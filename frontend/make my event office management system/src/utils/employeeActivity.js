// Shared by AdminPage.jsx (overview) and AdminEmployeeDetailPage.jsx (single
// employee drill-down) so both pages group meetings/calls per employee the
// same way.

export function initials(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function formatDisplay(dbDatetime) {
  if (!dbDatetime) return null;
  const [datePart, timePart] = dbDatetime.split(" ");
  const date = new Date(`${datePart}T${timePart || "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return dbDatetime;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function passesDateFilter(dateOnly, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!dateOnly) return false;
  if (dateFrom && dateOnly < dateFrom) return false;
  if (dateTo && dateOnly > dateTo) return false;
  return true;
}

// Groups every meeting/call into per-employee "previous" (completed, matched
// by who logged it) and "upcoming" (matched by who the next-schedule is
// assigned to) buckets. Each date is checked against the same date range
// independently, so a past range naturally surfaces only previous entries,
// a future range only upcoming ones, and a range spanning today surfaces
// both — with no need to special-case "is this range past or future".
export function buildEmployeeActivity(employees, meetings, calls, dateFrom, dateTo) {
  const byName = new Map(employees.map((emp) => [emp.fullName, { employee: emp, previous: [], upcoming: [] }]));

  for (const meeting of meetings) {
    if (meeting.hasCompletedDetails && meeting.createdByName && byName.has(meeting.createdByName)) {
      const dateOnly = meeting.meetingDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(meeting.createdByName).previous.push({
          type: "meeting", rowKey: meeting.rowKey, clientName: meeting.clientName, datetime: meeting.meetingDatetime,
        });
      }
    }
    const nextName = meeting.nextMeeting?.assignedEmployeeName;
    if (nextName && byName.has(nextName)) {
      const dateOnly = meeting.nextMeeting.nextMeetingDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(nextName).upcoming.push({
          type: "meeting", rowKey: meeting.rowKey, clientName: meeting.clientName, datetime: meeting.nextMeeting.nextMeetingDatetime,
        });
      }
    }
  }

  for (const call of calls) {
    if (call.hasCompletedDetails && call.createdByName && byName.has(call.createdByName)) {
      const dateOnly = call.callDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(call.createdByName).previous.push({
          type: "call", rowKey: call.rowKey, clientName: call.clientName, datetime: call.callDatetime,
        });
      }
    }
    const nextName = call.nextCall?.assignedEmployeeName;
    if (nextName && byName.has(nextName)) {
      const dateOnly = call.nextCall.nextCallDatetime?.slice(0, 10) || null;
      if (passesDateFilter(dateOnly, dateFrom, dateTo)) {
        byName.get(nextName).upcoming.push({
          type: "call", rowKey: call.rowKey, clientName: call.clientName, datetime: call.nextCall.nextCallDatetime,
        });
      }
    }
  }

  for (const bucket of byName.values()) {
    bucket.previous.sort((a, b) => (b.datetime || "").localeCompare(a.datetime || ""));
    bucket.upcoming.sort((a, b) => (a.datetime || "").localeCompare(b.datetime || ""));
  }

  return [...byName.values()];
}
