const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const EMPLOYEE_STORAGE_KEY = "mme_current_employee_v3";

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

// Uses localStorage (not sessionStorage) so the cached employee survives
// closing the tab/browser entirely — the server-side mme_session cookie is
// effectively permanent (see employeeAuth.js), so the client cache needs to
// match that lifetime. Without this, closing the tab without logging out
// would wipe the local cache while the cookie stayed valid, leaving the SPA
// thinking no one was logged in even though the server still considered the
// employee authenticated.
export function loadCurrentEmployee() {
  try {
    const raw = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
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

  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(savedEmployee));
  return savedEmployee;
}

export async function changeEmployeePassword({ currentPassword, newPassword }) {
  const updatedEmployee = await apiRequest("/employees/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const merged = { ...loadCurrentEmployee(), ...updatedEmployee };
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function clearCurrentEmployee() {
  localStorage.removeItem(EMPLOYEE_STORAGE_KEY);
  // Clear the server-side session cookie too. Fire-and-forget: local
  // storage is already cleared either way, and the caller navigates away
  // immediately after calling this.
  apiRequest("/employees/logout", { method: "POST" }).catch(() => {});
}
