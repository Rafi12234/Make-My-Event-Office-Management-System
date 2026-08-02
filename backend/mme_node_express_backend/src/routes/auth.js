import { Router } from "express";
import { prisma } from "../config/prisma.js";
import {
  requireAdmin,
  ADMIN_SESSION_COOKIE,
} from "../middleware/adminAuth.js";
import { adminLogin } from "../controllers/authController.js";

const router = Router();

router.post("/admin-login", adminLogin);

/**
 * GET /api/auth/admin-me
 * Returns the currently logged-in admin based on the session cookie.
 * Used to restore the admin UI session on page load/refresh.
 */
router.get("/admin-me", requireAdmin, async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.adminId },
      include: { role: true },
    });

    if (!employee) {
      return res.status(401).json({ message: "Not authenticated." });
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

/**
 * POST /api/auth/admin-logout
 * Clears the admin session cookie server-side.
 */
router.post("/admin-logout", (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE);
  res.json({ data: { success: true } });
});

export default router;
