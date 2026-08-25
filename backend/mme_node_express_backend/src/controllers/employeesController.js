import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { setEmployeeCookie, SESSION_COOKIE } from "../middleware/employeeAuth.js";
import { isValidAdminSession } from "../middleware/adminAuth.js";
import { nowInBusinessTimezone } from "../utils/dbDates.js";

const PASSWORD_MIN_LENGTH = 6;

export async function listEmployeeDirectory(req, res, next) {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true, NOT: { role: { name: "Admin" } } },
      select: { id: true, fullName: true, email: true, lastUsedAt: true },
      orderBy: { fullName: "asc" },
    });
    res.json({ data: employees });
  } catch (error) {
    next(error);
  }
}

export async function identifyEmployee(req, res, next) {
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required." });
  }

  // An active Admin Panel session must be logged out of first — an account
  // can never be signed in as both an admin and an employee at once.
  if (isValidAdminSession(req)) {
    return res.status(409).json({
      message: "You're already logged in on the Admin Panel. Log out from there first.",
    });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!employee) {
      return res.status(401).json({ message: "No account found with this email. Contact your admin." });
    }
    if (!employee.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Contact your admin." });
    }
    if (employee.role?.name === "Admin") {
      return res.status(403).json({ message: "Admin accounts must log in through the Admin Panel, not the Employee Portal." });
    }
    if (!employee.passwordHash) {
      return res.status(401).json({ message: "Password not set for this account. Contact your admin." });
    }

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastUsedAt: new Date() },
    });

    setEmployeeCookie(res, { id: employee.id, role: employee.role || "Employee" });

    res.json({
      data: {
        id:                 employee.id,
        fullName:           employee.fullName,
        email:              employee.email,
        role:               employee.role?.name || "Employee",
        mustChangePassword: employee.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/employees/me
 * Returns the currently logged-in employee based on the session cookie.
 * Used by the server-side session (no more sessionStorage-only gating).
 */
export async function getCurrentEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: BigInt(req.employee.id), isActive: true },
      select: { id: true, fullName: true, email: true, mustChangePassword: true },
    });

    if (!employee) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    res.json({ data: { ...employee, role: req.employee.role } });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/employees/change-password
 * Lets a logged-in employee replace their (often admin-set) password.
 * Clears must_change_password so the mandatory pop-up stops appearing.
 */
export async function changePassword(req, res, next) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword     = String(req.body.newPassword     || "");

  if (!currentPassword || !newPassword) {
    return res.status(422).json({ message: "Current and new password are required." });
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return res.status(422).json({ message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  if (newPassword === currentPassword) {
    return res.status(422).json({ message: "New password must be different from the current password." });
  }

  try {
    const employee = await prisma.employee.findFirst({
      where: { id: BigInt(req.employee.id), isActive: true },
      include: { role: true },
    });

    if (!employee) {
      return res.status(401).json({ message: "Not authenticated." });
    }
    if (!employee.passwordHash) {
      return res.status(401).json({ message: "Password not set for this account. Contact your admin." });
    }

    const valid = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, mustChangePassword: false },
    });

    res.json({
      data: {
        id:                 employee.id,
        fullName:           employee.fullName,
        email:              employee.email,
        role:               employee.role?.name || "Employee",
        mustChangePassword: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/employees/logout
 * Clears the session cookie server-side.
 */
export function logoutEmployee(req, res) {
  res.clearCookie(SESSION_COOKIE);
  res.json({ data: { success: true } });
}

/**
 * GET /api/employees/me/today-summary
 * Powers the Management page header widget: how many meetings/calls this
 * employee is due to hold today (their own next-schedule assignments dated
 * today) vs. how many they've already completed today. "Completed" mirrors
 * the same signal used across the admin activity pages — a meeting counts
 * once it has items, a call once it has discussion text on record.
 */
export async function getTodaySummary(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const now = nowInBusinessTimezone();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [dueMeetings, dueCalls, meetingsToday, callsToday] = await Promise.all([
      prisma.clientNextMeeting.count({
        where: { assignedEmployeeId: employeeId, nextMeetingDatetime: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.clientNextCall.count({
        where: { assignedEmployeeId: employeeId, nextCallDatetime: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.clientMeeting.findMany({
        where: { createdById: employeeId, meetingDatetime: { gte: todayStart, lte: todayEnd } },
        select: { discussionNotes: true, _count: { select: { items: true } } },
      }),
      prisma.clientCall.findMany({
        where: { createdById: employeeId, callDatetime: { gte: todayStart, lte: todayEnd } },
        select: { callDiscussion: true },
      }),
    ]);

    const completedMeetings = meetingsToday.filter(
      (meeting) => Boolean(meeting.discussionNotes?.trim()) || meeting._count.items > 0,
    ).length;
    const completedCalls = callsToday.filter((call) => Boolean(call.callDiscussion?.trim())).length;

    res.json({
      data: {
        dueToday: dueMeetings + dueCalls,
        completedToday: completedMeetings + completedCalls,
        dueMeetings,
        dueCalls,
        completedMeetings,
        completedCalls,
      },
    });
  } catch (error) {
    next(error);
  }
}
