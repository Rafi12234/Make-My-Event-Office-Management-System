import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

// ─── GET /api/admin/employees ────────────────────────────────────────────────
// Returns all employees with role + created-by info.
export async function listEmployees(req, res, next) {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        role: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      data: employees.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        isActive: employee.isActive,
        role: employee.role?.name || null,
        createdAt: employee.createdAt,
        createdByName: employee.createdBy?.fullName || null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/employees ───────────────────────────────────────────────
// Create a new employee. Admin accounts require a password.
export async function createEmployee(req, res, next) {
  const fullName = String(req.body.fullName || "").trim();
  const email    = String(req.body.email    || "").trim().toLowerCase();
  const role     = req.body.role === "Admin" ? "Admin" : "Employee";
  const password = String(req.body.password || "").trim();

  if (!fullName) return res.status(422).json({ message: "Full name is required." });
  if (!email)    return res.status(422).json({ message: "Email is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ message: "Enter a valid email address." });
  }
  if (!password) {
    return res.status(422).json({ message: "Password is required for all accounts." });
  }
  if (password.length < 6) {
    return res.status(422).json({ message: "Password must be at least 6 characters." });
  }

  try {
    const roleRow = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRow) return res.status(500).json({ message: "Role not found in database." });

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const created = await prisma.employee.create({
      data: {
        fullName,
        email,
        roleId: roleRow.id,
        passwordHash,
        createdById: req.adminId,
        isActive: true,
        mustChangePassword: true, // admin-set password must be changed on first login
      },
      include: { role: true },
    });

    res.status(201).json({
      data: {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        isActive: created.isActive,
        role: created.role?.name || null,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "An employee with this email already exists." });
    }
    next(error);
  }
}

// ─── PATCH /api/admin/employees/:id ─────────────────────────────────────────
// Toggle is_active on an employee. Admin cannot deactivate themselves.
export async function updateEmployeeStatus(req, res, next) {
  const targetId = Number(req.params.id);

  if (targetId === req.adminId) {
    return res.status(400).json({ message: "You cannot deactivate your own account." });
  }

  const isActive = Boolean(req.body.isActive);

  try {
    await prisma.employee.update({
      where: { id: targetId },
      data: { isActive },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/employees/:id/password ────────────────────────────────
// Admin sets a new password for an employee; they must change it on next login.
export async function resetEmployeePassword(req, res, next) {
  const targetId = Number(req.params.id);
  const password = String(req.body.password || "").trim();

  if (!password) return res.status(422).json({ message: "Password is required." });
  if (password.length < 6) {
    return res.status(422).json({ message: "Password must be at least 6 characters." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.employee.update({
      where: { id: targetId },
      data: { passwordHash, mustChangePassword: true },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
