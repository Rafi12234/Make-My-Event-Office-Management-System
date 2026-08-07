import { prisma } from "../config/prisma.js";
import { nowInBusinessTimezone } from "./dbDates.js";

// Shared by workspaceController (management sheet) and calendarController
// (client hover details) so "last/next meeting" and "last/next call" are
// computed identically in both places instead of drifting apart.
//
// Returns a Map<rowKey, { lastMeeting, nextMeeting, lastCall, nextCall }>
// of raw Date values (not yet formatted for display).
export async function computeMeetingCallTimes(rowKeys, { employeeId } = {}) {
  const timesByRowKey = new Map();
  if (!rowKeys.length) return timesByRowKey;

  // Past meetings/calls only count as "mine" if I logged them myself. An
  // upcoming follow-up's assignee dropdown always defaults to whoever
  // scheduled it when nobody else is picked, so assignedEmployeeId alone
  // tells us whose calendar it belongs on — it stops showing up for the
  // person who scheduled it the moment they hand it to a colleague.
  const createdScope = employeeId ? { createdById: employeeId } : {};
  const upcomingScope = employeeId ? { assignedEmployeeId: employeeId } : {};

  const [meetings, calls, nextCalls, nextMeetings] = await Promise.all([
    prisma.clientMeeting.findMany({
      where: { linkedRowKey: { in: rowKeys }, meetingDatetime: { not: null }, ...createdScope },
      select: { linkedRowKey: true, meetingDatetime: true },
    }),
    prisma.clientCall.findMany({
      where: { linkedRowKey: { in: rowKeys }, callDatetime: { not: null }, ...createdScope },
      select: { linkedRowKey: true, callDatetime: true },
    }),
    prisma.clientNextCall.findMany({
      where: { linkedRowKey: { in: rowKeys }, ...upcomingScope },
      select: { linkedRowKey: true, nextCallDatetime: true },
    }),
    prisma.clientNextMeeting.findMany({
      where: { linkedRowKey: { in: rowKeys }, ...upcomingScope },
      select: { linkedRowKey: true, nextMeetingDatetime: true },
    }),
  ]);

  // Stored datetimes are naive wall-clock values whose UTC digits mirror the
  // original local input (see dbDates.js) — build "now" the same way so the
  // <= comparisons below aren't skewed by the server's real UTC offset.
  const now = nowInBusinessTimezone();

  const ensureEntry = (rowKey) => {
    let entry = timesByRowKey.get(rowKey);
    if (!entry) {
      entry = { lastMeeting: null, nextMeeting: null, lastCall: null, nextCall: null };
      timesByRowKey.set(rowKey, entry);
    }
    return entry;
  };

  for (const meeting of meetings) {
    const entry = ensureEntry(meeting.linkedRowKey);
    if (meeting.meetingDatetime <= now) {
      if (!entry.lastMeeting || meeting.meetingDatetime > entry.lastMeeting) entry.lastMeeting = meeting.meetingDatetime;
    } else if (!entry.nextMeeting || meeting.meetingDatetime < entry.nextMeeting) {
      entry.nextMeeting = meeting.meetingDatetime;
    }
  }

  for (const call of calls) {
    const entry = ensureEntry(call.linkedRowKey);
    if (call.callDatetime <= now) {
      if (!entry.lastCall || call.callDatetime > entry.lastCall) entry.lastCall = call.callDatetime;
    } else if (!entry.nextCall || call.callDatetime < entry.nextCall) {
      // A call whose own time hasn't arrived yet is itself "upcoming" —
      // mirrors the meetings logic above, so a just-scheduled call shows up
      // immediately instead of appearing in neither column until its exact
      // minute passes.
      entry.nextCall = call.callDatetime;
    }
  }

  // "Next call" also honors the explicit follow-up date/time an employee
  // scheduled on a call card (a separate record) — whichever of the two (the
  // call's own still-upcoming time, or an explicit follow-up) is soonest wins.
  for (const nextCall of nextCalls) {
    const entry = ensureEntry(nextCall.linkedRowKey);
    if (!entry.nextCall || nextCall.nextCallDatetime < entry.nextCall) entry.nextCall = nextCall.nextCallDatetime;
  }

  // Same idea for "next meeting" — a meeting card's own explicit follow-up
  // schedule can win over (or be the only source of) an upcoming meeting time.
  for (const nextMeeting of nextMeetings) {
    const entry = ensureEntry(nextMeeting.linkedRowKey);
    if (!entry.nextMeeting || nextMeeting.nextMeetingDatetime < entry.nextMeeting) entry.nextMeeting = nextMeeting.nextMeetingDatetime;
  }

  return timesByRowKey;
}
