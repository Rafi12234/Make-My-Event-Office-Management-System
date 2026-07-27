function normalizeHeader(value, index) {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

function readExcelCellValue(cell) {
  const value = cell.value;

  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 16);

  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) {
      return value.result instanceof Date
        ? value.result.toISOString().slice(0, 16)
        : String(value.result ?? "");
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }

    if (value.text) return String(value.text);
    if (value.hyperlink) return String(value.text || value.hyperlink);
  }

  return String(value);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

async function parseCsvFile(file) {
  const text = await file.text();
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    throw new Error("The uploaded CSV file is empty.");
  }

  const matrix = lines.map(parseCsvLine);
  const headers = matrix[0].map(normalizeHeader);
  const rows = matrix.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );

  return {
    sheetName: file.name.replace(/\.csv$/i, ""),
    headers,
    rows,
  };
}

async function parseXlsxFile(file) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    // exceljs throws a low-level, unreadable error (e.g. "Cannot set
    // properties of undefined (setting 'sheetNo')") when a sheet inside the
    // file fails to parse — this happens for corrupted files, files that
    // aren't really .xlsx (e.g. an old .xls or .csv renamed to .xlsx), or
    // password-protected workbooks. Surface an actionable message instead.
    throw new Error(
      "Could not read this Excel file. It may be corrupted, password-protected, " +
        "or not a genuine .xlsx file. Open it in Excel, use \"Save As\" to create " +
        "a fresh .xlsx copy, then upload that file.",
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheet was found inside the Excel file.");
  }

  const maxColumnCount = Math.max(1, worksheet.columnCount || 1);

  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: maxColumnCount }, (_, index) =>
    normalizeHeader(readExcelCellValue(headerRow.getCell(index + 1)), index),
  );

  const rows = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values = Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        readExcelCellValue(row.getCell(columnIndex + 1)),
      ]),
    );

    const hasValue = Object.values(values).some(
      (value) => String(value).trim().length > 0,
    );

    if (hasValue) rows.push(values);
  }

  return {
    sheetName: worksheet.name,
    headers,
    rows,
  };
}

export async function parseSpreadsheetFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") return parseCsvFile(file);
  if (extension === "xlsx") return parseXlsxFile(file);

  throw new Error(
    "Unsupported file type. Upload a modern Excel (.xlsx) or CSV (.csv) file.",
  );
}
