import { apiRequest } from "./client";

export function getCalendarMonth(year, month) {
  return apiRequest(`/calendar?year=${year}&month=${month}`);
}
