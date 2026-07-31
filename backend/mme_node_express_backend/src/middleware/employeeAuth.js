import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export const SESSION_COOKIE = "mme_session";

/**
 * Signs a short-lived JWT for an employee and sets it as an httpOnly cookie.
 * Called on successful login (see routes/employees.js `/identify`).
 */
export function setEmployeeCookie(res, employee) {
  const token = jwt.sign(
    { id: employee.id, role: employee.role || "Employee" },
    JWT_SECRET,
    { expiresIn: "8h" },
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
 * request has no valid session cookie.
 */
export function requireEmployee(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Login required." });
  }

  try {
    req.employee = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again." });
  }
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
