import { apiRequest } from "./client";

export function getEmployeeDirectory() {
  return apiRequest("/employees");
}
