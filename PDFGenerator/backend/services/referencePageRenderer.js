import { rgb } from "pdf-lib";

import {
  createTemplatedPage,
  DETAIL_DESCRIPTION_FONT_SIZE,
  DETAIL_HEADING_FONT_SIZE,
  DETAIL_HEADING_GAP,
  DETAIL_IMAGE_GAP,
  DETAIL_LINE_HEIGHT_FACTOR,
  PAGE_CONTENT,
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

const BLACK = rgb(
  0,
  0,
  0,
);

/*
|--------------------------------------------------------------------------
| Minimum remaining area worth using for an image
|--------------------------------------------------------------------------
*/
const MIN_USEFUL_IMAGE_SPACE =
  95;

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
        item.itemName ||
          "Item",

        fonts.bold,

        DETAIL_HEADING_FONT_SIZE,

        PAGE_CONTENT.width,
      );

    drawLines(
      page,
      headingLines,
      {
        x:
          PAGE_CONTENT.x,

        topY:
          cursorY,

        width:
          PAGE_CONTENT.width,

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
        Wrap full description once.
      */
      const remainingDescriptionLines =
        wrapText(
          description,

          fonts.regular,

          DETAIL_DESCRIPTION_FONT_SIZE,

          PAGE_CONTENT.width,
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
              PAGE_CONTENT.x,

            topY:
              cursorY,

            width:
              PAGE_CONTENT.width,

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
    for (
      const embeddedImage of
        images
    ) {
      let remaining =
        cursorY -
        PAGE_CONTENT.bottom;

      /*
        If remaining area is too small,
        move image to a new letterhead page.
      */
      if (
        remaining <
        MIN_USEFUL_IMAGE_SPACE
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
      }

      /*
      |--------------------------------------------------------------------------
      | Preserve original image aspect ratio
      |--------------------------------------------------------------------------
      |
      | Never crop.
      | Never stretch.
      | Never distort.
      |
      | allowUpscale:false means a small source image is not artificially
      | enlarged beyond its natural dimensions.
      |
      */
      const fitted =
        containImage(
          embeddedImage.width,

          embeddedImage.height,

          PAGE_CONTENT.width,

          remaining,

          {
            allowUpscale:
              false,
          },
        );

      /*
      |--------------------------------------------------------------------------
      | Draw centered image
      |--------------------------------------------------------------------------
      */
      drawImageCentered(
        page,
        embeddedImage,
        {
          contentX:
            PAGE_CONTENT.x,

          contentWidth:
            PAGE_CONTENT.width,

          topY:
            cursorY,

          width:
            fitted.width,

          height:
            fitted.height,
        },
      );

      /*
        Move cursor below image for the next image.
      */
      cursorY -=
        fitted.height +
        DETAIL_IMAGE_GAP;
    }
  }
}