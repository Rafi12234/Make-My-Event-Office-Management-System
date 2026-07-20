const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return payload.data ?? payload;
}

export async function loadCalendarMonth(year, month) {
  return apiRequest(`/calendar?year=${year}&month=${month}`);
}

export async function createCalendarEvent(data) {
  return apiRequest("/calendar/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCalendarEvent(id, data) {
  return apiRequest(`/calendar/events/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCalendarEvent(id) {
  return apiRequest(`/calendar/events/${id}`, {
    method: "DELETE",
  });
}
