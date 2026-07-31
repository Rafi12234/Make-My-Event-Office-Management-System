import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

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
    const employee = await prisma.employee.findFirst({
      where: { email, isActive: true },
      include: { role: true },
    });

    if (!employee || employee.role?.name !== "Admin") {
      return res.status(401).json({ message: "Invalid credentials or insufficient access." });
    }

    if (!employee.passwordHash) {
      return res.status(401).json({
        message: "Admin password not set. Run the password setup command from the README.",
      });
    }

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    res.json({
      data: {
        id:       employee.id,
        fullName: employee.fullName,
        email:    employee.email,
        role:     employee.role.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
