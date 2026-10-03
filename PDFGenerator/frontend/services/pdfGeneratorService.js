const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed with status ${response.status}.`);
  return payload.data ?? payload;
}

async function parsePdfResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }
  return response.blob();
}

export function resolvePdfImageUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function ensureMeetingPdfDraft(rowKey, meetingId) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/meeting/${rowKey}/${meetingId}/draft`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response);
}

export async function savePdfDraft(documentId, draft) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}`, {
    method: "PUT",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  return parseJsonResponse(response);
}

export async function resetPdfDraftFromMeeting(documentId) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/reset-from-meeting`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response);
}

export async function importExcelIntoPdfDraft(documentId, payload) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/import-excel`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}


export async function createPdfDocumentItem(documentId, itemName) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/items`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ itemName }),
  });
  return parseJsonResponse(response);
}

export async function deletePdfDocumentItem(documentId, itemId) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response);
}

export async function uploadPdfItemImage(documentId, itemId, file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}/images`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return parseJsonResponse(response);
}

export async function deletePdfItemImage(documentId, itemId, imageId) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}/images/${imageId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response);
}

export async function previewPdfDocument(documentId) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${documentId}/preview`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/pdf" },
  });
  return parsePdfResponse(response);
}

export function generatePdfDocument(documentId) {
  if (documentId == null || documentId === "") {
    throw new Error("A document ID is required to generate the PDF.");
  }

  /*
  |--------------------------------------------------------------------------
  | Native browser download
  |--------------------------------------------------------------------------
  |
  | Do not fetch the final PDF as response.blob(). For very large PDFs that
  | would make JavaScript wait for and hold the whole file in memory before
  | the browser download begins.
  |
  | A hidden iframe + POST form lets the browser handle the attachment response
  | directly while the employee remains on the PDF Builder page.
  |
  */
  const frameId = "mme-pdf-generate-download-frame";
  let frame = document.getElementById(frameId);

  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = frameId;
    frame.name = frameId;
    frame.title = "PDF download";
    frame.style.display = "none";
    document.body.appendChild(frame);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${API_BASE_URL}/pdf-generator/documents/${encodeURIComponent(
    String(documentId),
  )}/generate`;
  form.target = frameId;
  form.style.display = "none";

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export async function getPdfDocument(id) {
  const response = await fetch(`${API_BASE_URL}/pdf-generator/documents/${id}`, { credentials: "include" });
  return parseJsonResponse(response);
}
