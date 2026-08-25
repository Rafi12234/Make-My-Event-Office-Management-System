import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main backend project's src/ - not at a fixed relative depth once deployed
// (production's layout doesn't mirror this repo's nesting), so BACKEND_SRC_DIR
// lets deployment point at wherever it actually lands; local dev falls back
// to the real repo-relative path. See server.js's matching ACCOUNTS_BACKEND_DIR.
const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

const { prisma } = await import(
  pathToFileURL(path.join(backendSrcDirectory, "config/prisma.js")).href
);
const { formatDateOnly, formatDateTime, parseDateOnly } = await import(
  pathToFileURL(path.join(backendSrcDirectory, "utils/dbDates.js")).href
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
  };
}

function serializeExpense(expense) {
  return {
    id: expense.id,
    costType: expense.costType,
    linkedRowKey: expense.linkedRowKey,
    eventClientName: expense.eventClientNameSnapshot || null,
    eventDate: formatDateOnly(expense.eventDateSnapshot),
    totalAmount: Number(expense.totalAmount),
    createdAt: formatDateTime(expense.createdAt),
    items: (expense.items || []).map(serializeExpenseItem),
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
        include: { items: { orderBy: { id: "asc" } } },
        orderBy: { id: "desc" },
      }),
    ]);

    res.json({
      data: {
        currentBalance: wallet ? Number(wallet.currentBalance) : 0,
        moneyReceived: moneyReceived.map(serializeMoneyReceived),
        expenses: expenses.map(serializeExpense),
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
        };
      })
      .filter(Boolean)
      // Only upcoming confirmed events belong in the Event Based Cost picker — past events are excluded.
      .filter((event) => event.eventDate && event.eventDate >= todayStr);

    res.json({ data: events });
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
      });
    }

    const grandTotal = roundMoney(preparedItems.reduce((sum, item) => sum + item.totalAmount, 0));

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.accountExpense.create({
        data: {
          employeeId,
          costType,
          linkedRowKey,
          eventClientNameSnapshot: eventSnapshot?.clientName || null,
          eventDateSnapshot: eventSnapshot?.eventDate || null,
          totalAmount: grandTotal,
          items: { create: preparedItems },
        },
        include: { items: { orderBy: { id: "asc" } } },
      });

      await tx.accountWallet.upsert({
        where: { employeeId },
        create: { employeeId, currentBalance: -grandTotal },
        update: { currentBalance: { decrement: grandTotal } },
      });

      return created;
    });

    const wallet = await prisma.accountWallet.findUnique({ where: { employeeId } });

    res.status(201).json({
      data: {
        expense: serializeExpense(expense),
        currentBalance: Number(wallet.currentBalance),
      },
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    next(error);
  }
}
