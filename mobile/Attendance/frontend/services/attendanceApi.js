import { apiRequest } from "@/services/api/client";

export function getTodayAttendance() {
  return apiRequest("/attendance/today");
}

export function getAttendanceHistory(limit = 30) {
  return apiRequest(`/attendance/history?limit=${limit}`);
}

// location: { latitude, longitude, accuracy } — never includes employeeId
// or any date/time field, the backend derives those itself (guide section 4/6).
export function signIn(location) {
  return apiRequest("/attendance/sign-in", {
    method: "POST",
    body: JSON.stringify(location),
  });
}

export function signOut(location) {
  return apiRequest("/attendance/sign-out", {
    method: "POST",
    body: JSON.stringify(location),
  });
}
