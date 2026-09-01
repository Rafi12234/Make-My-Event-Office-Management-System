import { prisma } from "../config/prisma.js";
import { formatDateOnly, formatDateTime, parseDateOnly } from "../utils/dbDates.js";

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializeAttendance(row) {
  const status = !row.signInAt ? "absent" : row.signOutAt ? "completed" : "working";
  const durationMinutes =
    row.signInAt && row.signOutAt
      ? Math.round((row.signOutAt.getTime() - row.signInAt.getTime()) / 60000)
      : null;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.fullName || null,
    attendanceDate: formatDateOnly(row.attendanceDate),
    signInAt: formatDateTime(row.signInAt),
    signInLatitude: row.signInLatitude !== null ? Number(row.signInLatitude) : null,
    signInLongitude: row.signInLongitude !== null ? Number(row.signInLongitude) : null,
    signInAccuracy: row.signInAccuracy !== null ? Number(row.signInAccuracy) : null,
    signOutAt: formatDateTime(row.signOutAt),
    signOutLatitude: row.signOutLatitude !== null ? Number(row.signOutLatitude) : null,
    signOutLongitude: row.signOutLongitude !== null ? Number(row.signOutLongitude) : null,
    signOutAccuracy: row.signOutAccuracy !== null ? Number(row.signOutAccuracy) : null,
    signInDistanceFromOffice:
      row.signInDistanceFromOffice !== null && row.signInDistanceFromOffice !== undefined
        ? Number(row.signInDistanceFromOffice)
        : null,
    signInInsideOffice: row.signInInsideOffice ?? null,
    signOutDistanceFromOffice:
      row.signOutDistanceFromOffice !== null && row.signOutDistanceFromOffice !== undefined
        ? Number(row.signOutDistanceFromOffice)
        : null,
    signOutInsideOffice: row.signOutInsideOffice ?? null,
    status,
    durationMinutes,
  };
}

/**
 * GET /api/admin/attendance
 * Optional filters: employeeId, date (exact), from/to (range) — all applied
 * against attendance_date, per guide section 15.
 */
export async function listAttendance(req, res, next) {
  try {
    const where = {};

    const employeeId = isValidId(req.query.employeeId);
    if (employeeId) where.employeeId = employeeId;

    if (req.query.date) {
      const date = parseDateOnly(req.query.date);
      if (date) where.attendanceDate = date;
    } else if (req.query.from || req.query.to) {
      where.attendanceDate = {};
      const from = req.query.from ? parseDateOnly(req.query.from) : null;
      const to = req.query.to ? parseDateOnly(req.query.to) : null;
      if (from) where.attendanceDate.gte = from;
      if (to) where.attendanceDate.lte = to;
    }

    const rows = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ attendanceDate: "desc" }, { signInAt: "desc" }],
      take: 500,
    });

    res.json({ data: rows.map(serializeAttendance) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/attendance/:attendanceId
 * Full record including both locations and GPS accuracy (guide section 15).
 */
export async function getAttendanceDetail(req, res, next) {
  try {
    const attendanceId = isValidId(req.params.attendanceId);
    if (!attendanceId) {
      return res.status(422).json({ message: "A valid attendance id is required." });
    }

    const row = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { employee: { select: { fullName: true } } },
    });

    if (!row) {
      return res.status(404).json({ message: "Attendance record not found." });
    }

    res.json({ data: serializeAttendance(row) });
  } catch (error) {
    next(error);
  }
}
