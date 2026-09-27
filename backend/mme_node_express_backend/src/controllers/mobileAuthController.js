import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  prisma,
} from "../config/prisma.js";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dev-secret-change-me";

const MOBILE_ACCESS_TOKEN_EXPIRES_IN =
  process.env
    .MOBILE_ACCESS_TOKEN_EXPIRES_IN ||
  "12h";

export async function mobileLogin(
  req,
  res,
  next,
) {
  const email = String(
    req.body.email || "",
  )
    .trim()
    .toLowerCase();

  const password = String(
    req.body.password || "",
  );

  if (
    !email ||
    !password
  ) {
    return res
      .status(422)
      .json({
        message:
          "Email and password are required.",
      });
  }

  try {
    const employee =
      await prisma.employee
        .findUnique({
          where: {
            email,
          },

          include: {
            role: true,
          },
        });

    if (!employee) {
      return res
        .status(401)
        .json({
          message:
            "No account found with this email.",
        });
    }

    if (!employee.isActive) {
      return res
        .status(403)
        .json({
          message:
            "Your account has been deactivated.",
        });
    }

    if (
      !employee.passwordHash
    ) {
      return res
        .status(401)
        .json({
          message:
            "Password not set for this account.",
        });
    }

    const valid =
      await bcrypt.compare(
        password,
        employee.passwordHash,
      );

    if (!valid) {
      return res
        .status(401)
        .json({
          message:
            "Incorrect password.",
        });
    }

    /*
     * IMPORTANT:
     *
     * DO NOT block Admin here.
     *
     * Both Employee and Admin use
     * this mobile login endpoint.
     */

    const role =
      employee.role?.name ||
      "Employee";

    const employeeId =
      employee.id.toString();

    await prisma.employee.update({
      where: {
        id:
          employee.id,
      },

      data: {
        lastUsedAt:
          new Date(),
      },
    });

    const accessToken =
      jwt.sign(
        {
          id:
            employeeId,

          role,
        },
        JWT_SECRET,
        {
          expiresIn:
            MOBILE_ACCESS_TOKEN_EXPIRES_IN,
        },
      );

    return res.json({
      data: {
        accessToken,

        employee: {
          id:
            employeeId,

          fullName:
            employee.fullName,

          email:
            employee.email,

          role,

          mustChangePassword:
            employee.mustChangePassword,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}