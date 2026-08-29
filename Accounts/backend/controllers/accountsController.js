import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main backend project's src/ - not at a fixed relative depth once deployed
// (production's layout doesn't mirror this repo's nesting), so BACKEND_SRC_DIR
// lets deployment point at wherever it actually lands; local dev falls back
// to the real repo-relative path. See server.js's matching ACCOUNTS_BACKEND_DIR.
// Loaded via require() (not import()) - see server.js for why top-level
// await must be avoided anywhere in this module graph.
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
const { formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);

/*
|--------------------------------------------------------------------------
| Uploaded cash receipt storage
|--------------------------------------------------------------------------
|
| Lives inside this Accounts/backend folder (not the main backend's
| "uploads" directory) per the module's own upload root, mirroring the
| main backend's meeting-images convention: a dedicated backend-owned
| folder, never touched by the frontend build/deploy step.
*/

export const uploadsRootDirectory = path.resolve(__dirname, "../uploads");
export const receiptsDirectory = path.join(
  uploadsRootDirectory,
  "expense-receipts",
);

mkdirSync(receiptsDirectory, { recursive: true });

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, receiptsDirectory);
  },
  filename(req, file, callback) {
    const extension = ALLOWED_IMAGE_TYPES[file.mimetype] || "";
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per receipt image
    files: 30,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return callback(
        new Error("Only JPG, PNG, GIF, or WEBP images are allowed."),
      );
    }
    callback(null, true);
  },
});

// Receipt files are sent with per-item field names ("receipt_0",
// "receipt_1", ...) since each of the 7-column table's rows has its own
// optional, independent receipt upload — upload.any() accepts them all in
// one request regardless of field name, matched back to their item by
// index in the controller below.
export function uploadReceiptsMiddleware(req, res, next) {
  upload.any()(req, res, (error) => {
    if (error) {
      return res.status(422).json({
        message: error.message || "Receipt upload failed.",
      });
    }
    next();
  });
}

function removeUploadedFiles(files) {
  for (const file of files || []) {
    unlink(file.path, () => {});
  }
}

function isValidRowKey(rowKey) {
  return /^[0-9a-fA-F-]{36}$/.test(String(rowKey || ""));
}

// ─── Helpers ────────────────────────────────────────────────────

async function getDefaultSheetId() {
  const sheet = await prisma.managementSheet.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return sheet?.id || null;
}

// Confirmed events are sourced from ClientFinalization (the same
// Confirm & Finalize source of truth used elsewhere in the app), NOT the
// sheet's "already booked" or "booked from MME" display flags — those are
// derived UI badges, not the authoritative confirmation record.
async function getConfirmedEventSnapshot(rowKey) {
  const finalization = await prisma.clientFinalization.findUnique({
    where: { linkedRowKey: rowKey },
    select: { linkedRowKey: true },
  });
  if (!finalization) return null;

  const sheetId = await getDefaultSheetId();
  if (!sheetId) return null;

  const row = await prisma.sheetRow.findFirst({
    where: { sheetId, rowKey },
    select: {
      cells: {
        where: { column: { columnName: { in: ["Client Name", "Event Date"] } } },
        select: {
          valueText: true,
          displayValue: true,
          valueDate: true,
          column: { select: { columnName: true } },
        },
      },
    },
  });

  const clientNameCell = row?.cells.find((cell) => cell.column.columnName === "Client Name");
  const eventDateCell = row?.cells.find((cell) => cell.column.columnName === "Event Date");

  return {
    clientName: clientNameCell?.valueText || clientNameCell?.displayValue || "",
    eventDate: eventDateCell?.valueDate || null,
  };
}

function serializeMoneyReceived(entry) {
  return {
    id: entry.id,
    amount: Number(entry.amount),
    receivedDate: formatDateOnly(entry.receivedDate),
    note: entry.note || "",
    createdAt: formatDateTime(entry.createdAt),
  };
}

function serializeExpenseItem(item) {
  return {
    id: item.id,
    purpose: item.purpose,
    updatedTime: formatDateTime(item.createdAt),
    costDate: formatDateOnly(item.costDate),
    quantity: Number(item.quantity),
    perQtyAmount: Number(item.perQtyAmount),
    totalAmount: Number(item.totalAmount),
    receiptUrl: item.receiptFileUrl || null,
    receiptOriginalFileName: item.receiptOriginalFileName || null,
    vendorId: item.vendorId ? String(item.vendorId) : null,
    vendorName: item.vendor?.name || null,
    paymentStatus: item.paymentStatus || null,
  };
}

function serializeVendor(vendor) {
  return {
    id: String(vendor.id),
    name: vendor.name,
    category: vendor.category || null,
    isActive: Boolean(vendor.isActive),
    currentBalance: vendor.balance ? Number(vendor.balance.currentBalance) : 0,
  };
}

// A "To Pay" vendor item is an order placed, not money actually spent yet —
// it must never count toward the Expenses history or the total-spent figure.
// This filters those out and recomputes the total from what's left, so a
// submission that's entirely "to pay" has nothing to show here at all
// (returns null — see the vendor-payments list below for where it does show).
function serializeExpenseForHistory(expense) {
  const paidItems = (expense.items || []).filter(
    (item) => !(item.vendorId && item.paymentStatus === "to_pay"),
  );
  if (paidItems.length === 0) return null;

  const recordedTotalAmount = Number(expense.totalAmount);
  const walletDeductionAmount = Number(expense.walletDeductionAmount);

  return {
    id: expense.id,
    costType: expense.costType,
    linkedRowKey: expense.linkedRowKey,
    eventClientName: expense.eventClientNameSnapshot || null,
    eventDate: formatDateOnly(expense.eventDateSnapshot),
    totalAmount: roundMoney(paidItems.reduce((sum, item) => sum + Number(item.totalAmount), 0)),
    // Unambiguous audit fields for future reporting: recordedTotalAmount is
    // the full submitted cost, walletDeductionAmount is what actually left
    // the wallet, vendorPayableAmount is what's still owed to vendors.
    recordedTotalAmount,
    walletDeductionAmount,
    vendorPayableAmount: roundMoney(recordedTotalAmount - walletDeductionAmount),
    createdAt: formatDateTime(expense.createdAt),
    items: paidItems.map(serializeExpenseItem),
  };
}

// One row per vendor-linked item (both "to_pay" and "paid") for the History
// page's dedicated Vendor Payment tab — this is the only place a "to_pay"
// item is ever shown to the employee.
function serializeVendorPaymentEntry(item, expense) {
  return {
    id: item.id,
    purpose: item.purpose,
    costType: expense.costType,
    eventClientName: expense.eventClientNameSnapshot || null,
    costDate: formatDateOnly(item.costDate),
    totalAmount: Number(item.totalAmount),
    paymentStatus: item.paymentStatus,
    vendorId: item.vendorId ? String(item.vendorId) : null,
    vendorName: item.vendor?.name || null,
    createdAt: formatDateTime(item.createdAt),
  };
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// ─── GET /api/accounts/summary ─────────────────────────────────

export async function getSummary(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);

    const [wallet, moneyReceived, expenses] = await Promise.all([
      prisma.accountWallet.findUnique({ where: { employeeId } }),
      prisma.accountMoneyReceived.findMany({
        where: { employeeId },
        orderBy: { id: "desc" },
      }),
      prisma.accountExpense.findMany({
        where: { employeeId },
        include: { items: { include: { vendor: true }, orderBy: { id: "asc" } } },
        orderBy: { id: "desc" },
      }),
    ]);

    res.json({
      data: {
        currentBalance: wallet ? Number(wallet.currentBalance) : 0,
        moneyReceived: moneyReceived.map(serializeMoneyReceived),
        expenses: expenses.map(serializeExpenseForHistory).filter(Boolean),
        vendorPayments: expenses
          .flatMap((expense) =>
            expense.items
              .filter((item) => item.vendorId)
              .map((item) => serializeVendorPaymentEntry(item, expense)),
          )
          .sort((a, b) => Number(b.id) - Number(a.id)),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/accounts/booked-events ───────────────────────────

export async function listBookedEvents(req, res, next) {
  try {
    const finalizations = await prisma.clientFinalization.findMany({
      select: { linkedRowKey: true },
      orderBy: { finalizedAt: "desc" },
    });

    if (!finalizations.length) {
      return res.json({ data: [] });
    }

    const sheetId = await getDefaultSheetId();
    if (!sheetId) {
      return res.json({ data: [] });
    }

    const rowKeys = finalizations.map((entry) => entry.linkedRowKey);
    const rows = await prisma.sheetRow.findMany({
      where: { sheetId, rowKey: { in: rowKeys } },
      select: {
        rowKey: true,
        cells: {
          where: { column: { columnName: { in: ["Client Name", "Event Date"] } } },
          select: {
            valueText: true,
            displayValue: true,
            valueDate: true,
            // Both flags live on the "Event Date" cell only.
            alreadyBooked: true,
            bookedFromMme: true,
            column: { select: { columnName: true } },
          },
        },
      },
    });

    const rowByKey = new Map(rows.map((row) => [row.rowKey, row]));
    const todayStr = formatDateOnly(new Date());

    const events = rowKeys
      .map((rowKey) => {
        const row = rowByKey.get(rowKey);
        if (!row) return null;

        const clientNameCell = row.cells.find((cell) => cell.column.columnName === "Client Name");
        const eventDateCell = row.cells.find((cell) => cell.column.columnName === "Event Date");

        return {
          rowKey,
          clientName: clientNameCell?.valueText || clientNameCell?.displayValue || "",
          eventDate: formatDateOnly(eventDateCell?.valueDate),
          bookedFromMme: Boolean(eventDateCell?.bookedFromMme),
          alreadyBooked: Boolean(eventDateCell?.alreadyBooked),
        };
      })
      .filter(Boolean)
      // Booked through us only: ClientFinalization already means "confirmed
      // & finalized with us" (which is what flips bookedFromMme), so rows
      // flagged as booked with another company are excluded.
      .filter((event) => event.bookedFromMme && !event.alreadyBooked)
      // Costs are logged against events that have not happened yet.
      .filter((event) => event.eventDate && event.eventDate >= todayStr)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .map(({ rowKey, clientName, eventDate }) => ({ rowKey, clientName, eventDate }));

    res.json({ data: events });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/accounts/vendors ──────────────────────────────────

// Every employee can view + transact against vendors (per the module's
// design) — only Admin can create/deactivate them, so this list is
// read-only here regardless of who calls it.
export async function listVendors(req, res, next) {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      include: { balance: true },
      orderBy: { name: "asc" },
    });

    res.json({ data: vendors.map(serializeVendor) });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/accounts/vendors/:id ─────────────────────────────

// Vendor profile: current shared balance + full transaction history
// (every AccountExpenseItem ever booked against this vendor, across all
// employees — the balance is company-wide, not per-employee).
export async function getVendorProfile(req, res, next) {
  try {
    const vendorId = BigInt(req.params.id);

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { balance: true },
    });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    const items = await prisma.accountExpenseItem.findMany({
      where: { vendorId },
      include: {
        expense: {
          select: {
            costType: true,
            eventClientNameSnapshot: true,
            eventDateSnapshot: true,
            employee: { select: { fullName: true } },
          },
        },
      },
      orderBy: { id: "desc" },
    });

    const transactions = items.map((item) => ({
      id: item.id,
      purpose: item.purpose,
      costDate: formatDateOnly(item.costDate),
      totalAmount: Number(item.totalAmount),
      paymentStatus: item.paymentStatus,
      costType: item.expense.costType,
      eventClientName: item.expense.eventClientNameSnapshot || null,
      employeeName: item.expense.employee?.fullName || "—",
      createdAt: formatDateTime(item.createdAt),
    }));

    res.json({
      data: {
        vendor: serializeVendor(vendor),
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/accounts/vendors/:id/pay ────────────────────────

// Records a real-world payment made to a vendor to settle (part of) an
// outstanding balance. Modeled as a single "regular" expense item tied to
// this vendor with paymentStatus "paid" — the same wallet-deduct +
// vendor-balance-credit rules as logging a paid cost, without the full
// item form. Shows up in both the Expenses history and the Vendor
// Payments tab, same as any other paid vendor item would.
export async function payVendor(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const vendorId = BigInt(req.params.id);
    const amount = roundMoney(Number(req.body.amount));
    const paidOn = parseDateOnly(req.body.paidOn) || new Date();
    const note = String(req.body.note || "").trim().slice(0, 190);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({ message: "Enter a valid amount greater than 0." });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || !vendor.isActive) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.accountExpense.create({
        data: {
          employeeId,
          costType: "regular",
          totalAmount: amount,
          walletDeductionAmount: amount,
          items: {
            create: [
              {
                purpose: note || `Payment to ${vendor.name}`,
                costDate: paidOn,
                quantity: 1,
                perQtyAmount: amount,
                totalAmount: amount,
                vendorId,
                paymentStatus: "paid",
              },
            ],
          },
        },
      });

      await tx.accountWallet.upsert({
        where: { employeeId },
        create: { employeeId, currentBalance: -amount },
        update: { currentBalance: { decrement: amount } },
      });

      await tx.vendorBalance.upsert({
        where: { vendorId },
        create: { vendorId, currentBalance: amount },
        update: { currentBalance: { increment: amount } },
      });
    });

    const [updatedVendor, wallet] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: vendorId }, include: { balance: true } }),
      prisma.accountWallet.findUnique({ where: { employeeId } }),
    ]);

    res.status(201).json({
      data: {
        vendor: serializeVendor(updatedVendor),
        currentBalance: wallet ? Number(wallet.currentBalance) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/accounts/money-received ─────────────────────────

export async function createMoneyReceived(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const amount = roundMoney(Number(req.body.amount));
    const receivedDate = parseDateOnly(req.body.receivedDate);
    const note = String(req.body.note || "").trim().slice(0, 255) || null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({ message: "Enter a valid amount greater than 0." });
    }
    if (!receivedDate) {
      return res.status(422).json({ message: "Received date is required." });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.accountMoneyReceived.create({
        data: { employeeId, amount, receivedDate, note },
      });

      await tx.accountWallet.upsert({
        where: { employeeId },
        create: { employeeId, currentBalance: amount },
        update: { currentBalance: { increment: amount } },
      });

      return created;
    });

    const wallet = await prisma.accountWallet.findUnique({ where: { employeeId } });

    res.status(201).json({
      data: {
        entry: serializeMoneyReceived(entry),
        currentBalance: Number(wallet.currentBalance),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/accounts/expenses ───────────────────────────────

export async function createExpense(req, res, next) {
  try {
    const employeeId = BigInt(req.employee.id);
    const costType = ["event", "regular"].includes(req.body.costType) ? req.body.costType : null;

    if (!costType) {
      removeUploadedFiles(req.files);
      return res.status(422).json({ message: "costType must be 'event' or 'regular'." });
    }

    let items;
    try {
      items = JSON.parse(req.body.items || "[]");
    } catch {
      items = null;
    }

    if (!Array.isArray(items) || items.length === 0) {
      removeUploadedFiles(req.files);
      return res.status(422).json({ message: "At least one expense item is required." });
    }

    let eventSnapshot = null;
    const linkedRowKey = costType === "event" ? String(req.body.linkedRowKey || "") : null;

    if (costType === "event") {
      if (!isValidRowKey(linkedRowKey)) {
        removeUploadedFiles(req.files);
        return res.status(422).json({ message: "Select a confirmed event." });
      }

      eventSnapshot = await getConfirmedEventSnapshot(linkedRowKey);
      if (!eventSnapshot) {
        removeUploadedFiles(req.files);
        return res.status(404).json({ message: "That event is not a confirmed booked event." });
      }
    }

    const filesByIndex = new Map();
    for (const file of req.files || []) {
      const match = /^receipt_(\d+)$/.exec(file.fieldname);
      if (match) filesByIndex.set(Number(match[1]), file);
    }

    // Collect every vendorId referenced by an item up front so each one can
    // be validated (exists + still active) in a single query below, instead
    // of one query per item.
    const referencedVendorIds = [
      ...new Set(
        items
          .map((rawItem) => String(rawItem.vendorId || "").trim())
          .filter((id) => /^\d+$/.test(id)),
      ),
    ];

    let activeVendorsById = new Map();
    if (referencedVendorIds.length) {
      const vendors = await prisma.vendor.findMany({
        where: { id: { in: referencedVendorIds.map(BigInt) }, isActive: true },
      });
      activeVendorsById = new Map(vendors.map((vendor) => [vendor.id.toString(), vendor]));
    }

    const preparedItems = [];
    for (const [index, rawItem] of items.entries()) {
      const purpose = String(rawItem.purpose || "").trim().slice(0, 190);
      const costDate = parseDateOnly(rawItem.costDate);
      const quantity = Number(rawItem.quantity);
      const perQtyAmount = Number(rawItem.perQtyAmount);

      if (
        !purpose ||
        !costDate ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(perQtyAmount) ||
        perQtyAmount < 0
      ) {
        removeUploadedFiles(req.files);
        return res.status(422).json({ message: `Item ${index + 1} is missing required fields.` });
      }

      const rawVendorId = String(rawItem.vendorId || "").trim();
      let vendorId = null;
      let paymentStatus = null;

      if (rawVendorId) {
        const vendor = activeVendorsById.get(rawVendorId);
        if (!vendor) {
          removeUploadedFiles(req.files);
          return res.status(422).json({ message: `Item ${index + 1} has an invalid or inactive vendor.` });
        }
        if (!["to_pay", "paid"].includes(rawItem.paymentStatus)) {
          removeUploadedFiles(req.files);
          return res.status(422).json({ message: `Item ${index + 1} needs a payment status (To Pay or Paid).` });
        }
        vendorId = vendor.id;
        paymentStatus = rawItem.paymentStatus;
      }

      const receiptFile = filesByIndex.get(index);

      preparedItems.push({
        purpose,
        costDate,
        quantity,
        perQtyAmount,
        totalAmount: roundMoney(quantity * perQtyAmount),
        receiptStoredFileName: receiptFile?.filename || null,
        receiptOriginalFileName: receiptFile ? receiptFile.originalname.slice(0, 255) : null,
        receiptFileUrl: receiptFile ? `/accounts-uploads/expense-receipts/${receiptFile.filename}` : null,
        receiptFileSizeBytes: receiptFile?.size || null,
        vendorId,
        paymentStatus,
      });
    }

    const grandTotal = roundMoney(preparedItems.reduce((sum, item) => sum + item.totalAmount, 0));

    // "To Pay" vendor items are a liability only — no cash has left the
    // wallet yet, so they're excluded from the wallet deduction. Every
    // other item (no vendor, or vendor+"paid") deducts as before.
    const walletDeduction = roundMoney(
      preparedItems.reduce((sum, item) => {
        if (item.vendorId && item.paymentStatus === "to_pay") return sum;
        return sum + item.totalAmount;
      }, 0),
    );

    // Per-vendor ledger deltas: "to_pay" increases what we owe (balance
    // goes down), "paid" settles/advances against that vendor (balance
    // goes up) — a "paid" item can legitimately mean an advance payment to
    // the vendor, so a positive vendor balance is valid business behavior.
    // Keyed by vendorId string since BigInt can't be a Map key comparison
    // target reliably across references.
    const vendorBalanceDeltas = new Map();
    for (const item of preparedItems) {
      if (!item.vendorId) continue;
      const key = item.vendorId.toString();
      const delta = item.paymentStatus === "paid" ? item.totalAmount : -item.totalAmount;
      vendorBalanceDeltas.set(key, roundMoney((vendorBalanceDeltas.get(key) || 0) + delta));
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.accountExpense.create({
        data: {
          employeeId,
          costType,
          linkedRowKey,
          eventClientNameSnapshot: eventSnapshot?.clientName || null,
          eventDateSnapshot: eventSnapshot?.eventDate || null,
          totalAmount: grandTotal,
          walletDeductionAmount: walletDeduction,
          items: { create: preparedItems },
        },
        include: { items: { include: { vendor: true }, orderBy: { id: "asc" } } },
      });

      await tx.accountWallet.upsert({
        where: { employeeId },
        create: { employeeId, currentBalance: -walletDeduction },
        update: { currentBalance: { decrement: walletDeduction } },
      });

      for (const [vendorIdKey, delta] of vendorBalanceDeltas) {
        await tx.vendorBalance.upsert({
          where: { vendorId: BigInt(vendorIdKey) },
          create: { vendorId: BigInt(vendorIdKey), currentBalance: delta },
          update: { currentBalance: { increment: delta } },
        });
      }

      return created;
    });

    const wallet = await prisma.accountWallet.findUnique({ where: { employeeId } });

    res.status(201).json({
      data: {
        // A submission that's entirely "to pay" has no paid portion yet, so
        // there's nothing to add to the Expenses tab or its running total.
        expense: serializeExpenseForHistory(expense),
        vendorPayments: expense.items
          .filter((item) => item.vendorId)
          .map((item) => serializeVendorPaymentEntry(item, expense)),
        currentBalance: Number(wallet.currentBalance),
      },
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    next(error);
  }
}
