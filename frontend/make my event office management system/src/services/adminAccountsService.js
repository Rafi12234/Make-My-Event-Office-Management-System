const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

// Admin Accounts APIs live under /api/admin/accounts and are gated by the
// admin session cookie — an employee session can never reach them.
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/admin/accounts${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function resolveImageUrl(url) {
  if (!url) return "";
  return `${API_ORIGIN}${url}`;
}

export function formatTaka(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}\u09F3${abs}`;
}

export function formatDisplayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year.slice(-2)}`;
}

export function formatDisplayDateTime(value) {
  if (!value) return "—";
  const [datePart, timePart = ""] = String(value).split(" ");
  return `${formatDisplayDate(datePart)}${timePart ? ` ${timePart.slice(0, 5)}` : ""}`;
}

// ─── Overview / dashboards ─────────────────────────────────────

export const loadOverview = (params) => apiRequest(`/overview${toQuery(params)}`);
export const loadActivityFeed = () => apiRequest("/activity");
export const loadReconciliation = () => apiRequest("/reconciliation");
export const loadRangeSummary = (params) => apiRequest(`/summary${toQuery(params)}`);
export const loadEventCostOverview = (params) => apiRequest(`/events${toQuery(params)}`);

// ─── Employees ─────────────────────────────────────────────────

export const loadEmployeeWallets = () => apiRequest("/employees");
export const loadEmployeeProfile = (employeeId) => apiRequest(`/employees/${employeeId}`);

// ─── Money In ──────────────────────────────────────────────────

export const loadMoneyIn = (params) => apiRequest(`/money-in${toQuery(params)}`);

export const addMoneyToEmployee = (payload) =>
  apiRequest("/money-in", { method: "POST", body: JSON.stringify(payload) });

export const updateMoneyIn = (id, payload) =>
  apiRequest(`/money-in/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const voidMoneyIn = (id, reason) =>
  apiRequest(`/money-in/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) });

// ─── Expenses ──────────────────────────────────────────────────

export const loadExpenses = (params) => apiRequest(`/expenses${toQuery(params)}`);
export const loadExpense = (id) => apiRequest(`/expenses/${id}`);

// Dry run — returns the wallet/vendor impact so it can be confirmed before saving.
export const previewExpenseUpdate = (id, items) =>
  apiRequest(`/expenses/${id}/preview`, { method: "POST", body: JSON.stringify({ items }) });

export const updateExpense = (id, payload) =>
  apiRequest(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const voidExpense = (id, reason) =>
  apiRequest(`/expenses/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) });

// ─── Vendors ───────────────────────────────────────────────────

export const loadVendors = (params) => apiRequest(`/vendors${toQuery(params)}`);
export const loadVendorProfile = (id) => apiRequest(`/vendors/${id}`);

// Every still-open bill for this vendor — powers the "Which bill is this
// settling?" picker so a payment never silently nets against an
// unrelated purchase that just happens to share the same vendor/event.
export const loadVendorOutstandingItems = (id) => apiRequest(`/vendors/${id}/outstanding`);

export const createVendor = (payload) =>
  apiRequest("/vendors", { method: "POST", body: JSON.stringify(payload) });

export const updateVendor = (id, payload) =>
  apiRequest(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const setVendorStatus = (id, isActive, reason) =>
  apiRequest(`/vendors/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive, reason }),
  });

export const addDirectVendorCost = (id, payload) =>
  apiRequest(`/vendors/${id}/cost`, { method: "POST", body: JSON.stringify(payload) });

export const addDirectVendorPayment = (id, payload) =>
  apiRequest(`/vendors/${id}/pay`, { method: "POST", body: JSON.stringify(payload) });

// ─── Audit ─────────────────────────────────────────────────────

export const loadAuditLogs = (params) => apiRequest(`/audit${toQuery(params)}`);

// ─── CSV export ────────────────────────────────────────────────

export function exportRowsToCsv(filename, columns, rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = [
    columns.map((column) => escape(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(",")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
