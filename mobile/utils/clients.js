function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Resolves each semantic client field to whatever column actually holds it
 * on THIS sheet — never assumes a fixed column_key, since admins can rename
 * columns (e.g. "Client Name" → "Name", "Event Date" → "Date") and the raw
 * key isn't guaranteed to match the display name at all. Mirrors the same
 * approach the backend itself uses (see calendarController.js's
 * `clientNameCol` lookup and callsController.js's `getClientName()`).
 */
export function buildClientColumnMap(columns) {
  const map = {};

  // These have dedicated data types, so they're unambiguous no matter what
  // the column was renamed to.
  for (const column of columns) {
    if (column.type === "venue" && !map.venue) map.venue = column.id;
    if (column.type === "shift" && !map.shift) map.shift = column.id;
    if (column.type === "phone" && !map.phone) map.phone = column.id;
    if (column.type === "last_meeting_time" && !map.lastMeetingTime) map.lastMeetingTime = column.id;
    if (column.type === "next_meeting_time" && !map.nextMeetingTime) map.nextMeetingTime = column.id;
  }

  // Generic text/date/number columns share a type with any other custom
  // column an admin might add, so these are matched by display name instead.
  const byName = (predicate) => columns.find((column) => predicate(normalize(column.name)));

  map.name = (
    byName((name) => name === "client name" || name === "name") ||
    byName((name) => name.includes("client") && name.includes("name"))
  )?.id;

  map.floor = byName((name) => name === "floor")?.id;
  map.guestCount = byName((name) => name.includes("guest"))?.id;

  map.eventDate = (
    byName((name) => name === "event date" || name === "date") ||
    columns.find((column) => column.type === "date")
  )?.id;

  return map;
}

export function mapRowToClient(row, columnMap = {}) {
  const values = row.values || {};
  const get = (field) => {
    const key = columnMap[field];
    return key ? String(values[key] ?? "") : "";
  };

  return {
    rowKey: row.id,
    name: get("name"),
    phone: get("phone"),
    venue: get("venue"),
    shift: get("shift"),
    floor: get("floor"),
    guestCount: get("guestCount"),
    eventDate: get("eventDate"),
    lastMeetingTime: get("lastMeetingTime"),
    nextMeetingTime: get("nextMeetingTime"),
    lastCallDatetime: row.lastCallDatetime || "",
    nextCallDatetime: row.nextCallDatetime || "",
    createdAt: row.createdAt || "",
  };
}

export function filterClients(clients, search) {
  const term = search.trim().toLowerCase();
  if (!term) return clients;

  return clients.filter(
    (client) =>
      client.name.toLowerCase().includes(term) ||
      client.phone.toLowerCase().includes(term) ||
      client.venue.toLowerCase().includes(term),
  );
}

// Mirrors ManagementPage.jsx's filter dropdown (web): date range applies to
// the client's last-meeting time, shift/venue are multi-select (empty set =
// no restriction), and sortOrder re-orders by createdAt. `filters` shape:
// { dateFrom: "YYYY-MM-DD", dateTo: "YYYY-MM-DD", shifts: Set, venues: Set }.
export function applyClientFilters(clients, filters, sortOrder = "default") {
  let rows = clients;

  if (filters.dateFrom || filters.dateTo) {
    rows = rows.filter((client) => {
      const date = String(client.lastMeetingTime || "").replace(" ", "T").slice(0, 10);
      if (!date) return false;
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo && date > filters.dateTo) return false;
      return true;
    });
  }

  if (filters.shifts?.size > 0) {
    rows = rows.filter((client) => filters.shifts.has(client.shift));
  }

  if (filters.venues?.size > 0) {
    rows = rows.filter((client) => filters.venues.has(client.venue));
  }

  if (sortOrder === "newest" || sortOrder === "oldest") {
    const sign = sortOrder === "newest" ? -1 : 1;
    rows = [...rows].sort((a, b) => sign * (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
  }

  return rows;
}

export function countActiveClientFilters(filters) {
  return (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0) + filters.shifts.size + filters.venues.size;
}

// RFC4122 v4-shaped id (hex + dashes only) — satisfies the backend's
// `isValidRowKey` regex without needing a native crypto/uuid dependency.
function generateRowKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

// Builds a brand-new sheet row for the workspace's full-replace save
// contract — mirrors the web app's `createEmptyRow` (defaultSheet.js),
// filling every existing column with "" then overlaying the given fields
// via buildClientColumnMap so it lands in whichever column actually holds
// each semantic field, however the sheet's columns were named/reordered.
export function buildNewClientRow(columns, fields, rowNumber) {
  const columnMap = buildClientColumnMap(columns);
  const values = Object.fromEntries(columns.map((column) => [column.id, ""]));

  for (const [field, value] of Object.entries(fields)) {
    const columnId = columnMap[field];
    if (columnId) values[columnId] = value;
  }

  const now = new Date().toISOString();
  return {
    id: generateRowKey(),
    rowNumber,
    values,
    createdAt: now,
    updatedAt: now,
  };
}
