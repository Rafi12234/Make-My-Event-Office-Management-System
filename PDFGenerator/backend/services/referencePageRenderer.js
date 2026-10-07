import { rgb } from "pdf-lib";

import {
  createTemplatedPage,
  DETAIL_CONTENT_TOP,
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
| Detail pages use equal left/right margins.
|
| This gives images slightly more usable width while keeping
| them safely inside the letterhead artwork.
|
*/

const DETAIL_SIDE_MARGIN = 46;


const DETAIL_CONTENT = {
  x: DETAIL_SIDE_MARGIN,
  right:
    PAGE_WIDTH -
    DETAIL_SIDE_MARGIN,
};


DETAIL_CONTENT.width =
  DETAIL_CONTENT.right -
  DETAIL_CONTENT.x;


/*
|--------------------------------------------------------------------------
| Detail-page usable height
|--------------------------------------------------------------------------
|
| DETAIL_CONTENT_TOP is higher than the previous PAGE_CONTENT.top.
|
| This removes the large blank gap below the Make My Event logo.
|
*/

const DETAIL_PAGE_HEIGHT =
  DETAIL_CONTENT_TOP -
  PAGE_CONTENT.bottom;


/*
|--------------------------------------------------------------------------
| Create letterhead page
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
| Normal image size
|--------------------------------------------------------------------------
|
| This calculates the normal/reference image size.
|
| If this normal size fits under the Item Name + Description,
| we use it unchanged.
|
*/

function getNormalImageSize(
  embeddedImage,
) {
  return containImage(
    embeddedImage.width,
    embeddedImage.height,

    DETAIL_CONTENT.width,

    DETAIL_PAGE_HEIGHT,

    {
      allowUpscale: true,
    },
  );
}


/*
|--------------------------------------------------------------------------
| Adaptive first-image sizing
|--------------------------------------------------------------------------
|
| The first image should remain on the same page as:
|
| Item Name
| Description
| Image
|
| Rules:
|
| 1. If normal image fits:
|       Do nothing.
|
| 2. If normal image exceeds the bottom of the page:
|       Reduce only enough to make it fit.
|
| The aspect ratio is always preserved.
|
*/

function fitFirstImageToItemPage(
  embeddedImage,
  normalSize,
  remainingHeight,
) {
  /*
   * Already fits normally.
   * Do not resize unnecessarily.
   */
  if (
    normalSize.height <=
    remainingHeight
  ) {
    return normalSize;
  }


  /*
   * It is too tall.
   *
   * Reduce only enough to fit into
   * the remaining space.
   */
  return containImage(
    embeddedImage.width,
    embeddedImage.height,

    DETAIL_CONTENT.width,

    Math.max(
      1,
      remainingHeight,
    ),

    {
      allowUpscale: true,
    },
  );
}


/*
|--------------------------------------------------------------------------
| Render detailed/reference pages
|--------------------------------------------------------------------------
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
    | Ignore non-item Excel rows
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | Item = ""
    | Qty = "Sub Total"
    |
    | Such rows belong only in the summary table.
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
    | Images
    |--------------------------------------------------------------------------
    */

    const images =
      item.embeddedImages || [];


    /*
     * Do not generate an empty detail page
     * for an item that has no images.
     *
     * It still remains visible in the main summary table.
     */

    if (!images.length) {
      continue;
    }


    /*
    |--------------------------------------------------------------------------
    | Every actual item starts on a fresh page
    |--------------------------------------------------------------------------
    */

    let page =
      await newPage(
        outputPdf,
        templatePdf,
      );


    /*
     * Start substantially closer to the logo.
     */
    let cursorY =
      DETAIL_CONTENT_TOP;


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
    | customCaption has priority.
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


      const descriptionLines =
        wrapText(
          description,

          fonts.regular,

          DETAIL_DESCRIPTION_FONT_SIZE,

          DETAIL_CONTENT.width,
        );


      const lineHeight =
        DETAIL_DESCRIPTION_FONT_SIZE *
        DETAIL_LINE_HEIGHT_FACTOR;


      let lineIndex = 0;


      /*
      |--------------------------------------------------------------------------
      | Long-description protection
      |--------------------------------------------------------------------------
      |
      | Normally the description will fit easily.
      |
      | If somebody enters a very long description,
      | it continues onto a fresh letterhead page
      | instead of being clipped.
      |
      */

      while (
        lineIndex <
        descriptionLines.length
      ) {

        const availableHeight =
          cursorY -
          PAGE_CONTENT.bottom;


        let lineCapacity =
          Math.floor(
            availableHeight /
              lineHeight,
          );


        /*
         * No text space left.
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
            DETAIL_CONTENT_TOP;


          lineCapacity =
            Math.max(
              1,

              Math.floor(
                DETAIL_PAGE_HEIGHT /
                  lineHeight,
              ),
            );
        }


        const chunk =
          descriptionLines.slice(
            lineIndex,

            lineIndex +
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


        lineIndex +=
          chunk.length;


        /*
         * More description remains.
         */
        if (
          lineIndex <
          descriptionLines.length
        ) {

          page =
            await newPage(
              outputPdf,
              templatePdf,
            );


          cursorY =
            DETAIL_CONTENT_TOP;
        }
      }
    }


    /*
    |--------------------------------------------------------------------------
    | Gap between description and image
    |--------------------------------------------------------------------------
    */

    cursorY -=
      DETAIL_IMAGE_GAP;


    /*
    |--------------------------------------------------------------------------
    | Draw images
    |--------------------------------------------------------------------------
    */

    for (
      let imageIndex = 0;
      imageIndex < images.length;
      imageIndex += 1
    ) {

      const embeddedImage =
        images[imageIndex];


      /*
       * Calculate the image's normal display size.
       */
      const normalSize =
        getNormalImageSize(
          embeddedImage,
        );


      let remainingHeight =
        cursorY -
        PAGE_CONTENT.bottom;


      let fitted =
        normalSize;


      /*
      |--------------------------------------------------------------------------
      | FIRST IMAGE
      |--------------------------------------------------------------------------
      |
      | Keep first image together with:
      |
      | Item Name
      | Description
      |
      */

      if (
        imageIndex === 0
      ) {

        fitted =
          fitFirstImageToItemPage(
            embeddedImage,

            normalSize,

            remainingHeight,
          );
      }


      /*
      |--------------------------------------------------------------------------
      | SECOND / THIRD / OTHER IMAGES
      |--------------------------------------------------------------------------
      |
      | We do NOT shrink these simply because the current page is almost full.
      |
      | Instead they start on a fresh page at normal size.
      |
      */

      else if (
        normalSize.height >
        remainingHeight
      ) {

        page =
          await newPage(
            outputPdf,
            templatePdf,
          );


        cursorY =
          DETAIL_CONTENT_TOP;


        remainingHeight =
          cursorY -
          PAGE_CONTENT.bottom;


        /*
         * Normally normalSize will fit now.
         *
         * Very tall portrait images still receive
         * standard contain fitting.
         */

        fitted =
          normalSize.height <=
          remainingHeight

            ? normalSize

            : containImage(
                embeddedImage.width,

                embeddedImage.height,

                DETAIL_CONTENT.width,

                remainingHeight,

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
       * Continue below image.
       */

      cursorY -=
        fitted.height +
        DETAIL_IMAGE_GAP;
    }
  }
}