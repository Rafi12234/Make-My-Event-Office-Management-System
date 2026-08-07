const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function resolveImageUrl(url) {
  if (!url) return "";
  return `${API_ORIGIN}${url}`;
}

export async function fetchAllMeetings() {
  const res = await fetch(`${API_BASE_URL}/admin/meetings`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load meetings.");
  return body.data;
}

export async function fetchAllCalls() {
  const res = await fetch(`${API_BASE_URL}/admin/calls`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load calls.");
  return body.data;
}

// Full meeting history for one client, same shape as ClientMeetingsPage's
// loadClientMeetings — used by the admin "Details" drill-down.
export async function fetchClientMeetingsForAdmin(rowKey) {
  const res = await fetch(`${API_BASE_URL}/admin/clients/${rowKey}/meetings`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load meeting details.");
  return body.data;
}

// Full call history for one client, same shape as ClientCallsPage's
// loadClientCalls — used by the admin "Details" drill-down.
export async function fetchClientCallsForAdmin(rowKey) {
  const res = await fetch(`${API_BASE_URL}/admin/clients/${rowKey}/calls`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load call details.");
  return body.data;
}

// nextMeetingDatetime: "YYYY-MM-DDTHH:MM" (or "" to clear the schedule)
export async function updateNextMeetingSchedule(meetingId, { nextMeetingDatetime, assignedEmployeeId }) {
  const res = await fetch(`${API_BASE_URL}/admin/meetings/${meetingId}/next`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nextMeetingDatetime, assignedEmployeeId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not update the next meeting.");
  return body.data;
}

// nextCallDatetime: "YYYY-MM-DDTHH:MM" (or "" to clear the schedule)
export async function updateNextCallSchedule(callId, { nextCallDatetime, assignedEmployeeId }) {
  const res = await fetch(`${API_BASE_URL}/admin/calls/${callId}/next`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nextCallDatetime, assignedEmployeeId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not update the next call.");
  return body.data;
}
