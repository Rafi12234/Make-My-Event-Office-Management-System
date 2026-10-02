import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| PDF image optimization
|--------------------------------------------------------------------------
|
| Original uploaded/meeting images are NOT modified.
|
| Images are:
| 1. Read from their original location.
| 2. Resized/compressed only in memory.
| 3. Embedded into the generated PDF.
| 4. The temporary compressed buffer disappears afterward.
|
*/

const PDF_IMAGE_MAX_WIDTH = 1600;
const PDF_IMAGE_MAX_HEIGHT = 1600;
const PDF_IMAGE_JPEG_QUALITY = 78;

/*
|--------------------------------------------------------------------------
| Optimize image before PDF embedding
|--------------------------------------------------------------------------
*/
async function optimizeImageForPdf(
  bytes,
) {
  return sharp(bytes)
    .rotate()
    .resize({
      width:
        PDF_IMAGE_MAX_WIDTH,

      height:
        PDF_IMAGE_MAX_HEIGHT,

      fit:
        "inside",

      withoutEnlargement:
        true,
    })
    /*
     * PNG reference photos are converted to JPEG as well.
     *
     * flatten() gives transparent PNG areas a white background
     * instead of turning them black when converted to JPEG.
     */
    .flatten({
      background:
        "#ffffff",
    })
    .jpeg({
      quality:
        PDF_IMAGE_JPEG_QUALITY,

      progressive:
        true,

      mozjpeg:
        true,
    })
    .toBuffer();
}

/*
|--------------------------------------------------------------------------
| Embed optimized image into PDF
|--------------------------------------------------------------------------
*/
export async function embedImageBytes(
  pdfDoc,
  bytes,
  mimeType,
) {
  if (
    mimeType !== "image/jpeg" &&
    mimeType !== "image/jpg" &&
    mimeType !== "image/png"
  ) {
    throw new Error(
      `Unsupported image type: ${mimeType}`,
    );
  }

  /*
   * Compress a COPY in memory.
   *
   * The original image file is never changed.
   */
  const optimizedBytes =
    await optimizeImageForPdf(
      bytes,
    );

  /*
   * All optimized reference images are JPEG,
   * including PNG source files.
   */
  return pdfDoc.embedJpg(
    optimizedBytes,
  );
}

/*
|--------------------------------------------------------------------------
| Aspect-ratio-safe contain sizing
|--------------------------------------------------------------------------
|
| This only controls how large the already-embedded image appears on
| the PDF page.
|
| The actual file-size reduction happens in optimizeImageForPdf().
|
*/
export function containImage(
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
  {
    allowUpscale = false,
  } = {},
) {
  const scale =
    Math.min(
      maxWidth /
        sourceWidth,

      maxHeight /
        sourceHeight,

      allowUpscale
        ? Number.POSITIVE_INFINITY
        : 1,
    );

  return {
    width:
      sourceWidth *
      scale,

    height:
      sourceHeight *
      scale,
  };
}

/*
|--------------------------------------------------------------------------
| Draw image centered
|--------------------------------------------------------------------------
*/
export function drawImageCentered(
  page,
  embeddedImage,
  {
    contentX,
    contentWidth,
    topY,
    width,
    height,
  },
) {
  const x =
    contentX +
    (
      contentWidth -
      width
    ) /
      2;

  const y =
    topY -
    height;

  page.drawImage(
    embeddedImage,
    {
      x,
      y,
      width,
      height,
    },
  );

  return {
    x,
    y,
    width,
    height,
  };
}