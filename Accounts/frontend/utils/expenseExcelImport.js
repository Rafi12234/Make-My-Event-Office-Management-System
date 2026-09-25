import * as XLSX from "xlsx";

const PURPOSE_ALIASES = new Set([
  "purpose",
  "purposes",
  "description",
  "descriptions",
  "detail",
  "details",
  "purpose description details",
  "purpose descriptions details",
  "what was this for",
]);

const DATE_ALIASES = new Set([
  "date",
  "cost date",
  "expense date",
  "cost happened on",
  "happened on",
]);

const QUANTITY_ALIASES = new Set([
  "quantity",
  "qty",
  "qnty",
]);

const AMOUNT_PER_QTY_ALIASES = new Set([
  "amount qty",
  "amount per qty",
  "amount quantity",
  "amount per quantity",
  "per qty amount",
  "per quantity amount",
  "unit amount",
  "unit price",
  "rate",
]);

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\\/_\-.()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectRole(value) {
  const normalized =
    normalizeHeader(value);

  if (
    PURPOSE_ALIASES.has(
      normalized,
    )
  ) {
    return "purpose";
  }

  if (
    DATE_ALIASES.has(
      normalized,
    )
  ) {
    return "date";
  }

  if (
    QUANTITY_ALIASES.has(
      normalized,
    )
  ) {
    return "quantity";
  }

  if (
    AMOUNT_PER_QTY_ALIASES.has(
      normalized,
    )
  ) {
    return "amountPerQty";
  }

  /*
    Also accepts headers like:

    Amount / Qty
    Amount / Qty (Item total will be calculated automatically)
    Amount Per Quantity
  */
  if (
    normalized.includes(
      "amount",
    ) &&
    (
      normalized.includes(
        "qty",
      ) ||
      normalized.includes(
        "quantity",
      )
    )
  ) {
    return "amountPerQty";
  }

  return null;
}

function findHeaderRow(
  matrix,
) {
  for (
    let rowIndex = 0;
    rowIndex <
    matrix.length;
    rowIndex += 1
  ) {
    const row =
      Array.isArray(
        matrix[
          rowIndex
        ],
      )
        ? matrix[
            rowIndex
          ]
        : [];

    const mapping = {};

    row.forEach(
      (
        cell,
        columnIndex,
      ) => {
        const role =
          detectRole(
            cell,
          );

        if (
          role &&
          mapping[
            role
          ] ===
            undefined
        ) {
          mapping[
            role
          ] =
            columnIndex;
        }
      },
    );

    if (
      mapping.purpose !==
        undefined &&
      mapping.date !==
        undefined &&
      mapping.quantity !==
        undefined &&
      mapping.amountPerQty !==
        undefined
    ) {
      return {
        rowIndex,
        mapping,
      };
    }
  }

  return null;
}

function formatIsoDate(
  year,
  month,
  day,
) {
  const numericYear =
    Number(year);

  const numericMonth =
    Number(month);

  const numericDay =
    Number(day);

  if (
    !Number.isInteger(
      numericYear,
    ) ||
    !Number.isInteger(
      numericMonth,
    ) ||
    !Number.isInteger(
      numericDay,
    ) ||
    numericYear < 1900 ||
    numericYear > 2200 ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > 31
  ) {
    return null;
  }

  const probe =
    new Date(
      Date.UTC(
        numericYear,
        numericMonth -
          1,
        numericDay,
      ),
    );

  if (
    probe.getUTCFullYear() !==
      numericYear ||
    probe.getUTCMonth() +
      1 !==
      numericMonth ||
    probe.getUTCDate() !==
      numericDay
  ) {
    return null;
  }

  return `${String(
    numericYear,
  ).padStart(
    4,
    "0",
  )}-${String(
    numericMonth,
  ).padStart(
    2,
    "0",
  )}-${String(
    numericDay,
  ).padStart(
    2,
    "0",
  )}`;
}

function normalizeYear(
  value,
) {
  const year =
    Number(value);

  if (
    !Number.isFinite(
      year,
    )
  ) {
    return null;
  }

  if (
    year >= 0 &&
    year <= 69
  ) {
    return (
      2000 +
      year
    );
  }

  if (
    year >= 70 &&
    year <= 99
  ) {
    return (
      1900 +
      year
    );
  }

  return year;
}

function parseExcelDate(
  value,
) {
  /*
  |--------------------------------------------------------------------------
  | Actual JS Date
  |--------------------------------------------------------------------------
  */
  if (
    value instanceof
      Date &&
    !Number.isNaN(
      value.getTime(),
    )
  ) {
    return formatIsoDate(
      value.getUTCFullYear(),
      value.getUTCMonth() +
        1,
      value.getUTCDate(),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Excel serial date
  |--------------------------------------------------------------------------
  */
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    const parsed =
      XLSX.SSF.parse_date_code(
        value,
      );

    if (parsed) {
      return formatIsoDate(
        parsed.y,
        parsed.m,
        parsed.d,
      );
    }
  }

  const text =
    String(
      value ?? "",
    ).trim();

  if (!text) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Excel serial represented as text
  |--------------------------------------------------------------------------
  */
  if (
    /^\d+(\.\d+)?$/.test(
      text,
    )
  ) {
    const numeric =
      Number(text);

    if (
      Number.isFinite(
        numeric,
      )
    ) {
      const parsed =
        XLSX.SSF.parse_date_code(
          numeric,
        );

      if (parsed) {
        return formatIsoDate(
          parsed.y,
          parsed.m,
          parsed.d,
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | YYYY-MM-DD
  |--------------------------------------------------------------------------
  */
  const isoMatch =
    text.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s|T|$)/,
    );

  if (isoMatch) {
    return formatIsoDate(
      isoMatch[1],
      isoMatch[2],
      isoMatch[3],
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DD/MM/YYYY or DD-MM-YYYY
  |--------------------------------------------------------------------------
  |
  | Your system displays Bangladesh-style day-first dates,
  | so these values are interpreted as DD/MM/YYYY.
  |
  */
  const dayFirstMatch =
    text.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s|$)/,
    );

  if (
    dayFirstMatch
  ) {
    return formatIsoDate(
      normalizeYear(
        dayFirstMatch[
          3
        ],
      ),
      dayFirstMatch[
        2
      ],
      dayFirstMatch[
        1
      ],
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Human-readable date
  |--------------------------------------------------------------------------
  |
  | Examples:
  |
  | 23 Sep 2026
  | September 23, 2026
  |
  */
  const fallback =
    new Date(text);

  if (
    !Number.isNaN(
      fallback.getTime(),
    )
  ) {
    return formatIsoDate(
      fallback.getUTCFullYear(),
      fallback.getUTCMonth() +
        1,
      fallback.getUTCDate(),
    );
  }

  return null;
}

function parsePositiveNumber(
  value,
) {
  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value,
    ) &&
      value > 0
      ? value
      : null;
  }

  const text =
    String(
      value ?? "",
    ).trim();

  if (!text) {
    return null;
  }

  /*
    Allows:

    500
    500.50
    1,500
    Tk 500
    Taka 500
    BDT 500
    ৳500
  */
  const normalized =
    text
      .replace(
        /,/g,
        "",
      )
      .replace(
        /৳/g,
        "",
      )
      .replace(
        /\b(?:tk|taka|bdt)\b/gi,
        "",
      )
      .replace(
        /\s+/g,
        "",
      )
      .trim();

  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const number =
    Number(
      normalized,
    );

  return Number.isFinite(
    number,
  ) &&
    number > 0
    ? number
    : null;
}

function numberForInput(
  value,
) {
  return Number.isInteger(
    value,
  )
    ? String(value)
    : String(
        Number(
          value.toFixed(
            6,
          ),
        ),
      );
}

function parseWorksheet(
  sheet,
) {
  const matrix =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header: 1,
        defval: "",
        raw: true,
        cellDates: true,
        blankrows: true,
      },
    );

  /*
  |--------------------------------------------------------------------------
  | Search for the actual header row
  |--------------------------------------------------------------------------
  |
  | This means title/note rows above the table are allowed.
  |
  */
  const header =
    findHeaderRow(
      matrix,
    );

  if (!header) {
    return null;
  }

  const rows = [];

  let ignoredRowCount =
    0;

  for (
    let rowIndex =
      header.rowIndex +
      1;
    rowIndex <
    matrix.length;
    rowIndex += 1
  ) {
    const sourceRow =
      Array.isArray(
        matrix[
          rowIndex
        ],
      )
        ? matrix[
            rowIndex
          ]
        : [];

    /*
      Only required columns matter.

      Any extra Excel columns are ignored.
    */
    const requiredCells =
      [
        sourceRow[
          header.mapping
            .purpose
        ],

        sourceRow[
          header.mapping
            .date
        ],

        sourceRow[
          header.mapping
            .quantity
        ],

        sourceRow[
          header.mapping
            .amountPerQty
        ],
      ];

    const isCompletelyEmpty =
      requiredCells.every(
        (value) =>
          value ===
            null ||
          value ===
            undefined ||
          String(
            value,
          ).trim() ===
            "",
      );

    /*
      Completely empty rows are ignored.
    */
    if (
      isCompletelyEmpty
    ) {
      continue;
    }

    const purpose =
      String(
        sourceRow[
          header.mapping
            .purpose
        ] ?? "",
      ).trim();

    const costDate =
      parseExcelDate(
        sourceRow[
          header.mapping
            .date
        ],
      );

    const quantity =
      parsePositiveNumber(
        sourceRow[
          header.mapping
            .quantity
        ],
      );

    const perQtyAmount =
      parsePositiveNumber(
        sourceRow[
          header.mapping
            .amountPerQty
        ],
      );

    /*
    |--------------------------------------------------------------------------
    | Ignore malformed/footer/extra rows
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | Total | | | 5000
    |
    | or notes below the table.
    |
    | They won't crash the upload.
    |
    */
    if (
      !purpose ||
      !costDate ||
      quantity ===
        null ||
      perQtyAmount ===
        null
    ) {
      ignoredRowCount +=
        1;

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Populate the existing ExpenseItemsTable model
    |--------------------------------------------------------------------------
    |
    | Vendor intentionally starts blank.
    |
    | Regular Cost users can choose Vendor/Paid/To Pay manually afterward.
    |
    */
    rows.push({
      purpose,

      costDate,

      quantity:
        numberForInput(
          quantity,
        ),

      perQtyAmount:
        numberForInput(
          perQtyAmount,
        ),

      sourceRowNumber:
        rowIndex +
        1,
    });
  }

  return {
    rows,

    ignoredRowCount,

    headerRowNumber:
      header.rowIndex +
      1,
  };
}

export async function parseExpenseExcelFile(
  file,
) {
  if (!file) {
    throw new Error(
      "Choose an Excel file first.",
    );
  }

  const workbook =
    XLSX.read(
      await file.arrayBuffer(),
      {
        type: "array",
        cellDates: true,
      },
    );

  /*
  |--------------------------------------------------------------------------
  | Search all worksheets
  |--------------------------------------------------------------------------
  |
  | First worksheet containing all four required headers is used.
  |
  */
  for (
    const sheetName of
      workbook.SheetNames
  ) {
    const parsed =
      parseWorksheet(
        workbook.Sheets[
          sheetName
        ],
      );

    if (!parsed) {
      continue;
    }

    if (
      !parsed.rows.length
    ) {
      throw new Error(
        `The sheet "${sheetName}" has the required headers, but no valid cost rows were found underneath them.`,
      );
    }

    return {
      originalFileName:
        file.name,

      sheetName,

      ...parsed,
    };
  }

  throw new Error(
    'Excel must contain these columns: Purpose/Description/Details, Date, Quantity, and Amount / Qty. Extra columns are allowed and will be ignored.',
  );
}