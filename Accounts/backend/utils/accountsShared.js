import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same require()-not-import() + BACKEND_SRC_DIR convention as
// accountsController.js — see server.js for why top-level await must be
// avoided anywhere in this module graph.
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

export const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
export const { formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/*
|--------------------------------------------------------------------------
| Money math
|--------------------------------------------------------------------------
|
| These mirror the employee-side createExpense logic exactly. Every Admin
| write path reverses an old effect and applies a new one using the same
| two functions, so a correction can never drift from how the original
| submission was calculated.
*/

// Everything except an unpaid vendor item — a "to_pay" row is an order
// placed, not money that left the wallet.
export function computeWalletDeduction(items) {
  return roundMoney(
    items.reduce((sum, item) => {
      if (item.vendorId && item.paymentStatus === "to_pay") return sum;
      return sum + Number(item.totalAmount);
    }, 0),
  );
}

// Negative = we owe the vendor, positive = we paid/advanced.
export function computeVendorDeltas(items) {
  const deltas = new Map();
  for (const item of items) {
    if (!item.vendorId) continue;
    const key = String(item.vendorId);
    const amount = Number(item.totalAmount);
    const delta = item.paymentStatus === "paid" ? amount : -amount;
    deltas.set(key, roundMoney((deltas.get(key) || 0) + delta));
  }
  return deltas;
}

export function negateDeltas(deltas) {
  const out = new Map();
  for (const [key, value] of deltas) out.set(key, roundMoney(-value));
  return out;
}

// A "to_pay" item is a specific bill. A "paid" item only ever reduces a
// bill it explicitly targets via settlesItemId — sharing the same vendor
// (even the same event) is NOT enough to net two items against each
// other. An unlinked "paid" item (e.g. an instant, unrelated buy from the
// same vendor under the same event) never reduces any bill's balance.
// Takes any flat list of items shaped { id, vendorId, paymentStatus,
// totalAmount, settlesItemId } and returns a Map(bill itemId string ->
// amount still owed on that specific bill, only entries with amount > 0).
export function computeVendorOutstandingBills(items) {
  const bills = new Map();
  for (const item of items) {
    if (item.vendorId && item.paymentStatus === "to_pay") {
      bills.set(String(item.id), Number(item.totalAmount));
    }
  }
  for (const item of items) {
    if (!item.vendorId || item.paymentStatus !== "paid" || !item.settlesItemId) continue;
    const key = String(item.settlesItemId);
    if (!bills.has(key)) continue;
    bills.set(key, roundMoney(bills.get(key) - Number(item.totalAmount)));
  }
  const remainingById = new Map();
  for (const [itemId, remaining] of bills) {
    const clamped = Math.max(0, roundMoney(remaining));
    if (clamped > 0) remainingById.set(itemId, clamped);
  }
  return remainingById;
}

// Per-vendor rollup of computeVendorOutstandingBills — same item shape,
// returns a Map(vendorId string -> total still owed across all its bills).
export function computeVendorStillOwed(items) {
  const remainingById = computeVendorOutstandingBills(items);
  const stillOwedBy = new Map();
  for (const item of items) {
    if (!item.vendorId || item.paymentStatus !== "to_pay") continue;
    const remaining = remainingById.get(String(item.id));
    if (!remaining) continue;
    const vendorKey = String(item.vendorId);
    stillOwedBy.set(vendorKey, roundMoney((stillOwedBy.get(vendorKey) || 0) + remaining));
  }
  return stillOwedBy;
}

export function mergeDeltas(first, second) {
  const out = new Map(first);
  for (const [key, value] of second) {
    out.set(key, roundMoney((out.get(key) || 0) + value));
  }
  return out;
}

export async function applyWalletDelta(tx, employeeId, delta) {
  if (!employeeId || !delta) return;
  await tx.accountWallet.upsert({
    where: { employeeId },
    create: { employeeId, currentBalance: delta },
    update: { currentBalance: { increment: delta } },
  });
}

export async function applyVendorDeltas(tx, deltas) {
  for (const [vendorIdKey, delta] of deltas) {
    if (!delta) continue;
    const vendorId = BigInt(vendorIdKey);
    await tx.vendorBalance.upsert({
      where: { vendorId },
      create: { vendorId, currentBalance: delta },
      update: { currentBalance: { increment: delta } },
    });
  }
}

/*
|--------------------------------------------------------------------------
| Audit trail
|--------------------------------------------------------------------------
*/

// Prisma Decimal/BigInt/Date are not JSON-serializable — snapshots stored
// in account_audit_logs.before_data/after_data must survive a round trip.
export function toJsonSafe(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === "object") {
    if (typeof value.toNumber === "function") return Number(value);
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = toJsonSafe(nested);
    return out;
  }
  return value;
}

export async function writeAuditLog(tx, entry) {
  await tx.accountAuditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: BigInt(entry.entityId),
      action: entry.action,
      adminId: entry.adminId ? BigInt(entry.adminId) : null,
      employeeId: entry.employeeId ? BigInt(entry.employeeId) : null,
      vendorId: entry.vendorId ? BigInt(entry.vendorId) : null,
      reason: entry.reason,
      beforeData: entry.beforeData ? toJsonSafe(entry.beforeData) : undefined,
      afterData: entry.afterData ? toJsonSafe(entry.afterData) : undefined,
    },
  });
}

/*
|--------------------------------------------------------------------------
| Request parsing
|--------------------------------------------------------------------------
*/

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

export function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = parseDateOnly(String(value));
  return parsed || null;
}

export function parseOptionalBigInt(value) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

export function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Admin corrections to financial records always require a written reason
// (feature: "Reason for Admin Correction").
export function requireReason(body) {
  const reason = String(body.reason || "").trim();
  if (reason.length < 3) return null;
  return reason.slice(0, 500);
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

export function serializeAdminExpenseItem(item) {
  return {
    id: String(item.id),
    expenseId: String(item.expenseId),
    purpose: item.purpose,
    costDate: formatDateOnly(item.costDate),
    quantity: Number(item.quantity),
    perQtyAmount: Number(item.perQtyAmount),
    totalAmount: Number(item.totalAmount),
    receiptUrl: item.receiptFileUrl || null,
    receiptOriginalFileName: item.receiptOriginalFileName || null,
    hasReceipt: Boolean(item.receiptFileUrl),
    vendorId: item.vendorId ? String(item.vendorId) : null,
    vendorName: item.vendor?.name || null,
    paymentStatus: item.paymentStatus || null,
    settlesItemId: item.settlesItemId ? String(item.settlesItemId) : null,
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
  };
}

export function serializeAdminExpense(expense) {
  const recordedTotalAmount = Number(expense.totalAmount);
  const walletDeductionAmount = Number(expense.walletDeductionAmount);
  return {
    id: String(expense.id),
    employeeId: expense.employeeId ? String(expense.employeeId) : null,
    employeeName: expense.employee?.fullName || null,
    costType: expense.costType,
    linkedRowKey: expense.linkedRowKey,
    eventClientName: expense.eventClientNameSnapshot || null,
    eventDate: formatDateOnly(expense.eventDateSnapshot),
    recordedTotalAmount,
    walletDeductionAmount,
    vendorPayableAmount: roundMoney(recordedTotalAmount - walletDeductionAmount),
    paymentSource: expense.paymentSource,
    status: expense.status,
    voidReason: expense.voidReason || null,
    voidedByName: expense.voidedByAdmin?.fullName || null,
    voidedAt: expense.voidedAt ? formatDateTime(expense.voidedAt) : null,
    createdByAdminName: expense.createdByAdmin?.fullName || null,
    createdAt: formatDateTime(expense.createdAt),
    updatedAt: formatDateTime(expense.updatedAt),
    wasEdited: expense.updatedAt && expense.createdAt
      ? new Date(expense.updatedAt).getTime() - new Date(expense.createdAt).getTime() > 1000
      : false,
    items: (expense.items || []).map(serializeAdminExpenseItem),
  };
}

export function serializeAdminMoneyIn(entry) {
  return {
    id: String(entry.id),
    employeeId: entry.employeeId ? String(entry.employeeId) : null,
    employeeName: entry.employee?.fullName || null,
    amount: Number(entry.amount),
    receivedDate: formatDateOnly(entry.receivedDate),
    note: entry.note || "",
    source: entry.source,
    createdByAdminName: entry.createdByAdmin?.fullName || null,
    status: entry.status,
    voidReason: entry.voidReason || null,
    voidedByName: entry.voidedByAdmin?.fullName || null,
    voidedAt: entry.voidedAt ? formatDateTime(entry.voidedAt) : null,
    createdAt: formatDateTime(entry.createdAt),
    updatedAt: formatDateTime(entry.updatedAt),
    wasEdited: entry.updatedAt && entry.createdAt
      ? new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 1000
      : false,
  };
}

export function serializeAdminVendor(vendor) {
  return {
    id: String(vendor.id),
    name: vendor.name,
    category: vendor.category || null,
    contactName: vendor.contactName || null,
    contactPhone: vendor.contactPhone || null,
    contactEmail: vendor.contactEmail || null,
    notes: vendor.notes || null,
    isActive: Boolean(vendor.isActive),
    currentBalance: vendor.balance ? Number(vendor.balance.currentBalance) : 0,
    createdAt: formatDateTime(vendor.createdAt),
    updatedAt: formatDateTime(vendor.updatedAt),
  };
}

export function serializeAuditLog(entry) {
  return {
    id: String(entry.id),
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    action: entry.action,
    adminName: entry.admin?.fullName || null,
    employeeId: entry.employeeId ? String(entry.employeeId) : null,
    vendorId: entry.vendorId ? String(entry.vendorId) : null,
    reason: entry.reason,
    beforeData: entry.beforeData ?? null,
    afterData: entry.afterData ?? null,
    createdAt: formatDateTime(entry.createdAt),
  };
}

// Only active rows ever count toward balances or totals; voided rows stay
// readable but are financially neutral.
export const ACTIVE_ONLY = { status: "active" };

/*
|--------------------------------------------------------------------------
| Explicit bill settlement
|--------------------------------------------------------------------------
*/

// Validates a "which bill does this payment settle?" reference before it's
// stored — must be a real, active, still-outstanding "to_pay" item for the
// SAME vendor. Returns { settlesItemId: BigInt|null } or { error }.
export async function resolveSettlementTarget(vendorId, rawSettlesItemId) {
  if (rawSettlesItemId === undefined || rawSettlesItemId === null || rawSettlesItemId === "") {
    return { settlesItemId: null };
  }
  let candidateId;
  try {
    candidateId = BigInt(rawSettlesItemId);
  } catch {
    return { error: "Invalid bill reference." };
  }
  const target = await prisma.accountExpenseItem.findUnique({
    where: { id: candidateId },
    select: { id: true, vendorId: true, paymentStatus: true, expense: { select: { status: true } } },
  });
  if (
    !target ||
    !target.vendorId ||
    String(target.vendorId) !== String(vendorId) ||
    target.paymentStatus !== "to_pay" ||
    target.expense.status !== "active"
  ) {
    return { error: "That bill is no longer available to settle." };
  }
  return { settlesItemId: target.id };
}

// Every still-outstanding "to_pay" bill for one vendor — powers the
// "Which bill is this payment settling?" picker on both panels.
export async function listVendorOutstandingBills(vendorId) {
  const items = await prisma.accountExpenseItem.findMany({
    where: { vendorId, expense: ACTIVE_ONLY },
    select: {
      id: true,
      purpose: true,
      costDate: true,
      totalAmount: true,
      paymentStatus: true,
      settlesItemId: true,
      expense: { select: { costType: true, eventClientNameSnapshot: true } },
    },
  });

  const remainingById = computeVendorOutstandingBills(
    items.map((item) => ({
      id: item.id,
      vendorId,
      paymentStatus: item.paymentStatus,
      totalAmount: item.totalAmount,
      settlesItemId: item.settlesItemId,
    })),
  );

  return items
    .filter((item) => item.paymentStatus === "to_pay" && remainingById.has(String(item.id)))
    .map((item) => ({
      id: String(item.id),
      purpose: item.purpose,
      costDate: formatDateOnly(item.costDate),
      costType: item.expense.costType,
      eventClientName: item.expense.eventClientNameSnapshot || null,
      originalAmount: Number(item.totalAmount),
      stillOwed: remainingById.get(String(item.id)),
    }))
    .sort((a, b) => Number(b.id) - Number(a.id));
}
