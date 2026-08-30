const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/admin-login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Login failed.");
  return body.data;
}

export async function fetchAdminMe() {
  const res = await fetch(`${API_BASE_URL}/auth/admin-me`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data;
}

export async function adminLogout() {
  await fetch(`${API_BASE_URL}/auth/admin-logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function fetchAllEmployees({ includeAdmins = false } = {}) {
  const url = includeAdmins
    ? `${API_BASE_URL}/admin/employees?includeAdmins=true`
    : `${API_BASE_URL}/admin/employees`;
  const res = await fetch(url, {
    credentials: "include",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load employees.");
  return body.data;
}

export async function createEmployee(payload) {
  const res = await fetch(`${API_BASE_URL}/admin/employees`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not create employee.");
  return body.data;
}

export async function toggleEmployeeActive(employeeId, isActive) {
  const res = await fetch(`${API_BASE_URL}/admin/employees/${employeeId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not update employee.");
  return body;
}

export async function resetEmployeePassword(employeeId, password) {
  const res = await fetch(`${API_BASE_URL}/admin/employees/${employeeId}/password`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not reset password.");
  return body;
}
