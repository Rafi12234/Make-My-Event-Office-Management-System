// Width-aware word wrapping + paragraph line drawing for pdf-lib, which has
// no built-in text layout engine (guide §20). Preserves explicit line
// breaks in the source text.

export function wrapText(text, font, fontSize, maxWidth) {
  const paragraphs = String(text ?? "").split(/\r\n|\r|\n/);
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export function measureLinesHeight(lineCount, fontSize, lineHeightFactor) {
  return Math.max(lineCount, 1) * fontSize * lineHeightFactor;
}

// Draws single-font lines top-down starting at (x, topY). Returns the y
// coordinate just below the last line drawn.
export function drawLines(page, lines, { x, topY, width, font, fontSize, color, align = "left", lineHeightFactor = 1.2 }) {
  const lineHeight = fontSize * lineHeightFactor;
  let y = topY - fontSize; // first baseline sits one font-size below the top

  for (const line of lines) {
    let lineX = x;
    if (align !== "left" && line) {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      if (align === "center") lineX = x + (width - lineWidth) / 2;
      else if (align === "right") lineX = x + width - lineWidth;
    }
    if (line) page.drawText(line, { x: lineX, y, size: fontSize, font, color });
    y -= lineHeight;
  }

  return y + lineHeight;
}

// Wraps a caption made of two differently-styled runs (bold-italic item
// name + regular "- description") into lines of {text, font} tokens, so the
// mixed styling survives wrapping (guide §25-26). Falls back cleanly when
// either run is empty.
export function wrapCaption(itemName, descriptionText, fonts, fontSize, maxWidth) {
  const tokens = [
    ...String(itemName ?? "").split(/\s+/).filter(Boolean).map((text) => ({ text, font: fonts.boldItalic })),
    ...`- ${descriptionText ?? ""}`.split(/\s+/).filter(Boolean).map((text) => ({ text, font: fonts.regular })),
  ];

  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", fontSize);
  const lines = [];
  let current = [];
  let currentWidth = 0;

  for (const token of tokens) {
    const tokenWidth = token.font.widthOfTextAtSize(token.text, fontSize);
    const extra = current.length ? spaceWidth + tokenWidth : tokenWidth;

    if (currentWidth + extra <= maxWidth || current.length === 0) {
      current.push(token);
      currentWidth += extra;
    } else {
      lines.push(current);
      current = [token];
      currentWidth = tokenWidth;
    }
  }
  if (current.length) lines.push(current);

  return lines;
}

// Draws mixed-font caption lines (from wrapCaption) top-down. Returns the y
// coordinate just below the last line drawn.
export function drawCaptionLines(page, lines, { x, topY, fontSize, color, lineHeightFactor = 1.25 }) {
  const lineHeight = fontSize * lineHeightFactor;
  let y = topY - fontSize;

  for (const tokens of lines) {
    let cursorX = x;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      page.drawText(token.text, { x: cursorX, y, size: fontSize, font: token.font, color });
      cursorX += token.font.widthOfTextAtSize(token.text, fontSize);
      if (i < tokens.length - 1) cursorX += token.font.widthOfTextAtSize(" ", fontSize);
    }
    y -= lineHeight;
  }

  return y + lineHeight;
}
