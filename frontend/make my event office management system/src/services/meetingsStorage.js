const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export async function createMeeting(rowKey, { meetingDatetime, discussionNotes, employeeId }) {
  return apiRequest(`/meetings/${rowKey}`, {
    method: "POST",
    body: JSON.stringify({ meetingDatetime, discussionNotes, employeeId }),
  });
}

export async function updateMeeting(rowKey, meetingId, { meetingDatetime, discussionNotes, employeeId }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify({ meetingDatetime, discussionNotes, employeeId }),
  });
}

export async function deleteMeeting(rowKey, meetingId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, {
    method: "DELETE",
  });
}

export async function uploadMeetingImages(rowKey, meetingId, files, employeeId) {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  if (employeeId) formData.append("employeeId", String(employeeId));

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
