// Aspect-ratio-safe image embedding + sizing for pdf-lib (guide §29, §36,
// §59) — images are always "contained", never cropped or stretched.

export async function embedImageBytes(pdfDoc, bytes, mimeType) {
  if (mimeType === "image/png") return pdfDoc.embedPng(bytes);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return pdfDoc.embedJpg(bytes);
  throw new Error(`Unsupported image type: ${mimeType}`);
}

// "Contain" fit: scales to fit within maxWidth/maxHeight while preserving
// the source aspect ratio. Does not upscale beyond the image's native
// resolution by default (guide §59 — avoids pixelating low-res photos).
export function containImage(sourceWidth, sourceHeight, maxWidth, maxHeight, { allowUpscale = false } = {}) {
  const scale = Math.min(
    maxWidth / sourceWidth,
    maxHeight / sourceHeight,
    allowUpscale ? Number.POSITIVE_INFINITY : 1,
  );

  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

// Draws an embedded image horizontally centered within [contentX,
// contentX + contentWidth], with its top-left at the given top y.
export function drawImageCentered(page, embeddedImage, { contentX, contentWidth, topY, width, height }) {
  const x = contentX + (contentWidth - width) / 2;
  const y = topY - height;
  page.drawImage(embeddedImage, { x, y, width, height });
  return { x, y, width, height };
}
