import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

const __filename =
  fileURLToPath(
    import.meta.url,
  );

const __dirname =
  path.dirname(
    __filename,
  );

/*
|--------------------------------------------------------------------------
| Official Make My Event Letterhead
|--------------------------------------------------------------------------
*/

const TEMPLATE_PATH =
  process.env
    .MONEY_RECEIPT_TEMPLATE_PATH
    ? path.resolve(
        process.env
          .MONEY_RECEIPT_TEMPLATE_PATH,
      )
    : path.resolve(
        __dirname,
        "../../templates/make-my-event-letter-pad.pdf",
      );

/*
|--------------------------------------------------------------------------
| EXACT SAFE AREA USED BY EXISTING WEBSITE
|--------------------------------------------------------------------------
|
| This area starts BELOW:
|
| - Make My Event logo
| - address
| - phone
| - email
| - website header information
|
| Therefore receipt content must never start above PAGE_CONTENT.top.
|
*/

const PAGE_CONTENT = {
  x: 74,
  right: 562,
  top: 546,
  bottom: 92,
};

PAGE_CONTENT.width =
  PAGE_CONTENT.right -
  PAGE_CONTENT.x;

/*
|--------------------------------------------------------------------------
| Existing Date Position
|--------------------------------------------------------------------------
|
| The letterhead already contains:
|
| Date......................
|
| So the website hides that small area and prints the real date there.
|
*/

const DATE_FIELD = {
  x: 460,
  y: 590,

  maskWidth: 102,
  maskHeight: 48,

  fontSize: 10,

  textOffsetY: 28,
};

/*
|--------------------------------------------------------------------------
| Colors
|--------------------------------------------------------------------------
*/

const COLORS = {
  black: {
    r: 0.06,
    g: 0.06,
    b: 0.09,
  },

  white: {
    r: 1,
    g: 1,
    b: 1,
  },

  gray: {
    r: 0.42,
    g: 0.42,
    b: 0.46,
  },

  lightGray: {
    r: 0.62,
    g: 0.62,
    b: 0.66,
  },

  border: {
    r: 0.82,
    g: 0.82,
    b: 0.85,
  },

  accent: {
    r: 0.42,
    g: 0.24,
    b: 0.64,
  },

  paidGreen: {
    r: 0.02,
    g: 0.45,
    b: 0.31,
  },

  paidGreenBg: {
    r: 0.85,
    g: 0.96,
    b: 0.90,
  },

  dueRed: {
    r: 0.72,
    g: 0.11,
    b: 0.11,
  },

  dueRedBg: {
    r: 0.99,
    g: 0.90,
    b: 0.90,
  },

  partialAmber: {
    r: 0.60,
    g: 0.40,
    b: 0.02,
  },

  partialAmberBg: {
    r: 1,
    g: 0.96,
    b: 0.85,
  },

  neutralGray: {
    r: 0.35,
    g: 0.35,
    b: 0.40,
  },

  neutralGrayBg: {
    r: 0.92,
    g: 0.92,
    b: 0.94,
  },
};

const FONT_SIZES = {
  title: 18,

  subtitle: 10.5,

  sectionHeading: 10.5,

  label: 9,

  value: 10,

  statusBadge: 11,

  footer: 8.5,
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",

  bank_transfer:
    "Bank Transfer",

  cheque:
    "Cheque",

  bkash:
    "bKash",

  nagad:
    "Nagad",

  card:
    "Card",

  other:
    "Other",
};

const PAYMENT_STATUS_LABELS = {
  unpaid:
    "UNPAID",

  partially_paid:
    "PARTIALLY PAID",

  paid:
    "PAID",
};

const BOOKING_STATUS_LABELS = {
  confirmed:
    "CONFIRMED",

  not_confirmed:
    "NOT CONFIRM",
};

const TERMS = [
  "80% of the total money should be paid in advance/confirmation. Advance is not refundable. The rest of the amount needs to be paid for the event date by 1 PM.",

  "Please do not show this proposal to anyone. It's highly confidential. Make My Event has the right to take action on the violation.",

  "Price may change depending on requirements.",

  "VAT is not included in this price.",

  "Items that are being used in the events are rental basis. Make My Event has the full rights to take everything back after the event.",

  "As most of the materials are reused, these might not be as fresh as the brand-new material.",
];

const MIN_SCALE = 0.55;

/*
|--------------------------------------------------------------------------
| Basic Helpers
|--------------------------------------------------------------------------
*/

function color(
  value,
) {
  return rgb(
    value.r,
    value.g,
    value.b,
  );
}

function safeText(
  value,
) {
  return String(
    value ?? "",
  )
    .replace(
      /[\u2018\u2019]/g,
      "'",
    )
    .replace(
      /[\u201C\u201D]/g,
      '"',
    )
    .replace(
      /[\u2013\u2014]/g,
      "-",
    )
    .replace(
      /[^\x09\x0A\x0D\x20-\xFF]/g,
      "?",
    );
}

function formatReceiptDate(
  value,
) {
  if (!value) {
    return "";
  }

  let date;

  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    const [
      year,
      month,
      day,
    ] =
      value.split("-");

    return `${day}/${month}/${String(
      year,
    ).slice(-2)}`;
  }

  date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return safeText(
      value,
    );
  }

  const day =
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    );

  const month =
    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const year =
    String(
      date.getUTCFullYear(),
    ).slice(-2);

  return `${day}/${month}/${year}`;
}

/*
|--------------------------------------------------------------------------
| Money Formatting
|--------------------------------------------------------------------------
|
| Website uses Tk because the standard Helvetica font used by pdf-lib does
| not safely contain the Bangladeshi Taka symbol.
|
*/

function formatMoney(
  amount,
) {
  const value =
    Number(
      amount,
    ) || 0;

  const absolute =
    Math.abs(
      value,
    ).toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    );

  return `${
    value < 0
      ? "-"
      : ""
  }Tk ${absolute}`;
}

/*
|--------------------------------------------------------------------------
| Text Wrapping
|--------------------------------------------------------------------------
*/

function wrapText(
  text,
  font,
  fontSize,
  maxWidth,
) {
  const words =
    safeText(
      text,
    )
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return [""];
  }

  const lines = [];

  let current =
    words[0];

  for (
    const word of words.slice(
      1,
    )
  ) {
    const candidate =
      `${current} ${word}`;

    if (
      font.widthOfTextAtSize(
        candidate,
        fontSize,
      ) <= maxWidth
    ) {
      current =
        candidate;
    } else {
      lines.push(
        current,
      );

      current =
        word;
    }
  }

  lines.push(
    current,
  );

  return lines;
}

function measureLinesHeight(
  lineCount,
  fontSize,
  lineHeightFactor = 1.25,
) {
  return (
    lineCount *
    fontSize *
    lineHeightFactor
  );
}

function drawLines(
  page,
  lines,
  {
    x,
    topY,
    font,
    fontSize,
    textColor,
    lineHeightFactor = 1.25,
  },
) {
  const lineHeight =
    fontSize *
    lineHeightFactor;

  let y =
    topY -
    fontSize;

  for (
    const line of lines
  ) {
    page.drawText(
      safeText(
        line,
      ),
      {
        x,
        y,

        size:
          fontSize,

        font,

        color:
          textColor,
      },
    );

    y -=
      lineHeight;
  }

  return (
    y +
    lineHeight
  );
}

/*
|--------------------------------------------------------------------------
| Amount In Words
|--------------------------------------------------------------------------
*/

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitsToWords(
  number,
) {
  if (number < 20) {
    return ONES[number];
  }

  const tens =
    Math.floor(
      number / 10,
    );

  const ones =
    number % 10;

  return ones
    ? `${TENS[tens]} ${ONES[ones]}`
    : TENS[tens];
}

function threeDigitsToWords(
  number,
) {
  const hundreds =
    Math.floor(
      number / 100,
    );

  const rest =
    number % 100;

  const parts = [];

  if (hundreds) {
    parts.push(
      `${ONES[hundreds]} Hundred`,
    );
  }

  if (rest) {
    parts.push(
      twoDigitsToWords(
        rest,
      ),
    );
  }

  return parts.join(
    " ",
  );
}

function integerToWords(
  value,
) {
  if (value === 0) {
    return "Zero";
  }

  const crore =
    Math.floor(
      value / 1e7,
    );

  const lakh =
    Math.floor(
      (value % 1e7) /
        1e5,
    );

  const thousand =
    Math.floor(
      (value % 1e5) /
        1e3,
    );

  const hundred =
    value % 1e3;

  const parts = [];

  if (crore) {
    parts.push(
      `${threeDigitsToWords(
        crore,
      )} Crore`,
    );
  }

  if (lakh) {
    parts.push(
      `${twoDigitsToWords(
        lakh,
      )} Lakh`,
    );
  }

  if (thousand) {
    parts.push(
      `${twoDigitsToWords(
        thousand,
      )} Thousand`,
    );
  }

  if (hundred) {
    parts.push(
      threeDigitsToWords(
        hundred,
      ),
    );
  }

  return parts.join(
    " ",
  );
}

function amountToWordsBDT(
  amount,
) {
  const numeric =
    Math.round(
      (Number(amount) ||
        0) *
        100,
    ) / 100;

  const isNegative =
    numeric < 0;

  const absolute =
    Math.abs(
      numeric,
    );

  const taka =
    Math.floor(
      absolute,
    );

  const paisa =
    Math.round(
      (absolute -
        taka) *
        100,
    );

  const takaWords =
    integerToWords(
      taka,
    );

  let result =
    `${takaWords} Taka`;

  if (paisa > 0) {
    result +=
      ` And ${twoDigitsToWords(
        paisa,
      )} Paisa`;
  }

  result +=
    " Only";

  return isNegative
    ? `Negative ${result}`
    : result;
}

/*
|--------------------------------------------------------------------------
| Load Letterhead
|--------------------------------------------------------------------------
*/

async function loadTemplatePdf() {
  if (
    !existsSync(
      TEMPLATE_PATH,
    )
  ) {
    throw new Error(
      `Make My Event letterhead template not found: ${TEMPLATE_PATH}`,
    );
  }

  const bytes =
    await readFile(
      TEMPLATE_PATH,
    );

  const pdf =
    await PDFDocument.load(
      bytes,
    );

  if (
    pdf.getPageCount() <
    1
  ) {
    throw new Error(
      "Make My Event letterhead template contains no pages.",
    );
  }

  return pdf;
}

async function createTemplatedPage(
  outputPdf,
  templatePdf,
) {
  const [
    templatePage,
  ] =
    await outputPdf.copyPages(
      templatePdf,
      [0],
    );

  outputPdf.addPage(
    templatePage,
  );

  return templatePage;
}

/*
|--------------------------------------------------------------------------
| Fonts
|--------------------------------------------------------------------------
*/

async function embedFonts(
  pdf,
) {
  return {
    regular:
      await pdf.embedFont(
        StandardFonts.Helvetica,
      ),

    bold:
      await pdf.embedFont(
        StandardFonts.HelveticaBold,
      ),

    italic:
      await pdf.embedFont(
        StandardFonts.HelveticaOblique,
      ),

    boldItalic:
      await pdf.embedFont(
        StandardFonts.HelveticaBoldOblique,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Map Current Mobile Payload -> Website Renderer Structure
|--------------------------------------------------------------------------
*/

function normalizeRendererData(
  data,
) {
  return {
    receiptNo:
      data.receiptNo ||
      "PREVIEW",

    receiptDate:
      data.receiptDate,

    client: {
      name:
        data.clientName,

      phone:
        data.clientPhone,

      email:
        data.clientEmail,

      address:
        data.clientAddress,

      billedTo:
        data.billedTo,
    },

    event: {
      name:
        data.eventName,

      date:
        data.eventDate,

      venue:
        data.eventVenue,

      bookingReference:
        data.bookingReference,

      bookingStatus:
        data.bookingStatus ||
        "not_confirmed",
    },

    payment: {
      total:
        data.totalPayment,

      advance:
        data.advancePayment,

      due:
        data.duePayment,

      method:
        data.paymentMethod ||
        "cash",

      methodOther:
        data.paymentMethodOther,

      transactionReference:
        data.transactionReference,

      status:
        data.paymentStatus ||
        "unpaid",
    },

    remarks:
      data.remarks,
  };
}

/*
|--------------------------------------------------------------------------
| Date Overlay
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This only masks the tiny existing Date placeholder on the official
| letterhead. It does NOT cover the logo/address section.
|
*/

function drawDateOverlay(
  page,
  fonts,
  receiptDate,
) {
  page.drawRectangle({
    x:
      DATE_FIELD.x,

    y:
      DATE_FIELD.y,

    width:
      DATE_FIELD.maskWidth,

    height:
      DATE_FIELD.maskHeight,

    color:
      color(
        COLORS.white,
      ),
  });

  page.drawText(
    `Date: ${formatReceiptDate(
      receiptDate,
    )}`,
    {
      x:
        DATE_FIELD.x,

      y:
        DATE_FIELD.y +
        DATE_FIELD.textOffsetY,

      size:
        DATE_FIELD.fontSize,

      font:
        fonts.regular,

      color:
        color(
          COLORS.black,
        ),
    },
  );
}

/*
|--------------------------------------------------------------------------
| Page 1 Renderer
|--------------------------------------------------------------------------
|
| This is based directly on the existing website Money Receipt renderer.
|
*/

function renderReceiptContent(
  page,
  {
    fonts,
    data,
    scale = 1,
  },
) {
  drawDateOverlay(
    page,
    fonts,
    data.receiptDate,
  );

  /*
   * THIS IS THE IMPORTANT FIX.
   *
   * Start at 546, not 650.
   *
   * Everything above 546 belongs to the Make My Event letterhead.
   */
  let cursorY =
    PAGE_CONTENT.top;

  const fs =
    (base) =>
      base * scale;

  const gap =
    (base) =>
      base * scale;

  function drawLine(
    y,
    thickness = 0.8,
  ) {
    page.drawLine({
      start: {
        x:
          PAGE_CONTENT.x,

        y,
      },

      end: {
        x:
          PAGE_CONTENT.right,

        y,
      },

      thickness,

      color:
        color(
          COLORS.border,
        ),
    });
  }

  /*
   * MONEY RECEIPT title
   */

  const title =
    "MONEY RECEIPT";

  const titleWidth =
    fonts.bold
      .widthOfTextAtSize(
        title,
        FONT_SIZES.title,
      );

  page.drawText(
    title,
    {
      x:
        PAGE_CONTENT.x +
        (
          PAGE_CONTENT.width -
          titleWidth
        ) /
          2,

      y:
        cursorY -
        FONT_SIZES.title,

      size:
        FONT_SIZES.title,

      font:
        fonts.bold,

      color:
        color(
          COLORS.black,
        ),
    },
  );

  cursorY -=
    FONT_SIZES.title +
    14;

  page.drawLine({
    start: {
      x:
        PAGE_CONTENT.x,

      y:
        cursorY,
    },

    end: {
      x:
        PAGE_CONTENT.right,

      y:
        cursorY,
    },

    thickness:
      1.2,

    color:
      color(
        COLORS.accent,
      ),
  });

  cursorY -=
    gap(18);

  /*
   * Receipt Number
   */

  page.drawText(
    `Receipt No: ${
      data.receiptNo ||
      "PREVIEW"
    }`,
    {
      x:
        PAGE_CONTENT.x,

      y:
        cursorY -
        fs(
          FONT_SIZES.value,
        ),

      size:
        fs(
          FONT_SIZES.value,
        ),

      font:
        fonts.bold,

      color:
        color(
          COLORS.black,
        ),
    },
  );

  cursorY -=
    fs(
      FONT_SIZES.value,
    ) +
    gap(20);

  const labelColumnWidth =
    130;

  const valueMaxWidth =
    PAGE_CONTENT.width -
    labelColumnWidth;

  /*
   * Section Heading
   */

  function drawSectionHeading(
    text,
  ) {
    page.drawText(
      text,
      {
        x:
          PAGE_CONTENT.x,

        y:
          cursorY -
          fs(
            FONT_SIZES.sectionHeading,
          ),

        size:
          fs(
            FONT_SIZES.sectionHeading,
          ),

        font:
          fonts.bold,

        color:
          color(
            COLORS.accent,
          ),
      },
    );

    cursorY -=
      fs(
        FONT_SIZES.sectionHeading,
      ) +
      gap(4);

    drawLine(
      cursorY,
    );

    cursorY -=
      gap(10);
  }

  /*
   * Normal key/value row
   */

  function drawRow(
    label,
    value,
    {
      bold = false,
    } = {},
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return;
    }

    const text =
      safeText(
        value,
      );

    const valueFontSize =
      fs(
        FONT_SIZES.value,
      );

    const lines =
      wrapText(
        text,
        bold
          ? fonts.bold
          : fonts.regular,
        valueFontSize,
        valueMaxWidth,
      );

    const blockHeight =
      measureLinesHeight(
        lines.length,
        valueFontSize,
        1.3,
      );

    page.drawText(
      safeText(
        label,
      ),
      {
        x:
          PAGE_CONTENT.x,

        y:
          cursorY -
          valueFontSize,

        size:
          fs(
            FONT_SIZES.label,
          ),

        font:
          fonts.bold,

        color:
          color(
            COLORS.gray,
          ),
      },
    );

    drawLines(
      page,
      lines,
      {
        x:
          PAGE_CONTENT.x +
          labelColumnWidth,

        topY:
          cursorY,

        font:
          bold
            ? fonts.bold
            : fonts.regular,

        fontSize:
          valueFontSize,

        textColor:
          color(
            COLORS.black,
          ),

        lineHeightFactor:
          1.3,
      },
    );

    cursorY -=
      blockHeight +
      gap(6);
  }

  /*
   * Status Badge
   */

  function drawStatusBadge(
    label,
    statusText,
    palette,
  ) {
    if (
      !statusText ||
      !palette
    ) {
      return;
    }

    const badgeFontSize =
      fs(
        FONT_SIZES.statusBadge,
      );

    const badgeTextWidth =
      fonts.bold
        .widthOfTextAtSize(
          statusText,
          badgeFontSize,
        );

    const badgePaddingX =
      gap(12);

    const badgeWidth =
      badgeTextWidth +
      badgePaddingX * 2;

    const badgeHeight =
      badgeFontSize +
      gap(12);

    page.drawText(
      label,
      {
        x:
          PAGE_CONTENT.x,

        y:
          cursorY -
          fs(
            FONT_SIZES.value,
          ),

        size:
          fs(
            FONT_SIZES.label,
          ),

        font:
          fonts.bold,

        color:
          color(
            COLORS.gray,
          ),
      },
    );

    page.drawRectangle({
      x:
        PAGE_CONTENT.x +
        labelColumnWidth,

      y:
        cursorY -
        badgeHeight +
        gap(4),

      width:
        badgeWidth,

      height:
        badgeHeight,

      color:
        color(
          palette.bg,
        ),
    });

    page.drawText(
      statusText,
      {
        x:
          PAGE_CONTENT.x +
          labelColumnWidth +
          badgePaddingX,

        y:
          cursorY -
          badgeHeight +
          gap(4) +
          (
            badgeHeight -
            badgeFontSize
          ) /
            2 +
          1,

        size:
          badgeFontSize,

        font:
          fonts.bold,

        color:
          color(
            palette.text,
          ),
      },
    );

    cursorY -=
      badgeHeight +
      gap(18);
  }

  /*
   * CLIENT INFORMATION
   */

  drawSectionHeading(
    "CLIENT INFORMATION",
  );

  drawRow(
    "Client Name:",
    data.client.name,
  );

  drawRow(
    "Phone:",
    data.client.phone,
  );

  drawRow(
    "Email:",
    data.client.email,
  );

  drawRow(
    "Address:",
    data.client.address,
  );

  drawRow(
    "Billed To:",
    data.client.billedTo,
  );

  cursorY -=
    gap(6);

  /*
   * EVENT INFORMATION
   */

  const hasEventInfo =
    data.event.name ||
    data.event.date ||
    data.event.venue ||
    data.event
      .bookingReference ||
    data.event
      .bookingStatus;

  if (hasEventInfo) {
    drawSectionHeading(
      "EVENT INFORMATION",
    );

    drawRow(
      "Event:",
      data.event.name,
    );

    drawRow(
      "Event Date:",
      data.event.date
        ? formatReceiptDate(
            data.event.date,
          )
        : null,
    );

    drawRow(
      "Venue:",
      data.event.venue,
    );

    drawRow(
      "Booking ID:",
      data.event
        .bookingReference,
    );

    if (
      data.event
        .bookingStatus
    ) {
      cursorY -=
        gap(2);

      const bookingPalette =
        {
          confirmed: {
            text:
              COLORS.paidGreen,

            bg:
              COLORS.paidGreenBg,
          },

          not_confirmed:
            {
              text:
                COLORS.neutralGray,

              bg:
                COLORS.neutralGrayBg,
            },
        }[
          data.event
            .bookingStatus
        ];

      drawStatusBadge(
        "Status:",

        BOOKING_STATUS_LABELS[
          data.event
            .bookingStatus
        ] ||
          safeText(
            data.event
              .bookingStatus,
          )
            .replaceAll(
              "_",
              " ",
            )
            .toUpperCase(),

        bookingPalette ||
          {
            text:
              COLORS.neutralGray,

            bg:
              COLORS.neutralGrayBg,
          },
      );
    }

    cursorY -=
      gap(6);
  }

  /*
   * PAYMENT DETAILS
   */

  drawSectionHeading(
    "PAYMENT DETAILS",
  );

  function drawAmountLine(
    label,
    amount,
    {
      bold = false,
    } = {},
  ) {
    const valueFontSize =
      fs(
        FONT_SIZES.value,
      );

    page.drawText(
      label,
      {
        x:
          PAGE_CONTENT.x,

        y:
          cursorY -
          valueFontSize,

        size:
          valueFontSize,

        font:
          bold
            ? fonts.bold
            : fonts.regular,

        color:
          bold
            ? color(
                COLORS.black,
              )
            : color(
                COLORS.gray,
              ),
      },
    );

    const amountText =
      formatMoney(
        amount,
      );

    const amountFont =
      bold
        ? fonts.bold
        : fonts.regular;

    const amountWidth =
      amountFont
        .widthOfTextAtSize(
          amountText,
          valueFontSize,
        );

    page.drawText(
      amountText,
      {
        x:
          PAGE_CONTENT.right -
          amountWidth,

        y:
          cursorY -
          valueFontSize,

        size:
          valueFontSize,

        font:
          amountFont,

        color:
          bold
            ? color(
                COLORS.black,
              )
            : color(
                COLORS.gray,
              ),
      },
    );

    cursorY -=
      valueFontSize +
      gap(10);
  }

  drawAmountLine(
    "Total Payment",
    data.payment.total,
    {
      bold: true,
    },
  );

  drawAmountLine(
    "Advance Payment",
    data.payment.advance,
    {
      bold: true,
    },
  );

  drawLine(
    cursorY +
    gap(4),
  );

  drawAmountLine(
    "Due Payment",
    data.payment.due,
    {
      bold: true,
    },
  );

  cursorY -=
    gap(8);

  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[
      data.payment.method
    ] ||
    safeText(
      data.payment.method,
    );

  drawRow(
    "Payment Method:",

    paymentMethodLabel ===
      "Other" &&
      data.payment.methodOther
      ? data.payment
          .methodOther
      : paymentMethodLabel,
  );

  drawRow(
    "Transaction/Reference No. / Account No.:",
    data.payment
      .transactionReference,
  );

  cursorY -=
    gap(4);

  /*
   * PAYMENT STATUS
   */

  const paymentPalette =
    {
      paid: {
        text:
          COLORS.paidGreen,

        bg:
          COLORS.paidGreenBg,
      },

      partially_paid: {
        text:
          COLORS.partialAmber,

        bg:
          COLORS.partialAmberBg,
      },

      unpaid: {
        text:
          COLORS.dueRed,

        bg:
          COLORS.dueRedBg,
      },
    }[
      data.payment.status
    ];

  drawStatusBadge(
    "Payment Status:",

    PAYMENT_STATUS_LABELS[
      data.payment.status
    ] ||
      safeText(
        data.payment.status,
      )
        .replaceAll(
          "_",
          " ",
        )
        .toUpperCase(),

    paymentPalette ||
      {
        text:
          COLORS.neutralGray,

        bg:
          COLORS.neutralGrayBg,
      },
  );

  /*
   * AMOUNT RECEIVED IN WORDS
   */

  drawSectionHeading(
    "AMOUNT RECEIVED IN WORDS",
  );

  const wordsFontSize =
    fs(
      FONT_SIZES.value,
    );

  const wordsText =
    amountToWordsBDT(
      data.payment.advance,
    );

  const wordsLines =
    wrapText(
      wordsText,
      fonts.boldItalic,
      wordsFontSize,
      PAGE_CONTENT.width,
    );

  const wordsHeight =
    measureLinesHeight(
      wordsLines.length,
      wordsFontSize,
      1.3,
    );

  drawLines(
    page,
    wordsLines,
    {
      x:
        PAGE_CONTENT.x,

      topY:
        cursorY,

      font:
        fonts.boldItalic,

      fontSize:
        wordsFontSize,

      textColor:
        color(
          COLORS.black,
        ),

      lineHeightFactor:
        1.3,
    },
  );

  cursorY -=
    wordsHeight +
    gap(14);

  /*
   * REMARKS
   */

  if (data.remarks) {
    drawSectionHeading(
      "REMARKS",
    );

    const remarkFontSize =
      fs(
        FONT_SIZES.value,
      );

    const remarkLines =
      wrapText(
        data.remarks,
        fonts.regular,
        remarkFontSize,
        PAGE_CONTENT.width,
      );

    const remarkHeight =
      measureLinesHeight(
        remarkLines.length,
        remarkFontSize,
        1.3,
      );

    drawLines(
      page,
      remarkLines,
      {
        x:
          PAGE_CONTENT.x,

        topY:
          cursorY,

        font:
          fonts.regular,

        fontSize:
          remarkFontSize,

        textColor:
          color(
            COLORS.black,
          ),

        lineHeightFactor:
          1.3,
      },
    );

    cursorY -=
      remarkHeight +
      gap(14);
  }

  /*
   * Receipt footer
   */

  cursorY -=
    gap(10);

  drawLine(
    cursorY,
  );

  cursorY -=
    gap(22);

  const footerFontSize =
    fs(
      FONT_SIZES.footer,
    );

  const thanksText =
    "Thank you for choosing Make My Event.";

  const thanksWidth =
    fonts.italic
      .widthOfTextAtSize(
        thanksText,
        footerFontSize +
          1,
      );

  page.drawText(
    thanksText,
    {
      x:
        PAGE_CONTENT.x +
        (
          PAGE_CONTENT.width -
          thanksWidth
        ) /
          2,

      y:
        cursorY,

      size:
        footerFontSize +
        1,

      font:
        fonts.italic,

      color:
        color(
          COLORS.gray,
        ),
    },
  );

  cursorY -=
    gap(16);

  const authorizedText =
    "Authorized by Make My Event";

  const authorizedWidth =
    fonts.bold
      .widthOfTextAtSize(
        authorizedText,
        footerFontSize,
      );

  page.drawText(
    authorizedText,
    {
      x:
        PAGE_CONTENT.x +
        (
          PAGE_CONTENT.width -
          authorizedWidth
        ) /
          2,

      y:
        cursorY,

      size:
        footerFontSize,

      font:
        fonts.bold,

      color:
        color(
          COLORS.lightGray,
        ),
    },
  );

  return {
    finalY:
      cursorY,
  };
}

/*
|--------------------------------------------------------------------------
| Page 2 - NB / Terms
|--------------------------------------------------------------------------
|
| Also starts at 546, underneath the letterhead.
|
*/

function renderTermsPage(
  page,
  {
    fonts,
  },
) {
  let cursorY =
    PAGE_CONTENT.top;

  const HEADING_SIZE =
    12;

  const ITEM_SIZE =
    10.5;

  const ITEM_GAP =
    10;

  const NUMBER_WIDTH =
    20;

  page.drawText(
    "NB:",
    {
      x:
        PAGE_CONTENT.x,

      y:
        cursorY -
        HEADING_SIZE,

      size:
        HEADING_SIZE,

      font:
        fonts.bold,

      color:
        color(
          COLORS.black,
        ),
    },
  );

  cursorY -=
    HEADING_SIZE +
    16;

  const textMaxWidth =
    PAGE_CONTENT.width -
    NUMBER_WIDTH;

  for (
    const [
      index,
      point,
    ] of TERMS.entries()
  ) {
    const lines =
      wrapText(
        point,
        fonts.bold,
        ITEM_SIZE,
        textMaxWidth,
      );

    const blockHeight =
      measureLinesHeight(
        lines.length,
        ITEM_SIZE,
        1.4,
      );

    page.drawText(
      `${index + 1}.`,
      {
        x:
          PAGE_CONTENT.x,

        y:
          cursorY -
          ITEM_SIZE,

        size:
          ITEM_SIZE,

        font:
          fonts.bold,

        color:
          color(
            COLORS.black,
          ),
      },
    );

    drawLines(
      page,
      lines,
      {
        x:
          PAGE_CONTENT.x +
          NUMBER_WIDTH,

        topY:
          cursorY,

        font:
          fonts.bold,

        fontSize:
          ITEM_SIZE,

        textColor:
          color(
            COLORS.black,
          ),

        lineHeightFactor:
          1.4,
      },
    );

    cursorY -=
      blockHeight +
      ITEM_GAP;
  }
}

/*
|--------------------------------------------------------------------------
| Main Export
|--------------------------------------------------------------------------
*/

export async function generateReceiptPdf(
  flatData,
) {
  const templatePdf =
    await loadTemplatePdf();

  const pdf =
    await PDFDocument.create();

  const fonts =
    await embedFonts(
      pdf,
    );

  const data =
    normalizeRendererData(
      flatData,
    );

  /*
   * PAGE 1
   */

  let page =
    await createTemplatedPage(
      pdf,
      templatePdf,
    );

  let {
    finalY,
  } =
    renderReceiptContent(
      page,
      {
        fonts,
        data,
        scale: 1,
      },
    );

  /*
   * Automatic fit.
   *
   * Same strategy as website:
   * if the content drops below the safe bottom area,
   * recreate the page using a smaller body scale.
   */

  if (
    finalY <
    PAGE_CONTENT.bottom
  ) {
    const overflow =
      PAGE_CONTENT.bottom -
      finalY;

    const availableHeight =
      PAGE_CONTENT.top -
      PAGE_CONTENT.bottom;

    const naturalHeight =
      availableHeight +
      overflow;

    const scale =
      Math.max(
        MIN_SCALE,

        availableHeight /
          naturalHeight,
      );

    pdf.removePage(
      0,
    );

    page =
      await createTemplatedPage(
        pdf,
        templatePdf,
      );

    renderReceiptContent(
      page,
      {
        fonts,
        data,
        scale,
      },
    );
  }

  /*
   * PAGE 2
   */

  const termsPage =
    await createTemplatedPage(
      pdf,
      templatePdf,
    );

  renderTermsPage(
    termsPage,
    {
      fonts,
    },
  );

  const bytes =
    await pdf.save();

  return {
    bytes,

    pageCount:
      pdf.getPageCount(),
  };
}