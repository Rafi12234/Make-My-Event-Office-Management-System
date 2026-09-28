export function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "YYYY-MM-DD" for an arbitrary Date — matches the format the backend's
// Event Date column stores (see normalizeEventDate.js on the backend).
export function toDateInputString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "YYYY-MM-DDTHH:MM" using the Date object's LOCAL wall-clock getters —
// matches exactly what an HTML <input type="datetime-local"> submits, which
// is what the backend's parseDateTimeLocal() expects (see dbDates.js).
export function toDateTimeLocalString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Backend timestamps come back as "YYYY-MM-DD HH:MM:SS" — used by the
// Accounts module's history feed for "submitted at" display.
export function formatDisplayDateTime(value) {
  if (!value) return "";
  const [datePart, timePart] = String(value).split(" ");
  const formattedDate = formatDisplayDate(datePart);
  return timePart ? `${formattedDate} ${timePart}` : formattedDate;
}

// Backend times are plain "HH:MM" 24-hour strings — this only formats
// display, it does not shift timezones.
export function formatDisplayTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}
