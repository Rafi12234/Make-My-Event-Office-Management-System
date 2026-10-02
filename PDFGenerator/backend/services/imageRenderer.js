// Aspect-ratio-safe image embedding + sizing for pdf-lib.
// Images are embedded using their original bytes.
// No compression, no pixel resizing, no format conversion.

export async function embedImageBytes(
  pdfDoc,
  bytes,
  mimeType,
) {
  if (mimeType === "image/png") {
    return pdfDoc.embedPng(bytes);
  }

  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg"
  ) {
    return pdfDoc.embedJpg(bytes);
  }

  throw new Error(
    `Unsupported image type: ${mimeType}`,
  );
}

// Fit image inside the available PDF area while
// preserving its original aspect ratio.
//
// This does NOT alter the actual image file.
// It only controls its display size on the PDF page.
export function containImage(
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
  {
    allowUpscale = false,
  } = {},
) {
  const scale = Math.min(
    maxWidth / sourceWidth,
    maxHeight / sourceHeight,
    allowUpscale
      ? Number.POSITIVE_INFINITY
      : 1,
  );

  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

// Draw image horizontally centered.
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
    (contentWidth - width) / 2;

  const y =
    topY - height;

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