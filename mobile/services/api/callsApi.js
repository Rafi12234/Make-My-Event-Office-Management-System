import { apiRequest } from "./client";

export function getCalls(rowKey) {
  return apiRequest(`/calls/${rowKey}`);
}

// callDatetime is never sent — the backend always stamps it with the
// server's current moment at creation.
export function createCall(rowKey, { callDiscussion }) {
  return apiRequest(`/calls/${rowKey}`, {
    method: "POST",
    body: JSON.stringify({ callDiscussion }),
  });
}

export function updateCall(rowKey, callId, { callDiscussion, nextCallDatetime, nextCallAssignedEmployeeId }) {
  return apiRequest(`/calls/${rowKey}/${callId}`, {
    method: "PUT",
    body: JSON.stringify({ callDiscussion, nextCallDatetime, nextCallAssignedEmployeeId }),
  });
}

export function deleteCall(rowKey, callId) {
  return apiRequest(`/calls/${rowKey}/${callId}`, { method: "DELETE" });
}
