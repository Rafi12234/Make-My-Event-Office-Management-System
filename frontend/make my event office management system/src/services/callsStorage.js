const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
    throw new Error(
      payload.message || `Request failed with status ${response.status}.`,
    );
  }

  return payload.data ?? payload;
}

export async function loadClientCalls(rowKey) {
  return apiRequest(`/calls/${rowKey}`);
}

export async function createCall(rowKey, { callDatetime, callDiscussion, employeeId }) {
  return apiRequest(`/calls/${rowKey}`, {
    method: "POST",
    body: JSON.stringify({ callDatetime, callDiscussion, employeeId }),
  });
}

export async function updateCall(rowKey, callId, { callDatetime, callDiscussion, nextCallDatetime, employeeId }) {
  return apiRequest(`/calls/${rowKey}/${callId}`, {
    method: "PUT",
    body: JSON.stringify({ callDatetime, callDiscussion, nextCallDatetime, employeeId }),
  });
}

export async function deleteCall(rowKey, callId) {
  return apiRequest(`/calls/${rowKey}/${callId}`, {
    method: "DELETE",
  });
}
