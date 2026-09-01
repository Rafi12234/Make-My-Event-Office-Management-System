const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// filters: { employeeId, date, from, to } — all optional (guide section 15).
export async function fetchAdminAttendance(filters = {}) {
  const params = new URLSearchParams();
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.date) params.set("date", filters.date);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const query = params.toString();
  const res = await fetch(`${API_BASE_URL}/admin/attendance${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load attendance.");
  return body.data;
}
