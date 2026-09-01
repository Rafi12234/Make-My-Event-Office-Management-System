import { SESSION_COOKIE } from "./employeeAuth.js";

/**
 * Additive shim for mobile support — does NOT modify requireEmployee at all.
 * If a request carries `Authorization: Bearer <token>` and no session
 * cookie, copies the token into req.cookies under the same key requireEmployee
 * already reads, so the existing (untouched) cookie-only check picks it up.
 * Web requests are unaffected since they already send the cookie.
 */
export function attachBearerToken(req, res, next) {
  if (!req.cookies?.[SESSION_COOKIE]) {
    const header = req.headers.authorization || "";
    if (header.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      if (token) {
        req.cookies = { ...req.cookies, [SESSION_COOKIE]: token };
      }
    }
  }
  next();
}
