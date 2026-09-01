import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

// Self-contained on purpose (duplicates the small credential-check block
// from employeesController.js's identifyEmployee) so the existing web login
// endpoint/file is never touched by mobile support.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MOBILE_ACCESS_TOKEN_EXPIRES_IN = process.env.MOBILE_ACCESS_TOKEN_EXPIRES_IN || "12h";

/**
 * POST /api/mobile/auth/login
 * Dedicated native-app login — returns a short-lived Bearer token instead of
 * setting the web's httpOnly session cookie (native apps have no cookie jar
 * to benefit from, and never want the token visible to browser JS anyway).
 */
export async function mobileLogin(req, res, next) {
  const email = String(req.body.email || "").trim().toLowerCase();
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
    if (employee.role?.name === "Admin") {
      return res.status(403).json({ message: "Admin accounts must log in through the Admin Panel, not the Employee Portal." });
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

    const role = employee.role?.name || "Employee";
    const accessToken = jwt.sign({ id: employee.id, role }, JWT_SECRET, {
      expiresIn: MOBILE_ACCESS_TOKEN_EXPIRES_IN,
    });

    res.json({
      data: {
        accessToken,
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          email: employee.email,
          role,
          mustChangePassword: employee.mustChangePassword,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
