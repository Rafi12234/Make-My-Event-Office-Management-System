const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured. Check mobile/.env.");
}

// Strip a trailing slash so callers can always do `${API_URL}/path`.
export const API_URL = apiUrl.replace(/\/$/, "");

// Origin (no /api suffix) — needed to resolve existing relative upload URLs
// like /uploads/meeting-images/<file>.jpg returned by the backend.
export const API_ORIGIN = API_URL.replace(/\/api$/, "");

export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || "development";
