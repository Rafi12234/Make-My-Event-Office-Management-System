import { DEFAULT_COLUMNS } from "../data/defaultSheet";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
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

export async function loadEmployeeDirectory() {
  return apiRequest("/employees");
}

export function createDefaultWorkspace() {
  return {
    id: "meeting-management",
    name: "Meeting Management",
    columns: DEFAULT_COLUMNS,
    rows: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadWorkspace() {
  return apiRequest("/workspace/default");
}

export async function saveWorkspace(workspace, employeeId) {
  return apiRequest("/workspace/default", {
    method: "PUT",
    body: JSON.stringify({ workspace, employeeId }),
  });
}

// Fast incremental save used by the Management page. Only rows that are new
// or actually changed are sent to the backend; unchanged clients are never
// rewritten. This keeps normal saves fast even when the shared sheet grows.
export async function saveWorkspaceChanges(columns, rows) {
  return apiRequest("/workspace/default/changes", {
    method: "PATCH",
    body: JSON.stringify({ columns, rows }),
  });
}

// Permanently deletes one or many clients in a single backend transaction.
export async function deleteWorkspaceRows(rowKeys) {
  return apiRequest("/workspace/default/rows/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ rowKeys }),
  });
}

// Lightweight row-key snapshot used for cross-employee add/delete notices.
// It deliberately avoids downloading every cell in the management sheet.
export async function loadWorkspaceRowSnapshot() {
  return apiRequest("/workspace/default/row-snapshot");
}

// Saves only the "already booked with another company" badge for an existing
// client. It intentionally does not send the row's other cells, so unrelated
// in-progress edits are not committed accidentally.
export async function setWorkspaceRowAlreadyBooked(rowKey, alreadyBooked) {
  return apiRequest(`/workspace/default/rows/${encodeURIComponent(rowKey)}/already-booked`, {
    method: "PATCH",
    body: JSON.stringify({ alreadyBooked: Boolean(alreadyBooked) }),
  });
}
