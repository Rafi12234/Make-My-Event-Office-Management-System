import * as XLSX from "xlsx";

const ITEM_ALIASES = new Set([
  "item",
  "items",
  "item name",
  "item names",
  "item title",
  "items name",
  "itemname",
  "itemsname",
]);

const DESCRIPTION_ALIASES = new Set([
  "description",
  "descriptions",
  "desc",
  "detail",
  "details",
  "item description",
  "item details",
]);

const QUANTITY_ALIASES = new Set([
  "qty",
  "quantity",
  "qnty",
  "quantities",
]);

// ITEM-WISE PRICE ONLY
const ITEM_PRICE_ALIASES = new Set([
  "item price",
  "item wise price",
  "itemwise price",
  "unit price",
  "per item price",
  "price per item",
  "unit rate",
  "rate",
]);

// ONE OVERALL PRICE FOR THE WHOLE MEETING
const TOTAL_PRICE_ALIASES = new Set([
  "price",
  "total price",
  "total",
  "grand total",
  "grand total price",
  "overall price",
  "overall total",
  "total amount",
]);

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/[_.\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headerRole(value) {
  const normalized = normalizeHeader(value);

  if (
    ITEM_ALIASES.has(normalized) ||
    /^(item|items)\s+(name|names|title)$/.test(normalized)
  ) {
    return "item";
  }

  if (
    DESCRIPTION_ALIASES.has(normalized) ||
    /^(item\s+)?(description|details?|desc)$/.test(normalized)
  ) {
    return "description";
  }

  if (QUANTITY_ALIASES.has(normalized)) {
    return "quantity";
  }

  // IMPORTANT:
  // Check item-price aliases BEFORE generic total-price aliases.
  if (
    ITEM_PRICE_ALIASES.has(normalized) ||
    normalized.includes("item price") ||
    normalized.includes("unit price") ||
    normalized.includes("price per item")
  ) {
    return "itemPrice";
  }

  // Exact "Price" means OVERALL meeting Total Price.
  if (TOTAL_PRICE_ALIASES.has(normalized)) {
    return "totalPrice";
  }

  return null;
}

function cellText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function findHeader(matrix) {
  for (
    let rowIndex = 0;
    rowIndex < matrix.length;
    rowIndex += 1
  ) {
    const row = matrix[rowIndex];

    if (!Array.isArray(row)) {
      continue;
    }

    const roles = row.map(headerRole);

    if (roles.includes("item")) {
      return {
        rowIndex,
        roles,
      };
    }
  }

  return null;
}

function parseQuantity(value) {
  const text = cellText(value).replace(/,/g, "");

  if (!text) {
    return 1;
  }

  const number = Number(text);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 1;
  }

  return Math.min(
    Math.round(number),
    100000,
  );
}

function parseMoney(value) {
  const text = cellText(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/,/g, "")
    .replace(/[^0-9.\-]/g, "");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return Math.min(
    Math.round(number * 100) / 100,
    999999999999.99,
  );
}

export async function parseMeetingExcelFile(file) {
  const workbook = XLSX.read(
    await file.arrayBuffer(),
    {
      type: "array",
      cellDates: false,
    },
  );

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "The Excel workbook does not contain a worksheet.",
    );
  }

  const matrix = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    },
  );

  const header = findHeader(matrix);

  if (!header) {
    throw new Error(
      "Excel must contain an Item / Items / Item Name column.",
    );
  }

  const firstRoleIndex = (role) =>
    header.roles.findIndex(
      (value) => value === role,
    );

  const itemIndex =
    firstRoleIndex("item");

  const descriptionIndex =
    firstRoleIndex("description");

  const quantityIndex =
    firstRoleIndex("quantity");

  const itemPriceIndex =
    firstRoleIndex("itemPrice");

  const totalPriceIndex =
    firstRoleIndex("totalPrice");

  const rows = [];

  // ONE overall meeting Total Price.
  // We take the first valid non-empty numeric value from
  // Price / Total Price / Grand Total etc.
  let totalPrice = null;

  for (
    const sourceRow of matrix.slice(
      header.rowIndex + 1,
    )
  ) {
    if (!Array.isArray(sourceRow)) {
      continue;
    }

    // Read overall Total Price even if this row has no item.
    if (
      totalPrice === null &&
      totalPriceIndex >= 0
    ) {
      const parsedTotalPrice = parseMoney(
        sourceRow[totalPriceIndex],
      );

      if (parsedTotalPrice !== null) {
        totalPrice = parsedTotalPrice;
      }
    }

    const itemName = cellText(
      sourceRow[itemIndex],
    );

    if (!itemName) {
      continue;
    }

    rows.push({
      itemName: itemName.slice(0, 160),

      description:
        descriptionIndex >= 0
          ? cellText(
              sourceRow[descriptionIndex],
            ).slice(0, 2000)
          : "",

      quantity:
        quantityIndex >= 0
          ? parseQuantity(
              sourceRow[quantityIndex],
            )
          : 1,

      itemPrice:
        itemPriceIndex >= 0
          ? parseMoney(
              sourceRow[itemPriceIndex],
            )
          : null,
    });

    if (rows.length >= 500) {
      break;
    }
  }

  if (!rows.length) {
    throw new Error(
      "No item rows were found below the Excel header.",
    );
  }

  return {
    originalFileName: file.name,
    sheetName,
    rows,

    hasItemPriceColumn:
      itemPriceIndex >= 0,

    hasTotalPriceColumn:
      totalPriceIndex >= 0,

    totalPrice,
  };
}