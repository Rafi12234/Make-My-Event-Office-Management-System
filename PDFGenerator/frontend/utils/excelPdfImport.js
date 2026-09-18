import * as XLSX from "xlsx";

const ITEM_ALIASES = new Set([
  "item",
  "items",
  "item name",
  "item names",
]);

const DESCRIPTION_ALIASES = new Set([
  "description",
  "descriptions",
  "detail",
  "details",
]);

const QUANTITY_ALIASES = new Set([
  "qty",
  "quantity",
  "qnty",
  "quantities",
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

function columnRole(header) {
  const normalized = normalizeHeader(header);

  if (ITEM_ALIASES.has(normalized)) {
    return "item";
  }

  if (DESCRIPTION_ALIASES.has(normalized)) {
    return "description";
  }

  if (QUANTITY_ALIASES.has(normalized)) {
    return "quantity";
  }

  return null;
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

    const headers = row.map((value) =>
      String(value ?? "").trim(),
    );

    const roles = headers.map(columnRole);

    /*
      The Excel table is valid only when the header row contains:

      Item / Items
      AND
      Description / Details

      Everything else is optional and dynamic.
    */
    if (
      roles.includes("item") &&
      roles.includes("description")
    ) {
      return {
        rowIndex,
        headers,
        roles,
      };
    }
  }

  return null;
}

function cellText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function lastMeaningfulColumnIndex(
  headers,
  rows,
) {
  let last = -1;

  headers.forEach((value, index) => {
    if (cellText(value)) {
      last = Math.max(last, index);
    }
  });

  rows.forEach((row) => {
    if (!Array.isArray(row)) {
      return;
    }

    row.forEach((value, index) => {
      if (cellText(value)) {
        last = Math.max(last, index);
      }
    });
  });

  return last;
}

export async function parsePdfExcelFile(
  file,
) {
  const workbook = XLSX.read(
    await file.arrayBuffer(),
    {
      type: "array",
      cellDates: false,
    },
  );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "The Excel workbook does not contain a worksheet.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Read Excel exactly as displayed
  |--------------------------------------------------------------------------
  |
  | raw:false is important here.
  |
  | It keeps displayed Excel values such as:
  |
  | 1,250.00
  | 12ft x 8ft
  | 25%
  | dates
  | N/A
  |
  | instead of forcing them into the old fixed PDF numeric structure.
  |
  */
  const matrix = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | Find actual Excel header row
  |--------------------------------------------------------------------------
  |
  | The first row does NOT have to be the header.
  |
  | We search until we find a row containing:
  |
  | Item / Items
  | Description / Details
  |
  */
  const header = findHeader(matrix);

  if (!header) {
    throw new Error(
      'Excel must contain both an "Item"/"Items" column and a "Description"/"Details" column.',
    );
  }

  const dataRows = matrix.slice(
    header.rowIndex + 1,
  );

  /*
  |--------------------------------------------------------------------------
  | Detect actual Excel width
  |--------------------------------------------------------------------------
  |
  | This preserves additional columns even if their header is blank but
  | the rows contain values underneath them.
  |
  */
  const lastColumnIndex =
    lastMeaningfulColumnIndex(
      header.headers,
      dataRows,
    );

  if (lastColumnIndex < 1) {
    throw new Error(
      "The Excel table does not contain usable columns.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Build dynamic Excel columns
  |--------------------------------------------------------------------------
  |
  | We do NOT force Excel into:
  |
  | QTY
  | Size
  | SQFT
  | TSqft
  | Unit
  | Price
  |
  | Whatever Excel contains is preserved.
  |
  */
  const excelColumns = [];

  let itemColumnKey = null;
  let descriptionColumnKey = null;
  let quantityColumnKey = null;

  for (
    let index = 0;
    index <= lastColumnIndex;
    index += 1
  ) {
    const key = `col_${index}`;

    const label = cellText(
      header.headers[index],
    );

    const detectedRole =
      columnRole(label);

    let role = null;

    /*
      Only the first matching special column gets the role.

      If Excel contains duplicate column names,
      those duplicate columns are still preserved normally.
    */
    if (
      detectedRole === "item" &&
      !itemColumnKey
    ) {
      itemColumnKey = key;
      role = "item";
    } else if (
      detectedRole === "description" &&
      !descriptionColumnKey
    ) {
      descriptionColumnKey = key;
      role = "description";
    } else if (
      detectedRole === "quantity" &&
      !quantityColumnKey
    ) {
      quantityColumnKey = key;
      role = "quantity";
    }

    excelColumns.push({
      key,
      label,
      role,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Convert Excel rows
  |--------------------------------------------------------------------------
  */
  const rows = [];

  for (
    let offset = 0;
    offset < dataRows.length;
    offset += 1
  ) {
    const sourceRow =
      dataRows[offset];

    if (!Array.isArray(sourceRow)) {
      continue;
    }

    const excelRowData = {};

    let hasAnyValue = false;

    for (
      let index = 0;
      index <= lastColumnIndex;
      index += 1
    ) {
      const value = cellText(
        sourceRow[index],
      );

      excelRowData[
        `col_${index}`
      ] = value;

      if (value) {
        hasAnyValue = true;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Skip ONLY completely empty rows
    |--------------------------------------------------------------------------
    |
    | Important:
    |
    | We intentionally DO NOT reject a row just because Item is empty.
    |
    | Example:
    |
    | Items | Details | Qty       | TSqft | Price
    |       |         | Sub Total | 3443  | 0
    |
    | This is a valid Excel footer/subtotal row and must remain in the table.
    |
    */
    if (!hasAnyValue) {
      continue;
    }

    const itemName = cellText(
      excelRowData[itemColumnKey],
    );

    const description = cellText(
      excelRowData[
        descriptionColumnKey
      ],
    );

    /*
      QTY is optional.

      If Excel contains Qty/Quantity,
      use it.

      Otherwise default to 1 internally for actual items.
    */
    const quantity =
      quantityColumnKey
        ? cellText(
            excelRowData[
              quantityColumnKey
            ],
          ) || "1"
        : "1";

    rows.push({
      /*
        These are used internally for detailed reference pages.
      */
      itemName,
      description,
      quantity,

      /*
        This contains the EXACT dynamic Excel row.
      */
      excelRowData,

      /*
        Helpful for debugging/import history.
      */
      sourceRowNumber:
        header.rowIndex +
        offset +
        2,
    });
  }

  if (!rows.length) {
    throw new Error(
      "No table rows were found below the Excel header.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Require at least one actual item
  |--------------------------------------------------------------------------
  |
  | Footer/subtotal rows may have blank Item cells,
  | but there still needs to be at least one actual item in the table.
  |
  */
  if (
    !rows.some(
      (row) => row.itemName,
    )
  ) {
    throw new Error(
      "The Excel table does not contain any item values below the Item/Items header.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Final parsed result
  |--------------------------------------------------------------------------
  */
  return {
    originalFileName: file.name,

    sheetName,

    /*
      Exact Excel headers in original order.
    */
    detectedHeaders:
      excelColumns.map(
        (column) =>
          column.label,
      ),

    /*
      Generic dynamic mapping.
    */
    columnMapping:
      Object.fromEntries(
        excelColumns.map(
          (column) => [
            column.key,
            column.label,
          ],
        ),
      ),

    /*
      Dynamic column definitions.
    */
    excelColumns,

    /*
      Every non-empty Excel row,
      including totals/subtotals/footer rows.
    */
    rows,
  };
}