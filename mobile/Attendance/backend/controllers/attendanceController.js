import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getOfficeDistance, MAKE_MY_EVENT_OFFICE_RADIUS_METERS } from "../utils/officeLocation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main backend project's src/ - not at a fixed relative depth once deployed
// (production's layout doesn't mirror this repo's nesting), so BACKEND_SRC_DIR
// lets deployment point at wherever it actually lands; local dev falls back
// to the real repo-relative path. Mirrors
// Accounts/backend/controllers/accountsController.js (one extra "../" here
// since this module is nested inside mobile/, not a repo-root sibling).
// Loaded via require() (not import()) - see server.js for why top-level
// await must be avoided anywhere in this module graph.
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../../backend/mme_node_express_backend/src");

const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
const { nowInBusinessTimezone, formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

// Round only for storage/display — the inside/outside decision itself was
// already made from the raw distance inside getOfficeDistance().
function roundDistance(distanceFromOffice) {
  return Math.round(distanceFromOffice * 100) / 100;
}

/**
 * Validates client-reported GPS coordinates — the backend never trusts
 * these blindly (guide section 12: coordinate validation).
 */
function parseCoordinates(body) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy =
    body.accuracy === undefined || body.accuracy === null || body.accuracy === ""
      ? null
      : Number(body.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: "A valid latitude between -90 and 90 is required." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: "A valid longitude between -180 and 180 is required." };
  }
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    return { error: "Accuracy must be a non-negative number." };
  }

  return { latitude, longitude, accuracy };
}

// "Business now" + the matching business-date Date value for the
// attendances.attendance_date column, both derived backend-side per guide
// section 6 — never taken from client input.
function businessNow() {
  const now = nowInBusinessTimezone();
  return { now, attendanceDate: parseDateOnly(formatDateOnly(now)) };
}

function serializeAttendance(row) {
  if (!row) return null;

  const status = !row.signInAt ? "absent" : row.signOutAt ? "completed" : "working";
  const durationMinutes =
    row.signInAt && row.signOutAt
      ? Math.round((row.signOutAt.getTime() - row.signInAt.getTime()) / 60000)
      : null;

  return {
    id: row.id,
    attendanceDate: formatDateOnly(row.attendanceDate),
    signInAt: formatDateTime(row.signInAt),
    signInLatitude: row.signInLatitude !== null ? Number(row.signInLatitude) : null,
    signInLongitude: row.signInLongitude !== null ? Number(row.signInLongitude) : null,
    signInAccuracy: row.signInAccuracy !== null ? Number(row.signInAccuracy) : null,
    signOutAt: formatDateTime(row.signOutAt),
    signOutLatitude: row.signOutLatitude !== null ? Number(row.signOutLatitude) : null,
    signOutLongitude: row.signOutLongitude !== null ? Number(row.signOutLongitude) : null,
    signOutAccuracy: row.signOutAccuracy !== null ? Number(row.signOutAccuracy) : null,    signInDistanceFromOffice:
      row.signInDistanceFromOffice !== null && row.signInDistanceFromOffice !== undefined
        ? Number(row.signInDistanceFromOffice)
        : null,
    signInInsideOffice: row.signInInsideOffice ?? null,
    signOutDistanceFromOffice:
      row.signOutDistanceFromOffice !== null && row.signOutDistanceFromOffice !== undefined
        ? Number(row.signOutDistanceFromOffice)
        : null,
    signOutInsideOffice: row.signOutInsideOffice ?? null,
    officeRadiusMeters: MAKE_MY_EVENT_OFFICE_RADIUS_METERS,    status,
    durationMinutes,
  };
}

/**
 * GET /api/attendance/today
 */
export async function getToday(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const { attendanceDate } = businessNow();

    const row = await prisma.attendance.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    });

    res.json({ data: serializeAttendance(row) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attendance/sign-in
 */
export async function signIn(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const coords = parseCoordinates(req.body || {});
    if (coords.error) {
      return res.status(422).json({ message: coords.error });
    }

    const { now, attendanceDate } = businessNow();

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    });
    if (existing) {
      return res.status(409).json({ message: "You already signed in today." });
    }

    const { distanceFromOffice, isInsideOffice } = getOfficeDistance(coords.latitude, coords.longitude);

    const row = await prisma.attendance.create({
      data: {
        employeeId,
        attendanceDate,
        signInAt: now,
        signInLatitude: coords.latitude,
        signInLongitude: coords.longitude,
        signInAccuracy: coords.accuracy,
        signInDistanceFromOffice: roundDistance(distanceFromOffice),
        signInInsideOffice: isInsideOffice,
      },
    });

    res.status(201).json({ data: serializeAttendance(row) });
  } catch (error) {
    // Two near-simultaneous sign-in requests can both pass the findUnique
    // check above; the DB's own unique constraint is the real guard.
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You already signed in today." });
    }
    next(error);
  }
}

/**
 * POST /api/attendance/sign-out
 */
export async function signOut(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const coords = parseCoordinates(req.body || {});
    if (coords.error) {
      return res.status(422).json({ message: coords.error });
    }

    const { now, attendanceDate } = businessNow();

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    });
    if (!existing) {
      return res.status(409).json({ message: "Please sign in first." });
    }
    if (existing.signOutAt) {
      return res.status(409).json({ message: "You already signed out today." });
    }

    const { distanceFromOffice, isInsideOffice } = getOfficeDistance(coords.latitude, coords.longitude);

    const row = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        signOutAt: now,
        signOutLatitude: coords.latitude,
        signOutLongitude: coords.longitude,
        signOutAccuracy: coords.accuracy,
        signOutDistanceFromOffice: roundDistance(distanceFromOffice),
        signOutInsideOffice: isInsideOffice,
      },
    });

    res.json({ data: serializeAttendance(row) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/history?limit=30
 */
export async function getHistory(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const limitParam = Number(req.query.limit);
    const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;

    const rows = await prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { attendanceDate: "desc" },
      take,
    });

    res.json({ data: rows.map(serializeAttendance) });
  } catch (error) {
    next(error);
  }
}
