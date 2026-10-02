import { rgb } from "pdf-lib";

import {
  createTemplatedPage,
  DETAIL_DESCRIPTION_FONT_SIZE,
  DETAIL_HEADING_FONT_SIZE,
  DETAIL_HEADING_GAP,
  DETAIL_IMAGE_GAP,
  DETAIL_LINE_HEIGHT_FACTOR,
  PAGE_CONTENT,
  PAGE_WIDTH,
} from "../config/pdfLayout.js";

import {
  containImage,
  drawImageCentered,
} from "./imageRenderer.js";

import {
  drawLines,
  measureLinesHeight,
  wrapText,
} from "./textRenderer.js";

const BLACK = rgb(0, 0, 0);

/*
|--------------------------------------------------------------------------
| Reference/detail page horizontal layout
|--------------------------------------------------------------------------
|
| PAGE_CONTENT is still used for:
| - top
| - bottom
| - available vertical height
|
| But detail/reference pages use their own equal left/right margins.
|
| Previous global margins:
| Left  = 74
| Right = 50
|
| New reference-page margins:
| Left  = 46
| Right = 46
|
*/
const DETAIL_SIDE_MARGIN = 46;

const DETAIL_CONTENT = {
  x: DETAIL_SIDE_MARGIN,
  right: PAGE_WIDTH - DETAIL_SIDE_MARGIN,
};

DETAIL_CONTENT.width =
  DETAIL_CONTENT.right -
  DETAIL_CONTENT.x;

/*
|--------------------------------------------------------------------------
| Minimum remaining area worth using for an image
|--------------------------------------------------------------------------
*/
const MIN_USEFUL_IMAGE_SPACE = 95;

/*
|--------------------------------------------------------------------------
| Create one normal letterhead page
|--------------------------------------------------------------------------
*/
async function newPage(
  outputPdf,
  templatePdf,
) {
  return createTemplatedPage(
    outputPdf,
    templatePdf,
  );
}

/*
|--------------------------------------------------------------------------
| Render detailed/reference pages
|--------------------------------------------------------------------------
|
| Each real item is rendered as:
|
| Item Name
|
| Description / Details
|
| Image 1
| Image 2
| Image 3
|
| Excel subtotal/footer rows are ignored here because they have no itemName.
|
*/
export async function renderReferenceSection(
  outputPdf,
  {
    items,
    fonts,
    templatePdf,
  },
) {
  for (const item of items) {
    /*
    |--------------------------------------------------------------------------
    | Skip non-item Excel rows
    |--------------------------------------------------------------------------
    |
    | Example Excel row:
    |
    | Items   = ""
    | Details = ""
    | Qty     = "Sub Total"
    | TSqft   = "3443"
    | Price   = "0"
    |
    | It belongs in the summary table only.
    |
    */
    if (
      !String(
        item.itemName || "",
      ).trim()
    ) {
      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Every real item starts on its own letterhead page
    |--------------------------------------------------------------------------
    */
    let page =
      await newPage(
        outputPdf,
        templatePdf,
      );

    let cursorY =
      PAGE_CONTENT.top;

    /*
    |--------------------------------------------------------------------------
    | Item heading
    |--------------------------------------------------------------------------
    */
    const headingLines =
      wrapText(
        item.itemName || "Item",
        fonts.bold,
        DETAIL_HEADING_FONT_SIZE,
        DETAIL_CONTENT.width,
      );

    drawLines(
      page,
      headingLines,
      {
        x:
          DETAIL_CONTENT.x,

        topY:
          cursorY,

        width:
          DETAIL_CONTENT.width,

        font:
          fonts.bold,

        fontSize:
          DETAIL_HEADING_FONT_SIZE,

        color:
          BLACK,

        lineHeightFactor:
          DETAIL_LINE_HEIGHT_FACTOR,
      },
    );

    cursorY -=
      measureLinesHeight(
        headingLines.length,
        DETAIL_HEADING_FONT_SIZE,
        DETAIL_LINE_HEIGHT_FACTOR,
      );

    /*
    |--------------------------------------------------------------------------
    | Description
    |--------------------------------------------------------------------------
    |
    | customCaption has priority if present.
    |
    | Otherwise:
    |
    | Client Meeting mode -> Description
    | Excel mode          -> Details/Description mapped into item.description
    |
    */
    const description =
      String(
        item.customCaption?.trim() ||
          item.description ||
          "",
      ).trim();

    if (description) {
      cursorY -=
        DETAIL_HEADING_GAP;

      /*
        Wrap full description once using the wider,
        symmetrical reference-page content area.
      */
      const remainingDescriptionLines =
        wrapText(
          description,
          fonts.regular,
          DETAIL_DESCRIPTION_FONT_SIZE,
          DETAIL_CONTENT.width,
        );

      const lineHeight =
        DETAIL_DESCRIPTION_FONT_SIZE *
        DETAIL_LINE_HEIGHT_FACTOR;

      /*
      |--------------------------------------------------------------------------
      | Description pagination
      |--------------------------------------------------------------------------
      |
      | Very long descriptions continue onto fresh letterhead pages.
      |
      */
      while (
        remainingDescriptionLines.length
      ) {
        let lineCapacity =
          Math.floor(
            (
              cursorY -
              PAGE_CONTENT.bottom
            ) /
              lineHeight,
          );

        /*
          No room left on current page.
        */
        if (
          lineCapacity < 1
        ) {
          page =
            await newPage(
              outputPdf,
              templatePdf,
            );

          cursorY =
            PAGE_CONTENT.top;

          lineCapacity =
            Math.max(
              1,
              Math.floor(
                PAGE_CONTENT.height /
                  lineHeight,
              ),
            );
        }

        /*
          Draw only the number of lines that fit.
        */
        const chunk =
          remainingDescriptionLines.splice(
            0,
            lineCapacity,
          );

        drawLines(
          page,
          chunk,
          {
            x:
              DETAIL_CONTENT.x,

            topY:
              cursorY,

            width:
              DETAIL_CONTENT.width,

            font:
              fonts.regular,

            fontSize:
              DETAIL_DESCRIPTION_FONT_SIZE,

            color:
              BLACK,

            lineHeightFactor:
              DETAIL_LINE_HEIGHT_FACTOR,
          },
        );

        cursorY -=
          measureLinesHeight(
            chunk.length,
            DETAIL_DESCRIPTION_FONT_SIZE,
            DETAIL_LINE_HEIGHT_FACTOR,
          );

        /*
          More description remains:
          continue on next letterhead page.
        */
        if (
          remainingDescriptionLines.length
        ) {
          page =
            await newPage(
              outputPdf,
              templatePdf,
            );

          cursorY =
            PAGE_CONTENT.top;
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Item images
    |--------------------------------------------------------------------------
    |
    | Meeting mode:
    | Images can come from Client Meeting snapshot.
    |
    | Excel mode:
    | Images are manually uploaded per item by the employee.
    |
    | Multiple images per item are supported.
    |
    */
    const images =
      item.embeddedImages || [];

    /*
      An item without images still gets its heading/description page.
    */
    if (
      !images.length
    ) {
      continue;
    }

    cursorY -=
      DETAIL_IMAGE_GAP;

    /*
    |--------------------------------------------------------------------------
    | Draw images sequentially
    |--------------------------------------------------------------------------
    */
for (const embeddedImage of images) {
  /*
  |--------------------------------------------------------------------------
  | Calculate the image size using the FULL page content area
  |--------------------------------------------------------------------------
  |
  | Important:
  | Do NOT calculate image size using the remaining space on the current page.
  |
  | Otherwise the second/third image gets smaller just because there is less
  | space left after the previous image.
  |
  */
  let fitted =
    containImage(
      embeddedImage.width,
      embeddedImage.height,
      DETAIL_CONTENT.width,
      PAGE_CONTENT.height,
      {
        allowUpscale: true,
      },
    );

  let remaining =
    cursorY -
    PAGE_CONTENT.bottom;

  /*
  |--------------------------------------------------------------------------
  | If the image cannot fit at its normal size, start a new page
  |--------------------------------------------------------------------------
  */
  if (
    fitted.height >
    remaining
  ) {
    page =
      await newPage(
        outputPdf,
        templatePdf,
      );

    cursorY =
      PAGE_CONTENT.top;

    remaining =
      PAGE_CONTENT.height;

    /*
     * Recalculate against the full fresh page.
     */
    fitted =
      containImage(
        embeddedImage.width,
        embeddedImage.height,
        DETAIL_CONTENT.width,
        PAGE_CONTENT.height,
        {
          allowUpscale: true,
        },
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Draw image
  |--------------------------------------------------------------------------
  */
  drawImageCentered(
    page,
    embeddedImage,
    {
      contentX:
        DETAIL_CONTENT.x,

      contentWidth:
        DETAIL_CONTENT.width,

      topY:
        cursorY,

      width:
        fitted.width,

      height:
        fitted.height,
    },
  );

  /*
   * Move cursor below the image.
   */
  cursorY -=
    fitted.height +
    DETAIL_IMAGE_GAP;
}}}