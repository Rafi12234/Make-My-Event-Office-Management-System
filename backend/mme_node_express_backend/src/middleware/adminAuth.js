import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export const ADMIN_SESSION_COOKIE = "mme_admin_session";

/**
 * Signs a short-lived JWT for an admin and sets it as an httpOnly cookie.
 * Called on successful login (see routes/auth.js `/admin-login`).
 */
export function setAdminCookie(res, admin) {
  const token = jwt.sign(
    { id: admin.id, role: "Admin" },
    JWT_SECRET,
    { expiresIn: "8h" },
  );

  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

/**
 * Express middleware — verifies the signed admin session cookie, then
 * re-checks the account is still an active Admin (covers deactivation
 * happening after the token was issued).
 */
export async function requireAdmin(req, res, next) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Admin authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again." });
  }

  try {
    const admin = await prisma.employee.findFirst({
      where: { id: payload.id, isActive: true, role: { name: "Admin" } },
      select: { id: true },
    });

    if (!admin) {
      return res.status(403).json({ message: "Forbidden: Admin access only." });
    }

    req.adminId = admin.id;
    next();
  } catch (error) {
    next(error);
  }
}
 
/**
 * Non-throwing session check used by the SPA page-fallback gate in
 * server.js — decides whether to redirect a direct /admin request to
 * /login before the React app is even served.
 */
export function isValidAdminSession(req) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) return false;

  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
