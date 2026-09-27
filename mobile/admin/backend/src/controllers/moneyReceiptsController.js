import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { prisma } from "../utils/accountsShared.js";
import { generateReceiptPdf } from "../services/receiptPdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageRoot = path.resolve(__dirname, "../../storage/money-receipts");
mkdirSync(storageRoot, { recursive: true });

const VALID_METHODS = new Set([
  "cash",
  "bank_transfer",
  "cheque",
  "bkash",
  "nagad",
  "card",
  "other",
]);

const VALID_BOOKING_STATUSES = new Set(["confirmed", "not_confirmed"]);
const VALID_PAYMENT_STATUSES = new Set(["unpaid", "partially_paid", "paid"]);
const VALID_RECORD_STATUSES = new Set(["generated", "archived"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let columnsCache = null;

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toMoneyString(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function parsePayload(body = {}) {
  const receiptDate = dateOnly(body.receiptDate);
  if (!receiptDate) return { error: "A valid receipt date is required." };

  const clientName = String(body.clientName || "").trim();
  const clientPhone = String(body.clientPhone || "").trim();
  if (!clientName) return { error: "Client name is required." };
  if (!clientPhone) return { error: "Client phone number is required." };

  const clientEmail = String(body.clientEmail || "").trim();
  if (clientEmail && !EMAIL_RE.test(clientEmail)) {
    return { error: "Please provide a valid client email address." };
  }

  const eventDate = body.eventDate ? dateOnly(body.eventDate) : null;
  if (body.eventDate && !eventDate) return { error: "Please provide a valid event date." };

  const total = Number(body.totalPayment);
  const advance = Number(body.advancePayment);
  if (!Number.isFinite(total) || total < 0) {
    return { error: "Total payment must be a valid non-negative amount." };
  }
  if (!Number.isFinite(advance) || advance < 0) {
    return { error: "Advance payment must be a valid non-negative amount." };
  }
  if (advance > total) return { error: "Advance payment cannot exceed the total payment." };

  const due = Math.round((total - advance) * 100) / 100;
  const paymentStatus = advance === 0 ? "unpaid" : due === 0 ? "paid" : "partially_paid";
  const paymentMethod = VALID_METHODS.has(body.paymentMethod) ? body.paymentMethod : "cash";
  const paymentMethodOther = paymentMethod === "other" ? String(body.paymentMethodOther || "").trim() : "";
  if (paymentMethod === "other" && !paymentMethodOther) {
    return { error: 'Please specify the payment method when "Other" is selected.' };
  }

  return {
    data: {
      receiptDate,
      clientName,
      clientPhone,
      clientEmail: clientEmail || null,
      clientAddress: String(body.clientAddress || "").trim() || null,
      billedTo: String(body.billedTo || "").trim() || null,
      eventName: String(body.eventName || "").trim() || null,
      eventDate,
      eventVenue: String(body.eventVenue || "").trim() || null,
      bookingReference: String(body.bookingReference || "").trim() || null,
      bookingStatus: VALID_BOOKING_STATUSES.has(body.bookingStatus)
        ? body.bookingStatus
        : "not_confirmed",
      totalPayment: toMoneyString(total),
      advancePayment: toMoneyString(advance),
      duePayment: toMoneyString(due),
      paymentMethod,
      paymentMethodOther: paymentMethodOther || null,
      transactionReference: String(body.transactionReference || "").trim() || null,
      paymentStatus,
      remarks: String(body.remarks || "").trim() || null,
    },
  };
}

async function getReceiptColumns() {
  if (columnsCache) return columnsCache;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME AS columnName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'money_receipts'
  `);
  columnsCache = new Set(rows.map((row) => String(row.columnName)));
  return columnsCache;
}

async function getSelectSql(alias = "mr") {
  const columns = await getReceiptColumns();
  const billedTo = columns.has("billed_to") ? `${alias}.billed_to` : "NULL";
  const bookingStatus = columns.has("booking_status")
    ? `${alias}.booking_status`
    : `'not_confirmed'`;

  return `
    ${alias}.id AS id,
    ${alias}.receipt_no AS receiptNo,
    DATE_FORMAT(${alias}.receipt_date, '%Y-%m-%d') AS receiptDate,
    ${alias}.client_name AS clientName,
    ${alias}.client_phone AS clientPhone,
    ${alias}.client_email AS clientEmail,
    ${alias}.client_address AS clientAddress,
    ${billedTo} AS billedTo,
    ${alias}.event_name AS eventName,
    IFNULL(DATE_FORMAT(${alias}.event_date, '%Y-%m-%d'), NULL) AS eventDate,
    ${alias}.event_venue AS eventVenue,
    ${alias}.booking_reference AS bookingReference,
    ${bookingStatus} AS bookingStatus,
    CAST(${alias}.total_payment AS CHAR) AS totalPayment,
    CAST(${alias}.advance_payment AS CHAR) AS advancePayment,
    CAST(${alias}.due_payment AS CHAR) AS duePayment,
    ${alias}.payment_method AS paymentMethod,
    ${alias}.payment_method_other AS paymentMethodOther,
    ${alias}.transaction_reference AS transactionReference,
    ${alias}.payment_status AS paymentStatus,
    ${alias}.remarks AS remarks,
    ${alias}.status AS status,
    ${alias}.generated_file_name AS generatedFileName,
    ${alias}.generated_file_path AS generatedFilePath,
    ${alias}.page_count AS pageCount,
    ${alias}.generated_at AS generatedAt,
    ${alias}.created_at AS createdAt,
    e.full_name AS createdByName
  `;
}

function normalizeRow(row) {
  return {
    ...row,
    id: String(row.id),
    receiptDate: dateOnly(row.receiptDate),
    eventDate: dateOnly(row.eventDate),
    totalPayment: String(row.totalPayment ?? "0.00"),
    advancePayment: String(row.advancePayment ?? "0.00"),
    duePayment: String(row.duePayment ?? "0.00"),
    pageCount: row.pageCount == null ? null : Number(row.pageCount),
    generatedAt: dateTime(row.generatedAt),
    createdAt: dateTime(row.createdAt),
  };
}

async function loadReceiptById(id) {
  const selectSql = await getSelectSql("mr");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${selectSql}
     FROM money_receipts mr
     LEFT JOIN employees e ON e.id = mr.created_by
     WHERE mr.id = ?
     LIMIT 1`,
    Number(id),
  );
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function listConfirmedClients(req, res, next) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        sr.row_key AS rowKey,
        MAX(CASE WHEN LOWER(sc.column_name) = 'client name'
          THEN COALESCE(c.display_value, c.value_text, CAST(c.value_integer AS CHAR), CAST(c.value_decimal AS CHAR)) END) AS clientName,
        MAX(CASE WHEN LOWER(sc.column_name) = 'client phone number'
          THEN COALESCE(c.display_value, c.value_text, CAST(c.value_integer AS CHAR), CAST(c.value_decimal AS CHAR)) END) AS clientPhone,
        MAX(CASE WHEN LOWER(sc.column_name) = 'event date'
          THEN COALESCE(c.display_value, c.value_text, DATE_FORMAT(c.value_date, '%Y-%m-%d'), DATE_FORMAT(c.value_datetime, '%Y-%m-%d')) END) AS eventDate,
        MAX(CASE WHEN LOWER(sc.column_name) = 'venue'
          THEN COALESCE(c.display_value, c.value_text) END) AS eventVenue
      FROM sheet_rows sr
      JOIN management_sheets ms ON ms.id = sr.sheet_id
      LEFT JOIN sheet_cells c ON c.row_id = sr.id
      LEFT JOIN sheet_columns sc ON sc.id = c.column_id
      WHERE ms.is_default = 1
        AND ms.is_active = 1
        AND COALESCE(sr.is_archived, 0) = 0
        AND EXISTS (
          SELECT 1
          FROM sheet_cells marker
          WHERE marker.row_id = sr.id
            AND marker.booked_from_mme = 1
        )
      GROUP BY sr.id, sr.row_key, sr.row_position
      HAVING clientName IS NOT NULL AND TRIM(clientName) <> ''
      ORDER BY sr.row_position ASC
      LIMIT 500
    `);

    return res.json({
      data: rows.map((row) => ({
        rowKey: row.rowKey,
        clientName: String(row.clientName || ""),
        clientPhone: String(row.clientPhone || ""),
        eventDate: row.eventDate ? String(row.eventDate).slice(0, 10) : null,
        eventVenue: String(row.eventVenue || ""),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function previewMoneyReceipt(req, res, next) {
  try {
    const parsed = parsePayload(req.body);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const { bytes } = await generateReceiptPdf({
      ...parsed.data,
      receiptNo: "PREVIEW",
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="money-receipt-preview.pdf"',
      "Cache-Control": "no-store",
    });
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
}

export async function createMoneyReceipt(req, res, next) {
  let createdId = null;

  try {
    const parsed = parsePayload(req.body);
    if (parsed.error) return res.status(422).json({ message: parsed.error });

    const data = parsed.data;
    const columns = await getReceiptColumns();
    const adminId = Number(req.adminId);

    createdId = await prisma.$transaction(async (tx) => {
      const insertColumns = [
        "receipt_date",
        "client_name",
        "client_phone",
        "client_email",
        "client_address",
        "event_name",
        "event_date",
        "event_venue",
        "booking_reference",
        "total_payment",
        "advance_payment",
        "due_payment",
        "payment_method",
        "payment_method_other",
        "transaction_reference",
        "payment_status",
        "remarks",
        "created_by",
        "status",
      ];

      const values = [
        data.receiptDate,
        data.clientName,
        data.clientPhone,
        data.clientEmail,
        data.clientAddress,
        data.eventName,
        data.eventDate,
        data.eventVenue,
        data.bookingReference,
        data.totalPayment,
        data.advancePayment,
        data.duePayment,
        data.paymentMethod,
        data.paymentMethodOther,
        data.transactionReference,
        data.paymentStatus,
        data.remarks,
        adminId,
        "generated",
      ];

      if (columns.has("billed_to")) {
        insertColumns.splice(5, 0, "billed_to");
        values.splice(5, 0, data.billedTo);
      }

      if (columns.has("booking_status")) {
        const refIndex = insertColumns.indexOf("booking_reference");
        insertColumns.splice(refIndex + 1, 0, "booking_status");
        values.splice(refIndex + 1, 0, data.bookingStatus);
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      await tx.$executeRawUnsafe(
        `INSERT INTO money_receipts (${insertColumns.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders})`,
        ...values,
      );

      const idRows = await tx.$queryRawUnsafe("SELECT LAST_INSERT_ID() AS id");
      const id = Number(idRows[0].id);
      const year = Number(data.receiptDate.slice(0, 4));
      const receiptNo = `MME-MR-${year}-${String(id).padStart(6, "0")}`;

      await tx.$executeRawUnsafe(
        "UPDATE money_receipts SET receipt_no = ? WHERE id = ?",
        receiptNo,
        id,
      );

      return id;
    });

    const receiptNo = `MME-MR-${data.receiptDate.slice(0, 4)}-${String(createdId).padStart(6, "0")}`;
    const { bytes, pageCount } = await generateReceiptPdf({ ...data, receiptNo });
    const fileName = `${receiptNo}.pdf`;
    const filePath = path.join(storageRoot, fileName);
    await writeFile(filePath, Buffer.from(bytes));

    await prisma.$executeRawUnsafe(
      `UPDATE money_receipts
       SET generated_file_name = ?,
           generated_file_path = ?,
           page_count = ?,
           generated_at = NOW()
       WHERE id = ?`,
      fileName,
      fileName,
      pageCount,
      createdId,
    );

    const created = await loadReceiptById(createdId);
    return res.status(201).json({ data: created });
  } catch (error) {
    if (createdId) {
      await prisma.$executeRawUnsafe(
        "DELETE FROM money_receipts WHERE id = ?",
        createdId,
      ).catch(() => {});
    }
    return next(error);
  }
}

export async function listMoneyReceipts(req, res, next) {
  try {
    const { search, paymentStatus, status, dateFrom, dateTo } = req.query;
    const where = [];
    const values = [];

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where.push("(mr.receipt_no LIKE ? OR mr.client_name LIKE ? OR mr.client_phone LIKE ?)");
      values.push(term, term, term);
    }
    if (paymentStatus && VALID_PAYMENT_STATUSES.has(String(paymentStatus))) {
      where.push("mr.payment_status = ?");
      values.push(String(paymentStatus));
    }
    if (status && VALID_RECORD_STATUSES.has(String(status))) {
      where.push("mr.status = ?");
      values.push(String(status));
    }
    if (dateFrom && dateOnly(dateFrom)) {
      where.push("mr.receipt_date >= ?");
      values.push(dateOnly(dateFrom));
    }
    if (dateTo && dateOnly(dateTo)) {
      where.push("mr.receipt_date <= ?");
      values.push(dateOnly(dateTo));
    }

    const selectSql = await getSelectSql("mr");
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${selectSql}
       FROM money_receipts mr
       LEFT JOIN employees e ON e.id = mr.created_by
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY mr.created_at DESC, mr.id DESC`,
      ...values,
    );

    return res.json({ data: rows.map(normalizeRow) });
  } catch (error) {
    return next(error);
  }
}

export async function getMoneyReceipt(req, res, next) {
  try {
    const receipt = await loadReceiptById(req.params.id);
    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });
    return res.json({ data: receipt });
  } catch (error) {
    return next(error);
  }
}

export async function downloadMoneyReceipt(req, res, next) {
  try {
    const receipt = await loadReceiptById(req.params.id);
    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });
    if (!receipt.generatedFilePath) {
      return res.status(404).json({ message: "Generated PDF is not available for this receipt." });
    }

    const baseName = path.basename(receipt.generatedFilePath);
    const absolutePath = path.join(storageRoot, baseName);
    if (!existsSync(absolutePath)) {
      return res.status(404).json({ message: "Generated receipt PDF could not be found." });
    }

    return res.download(absolutePath, receipt.generatedFileName || `${receipt.receiptNo || "money-receipt"}.pdf`);
  } catch (error) {
    return next(error);
  }
}

export async function archiveMoneyReceipt(req, res, next) {
  try {
    const receipt = await loadReceiptById(req.params.id);
    if (!receipt) return res.status(404).json({ message: "Money receipt not found." });

    await prisma.$executeRawUnsafe(
      "UPDATE money_receipts SET status = 'archived' WHERE id = ?",
      Number(req.params.id),
    );

    return res.json({ data: await loadReceiptById(req.params.id) });
  } catch (error) {
    return next(error);
  }
}
