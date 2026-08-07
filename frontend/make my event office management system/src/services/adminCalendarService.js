const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export async function fetchAdminCalendarMonth(year, month) {
  const res = await fetch(`${API_BASE_URL}/admin/calendar?year=${year}&month=${month}`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load the calendar.");
  return body.data;
}
