import path from "node:path";
import crypto from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import {
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { generatePdfDocument } from "../services/pdfGeneratorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const backendSrcDirectory = process.env.BACKEND_SRC_DIR
  ? path.resolve(process.env.BACKEND_SRC_DIR)
  : path.resolve(
      __dirname,
      "../../../backend/mme_node_express_backend/src",
    );

const { prisma } = require(
  path.join(
    backendSrcDirectory,
    "config/prisma.js",
  ),
);

const {
  formatDateOnly,
  formatDateTime,
  parseDateOnly,
} = require(
  path.join(
    backendSrcDirectory,
    "utils/dbDates.js",
  ),
);

const storageRootDirectory =
  process.env.PDF_GENERATOR_STORAGE_DIR
    ? path.resolve(
        process.env.PDF_GENERATOR_STORAGE_DIR,
      )
    : path.resolve(
        __dirname,
        "../storage",
      );

const generatedDirectory = path.join(
  storageRootDirectory,
  "generated",
);

const sourceImagesDirectory = path.join(
  storageRootDirectory,
  "source-images",
);

const meetingUploadsRootDirectory =
  process.env.MEETING_UPLOADS_DIR
    ? path.resolve(
        process.env.MEETING_UPLOADS_DIR,
      )
    : path.resolve(
        backendSrcDirectory,
        "../uploads",
      );

const templatePath =
  process.env.PDF_GENERATOR_TEMPLATE_PATH
    ? path.resolve(
        process.env.PDF_GENERATOR_TEMPLATE_PATH,
      )
    : path.resolve(
        __dirname,
        "../templates/make-my-event-letter-pad.pdf",
      );

mkdirSync(generatedDirectory, {
  recursive: true,
});

mkdirSync(sourceImagesDirectory, {
  recursive: true,
});

const ALLOWED_OPTIONAL_COLUMNS = [
  "size",
  "sqft",
  "tsqft",
  "unit",
  "price",
];

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

const MAX_ITEMS = 250;
const MAX_IMAGES_PER_ITEM = 20;
const MAX_NB_POINTS = 30;

/*
|--------------------------------------------------------------------------
| Default PDF N.B. terms
|--------------------------------------------------------------------------
|
| These are stored in every new PDF draft.
| They are also restored to an old draft if that draft has no N.B. points.
|
*/
const DEFAULT_PDF_NB_POINTS = [
  "80% of the total money should be paid in advance/confirmation. Advance is not refundable. The rest of the amount needs to be paid for the event date by 1 PM.",

  "Please do not show this proposal to anyone. It's highly confidential. Make MyEvent has the right to take action on the violation.",

  "Price may change depending on requirements.",

  "VAT is not included in this price.",

  "Items that are being used in the events are rental basis. Make My Event has the fullrights to take everything back after the event.",

  "As most of the materials are reused, these might not be as fresh as the brand-new material",
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isValidRowKey(rowKey) {
  return /^[0-9a-fA-F-]{36}$/.test(
    String(rowKey || ""),
  );
}

function toPositiveBigInt(value) {
  try {
    const id = BigInt(value);

    return id > 0n
      ? id
      : null;
  } catch {
    return null;
  }
}

function humanizeItemKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase(),
    );
}

function inferMimeType(
  fileName = "",
) {
  const ext = path
    .extname(String(fileName))
    .toLowerCase();

  if (
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".jfif"
  ) {
    return "image/jpeg";
  }

  if (ext === ".png") {
    return "image/png";
  }

  if (ext === ".webp") {
    return "image/webp";
  }

  if (ext === ".gif") {
    return "image/gif";
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Standard meeting-mode optional columns
|--------------------------------------------------------------------------
*/

function sanitizeSelectedColumns(
  raw,
) {
  const values =
    Array.isArray(raw)
      ? raw
      : [];

  return ALLOWED_OPTIONAL_COLUMNS.filter(
    (key) =>
      values.includes(key),
  );
}

/*
|--------------------------------------------------------------------------
| Dynamic Excel columns
|--------------------------------------------------------------------------
|
| Example:
|
| [
|   {
|     key: "col_0",
|     label: "Items",
|     role: "item"
|   },
|   {
|     key: "col_1",
|     label: "Details",
|     role: "description"
|   },
|   {
|     key: "col_2",
|     label: "Material",
|     role: null
|   }
| ]
|
| Only Item/Items and Description/Details have mandatory roles.
| Everything else is dynamically preserved.
|
*/
function sanitizeExcelColumns(
  raw,
) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const usedKeys = new Set();
  const columns = [];

  for (
    const [index, value] of raw.entries()
  ) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      continue;
    }

    let key = String(
      value.key ||
        `col_${index}`,
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      )
      .slice(0, 80);

    if (
      !key ||
      usedKeys.has(key)
    ) {
      key = `col_${index}`;
    }

    usedKeys.add(key);

    const role = [
      "item",
      "description",
      "quantity",
    ].includes(value.role)
      ? value.role
      : null;

    columns.push({
      key,

      label: String(
        value.label ?? "",
      )
        .trim()
        .slice(0, 255),

      role,
    });
  }

  return columns;
}

function excelColumnByRole(
  columns,
  role,
) {
  return (
    columns.find(
      (column) =>
        column.role === role,
    ) || null
  );
}

/*
|--------------------------------------------------------------------------
| Dynamic Excel row sanitizer
|--------------------------------------------------------------------------
|
| Only keys belonging to the uploaded Excel are accepted.
|
| Example:
|
| {
|   col_0: "Stage",
|   col_1: "White Floral Stage",
|   col_2: "12ft x 8ft",
|   col_3: "96",
|   col_4: "6"
| }
|
*/
function sanitizeExcelRowData(
  raw,
  columns,
) {
  const source =
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
      ? raw
      : {};

  const result = {};

  for (const column of columns) {
    result[column.key] = String(
      source[column.key] ?? "",
    ).slice(0, 10000);
  }

  return result;
}

function sanitizeNbPoints(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((value) =>
      String(
        value ?? "",
      ).trim(),
    )
    .filter(Boolean)
    .slice(
      0,
      MAX_NB_POINTS,
    );
}

function nullableDecimal(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const text = String(value)
    .replace(/,/g, "")
    .trim();

  if (
    !/^-?\d+(\.\d+)?$/.test(
      text,
    )
  ) {
    return undefined;
  }

  return text;
}

function serializeDecimal(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

/*
|--------------------------------------------------------------------------
| Image URL
|--------------------------------------------------------------------------
*/

function imagePublicUrl(
  documentId,
  image,
) {
  /*
    Meeting-origin images already have an /uploads/... URL.
  */
  if (
    String(
      image.imagePath || "",
    ).startsWith("/uploads/")
  ) {
    return image.imagePath;
  }

  /*
    PDF-only uploaded images are served through this controller.
  */
  return `/api/pdf-generator/documents/${documentId}/images/${image.id}/file`;
}

/*
|--------------------------------------------------------------------------
| Serialize PDF Item
|--------------------------------------------------------------------------
*/

function serializeItem(
  documentId,
  item,
) {
  return {
    id: String(item.id),

    sourceMeetingItemId:
      item.sourceMeetingItemId
        ? String(
            item.sourceMeetingItemId,
          )
        : null,

    sortOrder:
      item.sortOrder,

    itemName:
      item.itemName,

    description:
      item.description || "",

    quantity:
      item.quantity || "1",

    size:
      item.size || "",

    sqft:
      serializeDecimal(
        item.sqft,
      ),

    tsqft:
      serializeDecimal(
        item.tsqft,
      ),

    unit:
      item.unit || "",

    price:
      serializeDecimal(
        item.price,
      ),

    customCaption:
      item.customCaption || "",

    /*
      Dynamic Excel row information.
    */
    excelRowData:
      item.excelRowData &&
      typeof item.excelRowData ===
        "object" &&
      !Array.isArray(
        item.excelRowData,
      )
        ? item.excelRowData
        : null,

    images: (
      item.images || []
    ).map((image) => ({
      id: String(image.id),

      sourceMeetingImageId:
        image.sourceMeetingImageId
          ? String(
              image.sourceMeetingImageId,
            )
          : null,

      sortOrder:
        image.sortOrder,

      originalName:
        image.originalName ||
        image.storedFileName ||
        "Image",

      mimeType:
        image.mimeType ||
        inferMimeType(
          image.originalName ||
            image.storedFileName ||
            image.imagePath,
        ),

      fileSizeBytes:
        image.fileSizeBytes ??
        null,

      url: imagePublicUrl(
        documentId,
        image,
      ),
    })),
  };
}

/*
|--------------------------------------------------------------------------
| Serialize PDF Document
|--------------------------------------------------------------------------
*/

function serializeDocument(
  document,
  {
    includeItems = false,
  } = {},
) {
  const items =
    document.items || [];

  const photoCount =
    includeItems
      ? items.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            (
              item.images || []
            ).length,
          0,
        )
      : undefined;

  const result = {
    id: String(
      document.id,
    ),

    meetingId:
      document.meetingId
        ? String(
            document.meetingId,
          )
        : null,

    linkedRowKey:
      document.linkedRowKey ||
      null,

    documentNo:
      document.documentNo ||
      null,

    sourceMode:
      document.sourceMode,

    eventDate:
      formatDateOnly(
        document.eventDate,
      ),

    eventTitle:
      document.eventTitle,

    /*
      Meeting mode columns.
    */
    selectedColumns:
      sanitizeSelectedColumns(
        document.selectedColumns,
      ),

    /*
      Excel dynamic columns.
    */
    excelColumns:
      sanitizeExcelColumns(
        document.excelColumns,
      ),

    nbPoints:
      Array.isArray(
        document.nbPoints,
      )
        ? document.nbPoints
        : [],

    status:
      document.status,

    pageCount:
      document.pageCount ??
      null,

    itemCount:
      includeItems
        ? items.length
        : document._count
            ?.items,

    photoCount,

    generatedAt:
      formatDateTime(
        document.generatedAt,
      ),

    createdAt:
      formatDateTime(
        document.createdAt,
      ),

    updatedAt:
      formatDateTime(
        document.updatedAt,
      ),
  };

  if (includeItems) {
    result.items =
      items.map(
        (item) =>
          serializeItem(
            document.id,
            item,
          ),
      );
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Load employee-owned PDF
|--------------------------------------------------------------------------
*/

async function loadOwnedDocument(
  documentId,
  employeeId,
  {
    includeItems = true,
  } = {},
) {
  const id =
    toPositiveBigInt(
      documentId,
    );

  if (!id) {
    return null;
  }

  return prisma.pdfDocument.findFirst(
    {
      where: {
        id,
        createdById:
          employeeId,
      },

      include:
        includeItems
          ? {
              items: {
                include: {
                  images: {
                    orderBy: {
                      sortOrder:
                        "asc",
                    },
                  },
                },

                orderBy: {
                  sortOrder:
                    "asc",
                },
              },
            }
          : undefined,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Get client info from Management sheet
|--------------------------------------------------------------------------
*/

async function getClientContext(
  rowKey,
) {
  const sheet =
    await prisma.managementSheet.findFirst(
      {
        where: {
          isDefault: true,
          isActive: true,
        },

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,
        },
      },
    );

  if (!sheet) {
    return {
      clientName: "",
      eventDate: null,
    };
  }

  const row =
    await prisma.sheetRow.findFirst(
      {
        where: {
          sheetId: sheet.id,
          rowKey,
        },

        select: {
          cells: {
            where: {
              column: {
                columnName: {
                  in: [
                    "Client Name",
                    "Event Date",
                  ],
                },
              },
            },

            select: {
              valueText: true,
              displayValue: true,
              valueDate: true,

              column: {
                select: {
                  columnName: true,
                },
              },
            },
          },
        },
      },
    );

  let clientName = "";
  let eventDate = null;

  for (
    const cell of
      row?.cells || []
  ) {
    if (
      cell.column
        .columnName ===
      "Client Name"
    ) {
      clientName =
        cell.valueText ||
        cell.displayValue ||
        "";
    } else if (
      cell.column
        .columnName ===
      "Event Date"
    ) {
      eventDate =
        cell.valueDate ||
        null;
    }
  }

  return {
    clientName,
    eventDate,
  };
}

/*
|--------------------------------------------------------------------------
| Get Client Meeting snapshot
|--------------------------------------------------------------------------
*/

async function getMeetingSnapshot(
  rowKey,
  meetingId,
) {
  const id =
    toPositiveBigInt(
      meetingId,
    );

  if (!id) {
    return null;
  }

  return prisma.clientMeeting.findFirst(
    {
      where: {
        id,
        linkedRowKey:
          rowKey,
      },

      include: {
        items: {
          include: {
            images: {
              orderBy: {
                id: "asc",
              },
            },
          },

          orderBy: {
            id: "asc",
          },
        },
      },
    },
  );
}

/*
|--------------------------------------------------------------------------
| Convert meeting items into PDF snapshot rows
|--------------------------------------------------------------------------
*/

function meetingItemsCreateData(
  meeting,
) {
  return meeting.items.map(
    (
      item,
      index,
    ) => ({
      sortOrder:
        index,

      sourceMeetingItemId:
        item.id,

      itemName:
        item.customLabel?.trim() ||
        humanizeItemKey(
          item.itemKey,
        ) ||
        `Item ${index + 1}`,

      description:
        item.description || "",

      quantity:
        String(
          item.quantity ?? 1,
        ),

      size: null,
      sqft: null,
      tsqft: null,
      unit: null,
      price: null,

      customCaption:
        null,

      /*
        Meeting mode has no dynamic Excel row.
      */
      excelRowData: {},

      images: {
        create:
          item.images.map(
            (
              image,
              imageIndex,
            ) => ({
              sortOrder:
                imageIndex,

              sourceMeetingImageId:
                image.id,

              imagePath:
                image.fileUrl,

              storedFileName:
                image.storedFileName,

              originalName:
                image.originalFileName,

              mimeType:
                inferMimeType(
                  image.originalFileName,
                ) ||
                inferMimeType(
                  image.storedFileName,
                ),

              fileSizeBytes:
                image.fileSizeBytes,

              uploadedById:
                image.uploadedById,
            }),
          ),
      },
    }),
  );
}

/*
|--------------------------------------------------------------------------
| Reset PDF back to Client Meeting data
|--------------------------------------------------------------------------
*/

async function replaceDocumentWithMeetingSnapshot(
  document,
  meeting,
  employeeId,
) {
  await prisma.$transaction(
    async (tx) => {
      /*
        Remove only PDF snapshot rows.
        Client Meeting remains untouched.
      */
      await tx.pdfDocumentItem.deleteMany(
        {
          where: {
            documentId:
              document.id,
          },
        },
      );

      for (
        const data of
          meetingItemsCreateData(
            meeting,
          )
      ) {
        await tx.pdfDocumentItem.create(
          {
            data: {
              documentId:
                document.id,

              ...data,
            },
          },
        );
      }

      await tx.pdfDocument.update(
        {
          where: {
            id: document.id,
          },

          data: {
            sourceMode:
              "meeting",

            selectedColumns:
              [],

            /*
              Clear previous Excel definition.
            */
            excelColumns:
              [],

            updatedById:
              employeeId,
          },
        },
      );
    },
  );

  /*
    Delete PDF-only images left from an Excel/manual draft.
  */
  await rm(
    path.join(
      sourceImagesDirectory,
      `document-${document.id}`,
    ),
    {
      recursive: true,
      force: true,
    },
  ).catch(() => {});
}

/*
|--------------------------------------------------------------------------
| Resolve image filesystem path
|--------------------------------------------------------------------------
*/

async function absoluteImagePath(
  image,
) {
  const imagePath =
    String(
      image.imagePath || "",
    );

  /*
    Original meeting image.
  */
  if (
    imagePath.startsWith(
      "/uploads/",
    )
  ) {
    return path.join(
      meetingUploadsRootDirectory,
      imagePath.replace(
        /^\/uploads\//,
        "",
      ),
    );
  }

  /*
    PDF-specific image.
  */
  return path.join(
    storageRootDirectory,
    imagePath,
  );
}

/*
|--------------------------------------------------------------------------
| Convert DB items to renderer items
|--------------------------------------------------------------------------
*/

async function toRendererItems(
  document,
) {
  const rendererItems = [];

  for (
    const item of
      document.items || []
  ) {
    const referenceImages =
      [];

    for (
      const image of
        item.images || []
    ) {
      const mimeType =
        image.mimeType ||
        inferMimeType(
          image.originalName ||
            image.storedFileName ||
            image.imagePath,
        );

      if (
        !ALLOWED_IMAGE_TYPES.has(
          mimeType,
        )
      ) {
        throw new Error(
          `"${image.originalName || "An image"}" is ${mimeType || "an unsupported format"}. PDF generation supports JPG and PNG. Remove it from this PDF and upload a JPG/PNG copy.`,
        );
      }

      const absolutePath =
        await absoluteImagePath(
          image,
        );

      if (
        !existsSync(
          absolutePath,
        )
      ) {
        throw new Error(
          `Image file not found: ${
            image.originalName ||
            image.imagePath
          }`,
        );
      }

      referenceImages.push(
        {
          bytes:
            await readFile(
              absolutePath,
            ),

          mimeType,

          originalName:
            image.originalName,
        },
      );
    }

    rendererItems.push({
      itemName:
        item.itemName,

      description:
        item.description || "",

      quantity:
        item.quantity || "1",

      size:
        item.size || "",

      sqft:
        serializeDecimal(
          item.sqft,
        ),

      tsqft:
        serializeDecimal(
          item.tsqft,
        ),

      unit:
        item.unit || "",

      price:
        serializeDecimal(
          item.price,
        ),

      customCaption:
        item.customCaption ||
        "",

      /*
        Exact Excel row used by dynamic summary-table renderer.
      */
      excelRowData:
        item.excelRowData &&
        typeof item.excelRowData ===
          "object" &&
        !Array.isArray(
          item.excelRowData,
        )
          ? item.excelRowData
          : null,

      referenceImages,
    });
  }

  return rendererItems;
}

/*
|--------------------------------------------------------------------------
| Render employee PDF
|--------------------------------------------------------------------------
*/

async function renderOwnedDocument(
  document,
) {
  const items =
    await toRendererItems(
      document,
    );

  return generatePdfDocument({
    templatePath,

    eventDate:
      document.eventDate,

    eventTitle:
      document.eventTitle,

    items,

    /*
      meeting / excel
    */
    sourceMode:
      document.sourceMode,

    selectedColumns:
      sanitizeSelectedColumns(
        document.selectedColumns,
      ),

    /*
      Exact uploaded Excel table headers/order.
    */
    excelColumns:
      sanitizeExcelColumns(
        document.excelColumns,
      ),

    nbPoints:
      Array.isArray(
        document.nbPoints,
      )
        ? document.nbPoints
        : [],
  });
}

/*
|--------------------------------------------------------------------------
| Ensure meeting PDF draft
|--------------------------------------------------------------------------
*/

export async function ensureMeetingDraft(
  req,
  res,
  next,
) {
  const {
    rowKey,
    meetingId,
  } = req.params;

  if (
    !isValidRowKey(
      rowKey,
    )
  ) {
    return res
      .status(400)
      .json({
        message:
          "Invalid client reference.",
      });
  }

  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const meeting =
      await getMeetingSnapshot(
        rowKey,
        meetingId,
      );

    if (!meeting) {
      return res
        .status(404)
        .json({
          message:
            "Meeting not found.",
        });
    }

    if (
      !meeting.items.length
    ) {
      return res
        .status(422)
        .json({
          message:
            "Add at least one item to this meeting before generating a PDF.",
        });
    }

    /*
      Find current employee's existing draft.
    */
    let document =
      await prisma.pdfDocument.findFirst(
        {
          where: {
            meetingId:
              meeting.id,

            createdById:
              employeeId,

            status:
              "draft",
          },

          include: {
            items: {
              include: {
                images: {
                  orderBy: {
                    sortOrder:
                      "asc",
                  },
                },
              },

              orderBy: {
                sortOrder:
                  "asc",
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        },
      );

    /*
      Backfill default N.B. on old drafts that currently have none.
    */
    if (
      document &&
      (
        !Array.isArray(
          document.nbPoints,
        ) ||
        document.nbPoints.length ===
          0
      )
    ) {
      document =
        await prisma.pdfDocument.update(
          {
            where: {
              id: document.id,
            },

            data: {
              nbPoints:
                DEFAULT_PDF_NB_POINTS,

              updatedById:
                employeeId,
            },

            include: {
              items: {
                include: {
                  images: {
                    orderBy: {
                      sortOrder:
                        "asc",
                    },
                  },
                },

                orderBy: {
                  sortOrder:
                    "asc",
                },
              },
            },
          },
        );
    }

    /*
      Create new draft if none exists.
    */
    if (!document) {
      const context =
        await getClientContext(
          rowKey,
        );

      const eventDate =
        context.eventDate;

      /*
        Do not silently use meeting date.
        Event date must come from Management.
      */
      if (!eventDate) {
        return res
          .status(422)
          .json({
            message:
              "This client does not have an Event Date. Add one in Management before generating the PDF.",
          });
      }

      document =
        await prisma.$transaction(
          async (tx) => {
            const created =
              await tx.pdfDocument.create(
                {
                  data: {
                    meetingId:
                      meeting.id,

                    linkedRowKey:
                      rowKey,

                    sourceMode:
                      "meeting",

                    eventDate,

                    eventTitle:
                      context.clientName?.trim() ||
                      "Event Proposal",

                    selectedColumns:
                      [],

                    excelColumns:
                      [],

                    nbPoints:
                      DEFAULT_PDF_NB_POINTS,

                    createdById:
                      employeeId,

                    updatedById:
                      employeeId,

                    status:
                      "draft",
                  },
                },
              );

            const documentNo =
              `MME/${eventDate.getUTCFullYear()}/${String(
                created.id,
              ).padStart(
                6,
                "0",
              )}`;

            await tx.pdfDocument.update(
              {
                where: {
                  id: created.id,
                },

                data: {
                  documentNo,
                },
              },
            );

            for (
              const data of
                meetingItemsCreateData(
                  meeting,
                )
            ) {
              await tx.pdfDocumentItem.create(
                {
                  data: {
                    documentId:
                      created.id,

                    ...data,
                  },
                },
              );
            }

            return tx.pdfDocument.findUnique(
              {
                where: {
                  id: created.id,
                },

                include: {
                  items: {
                    include: {
                      images: {
                        orderBy: {
                          sortOrder:
                            "asc",
                        },
                      },
                    },

                    orderBy: {
                      sortOrder:
                        "asc",
                    },
                  },
                },
              },
            );
          },
        );
    }

    return res.json({
      data: serializeDocument(
        document,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Reset draft from Client Meeting
|--------------------------------------------------------------------------
*/

export async function resetDraftFromMeeting(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be reset.",
        });
    }

    if (
      !document.meetingId ||
      !document.linkedRowKey
    ) {
      return res
        .status(422)
        .json({
          message:
            "This document is not linked to a Client Meeting.",
        });
    }

    const meeting =
      await getMeetingSnapshot(
        document.linkedRowKey,
        document.meetingId,
      );

    if (!meeting) {
      return res
        .status(404)
        .json({
          message:
            "The source meeting no longer exists.",
        });
    }

    if (
      !meeting.items.length
    ) {
      return res
        .status(422)
        .json({
          message:
            "The source meeting has no items.",
        });
    }

    await replaceDocumentWithMeetingSnapshot(
      document,
      meeting,
      employeeId,
    );

    const reloaded =
      await loadOwnedDocument(
        document.id,
        employeeId,
      );

    return res.json({
      data: serializeDocument(
        reloaded,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Save PDF draft
|--------------------------------------------------------------------------
*/

export async function updateDocument(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be edited.",
        });
    }

    const eventDate =
      parseDateOnly(
        String(
          req.body?.eventDate ||
            "",
        ).slice(
          0,
          10,
        ),
      );

    const eventTitle =
      String(
        req.body?.eventTitle ||
          "",
      ).trim();

    const nbPoints =
      sanitizeNbPoints(
        req.body?.nbPoints,
      );

    const items =
      Array.isArray(
        req.body?.items,
      )
        ? req.body.items
        : [];

    const isExcelMode =
      document.sourceMode ===
      "excel";

    /*
      Standard optional columns are ignored in Excel mode.
    */
    const selectedColumns =
      isExcelMode
        ? []
        : sanitizeSelectedColumns(
            req.body
              ?.selectedColumns,
          );

    /*
      Dynamic Excel headers/order are preserved.
    */
    const excelColumns =
      isExcelMode
        ? sanitizeExcelColumns(
            req.body
              ?.excelColumns ??
              document.excelColumns,
          )
        : [];

    if (!eventDate) {
      return res
        .status(422)
        .json({
          message:
            "A valid event date is required.",
        });
    }

    if (!eventTitle) {
      return res
        .status(422)
        .json({
          message:
            "Event title is required.",
        });
    }

    if (
      !items.length ||
      items.length >
        MAX_ITEMS
    ) {
      return res
        .status(422)
        .json({
          message:
            `A PDF must contain between 1 and ${MAX_ITEMS} rows.`,
        });
    }

    /*
      Excel requires only Item + Description header definitions.
    */
    if (isExcelMode) {
      if (
        !excelColumnByRole(
          excelColumns,
          "item",
        ) ||
        !excelColumnByRole(
          excelColumns,
          "description",
        )
      ) {
        return res
          .status(422)
          .json({
            message:
              'Excel mode requires both an "Item/Items" column and a "Description/Details" column.',
          });
      }
    }

    const existingIds =
      new Set(
        document.items.map(
          (item) =>
            String(
              item.id,
            ),
        ),
      );

    const seenIds =
      new Set();

    const normalized = [];

    for (
      const [
        index,
        raw,
      ] of items.entries()
    ) {
      const id =
        String(
          raw?.id || "",
        );

      if (
        !existingIds.has(
          id,
        ) ||
        seenIds.has(id)
      ) {
        return res
          .status(422)
          .json({
            message:
              `Invalid PDF row at position ${
                index + 1
              }.`,
          });
      }

      seenIds.add(id);

      /*
      |--------------------------------------------------------------------------
      | Excel mode
      |--------------------------------------------------------------------------
      |
      | Exact Excel cells are saved as excelRowData.
      |
      | Rows such as:
      |
      | Items = ""
      | Details = ""
      | Qty = "Sub Total"
      | TSqft = "3443"
      |
      | are perfectly legal and remain in the PDF table.
      |
      */
      if (isExcelMode) {
        const excelRowData =
          sanitizeExcelRowData(
            raw?.excelRowData,
            excelColumns,
          );

        const itemColumn =
          excelColumnByRole(
            excelColumns,
            "item",
          );

        const descriptionColumn =
          excelColumnByRole(
            excelColumns,
            "description",
          );

        const quantityColumn =
          excelColumnByRole(
            excelColumns,
            "quantity",
          );

        const itemName =
          String(
            excelRowData[
              itemColumn.key
            ] || "",
          ).trim();

        const description =
          String(
            excelRowData[
              descriptionColumn
                .key
            ] || "",
          ).trim();

        const quantity =
          quantityColumn
            ? String(
                excelRowData[
                  quantityColumn
                    .key
                ] || "",
              ).trim() ||
              "1"
            : "1";

        normalized.push({
          id: BigInt(id),

          sortOrder:
            index,

          /*
            These fields are also maintained because they are used by
            detailed/reference PDF pages.
          */
          itemName:
            itemName.slice(
              0,
              255,
            ),

          description,

          quantity:
            quantity.slice(
              0,
              100,
            ),

          /*
            Fixed optional meeting columns are not used in Excel mode.
          */
          size: null,
          sqft: null,
          tsqft: null,
          unit: null,
          price: null,

          excelRowData,
        });

        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | Client Meeting mode
      |--------------------------------------------------------------------------
      */
      const itemName =
        String(
          raw?.itemName ||
            "",
        ).trim();

      const quantity =
        String(
          raw?.quantity ??
            "",
        ).trim();

      if (
        !itemName ||
        !quantity
      ) {
        return res
          .status(422)
          .json({
            message:
              `Item and QTY are required in row ${
                index + 1
              }.`,
          });
      }

      const sqft =
        nullableDecimal(
          raw?.sqft,
        );

      const tsqft =
        nullableDecimal(
          raw?.tsqft,
        );

      const price =
        nullableDecimal(
          raw?.price,
        );

      if (
        sqft === undefined ||
        tsqft ===
          undefined ||
        price === undefined
      ) {
        return res
          .status(422)
          .json({
            message:
              `SQFT, TSqft and Price must be valid numbers in row ${
                index + 1
              }.`,
          });
      }

      normalized.push({
        id: BigInt(id),

        sortOrder:
          index,

        itemName:
          itemName.slice(
            0,
            255,
          ),

        description:
          String(
            raw?.description ||
              "",
          ).trim(),

        quantity:
          quantity.slice(
            0,
            100,
          ),

        size:
          String(
            raw?.size || "",
          )
            .trim()
            .slice(
              0,
              120,
            ) || null,

        sqft,

        tsqft,

        unit:
          String(
            raw?.unit || "",
          )
            .trim()
            .slice(
              0,
              80,
            ) || null,

        price,

        excelRowData:
          {},
      });
    }

    /*
      Footer rows can have blank Item,
      but the uploaded Excel must have at least one genuine item row.
    */
    if (
      isExcelMode &&
      !normalized.some(
        (item) =>
          item.itemName,
      )
    ) {
      return res
        .status(422)
        .json({
          message:
            "The Excel table must contain at least one row with an Item/Items value.",
        });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.pdfDocument.update(
          {
            where: {
              id: document.id,
            },

            data: {
              eventDate,
              eventTitle,

              selectedColumns,

              excelColumns:
                isExcelMode
                  ? excelColumns
                  : [],

              nbPoints,

              updatedById:
                employeeId,
            },
          },
        );

        for (
          const item of
            normalized
        ) {
          await tx.pdfDocumentItem.update(
            {
              where: {
                id: item.id,
              },

              data: {
                sortOrder:
                  item.sortOrder,

                itemName:
                  item.itemName,

                description:
                  item.description,

                quantity:
                  item.quantity,

                size:
                  item.size,

                sqft:
                  item.sqft,

                tsqft:
                  item.tsqft,

                unit:
                  item.unit,

                price:
                  item.price,

                excelRowData:
                  item.excelRowData,
              },
            },
          );
        }
      },
    );

    const reloaded =
      await loadOwnedDocument(
        document.id,
        employeeId,
      );

    return res.json({
      data: serializeDocument(
        reloaded,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Add PDF row
|--------------------------------------------------------------------------
*/

export async function createDocumentItem(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be edited.",
        });
    }

    const itemCount =
      await prisma.pdfDocumentItem.count(
        {
          where: {
            documentId:
              document.id,
          },
        },
      );

    if (
      itemCount >=
      MAX_ITEMS
    ) {
      return res
        .status(422)
        .json({
          message:
            `A PDF can contain at most ${MAX_ITEMS} rows.`,
        });
    }

    const lastItem =
      await prisma.pdfDocumentItem.findFirst(
        {
          where: {
            documentId:
              document.id,
          },

          orderBy: {
            sortOrder:
              "desc",
          },

          select: {
            sortOrder:
              true,
          },
        },
      );

    const requestedItemName =
      String(
        req.body
          ?.itemName ||
          "Other",
      ).trim() ||
      "Other";

    let createData;

    /*
    |--------------------------------------------------------------------------
    | Excel mode manual row
    |--------------------------------------------------------------------------
    |
    | If employee clicks Add Item after Excel import, create a new row using
    | that exact Excel column structure.
    |
    */
    if (
      document.sourceMode ===
      "excel"
    ) {
      const excelColumns =
        sanitizeExcelColumns(
          document.excelColumns,
        );

      const itemColumn =
        excelColumnByRole(
          excelColumns,
          "item",
        );

      const descriptionColumn =
        excelColumnByRole(
          excelColumns,
          "description",
        );

      if (
        !itemColumn ||
        !descriptionColumn
      ) {
        return res
          .status(422)
          .json({
            message:
              "Upload a valid Excel table before adding an Excel row.",
          });
      }

      const excelRowData =
        Object.fromEntries(
          excelColumns.map(
            (column) => [
              column.key,
              "",
            ],
          ),
        );

      excelRowData[
        itemColumn.key
      ] =
        requestedItemName;

      createData = {
        documentId:
          document.id,

        sourceMeetingItemId:
          null,

        sortOrder:
          (
            lastItem?.sortOrder ??
            -1
          ) + 1,

        itemName:
          requestedItemName.slice(
            0,
            255,
          ),

        description:
          "",

        quantity:
          "1",

        size: null,
        sqft: null,
        tsqft: null,
        unit: null,
        price: null,

        excelRowData,
      };
    } else {
      /*
      |--------------------------------------------------------------------------
      | Meeting mode manual row
      |--------------------------------------------------------------------------
      */
      const itemName =
        String(
          req.body
            ?.itemName || "",
        ).trim();

      if (!itemName) {
        return res
          .status(422)
          .json({
            message:
              "Choose an item before adding it.",
          });
      }

      createData = {
        documentId:
          document.id,

        sourceMeetingItemId:
          null,

        sortOrder:
          (
            lastItem?.sortOrder ??
            -1
          ) + 1,

        itemName:
          itemName.slice(
            0,
            255,
          ),

        description:
          "",

        quantity:
          "1",

        size: null,
        sqft: null,
        tsqft: null,
        unit: null,
        price: null,

        excelRowData:
          {},
      };
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.pdfDocumentItem.create(
          {
            data:
              createData,
          },
        );

        await tx.pdfDocument.update(
          {
            where: {
              id: document.id,
            },

            data: {
              updatedById:
                employeeId,
            },
          },
        );
      },
    );

    const reloaded =
      await loadOwnedDocument(
        document.id,
        employeeId,
      );

    return res
      .status(201)
      .json({
        data: serializeDocument(
          reloaded,
          {
            includeItems:
              true,
          },
        ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Delete PDF row
|--------------------------------------------------------------------------
*/

export async function deleteDocumentItem(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be edited.",
        });
    }

    const itemId =
      toPositiveBigInt(
        req.params.itemId,
      );

    if (!itemId) {
      return res
        .status(400)
        .json({
          message:
            "Invalid PDF item.",
        });
    }

    const item =
      await prisma.pdfDocumentItem.findFirst(
        {
          where: {
            id: itemId,

            documentId:
              document.id,
          },

          include: {
            images: true,
          },
        },
      );

    if (!item) {
      return res
        .status(404)
        .json({
          message:
            "PDF item not found.",
        });
    }

    const itemCount =
      await prisma.pdfDocumentItem.count(
        {
          where: {
            documentId:
              document.id,
          },
        },
      );

    if (
      itemCount <= 1
    ) {
      return res
        .status(422)
        .json({
          message:
            "A PDF must contain at least one item.",
        });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.pdfDocumentItem.delete(
          {
            where: {
              id: item.id,
            },
          },
        );

        /*
          Re-number sort order.
        */
        const remaining =
          await tx.pdfDocumentItem.findMany(
            {
              where: {
                documentId:
                  document.id,
              },

              orderBy: {
                sortOrder:
                  "asc",
              },

              select: {
                id: true,
                sortOrder:
                  true,
              },
            },
          );

        for (
          const [
            index,
            row,
          ] of remaining.entries()
        ) {
          if (
            row.sortOrder !==
            index
          ) {
            await tx.pdfDocumentItem.update(
              {
                where: {
                  id: row.id,
                },

                data: {
                  sortOrder:
                    index,
                },
              },
            );
          }
        }

        await tx.pdfDocument.update(
          {
            where: {
              id: document.id,
            },

            data: {
              updatedById:
                employeeId,
            },
          },
        );
      },
    );

    /*
      Delete only PDF-uploaded files.

      Original meeting image files remain untouched.
    */
    for (
      const image of
        item.images || []
    ) {
      if (
        !String(
          image.imagePath ||
            "",
        ).startsWith(
          "/uploads/",
        )
      ) {
        await unlink(
          path.join(
            storageRootDirectory,
            image.imagePath,
          ),
        ).catch(() => {});
      }
    }

    const reloaded =
      await loadOwnedDocument(
        document.id,
        employeeId,
      );

    return res.json({
      data: serializeDocument(
        reloaded,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Excel Import
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Excel Upload is a full PDF source switch.
|
| Client Meeting snapshot:
|
|   Stage
|   Entry Gate
|   Photo Booth
|
| becomes:
|
|   Whatever rows are in uploaded Excel
|
| The original Client Meeting itself is NEVER modified.
|
| Only these Excel headers are mandatory:
|
| Item / Items
| Description / Details
|
| All other columns remain dynamic.
|
*/
export async function importExcelRows(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  let importId = null;

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can import Excel data.",
        });
    }

    const rows =
      Array.isArray(
        req.body?.rows,
      )
        ? req.body.rows
        : [];

    if (
      !rows.length ||
      rows.length >
        MAX_ITEMS
    ) {
      return res
        .status(422)
        .json({
          message:
            `Excel must contain between 1 and ${MAX_ITEMS} non-empty table rows.`,
        });
    }

    const originalFileName =
      String(
        req.body
          ?.originalFileName ||
          "",
      )
        .trim()
        .slice(
          0,
          255,
        );

    if (
      !originalFileName
    ) {
      return res
        .status(422)
        .json({
          message:
            "Excel file name is required.",
        });
    }

    /*
      Preserve exact Excel headers/order.
    */
    const excelColumns =
      sanitizeExcelColumns(
        req.body
          ?.excelColumns,
      );

    const itemColumn =
      excelColumnByRole(
        excelColumns,
        "item",
      );

    const descriptionColumn =
      excelColumnByRole(
        excelColumns,
        "description",
      );

    const quantityColumn =
      excelColumnByRole(
        excelColumns,
        "quantity",
      );

    /*
      Only these two column HEADERS are mandatory.
    */
    if (
      !itemColumn ||
      !descriptionColumn
    ) {
      return res
        .status(422)
        .json({
          message:
            'Excel must contain both an "Item"/"Items" column and a "Description"/"Details" column.',
        });
    }

    const normalizedRows =
      [];

    for (
      const [
        index,
        row,
      ] of rows.entries()
    ) {
      /*
        Keep every uploaded Excel column.
      */
      const excelRowData =
        sanitizeExcelRowData(
          row?.excelRowData,
          excelColumns,
        );

      /*
        Ignore only a fully blank row.
      */
      const hasAnyValue =
        Object.values(
          excelRowData,
        ).some(
          (value) =>
            String(
              value,
            ).trim(),
        );

      if (!hasAnyValue) {
        continue;
      }

      /*
        Item can be empty for subtotal/footer rows.
      */
      const itemName =
        String(
          excelRowData[
            itemColumn.key
          ] || "",
        ).trim();

      /*
        Description can also be empty for subtotal/footer rows.
      */
      const description =
        String(
          excelRowData[
            descriptionColumn
              .key
          ] || "",
        ).trim();

      /*
        Qty/Quantity is optional.
      */
      const quantity =
        quantityColumn
          ? String(
              excelRowData[
                quantityColumn
                  .key
              ] || "",
            ).trim() ||
            "1"
          : "1";

      normalizedRows.push(
        {
          sortOrder:
            normalizedRows.length,

          sourceMeetingItemId:
            null,

          /*
            These are used for detailed/reference PDF pages.

            Footer rows may have empty itemName.
          */
          itemName:
            itemName.slice(
              0,
              255,
            ),

          description,

          quantity:
            quantity.slice(
              0,
              100,
            ),

          /*
            Excel mode no longer depends on these fixed fields.
          */
          size: null,
          sqft: null,
          tsqft: null,
          unit: null,
          price: null,

          customCaption:
            null,

          /*
            Exact dynamic Excel row.
          */
          excelRowData,
        },
      );
    }

    if (
      !normalizedRows.length
    ) {
      return res
        .status(422)
        .json({
          message:
            "No Excel table rows were found.",
        });
    }

    /*
      We allow footer rows with blank Item,
      but there must be at least one actual item somewhere in the Excel.
    */
    if (
      !normalizedRows.some(
        (row) =>
          row.itemName,
      )
    ) {
      return res
        .status(422)
        .json({
          message:
            "The Excel table must contain at least one row with an Item/Items value.",
        });
    }

    const imported =
      await prisma.$transaction(
        async (tx) => {
          /*
          |--------------------------------------------------------------------------
          | Create import history
          |--------------------------------------------------------------------------
          */
          const log =
            await tx.pdfDocumentImport.create(
              {
                data: {
                  documentId:
                    document.id,

                  importedById:
                    employeeId,

                  originalFileName,

                  selectedSheetName:
                    String(
                      req.body
                        ?.sheetName ||
                        "",
                    )
                      .trim()
                      .slice(
                        0,
                        255,
                      ) ||
                    null,

                  status:
                    "processing",

                  totalRows:
                    normalizedRows.length,

                  /*
                    Exact Excel headers.
                  */
                  detectedHeaders:
                    excelColumns.map(
                      (column) =>
                        column.label,
                    ),

                  columnMapping:
                    Object.fromEntries(
                      excelColumns.map(
                        (
                          column,
                        ) => [
                          column.key,
                          column.label,
                        ],
                      ),
                    ),
                },
              },
            );

          importId =
            log.id;

          /*
          |--------------------------------------------------------------------------
          | IMPORTANT:
          | Full source switch from Meeting -> Excel
          |--------------------------------------------------------------------------
          |
          | Deleting PDF snapshot rows also removes snapshot images via FK cascade.
          |
          | Client Meeting tables are NOT changed.
          |
          */
          await tx.pdfDocumentItem.deleteMany(
            {
              where: {
                documentId:
                  document.id,
              },
            },
          );

          /*
          |--------------------------------------------------------------------------
          | Create every Excel row exactly in original order
          |--------------------------------------------------------------------------
          */
          for (
            const row of
              normalizedRows
          ) {
            await tx.pdfDocumentItem.create(
              {
                data: {
                  documentId:
                    document.id,

                  ...row,
                },
              },
            );
          }

          /*
          |--------------------------------------------------------------------------
          | Switch PDF document into Excel mode
          |--------------------------------------------------------------------------
          */
          await tx.pdfDocument.update(
            {
              where: {
                id: document.id,
              },

              data: {
                sourceMode:
                  "excel",

                /*
                  Meeting-mode optional column configuration is no longer used.
                */
                selectedColumns:
                  [],

                /*
                  Preserve exact dynamic Excel headers/order.
                */
                excelColumns,

                updatedById:
                  employeeId,
              },
            },
          );

          /*
          |--------------------------------------------------------------------------
          | Mark Excel import complete
          |--------------------------------------------------------------------------
          */
          await tx.pdfDocumentImport.update(
            {
              where: {
                id: log.id,
              },

              data: {
                status:
                  "completed",

                importedRows:
                  normalizedRows.length,

                failedRows:
                  0,
              },
            },
          );

          return log;
        },
      );

    /*
      Remove old PDF-only image files from previous draft source.

      Original Client Meeting upload files are never removed here.
    */
    await rm(
      path.join(
        sourceImagesDirectory,
        `document-${document.id}`,
      ),
      {
        recursive: true,
        force: true,
      },
    ).catch(() => {});

    const reloaded =
      await loadOwnedDocument(
        document.id,
        employeeId,
      );

    return res.json({
      data: serializeDocument(
        reloaded,
        {
          includeItems:
            true,
        },
      ),

      importId:
        String(
          imported.id,
        ),
    });
  } catch (error) {
    /*
      If an import history row was already created,
      mark it failed.
    */
    if (importId) {
      await prisma.pdfDocumentImport
        .update({
          where: {
            id: importId,
          },

          data: {
            status:
              "failed",

            errorMessage:
              String(
                error.message ||
                  error,
              ).slice(
                0,
                5000,
              ),
          },
        })
        .catch(() => {});
    }

    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Upload image to one PDF item
|--------------------------------------------------------------------------
|
| This works for both:
|
| - Client Meeting PDF rows
| - Excel PDF rows
|
| Excel rows can therefore have multiple manually uploaded images.
|
*/
export async function uploadDocumentItemImage(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    if (!req.file) {
      return res
        .status(422)
        .json({
          message:
            "Choose a JPG or PNG image.",
        });
    }

    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be edited.",
        });
    }

    const itemId =
      toPositiveBigInt(
        req.params.itemId,
      );

    if (!itemId) {
      return res
        .status(400)
        .json({
          message:
            "Invalid PDF item.",
        });
    }

    const item =
      await prisma.pdfDocumentItem.findFirst(
        {
          where: {
            id: itemId,

            documentId:
              document.id,
          },

          include: {
            images: {
              select: {
                sortOrder:
                  true,
              },

              orderBy: {
                sortOrder:
                  "desc",
              },

              take: 1,
            },
          },
        },
      );

    if (!item) {
      return res
        .status(404)
        .json({
          message:
            "PDF item not found.",
        });
    }

    /*
      In Excel mode only real item rows should normally upload images.
      Subtotal/footer rows contain an empty itemName and the frontend
      does not show an upload button for them.
    */
    if (
      document.sourceMode ===
        "excel" &&
      !String(
        item.itemName || "",
      ).trim()
    ) {
      return res
        .status(422)
        .json({
          message:
            "Images can only be uploaded to Excel rows that contain an Item/Items value.",
        });
    }

    const count =
      await prisma.pdfDocumentItemImage.count(
        {
          where: {
            documentItemId:
              item.id,
          },
        },
      );

    if (
      count >=
      MAX_IMAGES_PER_ITEM
    ) {
      return res
        .status(422)
        .json({
          message:
            `An item can contain at most ${MAX_IMAGES_PER_ITEM} images.`,
        });
    }

    const extension =
      req.file.mimetype ===
      "image/png"
        ? ".png"
        : ".jpg";

    const storedFileName =
      `${crypto.randomUUID()}${extension}`;

    const relativePath =
      path.posix.join(
        "source-images",
        `document-${document.id}`,
        storedFileName,
      );

    const absolutePath =
      path.join(
        storageRootDirectory,
        relativePath,
      );

    mkdirSync(
      path.dirname(
        absolutePath,
      ),
      {
        recursive: true,
      },
    );

    await writeFile(
      absolutePath,
      req.file.buffer,
    );

    const created =
      await prisma.pdfDocumentItemImage.create(
        {
          data: {
            documentItemId:
              item.id,

            sortOrder:
              (
                item.images[0]
                  ?.sortOrder ??
                -1
              ) + 1,

            imagePath:
              relativePath,

            storedFileName,

            originalName:
              req.file
                .originalname ||
              null,

            mimeType:
              req.file.mimetype,

            fileSizeBytes:
              req.file.size,

            uploadedById:
              employeeId,
          },
        },
      );

    return res
      .status(201)
      .json({
        data: {
          id: String(
            created.id,
          ),

          sourceMeetingImageId:
            null,

          sortOrder:
            created.sortOrder,

          originalName:
            created.originalName ||
            created.storedFileName ||
            "Image",

          mimeType:
            created.mimeType,

          fileSizeBytes:
            created.fileSizeBytes,

          url: imagePublicUrl(
            document.id,
            created,
          ),
        },
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Delete image from PDF item
|--------------------------------------------------------------------------
*/

export async function deleteDocumentItemImage(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Only draft documents can be edited.",
        });
    }

    const imageId =
      toPositiveBigInt(
        req.params.imageId,
      );

    const itemId =
      toPositiveBigInt(
        req.params.itemId,
      );

    if (
      !imageId ||
      !itemId
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid image reference.",
        });
    }

    const image =
      await prisma.pdfDocumentItemImage.findFirst(
        {
          where: {
            id: imageId,

            documentItemId:
              itemId,

            documentItem: {
              documentId:
                document.id,
            },
          },
        },
      );

    if (!image) {
      return res
        .status(404)
        .json({
          message:
            "Image not found.",
        });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.pdfDocumentItemImage.delete(
          {
            where: {
              id: image.id,
            },
          },
        );

        /*
          Keep remaining image sequence clean.
        */
        const remaining =
          await tx.pdfDocumentItemImage.findMany(
            {
              where: {
                documentItemId:
                  itemId,
              },

              orderBy: {
                sortOrder:
                  "asc",
              },

              select: {
                id: true,
                sortOrder:
                  true,
              },
            },
          );

        for (
          const [
            index,
            row,
          ] of remaining.entries()
        ) {
          if (
            index !==
            row.sortOrder
          ) {
            await tx.pdfDocumentItemImage.update(
              {
                where: {
                  id: row.id,
                },

                data: {
                  sortOrder:
                    index,
                },
              },
            );
          }
        }
      },
    );

    /*
      Never delete original Client Meeting files.
    */
    if (
      !String(
        image.imagePath,
      ).startsWith(
        "/uploads/",
      )
    ) {
      await unlink(
        path.join(
          storageRootDirectory,
          image.imagePath,
        ),
      ).catch(() => {});
    }

    return res.json({
      data: {
        deleted: true,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Serve PDF item image
|--------------------------------------------------------------------------
*/

export async function serveDocumentImage(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    const imageId =
      toPositiveBigInt(
        req.params.imageId,
      );

    if (!imageId) {
      return res
        .status(400)
        .json({
          message:
            "Invalid image reference.",
        });
    }

    const image =
      await prisma.pdfDocumentItemImage.findFirst(
        {
          where: {
            id: imageId,

            documentItem: {
              documentId:
                document.id,
            },
          },
        },
      );

    if (!image) {
      return res
        .status(404)
        .json({
          message:
            "Image not found.",
        });
    }

    const absolutePath =
      await absoluteImagePath(
        image,
      );

    if (
      !existsSync(
        absolutePath,
      )
    ) {
      return res
        .status(404)
        .json({
          message:
            "Image file not found.",
        });
    }

    return res.sendFile(
      absolutePath,
    );
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Preview PDF
|--------------------------------------------------------------------------
*/

export async function previewDocument(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    const {
      bytes,
    } =
      await renderOwnedDocument(
        document,
      );

    res.set({
      "Content-Type":
        "application/pdf",

      "Content-Disposition":
        'inline; filename="preview.pdf"',
    });

    return res.send(
      Buffer.from(
        bytes,
      ),
    );
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Generate final PDF
|--------------------------------------------------------------------------
*/

export async function generateDocument(
  req,
  res,
  next,
) {
  const employeeId =
    BigInt(
      req.employee.id,
    );

  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      document.status !==
      "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "This document has already been generated.",
        });
    }

    const {
      bytes,
      pageCount,
    } =
      await renderOwnedDocument(
        document,
      );

    const generatedFileName =
      `${
        (
          document.documentNo ||
          `document-${document.id}`
        ).replace(
          /\//g,
          "-",
        )
      }.pdf`;

    await writeFile(
      path.join(
        generatedDirectory,
        generatedFileName,
      ),
      Buffer.from(
        bytes,
      ),
    );

    const updated =
      await prisma.pdfDocument.update(
        {
          where: {
            id: document.id,
          },

          data: {
            generatedFileName,

            generatedFilePath:
              path.posix.join(
                "generated",
                generatedFileName,
              ),

            pageCount,

            generatedAt:
              new Date(),

            status:
              "generated",

            updatedById:
              employeeId,
          },

          include: {
            items: {
              include: {
                images: true,
              },

              orderBy: {
                sortOrder:
                  "asc",
              },
            },
          },
        },
      );

    return res.json({
      data: serializeDocument(
        updated,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Document History
|--------------------------------------------------------------------------
*/

export async function listDocuments(
  req,
  res,
  next,
) {
  try {
    const employeeId =
      BigInt(
        req.employee.id,
      );

    const documents =
      await prisma.pdfDocument.findMany(
        {
          where: {
            createdById:
              employeeId,

            status: {
              in: [
                "generated",
                "archived",
              ],
            },
          },

          include: {
            items: {
              include: {
                images: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        },
      );

    return res.json({
      data:
        documents.map(
          (document) =>
            serializeDocument(
              document,
              {
                includeItems:
                  true,
              },
            ),
        ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Get one document
|--------------------------------------------------------------------------
*/

export async function getDocument(
  req,
  res,
  next,
) {
  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        BigInt(
          req.employee.id,
        ),
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    return res.json({
      data: serializeDocument(
        document,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Download generated PDF
|--------------------------------------------------------------------------
*/

export async function downloadDocument(
  req,
  res,
  next,
) {
  try {
    const document =
      await loadOwnedDocument(
        req.params.id,
        BigInt(
          req.employee.id,
        ),
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    if (
      !document.generatedFilePath
    ) {
      return res
        .status(404)
        .json({
          message:
            "This document has not been generated yet.",
        });
    }

    const absolutePath =
      path.join(
        storageRootDirectory,
        document.generatedFilePath,
      );

    if (
      !existsSync(
        absolutePath,
      )
    ) {
      return res
        .status(404)
        .json({
          message:
            "The generated PDF file could not be found.",
        });
    }

    return res.download(
      absolutePath,

      document.generatedFileName ||
        "document.pdf",
    );
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Archive generated PDF
|--------------------------------------------------------------------------
*/

export async function archiveDocument(
  req,
  res,
  next,
) {
  try {
    const employeeId =
      BigInt(
        req.employee.id,
      );

    const document =
      await loadOwnedDocument(
        req.params.id,
        employeeId,
        {
          includeItems:
            false,
        },
      );

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Document not found.",
        });
    }

    const updated =
      await prisma.pdfDocument.update(
        {
          where: {
            id: document.id,
          },

          data: {
            status:
              "archived",

            updatedById:
              employeeId,
          },

          include: {
            items: {
              include: {
                images: true,
              },

              orderBy: {
                sortOrder:
                  "asc",
              },
            },
          },
        },
      );

    return res.json({
      data: serializeDocument(
        updated,
        {
          includeItems:
            true,
        },
      ),
    });
  } catch (error) {
    return next(error);
  }
}