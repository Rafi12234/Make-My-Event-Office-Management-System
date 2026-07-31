// Prisma returns native JS Date objects for MySQL DATE/TIME/DATETIME
// columns. The app was originally built against mysql2's `dateStrings: true`
// output, which returned plain strings ("YYYY-MM-DD", "HH:MM:SS",
// "YYYY-MM-DD HH:MM:SS") with no timezone conversion. Several frontend
// pieces depend on that exact shape — most importantly native
// <input type="date"> / "time" / "datetime-local"> elements, which reject
// any value that isn't in precisely that format (no trailing "Z", no
// milliseconds, no full ISO datetime for a date-only value, etc).
//
// The mariadb driver (used by Prisma's driver adapter) constructs these
// Date objects by treating the raw column digits as UTC, so reading the
// UTC components back out here reproduces the original wall-clock values
// exactly, with no timezone shift.

export function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatTimeOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(11, 19);
}

export function formatDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ─── Parsing (frontend string → Date for Prisma writes) ────────────────
//
// The inverse of the formatters above: takes a naive "YYYY-MM-DD",
// "HH:MM"/"HH:MM:SS", or "YYYY-MM-DDTHH:MM[:SS]" string (as sent by native
// <input type="date"/"time"/"datetime-local"> elements) and builds a Date
// object whose UTC components match those digits exactly — so writing it
// via Prisma and reading it back via the formatters above round-trips to
// the exact same string, with no timezone shift in either direction.

export function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${String(value).trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTimeOnly(value) {
  if (!value) return null;
  let time = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(time)) time += ":00";
  const date = new Date(`1970-01-01T${time}.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateTimeLocal(value) {
  if (!value) return null;
  let datetime = String(value).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datetime)) datetime += ":00";
  const date = new Date(`${datetime}.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
