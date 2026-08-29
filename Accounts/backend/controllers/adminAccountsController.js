import {
  prisma,
  formatDateOnly,
  formatDateTime,
  roundMoney,
  computeWalletDeduction,
  computeVendorDeltas,
  negateDeltas,
  applyWalletDelta,
  applyVendorDeltas,
  writeAuditLog,
  parsePagination,
  parseOptionalDate,
  parseOptionalBigInt,
  parseOptionalNumber,
  requireReason,
  serializeAdminExpense,
  serializeAdminMoneyIn,
  serializeAuditLog,
  ACTIVE_ONLY,
} from "../utils/accountsShared.js";

/*
|--------------------------------------------------------------------------
| Admin Accounts controller
|--------------------------------------------------------------------------
|
| Reads and corrects the SAME tables the employee Accounts module writes —
| there is no parallel admin ledger. Every figure is kept deliberately
| distinct (recorded cost vs. actually paid vs. still payable) rather than
| collapsed into one vague "total expense".
|
| Admin identity always comes from req.adminId (set by requireAdmin), never
| from anything the frontend sends.
*/

const EXPENSE_INCLUDE = {
  employee: { select: { fullName: true } },
  createdByAdmin: { select: { fullName: true } },
  voidedByAdmin: { select: { fullName: true } },
  items: { include: { vendor: { select: { name: true } } }, orderBy: { id: "asc" } },
};

const MONEY_IN_INCLUDE = {
  employee: { select: { fullName: true } },
  createdByAdmin: { select: { fullName: true } },
  voidedByAdmin: { select: { fullName: true } },
};

// ─── GET /api/admin/accounts/overview ──────────────────────────

export async function getOverview(req, res, next) {
  try {
    const [
      moneyInTotal,
      expenseTotals,
      wallets,
      vendorBalances,
      recentExpenses,
      recentMoneyIn,
      recentVendorItems,
    ] = await Promise.all([
      prisma.accountMoneyReceived.aggregate({
        where: ACTIVE_ONLY,
        _sum: { amount: true },
      }),
      prisma.accountExpense.aggregate({
        where: ACTIVE_ONLY,
        _sum: { totalAmount: true, walletDeductionAmount: true },
      }),
      prisma.accountWallet.findMany({
        include: { employee: { select: { fullName: true, isActive: true } } },
      }),
      prisma.vendorBalance.findMany({
        include: { vendor: { select: { name: true, isActive: true } } },
      }),
      prisma.accountExpense.findMany({
        where: ACTIVE_ONLY,
        include: EXPENSE_INCLUDE,
        orderBy: { id: "desc" },
        take: 8,
      }),
      prisma.accountMoneyReceived.findMany({
        where: ACTIVE_ONLY,
        include: MONEY_IN_INCLUDE,
        orderBy: { id: "desc" },
        take: 8,
      }),
      prisma.accountExpenseItem.findMany({
        where: { vendorId: { not: null }, expense: ACTIVE_ONLY },
        include: {
          vendor: { select: { name: true } },
          expense: { select: { employee: { select: { fullName: true } }, paymentSource: true } },
        },
        orderBy: { id: "desc" },
        take: 8,
      }),
    ]);

    const totalRecordedCost = Number(expenseTotals._sum.totalAmount || 0);
    const totalActuallyPaid = Number(expenseTotals._sum.walletDeductionAmount || 0);

    const negativeWallets = wallets
      .filter((wallet) => Number(wallet.currentBalance) < 0)
      .map((wallet) => ({
        employeeId: String(wallet.employeeId),
        employeeName: wallet.employee?.fullName || "Unknown",
        currentBalance: Number(wallet.currentBalance),
      }))
      .sort((a, b) => a.currentBalance - b.currentBalance);

    const vendorDues = vendorBalances
      .filter((balance) => Number(balance.currentBalance) < 0)
      .map((balance) => ({
        vendorId: String(balance.vendorId),
        vendorName: balance.vendor?.name || "Unknown",
        amountPayable: roundMoney(-Number(balance.currentBalance)),
      }))
      .sort((a, b) => b.amountPayable - a.amountPayable);

    res.json({
      data: {
        totalMoneyGivenToEmployees: roundMoney(Number(moneyInTotal._sum.amount || 0)),
        totalWalletBalance: roundMoney(
          wallets.reduce((sum, wallet) => sum + Number(wallet.currentBalance), 0),
        ),
        totalRecordedCost: roundMoney(totalRecordedCost),
        totalActuallyPaid: roundMoney(totalActuallyPaid),
        totalStillPayableToVendors: roundMoney(
          vendorDues.reduce((sum, vendor) => sum + vendor.amountPayable, 0),
        ),
        totalVendorBalance: roundMoney(
          vendorBalances.reduce((sum, balance) => sum + Number(balance.currentBalance), 0),
        ),
        negativeWalletCount: negativeWallets.length,
        negativeWallets: negativeWallets.slice(0, 10),
        vendorDues: vendorDues.slice(0, 10),
        recentExpenses: recentExpenses.map(serializeAdminExpense),
        recentMoneyIn: recentMoneyIn.map(serializeAdminMoneyIn),
        recentVendorActivity: recentVendorItems.map((item) => ({
          id: String(item.id),
          vendorId: item.vendorId ? String(item.vendorId) : null,
          vendorName: item.vendor?.name || null,
          purpose: item.purpose,
          amount: Number(item.totalAmount),
          paymentStatus: item.paymentStatus,
          paymentSource: item.expense?.paymentSource || "employee_wallet",
          employeeName: item.expense?.employee?.fullName || null,
          costDate: formatDateOnly(item.costDate),
          createdAt: formatDateTime(item.createdAt),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/employees ─────────────────────────
// Every employee appears, including those with no wallet activity (৳0).

export async function listEmployeeWallets(req, res, next) {
  try {
    const employees = await prisma.employee.findMany({
      where: { NOT: { role: { name: "Admin" } } },
      select: { id: true, fullName: true, email: true, isActive: true },
      orderBy: { fullName: "asc" },
    });

    const [wallets, moneyInGroups, expenseGroups] = await Promise.all([
      prisma.accountWallet.findMany(),
      prisma.accountMoneyReceived.groupBy({
        by: ["employeeId"],
        where: ACTIVE_ONLY,
        _sum: { amount: true },
      }),
      prisma.accountExpense.groupBy({
        by: ["employeeId"],
        where: ACTIVE_ONLY,
        _sum: { totalAmount: true, walletDeductionAmount: true },
      }),
    ]);

    const walletBy = new Map(wallets.map((w) => [String(w.employeeId), Number(w.currentBalance)]));
    const moneyInBy = new Map(
      moneyInGroups.map((g) => [String(g.employeeId), Number(g._sum.amount || 0)]),
    );
    const recordedBy = new Map(
      expenseGroups.map((g) => [String(g.employeeId), Number(g._sum.totalAmount || 0)]),
    );
    const paidBy = new Map(
      expenseGroups.map((g) => [String(g.employeeId), Number(g._sum.walletDeductionAmount || 0)]),
    );

    res.json({
      data: employees.map((employee) => {
        const key = String(employee.id);
        return {
          employeeId: key,
          fullName: employee.fullName,
          email: employee.email,
          isActive: employee.isActive,
          currentBalance: roundMoney(walletBy.get(key) || 0),
          totalMoneyIn: roundMoney(moneyInBy.get(key) || 0),
          totalRecordedCost: roundMoney(recordedBy.get(key) || 0),
          totalPaidExpenses: roundMoney(paidBy.get(key) || 0),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/employees/:id ─────────────────────

export async function getEmployeeAccountProfile(req, res, next) {
  try {
    const employeeId = parseOptionalBigInt(req.params.id);
    if (!employeeId) return res.status(422).json({ message: "Invalid employee id." });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true, email: true, isActive: true },
    });
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    const [wallet, moneyIn, expenses] = await Promise.all([
      prisma.accountWallet.findUnique({ where: { employeeId } }),
      prisma.accountMoneyReceived.findMany({
        where: { employeeId },
        include: MONEY_IN_INCLUDE,
        orderBy: { id: "desc" },
      }),
      prisma.accountExpense.findMany({
        where: { employeeId },
        include: EXPENSE_INCLUDE,
        orderBy: { id: "desc" },
      }),
    ]);

    const active = expenses.filter((expense) => expense.status === "active");
    const sumBy = (list, key) =>
      roundMoney(list.reduce((sum, expense) => sum + Number(expense[key]), 0));

    const vendorItems = active.flatMap((expense) =>
      expense.items
        .filter((item) => item.vendorId)
        .map((item) => ({
          id: String(item.id),
          expenseId: String(expense.id),
          vendorId: String(item.vendorId),
          vendorName: item.vendor?.name || null,
          purpose: item.purpose,
          amount: Number(item.totalAmount),
          paymentStatus: item.paymentStatus,
          costDate: formatDateOnly(item.costDate),
          createdAt: formatDateTime(item.createdAt),
        })),
    );

    res.json({
      data: {
        employee: {
          id: String(employee.id),
          fullName: employee.fullName,
          email: employee.email,
          isActive: employee.isActive,
        },
        currentBalance: wallet ? Number(wallet.currentBalance) : 0,
        totalMoneyIn: roundMoney(
          moneyIn
            .filter((entry) => entry.status === "active")
            .reduce((sum, entry) => sum + Number(entry.amount), 0),
        ),
        totalRecordedCost: sumBy(active, "totalAmount"),
        totalActuallyPaid: sumBy(active, "walletDeductionAmount"),
        eventCostTotal: sumBy(active.filter((e) => e.costType === "event"), "totalAmount"),
        regularCostTotal: sumBy(active.filter((e) => e.costType === "regular"), "totalAmount"),
        vendorItems,
        vendorPaymentsMade: vendorItems.filter((item) => item.paymentStatus === "paid"),
        moneyInHistory: moneyIn.map(serializeAdminMoneyIn),
        expenseHistory: expenses.map(serializeAdminExpense),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/money-in ──────────────────────────

export async function listMoneyIn(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = {};

    const employeeId = parseOptionalBigInt(req.query.employeeId);
    if (employeeId) where.employeeId = employeeId;
    if (req.query.source === "employee" || req.query.source === "admin") {
      where.source = req.query.source;
    }
    if (req.query.status === "active" || req.query.status === "void") {
      where.status = req.query.status;
    }

    const dateFrom = parseOptionalDate(req.query.dateFrom);
    const dateTo = parseOptionalDate(req.query.dateTo);
    if (dateFrom || dateTo) {
      where.receivedDate = {};
      if (dateFrom) where.receivedDate.gte = dateFrom;
      if (dateTo) where.receivedDate.lte = dateTo;
    }

    const search = String(req.query.search || "").trim();
    if (search) where.note = { contains: search };

    const orderBy = {
      newest: { id: "desc" },
      oldest: { id: "asc" },
      highest: { amount: "desc" },
      lowest: { amount: "asc" },
    }[req.query.sort] || { id: "desc" };

    const [total, rows, totals] = await Promise.all([
      prisma.accountMoneyReceived.count({ where }),
      prisma.accountMoneyReceived.findMany({
        where,
        include: MONEY_IN_INCLUDE,
        orderBy,
        skip,
        take,
      }),
      prisma.accountMoneyReceived.aggregate({
        where: { ...where, status: "active" },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      data: {
        rows: rows.map(serializeAdminMoneyIn),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        filteredActiveTotal: roundMoney(Number(totals._sum.amount || 0)),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/money-in ─────────────────────────
// Admin adds money to an employee wallet; it lands in the same Money In
// history the employee already sees, tagged source = "admin".

export async function createMoneyInForEmployee(req, res, next) {
  try {
    const employeeId = parseOptionalBigInt(req.body.employeeId);
    if (!employeeId) return res.status(422).json({ message: "Select an employee." });

    const amount = roundMoney(Number(req.body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({ message: "Enter an amount greater than zero." });
    }

    const receivedDate = parseOptionalDate(req.body.receivedDate);
    if (!receivedDate) return res.status(422).json({ message: "Select a valid received date." });

    const note = String(req.body.note || "").trim().slice(0, 255) || null;
    const adminId = BigInt(req.adminId);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.accountMoneyReceived.create({
        data: {
          employeeId,
          amount,
          receivedDate,
          note,
          source: "admin",
          createdByAdminId: adminId,
        },
        include: MONEY_IN_INCLUDE,
      });

      await applyWalletDelta(tx, employeeId, amount);

      await writeAuditLog(tx, {
        entityType: "money_received",
        entityId: entry.id,
        action: "create",
        adminId,
        employeeId,
        reason: note ? `Admin added money: ${note}` : "Admin added money to employee wallet.",
        afterData: entry,
      });

      return entry;
    });

    res.status(201).json({ data: serializeAdminMoneyIn(created) });
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/admin/accounts/money-in/:id ────────────────────
// The wallet is never edited directly — it moves by exactly the difference.

export async function updateMoneyIn(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid record id." });

    const reason = requireReason(req.body);
    if (!reason) return res.status(422).json({ message: "A reason for this correction is required." });

    const existing = await prisma.accountMoneyReceived.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Money In record not found." });
    if (existing.status === "void") {
      return res.status(409).json({ message: "This record is voided and can no longer be edited." });
    }

    const nextAmount =
      req.body.amount === undefined ? Number(existing.amount) : roundMoney(Number(req.body.amount));
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return res.status(422).json({ message: "Enter an amount greater than zero." });
    }

    const nextDate =
      req.body.receivedDate === undefined
        ? existing.receivedDate
        : parseOptionalDate(req.body.receivedDate);
    if (!nextDate) return res.status(422).json({ message: "Select a valid received date." });

    const nextNote =
      req.body.note === undefined
        ? existing.note
        : String(req.body.note || "").trim().slice(0, 255) || null;

    const adminId = BigInt(req.adminId);
    const walletDelta = roundMoney(nextAmount - Number(existing.amount));

    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.accountMoneyReceived.update({
        where: { id },
        data: { amount: nextAmount, receivedDate: nextDate, note: nextNote },
        include: MONEY_IN_INCLUDE,
      });

      await applyWalletDelta(tx, existing.employeeId, walletDelta);

      await writeAuditLog(tx, {
        entityType: "money_received",
        entityId: id,
        action: "update",
        adminId,
        employeeId: existing.employeeId,
        reason,
        beforeData: existing,
        afterData: entry,
      });

      return entry;
    });

    res.json({ data: serializeAdminMoneyIn(updated), walletChange: walletDelta });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/money-in/:id/void ────────────────

export async function voidMoneyIn(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid record id." });

    const reason = requireReason(req.body);
    if (!reason) return res.status(422).json({ message: "A reason for voiding is required." });

    const existing = await prisma.accountMoneyReceived.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Money In record not found." });
    if (existing.status === "void") {
      return res.status(409).json({ message: "This record is already voided." });
    }

    const adminId = BigInt(req.adminId);
    const walletDelta = roundMoney(-Number(existing.amount));

    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.accountMoneyReceived.update({
        where: { id },
        data: {
          status: "void",
          voidReason: reason,
          voidedByAdminId: adminId,
          voidedAt: new Date(),
        },
        include: MONEY_IN_INCLUDE,
      });

      await applyWalletDelta(tx, existing.employeeId, walletDelta);

      await writeAuditLog(tx, {
        entityType: "money_received",
        entityId: id,
        action: "void",
        adminId,
        employeeId: existing.employeeId,
        reason,
        beforeData: existing,
        afterData: entry,
      });

      return entry;
    });

    res.json({ data: serializeAdminMoneyIn(updated), walletChange: walletDelta });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/expenses ──────────────────────────

function buildExpenseWhere(query) {
  const where = {};
  const itemWhere = {};

  const employeeId = parseOptionalBigInt(query.employeeId);
  if (employeeId) where.employeeId = employeeId;

  if (query.costType === "event" || query.costType === "regular") {
    where.costType = query.costType;
  }
  if (query.status === "active" || query.status === "void") {
    where.status = query.status;
  }
  if (query.paymentSource === "employee_wallet" || query.paymentSource === "company") {
    where.paymentSource = query.paymentSource;
  }
  if (query.linkedRowKey) where.linkedRowKey = String(query.linkedRowKey);

  const eventSearch = String(query.eventSearch || "").trim();
  if (eventSearch) where.eventClientNameSnapshot = { contains: eventSearch };

  const vendorId = parseOptionalBigInt(query.vendorId);
  if (vendorId) itemWhere.vendorId = vendorId;
  if (query.paymentStatus === "paid" || query.paymentStatus === "to_pay") {
    itemWhere.paymentStatus = query.paymentStatus;
  }

  const purposeSearch = String(query.purposeSearch || "").trim();
  if (purposeSearch) itemWhere.purpose = { contains: purposeSearch };

  if (query.receipt === "with") itemWhere.receiptFileUrl = { not: null };
  if (query.receipt === "without") itemWhere.receiptFileUrl = null;

  // "Cost happened" filters the item date; "submitted" filters the header.
  const dateFrom = parseOptionalDate(query.dateFrom);
  const dateTo = parseOptionalDate(query.dateTo);
  if (dateFrom || dateTo) {
    if (query.dateField === "submitted") {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    } else {
      itemWhere.costDate = {};
      if (dateFrom) itemWhere.costDate.gte = dateFrom;
      if (dateTo) itemWhere.costDate.lte = dateTo;
    }
  }

  const minAmount = parseOptionalNumber(query.minAmount);
  const maxAmount = parseOptionalNumber(query.maxAmount);
  if (minAmount !== null || maxAmount !== null) {
    where.totalAmount = {};
    if (minAmount !== null) where.totalAmount.gte = minAmount;
    if (maxAmount !== null) where.totalAmount.lte = maxAmount;
  }

  if (Object.keys(itemWhere).length > 0) where.items = { some: itemWhere };
  return where;
}

export async function listExpenses(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildExpenseWhere(req.query);

    const orderBy = {
      newest: { id: "desc" },
      oldest: { id: "asc" },
      highest: { totalAmount: "desc" },
      lowest: { totalAmount: "asc" },
      employee: { employee: { fullName: "asc" } },
    }[req.query.sort] || { id: "desc" };

    const [total, rows, totals] = await Promise.all([
      prisma.accountExpense.count({ where }),
      prisma.accountExpense.findMany({ where, include: EXPENSE_INCLUDE, orderBy, skip, take }),
      prisma.accountExpense.aggregate({
        where: { ...where, status: "active" },
        _sum: { totalAmount: true, walletDeductionAmount: true },
      }),
    ]);

    const recorded = roundMoney(Number(totals._sum.totalAmount || 0));
    const paid = roundMoney(Number(totals._sum.walletDeductionAmount || 0));

    res.json({
      data: {
        rows: rows.map(serializeAdminExpense),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        filteredTotals: {
          recordedCost: recorded,
          actuallyPaid: paid,
          stillToPay: roundMoney(recorded - paid),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/expenses/:id ──────────────────────

export async function getExpense(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid expense id." });

    const expense = await prisma.accountExpense.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) return res.status(404).json({ message: "Expense not found." });

    const auditLogs = await prisma.accountAuditLog.findMany({
      where: {
        OR: [
          { entityType: "expense", entityId: id },
          { entityType: "expense_item", entityId: { in: expense.items.map((item) => item.id) } },
        ],
      },
      include: { admin: { select: { fullName: true } } },
      orderBy: { id: "desc" },
    });

    res.json({
      data: {
        expense: serializeAdminExpense(expense),
        auditLogs: auditLogs.map(serializeAuditLog),
      },
    });
  } catch (error) {
    next(error);
  }
}

/*
| Recomputes an expense from an edited item list. The admin never types a
| total: item total = quantity × perQtyAmount, header total = sum of items,
| wallet deduction and vendor balances all fall out of that automatically.
*/
function prepareEditedItems(rawItems, existingItems) {
  const existingById = new Map(existingItems.map((item) => [String(item.id), item]));
  const prepared = [];

  for (const raw of rawItems) {
    const existing = existingById.get(String(raw.id));
    if (!existing) return { error: `Unknown expense item ${raw.id}.` };

    const purpose = String(raw.purpose ?? existing.purpose).trim();
    if (!purpose) return { error: "Purpose is required for every item." };

    const costDate =
      raw.costDate === undefined ? existing.costDate : parseOptionalDate(raw.costDate);
    if (!costDate) return { error: "Every item needs a valid cost date." };

    const quantity = raw.quantity === undefined ? Number(existing.quantity) : Number(raw.quantity);
    const perQtyAmount =
      raw.perQtyAmount === undefined ? Number(existing.perQtyAmount) : Number(raw.perQtyAmount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: "Quantity must be greater than zero." };
    }
    if (!Number.isFinite(perQtyAmount) || perQtyAmount < 0) {
      return { error: "Per quantity amount must be zero or more." };
    }

    let vendorId = existing.vendorId;
    if (raw.vendorId !== undefined) {
      vendorId = raw.vendorId === null || raw.vendorId === "" ? null : parseOptionalBigInt(raw.vendorId);
    }

    let paymentStatus = existing.paymentStatus;
    if (raw.paymentStatus !== undefined) paymentStatus = raw.paymentStatus || null;
    if (!vendorId) paymentStatus = null;
    if (vendorId && paymentStatus !== "paid" && paymentStatus !== "to_pay") {
      return { error: "Vendor items need a payment status of Paid or To Pay." };
    }

    prepared.push({
      id: existing.id,
      purpose: purpose.slice(0, 190),
      costDate,
      quantity,
      perQtyAmount,
      totalAmount: roundMoney(quantity * perQtyAmount),
      vendorId,
      paymentStatus,
    });
  }

  return { items: prepared };
}

// ─── PATCH /api/admin/accounts/expenses/:id ────────────────────

export async function updateExpense(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid expense id." });

    const reason = requireReason(req.body);
    if (!reason) return res.status(422).json({ message: "A reason for this correction is required." });

    const existing = await prisma.accountExpense.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ message: "Expense not found." });
    if (existing.status === "void") {
      return res.status(409).json({ message: "This expense is voided and can no longer be edited." });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(422).json({ message: "At least one expense item is required." });
    }

    const { items: nextItems, error } = prepareEditedItems(rawItems, existing.items);
    if (error) return res.status(422).json({ message: error });

    const adminId = BigInt(req.adminId);
    const oldWalletDeduction = Number(existing.walletDeductionAmount);
    const newWalletDeduction = computeWalletDeduction(nextItems);
    const newTotal = roundMoney(nextItems.reduce((sum, item) => sum + item.totalAmount, 0));

    // Reverse the original vendor effect, then apply the corrected one —
    // this is what makes a vendor swap (A → B) settle both ledgers.
    const oldVendorDeltas = computeVendorDeltas(existing.items);
    const newVendorDeltas = computeVendorDeltas(nextItems);
    const combined = new Map(negateDeltas(oldVendorDeltas));
    for (const [key, value] of newVendorDeltas) {
      combined.set(key, roundMoney((combined.get(key) || 0) + value));
    }

    // A "company" expense never touched a wallet, so it must not now.
    const walletDelta =
      existing.paymentSource === "company" || !existing.employeeId
        ? 0
        : roundMoney(oldWalletDeduction - newWalletDeduction);

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of nextItems) {
        await tx.accountExpenseItem.update({
          where: { id: item.id },
          data: {
            purpose: item.purpose,
            costDate: item.costDate,
            quantity: item.quantity,
            perQtyAmount: item.perQtyAmount,
            totalAmount: item.totalAmount,
            vendorId: item.vendorId,
            paymentStatus: item.paymentStatus,
          },
        });
      }

      const expense = await tx.accountExpense.update({
        where: { id },
        data: { totalAmount: newTotal, walletDeductionAmount: newWalletDeduction },
        include: EXPENSE_INCLUDE,
      });

      await applyWalletDelta(tx, existing.employeeId, walletDelta);
      await applyVendorDeltas(tx, combined);

      await writeAuditLog(tx, {
        entityType: "expense",
        entityId: id,
        action: "update",
        adminId,
        employeeId: existing.employeeId,
        reason,
        beforeData: existing,
        afterData: expense,
      });

      return expense;
    });

    res.json({
      data: serializeAdminExpense(updated),
      walletChange: walletDelta,
      vendorChanges: Array.from(combined, ([vendorId, delta]) => ({ vendorId, delta })),
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/expenses/:id/preview ─────────────
// Dry run: shows old vs. new totals and the wallet/vendor impact before
// the admin commits a financial correction. Writes nothing.

export async function previewExpenseUpdate(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid expense id." });

    const existing = await prisma.accountExpense.findUnique({
      where: { id },
      include: { items: { include: { vendor: { select: { name: true } } } } },
    });
    if (!existing) return res.status(404).json({ message: "Expense not found." });

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const { items: nextItems, error } = prepareEditedItems(rawItems, existing.items);
    if (error) return res.status(422).json({ message: error });

    const oldTotal = Number(existing.totalAmount);
    const newTotal = roundMoney(nextItems.reduce((sum, item) => sum + item.totalAmount, 0));
    const oldWalletDeduction = Number(existing.walletDeductionAmount);
    const newWalletDeduction = computeWalletDeduction(nextItems);

    const oldVendorDeltas = computeVendorDeltas(existing.items);
    const newVendorDeltas = computeVendorDeltas(nextItems);
    const combined = new Map(negateDeltas(oldVendorDeltas));
    for (const [key, value] of newVendorDeltas) {
      combined.set(key, roundMoney((combined.get(key) || 0) + value));
    }

    const vendorIds = Array.from(combined.keys()).map((key) => BigInt(key));
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true },
        })
      : [];
    const vendorNameById = new Map(vendors.map((vendor) => [String(vendor.id), vendor.name]));

    const walletChange =
      existing.paymentSource === "company" || !existing.employeeId
        ? 0
        : roundMoney(oldWalletDeduction - newWalletDeduction);

    res.json({
      data: {
        oldTotal,
        newTotal,
        totalChange: roundMoney(newTotal - oldTotal),
        oldWalletDeduction,
        newWalletDeduction,
        walletChange,
        vendorImpact: Array.from(combined, ([vendorId, delta]) => ({
          vendorId,
          vendorName: vendorNameById.get(vendorId) || null,
          delta: roundMoney(delta),
        })).filter((entry) => entry.delta !== 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/expenses/:id/void ────────────────

export async function voidExpense(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid expense id." });

    const reason = requireReason(req.body);
    if (!reason) return res.status(422).json({ message: "A reason for voiding is required." });

    const existing = await prisma.accountExpense.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ message: "Expense not found." });
    if (existing.status === "void") {
      return res.status(409).json({ message: "This expense is already voided." });
    }

    const adminId = BigInt(req.adminId);
    const walletDelta =
      existing.paymentSource === "company" || !existing.employeeId
        ? 0
        : Number(existing.walletDeductionAmount);
    const vendorReversal = negateDeltas(computeVendorDeltas(existing.items));

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.accountExpense.update({
        where: { id },
        data: {
          status: "void",
          voidReason: reason,
          voidedByAdminId: adminId,
          voidedAt: new Date(),
        },
        include: EXPENSE_INCLUDE,
      });

      await applyWalletDelta(tx, existing.employeeId, walletDelta);
      await applyVendorDeltas(tx, vendorReversal);

      await writeAuditLog(tx, {
        entityType: "expense",
        entityId: id,
        action: "void",
        adminId,
        employeeId: existing.employeeId,
        reason,
        beforeData: existing,
        afterData: expense,
      });

      return expense;
    });

    res.json({ data: serializeAdminExpense(updated), walletChange: walletDelta });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/events ────────────────────────────

export async function listEventCostOverview(req, res, next) {
  try {
    const expenses = await prisma.accountExpense.findMany({
      where: { ...ACTIVE_ONLY, costType: "event" },
      include: EXPENSE_INCLUDE,
      orderBy: { id: "desc" },
    });

    const search = String(req.query.search || "").trim().toLowerCase();
    const byEvent = new Map();

    for (const expense of expenses) {
      const key = expense.linkedRowKey || "unlinked";
      if (!byEvent.has(key)) {
        byEvent.set(key, {
          linkedRowKey: expense.linkedRowKey,
          clientName: expense.eventClientNameSnapshot || "Unlinked",
          eventDate: formatDateOnly(expense.eventDateSnapshot),
          recordedCost: 0,
          actuallyPaid: 0,
          employees: new Set(),
          vendorCost: 0,
          expenseCount: 0,
        });
      }
      const bucket = byEvent.get(key);
      bucket.recordedCost = roundMoney(bucket.recordedCost + Number(expense.totalAmount));
      bucket.actuallyPaid = roundMoney(
        bucket.actuallyPaid + Number(expense.walletDeductionAmount),
      );
      bucket.expenseCount += 1;
      if (expense.employee?.fullName) bucket.employees.add(expense.employee.fullName);
      for (const item of expense.items) {
        if (item.vendorId) bucket.vendorCost = roundMoney(bucket.vendorCost + Number(item.totalAmount));
      }
    }

    const rows = Array.from(byEvent.values())
      .map((bucket) => ({
        linkedRowKey: bucket.linkedRowKey,
        clientName: bucket.clientName,
        eventDate: bucket.eventDate,
        recordedCost: bucket.recordedCost,
        actuallyPaid: bucket.actuallyPaid,
        stillToPay: roundMoney(bucket.recordedCost - bucket.actuallyPaid),
        vendorCost: bucket.vendorCost,
        expenseCount: bucket.expenseCount,
        employees: Array.from(bucket.employees),
      }))
      .filter((row) => {
        if (!search) return true;
        return (
          row.clientName.toLowerCase().includes(search) ||
          String(row.eventDate || "").includes(search)
        );
      })
      .sort((a, b) => b.recordedCost - a.recordedCost);

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/reconciliation ────────────────────
// Compares the stored fast-read balances against a full recomputation
// from transaction history, so drift is visible immediately.

export async function getReconciliation(req, res, next) {
  try {
    const [wallets, moneyInGroups, expenseGroups, vendorBalances, vendorItems] = await Promise.all([
      prisma.accountWallet.findMany({ include: { employee: { select: { fullName: true } } } }),
      prisma.accountMoneyReceived.groupBy({
        by: ["employeeId"],
        where: ACTIVE_ONLY,
        _sum: { amount: true },
      }),
      prisma.accountExpense.groupBy({
        by: ["employeeId"],
        where: { ...ACTIVE_ONLY, paymentSource: "employee_wallet" },
        _sum: { walletDeductionAmount: true },
      }),
      prisma.vendorBalance.findMany({ include: { vendor: { select: { name: true } } } }),
      prisma.accountExpenseItem.findMany({
        where: { vendorId: { not: null }, expense: ACTIVE_ONLY },
        select: { vendorId: true, totalAmount: true, paymentStatus: true },
      }),
    ]);

    const moneyInBy = new Map(
      moneyInGroups.map((g) => [String(g.employeeId), Number(g._sum.amount || 0)]),
    );
    const spentBy = new Map(
      expenseGroups.map((g) => [String(g.employeeId), Number(g._sum.walletDeductionAmount || 0)]),
    );

    const walletRows = wallets.map((wallet) => {
      const key = String(wallet.employeeId);
      const stored = Number(wallet.currentBalance);
      const calculated = roundMoney((moneyInBy.get(key) || 0) - (spentBy.get(key) || 0));
      return {
        employeeId: key,
        employeeName: wallet.employee?.fullName || "Unknown",
        stored: roundMoney(stored),
        calculated,
        difference: roundMoney(stored - calculated),
        matches: Math.abs(stored - calculated) < 0.01,
      };
    });

    const vendorCalculated = new Map();
    for (const item of vendorItems) {
      const key = String(item.vendorId);
      const amount = Number(item.totalAmount);
      const delta = item.paymentStatus === "paid" ? amount : -amount;
      vendorCalculated.set(key, roundMoney((vendorCalculated.get(key) || 0) + delta));
    }

    const vendorRows = vendorBalances.map((balance) => {
      const key = String(balance.vendorId);
      const stored = Number(balance.currentBalance);
      const calculated = roundMoney(vendorCalculated.get(key) || 0);
      return {
        vendorId: key,
        vendorName: balance.vendor?.name || "Unknown",
        stored: roundMoney(stored),
        calculated,
        difference: roundMoney(stored - calculated),
        matches: Math.abs(stored - calculated) < 0.01,
      };
    });

    res.json({
      data: {
        wallets: walletRows,
        vendors: vendorRows,
        walletMismatchCount: walletRows.filter((row) => !row.matches).length,
        vendorMismatchCount: vendorRows.filter((row) => !row.matches).length,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/audit ─────────────────────────────

export async function listAuditLogs(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = {};

    const adminId = parseOptionalBigInt(req.query.adminId);
    if (adminId) where.adminId = adminId;
    const employeeId = parseOptionalBigInt(req.query.employeeId);
    if (employeeId) where.employeeId = employeeId;
    const vendorId = parseOptionalBigInt(req.query.vendorId);
    if (vendorId) where.vendorId = vendorId;

    if (["money_received", "expense", "expense_item", "vendor"].includes(req.query.entityType)) {
      where.entityType = req.query.entityType;
    }
    if (["create", "update", "void"].includes(req.query.action)) {
      where.action = req.query.action;
    }

    const dateFrom = parseOptionalDate(req.query.dateFrom);
    const dateTo = parseOptionalDate(req.query.dateTo);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, rows] = await Promise.all([
      prisma.accountAuditLog.count({ where }),
      prisma.accountAuditLog.findMany({
        where,
        include: { admin: { select: { fullName: true } } },
        orderBy: { id: "desc" },
        skip,
        take,
      }),
    ]);

    res.json({
      data: {
        rows: rows.map(serializeAuditLog),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/activity ──────────────────────────

export async function getActivityFeed(req, res, next) {
  try {
    const [moneyIn, expenses, audits] = await Promise.all([
      prisma.accountMoneyReceived.findMany({
        include: MONEY_IN_INCLUDE,
        orderBy: { id: "desc" },
        take: 25,
      }),
      prisma.accountExpense.findMany({
        include: EXPENSE_INCLUDE,
        orderBy: { id: "desc" },
        take: 25,
      }),
      prisma.accountAuditLog.findMany({
        where: { action: { in: ["update", "void"] } },
        include: { admin: { select: { fullName: true } } },
        orderBy: { id: "desc" },
        take: 25,
      }),
    ]);

    const feed = [
      ...moneyIn.map((entry) => ({
        kind: "money_in",
        actor: entry.source === "admin"
          ? entry.createdByAdmin?.fullName || "Admin"
          : entry.employee?.fullName || "Employee",
        subject: entry.employee?.fullName || "Unknown",
        amount: Number(entry.amount),
        detail: entry.source === "admin" ? "Admin added Money In" : "added Money In",
        at: entry.createdAt,
      })),
      ...expenses.map((expense) => {
        const vendorItem = expense.items.find((item) => item.vendorId);
        return {
          kind: "expense",
          actor: expense.paymentSource === "company"
            ? expense.createdByAdmin?.fullName || "Admin"
            : expense.employee?.fullName || "Employee",
          subject: vendorItem?.vendor?.name || null,
          amount: Number(expense.totalAmount),
          detail: expense.costType === "event" ? "submitted Event Cost" : "submitted Regular Cost",
          at: expense.createdAt,
        };
      }),
      ...audits.map((entry) => ({
        kind: "correction",
        actor: entry.admin?.fullName || "Admin",
        subject: `${entry.entityType.replace("_", " ")} #${entry.entityId}`,
        amount: null,
        detail: entry.action === "void" ? "voided" : "corrected",
        at: entry.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40)
      .map((entry) => ({ ...entry, at: formatDateTime(entry.at) }));

    res.json({ data: feed });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/admin/accounts/summary ───────────────────────────
// Company-wide or single-employee financial summary for a date range.

export async function getRangeSummary(req, res, next) {
  try {
    const dateFrom = parseOptionalDate(req.query.dateFrom);
    const dateTo = parseOptionalDate(req.query.dateTo);
    if (!dateFrom || !dateTo) {
      return res.status(422).json({ message: "Select both a start and end date." });
    }
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const employeeId = parseOptionalBigInt(req.query.employeeId);
    const employeeFilter = employeeId ? { employeeId } : {};

    const [moneyIn, expenses, vendorItems] = await Promise.all([
      prisma.accountMoneyReceived.aggregate({
        where: { ...ACTIVE_ONLY, ...employeeFilter, receivedDate: { gte: dateFrom, lte: dateTo } },
        _sum: { amount: true },
      }),
      prisma.accountExpense.findMany({
        where: { ...ACTIVE_ONLY, ...employeeFilter, createdAt: { gte: dateFrom, lte: endOfDay } },
        include: { items: true },
      }),
      prisma.accountExpenseItem.findMany({
        where: {
          vendorId: { not: null },
          costDate: { gte: dateFrom, lte: dateTo },
          expense: { ...ACTIVE_ONLY, ...employeeFilter },
        },
        select: { totalAmount: true, paymentStatus: true },
      }),
    ]);

    const recordedCost = roundMoney(
      expenses.reduce((sum, expense) => sum + Number(expense.totalAmount), 0),
    );
    const actuallyPaid = roundMoney(
      expenses.reduce((sum, expense) => sum + Number(expense.walletDeductionAmount), 0),
    );

    res.json({
      data: {
        dateFrom: formatDateOnly(dateFrom),
        dateTo: formatDateOnly(dateTo),
        moneyGivenToEmployees: roundMoney(Number(moneyIn._sum.amount || 0)),
        recordedCost,
        actuallyPaid,
        stillToPay: roundMoney(recordedCost - actuallyPaid),
        eventCost: roundMoney(
          expenses
            .filter((expense) => expense.costType === "event")
            .reduce((sum, expense) => sum + Number(expense.totalAmount), 0),
        ),
        regularCost: roundMoney(
          expenses
            .filter((expense) => expense.costType === "regular")
            .reduce((sum, expense) => sum + Number(expense.totalAmount), 0),
        ),
        vendorBilled: roundMoney(
          vendorItems.reduce((sum, item) => sum + Number(item.totalAmount), 0),
        ),
        vendorPaid: roundMoney(
          vendorItems
            .filter((item) => item.paymentStatus === "paid")
            .reduce((sum, item) => sum + Number(item.totalAmount), 0),
        ),
        vendorDue: roundMoney(
          vendorItems
            .filter((item) => item.paymentStatus === "to_pay")
            .reduce((sum, item) => sum + Number(item.totalAmount), 0),
        ),
      },
    });
  } catch (error) {
    next(error);
  }
}
