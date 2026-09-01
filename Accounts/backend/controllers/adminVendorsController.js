import {
  prisma,
  formatDateOnly,
  formatDateTime,
  roundMoney,
  applyVendorDeltas,
  writeAuditLog,
  parseOptionalDate,
  parseOptionalBigInt,
  requireReason,
  resolveSettlementTarget,
  listVendorOutstandingBills,
  serializeAdminVendor,
  serializeAuditLog,
  computeVendorStillOwed,
  ACTIVE_ONLY,
} from "../utils/accountsShared.js";

/*
|--------------------------------------------------------------------------
| Admin Vendors controller
|--------------------------------------------------------------------------
|
| Reuses the same vendors / vendor_balances / account_expense_items tables
| the employee module already reads — Admin controls are layered on top
| rather than being a parallel vendor system.
|
| A vendor with financial history is never hard-deleted; isActive is the
| only lifecycle control, and deactivating simply hides it from new
| employee expense forms while history stays intact.
*/

// ─── GET /api/admin/accounts/vendors ───────────────────────────

export async function listVendors(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const vendors = await prisma.vendor.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { balance: true },
      orderBy: { name: "asc" },
    });

    const [lastTransactions, debtItems] = await Promise.all([
      prisma.accountExpenseItem.groupBy({
        by: ["vendorId"],
        where: { vendorId: { not: null }, expense: ACTIVE_ONLY },
        _max: { costDate: true },
      }),
      prisma.accountExpenseItem.findMany({
        where: { vendorId: { not: null }, expense: ACTIVE_ONLY },
        select: {
          id: true,
          vendorId: true,
          paymentStatus: true,
          totalAmount: true,
          settlesItemId: true,
        },
      }),
    ]);
    const lastBy = new Map(
      lastTransactions.map((row) => [String(row.vendorId), row._max.costDate]),
    );
    const stillOwedBy = computeVendorStillOwed(
      debtItems.map((item) => ({
        id: item.id,
        vendorId: item.vendorId,
        paymentStatus: item.paymentStatus,
        totalAmount: item.totalAmount,
        settlesItemId: item.settlesItemId,
      })),
    );

    res.json({
      data: vendors.map((vendor) => {
        const owed = roundMoney(stillOwedBy.get(String(vendor.id)) || 0);
        return {
          ...serializeAdminVendor(vendor),
          amountPayable: owed,
          advancePaid: 0,
          lastTransactionDate: formatDateOnly(lastBy.get(String(vendor.id))),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/vendors ──────────────────────────

export async function createVendor(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(422).json({ message: "Vendor name is required." });

    const adminId = BigInt(req.adminId);
    const duplicate = await prisma.vendor.findFirst({ where: { name } });
    if (duplicate) return res.status(409).json({ message: "A vendor with this name already exists." });

    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          name: name.slice(0, 190),
          category: String(req.body.category || "").trim().slice(0, 100) || null,
          contactName: String(req.body.contactName || "").trim().slice(0, 190) || null,
          contactPhone: String(req.body.contactPhone || "").trim().slice(0, 50) || null,
          contactEmail: String(req.body.contactEmail || "").trim().slice(0, 190) || null,
          notes: String(req.body.notes || "").trim().slice(0, 500) || null,
          balance: { create: { currentBalance: 0 } },
        },
        include: { balance: true },
      });

      await writeAuditLog(tx, {
        entityType: "vendor",
        entityId: created.id,
        action: "create",
        adminId,
        vendorId: created.id,
        reason: `Vendor "${created.name}" created.`,
        afterData: created,
      });

      return created;
    });

    res.status(201).json({ data: serializeAdminVendor(vendor) });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/accounts/vendors/:id ─────────────────────

export async function updateVendor(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid vendor id." });

    const existing = await prisma.vendor.findUnique({ where: { id }, include: { balance: true } });
    if (!existing) return res.status(404).json({ message: "Vendor not found." });

    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(422).json({ message: "Vendor name is required." });
      data.name = name.slice(0, 190);
    }
    for (const [field, limit] of [
      ["category", 100],
      ["contactName", 190],
      ["contactPhone", 50],
      ["contactEmail", 190],
      ["notes", 500],
    ]) {
      if (req.body[field] !== undefined) {
        data[field] = String(req.body[field] || "").trim().slice(0, limit) || null;
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(422).json({ message: "Nothing to update." });
    }

    const adminId = BigInt(req.adminId);
    const vendor = await prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({ where: { id }, data, include: { balance: true } });

      await writeAuditLog(tx, {
        entityType: "vendor",
        entityId: id,
        action: "update",
        adminId,
        vendorId: id,
        reason: requireReason(req.body) || `Vendor "${updated.name}" details updated.`,
        beforeData: existing,
        afterData: updated,
      });

      return updated;
    });

    res.json({ data: serializeAdminVendor(vendor) });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/accounts/vendors/:id/status ──────────────

export async function setVendorStatus(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid vendor id." });

    const isActive = Boolean(req.body.isActive);
    const existing = await prisma.vendor.findUnique({ where: { id }, include: { balance: true } });
    if (!existing) return res.status(404).json({ message: "Vendor not found." });

    const adminId = BigInt(req.adminId);
    const vendor = await prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({
        where: { id },
        data: { isActive },
        include: { balance: true },
      });

      await writeAuditLog(tx, {
        entityType: "vendor",
        entityId: id,
        action: "update",
        adminId,
        vendorId: id,
        reason:
          requireReason(req.body) ||
          `Vendor "${updated.name}" ${isActive ? "reactivated" : "deactivated"}.`,
        beforeData: existing,
        afterData: updated,
      });

      return updated;
    });

    res.json({ data: serializeAdminVendor(vendor) });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/vendors/:id ───────────────────────

export async function getVendorProfile(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid vendor id." });

    const vendor = await prisma.vendor.findUnique({ where: { id }, include: { balance: true } });
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });

    const [items, auditLogs] = await Promise.all([
      prisma.accountExpenseItem.findMany({
        where: { vendorId: id },
        include: {
          expense: {
            select: {
              id: true,
              costType: true,
              status: true,
              paymentSource: true,
              linkedRowKey: true,
              eventClientNameSnapshot: true,
              eventDateSnapshot: true,
              employee: { select: { id: true, fullName: true } },
              createdByAdmin: { select: { fullName: true } },
            },
          },
        },
        orderBy: { id: "desc" },
      }),
      prisma.accountAuditLog.findMany({
        where: { vendorId: id },
        include: { admin: { select: { fullName: true } } },
        orderBy: { id: "desc" },
        take: 50,
      }),
    ]);

    const activeItems = items.filter((item) => item.expense?.status === "active");
    const totalBilled = roundMoney(
      activeItems.reduce((sum, item) => sum + Number(item.totalAmount), 0),
    );
    const totalPaid = roundMoney(
      activeItems
        .filter((item) => item.paymentStatus === "paid")
        .reduce((sum, item) => sum + Number(item.totalAmount), 0),
    );
    // A "paid" item only settles the specific bill it targets via
    // settlesItemId — sharing the same vendor/event is not enough.
    const stillOwed = roundMoney(
      computeVendorStillOwed(
        activeItems.map((item) => ({
          id: item.id,
          vendorId: id,
          paymentStatus: item.paymentStatus,
          totalAmount: item.totalAmount,
          settlesItemId: item.settlesItemId,
        })),
      ).get(String(id)) || 0,
    );

    res.json({
      data: {
        vendor: serializeAdminVendor(vendor),
        currentBalance: -stillOwed,
        totalBilled,
        totalPaid,
        stillToPay: stillOwed,
        advancePaid: 0,
        transactions: items.map((item) => ({
          id: String(item.id),
          expenseId: String(item.expenseId),
          purpose: item.purpose,
          costDate: formatDateOnly(item.costDate),
          quantity: Number(item.quantity),
          perQtyAmount: Number(item.perQtyAmount),
          amount: Number(item.totalAmount),
          // A new bill is a cost; settling an existing bill is a payment.
          // They are never double-counted as two separate expenses.
          entryKind: item.paymentStatus === "paid" ? "payment" : "cost",
          paymentStatus: item.paymentStatus,
          settlesItemId: item.settlesItemId ? String(item.settlesItemId) : null,
          paymentSource: item.expense?.paymentSource || "employee_wallet",
          costType: item.expense?.costType || null,
          eventClientName: item.expense?.eventClientNameSnapshot || null,
          eventDate: formatDateOnly(item.expense?.eventDateSnapshot),
          employeeId: item.expense?.employee?.id ? String(item.expense.employee.id) : null,
          employeeName: item.expense?.employee?.fullName || null,
          createdByAdminName: item.expense?.createdByAdmin?.fullName || null,
          expenseStatus: item.expense?.status || "active",
          createdAt: formatDateTime(item.createdAt),
          updatedAt: formatDateTime(item.updatedAt),
        })),
        auditLogs: auditLogs.map(serializeAuditLog),
      },
    });
  } catch (error) {
    next(error);
  }
}

/*
| Admin direct vendor transactions.
|
| Both are stored as ordinary account_expenses rows with employeeId = null
| and paymentSource = "company", so they appear in the vendor ledger and
| all vendor reporting without ever touching an employee wallet.
*/

async function createCompanyVendorEntry({ req, res, paymentStatus, defaultPurpose }) {
  const vendorId = parseOptionalBigInt(req.params.id);
  if (!vendorId) return res.status(422).json({ message: "Invalid vendor id." });

  const amount = roundMoney(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(422).json({ message: "Enter an amount greater than zero." });
  }

  const costDate = parseOptionalDate(req.body.costDate) || new Date();
  const purpose = String(req.body.purpose || "").trim().slice(0, 190) || defaultPurpose;
  const adminId = BigInt(req.adminId);

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) return res.status(404).json({ message: "Vendor not found." });

  let settlesItemId = null;
  if (paymentStatus === "paid" && req.body.settlesItemId) {
    const settlement = await resolveSettlementTarget(vendorId, req.body.settlesItemId);
    if (settlement.error) return res.status(422).json({ message: settlement.error });
    settlesItemId = settlement.settlesItemId;
  }

  // "paid" settles the ledger upward, "to_pay" records a new liability —
  // identical convention to an employee-submitted vendor item.
  const vendorDelta = paymentStatus === "paid" ? amount : -amount;

  const created = await prisma.$transaction(async (tx) => {
    const expense = await tx.accountExpense.create({
      data: {
        employeeId: null,
        costType: "regular",
        totalAmount: amount,
        walletDeductionAmount: 0,
        paymentSource: "company",
        createdByAdminId: adminId,
        items: {
          create: [
            {
              purpose,
              costDate,
              quantity: 1,
              perQtyAmount: amount,
              totalAmount: amount,
              vendorId,
              paymentStatus,
              settlesItemId,
            },
          ],
        },
      },
      include: { items: true },
    });

    await applyVendorDeltas(tx, new Map([[String(vendorId), vendorDelta]]));

    await writeAuditLog(tx, {
      entityType: "expense",
      entityId: expense.id,
      action: "create",
      adminId,
      vendorId,
      reason: String(req.body.reason || "").trim().slice(0, 500) || purpose,
      afterData: expense,
    });

    return expense;
  });

  return res.status(201).json({
    data: {
      expenseId: String(created.id),
      vendorId: String(vendorId),
      amount,
      paymentStatus,
      paymentSource: "company",
      costDate: formatDateOnly(costDate),
      purpose,
    },
  });
}

// ─── POST /api/admin/accounts/vendors/:id/cost ─────────────────

export async function createDirectVendorCost(req, res, next) {
  try {
    const paymentStatus = req.body.paymentStatus === "paid" ? "paid" : "to_pay";
    await createCompanyVendorEntry({
      req,
      res,
      paymentStatus,
      defaultPurpose: "Company vendor cost",
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/vendors/:id/pay ──────────────────

export async function createDirectVendorPayment(req, res, next) {
  try {
    await createCompanyVendorEntry({
      req,
      res,
      paymentStatus: "paid",
      defaultPurpose: "Company vendor payment",
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/vendors/:id/outstanding ────────────

export async function getVendorOutstandingItems(req, res, next) {
  try {
    const vendorId = parseOptionalBigInt(req.params.id);
    if (!vendorId) return res.status(422).json({ message: "Invalid vendor id." });
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) return res.status(404).json({ message: "Vendor not found." });
    res.json({ data: await listVendorOutstandingBills(vendorId) });
  } catch (error) {
    next(error);
  }
}
