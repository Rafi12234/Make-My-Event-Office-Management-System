import jwt from "jsonwebtoken";

import { prisma } from "../utils/accountsShared.js";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dev-secret-change-me";

export async function requireAdmin(req, res, next) {
  const authorization =
    req.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Admin authentication required.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Session expired, please log in again.",
    });
  }

  if (String(payload.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({
      message: "Forbidden: Admin access only.",
    });
  }

  try {
    const admin = await prisma.employee.findFirst({
      where: {
        id: BigInt(payload.id),
        isActive: true,
        role: { name: "Admin" },
      },
      select: { id: true },
    });

    if (!admin) {
      return res.status(403).json({
        message: "Forbidden: Admin access only.",
      });
    }

    req.adminId = admin.id;
    return next();
  } catch (error) {
    return next(error);
  }
}
