// Money Receipt Generator frontend service — Admin-only, hits
// /api/admin/money-receipts (gated by the admin session cookie server-side;
// an employee session can never reach these endpoints). Mirrors
// adminAccountsService.js's apiRequest conventions.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/admin/money-receipts${path}`, {
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

function toReceiptRequestBody(form) {
  return {
    receiptDate: form.receiptDate,
    clientName: form.clientName.trim(),
    clientPhone: form.clientPhone.trim(),
    clientEmail: form.clientEmail.trim() || null,
    clientAddress: form.clientAddress.trim() || null,
    eventName: form.eventName.trim() || null,
    eventDate: form.eventDate || null,
    eventVenue: form.eventVenue.trim() || null,
    bookingReference: form.bookingReference.trim() || null,
    totalPayment: form.totalPayment,
    advancePayment: form.advancePayment,
    paymentMethod: form.paymentMethod,
    paymentMethodOther: form.paymentMethod === "other" ? form.paymentMethodOther.trim() : null,
    transactionReference: form.transactionReference.trim() || null,
    remarks: form.remarks.trim() || null,
  };
}

async function parsePdfResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return response.blob();
}

export async function previewMoneyReceipt(form) {
  const response = await fetch(`${API_BASE_URL}/admin/money-receipts/preview`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/pdf" },
    body: JSON.stringify(toReceiptRequestBody(form)),
  });
  return parsePdfResponse(response);
}

export async function createMoneyReceipt(form) {
  return apiRequest("", { method: "POST", body: JSON.stringify(toReceiptRequestBody(form)) });
}

export async function listMoneyReceipts(filters = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return apiRequest(`${query ? `?${query}` : ""}`);
}

export async function downloadMoneyReceipt(id) {
  const response = await fetch(`${API_BASE_URL}/admin/money-receipts/${id}/download`, { credentials: "include" });
  return parsePdfResponse(response);
}

export async function archiveMoneyReceipt(id) {
  return apiRequest(`/${id}/archive`, { method: "PATCH" });
}

// Triggers a real browser download for a blob without navigating away.
export function saveBlobAs(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
