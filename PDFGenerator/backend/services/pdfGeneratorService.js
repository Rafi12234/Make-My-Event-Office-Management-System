import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  PAGE_CONTENT,
  SUMMARY_TABLE_TOP,
  TABLE_TITLE_ROW_HEIGHT,
  createTemplatedPage,
  loadTemplatePdf,
} from "../config/pdfLayout.js";

import { renderFirstPageBackground } from "./firstPageRenderer.js";

import {
  computeColumnWidths,
  drawTableHeader,
  drawTableRow,
  drawTableTitle,
  measureRows,
  measureHeaderHeight,
  splitMeasuredRow,
  drawMergedTotalPriceCell,
} from "./tableRenderer.js";

import { renderReferenceSection } from "./referencePageRenderer.js";

import { renderNbSection } from "./nbSectionRenderer.js";

import { embedImageBytes } from "./imageRenderer.js";

/*
|--------------------------------------------------------------------------
| Embed standard fonts
|--------------------------------------------------------------------------
*/
async function embedFonts(pdfDoc) {
  return {
    regular: await pdfDoc.embedFont(
      StandardFonts.Helvetica,
    ),

    bold: await pdfDoc.embedFont(
      StandardFonts.HelveticaBold,
    ),

    italic: await pdfDoc.embedFont(
      StandardFonts.HelveticaOblique,
    ),

    boldItalic: await pdfDoc.embedFont(
      StandardFonts.HelveticaBoldOblique,
    ),
  };
}

/*
|--------------------------------------------------------------------------
| Embed all item images into output PDF
|--------------------------------------------------------------------------
*/
async function embedItemImages(
  outputPdf,
  items,
) {
  const prepared = [];

  for (const item of items) {
    const embeddedImages = [];

    for (
      const image of
        item.referenceImages || []
    ) {
      embeddedImages.push(
        await embedImageBytes(
          outputPdf,
          image.bytes,
          image.mimeType,
        ),
      );
    }

    prepared.push({
      ...item,
      embeddedImages,
    });
  }

  return prepared;
}

/*
|--------------------------------------------------------------------------
| Draw summary table with pagination
|--------------------------------------------------------------------------
*/
async function drawTableSection(
  outputPdf,
  {
    firstPage,
    templatePdf,
    eventTitle,
    rows,
    fonts,
    columnWidths,
    tableOptions,
  },
) {
  let page = firstPage;
  let y;
  let dataTopY;

  const headerHeight = measureHeaderHeight(
    columnWidths,
    fonts.bold,
    tableOptions,
  );

  const continuationRowMaxHeight =
    (SUMMARY_TABLE_TOP - PAGE_CONTENT.bottom) -
    TABLE_TITLE_ROW_HEIGHT -
    headerHeight;

  async function beginTablePage(nextPage) {
    page = nextPage;

    y = drawTableTitle(page, {
      x: PAGE_CONTENT.x,
      y: SUMMARY_TABLE_TOP,
      width: PAGE_CONTENT.width,
      title: eventTitle,
      font: fonts.bold,
    });

    y = drawTableHeader(page, {
      x: PAGE_CONTENT.x,
      y,
      columnWidths,
      font: fonts.bold,
      options: tableOptions,
    });

    // The merged Price cell starts directly below the header row.
    dataTopY = y;
  }

  function finalizeCurrentTablePage() {
    if (typeof dataTopY !== "number" || typeof y !== "number" || y >= dataTopY) {
      return;
    }

    drawMergedTotalPriceCell(page, {
      x: PAGE_CONTENT.x,
      topY: dataTopY,
      bottomY: y,
      columnWidths,
      font: fonts.bold,
      options: tableOptions,
    });
  }

  await beginTablePage(firstPage);

  for (const row of rows) {
    /*
    |--------------------------------------------------------------------------
    | Very tall row
    |--------------------------------------------------------------------------
    */
    if (row.height > continuationRowMaxHeight) {
      // If this page already has data, close its merged Price cell first and
      // start the oversized row on a fresh continuation page.
      if (y < dataTopY) {
        finalizeCurrentTablePage();
        const nextPage = await createTemplatedPage(outputPdf, templatePdf);
        await beginTablePage(nextPage);
      }

      const segments = splitMeasuredRow(
        row,
        continuationRowMaxHeight,
        columnWidths,
        tableOptions,
      );

      for (const [segmentIndex, segment] of segments.entries()) {
        if (segmentIndex > 0) {
          finalizeCurrentTablePage();
          const nextPage = await createTemplatedPage(outputPdf, templatePdf);
          await beginTablePage(nextPage);
        }

        y = drawTableRow(page, {
          x: PAGE_CONTENT.x,
          y,
          columnWidths,
          row: segment,
          font: fonts.regular,
          options: tableOptions,
        });
      }

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Normal row pagination
    |--------------------------------------------------------------------------
    */
    if (y - row.height < PAGE_CONTENT.bottom) {
      finalizeCurrentTablePage();
      const nextPage = await createTemplatedPage(outputPdf, templatePdf);
      await beginTablePage(nextPage);
    }

    y = drawTableRow(page, {
      x: PAGE_CONTENT.x,
      y,
      columnWidths,
      row,
      font: fonts.regular,
      options: tableOptions,
    });
  }

  finalizeCurrentTablePage();

  return {
    page,
    y,
  };
}


/*
|--------------------------------------------------------------------------
| Main PDF generation service
|--------------------------------------------------------------------------
*/
export async function generatePdfDocument({
  templatePath,
  eventDate,
  eventTitle,
  items,

  /*
    meeting | excel
  */
  sourceMode = "meeting",

  /*
    Used only in Client Meeting mode
  */
  selectedColumns = [],

  /*
    Used only in Excel mode

    Example:
    [
      { key: "col_0", label: "Items", role: "item" },
      { key: "col_1", label: "Details", role: "description" },
      { key: "col_2", label: "Material", role: null }
    ]
  */
  excelColumns = [],

  nbPoints = [],

  // Overall meeting total. This is intentionally not an item-wise column.
  totalPrice = null,
}) {
  if (!items?.length) {
    throw new Error(
      "At least one event item is required.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Load letterhead template
  |--------------------------------------------------------------------------
  */
  const templatePdf =
    await loadTemplatePdf(
      templatePath,
    );

  /*
  |--------------------------------------------------------------------------
  | Create result PDF
  |--------------------------------------------------------------------------
  */
  const outputPdf =
    await PDFDocument.create();

  const fonts =
    await embedFonts(
      outputPdf,
    );

  /*
  |--------------------------------------------------------------------------
  | Prepare item images
  |--------------------------------------------------------------------------
  */
  const preparedItems =
    await embedItemImages(
      outputPdf,
      items,
    );

  /*
  |--------------------------------------------------------------------------
  | Common summary-table configuration
  |--------------------------------------------------------------------------
  |
  | Meeting mode:
  |
  | SL | Item | Description | QTY | optional columns
  |
  | Excel mode:
  |
  | Exact uploaded Excel columns/order
  |
  */
  const tableOptions = {
    sourceMode,
    selectedColumns,
    excelColumns,
    totalPrice,
  };

  /*
  |--------------------------------------------------------------------------
  | First letterhead page
  |--------------------------------------------------------------------------
  */
  const firstPage =
    await renderFirstPageBackground(
      outputPdf,
      templatePdf,
      eventDate,
    );

  /*
  |--------------------------------------------------------------------------
  | Calculate dynamic column widths
  |--------------------------------------------------------------------------
  |
  | In Excel mode this uses all uploaded Excel columns.
  |
  */
  const columnWidths =
    computeColumnWidths(
      PAGE_CONTENT.width,
      tableOptions,
    );

  /*
  |--------------------------------------------------------------------------
  | Measure all rows before drawing
  |--------------------------------------------------------------------------
  */
  const rows =
    measureRows(
      preparedItems,
      columnWidths,
      fonts,
      tableOptions,
    );

  /*
  |--------------------------------------------------------------------------
  | Draw summary table
  |--------------------------------------------------------------------------
  */
  const afterTable =
    await drawTableSection(
      outputPdf,
      {
        firstPage,
        templatePdf,
        eventTitle,
        rows,
        fonts,
        columnWidths,
        tableOptions,
      },
    );

  /*
  |--------------------------------------------------------------------------
  | N.B. section
  |--------------------------------------------------------------------------
  |
  | The N.B. editor may be collapsed in the frontend,
  | but N.B. still appears in the generated PDF.
  |
  */
  await renderNbSection(
    outputPdf,
    {
      nbPoints,
      fonts,
      templatePdf,
      page: afterTable.page,
      y: afterTable.y,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | Detailed item/reference pages
  |--------------------------------------------------------------------------
  |
  | Important for Excel mode:
  |
  | subtotal / total / footer rows may exist in the Excel table.
  |
  | Example:
  |
  | Items = ""
  | Details = ""
  | Qty = "Sub Total"
  | TSqft = "3443"
  |
  | Those rows stay in the summary table, but they should NOT produce
  | a separate item reference page.
  |
  | renderReferenceSection skips rows whose itemName is blank.
  |
  */
  await renderReferenceSection(
    outputPdf,
    {
      items:
        preparedItems,

      fonts,

      templatePdf,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | Final save
  |--------------------------------------------------------------------------
  */
  const bytes =
    await outputPdf.save();

  return {
    bytes,

    pageCount:
      outputPdf.getPageCount(),
  };
}