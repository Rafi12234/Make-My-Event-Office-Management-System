import {
  prisma,
  formatDateOnly,
  formatDateTime,
  roundMoney,
  computeWalletDeduction,
  computeVendorDeltas,
  computeVendorStillOwed,
  computeVendorOutstandingBills,
  negateDeltas,
  applyWalletDelta,
  applyVendorDeltas,
  parsePagination,
  parseOptionalDate,
  parseOptionalBigInt,
  parseOptionalNumber,
  requireReason,
  resolveSettlementTarget,
  serializeAdminExpense,
  serializeAdminMoneyIn,
  ACTIVE_ONLY,
} from "../utils/accountsShared.js";

/*
|--------------------------------------------------------------------------
| Admin Accounts controller
|--------------------------------------------------------------------------
|
| Reads and corrects the SAME tables the employee Accounts module writes —
| there is no parallel admin ledger. Every figure is kept deliberately
| distinct (total expense vs. wallet-only paid vs. still payable) rather
| than collapsed into one vague number.
|
| Admin identity always comes from req.adminId (set by requireAdmin), never
| from anything the frontend sends.
*/

const EXPENSE_INCLUDE = {
  employee: { select: { fullName: true } },
  createdByAdmin: { select: { fullName: true } },
  voidedByAdmin: { select: { fullName: true } },
  approvedByAdmin: { select: { fullName: true } },
  items: { include: { vendor: { select: { name: true } } }, orderBy: { id: "asc" } },
};

const MONEY_IN_INCLUDE = {
  employee: { select: { fullName: true } },
  createdByAdmin: { select: { fullName: true } },
};

// A "to_pay" bill belongs to exactly the one employee who logged it — a
// "paid" item only reduces the specific bill it explicitly targets via
// settlesItemId (see computeVendorOutstandingBills), never anything else
// that merely shares the same vendor/event. No proportional splitting is
// needed anymore: each employee's remaining balance is just the sum of
// their own bills' own remaining amounts.
async function computeStillPayableByEmployee() {
  const items = await prisma.accountExpenseItem.findMany({
    where: { expense: ACTIVE_ONLY, vendorId: { not: null } },
    select: {
      id: true,
      totalAmount: true,
      paymentStatus: true,
      vendorId: true,
      settlesItemId: true,
      settlesAllOwed: true,
      expense: { select: { employeeId: true } },
    },
  });

  const remainingById = computeVendorOutstandingBills(items);

  const stillPayableBy = new Map();
  for (const item of items) {
    if (item.paymentStatus !== "to_pay" || !item.expense.employeeId) continue;
    const remaining = remainingById.get(String(item.id));
    if (!remaining) continue;
    const employeeKey = String(item.expense.employeeId);
    stillPayableBy.set(employeeKey, roundMoney((stillPayableBy.get(employeeKey) || 0) + remaining));
  }
  return stillPayableBy;
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

    const [wallets, moneyInGroups, items, stillPayableBy, lastMoneyInGroups, lastExpenseGroups] =
      await Promise.all([
        prisma.accountWallet.findMany(),
        prisma.accountMoneyReceived.groupBy({
          by: ["employeeId"],
          _sum: { amount: true },
        }),
        // No employeeId column on the item table — group in JS via the parent.
        prisma.accountExpenseItem.findMany({
          where: { expense: ACTIVE_ONLY },
          select: {
            totalAmount: true,
            vendorId: true,
            paymentStatus: true,
            expense: { select: { employeeId: true } },
          },
        }),
        computeStillPayableByEmployee(),
        // Latest activity of any kind — money in, a to-pay bill, a paid
        // vendor item, or a plain expense — is just the newest record
        // touching that employee, from either of these two tables.
        prisma.accountMoneyReceived.groupBy({
          by: ["employeeId"],
          _max: { createdAt: true },
        }),
        prisma.accountExpense.groupBy({
          by: ["employeeId"],
          where: ACTIVE_ONLY,
          _max: { createdAt: true },
        }),
      ]);

    const walletBy = new Map(wallets.map((w) => [String(w.employeeId), Number(w.currentBalance)]));
    const moneyInBy = new Map(
      moneyInGroups.map((g) => [String(g.employeeId), Number(g._sum.amount || 0)]),
    );

    const lastActivityBy = new Map();
    for (const g of lastMoneyInGroups) {
      if (!g.employeeId) continue;
      lastActivityBy.set(String(g.employeeId), new Date(g._max.createdAt).getTime());
    }
    for (const g of lastExpenseGroups) {
      if (!g.employeeId) continue;
      const key = String(g.employeeId);
      const time = new Date(g._max.createdAt).getTime();
      if (!lastActivityBy.has(key) || time > lastActivityBy.get(key)) {
        lastActivityBy.set(key, time);
      }
    }

    // "Paid to vendors" is each employee's own raw paid total — unrelated to
    // the cross-employee still-payable netting above.
    const ownExpensesBy = new Map();
    const paidToVendorsBy = new Map();
    for (const item of items) {
      const employeeKey = String(item.expense.employeeId);
      const amount = Number(item.totalAmount);
      if (item.vendorId) {
        if (item.paymentStatus !== "to_pay") {
          paidToVendorsBy.set(employeeKey, roundMoney((paidToVendorsBy.get(employeeKey) || 0) + amount));
        }
      } else {
        ownExpensesBy.set(employeeKey, roundMoney((ownExpensesBy.get(employeeKey) || 0) + amount));
      }
    }

    res.json({
      data: employees
        .map((employee) => {
          const key = String(employee.id);
          const lastActivityMs = lastActivityBy.get(key) || 0;
          return {
            employeeId: key,
            fullName: employee.fullName,
            email: employee.email,
            isActive: employee.isActive,
            currentBalance: roundMoney(walletBy.get(key) || 0),
            totalMoneyIn: roundMoney(moneyInBy.get(key) || 0),
            totalStillPayable: roundMoney(stillPayableBy.get(key) || 0),
            totalPaidToVendors: roundMoney(paidToVendorsBy.get(key) || 0),
            totalExpenses: roundMoney(ownExpensesBy.get(key) || 0),
            lastActivityAt: lastActivityMs ? formatDateTime(new Date(lastActivityMs)) : null,
            lastActivityMs,
          };
        })
        // Whoever last did anything — money in, a bill, a payment, or a
        // plain expense — floats to the top. No activity at all sinks
        // to the bottom, alphabetically.
        .sort((a, b) => b.lastActivityMs - a.lastActivityMs || a.fullName.localeCompare(b.fullName))
        .map(({ lastActivityMs, ...employee }) => employee),
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

    const [wallet, moneyIn, expenses, stillPayableBy] = await Promise.all([
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
      computeStillPayableByEmployee(),
    ]);

    const active = expenses.filter((expense) => expense.status === "active");
    const sumBy = (list, key) =>
      roundMoney(list.reduce((sum, expense) => sum + Number(expense[key]), 0));

    // Paid-only total (no double count) vs. the still-open "To Pay" balance —
    // same split used on the Overview page.
    const paidOnlyTotal = (list) =>
      roundMoney(
        list.reduce(
          (sum, expense) =>
            sum +
            expense.items.reduce(
              (itemSum, item) =>
                item.vendorId && item.paymentStatus === "to_pay"
                  ? itemSum
                  : itemSum + Number(item.totalAmount),
              0,
            ),
          0,
        ),
      );

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
          moneyIn.reduce((sum, entry) => sum + Number(entry.amount), 0),
        ),
        totalRecordedCost: paidOnlyTotal(active),
        totalStillPayable: roundMoney(stillPayableBy.get(String(employee.id)) || 0),
        totalActuallyPaid: sumBy(active, "walletDeductionAmount"),
        eventCostTotal: paidOnlyTotal(active.filter((e) => e.costType === "event")),
        regularCostTotal: paidOnlyTotal(active.filter((e) => e.costType === "regular")),
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
        where,
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
  if (query.approved === "true" || query.approved === "false") {
    where.approved = query.approved === "true";
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
  return { where, itemWhere };
}

export async function listExpenses(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const { where, itemWhere } = buildExpenseWhere(req.query);
    const { items: _itemsClause, ...expenseHeaderWhere } = where;

    const orderBy = {
      newest: { id: "desc" },
      oldest: { id: "asc" },
      highest: { totalAmount: "desc" },
      lowest: { totalAmount: "asc" },
      employee: { employee: { fullName: "asc" } },
    }[req.query.sort] || { id: "desc" };

    // The admin Bills page — the pending-approval review queue: every
    // active expense matching `where.approved` (Event Based or Regular,
    // vendor-linked or not), regardless of payment status. A to_pay item's
    // paymentStatus never flips to "paid" once it's been settled by a
    // SEPARATE payment elsewhere (see settlesItemId), so "still owed" here
    // can only be trusted by running computeVendorOutstandingBills over
    // every active vendor item company-wide, not by trusting each item's
    // own paymentStatus flag in isolation.
    if (req.query.pendingApproval === "true") {
      const [matching, allVendorItems] = await Promise.all([
        prisma.accountExpense.findMany({ where, include: EXPENSE_INCLUDE, orderBy }),
        prisma.accountExpenseItem.findMany({
          where: { vendorId: { not: null }, expense: ACTIVE_ONLY },
          select: {
            id: true,
            vendorId: true,
            paymentStatus: true,
            totalAmount: true,
            settlesItemId: true,
            settlesAllOwed: true,
          },
        }),
      ]);

      const remainingById = computeVendorOutstandingBills(allVendorItems);

      const rows = matching.map((expense) => {
        const stillOwed = roundMoney(
          expense.items.reduce(
            (sum, item) =>
              item.vendorId && item.paymentStatus === "to_pay"
                ? sum + (remainingById.get(String(item.id)) || 0)
                : sum,
            0,
          ),
        );
        return { ...serializeAdminExpense(expense), vendorPayableAmount: stillOwed };
      });

      const total = rows.length;
      const page_ = rows.slice(skip, skip + take);
      const recorded = roundMoney(rows.reduce((sum, row) => sum + row.recordedTotalAmount, 0));
      const stillToPay = roundMoney(rows.reduce((sum, row) => sum + row.vendorPayableAmount, 0));

      return res.json({
        data: {
          rows: page_,
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          filteredTotals: { recordedCost: recorded, actuallyPaid: 0, stillToPay },
        },
      });
    }

    const [total, rows, walletTotals, paidOnlyTotal, stillPayableTotal] = await Promise.all([
      prisma.accountExpense.count({ where }),
      prisma.accountExpense.findMany({ where, include: EXPENSE_INCLUDE, orderBy, skip, take }),
      prisma.accountExpense.aggregate({
        where: { ...where, status: "active" },
        _sum: { walletDeductionAmount: true },
      }),
      // Item-level, so a filter like paymentStatus/vendorId scopes the total
      // to matching items only (not the whole parent expense), and open
      // "To Pay" items are excluded so nothing is double-counted.
      prisma.accountExpenseItem.aggregate({
        where: {
          expense: { ...expenseHeaderWhere, status: "active" },
          ...itemWhere,
          NOT: { AND: [{ vendorId: { not: null } }, { paymentStatus: "to_pay" }] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.accountExpenseItem.aggregate({
        where: {
          expense: { ...expenseHeaderWhere, status: "active" },
          ...itemWhere,
          vendorId: { not: null },
          paymentStatus: "to_pay",
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const recorded = roundMoney(Number(paidOnlyTotal._sum.totalAmount || 0));
    const paid = roundMoney(Number(walletTotals._sum.walletDeductionAmount || 0));
    const stillToPay = roundMoney(Number(stillPayableTotal._sum.totalAmount || 0));

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
          stillToPay,
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

    res.json({
      data: {
        expense: serializeAdminExpense(expense),
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

  return (async () => {
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

      // Which bill this settles never survives a vendor swap or a drop to
      // To Pay unless the caller explicitly names a new target — carrying
      // a stale link across a vendor change would settle the WRONG vendor.
      const vendorChanged = String(existing.vendorId || "") !== String(vendorId || "");
      let settlesItemId = existing.settlesItemId;
      let settlesAllOwed = existing.settlesAllOwed;
      if (!vendorId || paymentStatus !== "paid") {
        settlesItemId = null;
        settlesAllOwed = false;
      } else if (raw.settlesItemId !== undefined) {
        const settlement = await resolveSettlementTarget(vendorId, raw.settlesItemId);
        if (settlement.error) return { error: settlement.error };
        settlesItemId = settlement.settlesItemId;
        settlesAllOwed = settlement.settlesAllOwed;
      } else if (vendorChanged) {
        settlesItemId = null;
        settlesAllOwed = false;
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
        settlesItemId,
        settlesAllOwed,
      });
    }

    return { items: prepared };
  })();
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

    const { items: nextItems, error } = await prepareEditedItems(rawItems, existing.items);
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

    // A "company" expense never touched a wallet, so it must not now. Nor
    // does an expense still awaiting approval — nothing has been deducted
    // yet, so editing it only changes what will be deducted on approval.
    const walletDelta =
      existing.paymentSource === "company" || !existing.employeeId || !existing.approved
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
            settlesItemId: item.settlesItemId,
            settlesAllOwed: item.settlesAllOwed,
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
    const { items: nextItems, error } = await prepareEditedItems(rawItems, existing.items);
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
      existing.paymentSource === "company" || !existing.employeeId || !existing.approved
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
    // Nothing was ever deducted for an unapproved expense, so voiding one
    // has no wallet impact — only an already-approved expense reverses.
    const walletDelta =
      existing.paymentSource === "company" || !existing.employeeId || !existing.approved
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

      return expense;
    });

    res.json({ data: serializeAdminExpense(updated), walletChange: walletDelta });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/admin/accounts/expenses/:id/approve ─────────────
// Admin sign-off — separate from void/status. Once approved, a bill's paid
// amounts are considered a finalized company expense (see listExpenses'
// pendingApproval branch, which only ever surfaces UNapproved bills, and the
// employee-facing Expenses tab / admin Expenses page, both of which hide an
// expense until it's approved).

export async function approveExpense(req, res, next) {
  try {
    const id = parseOptionalBigInt(req.params.id);
    if (!id) return res.status(422).json({ message: "Invalid expense id." });

    const existing = await prisma.accountExpense.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Expense not found." });
    if (existing.status === "void") {
      return res.status(409).json({ message: "A voided expense cannot be approved." });
    }
    if (existing.approved) {
      return res.status(409).json({ message: "This expense is already approved." });
    }

    const adminId = BigInt(req.adminId);
    // The wallet is only actually debited once approved — before this,
    // walletDeductionAmount was just a stored figure, not yet applied.
    const walletDelta =
      existing.paymentSource === "company" || !existing.employeeId
        ? 0
        : -Number(existing.walletDeductionAmount);

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.accountExpense.update({
        where: { id },
        data: { approved: true, approvedByAdminId: adminId, approvedAt: new Date() },
        include: EXPENSE_INCLUDE,
      });

      await applyWalletDelta(tx, existing.employeeId, walletDelta);

      return expense;
    });

    res.json({ data: serializeAdminExpense(updated), walletChange: walletDelta });
  } catch (error) {
    next(error);
  }
}
