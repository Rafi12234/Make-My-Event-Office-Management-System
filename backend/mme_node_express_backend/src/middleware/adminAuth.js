import { prisma } from "../config/prisma.js";

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
    const admin = await prisma.employee.findFirst({
      where: { id: adminId, isActive: true, role: { name: "Admin" } },
      select: { id: true },
    });

    if (!admin) {
      return res.status(403).json({ message: "Forbidden: Admin access only." });
    }

    req.adminId = adminId;
    next();
  } catch (error) {
    next(error);
  }
}
