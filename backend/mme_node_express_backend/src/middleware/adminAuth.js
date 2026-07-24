import { pool } from "../config/db.js";

/**
 * Express middleware — verifies that the request comes from an active Admin.
 * The client must send:  x-admin-id: <employee id>
 */
export async function requireAdmin(req, res, next) {
  const adminId = Number(req.headers["x-admin-id"]);

  if (!adminId || Number.isNaN(adminId)) {
    return res.status(401).json({ message: "Admin authentication required." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT e.id
       FROM employees e
       JOIN roles r ON r.id = e.role_id
       WHERE e.id = ? AND r.name = 'Admin' AND e.is_active = TRUE
       LIMIT 1`,
      [adminId],
    );

    if (!rows.length) {
      return res.status(403).json({ message: "Forbidden: Admin access only." });
    }

    req.adminId = adminId;
    next();
  } catch (error) {
    next(error);
  }
}
