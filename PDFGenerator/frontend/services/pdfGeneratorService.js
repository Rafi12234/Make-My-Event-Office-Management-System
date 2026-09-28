const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const API_ORIGIN =
  API_BASE_URL.replace(
    /\/api\/?$/,
    "",
  );

async function parseJsonResponse(
  response,
) {
  const payload =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.message ||
        `Request failed with status ${response.status}.`,
    );
  }

  return (
    payload.data ??
    payload
  );
}

async function parsePdfResponse(
  response,
) {
  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(() => ({}));

    throw new Error(
      payload.message ||
        `Request failed with status ${response.status}.`,
    );
  }

  return response.blob();
}

/*
|--------------------------------------------------------------------------
| Image URL
|--------------------------------------------------------------------------
*/

export function resolvePdfImageUrl(
  url,
) {
  if (!url) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      url,
    )
  ) {
    return url;
  }

  return `${API_ORIGIN}${
    url.startsWith("/")
      ? url
      : `/${url}`
  }`;
}

/*
|--------------------------------------------------------------------------
| Meeting -> PDF draft
|--------------------------------------------------------------------------
*/

export async function ensureMeetingPdfDraft(
  rowKey,
  meetingId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/meeting/${rowKey}/${meetingId}/draft`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Save PDF draft
|--------------------------------------------------------------------------
*/

export async function savePdfDraft(
  documentId,
  draft,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}`,
      {
        method:
          "PUT",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            draft,
          ),
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Reset draft from meeting
|--------------------------------------------------------------------------
*/

export async function resetPdfDraftFromMeeting(
  documentId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/reset-from-meeting`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Import Excel
|--------------------------------------------------------------------------
*/

export async function importExcelIntoPdfDraft(
  documentId,
  payload,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/import-excel`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Create item
|--------------------------------------------------------------------------
*/

export async function createPdfDocumentItem(
  documentId,
  itemName,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/items`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            itemName,
          }),
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Delete item
|--------------------------------------------------------------------------
*/

export async function deletePdfDocumentItem(
  documentId,
  itemId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}`,
      {
        method:
          "DELETE",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Upload item image
|--------------------------------------------------------------------------
*/

export async function uploadPdfItemImage(
  documentId,
  itemId,
  file,
) {
  const formData =
    new FormData();

  formData.append(
    "image",
    file,
  );

  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}/images`,
      {
        method:
          "POST",

        credentials:
          "include",

        body:
          formData,
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Delete item image
|--------------------------------------------------------------------------
*/

export async function deletePdfItemImage(
  documentId,
  itemId,
  imageId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/items/${itemId}/images/${imageId}`,
      {
        method:
          "DELETE",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Preview
|--------------------------------------------------------------------------
|
| Preview still needs a Blob because the PDF is displayed through a browser
| object URL.
|
*/

export async function previewPdfDocument(
  documentId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/preview`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/pdf",
        },
      },
    );

  return parsePdfResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Generate final PDF
|--------------------------------------------------------------------------
*/

export async function generatePdfDocument(
  documentId,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${documentId}/generate`,
      {
        method:
          "POST",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Document History
|--------------------------------------------------------------------------
*/

export async function listPdfDocuments() {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents`,
      {
        credentials:
          "include",
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Get single document
|--------------------------------------------------------------------------
*/

export async function getPdfDocument(
  id,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${id}`,
      {
        credentials:
          "include",
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Fetch PDF as Blob
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Keep this function because Preview currently uses the generated document
| download endpoint to obtain PDF bytes and create an object URL.
|
| Do NOT use this function for the Document History download button.
|
| Large PDFs with 30-40+ images should not first be loaded completely into
| JavaScript memory just to start a browser download.
|
*/

export async function downloadPdfDocument(
  id,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${id}/download`,
      {
        credentials:
          "include",

        headers: {
          Accept:
            "application/pdf",
        },
      },
    );

  return parsePdfResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Native browser download URL
|--------------------------------------------------------------------------
|
| Document History uses this endpoint directly.
|
| Flow:
|
| Browser
|   ↓
| GET /documents/:id/download
|   ↓
| Express res.download(...)
|   ↓
| Browser download manager
|
| There is NO:
|
| fetch()
| response.blob()
| URL.createObjectURL()
|
| in this flow.
|
*/

export function getPdfDocumentDownloadUrl(
  id,
) {
  return `${API_BASE_URL}/pdf-generator/documents/${encodeURIComponent(
    String(id),
  )}/download`;
}

/*
|--------------------------------------------------------------------------
| Start native PDF download
|--------------------------------------------------------------------------
|
| This is the important function for large files.
|
| The browser itself requests the existing generated PDF.
| The backend can therefore stream/send the stored file directly.
|
*/

export function startPdfDocumentDownload(
  id,
) {
  if (
    id == null ||
    id === ""
  ) {
    throw new Error(
      "A document ID is required to start the download.",
    );
  }

  const link =
    document.createElement(
      "a",
    );

  link.href =
    getPdfDocumentDownloadUrl(
      id,
    );

  link.style.display =
    "none";

  link.setAttribute(
    "aria-hidden",
    "true",
  );

  /*
  | Do NOT set Blob data here.
  |
  | Also, the server already sends:
  |
  | Content-Disposition: attachment
  |
  | so the backend controls the correct PDF filename.
  */

  document.body.appendChild(
    link,
  );

  link.click();

  /*
  | Remove the temporary link after the browser has received the click.
  */

  window.setTimeout(
    () => {
      link.remove();
    },
    0,
  );
}

/*
|--------------------------------------------------------------------------
| Archive
|--------------------------------------------------------------------------
*/

export async function archivePdfDocument(
  id,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/pdf-generator/documents/${id}/archive`,
      {
        method:
          "PATCH",

        credentials:
          "include",
      },
    );

  return parseJsonResponse(
    response,
  );
}

/*
|--------------------------------------------------------------------------
| Save Blob helper
|--------------------------------------------------------------------------
|
| Keep this helper because other PDF flows may still use Blob-based downloads.
|
*/

export function saveBlobAs(
  blob,
  filename,
) {
  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link,
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url,
  );
}