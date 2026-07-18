import { Router } from "express";
import { pool } from "../config/db.js";

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
  try {
    const fullName = String(req.body.fullName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!fullName || !email) {
      return res.status(422).json({ message: "Employee name and email are required." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ message: "Enter a valid employee email." });
    }

    await pool.execute(
      `INSERT INTO employees (full_name, email, last_used_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         last_used_at = NOW(),
         updated_at = CURRENT_TIMESTAMP`,
      [fullName, email],
    );

    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email, last_used_at AS lastUsedAt
       FROM employees WHERE email = ? LIMIT 1`,
      [email],
    );

    res.status(200).json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
