const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Returns { employees, clients, totals } — see adminDashboardController.js
// for the exact shape of each entry.
export async function fetchAdminDashboard() {
  const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load the dashboard.");
  return body.data;
}

// Returns one client's full profile: every worksheet column, meeting/call
// history, and finalization status. See adminDashboardController.js's
// getClientDetail for the exact shape.
export async function fetchAdminClientDetail(rowKey) {
  const res = await fetch(`${API_BASE_URL}/admin/dashboard/clients/${rowKey}`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load this client.");
  return body.data;
}
