import { DEFAULT_COLUMNS } from "../data/defaultSheet";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const EMPLOYEE_STORAGE_KEY = "mme_current_employee_v3";

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

export function loadCurrentEmployee() {
  try {
    const raw = sessionStorage.getItem(EMPLOYEE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCurrentEmployee({ email, password }) {
  const savedEmployee = await apiRequest("/employees/identify", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  sessionStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(savedEmployee));
  return savedEmployee;
}

export function clearCurrentEmployee() {
  sessionStorage.removeItem(EMPLOYEE_STORAGE_KEY);
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
