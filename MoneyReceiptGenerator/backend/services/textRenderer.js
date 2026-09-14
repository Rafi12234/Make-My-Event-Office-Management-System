// Minimal, self-contained text-wrapping/drawing helpers for the Money
// Receipt renderer. Deliberately NOT shared with the PDF Generator module's
// own textRenderer.js — kept logically separate per module, and the needs
// here are simpler (single-font wrapping only, no mixed-run captions).

// Greedy word-wrap: splits `text` into lines that each fit within maxWidth
// at the given font/size.
export function wrapText(text, font, fontSize, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);

  return lines;
}

export function measureLinesHeight(lineCount, fontSize, lineHeightFactor = 1.25) {
  return lineCount * fontSize * lineHeightFactor;
}

// Draws left-aligned wrapped lines top-down starting at `topY`. Returns the
// y coordinate just below the last line drawn.
export function drawLines(page, lines, { x, topY, font, fontSize, color, lineHeightFactor = 1.25 }) {
  const lineHeight = fontSize * lineHeightFactor;
  let y = topY - fontSize;

  for (const line of lines) {
    page.drawText(line, { x, y, size: fontSize, font, color });
    y -= lineHeight;
  }

  return y + lineHeight;
}
