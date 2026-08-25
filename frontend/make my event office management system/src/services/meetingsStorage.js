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

export function resolveImageUrl(url) {
  if (!url) return "";
  return `${API_ORIGIN}${url}`;
}

export async function loadClientMeetings(rowKey) {
  return apiRequest(`/meetings/${rowKey}`);
}

export async function createMeeting(rowKey, { meetingDatetime, employeeId }) {
  return apiRequest(`/meetings/${rowKey}`, {
    method: "POST",
    body: JSON.stringify({ meetingDatetime, employeeId }),
  });
}

export async function updateMeeting(rowKey, meetingId, { meetingDatetime, nextMeetingDatetime, nextMeetingAssignedEmployeeId, requirements, employeeId }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify({ meetingDatetime, nextMeetingDatetime, nextMeetingAssignedEmployeeId, requirements, employeeId }),
  });
}

export async function toggleImageFinalSelection(rowKey, imageId) {
  return apiRequest(`/meetings/${rowKey}/images/${imageId}/final`, {
    method: "PATCH",
  });
}

export async function updateMeetingImageTag(rowKey, imageId, tagName) {
  return apiRequest(`/meetings/${rowKey}/images/${imageId}/tag`, {
    method: "PATCH",
    body: JSON.stringify({ tagName }),
  });
}

export async function loadFinalizePreview(rowKey) {
  return apiRequest(`/meetings/${rowKey}/finalize/preview`);
}

export async function loadFinalizationDetail(rowKey) {
  return apiRequest(`/meetings/${rowKey}/finalize`);
}

export async function finalizeClient(rowKey, employeeId, items, budget) {
  return apiRequest(`/meetings/${rowKey}/finalize`, {
    method: "POST",
    body: JSON.stringify({ employeeId, items, budget }),
  });
}

export async function deleteMeeting(rowKey, meetingId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, {
    method: "DELETE",
  });
}

export async function uploadMeetingImages(rowKey, meetingId, files, employeeId, tagNames) {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  if (employeeId) formData.append("employeeId", String(employeeId));
  if (tagNames?.length) formData.append("tagNames", JSON.stringify(tagNames));

  return apiRequest(`/meetings/${rowKey}/${meetingId}/images`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteMeetingImage(rowKey, meetingId, imageId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/images/${imageId}`, {
    method: "DELETE",
  });
}

export async function createMeetingItem(rowKey, meetingId, { itemKey, customLabel, description, quantity, employeeId }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items`, {
    method: "POST",
    body: JSON.stringify({ itemKey, customLabel, description, quantity, employeeId }),
  });
}

export async function updateMeetingItem(rowKey, meetingId, itemId, { customLabel, description, quantity, employeeId }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ customLabel, description, quantity, employeeId }),
  });
}

export async function deleteMeetingItem(rowKey, meetingId, itemId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function uploadMeetingItemImages(rowKey, meetingId, itemId, files, employeeId) {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  if (employeeId) formData.append("employeeId", String(employeeId));

  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}/images`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteMeetingItemImage(rowKey, meetingId, itemId, imageId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}/images/${imageId}`, {
    method: "DELETE",
  });
}

