// Accounts module frontend service — mirrors the conventions used by the
// main app's src/services/*.js files (apiRequest wrapper, credentials:
// "include" for the mme_session cookie, FormData-aware Content-Type
// handling). Talks to the Accounts routes mounted at /api/accounts by the
// main backend's server.js (requireEmployee-gated), so the current
// employee is always derived server-side from the session cookie — no
// employeeId is ever sent from here.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message || `Request failed with status ${response.status}.`,
    );
  }

  return payload.data ?? payload;
}

// Receipt image URLs come back as server-relative paths
// (/accounts-uploads/expense-receipts/xxx.jpg) — this resolves them
// against the API origin the same way resolveImageUrl() does in
// authStorage.js for meeting images.
export function resolveImageUrl(url) {
  if (!url) return "";
  return `${API_ORIGIN}${url}`;
}

// ৳12,345.00 / -৳4,000.00 — used everywhere a money amount is displayed.
export function formatTaka(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}\u09F3${abs}`;
}

// Backend dates come back as "YYYY-MM-DD" (or "YYYY-MM-DD HH:MM:SS" for
// timestamps) so they round-trip cleanly through native <input type="date">
// elements. Every read-only date shown in the Accounts UI is reformatted
// to "DD/MM/YY" via these instead — input elements are left untouched.
export function formatDisplayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year.slice(-2)}`;
}

export function formatDisplayDateTime(value) {
  if (!value) return "";
  const [datePart, timePart] = String(value).split(" ");
  const formattedDate = formatDisplayDate(datePart);
  return timePart ? `${formattedDate} ${timePart}` : formattedDate;
}

export async function loadAccountsSummary() {
  return apiRequest("/accounts/summary");
}

export async function loadBookedEvents() {
  return apiRequest("/accounts/booked-events");
}

export async function loadVendors() {
  return apiRequest("/accounts/vendors");
}

export async function loadVendorProfile(vendorId) {
  return apiRequest(`/accounts/vendors/${vendorId}`);
}

export async function payVendor(vendorId, { amount, paidOn, note }) {
  return apiRequest(`/accounts/vendors/${vendorId}/pay`, {
    method: "POST",
    body: JSON.stringify({ amount, paidOn, note }),
  });
}

export async function addMoneyReceived({ amount, receivedDate, note }) {
  return apiRequest("/accounts/money-received", {
    method: "POST",
    body: JSON.stringify({ amount, receivedDate, note }),
  });
}

// items: [{ purpose, costDate, quantity, perQtyAmount, receiptFile? }]
// costType: "event" | "regular"; linkedRowKey required when costType is "event".
export async function submitExpense({ costType, linkedRowKey, items }) {
  const formData = new FormData();
  formData.append("costType", costType);
  if (linkedRowKey) formData.append("linkedRowKey", linkedRowKey);
  formData.append(
    "items",
    JSON.stringify(
      items.map(({ purpose, costDate, quantity, perQtyAmount, vendorId, paymentStatus }) => ({
        purpose,
        costDate,
        quantity,
        perQtyAmount,
        vendorId: vendorId || null,
        paymentStatus: vendorId ? paymentStatus : null,
      })),
    ),
  );
  items.forEach((item, index) => {
    if (item.receiptFile) formData.append(`receipt_${index}`, item.receiptFile);
  });

  return apiRequest("/accounts/expenses", {
    method: "POST",
    body: formData,
  });
}
