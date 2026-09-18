// Shared by adminCalendarController.js (calendar day/month view) and
// adminDashboardController.js (client history page) — a meeting/call that
// fulfills an earlier follow-up (expectedMeetingDatetime/expectedCallDatetime)
// gets tagged with how it compares to that due time, instead of just
// silently losing the original schedule once it's fulfilled.
import { formatDateTime } from "./dbDates.js";

// "2h 15m" / "45m" style.
export function formatDuration(totalMinutes) {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function buildCompletionTag(actualDatetime, expectedDatetime) {
  if (!expectedDatetime) return null;
  const diffMinutes = (actualDatetime.getTime() - expectedDatetime.getTime()) / 60000;
  // expectedLabel lets the UI show exactly which prior schedule this is
  // being measured against (e.g. as a tooltip) — otherwise "done Xh late"
  // is unverifiable at a glance once the original due schedule is gone
  // (it's deleted the moment it's fulfilled, see callsController.js).
  const expectedLabel = formatDateTime(expectedDatetime);
  if (Math.abs(diffMinutes) < 1) return { status: "on_time", label: "Done on time", expectedLabel };
  if (diffMinutes < 0) return { status: "early", label: `Done ${formatDuration(-diffMinutes)} early`, expectedLabel };
  return { status: "late", label: `Done ${formatDuration(diffMinutes)} late`, expectedLabel };
}

// A call/meeting's OWN next-schedule field (`nextCall`/`nextMeeting`) goes
// blank the instant a LATER call/meeting fulfills it (see callsController.js
// — the pending row is deleted so it doesn't also show as a duplicate "Due"
// item). That's correct for the live "what's still pending" view, but makes
// an already-fulfilled schedule look like it was "Not scheduled yet" on the
// call/meeting that actually set it. This reconstructs that history: for
// every item except the last (chronologically), if the very next item
// snapshotted an `expected*Datetime`, that snapshot IS what this earlier
// item scheduled — since only ONE schedule can ever be pending for a client
// at a time (any new call/meeting always clears every older one first).
// Returns the whole "later" item (not just the datetime) so the caller can
// also pull who it was assigned to/by from its already-fetched relations.
export function buildFulfilledFollowUpMap(itemsAnyOrder, datetimeKey, expectedKey) {
  const ascending = [...itemsAnyOrder].sort((a, b) => {
    const at = a[datetimeKey]?.getTime() ?? 0;
    const bt = b[datetimeKey]?.getTime() ?? 0;
    return at - bt;
  });
  const map = new Map();
  for (let i = 0; i < ascending.length - 1; i++) {
    const later = ascending[i + 1];
    if (later[expectedKey]) {
      map.set(String(ascending[i].id), later);
    }
  }
  return map;
}


