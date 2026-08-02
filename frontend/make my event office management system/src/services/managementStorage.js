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
