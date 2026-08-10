const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Read-only mirror of the employee side's loadWorkspace — same live
// dynamic columns/rows, minus the Last/Next Meeting Time (LAT/NAT)
// columns. See adminWorkspaceController.js for the exact shape.
export async function fetchAdminWorkspace() {
  const res = await fetch(`${API_BASE_URL}/admin/workspace`, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load the client table.");
  return body.data;
}

// Edits exactly one cell — deliberately scoped (not a whole-sheet replace)
// so the admin's LAT/NAT-less view can never touch other rows/columns.
export async function updateAdminWorkspaceCell(rowKey, columnKey, value) {
  const res = await fetch(`${API_BASE_URL}/admin/workspace/rows/${rowKey}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columnKey, value }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not save the change.");
  return body.data;
}
