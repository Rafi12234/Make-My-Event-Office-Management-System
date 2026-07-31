import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import {
  setEmployeeCookie,
  requireEmployee,
  SESSION_COOKIE,
} from "../middleware/employeeAuth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true, lastUsedAt: true },
      orderBy: { fullName: "asc" },
    });
    res.json({ data: employees });
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
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!employee) {
      return res.status(401).json({ message: "No account found with this email. Contact your admin." });
    }
    if (!employee.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Contact your admin." });
    }
    if (!employee.passwordHash) {
      return res.status(401).json({ message: "Password not set for this account. Contact your admin." });
    }

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastUsedAt: new Date() },
    });

    setEmployeeCookie(res, { id: employee.id, role: employee.role || "Employee" });

    res.json({
      data: {
        id:       employee.id,
        fullName: employee.fullName,
        email:    employee.email,
        role:     employee.role?.name || "Employee",
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
    const employee = await prisma.employee.findFirst({
      where: { id: BigInt(req.employee.id), isActive: true },
      select: { id: true, fullName: true, email: true },
    });

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
