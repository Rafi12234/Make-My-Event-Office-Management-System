import { API_URL } from "@/constants/config";
import { apiRequest } from "./client";

/**
 * Login is separate from apiRequest — there's no token yet to attach, and a
 * failed login shouldn't be treated as a stale-session 401.
 */
export async function mobileLogin({ email, password }) {
  const response = await fetch(`${API_URL}/mobile/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Login failed.");
  }

  return payload.data ?? payload;
}

export function getCurrentEmployee() {
  return apiRequest("/employees/me");
}

console.log(
  "LOGIN URL >>>",
  `${API_URL}/mobile/auth/login`,
);