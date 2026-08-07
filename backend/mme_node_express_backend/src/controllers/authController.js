import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { setAdminCookie } from "../middleware/adminAuth.js";
import { isValidSession } from "../middleware/employeeAuth.js";

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 * Returns admin employee data on success.
 */
export async function adminLogin(req, res, next) {
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required." });
  }

  // An active Employee Portal session must be logged out of first — an
  // account can never be signed in as both an employee and an admin at once.
  if (isValidSession(req)) {
    return res.status(409).json({
      message: "You're already logged in on the Employee Portal. Log out from there first.",
    });
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

    setAdminCookie(res, { id: employee.id });

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
}
