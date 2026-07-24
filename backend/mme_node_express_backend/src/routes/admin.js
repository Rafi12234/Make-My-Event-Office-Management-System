import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = Router();
router.use(requireAdmin); // every route below requires admin auth

// ─── GET /api/admin/employees ────────────────────────────────────────────────
// Returns all employees with role + created-by info.
router.get("/employees", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT e.id,
              e.full_name      AS fullName,
              e.email,
              e.is_active      AS isActive,
              r.name           AS role,
              e.created_at     AS createdAt,
              c.full_name      AS createdByName
       FROM employees e
       LEFT JOIN roles     r ON r.id = e.role_id
       LEFT JOIN employees c ON c.id = e.created_by
       ORDER BY e.created_at DESC`,
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/employees ───────────────────────────────────────────────
// Create a new employee. Admin accounts require a password.
router.post("/employees", async (req, res, next) => {
  const fullName = String(req.body.fullName || "").trim();
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const role     = req.body.role === "Admin" ? "Admin" : "Employee";
  const password = String(req.body.password || "").trim();

  if (!fullName) return res.status(422).json({ message: "Full name is required." });
  if (!email)    return res.status(422).json({ message: "Email is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ message: "Enter a valid email address." });
  }
  if (!password) {
    return res.status(422).json({ message: "Password is required for all accounts." });
  }
  if (password.length < 6) {
    return res.status(422).json({ message: "Password must be at least 6 characters." });
  }

  try {
    const [[roleRow]] = await pool.execute(
      `SELECT id FROM roles WHERE name = ? LIMIT 1`, [role],
    );
    if (!roleRow) return res.status(500).json({ message: "Role not found in database." });

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    await pool.execute(
      `INSERT INTO employees (full_name, email, role_id, password_hash, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [fullName, email, roleRow.id, passwordHash, req.adminId],
    );

    const [[created]] = await pool.execute(
      `SELECT e.id, e.full_name AS fullName, e.email,
              e.is_active AS isActive, r.name AS role
       FROM employees e
       LEFT JOIN roles r ON r.id = e.role_id
       WHERE e.email = ? LIMIT 1`,
      [email],
    );

    res.status(201).json({ data: created });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "An employee with this email already exists." });
    }
    next(error);
  }
});

// ─── PATCH /api/admin/employees/:id ─────────────────────────────────────────
// Toggle is_active on an employee. Admin cannot deactivate themselves.
router.patch("/employees/:id", async (req, res, next) => {
  const targetId = Number(req.params.id);

  if (targetId === req.adminId) {
    return res.status(400).json({ message: "You cannot deactivate your own account." });
  }

  const isActive = Boolean(req.body.isActive);

  try {
    await pool.execute(
      `UPDATE employees
       SET is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [isActive, targetId],
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
