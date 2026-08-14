import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
// Effectively unlimited for now (~100 years) — swap back to a real duration
// (e.g. 8 * 60 * 60 * 1000 for 8 hours) whenever session expiry is wanted
// again. Drives both the JWT's own expiry and the cookie's maxAge below, so
// they can never drift out of sync with each other.
const SESSION_MAX_AGE_MS = 100 * 365 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "mme_session";

/**
 * Signs a short-lived JWT for an employee and sets it as an httpOnly cookie.
 * Called on successful login (see routes/employees.js `/identify`).
 */
export function setEmployeeCookie(res, employee) {
  const token = jwt.sign(
    { id: employee.id, role: employee.role || "Employee" },
    JWT_SECRET,
    { expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000) },
  );

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

/**
 * Express middleware — protects API routes. Responds 401 JSON if the
 * request has no valid session cookie, or if the session's employee was
 * deleted/deactivated after the (effectively non-expiring) JWT was issued —
 * otherwise a stale session keeps sending a now-nonexistent employeeId into
 * create/update calls and crashes them with a raw FK constraint error.
 */
export async function requireEmployee(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Login required." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again." });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: BigInt(decoded.id) },
      select: { id: true, isActive: true },
    });
    if (!employee || employee.isActive === false) {
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).json({ message: "Your account is no longer available. Please log in again." });
    }
  } catch (error) {
    return next(error);
  }

  req.employee = decoded;
  next();
}

/**
 * Non-throwing session check used by the SPA page-fallback gate in
 * server.js — decides whether to redirect a direct page request to /login
 * before the React app is even served.
 */
export function isValidSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return false;

  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
