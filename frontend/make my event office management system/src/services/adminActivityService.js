const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

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
