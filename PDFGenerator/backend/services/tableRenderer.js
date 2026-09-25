import { rgb } from "pdf-lib";

import {
  TABLE_CELL_PADDING_X,
  TABLE_CELL_PADDING_Y,
  TABLE_LINE_HEIGHT_FACTOR,
  TABLE_TITLE_FONT_SIZE,
  TABLE_TITLE_ROW_HEIGHT,
} from "../config/pdfLayout.js";

import {
  drawLines,
  measureLinesHeight,
  wrapText,
} from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

const OPTIONAL_ORDER = [
  "size",
  "sqft",
  "tsqft",
  "unit",
  "price",
];

/*
|--------------------------------------------------------------------------
| Normal Client Meeting table columns
|--------------------------------------------------------------------------
*/
const MEETING_META = {
  sl: {
    label: "SL",
    weight: 4,
  },

  item: {
    label: "Item",
    weight: 11,
  },

  description: {
    label: "Description",
    weight: 20,
  },

  qty: {
    label: "QTY",
    weight: 5,
  },

  size: {
    label: "Size",
    weight: 8,
  },

  sqft: {
    label: "SQFT",
    weight: 6,
  },

  tsqft: {
    label: "TSqft",
    weight: 6,
  },

  unit: {
    label: "Unit",
    weight: 6,
  },

  price: {
    label: "Price",
    weight: 8,
  },
};

/*
|--------------------------------------------------------------------------
| Normalize Excel column label
|--------------------------------------------------------------------------
*/
function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/*
|--------------------------------------------------------------------------
| Dynamic Excel column width weight
|--------------------------------------------------------------------------
|
| Excel columns are not predefined.
|
| We only use the label/role to give sensible proportions.
|
| Example:
|
| Items        -> wider
| Details      -> widest
| Qty          -> narrow
| Price        -> narrow
| Material     -> medium
| Color        -> medium
|
*/
function excelWeight(column) {
  if (
    column.role ===
    "description"
  ) {
    return 22;
  }

  if (
    column.role ===
    "item"
  ) {
    return 13;
  }

  const label =
    normalizeLabel(
      column.label,
    );

  if (
    label.includes(
      "description",
    ) ||
    label.includes(
      "detail",
    )
  ) {
    return 22;
  }

  if (
    label.includes(
      "item",
    )
  ) {
    return 13;
  }

  if (
    label.includes(
      "size",
    ) ||
    label.includes(
      "dimension",
    )
  ) {
    return 10;
  }

  if (
    label.includes(
      "qty",
    ) ||
    label.includes(
      "quantity",
    ) ||
    label.includes(
      "sqft",
    ) ||
    label.includes(
      "unit",
    ) ||
    label.includes(
      "price",
    ) ||
    label.includes(
      "amount",
    ) ||
    label.includes(
      "rate",
    ) ||
    label.includes(
      "cost",
    )
  ) {
    return 7;
  }

  /*
    Any unknown Excel column gets medium width.
  */
  return 9;
}

/*
|--------------------------------------------------------------------------
| Sanitize dynamic Excel columns
|--------------------------------------------------------------------------
|
| Expected structure:
|
| [
|   {
|     key: "col_0",
|     label: "Items",
|     role: "item"
|   },
|   {
|     key: "col_1",
|     label: "Details",
|     role: "description"
|   },
|   {
|     key: "col_2",
|     label: "Material",
|     role: null
|   }
| ]
|
*/
function sanitizeExcelColumns(
  excelColumns = [],
) {
  if (
    !Array.isArray(
      excelColumns,
    )
  ) {
    return [];
  }

  return excelColumns
    .filter(
      (column) =>
        column &&
        typeof column ===
          "object" &&
        String(
          column.key || "",
        ).trim(),
    )
    .map(
      (column) => ({
        key: String(
          column.key,
        ),

        label: String(
          column.label ?? "",
        ),

        role: [
          "item",
          "description",
          "quantity",
        ].includes(
          column.role,
        )
          ? column.role
          : null,

        weight:
          excelWeight(
            column,
          ),
      }),
    );
}

/*
|--------------------------------------------------------------------------
| Get actual PDF summary table columns
|--------------------------------------------------------------------------
|
| Client Meeting mode:
|
| SL | Item | Description | QTY | Optional...
|
| Excel mode:
|
| EXACT Excel columns/order
|
| Example:
|
| Items | Details | Size | SQFT | Qty | TSqft | Unit | Price
|
*/
export function getTableColumns({
  sourceMode = "meeting",
  selectedColumns = [],
  excelColumns = [],
} = {}) {
  /*
  |--------------------------------------------------------------------------
  | Excel mode
  |--------------------------------------------------------------------------
  */
  if (
    sourceMode ===
    "excel"
  ) {
    return sanitizeExcelColumns(
      excelColumns,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Client Meeting mode
  |--------------------------------------------------------------------------
  */
  const optional =
    OPTIONAL_ORDER.filter(
      (key) =>
        selectedColumns.includes(
          key,
        ),
    );

  return [
    "sl",
    "item",
    "description",
    "qty",
    ...optional,
  ].map(
    (key) => ({
      key,

      ...MEETING_META[
        key
      ],
    }),
  );
}

/*
|--------------------------------------------------------------------------
| Dynamic font sizing
|--------------------------------------------------------------------------
|
| More columns = smaller font.
|
| This is important because Excel can contain arbitrary numbers of columns,
| but everything still needs to fit inside the fixed letterhead width.
|
*/
export function tableFontSizes(
  columnCount,
) {
  if (
    columnCount >= 14
  ) {
    return {
      header: 4.8,
      body: 5.0,
    };
  }

  if (
    columnCount >= 12
  ) {
    return {
      header: 5.2,
      body: 5.4,
    };
  }

  if (
    columnCount >= 10
  ) {
    return {
      header: 5.8,
      body: 6.0,
    };
  }

  if (
    columnCount >= 9
  ) {
    return {
      header: 6.4,
      body: 6.6,
    };
  }

  if (
    columnCount >= 7
  ) {
    return {
      header: 7.1,
      body: 7.3,
    };
  }

  if (
    columnCount >= 6
  ) {
    return {
      header: 7.7,
      body: 7.9,
    };
  }

  return {
    header: 8.6,
    body: 8.8,
  };
}

/*
|--------------------------------------------------------------------------
| Calculate column widths
|--------------------------------------------------------------------------
|
| Widths are calculated proportionally from column weights.
|
| This means:
|
| Description gets more room.
| Item gets more room.
| Qty/Price gets less room.
|
| But the complete table always stays inside `tableWidth`.
|
*/
export function computeColumnWidths(
  tableWidth,
  options = {},
) {
  const columns =
    getTableColumns(
      options,
    );

  const totalWeight =
    columns.reduce(
      (
        sum,
        column,
      ) =>
        sum +
        column.weight,
      0,
    ) || 1;

  const widths = {};

  for (
    const column of
      columns
  ) {
    widths[column.key] =
      (
        tableWidth *
        column.weight
      ) /
      totalWeight;
  }

  return widths;
}

/*
|--------------------------------------------------------------------------
| Total table width
|--------------------------------------------------------------------------
*/
function totalWidth(
  columnWidths,
  columns,
) {
  return columns.reduce(
    (
      sum,
      column,
    ) =>
      sum +
      (
        columnWidths[
          column.key
        ] || 0
      ),
    0,
  );
}

/*
|--------------------------------------------------------------------------
| Resolve displayed cell value
|--------------------------------------------------------------------------
*/
function textValue(
  item,
  column,
  index,
  sourceMode,
) {
  /*
  |--------------------------------------------------------------------------
  | Excel mode
  |--------------------------------------------------------------------------
  |
  | Do NOT use predefined item.description / item.quantity / etc.
  |
  | Read the exact uploaded Excel cell from excelRowData.
  |
  */
  if (
    sourceMode ===
    "excel"
  ) {
    return String(
      item.excelRowData?.[
        column.key
      ] ?? "",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Client Meeting mode
  |--------------------------------------------------------------------------
  */
  if (
    column.key ===
    "sl"
  ) {
    return String(
      index + 1,
    );
  }

  if (
    column.key ===
    "item"
  ) {
    return (
      item.itemName ||
      ""
    );
  }

  if (
    column.key ===
    "description"
  ) {
    return (
      item.description ||
      ""
    );
  }

  if (
    column.key ===
    "qty"
  ) {
    return (
      item.quantity ||
      ""
    );
  }

  return item[
    column.key
  ] == null
    ? ""
    : String(
        item[
          column.key
        ],
      );
}

/*
|--------------------------------------------------------------------------
| Measure every table row
|--------------------------------------------------------------------------
|
| Determines how high each row needs to be after wrapping text.
|
*/
export function measureRows(
  items,
  columnWidths,
  fonts,
  options = {},
) {
  const columns =
    getTableColumns(
      options,
    );

  const {
    body,
  } =
    tableFontSizes(
      columns.length,
    );

  return items.map(
    (
      item,
      index,
    ) => {
      const wrapped =
        {};

      let textHeight =
        0;

      for (
        const column of
          columns
      ) {
        const maxWidth =
          Math.max(
            4,

            columnWidths[
              column.key
            ] -
              TABLE_CELL_PADDING_X *
                2,
          );

        wrapped[
          column.key
        ] = wrapText(
          textValue(
            item,
            column,
            index,
            options.sourceMode,
          ),

          fonts.regular,

          body,

          maxWidth,
        );

        textHeight =
          Math.max(
            textHeight,

            measureLinesHeight(
              wrapped[
                column.key
              ].length,

              body,

              TABLE_LINE_HEIGHT_FACTOR,
            ) +
              TABLE_CELL_PADDING_Y *
                2,
          );
      }

      return {
        item,

        wrapped,

        height:
          Math.max(
            textHeight,

            body +
              TABLE_CELL_PADDING_Y *
                2,
          ),
      };
    },
  );
}

/*
|--------------------------------------------------------------------------
| Split one very tall row across pages
|--------------------------------------------------------------------------
|
| Example:
|
| If Description/Details is very large, a single row may not fit on the
| remaining page.
|
| This breaks that logical row into visual segments while preserving columns.
|
*/
export function splitMeasuredRow(
  row,
  maxHeight,
  columnWidths,
  options = {},
) {
  if (
    row.height <=
    maxHeight
  ) {
    return [row];
  }

  const columns =
    getTableColumns(
      options,
    );

  const {
    body,
  } =
    tableFontSizes(
      columns.length,
    );

  const lineHeight =
    body *
    TABLE_LINE_HEIGHT_FACTOR;

  const maxTextLines =
    Math.max(
      1,

      Math.floor(
        (
          maxHeight -
          TABLE_CELL_PADDING_Y *
            2
        ) /
          lineHeight,
      ),
    );

  const offsets =
    Object.fromEntries(
      columns.map(
        (column) => [
          column.key,
          0,
        ],
      ),
    );

  const segments = [];

  function hasRemaining() {
    return columns.some(
      (column) =>
        offsets[
          column.key
        ] <
        (
          row.wrapped[
            column.key
          ] || []
        ).length,
    );
  }

  while (
    hasRemaining()
  ) {
    const wrapped =
      {};

    let textHeight =
      0;

    for (
      const column of
        columns
    ) {
      const lines =
        row.wrapped[
          column.key
        ] || [];

      const start =
        offsets[
          column.key
        ];

      const chunk =
        lines.slice(
          start,
          start +
            maxTextLines,
        );

      offsets[
        column.key
      ] =
        start +
        chunk.length;

      wrapped[
        column.key
      ] =
        chunk;

      if (
        chunk.length
      ) {
        textHeight =
          Math.max(
            textHeight,

            measureLinesHeight(
              chunk.length,

              body,

              TABLE_LINE_HEIGHT_FACTOR,
            ) +
              TABLE_CELL_PADDING_Y *
                2,
          );
      }
    }

    segments.push({
      item:
        row.item,

      wrapped,

      height:
        Math.min(
          maxHeight,

          Math.max(
            textHeight,

            body +
              TABLE_CELL_PADDING_Y *
                2,
          ),
        ),
    });
  }

  return segments;
}

/*
|--------------------------------------------------------------------------
| Measure header row
|--------------------------------------------------------------------------
*/
export function measureHeaderHeight(
  columnWidths,
  font,
  options = {},
) {
  const columns =
    getTableColumns(
      options,
    );

  const {
    header,
  } =
    tableFontSizes(
      columns.length,
    );

  let maxLines = 1;

  for (
    const column of
      columns
  ) {
    const maxWidth =
      Math.max(
        4,

        columnWidths[
          column.key
        ] -
          TABLE_CELL_PADDING_X *
            2,
      );

    const lines =
      wrapText(
        column.label,

        font,

        header,

        maxWidth,
      );

    maxLines =
      Math.max(
        maxLines,

        lines.length ||
          1,
      );
  }

  return (
    measureLinesHeight(
      maxLines,

      header,

      TABLE_LINE_HEIGHT_FACTOR,
    ) +
    TABLE_CELL_PADDING_Y *
      2
  );
}

/*
|--------------------------------------------------------------------------
| Draw table vertical borders
|--------------------------------------------------------------------------
*/
function drawColumnBorders(
  page,
  x,
  columnWidths,
  columns,
  topY,
  bottomY,
) {
  let cursor = x;

  page.drawLine({
    start: {
      x: cursor,
      y: topY,
    },

    end: {
      x: cursor,
      y: bottomY,
    },

    thickness: 0.7,

    color: BLACK,
  });

  for (
    const column of
      columns
  ) {
    cursor +=
      columnWidths[
        column.key
      ];

    page.drawLine({
      start: {
        x: cursor,
        y: topY,
      },

      end: {
        x: cursor,
        y: bottomY,
      },

      thickness: 0.7,

      color: BLACK,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Draw table title
|--------------------------------------------------------------------------
|
| Example:
|
| Wedding Reception
|
*/
export function drawTableTitle(
  page,
  {
    x,
    y,
    width,
    title,
    font,
  },
) {
  const height =
    TABLE_TITLE_ROW_HEIGHT;

  const bottomY =
    y - height;

  page.drawRectangle({
    x,

    y: bottomY,

    width,

    height,

    borderWidth: 0.7,

    borderColor:
      BLACK,
  });

  const safeTitle =
    String(
      title || "",
    );

  const textWidth =
    font.widthOfTextAtSize(
      safeTitle,

      TABLE_TITLE_FONT_SIZE,
    );

  /*
    Shrink very long titles so they stay within table width.
  */
  const fittedSize =
    textWidth >
    width - 12
      ? Math.max(
          8,

          (
            TABLE_TITLE_FONT_SIZE *
            (
              width -
              12
            )
          ) /
            textWidth,
        )
      : TABLE_TITLE_FONT_SIZE;

  const fittedWidth =
    font.widthOfTextAtSize(
      safeTitle,

      fittedSize,
    );

  page.drawText(
    safeTitle,
    {
      x:
        x +
        (
          width -
          fittedWidth
        ) /
          2,

      y:
        bottomY +
        (
          height -
          fittedSize
        ) /
          2 +
        1,

      size:
        fittedSize,

      font,

      color:
        BLACK,
    },
  );

  return bottomY;
}

/*
|--------------------------------------------------------------------------
| Draw table header row
|--------------------------------------------------------------------------
*/
export function drawTableHeader(
  page,
  {
    x,
    y,
    columnWidths,
    font,
    options = {},
  },
) {
  const columns =
    getTableColumns(
      options,
    );

  const {
    header,
  } =
    tableFontSizes(
      columns.length,
    );

  const height =
    measureHeaderHeight(
      columnWidths,
      font,
      options,
    );

  const bottomY =
    y - height;

  const width =
    totalWidth(
      columnWidths,
      columns,
    );

  /*
    Vertical borders.
  */
  drawColumnBorders(
    page,
    x,
    columnWidths,
    columns,
    y,
    bottomY,
  );

  /*
    Top horizontal border.
  */
  page.drawLine({
    start: {
      x,
      y,
    },

    end: {
      x:
        x + width,
      y,
    },

    thickness: 0.7,

    color: BLACK,
  });

  /*
    Bottom horizontal border.
  */
  page.drawLine({
    start: {
      x,
      y: bottomY,
    },

    end: {
      x:
        x + width,
      y: bottomY,
    },

    thickness: 0.7,

    color: BLACK,
  });

  let cursor = x;

  for (
    const column of
      columns
  ) {
    const cellWidth =
      columnWidths[
        column.key
      ];

    const lines =
      wrapText(
        column.label,

        font,

        header,

        Math.max(
          4,

          cellWidth -
            TABLE_CELL_PADDING_X *
              2,
        ),
      );

    const linesHeight =
      measureLinesHeight(
        lines.length ||
          1,

        header,

        TABLE_LINE_HEIGHT_FACTOR,
      );

    const topInset =
      Math.max(
        (
          height -
          linesHeight
        ) /
          2,

        TABLE_CELL_PADDING_Y,
      );

    drawLines(
      page,

      lines.length
        ? lines
        : [""],

      {
        x:
          cursor +
          TABLE_CELL_PADDING_X,

        topY:
          y -
          topInset,

        width:
          Math.max(
            4,

            cellWidth -
              TABLE_CELL_PADDING_X *
                2,
          ),

        font,

        fontSize:
          header,

        color:
          BLACK,

        align:
          "center",

        lineHeightFactor:
          TABLE_LINE_HEIGHT_FACTOR,
      },
    );

    cursor +=
      cellWidth;
  }

  return bottomY;
}

/*
|--------------------------------------------------------------------------
| Draw one table row
|--------------------------------------------------------------------------
*/
export function drawTableRow(
  page,
  {
    x,
    y,
    columnWidths,
    row,
    font,
    options = {},
  },
) {
  const columns =
    getTableColumns(
      options,
    );

  const {
    body,
  } =
    tableFontSizes(
      columns.length,
    );

  const bottomY =
    y -
    row.height;

  const width =
    totalWidth(
      columnWidths,
      columns,
    );

  /*
    Vertical borders.
  */
  drawColumnBorders(
    page,
    x,
    columnWidths,
    columns,
    y,
    bottomY,
  );

  /*
    Bottom horizontal border.
  */
  page.drawLine({
    start: {
      x,
      y: bottomY,
    },

    end: {
      x:
        x + width,
      y: bottomY,
    },

    thickness: 0.7,

    color: BLACK,
  });

  let cursor = x;

  for (
    const column of
      columns
  ) {
    const lines =
      row.wrapped[
        column.key
      ] || [""];

    const linesHeight =
      measureLinesHeight(
        lines.length,

        body,

        TABLE_LINE_HEIGHT_FACTOR,
      );

    const topInset =
      Math.max(
        (
          row.height -
          linesHeight
        ) /
          2,

        TABLE_CELL_PADDING_Y,
      );

    /*
      Description/Details should be left aligned.

      Everything else is centered.
    */
    const align =
      column.role ===
        "description" ||
      normalizeLabel(
        column.label,
      ).includes(
        "description",
      ) ||
      normalizeLabel(
        column.label,
      ).includes(
        "detail",
      )
        ? "left"
        : "center";

    drawLines(
      page,

      lines,

      {
        x:
          cursor +
          TABLE_CELL_PADDING_X,

        topY:
          y -
          topInset,

        width:
          Math.max(
            4,

            columnWidths[
              column.key
            ] -
              TABLE_CELL_PADDING_X *
                2,
          ),

        font,

        fontSize:
          body,

        color:
          BLACK,

        align,

        lineHeightFactor:
          TABLE_LINE_HEIGHT_FACTOR,
      },
    );

    cursor +=
      columnWidths[
        column.key
      ];
  }

  return bottomY;
}