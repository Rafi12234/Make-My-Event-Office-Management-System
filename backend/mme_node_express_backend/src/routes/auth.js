import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const router = Router();

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 * Returns admin employee data on success.
 */
router.post("/admin-login", async (req, res, next) => {
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT e.id, e.full_name, e.email, e.password_hash, r.name AS role
       FROM employees e
       JOIN roles r ON r.id = e.role_id
       WHERE e.email = ? AND e.is_active = TRUE
       LIMIT 1`,
      [email],
    );

    const employee = rows[0];

    if (!employee || employee.role !== "Admin") {
      return res.status(401).json({ message: "Invalid credentials or insufficient access." });
    }

    if (!employee.password_hash) {
      return res.status(401).json({
        message: "Admin password not set. Run the password setup command from the README.",
      });
    }

    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    res.json({
      data: {
        id:       employee.id,
        fullName: employee.full_name,
        email:    employee.email,
        role:     employee.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
