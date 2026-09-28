import { API_URL }
  from "../../constants/config";

import {
  getAccessToken,
  removeAccessToken,
} from "../storage/authStorage";

export class ApiError extends Error {
  constructor(
    message,
    status,
    code = null,
    data = null,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Raw authenticated request.
 *
 * Used by:
 * - normal API requests
 * - PDF preview
 * - PDF download
 */
export async function apiFetch(
  path,
  options = {},
) {
  const token =
    await getAccessToken();

  const isFormData =
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",

    ...(options.body &&
    !isFormData
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),

    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),

    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers,
    },
  );

  if (response.status === 401) {
    await removeAccessToken();
  }

  return response;
}

/**
 * Normal JSON API helper.
 */
export async function apiRequest(
  path,
  options = {},
) {
  const response =
    await apiFetch(
      path,
      options,
    );

  const payload =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.message ||
        `Request failed (${response.status}).`,

      response.status,

      payload.code || null,

      payload,
    );
  }

  return payload.data ?? payload;
}