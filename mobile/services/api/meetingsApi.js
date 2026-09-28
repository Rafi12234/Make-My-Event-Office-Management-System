import { apiRequest } from "./client";

export function getMeetings(rowKey) {
  return apiRequest(`/meetings/${rowKey}`);
}

// meetingDatetime is never sent — the backend always stamps it with the
// server's current moment at creation (mirrors createCall).
export function createMeeting(rowKey) {
  return apiRequest(`/meetings/${rowKey}`, { method: "POST", body: JSON.stringify({}) });
}

export function updateMeeting(rowKey, meetingId, { nextMeetingDatetime, nextMeetingAssignedEmployeeId }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify({ nextMeetingDatetime, nextMeetingAssignedEmployeeId }),
  });
}

export function deleteMeeting(rowKey, meetingId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}`, { method: "DELETE" });
}

export function createMeetingItem(rowKey, meetingId, { itemKey, customLabel = "", description = "", quantity = 1 }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items`, {
    method: "POST",
    body: JSON.stringify({ itemKey, customLabel, description, quantity }),
  });
}

export function updateMeetingItem(rowKey, meetingId, itemId, { customLabel, description, quantity }) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ customLabel, description, quantity }),
  });
}

// `assets` are expo-image-picker result assets ({ uri, fileName, mimeType }).
export function uploadMeetingItemImages(rowKey, meetingId, itemId, assets) {
  const formData = new FormData();
  assets.forEach((asset, index) => {
    const extension = asset.uri.split(".").pop() || "jpg";
    formData.append("images", {
      uri: asset.uri,
      name: asset.fileName || `item-image-${index}.${extension}`,
      type: asset.mimeType || `image/${extension}`,
    });
  });

  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}/images`, {
    method: "POST",
    body: formData,
  });
}

export function deleteMeetingItem(rowKey, meetingId, itemId) {
  return apiRequest(`/meetings/${rowKey}/${meetingId}/items/${itemId}`, { method: "DELETE" });
}
