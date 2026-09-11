// PDF Generator module frontend service — mirrors Accounts/frontend/services/
// accountsService.js's conventions (credentials: "include" for the session
// cookie, FormData multipart requests, no employeeId ever sent from here —
// the backend derives it from the session).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function buildDocumentFormData({ eventDate, eventTitle, items }) {
  const formData = new FormData();
  formData.append(
    "document",
    JSON.stringify({
      eventDate,
      eventTitle,
      items: items.map((item) => ({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        customCaption: item.customCaption?.trim() || null,
        imageKey: item.referenceImages?.length ? `image_${item.clientId}` : null,
      })),
    }),
  );

  for (const item of items) {
    for (const file of item.referenceImages || []) {
      formData.append(`image_${item.clientId}`, file);
    }
  }

  return formData;
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return payload.data ?? payload;
}

async function parsePdfResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return response.blob();
}

export async function previewPdfDocument(documentForm) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/preview`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/pdf" },
    body: buildDocumentFormData(documentForm),
  });
  return parsePdfResponse(response);
}

export async function createPdfDocument(documentForm) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents`, {
    method: "POST",
    credentials: "include",
    body: buildDocumentFormData(documentForm),
  });
  return parseJsonResponse(response);
}

export async function listPdfDocuments() {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents`, { credentials: "include" });
  return parseJsonResponse(response);
}

export async function getPdfDocument(id) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${id}`, { credentials: "include" });
  return parseJsonResponse(response);
}

export async function downloadPdfDocument(id) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${id}/download`, {
    credentials: "include",
  });
  return parsePdfResponse(response);
}

export async function archivePdfDocument(id) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${id}/archive`, {
    method: "PATCH",
    credentials: "include",
  });
  return parseJsonResponse(response);
}

// Triggers a real browser download for a blob (from previewPdfDocument /
// downloadPdfDocument) without navigating away from the SPA.
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
