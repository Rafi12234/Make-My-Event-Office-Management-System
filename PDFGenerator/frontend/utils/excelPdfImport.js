import * as XLSX from "xlsx";

const OPTIONAL_COLUMNS = ["size", "sqft", "tsqft", "unit", "price"];
const ALIASES = {
  itemName: ["item", "items", "item name", "name"],
  description: ["description", "desc", "details", "detail"],
  quantity: ["qty", "quantity", "qnty"],
  size: ["size", "dimension", "dimensions"],
  sqft: ["sqft", "sq ft", "square feet", "square foot"],
  tsqft: ["tsqft", "t sqft", "total sqft", "total sq ft", "total square feet"],
  unit: ["unit", "uom"],
  price: ["price", "amount", "rate", "cost"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildMapping(headers) {
  const mapping = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!(field in mapping) && aliases.includes(normalized)) mapping[field] = index;
    }
  });
  return mapping;
}

function cell(row, index, fallback = "") {
  if (index === undefined) return fallback;
  const value = row[index];
  return value === null || value === undefined ? fallback : String(value).trim();
}

export async function parsePdfExcelFile(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The Excel workbook does not contain a worksheet.");

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
  });
  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((value) => String(value ?? "").trim()));
  if (headerIndex < 0) throw new Error("The Excel sheet is empty.");

  const headers = matrix[headerIndex].map((value) => String(value ?? "").trim());
  const mapping = buildMapping(headers);
  if (mapping.itemName === undefined) {
    throw new Error('Excel must contain an "Item" or "Items" column.');
  }

  const rows = matrix
    .slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((value) => String(value ?? "").trim()))
    .map((row) => ({
      itemName: cell(row, mapping.itemName),
      description: cell(row, mapping.description),
      quantity: cell(row, mapping.quantity, "1") || "1",
      size: cell(row, mapping.size),
      sqft: cell(row, mapping.sqft),
      tsqft: cell(row, mapping.tsqft),
      unit: cell(row, mapping.unit),
      price: cell(row, mapping.price),
    }))
    .filter((row) => row.itemName);

  if (!rows.length) throw new Error("No item rows were found below the Excel header.");

  const selectedColumns = OPTIONAL_COLUMNS.filter((field) => mapping[field] !== undefined);
  const columnMapping = Object.fromEntries(
    Object.entries(mapping).map(([field, index]) => [headers[index] || field, field]),
  );

  return {
    originalFileName: file.name,
    sheetName,
    detectedHeaders: headers.filter(Boolean),
    columnMapping,
    selectedColumns,
    rows,
  };
}
