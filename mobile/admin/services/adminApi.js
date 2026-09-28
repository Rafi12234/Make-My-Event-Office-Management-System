import {
  apiFetch,
  apiRequest,
  ApiError,
} from "@/services/api/client";

import {
  getAccessToken,
  removeAccessToken,
} from "@/services/storage/authStorage";

function queryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "",
  );

  if (!entries.length) {
    return "";
  }

  return `?${entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&")}`;
}

/* =========================
   MAIN ADMIN BACKEND :5000
   ========================= */

export const fetchAdminDashboard = () =>
  apiRequest("/admin/dashboard");

export const fetchAdminClientDetail = (rowKey) =>
  apiRequest(
    `/admin/dashboard/clients/${encodeURIComponent(rowKey)}`,
  );

export const fetchAdminWorkspace = () =>
  apiRequest("/admin/workspace");

export const updateAdminWorkspaceCell = (
  rowKey,
  columnKey,
  value,
) =>
  apiRequest(
    `/admin/workspace/rows/${encodeURIComponent(rowKey)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ columnKey, value }),
    },
  );

export const fetchAllEmployees = ({ includeAdmins = false } = {}) =>
  apiRequest(
    `/admin/employees${includeAdmins ? "?includeAdmins=true" : ""}`,
  );

export const createEmployee = (payload) =>
  apiRequest("/admin/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const toggleEmployeeActive = (employeeId, isActive) =>
  apiRequest(`/admin/employees/${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });

export const resetEmployeePassword = (employeeId, password) =>
  apiRequest(`/admin/employees/${employeeId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });

export const fetchAllMeetings = () =>
  apiRequest("/admin/meetings");

export const fetchAllCalls = () =>
  apiRequest("/admin/calls");

export const fetchClientMeetingsForAdmin = (rowKey) =>
  apiRequest(
    `/admin/clients/${encodeURIComponent(rowKey)}/meetings`,
  );

export const fetchClientCallsForAdmin = (rowKey) =>
  apiRequest(
    `/admin/clients/${encodeURIComponent(rowKey)}/calls`,
  );

export const updateNextMeetingSchedule = (meetingId, payload) =>
  apiRequest(`/admin/meetings/${meetingId}/next`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const updateNextCallSchedule = (callId, payload) =>
  apiRequest(`/admin/calls/${callId}/next`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchAdminAttendance = (filters = {}) =>
  apiRequest(`/admin/attendance${queryString(filters)}`);

export const fetchAdminAttendanceDetail = (attendanceId) =>
  apiRequest(`/admin/attendance/${attendanceId}`);

export const fetchAdminCalendarMonth = (year, month) =>
  apiRequest(`/admin/calendar?year=${year}&month=${month}`);

/* =========================
   MOBILE ADMIN BACKEND :5001
   Financial Accounts + Money Receipts
   ========================= */

const MOBILE_ADMIN_API_URL = String(
  process.env.EXPO_PUBLIC_ADMIN_API_URL || "",
).replace(/\/$/, "");

async function mobileAdminFetch(path, options = {}) {
  if (!MOBILE_ADMIN_API_URL) {
    throw new Error(
      "EXPO_PUBLIC_ADMIN_API_URL is not configured in mobile/.env.",
    );
  }

  const token = await getAccessToken();
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${MOBILE_ADMIN_API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Could not connect to the Mobile Admin backend. Make sure port 5001 is running and the phone can reach your PC.",
    );
  }

  if (response.status === 401) {
    await removeAccessToken();
  }

  return response;
}

async function mobileAdminRequest(path, options = {}) {
  const response = await mobileAdminFetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.message || `Request failed (${response.status}).`,
      response.status,
      payload.code || null,
      payload,
    );
  }

  return payload.data ?? payload;
}

const accounts = (path, options) =>
  mobileAdminRequest(`/admin/accounts${path}`, options);

export const loadEmployeeWallets = () =>
  accounts("/employees");

export const loadEmployeeProfile = (employeeId) =>
  accounts(`/employees/${encodeURIComponent(employeeId)}`);

export const loadMoneyIn = (params = {}) =>
  accounts(`/money-in${queryString(params)}`);

export const addMoneyToEmployee = (payload) =>
  accounts("/money-in", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateMoneyIn = (id, payload) =>
  accounts(`/money-in/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const loadExpenses = (params = {}) =>
  accounts(`/expenses${queryString(params)}`);

export const loadExpense = (id) =>
  accounts(`/expenses/${encodeURIComponent(id)}`);

export const previewExpenseUpdate = (id, items) =>
  accounts(`/expenses/${encodeURIComponent(id)}/preview`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });

export const updateExpense = (id, payload) =>
  accounts(`/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const voidExpense = (id, reason) =>
  accounts(`/expenses/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const approveExpense = (id) =>
  accounts(`/expenses/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });

export const loadVendors = (params = {}) =>
  accounts(`/vendors${queryString(params)}`);

export const loadVendorProfile = (id) =>
  accounts(`/vendors/${encodeURIComponent(id)}`);

export const loadVendorOutstandingItems = (id) =>
  accounts(`/vendors/${encodeURIComponent(id)}/outstanding`);

export const createVendor = (payload) =>
  accounts("/vendors", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateVendor = (id, payload) =>
  accounts(`/vendors/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const setVendorStatus = (id, isActive, reason = "") =>
  accounts(`/vendors/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive, reason }),
  });

export const addDirectVendorCost = (id, payload) =>
  accounts(`/vendors/${encodeURIComponent(id)}/cost`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const addDirectVendorPayment = (id, payload) =>
  accounts(`/vendors/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/* =========================
   MONEY RECEIPTS — ALSO :5001
   ========================= */

const receipts = (path, options) =>
  mobileAdminRequest(`/admin/money-receipts${path}`, options);

export const createMoneyReceipt = (payload) =>
  receipts("", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listMoneyReceipts = (params = {}) =>
  receipts(queryString(params));

export const listConfirmedClients = () =>
  receipts("/confirmed-clients");

export const getMoneyReceipt = (id) =>
  receipts(`/${encodeURIComponent(id)}`);

export const archiveMoneyReceipt = (id) =>
  receipts(`/${encodeURIComponent(id)}/archive`, {
    method: "PATCH",
  });

export const previewMoneyReceiptResponse = (payload) =>
  mobileAdminFetch("/admin/money-receipts/preview", {
    method: "POST",
    headers: {
      Accept: "application/pdf",
    },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(
        payload.message || `Request failed (${response.status}).`,
        response.status,
        payload.code || null,
        payload,
      );
    }
    return response;
  });

export const downloadMoneyReceiptResponse = (id) =>
  mobileAdminFetch(
    `/admin/money-receipts/${encodeURIComponent(id)}/download`,
    {
      headers: {
        Accept: "application/pdf",
      },
    },
  ).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(
        payload.message || `Request failed (${response.status}).`,
        response.status,
        payload.code || null,
        payload,
      );
    }
    return response;
  });
