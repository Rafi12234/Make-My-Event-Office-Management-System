import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import {
  setEmployeeCookie,
  requireEmployee,
  SESSION_COOKIE,
} from "../middleware/employeeAuth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email, last_used_at AS lastUsedAt
       FROM employees
       WHERE is_active = TRUE
       ORDER BY full_name ASC`,
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/identify", async (req, res, next) => {
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT e.id, e.full_name, e.email, e.password_hash, e.is_active, r.name AS role
       FROM employees e
       LEFT JOIN roles r ON r.id = e.role_id
       WHERE e.email = ? LIMIT 1`,
      [email],
    );

    const employee = rows[0];

    if (!employee) {
      return res.status(401).json({ message: "No account found with this email. Contact your admin." });
    }
    if (!employee.is_active) {
      return res.status(403).json({ message: "Your account has been deactivated. Contact your admin." });
    }
    if (!employee.password_hash) {
      return res.status(401).json({ message: "Password not set for this account. Contact your admin." });
    }

    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    await pool.execute(
      `UPDATE employees SET last_used_at = NOW() WHERE id = ?`,
      [employee.id],
    );

    setEmployeeCookie(res, { id: employee.id, role: employee.role || "Employee" });

    res.json({
      data: {
        id:       employee.id,
        fullName: employee.full_name,
        email:    employee.email,
        role:     employee.role || "Employee",
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employees/me
 * Returns the currently logged-in employee based on the session cookie.
 * Used by the server-side session (no more sessionStorage-only gating).
 */
router.get("/me", requireEmployee, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email
       FROM employees
       WHERE id = ? AND is_active = TRUE
       LIMIT 1`,
      [req.employee.id],
    );

    const employee = rows[0];
    if (!employee) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    res.json({ data: { ...employee, role: req.employee.role } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees/logout
 * Clears the session cookie server-side.
 */
router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ data: { success: true } });
});

export default router;
