import jwt from "jsonwebtoken";

import { prisma } from "../config/prisma.js";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dev-secret-change-me";

const SESSION_MAX_AGE_MS =
  8 * 60 * 60 * 1000;

export const ADMIN_SESSION_COOKIE =
  "mme_admin_session";

/**
 * Web Admin login cookie.
 */
export function setAdminCookie(
  res,
  admin,
) {
  const token = jwt.sign(
    {
      id: admin.id.toString(),
      role: "Admin",
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    },
  );

  res.cookie(
    ADMIN_SESSION_COOKIE,
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      maxAge:
        SESSION_MAX_AGE_MS,
    },
  );
}

/**
 * Admin authentication.
 *
 * Web Admin:
 * mme_admin_session cookie
 *
 * Mobile Admin:
 * Authorization: Bearer JWT
 */
export async function requireAdmin(
  req,
  res,
  next,
) {
  const authorization =
    req.headers.authorization || "";

  const bearerToken =
    authorization.startsWith(
      "Bearer ",
    )
      ? authorization
          .slice(7)
          .trim()
      : "";

  const token =
    req.cookies?.[
      ADMIN_SESSION_COOKIE
    ] || bearerToken;

  if (!token) {
    return res.status(401).json({
      message:
        "Admin authentication required.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(
      token,
      JWT_SECRET,
    );
  } catch {
    return res.status(401).json({
      message:
        "Session expired, please log in again.",
    });
  }

  try {
    const admin =
      await prisma.employee.findFirst({
        where: {
          id: BigInt(payload.id),

          isActive: true,

          role: {
            name: "Admin",
          },
        },

        select: {
          id: true,
        },
      });

    if (!admin) {
      return res.status(403).json({
        message:
          "Forbidden: Admin access only.",
      });
    }

    req.adminId =
      admin.id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Existing Web Admin session check.
 */
export function isValidAdminSession(
  req,
) {
  const token =
    req.cookies?.[
      ADMIN_SESSION_COOKIE
    ];

  if (!token) {
    return false;
  }

  try {
    const payload =
      jwt.verify(
        token,
        JWT_SECRET,
      );

    return (
      payload?.id &&
      String(
        payload?.role || "",
      ).toLowerCase() ===
        "admin"
    );
  } catch {
    return false;
  }
}