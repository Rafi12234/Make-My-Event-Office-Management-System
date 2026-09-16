// Money Receipt Generator module — HTTP layer (Admin-only). Mirrors
// PDFGenerator/backend/controllers/pdfGeneratorController.js's conventions
// (BigInt ids stringified for JSON, res.status(422) for validation errors,
// try/catch + next(error) for anything unexpected) but is otherwise fully
// independent — no PDF Generator code is imported here.
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { generateMoneyReceiptPdf } from "../services/moneyReceiptGeneratorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main backend project's src/ — see PDFGenerator/backend/controllers/
// pdfGeneratorController.js for why this is resolved via BACKEND_SRC_DIR
// (production's directory layout doesn't mirror this repo's nesting) with
// a local-dev fallback, loaded via require() to avoid top-level await.
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(__dirname, "../../../backend/mme_node_express_backend/src");

const { prisma } = require(path.join(backendSrcDirectory, "config/prisma.js"));
const { formatDateOnly, formatDateTime, parseDateOnly } = require(
  path.join(backendSrcDirectory, "utils/dbDates.js"),
);
// Reused for the confirmed-clients autocomplete below — same cell-value
// extraction rules the main workspace/admin tables already use.
const { cellValue } = require(path.join(backendSrcDirectory, "controllers/workspaceController.js"));

const storageRootDirectory = process.env.MONEY_RECEIPT_STORAGE_DIR
  ? path.resolve(process.env.MONEY_RECEIPT_STORAGE_DIR)
  : path.resolve(__dirname, "../storage");

const generatedDirectory = path.join(storageRootDirectory, "generated");
mkdirSync(generatedDirectory, { recursive: true });

const VALID_PAYMENT_METHODS = new Set(["cash", "bank_transfer", "cheque", "bkash", "nagad", "card", "other"]);
const VALID_BOOKING_STATUSES = new Set(["confirmed", "not_confirmed"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A column's columnKey is NOT a stable slug (e.g. "client_name") — it can be
// a randomly-generated UUID if the column was ever recreated, same reason
// meetingsController.js's setBookedFromMme matches by columnName ("Event
// Date"), never by columnKey. Match these the same way, by exact
// (case-insensitive) display name, not by columnKey/id.
const CLIENT_LOOKUP_COLUMN_NAMES = {
  clientName: "client name",
  clientPhone: "client phone number",
  eventDate: "event date",
  venue: "venue",
};

/*
|--------------------------------------------------------------------------
| Shared request parsing/validation + server-side financial recalculation
|--------------------------------------------------------------------------
|
| Never trusts a client-supplied duePayment/paymentStatus — both are always
| recomputed here from totalPayment/advancePayment. All money math is done
| in integer paisa to avoid floating-point precision issues, then converted
| back to a fixed 2-decimal STRING before it ever reaches Prisma (Decimal
| columns accept strings, which avoids float round-trip entirely).
*/
function toPaisa(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function paisaToAmountString(paisa) {
  return (paisa / 100).toFixed(2);
}

function parseReceiptPayload(body) {
  const {
    receiptDate,
    clientName,
    clientPhone,
    clientEmail,
    clientAddress,
    billedTo,
    eventName,
    eventDate,
    eventVenue,
    bookingReference,
    bookingStatus,
    totalPayment,
    advancePayment,
    paymentMethod,
    paymentMethodOther,
    transactionReference,
    remarks,
  } = body || {};

  if (!receiptDate || Number.isNaN(new Date(receiptDate).getTime())) {
    return { error: "A valid receipt date is required." };
  }

  const trimmedClientName = String(clientName || "").trim();
  if (!trimmedClientName) return { error: "Client name is required." };

  const trimmedClientPhone = String(clientPhone || "").trim();
  if (!trimmedClientPhone) return { error: "Client phone number is required." };

  const trimmedEmail = clientEmail ? String(clientEmail).trim() : "";
  if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
    return { error: "Please provide a valid client email address." };
  }

  let parsedEventDate = null;
  if (eventDate) {
    if (Number.isNaN(new Date(eventDate).getTime())) {
      return { error: "Please provide a valid event date." };
    }
    parsedEventDate = parseDateOnly(String(eventDate).slice(0, 10));
  }

  const totalPaisa = toPaisa(totalPayment);
  if (totalPaisa === null || totalPaisa < 0) {
    return { error: "Total payment must be a valid non-negative amount." };
  }

  const advancePaisa = toPaisa(advancePayment);
  if (advancePaisa === null || advancePaisa < 0) {
    return { error: "Advance payment must be a valid non-negative amount." };
  }

  if (advancePaisa > totalPaisa) {
    return { error: "Advance payment cannot exceed the total payment." };
  }

  const duePaisa = totalPaisa - advancePaisa;

  const method = VALID_PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : "cash";
  const trimmedMethodOther = method === "other" ? String(paymentMethodOther || "").trim() : "";
  if (method === "other" && !trimmedMethodOther) {
    return { error: 'Please specify the payment method when "Other" is selected.' };
  }

  const paymentStatus = advancePaisa === 0 ? "unpaid" : duePaisa === 0 ? "paid" : "partially_paid";

  const resolvedBookingStatus = VALID_BOOKING_STATUSES.has(bookingStatus) ? bookingStatus : "not_confirmed";

  return {
    data: {
      receiptDate: parseDateOnly(String(receiptDate).slice(0, 10)),
      clientName: trimmedClientName,
      clientPhone: trimmedClientPhone,
      clientEmail: trimmedEmail || null,
      clientAddress: clientAddress ? String(clientAddress).trim() || null : null,
      billedTo: billedTo ? String(billedTo).trim() || null : null,
      eventName: eventName ? String(eventName).trim() || null : null,
      eventDate: parsedEventDate,
      eventVenue: eventVenue ? String(eventVenue).trim() || null : null,
      bookingReference: bookingReference ? String(bookingReference).trim() || null : null,
      bookingStatus: resolvedBookingStatus,
      totalPayment: paisaToAmountString(totalPaisa),
      advancePayment: paisaToAmountString(advancePaisa),
      duePayment: paisaToAmountString(duePaisa),
      paymentMethod: method,
      paymentMethodOther: trimmedMethodOther || null,
      transactionReference: transactionReference ? String(transactionReference).trim() || null : null,
      paymentStatus,
      remarks: remarks ? String(remarks).trim() || null : null,
    },
  };
}

function toRendererPayload(data, receiptNo) {
  return {
    receiptNo,
    receiptDate: data.receiptDate,
    client: {
      name: data.clientName,
      phone: data.clientPhone,
      email: data.clientEmail,
      address: data.clientAddress,
      billedTo: data.billedTo,
    },
    event: {
      name: data.eventName,
      date: data.eventDate,
      venue: data.eventVenue,
      bookingReference: data.bookingReference,
      bookingStatus: data.bookingStatus,
    },
    payment: {
      total: data.totalPayment,
      advance: data.advancePayment,
      due: data.duePayment,
      method: data.paymentMethod,
      methodOther: data.paymentMethodOther,
      transactionReference: data.transactionReference,
      status: data.paymentStatus,
    },
    remarks: data.remarks,
  };
}

function serializeReceipt(receipt) {
  return {
    id: String(receipt.id),
    receiptNo: receipt.receiptNo,
    receiptDate: formatDateOnly(receipt.receiptDate),
    clientName: receipt.clientName,
    clientPhone: receipt.clientPhone,
    clientEmail: receipt.clientEmail,
    clientAddress: receipt.clientAddress,
    billedTo: receipt.billedTo,
    eventName: receipt.eventName,
    eventDate: receipt.eventDate ? formatDateOnly(receipt.eventDate) : null,
    eventVenue: receipt.eventVenue,
    bookingReference: receipt.bookingReference,
    bookingStatus: receipt.bookingStatus,
    totalPayment: receipt.totalPayment.toString(),
    advancePayment: receipt.advancePayment.toString(),
    duePayment: receipt.duePayment.toString(),
    paymentMethod: receipt.paymentMethod,
    paymentMethodOther: receipt.paymentMethodOther,
    transactionReference: receipt.transactionReference,
    paymentStatus: receipt.paymentStatus,
    remarks: receipt.remarks,
    status: receipt.status,
    pageCount: receipt.pageCount,
    generatedAt: formatDateTime(receipt.generatedAt),
    createdAt: formatDateTime(receipt.createdAt),
    createdByName: receipt.createdBy?.fullName,
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/admin/money-receipts/confirmed-clients
|--------------------------------------------------------------------------
|
| Powers the Client Name autocomplete: every row on the main workspace
| sheet that's been marked "booked from MME" (bookedFromMme — the exact
| same flag ManagementPage.jsx shows as "confirmed & finalized with MME"),
| with whatever client fields the sheet actually tracks (name/phone/event
| date/venue — no email/address/booking-reference exist on that sheet).
| Registered BEFORE the "/:id" route below so it isn't swallowed by it.
*/
export async function listConfirmedClients(req, res, next) {
  try {
    const sheet = await prisma.managementSheet.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!sheet) return res.json({ data: [] });

    const allColumns = await prisma.sheetColumn.findMany({
      where: { sheetId: sheet.id, isActive: true },
      select: { id: true, columnName: true, dataType: true },
    });

    // Map each matched column's id -> our semantic key (clientName/clientPhone/etc).
    const semanticKeyByColumnId = new Map();
    const columnMetaById = new Map();
    for (const [semanticKey, targetName] of Object.entries(CLIENT_LOOKUP_COLUMN_NAMES)) {
      const column = allColumns.find((c) => c.columnName.trim().toLowerCase() === targetName);
      if (column) {
        semanticKeyByColumnId.set(column.id, semanticKey);
        columnMetaById.set(column.id, column);
      }
    }
    if (!semanticKeyByColumnId.size) return res.json({ data: [] });

    const rows = await prisma.sheetRow.findMany({
      where: { sheetId: sheet.id, isArchived: false },
      orderBy: [{ rowPosition: "asc" }, { id: "asc" }],
      select: { id: true, rowKey: true },
    });
    if (!rows.length) return res.json({ data: [] });

    const cells = await prisma.sheetCell.findMany({
      where: { rowId: { in: rows.map((row) => row.id) }, columnId: { in: [...semanticKeyByColumnId.keys()] } },
    });

    const bookedFromMmeRowIds = new Set();
    const valuesByRowId = new Map(rows.map((row) => [row.id, {}]));

    for (const cell of cells) {
      const semanticKey = semanticKeyByColumnId.get(cell.columnId);
      const columnMeta = columnMetaById.get(cell.columnId);
      if (!semanticKey || !columnMeta) continue;
      valuesByRowId.get(cell.rowId)[semanticKey] = cellValue(cell, columnMeta.dataType);
      if (cell.bookedFromMme) bookedFromMmeRowIds.add(cell.rowId);
    }

    const clients = rows
      .filter((row) => bookedFromMmeRowIds.has(row.id))
      .map((row) => {
        const values = valuesByRowId.get(row.id) || {};
        return {
          rowKey: row.rowKey,
          clientName: String(values.clientName || "").trim(),
          clientPhone: String(values.clientPhone || "").trim(),
          eventDate: values.eventDate || null,
          eventVenue: String(values.venue || "").trim(),
        };
      })
      .filter((client) => client.clientName);

    return res.json({ data: clients });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/admin/money-receipts/preview
|--------------------------------------------------------------------------
|
| Renders with the exact same renderer as final generation, but never
| touches the database or persistent storage — no receipt number is
| reserved (shows "PREVIEW" instead, see receiptRenderer.js).
*/
export async function previewMoneyReceipt(req, res, next) {
  try {
    const parsed = parseReceiptPayload(req.body);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const { bytes } = await generateMoneyReceiptPdf(toRendererPayload(parsed.data, null));

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
    });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/admin/money-receipts
|--------------------------------------------------------------------------
*/
export async function createMoneyReceipt(req, res, next) {
  let createdReceiptId = null;

  try {
    const parsed = parseReceiptPayload(req.body);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const adminId = BigInt(req.adminId);
    const data = parsed.data;

    // Create the DB row first — MySQL allocates the autoincrement id
    // immediately, even before commit, so it's safe to use it for the
    // receipt number right after (same pattern as PdfDocument.documentNo).
    const receipt = await prisma.$transaction(async (tx) => {
      const row = await tx.moneyReceipt.create({
        data: {
          receiptDate: data.receiptDate,
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          clientEmail: data.clientEmail,
          clientAddress: data.clientAddress,
          billedTo: data.billedTo,
          eventName: data.eventName,
          eventDate: data.eventDate,
          eventVenue: data.eventVenue,
          bookingReference: data.bookingReference,
          bookingStatus: data.bookingStatus,
          totalPayment: data.totalPayment,
          advancePayment: data.advancePayment,
          duePayment: data.duePayment,
          paymentMethod: data.paymentMethod,
          paymentMethodOther: data.paymentMethodOther,
          transactionReference: data.transactionReference,
          paymentStatus: data.paymentStatus,
          remarks: data.remarks,
          createdById: adminId,
          status: "generated",
        },
      });

      const year = data.receiptDate.getUTCFullYear();
      const receiptNo = `MME-MR-${year}-${String(row.id).padStart(6, "0")}`;
      await tx.moneyReceipt.update({ where: { id: row.id }, data: { receiptNo } });
      row.receiptNo = receiptNo;

      return row;
    });

    createdReceiptId = receipt.id;

    // Generate the PDF from the exact same renderer preview used.
    const { bytes, pageCount } = await generateMoneyReceiptPdf(toRendererPayload(data, receipt.receiptNo));

    const generatedFileName = `${receipt.receiptNo.replace(/\//g, "-")}.pdf`;
    await writeFile(path.join(generatedDirectory, generatedFileName), Buffer.from(bytes));

    const updated = await prisma.moneyReceipt.update({
      where: { id: receipt.id },
      data: {
        generatedFileName,
        generatedFilePath: path.join("generated", generatedFileName),
        pageCount,
        generatedAt: new Date(),
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    console.log(`Money receipt generated: receiptId=${updated.id} adminId=${adminId}`);

    return res.status(201).json({ data: serializeReceipt(updated) });
  } catch (error) {
    // Roll back the DB row if PDF generation/storage failed after it was
    // created — avoid a dangling "generated" record with no file.
    if (createdReceiptId) {
      await prisma.moneyReceipt.delete({ where: { id: createdReceiptId } }).catch(() => {});
    }
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/admin/money-receipts
|--------------------------------------------------------------------------
*/
export async function listMoneyReceipts(req, res, next) {
  try {
    const { search, paymentStatus, status, dateFrom, dateTo } = req.query;

    const where = {};
    if (search) {
      const term = String(search).trim();
      if (term) {
        where.OR = [
          { receiptNo: { contains: term } },
          { clientName: { contains: term } },
          { clientPhone: { contains: term } },
        ];
      }
    }
    if (paymentStatus && ["unpaid", "partially_paid", "paid"].includes(paymentStatus)) {
      where.paymentStatus = paymentStatus;
    }
    if (status && ["generated", "archived"].includes(status)) {
      where.status = status;
    }
    if (dateFrom || dateTo) {
      where.receiptDate = {};
      if (dateFrom && !Number.isNaN(new Date(dateFrom).getTime())) where.receiptDate.gte = new Date(dateFrom);
      if (dateTo && !Number.isNaN(new Date(dateTo).getTime())) where.receiptDate.lte = new Date(dateTo);
    }

    const receipts = await prisma.moneyReceipt.findMany({
      where,
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ data: receipts.map(serializeReceipt) });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/admin/money-receipts/:id
|--------------------------------------------------------------------------
*/
export async function getMoneyReceipt(req, res, next) {
  try {
    const receipt = await prisma.moneyReceipt.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { createdBy: { select: { fullName: true } } },
    });

    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });

    return res.json({ data: serializeReceipt(receipt) });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/admin/money-receipts/:id/download
|--------------------------------------------------------------------------
*/
export async function downloadMoneyReceipt(req, res, next) {
  try {
    const receipt = await prisma.moneyReceipt.findUnique({ where: { id: BigInt(req.params.id) } });

    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });
    if (!receipt.generatedFilePath) {
      return res.status(404).json({ message: "This receipt has not finished generating yet." });
    }

    // Never trust the stored path directly — always resolve it relative to
    // the trusted storage root, and confirm the file actually exists.
    const absolutePath = path.join(storageRootDirectory, receipt.generatedFilePath);
    if (!existsSync(absolutePath)) {
      return res.status(404).json({ message: "The generated receipt file could not be found." });
    }

    return res.download(absolutePath, receipt.generatedFileName || "money-receipt.pdf");
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| PATCH /api/admin/money-receipts/:id/archive
|--------------------------------------------------------------------------
|
| Archiving never deletes the DB row or the stored PDF — financial records
| must remain downloadable/auditable, just hidden from the active list by
| default on the frontend.
*/
export async function archiveMoneyReceipt(req, res, next) {
  try {
    const receipt = await prisma.moneyReceipt.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });

    const updated = await prisma.moneyReceipt.update({
      where: { id: receipt.id },
      data: { status: "archived" },
      include: { createdBy: { select: { fullName: true } } },
    });

    return res.json({ data: serializeReceipt(updated) });
  } catch (error) {
    return next(error);
  }
}
