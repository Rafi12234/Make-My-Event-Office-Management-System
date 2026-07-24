const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function adminHeaders(adminId) {
  return {
    "Content-Type": "application/json",
    "x-admin-id": String(adminId),
  };
}

export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Login failed.");
  return body.data;
}

export async function fetchAllEmployees(adminId) {
  const res = await fetch(`${API_BASE_URL}/admin/employees`, {
    headers: adminHeaders(adminId),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not load employees.");
  return body.data;
}

export async function createEmployee(adminId, payload) {
  const res = await fetch(`${API_BASE_URL}/admin/employees`, {
    method: "POST",
    headers: adminHeaders(adminId),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not create employee.");
  return body.data;
}

export async function toggleEmployeeActive(adminId, employeeId, isActive) {
  const res = await fetch(`${API_BASE_URL}/admin/employees/${employeeId}`, {
    method: "PATCH",
    headers: adminHeaders(adminId),
    body: JSON.stringify({ isActive }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not update employee.");
  return body;
}
